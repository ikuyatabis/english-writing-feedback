// Cloudflare Pages: protect every route before serving static site files.
// LAB_ACCESS_PASSWORD must be configured as an encrypted Pages secret.
const COOKIE = '__Host-swlab_session';
const MAX_SESSION_AGE = 7 * 24 * 60 * 60;
const enc = new TextEncoder();

function asHTML(source, status = 200) {
  return new Response(source, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function escapeHTML(input) {
  return String(input).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeNext(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) {
    return '/';
  }
  // Do not let the login page become a redirect target, and avoid abuse of the login route.
  if (raw === '/__lab/login' || raw.startsWith('/__lab/login?') || raw.startsWith('/__lab/logout')) return '/';
  return raw.slice(0, 1024);
}

function page({ error = '', next = '/', authenticated = false } = {}) {
  const content = authenticated
    ? '<p>ログイン済みです。</p><p><a href="/">答案ラボを開く</a></p><form action="/__lab/logout" method="post"><button type="submit">ログアウト</button></form>'
    : `<p class="desc">利用するには共通パスワードを入力してください。</p>${error ? '<p class="error" role="alert">パスワードが正しくありません。</p>' : ''}<form action="/__lab/login" method="post"><input type="hidden" name="next" value="${escapeHTML(next)}"><label for="password">パスワード</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus maxlength="512"><button type="submit">ログイン</button></form>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light"><title>ログイン｜柴田答案ラボ</title><style>:root{color-scheme:only light;--bg:#f5f0e5;--card:#fffdf8;--ink:#251f19;--sub:#756b5c}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Yu Gothic",sans-serif}.card{width:min(100%,440px);border:1px solid #d8cdb8;border-top:5px solid #85023e;border-radius:7px;background:var(--card);padding:32px 28px;box-shadow:0 2px 8px #0000000d}h1{font-family:"Yu Mincho",serif;text-align:center;font-size:1.6rem;margin:0 0 8px}.subtitle{text-align:center;color:var(--sub);margin:0 0 32px;font-size:.9rem}.desc{line-height:1.7}label{display:block;margin:22px 0 8px;font-weight:600}input[type=password]{width:100%;font:inherit;padding:12px 13px;border:1px solid #a9a094;border-radius:5px;background:white;color:var(--ink)}button{display:block;width:100%;margin-top:20px;background:#85023e;color:white;font:inherit;font-weight:600;border:0;border-radius:5px;padding:13px;cursor:pointer}.error{color:#ac1e2b;font-weight:600}a{color:#85023e}@media(max-width:480px){.card{padding:24px 18px}}</style></head><body><main class="card"><h1>柴田答案ラボ</h1><p class="subtitle">Shibata Writing Lab</p>${content}</main></body></html>`;
}

function cookieFrom(request) {
  const header = request.headers.get('Cookie') || '';
  for (const item of header.split(';')) {
    const [name, ...value] = item.trim().split('=');
    if (name === COOKIE) return value.join('=');
  }
  return '';
}

async function hmacKey(password) {
  return crypto.subtle.importKey('raw', enc.encode('swlab-session-v1:' + password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; ++i) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

async function validSession(request, key) {
  const match = /^v1\.(\d{10})\.([0-9a-f]{64})$/.exec(cookieFrom(request));
  if (!match) return false;
  const expiration = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiration <= now || expiration > now + MAX_SESSION_AGE) return false;
  return crypto.subtle.verify('HMAC', key, fromHex(match[2]), enc.encode(`v1.${match[1]}`));
}

async function samePassword(actual, expected) {
  // Compare fixed-length SHA-256 digests to avoid a direct variable-length string comparison.
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(actual)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function sessionCookie(key) {
  const expiration = Math.floor(Date.now() / 1000) + MAX_SESSION_AGE;
  const body = `v1.${expiration}`;
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  const signature = Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
  return `${COOKIE}=${body}.${signature}; Path=/; Max-Age=${MAX_SESSION_AGE}; Secure; HttpOnly; SameSite=Lax`;
}

function redirect(location, cookie) {
  const headers = new Headers({
    Location: location,
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function onRequest(context) {
  const { request, env } = context;
  // Fail closed if the secret has not been provided in this deployment environment.
  const password = env.LAB_ACCESS_PASSWORD;
  if (typeof password !== 'string' || password.length < 12) {
    return new Response('Access is temporarily unavailable (configuration required).', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const url = new URL(request.url);
  const key = await hmacKey(password);
  const loggedIn = await validSession(request, key);

  if (url.pathname === '/__lab/login') {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return asHTML(page({ authenticated: loggedIn, next: safeNext(url.searchParams.get('next')) }));
    }
    if (request.method !== 'POST' || !sameOrigin(request)) return new Response('Forbidden', { status: 403 });
    if (!/^application\/x-www-form-urlencoded(?:\s*;|\s*$)/i.test(request.headers.get('Content-Type') || '')) {
      return new Response('Unsupported Media Type', { status: 415 });
    }
    const size = Number(request.headers.get('Content-Length') || 0);
    if (size > 4096) return new Response('Request too large', { status: 413 });
    const body = await request.text();
    if (body.length > 4096) return new Response('Request too large', { status: 413 });
    const form = new URLSearchParams(body);
    const candidate = form.get('password') || '';
    const next = safeNext(form.get('next'));
    if (candidate.length <= 512 && await samePassword(candidate, password)) {
      return redirect(next, await sessionCookie(key));
    }
    return asHTML(page({ error: 'wrong_password', next }), 401);
  }

  if (url.pathname === '/__lab/logout') {
    if (request.method !== 'POST' || !sameOrigin(request)) return new Response('Forbidden', { status: 403 });
    return redirect('/__lab/login', `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
  }

  if (!loggedIn) {
    const next = safeNext(url.pathname + url.search);
    return redirect('/__lab/login?next=' + encodeURIComponent(next));
  }

  // Do not serve authenticated content from the browser's cache after logout.
  const original = await context.next();
  const response = new Response(original.body, original);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Vary', 'Cookie');
  return response;
}
