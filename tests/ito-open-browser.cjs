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
    assert.deepEqual(await page.locator("#qno option").allTextContents(),["選択してください","〔４〕","〔５〕"]);
    const opts=await page.locator("#year option").evaluateAll(nodes=>nodes.map(x=>x.value).filter(Boolean));
    assert.deepEqual(opts,["2026","2025","2024","2023","2022","open2027","open2026","open2025","open2024","open2023"]);
    assert.equal(await page.locator('#year optgroup[label="河合塾 九大入試オープン"]').count(),1);
    const openLabels=await page.locator('#year option[value^="open"]').allTextContents();
    assert.deepEqual(openLabels,[
      "2027年度（26年秋実施）",
      "2026年度（25年秋実施）",
      "2025年度（24年秋実施）",
      "2024年度（23年秋実施）",
      "2023年度（22年秋実施）"
    ]);
    assert.equal(await page.locator("#wc").innerText(),"０ 語");
    const records=await page.evaluate(()=>{
      const keys=Object.keys(OPEN_CASES).sort();
      return keys.map(k=>({key:k,label:label(k),display:displayLabel(k),full:RANGE[k].full,modelCount:DATA.model[k].variants.length,wordsMin:RANGE[k].min}));
    });
    assert.equal(records.length,10);
    for(const r of records){
      assert.match(r.label,/年度入試対策 九大入試オープン 〔[４５]〕（20\d{2}年11月実施）/);
      const year=Number(r.key.slice(4,8)),q=r.key.slice(-1);
      assert.equal(r.display,`${year}年度（${(year-1)%100}年秋実施） 〔${q==="4"?"４":"５"}〕`);
    }
    await page.selectOption("#year","open2025");
    await page.selectOption("#qno","4");
    assert.equal(await page.locator("#step2").isVisible(),true);
    assert.equal(await page.locator("#problemTag").innerText(),"2025年度（24年秋実施） 〔４〕（40点）");
    assert.match(await page.locator("#problem").innerText(),/In the 2022 academic year/);
    assert.match(await page.locator("#problem").innerText(),/〔４〕/);
    assert.match(await page.locator("#problem").innerText(),/問題文（英文原文）/);
    assert.equal(await page.locator("details.passage-box").getAttribute("open"),"");
    assert.doesNotMatch(await page.locator("#problem").innerText(),/語数|文数|減点/);
    assert.equal(await page.locator("#wcHint").count(),0);
    await page.locator("#answer").fill("Students can have different learning opportunities. Some can study online and some can build new relationships in their communities.");
    assert.equal(await page.locator("#wc").innerText(),"19 語");
    assert.equal(await page.locator("#wc").getAttribute("class"),"wc none");
    await page.locator("#gradeBtn").click();
    assert.equal(await page.locator("#showAnswerBtn").isEnabled(),true);
    await page.locator("#showAnswerBtn").click();
    const headings=await page.locator("#modelAnswers h3").allInnerTexts();
    assert.deepEqual(headings,["解答例①（100 words）","解答例②（100 words）","解答例③（101 words）"]);
    await page.selectOption("#year","open2026");
    assert.match(await page.locator("#changeText").innerText(),/2026年度（25年秋実施） 〔４〕/);
    await page.locator("#changeNo").click();
    const prompt=await page.evaluate(()=>buildPrompt("open2025-4","English sample.",2,"text"));
    assert.match(prompt,/2025年度入試対策 九大入試オープン 〔４〕（2024年11月実施）/);
    assert.match(prompt,/［解答例③］\(101 words\)/);
    assert.match(prompt,/299,048/);
    assert.match(prompt,/Describe in about 100 English words two positive future changes/);
    assert(!prompt.includes("2025年度 前期 〔４〕"));
    await page.screenshot({path:path.join(artifacts,"ito-open-"+name+".png"),fullPage:true});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.selectOption("#year","open2024");
    await page.selectOption("#qno","5");
    assert.equal(await page.locator("#problemTag").innerText(),"2024年度（23年秋実施） 〔５〕（30点）");
    assert.match(await page.locator("#problem").innerText(),/The bar graphs below show the monthly precipitation/);
    assert.equal(await page.locator("#problem svg").count(),1);
    assert.match(await page.locator("#problem svg").getAttribute("aria-label"),/all twelve months/);
    assert.doesNotMatch(await page.locator("#problem").innerText(),/語数|文数|減点/);
    await page.locator("#answer").fill(Array.from({length:130},()=> "word").join(" "));
    assert.equal(await page.locator("#wc").getAttribute("class"),"wc none");
    assert.equal(await page.locator("#wc").innerText(),"130 語");
    assert.equal(await page.locator("#wcHint").count(),0);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.selectOption("#year","2026");
    await page.selectOption("#qno","4");
    assert.match(await page.locator("#problemTag").innerText(),/2026年度 〔４〕（40点）/);
    assert.match(await page.locator("#problem").innerText(),/What are three essential abilities of good teachers/);
    assert.match(await page.locator("#problem").innerText(),/出典：九州大学/);
    assert.doesNotMatch(await page.locator("#problem").innerText(),/語数|文数|減点/);
    await page.locator("#answer").fill(Array.from({length:130},()=> "word").join(" "));
    assert.equal(await page.locator("#wc").getAttribute("class"),"wc none");
    assert.equal(await page.locator("#wc").innerText(),"130 語");
    const original=await page.evaluate(()=>buildPrompt("2026-4","Teachers should listen carefully.",4,"text"));
    assert.match(original,/2026年度 〔４〕/);
    assert.match(original,/What are three essential abilities of good teachers/);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.selectOption("#year","2026");
    await page.selectOption("#qno","5");
    assert.equal(await page.locator("#problem svg").count(),1);
    assert.match(await page.locator("#problem").innerText(),/Springfield University/);
    assert.doesNotMatch(await page.locator("#problem").innerText(),/語数の減点なし/);

    const sixth=await page.evaluate(()=>DATA.rubric["2026-5"]);
    assert.match(sixth,/図表項目名に由来する大文字・小文字の誤り/);
    assert.match(sixth,/複数箇所にあっても合計−１点/);
    assert.match(sixth,/共通原則による書式減点とこの項目を二重計上せず/);
    const later=await page.evaluate(()=>DATA.rubric["2025-5"]);
    assert.doesNotMatch(later,/図表項目名に由来する大文字・小文字の誤り/);

    for(const [id,full,topic] of [
      ["2022-4",50,"multicultural society"],
      ["2022-5",30,"global UFO sightings"],
      ["2023-4",50,"Virtual reality"],
      ["2023-5",30,"Japanese citizens in millions"]
    ]){
      const [,yr,q]=/^(20\d{2})-([45])$/.exec(id);
      await page.selectOption("#year",yr);
      await page.selectOption("#qno",q);
      assert.equal(await page.locator("#step2").isVisible(),true,id);
      assert.equal(await page.locator("#problemTag").innerText(),yr+"年度 〔"+(q==="4"?"４":"５")+"〕（"+full+"点）",id);
      assert.match(await page.locator("#problem").innerText(),new RegExp(topic,"i"),id);
      assert.equal(await page.locator("#problem svg").count(),q==="5"?1:0,id);
      const info=await page.evaluate(id=>({
        full:RANGE[id].full,wordsMin:RANGE[id].min,wordsMax:RANGE[id].max,
        rubric:DATA.rubric[id],prompt:DATA.problem[id],model:DATA.model[id],grade:buildPrompt(id,"student answer",2,"text")
      }),id);
      assert.equal(info.full,full,id);
      assert.equal(info.model.text.length>200,true,id);
      assert.match(info.grade,/すべての年度〔４〕〔５〕共通/,id);
      assert.match(info.grade,new RegExp(topic,"i"),id);
      assert(info.grade.includes(yr+"年度前期"),id+": year-specific instructions");
      if(id==="2022-5"){
        assert.equal(info.wordsMin,55);
        assert.equal(info.wordsMax,85);
        assert.match(info.rubric,/54語以下−15点/);
        assert.match(info.prompt,/8,736/);
      }
      if(id==="2023-5"){
        assert.equal(info.wordsMin,null);
        assert.equal(info.wordsMax,null);
        assert.match(info.rubric,/３〜４英文/);
        assert.match(info.rubric,/２〜３英文/);
      }
      if(q==="4")assert.equal(info.wordsMin,80);
    }
    await page.reload({waitUntil:"domcontentloaded"});
    // Every mock has its original English prompt; data questions have a chart/table.
    for(const id of Object.keys((await page.evaluate(()=>OPEN_QUESTIONS)))){
      const [,yr,q]=/^open(20\d{2})-([45])$/.exec(id);
      await page.selectOption("#year","open"+yr);
      await page.selectOption("#qno",q);
      const excerpt=await page.evaluate(id=>OPEN_QUESTIONS[id].text.split(/\n\n/)[1].slice(0,38),id);
      assert((await page.locator("#problem").textContent()).includes(excerpt),id+": missing original English");
      assert.match(await page.locator("#problem").innerText(),new RegExp("〔"+(q==="4"?"４":"５")+"〕"),id+": question numeral not fullwidth");
      assert(!/当ラボが学習用に再構成|次の設問は/.test(await page.locator("#problem").innerText()),id);
      if(["open2023-5","open2024-5","open2027-5"].includes(id))assert.equal(await page.locator("#problem svg").count(),1,id);
      if(id==="open2026-4")assert.equal(await page.locator("#problem table").count(),1,id);
    }
    await page.locator("#answer").fill("one");
    assert.equal(await page.locator("#wc").innerText(),"１ 語");
    await page.locator("#answer").fill("one two three four five six seven eight nine ten");
    assert.equal(await page.locator("#wc").innerText(),"10 語");
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
