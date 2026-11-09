"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const target = pathToFileURL(path.resolve(__dirname, "..", "sum", "index.html")).href;
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
  assert.match(await page.title(), /選り抜きの庵｜日本文＆英文│要約対策/);
  assert.equal(await page.locator('input[name="kind"][value="ja"]').isChecked(), true);
  assert.equal(await page.locator("#paraphraseBox").isVisible(), false);
  assert.equal(await page.locator("#approxBox").isVisible(), true);
  assert.equal(await page.locator("#withinBox").isVisible(), false);
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

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await checkPage(browser, "desktop", 1365, 900);
    await checkPage(browser, "mobile", 390, 844);
    await checkPage(browser, "small-mobile", 320, 700);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
