"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const target = pathToFileURL(path.resolve(__dirname, "..", "sum", "index.html")).href;
const homeTarget = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
const artifacts = path.resolve(__dirname, "..", "test-artifacts");
fs.mkdirSync(artifacts, { recursive: true });

async function checkPage(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.open = () => ({ opener: null });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__lastCopied = text; } }
    });
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  assert.match(await page.title(), /より抜き図書館│要約問題/);
  assert.equal(await page.locator(".seal").innerText(), "図");
  assert.equal(await page.locator('input[name="kind"][value="ja"]').isChecked(), true);
  assert.equal(await page.locator("#paraphraseBox").isVisible(), false);
  assert.equal(await page.locator("#approxBox").isVisible(), true);
  assert.equal(await page.locator("#withinBox").isVisible(), false);
  assert.equal(await page.getByText("字数・語数の指定", { exact: true }).count(), 1);
  const layout = await page.evaluate(() => ({
    innerWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  assert(layout.scrollWidth <= width + 1, name + " has horizontal overflow: " + JSON.stringify(layout));

  await page.screenshot({ path: path.join(artifacts, "sum-" + name + ".png"), fullPage: true });

  await page.locator('input[name="kind"][value="en"]').check();
  assert.equal(await page.locator("#paraphraseBox").isVisible(), true);
  assert.match(await page.locator("#answerLabel").innerText(), /英文要約/);
  await page.locator("#paraphrase").check();
  await page.locator('input[name="wordmode"][value="within"]').check();
  assert.equal(await page.locator("#withinBox").isVisible(), true);
  await page.locator("#withinWords").fill("20");
  await page.locator("#problem").fill("Mind wandering can be dangerous, but it can improve creativity.");
  await page.locator("#answer").fill("Mind wandering can be helpful.");
  await page.locator("#go").click();
  const prompt = await page.locator("#manual").inputValue();
  assert(prompt.includes("20words以内"), "within 20 words missing from generated prompt");
  assert(prompt.includes("今回の指定上限は20 words以下のため"));
  assert(prompt.includes("文全体の完全引用はMの50％減点"));
  await page.locator('input[name="kind"][value="ja"]').check();
  assert.equal(await page.locator("#paraphraseBox").isVisible(), false);
  assert.equal(await page.locator("#paraphrase").isChecked(), false);
  assert.match(await page.locator("#answerLabel").innerText(), /日本文要約/);
  assert.equal(errors.length, 0, "JS page errors: " + errors.join("; "));
  console.log(name + ": PASS; width=" + width + "; screenshot=sum-" + name + ".png");
  await context.close();
}

async function checkHome(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(homeTarget, { waitUntil: "domcontentloaded" });
  const titles = await page.locator(".grid .card h2").evaluateAll(nodes => nodes.map(node => node.firstChild?.textContent?.trim() || ""));
  assert.equal(await page.locator(".card.sum .new-mark").innerText(), "new!");
  assert.equal(await page.locator(".card.sum .new-mark").isVisible(), true);
  assert.deepEqual(titles, [
    "持ち込み診療所", "ことのは研究室", "より抜き図書館",
    "伊都への恋文", "待ってろ文キャン", "三田キャンへの道"
  ]);
  assert.equal(await page.locator('.card.sum p').innerText(), "日本文＆英文│要約問題");
  assert.match(await page.locator(".lead").innerText(), /入試英語の添削ツール でつ/);
  for (const selector of [".lead", ".howto-heading h2"]) {
    const lineCount = await page.locator(selector).evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(Array.from(range.getClientRects()).map(rect => Math.round(rect.top))).size;
    });
    assert.equal(lineCount, 1, name + " unwanted wrapping in " + selector);
  }
  const bounds = await page.locator(".grid .card").evaluateAll(nodes => nodes.map(n => {
    const b = n.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width) };
  }));
  if (width > 650) {
    assert.equal(bounds[0].y, bounds[1].y);
    assert.equal(bounds[1].y, bounds[2].y);
    assert.equal(bounds[3].y, bounds[4].y);
    assert.equal(bounds[4].y, bounds[5].y);
    assert(bounds[0].x < bounds[1].x && bounds[1].x < bounds[2].x);
    assert(bounds[3].y > bounds[0].y);
  } else {
    assert(bounds.every((item, i) => i === 0 || item.y > bounds[i-1].y));
  }
  const maxWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(maxWidth <= width + 1, "Homepage overflow: " + maxWidth + " > " + width);
  assert.equal(errors.length, 0, errors.join("; "));
  await page.screenshot({ path: path.join(artifacts, "home-" + name + ".png"), fullPage: true });
  console.log("Homepage " + name + ": PASS; six cards in correct order");
  await context.close();
}

async function checkAuditHowto(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator(".masthead").evaluate(e => getComputedStyle(e).position), "sticky");
    await page.locator(".tool-howto summary").click();
    assert.equal(await page.locator(".tool-howto").evaluate(e => e.open), true);
    assert.equal(await page.locator(".masthead").evaluate(e => getComputedStyle(e).position), "static");
    await page.locator("#problem").click({ timeout: 4500, trial: true });
    await page.locator("#answer").click({ timeout: 4500, trial: true });
    await page.locator(".tool-howto summary").click();
    assert.equal(await page.locator(".masthead").evaluate(e => getComputedStyle(e).position), "sticky");
    console.log("Howto " + width + "x" + height + ": PASS; inputs clickable");
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await checkPage(browser, "desktop", 1365, 900);
    await checkPage(browser, "mobile", 390, 844);
    await checkPage(browser, "small-mobile", 320, 700);
    await checkAuditHowto(browser, 561, 701);
    await checkAuditHowto(browser, 600, 800);
    await checkHome(browser, "desktop", 1365, 900);
    await checkHome(browser, "mobile", 390, 844);
    await checkHome(browser, "small-mobile", 320, 700);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
