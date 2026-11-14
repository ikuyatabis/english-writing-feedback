"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright");
const target=pathToFileURL(path.resolve(__dirname,"..","ito","index.html")).href;
const artifacts=path.resolve(__dirname,"..","test-artifacts");
fs.mkdirSync(artifacts,{recursive:true});

async function check(browser,name,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  await context.route(/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/,route=>route.abort());
  await context.addInitScript(()=>{
    window.open=()=>null;
    Object.defineProperty(navigator,"clipboard",{
      configurable:true,
      value:{writeText:async text=>{window.__lastCopied=text;}}
    });
  });
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  try{
    await page.goto(target,{waitUntil:"domcontentloaded"});
    const opts=await page.locator("#year option").evaluateAll(nodes=>nodes.map(x=>x.value).filter(Boolean));
    assert.deepEqual(opts,["2026","2025","2024","open2027","open2026","open2025","open2024","open2023"]);
    assert.equal(await page.locator('#year optgroup[label="河合塾 九大入試オープン"]').count(),1);
    const openLabels=await page.locator('#year option[value^="open"]').allTextContents();
    assert.deepEqual(openLabels,[
      "2027年度九大オープン（26年秋実施分）",
      "2026年度九大オープン（25年秋実施分）",
      "2025年度九大オープン（24年秋実施分）",
      "2024年度九大オープン（23年秋実施分）",
      "2023年度九大オープン（22年秋実施分）"
    ]);
    const records=await page.evaluate(()=>{
      const keys=Object.keys(OPEN_CASES).sort();
      return keys.map(k=>({key:k,label:label(k),full:RANGE[k].full,modelCount:DATA.model[k].variants.length,wordsMin:RANGE[k].min}));
    });
    assert.equal(records.length,10);
    for(const r of records)assert.match(r.label,/年度入試対策 九大入試オープン 第[45]問（20\d{2}年11月実施）/);
    await page.selectOption("#year","open2025");
    await page.selectOption("#qno","4");
    assert.equal(await page.locator("#step2").isVisible(),true);
    assert.match(await page.locator("#problemTag").innerText(),/2025年度入試対策.*第4問.*40点/);
    assert.match(await page.locator("#problem").innerText(),/問題文・図表は掲載していません/);
    await page.locator("#answer").fill("Students can have different learning opportunities. Some can study online and some can build new relationships in their communities.");
    await page.locator("#gradeBtn").click();
    assert.equal(await page.locator("#showAnswerBtn").isEnabled(),true);
    await page.locator("#showAnswerBtn").click();
    const headings=await page.locator("#modelAnswers h3").allInnerTexts();
    assert.deepEqual(headings,["解答例①（100 words）","解答例②（100 words）","解答例③（101 words）"]);
    const prompt=await page.evaluate(()=>buildPrompt("open2025-4","English sample.",2,"text"));
    assert.match(prompt,/2025年度入試対策 九大入試オープン 第4問（2024年11月実施）/);
    assert.match(prompt,/［解答例③］\(101 words\)/);
    assert(!prompt.includes("2025年度 前期 第4問"));
    await page.screenshot({path:path.join(artifacts,"ito-open-"+name+".png"),fullPage:true});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.selectOption("#year","open2024");
    await page.selectOption("#qno","5");
    assert.match(await page.locator("#problem").innerText(),/語数による減点なし。指定された文数/);
    await page.locator("#answer").fill(Array.from({length:130},()=> "word").join(" "));
    assert.equal(await page.locator("#wc").getAttribute("class"),"wc none");
    assert.match(await page.locator("#wcHint").innerText(),/文数の指定/);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.selectOption("#year","2026");
    await page.selectOption("#qno","4");
    assert.match(await page.locator("#problemTag").innerText(),/2026年度 第4問（40点）/);
    const original=await page.evaluate(()=>buildPrompt("2026-4","Teachers should listen carefully.",4,"text"));
    assert.match(original,/2026年度 第4問/);
    assert.match(original,/優れた教師|teachers/i);
    const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
    if(scroll>width+1){
      const overflowNodes=await page.evaluate(()=>[...document.querySelectorAll("body *")].map(el=>{
        const r=el.getBoundingClientRect();
        return {tag:el.tagName,cls:String(el.className).slice(0,80),id:el.id,right:Math.round(r.right),width:Math.round(r.width),scroll:el.scrollWidth};
      }).filter(x=>x.right>innerWidth+1).slice(0,15));
      console.error("ITO_OVERFLOW "+name+": "+JSON.stringify(overflowNodes));
    }
    assert(scroll<=width+1,name+": horizontal overflow: "+scroll);
    assert.deepEqual(errors,[],name+": JS errors");
    console.log("Ito Open "+name+": PASS; mocks="+records.length+", models="+records.reduce((n,r)=>n+r.modelCount,0));
  }finally{await context.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    await check(browser,"desktop",1365,900);
    await check(browser,"mobile",390,844);
    await check(browser,"small-mobile",320,700);
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
