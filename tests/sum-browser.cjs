"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const target = pathToFileURL(path.resolve(__dirname, "..", "sum", "index.html")).href;
const homeTarget = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
const historyTarget = pathToFileURL(path.resolve(__dirname, "..", "history", "index.html")).href;
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
  assert.match(await page.title(), /より抜き図書館｜要約問題/);
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
  assert.equal(await page.locator(".card.sum .new-mark").innerText(), "試験運用中");
  assert.equal(await page.locator(".card.sum .new-mark").isVisible(), true);
  const badgeX = await page.locator(".card.sum .new-mark").evaluate(e => e.getBoundingClientRect().x);
  const titleX = await page.locator(".card.sum h2").evaluate(e => e.getBoundingClientRect().x);
  assert(badgeX > titleX, name + " trial badge must appear to the right of the title start");
  assert.deepEqual(titles, [
    "ブレスト道場", "持ち込み診療所", "伊都への恋文",
    "ことのは研究室", "より抜き図書館", "英検の庵",
    "待ってろ文キャン", "三田キャンへの道"
  ]);
  assert.equal(await page.locator('.card.sum p').innerText(), '船頭多くして船山に上る｜要約問題');
  assert.match(await page.locator(".lead").innerText(), /入試英語の添削ツール\s*でつ/);
  assert.equal(await page.locator(".lead-detsu").innerText(), "でつ");
  assert.equal(await page.locator(".lead-detsu").evaluate(e => getComputedStyle(e).display), "block");
  for (const selector of [".howto-title"]) {
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
  assert.equal(bounds.length, 8, "Homepage must show eight content cards");
  assert.equal(await page.locator(".card.dojo").getAttribute("href"), "./brest/");
  if (width > 830 || (width > 650 && width >= height)) {
    // Three cards on each of the first two rows, then two cards on the final row.
    for (const [first, last] of [[0, 2], [3, 5], [6, 7]]) {
      for (let i = first + 1; i <= last; i++) {
        assert.equal(bounds[i].y, bounds[first].y);
        assert(bounds[i].x > bounds[i - 1].x);
        assert.equal(bounds[i].width, bounds[first].width);
      }
    }
    assert(bounds[3].y > bounds[2].y);
    assert(bounds[6].y > bounds[5].y);
    assert(bounds[6].width > bounds[0].width);
  } else if (width > 650) {
    // Two columns in portrait tablet mode.
    for(const i of [0,2,4,6]) assert.equal(bounds[i].y,bounds[i+1].y);
    for(const i of [2,4,6]) assert(bounds[i].y>bounds[i-2].y);
  } else {
    assert(bounds.every((item, i) => i === 0 || item.y > bounds[i-1].y));
  }
  const maxWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(maxWidth <= width + 1, "Homepage overflow: " + maxWidth + " > " + width);
  assert.equal(errors.length, 0, errors.join("; "));
  await page.screenshot({ path: path.join(artifacts, "home-" + name + ".png"), fullPage: true });
  console.log("Homepage " + name + ": PASS; eight cards in correct order");
  await context.close();
}

async function checkDojo(browser, name, width, height) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  try {
    const page=await context.newPage(), errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.open=()=>null;
      Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__lastCopied=text;}}});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,"..","brest","index.html")).href);
    assert.equal(await page.locator("h1").innerText(),"ブレスト道場");
    assert(await page.locator('input[name="source"][value="own"]').isChecked());
    assert(await page.locator('input[name="level"][value="standard"]').isChecked());
    assert(await page.locator('input[name="output"][value="screen"]').isChecked());
    assert(!(await page.locator("#phrases").isChecked()));
    assert(!(await page.locator("#example").isChecked()));
    await page.locator("#ownText").fill("制服は必要ですか。");
    await page.locator("#memo-r1").fill("安全面");
    await page.locator("#preview").click();
    let p=await page.locator("#prompt").inputValue();
    assert.match(p,/ワンバウンド/);assert.match(p,/英語の解答例：希望なし/);assert.match(p,/安全面/);
    await page.locator('input[name="source"][value="original"]').check();
    assert(!(await page.locator("#ownText").isVisible()));
    assert.equal(await page.locator("#memo-r1").inputValue(),"");
    await page.locator("#difficulty").selectOption("advanced");
    assert.equal(await page.locator("#questionLevel").innerText(),"発展");
    const previous=await page.locator("#question").innerText();
    await page.locator("#memo-r1").fill("前の問題のメモ");
    await page.locator("#next").click();
    assert.notEqual(await page.locator("#question").innerText(),previous);
    assert.equal(await page.locator("#memo-r1").inputValue(),"");
    await page.locator("#kind").selectOption("personal");
    assert.equal(await page.locator("#difficulty").inputValue(),"standard");
    assert(await page.locator("#memo-a").isVisible());
    await page.locator('input[name="source"][value="own"]').check();
    await page.locator("#kind").selectOption("opinion");
    assert.equal(await page.locator("#ownText").inputValue(),"制服は必要ですか。");
    assert.equal(await page.locator("#memo-r1").inputValue(),"安全面");
    await page.locator("#add").click();assert(await page.locator("#memo-r3").isVisible());
    await page.locator('input[name="guide"][value="no"]').check();
    await page.locator("#memo-free").fill("友人と協力");
    await page.locator('input[name="level"][value="advanced"]').check();
    await page.locator("#phrases").check();await page.locator("#example").check();
    await page.locator('input[name="output"][value="both"]').check();
    await page.locator("#send").click();
    await page.waitForFunction(()=>typeof window.__lastCopied==="string");
    p=await page.evaluate(()=>window.__lastCopied);
    assert.match(p,/学習モード】発展/);assert.match(p,/おすすめフレーズ：希望あり/);
    assert.match(p,/英語の解答例：希望あり/);assert.match(p,/JIS B5/);
    assert.match(p,/Word＋PDF/);assert.match(p,/友人と協力/);
    await page.locator('input[name="timer"][value="on"]').check();
    assert.equal(await page.locator("#clock").innerText(),"03:00");
    await page.locator("#start").click();await page.locator("#pause").click();
    await page.locator("#reset").click();assert.equal(await page.locator("#clock").innerText(),"03:00");
    assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=width+1);
    assert.equal(errors.length,0,errors.join("; "));
    console.log("Brest dojo "+name+": PASS");
  }finally{await context.close();}
}

async function checkHistory(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(historyTarget, { waitUntil: "domcontentloaded" });
    assert.equal(await page.title(), "更新履歴｜柴田答案ラボ");
    assert.equal(await page.locator("h1").innerText(), "更新履歴");
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex");
    assert.equal(await page.locator("footer .footer-home-link").getAttribute("href"), "../");
    const entries = await page.locator(".updates li").evaluateAll(nodes => nodes.map(li => {
      const time = li.querySelector("time");
      const description = li.querySelector("p");
      const timeBox = time?.getBoundingClientRect();
      const descriptionBox = description?.getBoundingClientRect();
      return {
        date: time?.getAttribute("datetime") || "",
        label: time?.textContent.trim() || "",
        description: description?.textContent.trim() || "",
        links: Array.from(li.querySelectorAll("a[href]"), a => a.getAttribute("href")),
        overlaps: Boolean(timeBox && descriptionBox && descriptionBox.left < timeBox.right - 1)
      };
    }));
    assert(entries.length > 0, "History must have dated entries");
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, "History machine date");
      assert.equal(entry.label, entry.date.replace(/-/g, "."));
      assert(entry.description.length > 0, "History entry description missing");
      assert.equal(entry.overlaps, false, name + ": date and description overlap");
      if (i > 0) assert(entries[i - 1].date >= entry.date, "History is not newest first");
      for (const href of entry.links) {
        assert(href.startsWith("../"), "Unexpected history link: " + href);
        assert(fs.existsSync(path.resolve(__dirname, "..", "history", href, "index.html")), "Missing history link target: " + href);
      }
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= width + 1, name + ": history horizontal overflow: " + scrollWidth);
    assert.equal(errors.length, 0, name + ": history JS errors: " + errors.join("; "));
    await page.screenshot({ path: path.join(artifacts, "history-" + name + ".png"), fullPage: true });
    console.log("History " + name + ": PASS; entries=" + entries.length);
  } finally {
    await context.close();
  }
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
    await checkDojo(browser, "desktop", 1365, 900);
    await checkDojo(browser, "mobile", 390, 844);
    await checkDojo(browser, "small-mobile", 320, 700);
    await checkHistory(browser, "desktop", 1365, 900);
    await checkHistory(browser, "mobile", 390, 844);
    await checkHistory(browser, "small-mobile", 320, 700);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
