const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { webkit, devices } = require("playwright");

const url = pathToFileURL(path.resolve(__dirname, "..", "history", "index.html")).href;
const portrait = { width: 393, height: 852 };
const landscape = { width: 852, height: 393 };
async function inspect(page, viewport, name) {
  await page.evaluate
/* Check every public page, including mobile landscape entry and reload.
   Width-dependent heading/timer sizes remain intentional; compare the
   same orientation across loads, and the body font across orientations. */
async function inspectPublicPage(page, viewport, name) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const layout = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const adjust = rootStyle.getPropertyValue("text-size-adjust").trim() || rootStyle.getPropertyValue("-webkit-text-size-adjust").trim();
    const fonts = [...document.querySelectorAll("h1,h2,legend,label,p,summary")].filter(el => el.getClientRects().length && el.textContent.trim()).map(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node, height = null;
      while ((node = walker.nextNode())) {
        const i = node.textContent.search(/\S/);
        if (i < 0) continue;
        const range = document.createRange();
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.height) { height = Math.round(rect.height * 100) / 100; break; }
      }
      return [el.tagName, getComputedStyle(el).fontSize, height];
    });
    return { adjust, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyFont: getComputedStyle(document.body).fontSize, fonts };
  });
  if (layout.adjust) assert.equal(layout.adjust, "100%", name + ": text-size-adjust");
  assert.equal(layout.width, viewport.width, name + ": viewport width");
  assert(layout.scrollWidth <= viewport.width + 1, name + ": horizontal overflow");
  assert(layout.fonts.length > 0, name + ": no visible text");
  return layout;
}
async function checkPublicPages(browser) {
  const files = ["index.html", "history/index.html", "ito/index.html", "buncan/index.html", "mita/index.html", "misc/index.html", "trans/index.html", "sum/index.html", "eiken/index.html", "brain/index.html"];
  const fs = require("node:fs");
  const failures = [];
  for (const file of files) {
    const absolute = path.resolve(__dirname, "..", file);
    const context = await browser.newContext({ ...devices["iPhone 14"], viewport: portrait });
    try {
      const source = fs.readFileSync(absolute, "utf8");
      assert.match(source, /:root\s*\{[^}]*-webkit-text-size-adjust\s*:\s*100%\s*;[^}]*\btext-size-adjust\s*:\s*100%\s*;/, file + ": missing root CSS");
      await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
      const page = await context.newPage();
      const target = pathToFileURL(absolute).href;
      await page.goto(target);
      const initial = await inspectPublicPage(page, portrait, file + " portrait");
      await page.setViewportSize(landscape);
      const rotated = await inspectPublicPage(page, landscape, file + " rotated");
      assert.equal(rotated.bodyFont, initial.bodyFont, file + ": body font across rotation");
      await page.reload();
      const reloaded = await inspectPublicPage(page, landscape, file + " reload");
      assert.deepEqual(reloaded.fonts, rotated.fonts, file + ": landscape text differs on reload");
      const fresh = await context.newPage();
      await fresh.setViewportSize(landscape);
      await fresh.goto(target);
      assert.deepEqual((await inspectPublicPage(fresh, landscape, file + " fresh landscape")).fonts, reloaded.fonts, file + ": fresh landscape text differs");
      await fresh.close();
      await page.setViewportSize(portrait);
      assert.deepEqual((await inspectPublicPage(page, portrait, file + " returned portrait")).fonts, initial.fonts, file + ": portrait text differs after round trip");
      console.log(file + ": mobile WebKit PASS");
    } catch (error) {
      failures.push(file + ": " + (error.stack || String(error)));
    } finally { await context.close(); }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
}

(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const layout = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const rows = [...document.querySelectorAll(".updates li")].map(li => {
      const date = li.querySelector("time"), desc = li.querySelector("p");
      const range = document.createRange(); range.selectNodeContents(date);
      const d = range.getBoundingClientRect(), p = desc.getBoundingClientRect();
      return { date: box(date), desc: box(desc), dateRight: d.right, descLeft: p.left,
        fontDate: getComputedStyle(date).fontSize, fontDesc: getComputedStyle(desc).fontSize };
    });
    const rootStyle = getComputedStyle(document.documentElement);
    const adjust = rootStyle.getPropertyValue("text-size-adjust").trim() || rootStyle.getPropertyValue("-webkit-text-size-adjust").trim();
    return { adjust,
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: box(document.querySelector(".panel")), rows };
  });
  if (layout.adjust === "") {
    console.warn(name + ": text-size-adjust unavailable via CSSOM; continuing with rendered layout checks");
  } else {
    assert.equal(layout.adjust, "100%", name + ": automatic text enlargement");
  }
  assert.equal(layout.viewport, viewport.width, name + ": viewport width");
  assert(layout.scrollWidth <= viewport.width + 1, name + ": horizontal overflow");
  assert(layout.panel[0] >= -1 && layout.panel[0] + layout.panel[2] <= viewport.width + 1, name + ": panel overflow");
  assert(layout.rows.length > 0, name + ": no history entries");
  for (const row of layout.rows) assert(row.dateRight <= row.descLeft + 1, name + ": rendered date text overlaps description");
  return layout;
}
function compare(a, b, name) {
  assert.equal(a.rows.length, b.rows.length, name + ": row count");
  const geometry = x => [x.panel, ...x.rows.flatMap(r => [r.date, r.desc])].flat();
  geometry(a).forEach((v, i) => assert(Math.abs(v - geometry(b)[i]) <= 1, name + ": geometry differs at " + i));
  assert.deepEqual(a.rows.map(r => [r.fontDate, r.fontDesc]), b.rows.map(r => [r.fontDate, r.fontDesc]), name + ": font size changed");
}
(async () => {
  const browser = await webkit.launch();
  try {
    await checkPublicPages(browser);
    const context = await browser.newContext({ ...devices["iPhone 14"], viewport: portrait });
    await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
    const page = await context.newPage();
    await page.goto(url);
    const initial = await inspect(page, portrait, "portrait");
    await page.setViewportSize(landscape);
    const rotated = await inspect(page, landscape, "rotated landscape");
    await page.reload();
    const reloaded = await inspect(page, landscape, "landscape reload");
    compare(rotated, reloaded, "landscape rotation vs reload");
    const fresh = await context.newPage();
    await fresh.setViewportSize(landscape);
    await fresh.goto(url);
    compare(reloaded, await inspect(fresh, landscape, "fresh landscape"), "landscape reload vs fresh");
    await fresh.close();
    await page.setViewportSize(portrait);
    compare(initial, await inspect(page, portrait, "returned portrait"), "portrait round trip");
    console.log("History mobile WebKit: PASS (portrait, rotate, landscape reload, fresh landscape, return)");
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
