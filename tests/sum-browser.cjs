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
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width <= 560 });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(homeTarget, { waitUntil: "domcontentloaded" });
  const titles = await page.locator(".grid .card h2").evaluateAll(nodes => nodes.map(node => node.firstChild?.textContent?.trim() || ""));
  assert.equal(await page.locator(".card.ito .new-mark").count(), 0);
  assert.equal(await page.locator(".card.sum .new-mark").count(), 0);
  for (const [card, label] of [["dojo", "new"], ["eiken", "試験運用中"]]) {
    const badge = page.locator(".card." + card + " .new-mark");
    assert.equal(await badge.innerText(), label);
    assert.equal(await badge.isVisible(), true);
    const badgeX = await badge.evaluate(e => e.getBoundingClientRect().x);
    const titleX = await page.locator(".card." + card + " h2").evaluate(e => e.getBoundingClientRect().x);
    assert(badgeX > titleX, name + " " + card + " badge must appear to the right of the title start");
  }
  assert.deepEqual(titles, [
    "ブレスト道場", "持ち込み診療所", "伊都への恋文",
    "ことのは研究室", "より抜き図書館", "英検の庵",
    "待ってろ文キャン", "三田キャンへの道"
  ]);
  assert.equal(await page.locator('.card.sum p').innerText(), '船頭多くして船山に上る｜要約問題');
  assert.match(await page.locator(".lead").innerText(), /入試英語の支援ツール\s*でつ/);
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
  assert.equal(await page.locator(".card.dojo").getAttribute("href"), "./brain/");
  assert.equal(await page.locator(".card.dojo p").innerText(), "初めの一歩｜自由英作文");
  assert.equal(await page.locator(".card.eiken p").innerText(), "準1～準2p｜ライティング");
  if(name==="mobile"){
    await page.setViewportSize({width:852,height:393});
    assert.equal(await page.locator(".card.eiken p").innerText(), "準1~準2p｜ライティング");
    await page.setViewportSize({width,height});
    assert.equal(await page.locator(".card.eiken p").innerText(), "準1～準2p｜ライティング");
  }
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
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:width<=560||name==="tablet"});
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  try {
    const page=await context.newPage(), errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.open=()=>({opener:null});
      Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{if(window.__failCopy)throw Error("test clipboard failure");window.__lastCopied=text;}}});
      const execCommand=document.execCommand.bind(document);document.execCommand=(...args)=>window.__failCopy&&args[0]==="copy"?false:execCommand(...args);
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,"..","brain","index.html")).href);
    assert.equal(await page.locator("h1").innerText(),"ブレスト道場｜自由英作文入門");
    assert.deepEqual(await page.locator(".masthead-inner").evaluate(el => [...el.children].slice(0,5).map(child => child.textContent.trim())), ["道", "Baby steps to giant strides. ― 千里の道も一歩から", "ブレスト道場｜自由英作文入門", "", "日本語で構想メモを作る練習を行います。"]);
    assert.equal(await page.locator(".lede strong").innerText(),"日本語");
    assert.equal(await page.locator(".lede strong").evaluate(e=>getComputedStyle(e).color),"rgb(198, 40, 40)");
    assert.equal(await page.locator(".lede strong").evaluate(e=>getComputedStyle(e).fontWeight),"700");
    assert.equal(await page.locator(".tricolor span").count(), 3);
    assert.match(await page.locator("body").evaluate(e => getComputedStyle(e).fontFamily), /Zen Kaku Gothic New/);
    assert.match(await page.locator("h1").evaluate(e => getComputedStyle(e).fontFamily), /Shippori Mincho/);
    assert.equal(await page.locator(".sheet-wrap > .panel").count(), 4);
    assert.equal(await page.locator("#go").innerText(),"ChatGPTを開く");
    assert.equal(await page.getByText("指示文を表示",{exact:true}).count(),0);
    assert.equal(await page.locator("#manualBox").isVisible(),false);
    const capturePrompt=async()=>{await page.evaluate(()=>{delete window.__lastCopied;});await page.locator("#go").click();await page.waitForFunction(()=>typeof window.__lastCopied==="string");return page.evaluate(()=>window.__lastCopied);};
    assert.equal(await page.locator(".login-guide > .tool-howto").count(), 1);
    assert.equal(await page.locator(".login-guide + .control-dock > .timer-setup").count(), 1);
    assert.equal(await page.locator(".control-dock .tool-howto").count(), 0);
    assert.equal(await page.locator(".login-guide").evaluate(e=>getComputedStyle(e).position),"static");
    assert.equal(await page.locator(".control-dock").evaluate(e => getComputedStyle(e).position), "sticky");
    assert.equal(await page.locator(".tool-howto summary").innerText(), "事前にChatGPTへログインしてから使ってください（詳しい使い方はこちら）");
    assert.equal(await page.locator(".tool-howto").evaluate(e => e.open), false);
    await page.locator(".tool-howto summary").click();
    assert.equal(await page.locator(".tool-howto").evaluate(e => e.open), true);
    assert.equal(await page.locator(".control-dock").evaluate(e => getComputedStyle(e).position), "sticky");
    await page.locator("#ownText").click({trial:true});
    await page.locator(".tool-howto summary").click();
    assert.equal(await page.locator(".tool-howto").evaluate(e => e.open), false);
    assert.equal(await page.locator(".masthead").evaluate(e => getComputedStyle(e).position), "static");
    assert.deepEqual(await page.locator('input[name="timer"]').evaluateAll(es=>es.map(e=>e.value)), ["off","on"]);
    assert(await page.locator('input[name="timer"][value="off"]').isChecked());
    assert.equal(await page.locator("#timerPanel").isVisible(),false);
    assert.equal(await page.locator("#minutes").inputValue(),"5");
    assert.equal(await page.locator("#floatingTimer").isVisible(),false);
    assert(await page.locator(".timer-guidance summary").isVisible());
    const disclosureMarkers=await page.evaluate(()=>{
      return [".tool-howto summary",".timer-guidance summary"].map(selector=>{
        const e=document.querySelector(selector),marker=getComputedStyle(e,"::before");
        return {x:e.getBoundingClientRect().left+parseFloat(marker.left),position:marker.position,width:marker.borderLeftWidth};
      });
    });
    assert(disclosureMarkers.every(m=>m.position==="absolute"&&m.width==="7px"),name+": disclosure markers must use the same positioning");
    assert(Math.abs(disclosureMarkers[0].x-disclosureMarkers[1].x)<.75,name+": disclosure markers must align: "+JSON.stringify(disclosureMarkers));
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    await page.locator(".timer-guidance summary").click();
    assert(await page.locator(".timer-guidance .note").isVisible());
    await page.locator('input[name="timer"][value="on"]').check();
    assert(await page.locator("#timerPanel").isVisible());
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),true);
    await page.locator('input[name="timer"][value="off"]').check();
    assert.equal(await page.locator("#timerPanel").isVisible(),false);
    assert(await page.locator(".timer-guidance .note").isVisible());
    await page.locator(".timer-guidance summary").click();
    await page.locator('input[name="timer"][value="on"]').check();
    assert(await page.locator("#timerPanel").isVisible());
    assert.equal(await page.locator("#clock").innerText(),"05:00");
    assert.equal(await page.locator("#start svg path").getAttribute("d"),"M4 1.5 L14 8 L4 14.5 Z");
    assert(await page.locator("#start svg").isVisible());
    assert.equal(await page.locator("#pause").innerText(),"Ⅱ");
    assert.equal(await page.locator("#reset").innerText(),width<=560&&height>=width?"ﾘｾｯﾄ":"リセット");
    if(name==="iphone15pro-portrait"){
      await page.setViewportSize({width:height,height:width});
      assert.equal(await page.locator("#reset").innerText(),"リセット");
      assert.equal(await page.locator("#clock").innerText(),"05:00");
      assert.equal(await page.locator("#clock").evaluate(e=>getComputedStyle(e).marginLeft),"-4px");
      assert.equal(await page.locator(".timer-group:first-child").evaluate(e=>getComputedStyle(e).marginRight),"-4px");
      const landscapeGaps=await page.evaluate(()=>{
        remaining=-5;draw();
        const unit=document.querySelector(".timer-unit").getBoundingClientRect(),clock=document.getElementById("clock").getBoundingClientRect(),start=document.getElementById("start").getBoundingClientRect();
        const result={display:document.getElementById("clock").textContent,left:clock.left-unit.right,right:start.left-clock.right};
        reset();return result;
      });
      assert.equal(landscapeGaps.display,"+00:05");
      assert(landscapeGaps.left>0&&Math.abs(landscapeGaps.left-landscapeGaps.right)<.75,name+": equal landscape overtime gaps");
      await page.setViewportSize({width,height});
      assert.equal(await page.locator("#reset").innerText(),"ﾘｾｯﾄ");
    }
    const dockWidths=await page.locator(".control-dock").evaluate(el=>{
      const dock=el.getBoundingClientRect(),guide=document.querySelector(".login-guide > .tool-howto").getBoundingClientRect(),timer=el.querySelector(".timer-setup").getBoundingClientRect();
      return {aligned:Math.abs(guide.left-timer.left)<1&&Math.abs(guide.right-timer.right)<1,left:guide.left-dock.left,right:dock.right-guide.right};
    });
    assert(dockWidths.aligned,name+": login guide and timer must align");
    if(width<=560)assert(Math.abs(dockWidths.left-26)<1&&Math.abs(dockWidths.right-26)<1,name+": mobile guide margins must be 26px: "+JSON.stringify(dockWidths));
    const timerLayout=await page.locator(".timer-controls").evaluate(el=>{
      const container=el.getBoundingClientRect(),rects=["#minutes",".timer-unit","#clock","#start","#pause","#reset"].map(id=>el.querySelector(id).getBoundingClientRect());
      const centers=rects.map(r=>r.top+r.height/2);
      const sameLine=rs=>Math.max(...rs)-Math.min(...rs)<3;
      return {sameLine:sameLine(centers),groupsAligned:sameLine(centers.slice(0,3))&&sameLine(centers.slice(3)),contained:rects.every(r=>r.left>=container.left-1&&r.right<=container.right+1),gaps:rects.slice(1).flatMap((r,i)=>Math.abs(centers[i+1]-centers[i])<3?[{index:i,gap:r.left-rects[i].right}]:[])};
    });
    assert(timerLayout.groupsAligned&&timerLayout.contained&&(width<390||timerLayout.sameLine),name+": timer controls must fit with each group on one line: "+JSON.stringify(timerLayout));
    const expectedGap=width<=360?5:width<=560?6:12;
    const gapAdjustment=index=>index===1||index===2?(width<=560?1.5:name==="tablet"?-4:-2.5):0;
    assert(timerLayout.gaps.every(({index,gap})=>Math.abs(gap-expectedGap-gapAdjustment(index))<0.75),name+": timer control gaps must match spacing before and after clock: "+JSON.stringify(timerLayout));
    if(width<=1024){
      for(const selector of ["#start","#pause","#reset"]){
        const box=await page.locator(selector).boundingBox();
        assert(box&&box.width>=44&&box.height>=44,name+": touch target too small "+selector);
      }
    }
    // The plus sign and changing overtime digits must not change the control layout.
    const overtimeLayout=await page.evaluate(()=>{
      const sizes=()=>[".timer-controls","#clock","#start","#pause","#reset","#floatingClock"].map(selector=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return [r.left,r.top,r.width,r.height];
      });
      const initial=sizes();
      const frames=[];
      for(const seconds of [0,-1,-8,-11,-22,-27,-32,-58,-61,-88]){
        remaining=seconds;draw();
        frames.push(sizes());
      }
      reset();
      return {initial,frames};
    });
    for(const frame of overtimeLayout.frames)assert.deepEqual(frame,overtimeLayout.initial,name+": overtime must not reflow timer controls");
    if(timerLayout.sameLine){
      const gaps=await page.evaluate(()=>{
        remaining=-5;draw();
        const unit=document.querySelector(".timer-unit").getBoundingClientRect(),clock=document.getElementById("clock").getBoundingClientRect(),start=document.getElementById("start").getBoundingClientRect();
        const result={display:document.getElementById("clock").textContent,left:clock.left-unit.right,right:start.left-clock.right};
        reset();return result;
      });
      assert.equal(gaps.display,"+00:05");
      assert(gaps.left>0&&Math.abs(gaps.left-gaps.right)<.75,name+": equal overtime gaps");
    }
    assert.equal(await page.locator("#start").getAttribute("aria-label"),"開始");
    assert.equal(await page.locator("#pause").getAttribute("aria-label"),"一時停止");
    assert.equal(await page.locator("#start").isEnabled(),true);
    assert.equal(await page.locator("#pause").isEnabled(),false);
    await page.screenshot({ path: path.join(artifacts, "dojo-" + name + ".png"), fullPage: true });
    assert.equal(await page.title(), "ブレスト道場｜自由英作文入門");
    assert.equal(await page.locator("header").getByText("Baby steps to giant strides. ― 千里の道も一歩から", { exact: true }).count(), 1);
    assert(await page.locator('input[name="source"][value="own"]').isChecked());
    assert.equal(await page.locator("#kind").isVisible(), false);
    assert.equal(await page.locator('label[for="kind"]').isVisible(), false);
    assert(await page.locator("#ownKind").isVisible());
    assert.equal(await page.locator("#ownKind").inputValue(), "opinion");
    assert.deepEqual(await page.locator("#ownKind option").evaluateAll(es=>es.map(e=>e.value)),["opinion","advice","personal","own"]);
    assert.equal(await page.locator('#ownKind option[value="personal"]').textContent(),"自分自身についての記述");
    assert.equal(await page.locator('#kind option[value="personal"]').textContent(),"自分自身についての記述");
    assert.equal(await page.locator("#ownPersonalHint").isVisible(),false);
    assert.equal(await page.locator("#originalPersonalHint").isVisible(),false);
    assert(await page.locator("#ownKind").evaluate(e => Boolean(e.compareDocumentPosition(document.getElementById("ownText")) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.equal(await page.locator("#difficulty").isVisible(), false);
    assert(await page.locator('input[name="guide"][value="no"]').isChecked());
    assert.equal(await page.locator("#brainstormStart").innerText(),"誘導の有無を選んだら、ひとりブレインストーミング開始です！\n慣れてきたら、ここでタイマーをonにしてみましょう🕒");
    assert(await page.locator("#memo-free").isVisible());
    assert.equal(await page.locator("#fields textarea").count(), 1);
    assert.equal(await page.locator("#memo-r1").count(), 0);
    assert.equal(await page.locator("#memo-stance").count(), 0);
    assert.equal(await page.locator("#add").isVisible(), false);
    assert.equal(await page.locator("#addConclusion").isVisible(),false);
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    await page.locator('input[name="guide"][value="yes"]').check();
    assert(await page.locator("#memo-stance").isVisible());
    assert.equal(await page.locator('label[for="memo-r1"]').innerText(),"理由１");
    await page.locator("#ownText").fill("制服は必要ですか。");
    await page.locator("#memo-r1").fill("意見の表明の初期選択");
    assert.match(await capturePrompt(), /"問題の種類": "意見の表明"/);
    await page.locator("#memo-r1").fill("");
    await page.locator("#ownKind").selectOption("own");
    assert(await page.locator("#memo-direction").isVisible());
    assert(await page.locator("#addConclusion").isVisible());
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    assert.equal(await page.locator("#remove-item-1").count(),0);
    assert.equal(await page.locator("#addConclusion").innerText(),"＋ 結論を追加する");
    assert.equal(await page.locator('label[for="memo-direction"]').innerText(),"全体の方向性（自由記述／空欄も可）");
    assert.equal(await page.locator("#fields textarea").first().getAttribute("id"),"memo-direction");
    assert.equal(await page.locator("#memo-direction").inputValue(),"");
    assert(await page.locator("#memo-r1").isVisible());
    assert(await page.locator("#memo-s1").isVisible());
    assert.equal(await page.locator("#memo-r2").count(), 0);
    assert.equal(await page.locator("#memo-s2").count(), 0);
    assert.equal(await page.locator('label[for="memo-r1"]').innerText(), "１つ目の項目");
    assert(await page.locator('input[name="level"][value="basic"]').isChecked());
    assert.deepEqual(await page.locator('input[name="level"]').evaluateAll(es=>es.map(e=>[e.value,e.parentElement.textContent.trim()])),[["basic","基礎"],["advanced","発展"]]);
    assert.deepEqual(await page.locator("#difficulty option").evaluateAll(es=>es.map(e=>[e.value,e.textContent.trim()])),[["basic","基礎"],["advanced","発展"]]);
    assert(await page.locator('input[name="output"][value="screen"]').isChecked());
    assert.equal(await page.locator(".output-format-picker label").allTextContents().then(xs=>xs.map(x=>x.trim())).then(xs=>xs.join("|")),"画面表示のみ（標準）※最速です|Word|PDF|Word＋PDF");
    assert.equal(await page.locator(".output-format-picker .note").innerText(),"Word・PDFはJIS B5（182×257 mm）・縦向き。");
    assert.equal(await page.getByText("アドバイスのみ（標準）※最速です",{exact:true}).count(),0);
    assert.equal(await page.getByText("※ 不要であれば✓を外してください。",{exact:true}).count(),1);
    assert.equal(await page.locator("#phrases").evaluate(e=>e.parentElement.textContent.trim()),"テーマに即したおすすめフレーズも入手する");
    assert.equal(await page.locator("#example").evaluate(e=>e.parentElement.textContent.trim()),"英語の解答例も入手する");
    assert(await page.locator("#example").evaluate(e=>e.parentElement.nextElementSibling.textContent==="※ 不要であれば✓を外してください。"));
    assert.equal(await page.getByText("※英文の解答例の作成には時間がかかる場合があります。",{exact:true}).count(),0);
    assert(await page.locator("#phrases").isChecked());
    assert(await page.locator("#example").isChecked());
    await page.locator("#ownText").fill("制服は必要ですか。");
    await page.locator("#memo-r1").fill("安全面");
    let p=await capturePrompt();
    assert.match(p,/おすすめフレーズ：希望あり/);
    assert.match(p,/英語の解答例：希望あり/);
    await page.locator("#example").uncheck();
    p=await capturePrompt();
    assert.match(p,/おすすめフレーズ：希望あり/);
    assert.match(p,/英語の解答例：希望なし/);
    await page.locator("#phrases").uncheck();
    await page.locator("#example").check();
    p=await capturePrompt();
    assert.match(p,/おすすめフレーズ：希望なし/);
    assert.match(p,/英語の解答例：希望あり/);
    await page.locator("#example").uncheck();
    p=await capturePrompt();
    assert.match(p,/おすすめフレーズ：希望なし/);
    await page.waitForFunction(()=>document.getElementById("feedback").textContent.includes("コピーしました"));
    assert.equal(await page.locator("#manualBox").isVisible(),false);
    assert.match(p,/ワンバウンド/);assert.match(p,/構想メモ中の英単語・英語表現も必ず確認/);assert.match(p,/英語表現へのアドバイス/);assert.match(p,/英語の解答例：希望なし/);assert.match(p,/安全面/);assert.match(p,/"問題の種類": "持ち込み・指定なし（問題文の指示を優先）"/);
    await page.locator("#memo-direction").fill("制服の利点を中心に考える");
    assert.match(await capturePrompt(),/制服の利点を中心に考える/);
    await page.locator("#addConclusion").click();
    assert(await page.locator("#memo-conclusion").isVisible());
    assert.equal(await page.locator("#addConclusion").isVisible(),false);
    await page.locator("#memo-conclusion").fill("学校生活に適した服装を考える");
    assert.match(await capturePrompt(),/学校生活に適した服装を考える/);
    await page.locator("#ownKind").selectOption("opinion");
    assert(await page.locator("#addConclusion").isVisible());
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    assert.equal(await page.locator("#memo-direction").count(),0);
    assert(await page.locator("#memo-stance").isVisible());
    assert.equal(await page.locator('label[for="memo-r1"]').innerText(), "理由１");
    await page.locator("#memo-r1").fill("学習環境");
    assert.match(await capturePrompt(), /"問題の種類": "意見の表明"/);
    await page.locator("#ownKind").selectOption("personal");
    assert(await page.locator("#ownPersonalHint").isVisible());
    assert.equal(await page.locator("#ownPersonalHint").innerText(),"過去の体験や将来の目標など");
    assert.equal(await page.locator("#originalPersonalHint").isVisible(),false);
    assert(await page.locator("#addConclusion").isVisible());
    assert.equal(await page.locator("#add").isVisible(),false);
    assert.equal(await page.locator("#memo-direction").count(),0);
    assert(await page.locator("#memo-a").isVisible());
    await page.locator("#ownKind").selectOption("advice");
    assert.equal(await page.locator("#ownPersonalHint").isVisible(),false);
    assert(await page.locator("#addConclusion").isVisible());
    assert(await page.locator("#memo-direction").isVisible());
    assert.equal(await page.locator("#memo-direction").inputValue(),"");
    assert.equal(await page.locator("#fields textarea").first().getAttribute("id"),"memo-direction");
    assert.equal(await page.locator('label[for="memo-r1"]').innerText(), "１つ目の項目");
    await page.locator("#ownKind").selectOption("opinion");
    assert.equal(await page.locator("#memo-r1").inputValue(), "学習環境");
    await page.locator("#ownKind").selectOption("own");
    assert.equal(await page.locator("#memo-direction").inputValue(),"制服の利点を中心に考える");
    assert.equal(await page.locator("#memo-r1").inputValue(), "安全面");
    assert.equal(await page.locator("#memo-conclusion").inputValue(),"学校生活に適した服装を考える");
    await page.locator('input[name="source"][value="original"]').check();
    assert(await page.locator("#addConclusion").isVisible());
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    assert(!(await page.locator("#ownKind").isVisible()));
    assert(!(await page.locator("#ownText").isVisible()));
    assert(await page.locator("#kind").isVisible());
    assert(await page.locator("#difficulty").isVisible());
    assert.equal(await page.locator("#advancedQuestionAdviceHint").isVisible(),false);
    assert(await page.locator("#basicQuestionAdviceHint").isVisible());
    assert.equal(await page.locator("#basicQuestionAdviceHint").innerText(),"「発展」では、より多角的な視点から構想を深める助言を受けられます。");
    assert(await page.locator('input[name="level"][value="basic"]').isChecked());
    assert.equal(await page.locator("#memo-direction").count(),0);
    assert.equal(await page.locator("#memo-r1").inputValue(),"");
    assert.equal(await page.locator("#question").isVisible(),false);
    assert.equal(await page.locator("#question").textContent(),"");
    assert.equal(await page.locator("#next").innerText(),"問題を見る");
    await page.locator("#difficulty").selectOption("advanced");
    assert(await page.locator("#advancedQuestionAdviceHint").isVisible());
    assert.equal(await page.locator("#basicQuestionAdviceHint").isVisible(),false);
    assert.equal((await page.locator("#advancedQuestionAdviceHint").innerText()).trim(),"基礎的な改善点のみシンプルに知りたい場合は「基礎」を選択してください。");
    assert(await page.locator('input[name="level"][value="advanced"]').isChecked());
    await page.locator('input[name="level"][value="basic"]').check();
    assert.equal(await page.locator("#question").isVisible(),false);
    await page.locator("#go").click();
    assert.match(await page.locator("#feedback").innerText(),/問題を見る/);
    await page.locator('input[name="timer"][value="on"]').check();
    const beforeReveal=await page.locator("#clock").innerText();
    await page.locator("#next").click();
    assert(await page.locator("#question").isVisible());
    assert.match(await page.locator("#question").innerText(),/^（発展レベル）.+/);
    assert.equal(await page.locator("#next").innerText(),"問題を変更する");
    assert(await page.locator('input[name="level"][value="basic"]').isChecked());
    assert.equal(await page.locator("#clock").innerText(),beforeReveal);
    assert(await page.locator("#start").isEnabled());
    assert(!(await page.locator("#pause").isEnabled()));
    const previous=await page.locator("#question").innerText();
    await page.locator("#memo-r1").fill("前の問題のメモ");
    const originalPrompt=await capturePrompt();
    assert.match(originalPrompt,/【学習モード】基礎/);
    assert.match(originalPrompt,/【答案構成上の重要な指導方針：冒頭の意見表明】/);
    assert.match(originalPrompt,/命題の内容を明示する意見表明のいずれも認めます/);
    assert.match(originalPrompt,/一方の形式を一律に要求しないでください/);
    assert.match(originalPrompt,/80語程度など指定語数が限られる問題/);
    assert.match(originalPrompt,/【答案構成上の重要な指導方針：譲歩パターン】/);
    assert.match(originalPrompt,/基礎では、平易なテーマで生徒が理解し自力で活用しやすい場合には、簡潔な譲歩パターンを提案してください/);
    assert.match(originalPrompt,/譲歩を機械的に要求したり、譲歩がないこと自体を欠点としたりしないでください/);
    assert.match(originalPrompt,/"問題の難易度": "発展"/);
    await page.locator("#next").click();
    assert.notEqual(await page.locator("#question").innerText(),previous);
    assert.match(await page.locator("#question").innerText(),/^（発展レベル）.+/);
    assert.equal(await page.locator("#clock").innerText(),beforeReveal);
    await page.locator('input[name="timer"][value="off"]').check();
    assert.equal(await page.locator("#memo-r1").inputValue(),"");
    await page.locator("#kind").selectOption("personal");
    assert(await page.locator("#originalPersonalHint").isVisible());
    assert.equal(await page.locator("#originalPersonalHint").innerText(),"過去の体験や将来の目標など");
    assert.equal(await page.locator("#ownPersonalHint").isVisible(),false);
    await page.locator("#kind").selectOption("opinion");
    assert.equal(await page.locator("#originalPersonalHint").isVisible(),false);
    await page.locator("#kind").selectOption("personal");
    assert.equal(await page.locator("#difficulty").inputValue(),"basic");
    assert.equal(await page.locator("#advancedQuestionAdviceHint").isVisible(),false);
    assert(await page.locator("#basicQuestionAdviceHint").isVisible());
    assert.equal(await page.locator("#basicQuestionAdviceHint").innerText(),"「発展」では、より多角的な視点から構想を深める助言を受けられます。");
    assert(await page.locator('input[name="level"][value="basic"]').isChecked());
    assert.equal(await page.locator("#question").isVisible(),false);
    assert.equal(await page.locator("#next").innerText(),"問題を見る");
    await page.locator("#next").click();
    assert.match(await page.locator("#question").innerText(),/^（基礎レベル）.+/);
    assert(await page.locator("#memo-a").isVisible());
    await page.locator('input[name="source"][value="own"]').check();
    assert.equal(await page.locator("#kind").isVisible(), false);
    assert.equal(await page.locator("#memo-stance").count(), 0);
    assert(await page.locator("#ownKind").isVisible());
    assert.equal(await page.locator("#ownKind").inputValue(), "own");
    assert.equal(await page.locator("#ownText").inputValue(),"制服は必要ですか。");
    assert.equal(await page.locator("#memo-r1").inputValue(),"安全面");
    assert.equal(await page.locator("#memo-r2").count(), 0);
    await page.locator("#add").click();
    assert(await page.locator("#memo-r2").isVisible());
    assert(await page.locator("#memo-s2").isVisible());
    assert.equal(await page.locator("#memo-r3").count(), 0);
    assert.equal(await page.locator("#memo-r1").inputValue(),"安全面");
    await page.locator("#add").click();
    assert(await page.locator("#memo-r3").isVisible());
    assert(await page.locator("#memo-s3").isVisible());
    assert.equal(await page.locator("#memo-conclusion").inputValue(),"学校生活に適した服装を考える");
    assert.equal(await page.locator("#memo-conclusion").evaluate(e=>Boolean(document.getElementById("memo-s3").compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    assert.equal(await page.locator("#remove-item-1").count(),0);
    await page.locator("#memo-r2").fill("削除する項目");
    await page.locator("#memo-s2").fill("削除する補足");
    await page.locator("#memo-r3").fill("残す項目");
    await page.locator("#memo-s3").fill("残す補足");
    const captureManual=async()=>{await page.evaluate(()=>{window.__failCopy=true});await page.locator("#go").click();await page.locator("#manualBox").waitFor({state:"visible"});assert.match(await page.locator("#feedback").innerText(),/自動コピーできませんでした/);return page.locator("#manual").inputValue()};
    const assertCopyCleared=async()=>{assert.equal(await page.locator("#manual").inputValue(),"");assert.equal(await page.locator("#manualBox").isVisible(),false);assert.equal(await page.locator("#feedback").textContent(),"");assert.equal(await page.locator("#feedback").getAttribute("class"),"")};
    const itemPrompt=await captureManual();assert(itemPrompt.includes("削除する項目")&&itemPrompt.includes("削除する補足"));
    page.once("dialog",d=>d.dismiss());
    await page.locator("#remove-item-2").click();
    assert.equal(await page.locator("#memo-r2").inputValue(),"削除する項目");
    assert(await page.locator("#manualBox").isVisible());assert.equal(await page.locator("#manual").inputValue(),itemPrompt);
    page.once("dialog",d=>d.accept());
    await page.locator("#remove-item-2").click();
    assert.equal(await page.locator("#memo-r2").inputValue(),"残す項目");
    assert.equal(await page.locator("#memo-s2").inputValue(),"残す補足");
    await assertCopyCleared();
    assert.equal(await page.locator("#memo-r3").count(),0);
    assert.equal(await page.locator("#memo-r1").inputValue(),"安全面");
    await page.locator("#add").click();
    assert.equal(await page.locator("#memo-r3").inputValue(),"");
    assert.equal(await page.locator("#memo-s3").inputValue(),"");
    await page.locator("#remove-item-3").click();
    assert.equal(await page.locator("#memo-r3").count(),0);
    const conclusionPrompt=await captureManual();assert(conclusionPrompt.includes("学校生活に適した服装を考える"));assert(!conclusionPrompt.includes("削除する項目"));assert(!conclusionPrompt.includes("削除する補足"));
    page.once("dialog",d=>d.dismiss());
    await page.locator("#remove-conclusion").click();
    assert.equal(await page.locator("#memo-conclusion").inputValue(),"学校生活に適した服装を考える");
    assert(await page.locator("#manualBox").isVisible());assert.equal(await page.locator("#manual").inputValue(),conclusionPrompt);
    page.once("dialog",d=>d.accept());
    await page.locator("#remove-conclusion").click();
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    await assertCopyCleared();await page.evaluate(()=>{window.__failCopy=false});
    assert(await page.locator("#addConclusion").isVisible());
    await page.locator("#addConclusion").click();
    assert.equal(await page.locator("#memo-conclusion").inputValue(),"");
    await page.locator("#remove-conclusion").click();
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    await page.locator('input[name="guide"][value="no"]').check();
    assert.equal(await page.locator("#addConclusion").isVisible(),false);
    assert.equal(await page.locator("#memo-conclusion").count(),0);
    assert.equal(await page.locator("#memo-direction").count(),0);
    await page.locator("#memo-free").fill("友人と協力");
    await page.locator('input[name="level"][value="advanced"]').check();
    await page.locator("#phrases").check();await page.locator("#example").check();
    await page.locator('input[name="output"][value="both"]').check();
    p=await capturePrompt();
    assert.match(p,/【答案構成上の重要な指導方針：譲歩パターン】/);
    assert.match(p,/発展では、異なる立場の妥当性や自分の主張の限界・成立条件にも目を向け、譲歩を生かした説得力のある論理展開を積極的に検討し、有効な場合は提案してください/);
    assert.match(p,/何を認め、なぜそれでも自分の主張が成り立つのか/);
    assert.match(p,/譲歩のために主要な理由の説明や設問への対応が手薄にならないようにし/);
    assert.match(p,/【答案構成上の重要な指導方針：冒頭の意見表明】/);
    assert.match(p,/これは誤りの指摘ではなく、語数配分に関する助言として扱ってください/);
    assert.match(p,/この方針は基礎・発展の両方、おすすめフレーズ・英語の解答例にも適用します/);
    assert.match(p,/冒頭の意見表明は上記の指導方針に従い/);
    assert.match(p,/学習モード】発展/);assert.match(p,/おすすめフレーズ：希望あり/);assert(p.includes("テーマや文脈により的確な語彙・熟語・自然な語の組み合わせを選び、表現の幅を広げる。不必要な難語は避ける。"));assert(p.includes("論理を深め、内容に即した的確な語彙・多様な構文で表現力を高める。ただし、不必要な難語・複雑な構文は避け、高校生が学習して再現できる自然な英語にする。"));assert(!p.includes("高校生が自力で使いやすい、平易で汎用性の高い語彙・表現を優先する。"));assert(!p.includes("高校生が自力で再現しやすい平易な語彙・構文を用いる。大学入試の答案として十分な正確さ・明快さ・論理性を保つ。"));
    assert.match(p,/英語の解答例：希望あり/);assert.match(p,/JIS B5/);
    assert.match(p,/Word＋PDF/);assert.match(p,/友人と協力/);
    await page.locator('input[name="timer"][value="off"]').check();
    assert.equal(await page.locator("#timerPanel").isVisible(), false);
    assert.equal(await page.locator("#floatingTimer").isVisible(), false);
    await page.locator('input[name="timer"][value="on"]').check();
    assert.equal(await page.locator(".masthead").evaluate(e => getComputedStyle(e).position), "static");
    assert.equal(await page.locator("#clock").innerText(),"05:00");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForFunction(()=>document.getElementById("floatingTimer").hidden && !document.querySelector(".control-dock").classList.contains("is-docked"));
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    assert.equal(await page.locator(".timer-guidance summary").innerText(),"（使い方のヒント）");
    await page.locator(".timer-guidance summary").click();
    assert(await page.locator(".timer-guidance .note").isVisible());
    assert.match(await page.locator(".timer-guidance").innerText(), /構想を練るのが苦手な人は、まずは時間制限を設けずに取り組むのがおすすめです。\s*慣れてきたら、まずは５分のタイマーを設定してみましょう。（最終的には、100wordsで３分が目標です）/);
    await page.locator(".timer-guidance summary").click();
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await page.waitForFunction(()=>!document.getElementById("floatingTimer").hidden);
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    const pinnedScroll=await page.evaluate(()=>window.scrollY);
    assert(pinnedScroll>0);
    assert(await page.locator("#floatingStart").isVisible(),name+": compact start before timing");
    const guideBox=await page.locator(".login-guide").boundingBox();
    assert(guideBox&&guideBox.y+guideBox.height<=1,name+": login guide must scroll out of view");
    for(const selector of ["#start","#pause","#reset"]){
      const box=await page.locator(selector).boundingBox();
      assert(box&&box.y>=0&&box.y+box.height<=height, name+": fixed control not visible "+selector);
    }
    await page.locator("#start").click();
    assert.equal(await page.evaluate(()=>window.scrollY),pinnedScroll, name+": start unexpectedly scrolled page");
    assert.equal(await page.locator("#floatingTimer").evaluate(e=>getComputedStyle(e).position),"fixed");
    assert.equal(await page.evaluate(()=>document.getElementById("clock").textContent===document.getElementById("floatingClock").textContent),true);
    assert(await page.locator("#floatingStart").isVisible(),name+": compact pause visible while running");
    assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを一時停止");
    assert.equal(await page.locator("#floatingStart path").getAttribute("d"),"M4 2H7V14H4Z M9 2H12V14H9Z");
    await page.locator("#pause").click();
    assert(await page.locator("#floatingStart").isVisible(),name+": compact start restored on pause");
    assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを開始・再開");
    assert.equal(await page.locator("#floatingStart path").getAttribute("d"),"M4 1.5 L14 8 L4 14.5 Z");
    assert.equal(await page.evaluate(()=>window.scrollY),pinnedScroll, name+": pause unexpectedly scrolled page");
    await page.locator("#start").click();
    assert.equal(await page.evaluate(()=>window.scrollY),pinnedScroll, name+": resume unexpectedly scrolled page");
    await page.locator("#pause").click();
    await page.locator("#reset").click();assert.equal(await page.locator("#clock").innerText(),"05:00");
    assert.equal(await page.evaluate(()=>window.scrollY),pinnedScroll, name+": pause/reset unexpectedly scrolled page");
    assert.equal(await page.locator("#floatingClock").textContent(),"05:00");
    if(name==="iphone15pro-portrait"){
      // Emulate an iOS keyboard changing only the visual viewport, not the layout viewport.
      await page.locator("#memo-free").focus();
      const before=await page.evaluate(()=>window.scrollY);
      await page.evaluate(()=>{
        const vv=window.visualViewport;
        const top=Math.max(150,Math.ceil(document.getElementById("clock").getBoundingClientRect().bottom)+12);
        Object.defineProperties(vv,{offsetTop:{configurable:true,value:top},height:{configurable:true,value:250}});
        vv.dispatchEvent(new Event("resize"));
      });
      assert(await page.locator("#floatingTimer").isVisible(),name+": keyboard must not hide the timer");
      assert(await page.locator("#floatingTimer").evaluate(e=>{
        const r=e.getBoundingClientRect(),vv=window.visualViewport;
        return r.top>=vv.offsetTop&&r.bottom<=vv.offsetTop+vv.height;
      }),name+": compact timer must stay in the visible viewport");
      await page.evaluate(()=>{
        const vv=window.visualViewport;
        Object.defineProperty(vv,"offsetTop",{configurable:true,value:vv.offsetTop+20});
        vv.dispatchEvent(new Event("scroll"));
      });
      assert(await page.locator("#floatingTimer").evaluate(e=>e.getBoundingClientRect().top>=window.visualViewport.offsetTop),name+": timer must follow viewport panning");
      assert.equal(await page.evaluate(()=>window.scrollY),before,name+": viewport correction must not scroll the page");
      assert.equal(await page.locator("#floatingClock").textContent(),"05:00");
      assert(await page.locator("#floatingStart").isVisible(),name+": compact start available while typing");
      const memoBefore=await page.locator("#memo-free").inputValue();
      await page.locator("#floatingStart").click();
      assert.equal(await page.locator("#memo-free").evaluate(e=>document.activeElement===e),true,name+": tapping start must preserve input focus");
      assert.equal(await page.evaluate(()=>window.scrollY),before,name+": compact start must not scroll");
      assert(await page.locator("#floatingStart").isVisible());
      assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを一時停止");
      await page.waitForFunction(()=>document.getElementById("floatingClock").textContent!=="05:00");
      assert.equal(await page.locator("#memo-free").inputValue(),memoBefore);
      await page.locator("#floatingStart").click();
      assert.equal(await page.locator("#memo-free").evaluate(e=>document.activeElement===e),true,name+": tapping pause must preserve input focus");
      assert.equal(await page.evaluate(()=>window.scrollY),before,name+": compact pause must not scroll");
      assert(await page.locator("#floatingStart").isVisible(),name+": compact resume available");
      assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを開始・再開");
      assert.equal(await page.locator("#start").isEnabled(),true);
      assert.equal(await page.locator("#pause").isEnabled(),false);
      await page.locator("#floatingStart").click();
      assert.equal(await page.locator("#memo-free").evaluate(e=>document.activeElement===e),true);
      assert(await page.locator("#floatingStart").isVisible());
      assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを一時停止");
      await page.evaluate(()=>document.getElementById("reset").click());
      assert.equal(await page.locator("#floatingStart").getAttribute("aria-label"),"タイマーを開始・再開");
      assert.equal(await page.locator("#floatingClock").textContent(),"05:00");
      await page.evaluate(()=>{
        const vv=window.visualViewport;delete vv.offsetTop;delete vv.height;
        document.activeElement.blur();vv.dispatchEvent(new Event("resize"));
      });
      assert.equal(await page.locator("#floatingTimer").evaluate(e=>e.classList.contains("follow-viewport")),false);
    }
    await page.locator('input[name="timer"][value="off"]').check();
    assert.equal(await page.locator(".control-dock").evaluate(e => getComputedStyle(e).position), "sticky");
    assert.equal(await page.locator("#floatingTimer").isVisible(),false);
    assert.equal(await page.locator("#timerPanel").isVisible(),false);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('input[name="timer"][value="on"]').check();
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    await page.locator(".timer-guidance summary").click();
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),true);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),true);
    await page.locator(".timer-guidance summary").click();
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    await page.reload();
    assert(await page.locator('input[name="timer"][value="off"]').isChecked());
    assert.equal(await page.locator("#timerPanel").isVisible(),false);
    assert(await page.locator(".timer-guidance summary").isVisible());
    assert.equal(await page.locator(".timer-guidance").evaluate(e=>e.open),false);
    assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=width+1);
    assert.equal(errors.length,0,errors.join("; "));
    console.log("Brain dojo "+name+": PASS");
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
    await checkDojo(browser, "tablet", 820, 1180);
    await checkDojo(browser, "mobile", 390, 844);
    await checkDojo(browser, "iphone15pro-portrait", 393, 852);
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
