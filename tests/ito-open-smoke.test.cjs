"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { test } = require("node:test");
const root = path.resolve(__dirname,"..");
const html = fs.readFileSync(path.join(root,"ito/index.html"),"utf8");
const casesSource = fs.readFileSync(path.join(root,"ito/open-cases.js"),"utf8");
const modelsSource = fs.readFileSync(path.join(root,"ito/open-models.js"),"utf8");
const questionsSource = fs.readFileSync(path.join(root,"ito/open-questions.js"),"utf8");
const earlySource = fs.readFileSync(path.join(root,"ito/early-cases.js"),"utf8");
const cases=JSON.parse(JSON.stringify(vm.runInNewContext(casesSource+"\nOPEN_CASES", {})));
const models=JSON.parse(JSON.stringify(vm.runInNewContext(modelsSource+"\nOPEN_MODELS", {})));
const questions=JSON.parse(JSON.stringify(vm.runInNewContext(questionsSource+"\nOPEN_QUESTIONS", {})));
const early=JSON.parse(JSON.stringify(vm.runInNewContext(earlySource+"\nEARLY_CASES", {})));
const encoded=html.match(/const DATA_B64 = "([^"]+)"/)?.[1];
assert(encoded,"Existing exam grading data must be present");
const data=JSON.parse(Buffer.from(encoded,"base64").toString("utf8"));
const mockKeys=Array.from({length:5},(_,i)=>2023+i).flatMap(year=>[4,5].map(q=>"open"+year+"-"+q));
const originalKeys=["2024-4","2024-5","2025-4","2025-5","2026-4","2026-5"];

test("Ito: browser scripts are valid JavaScript",()=>{
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const [,script] of inline)new vm.Script(script);
  new vm.Script(casesSource);
  new vm.Script(modelsSource);
  new vm.Script(questionsSource);
  new vm.Script(earlySource);
});

test("Ito: every open question has grading conditions and model answers",()=>{
  assert.equal(mockKeys.length,10);
  assert.deepEqual(Object.keys(cases).sort(),mockKeys.slice().sort());
  assert.deepEqual(Object.keys(models).sort(),mockKeys.slice().sort());
  for(const key of mockKeys){
    const c=cases[key],list=models[key],year=Number(key.slice(4,8)),q=Number(key.slice(-1));
    assert.equal(c.year,year,key);
    assert.equal(c.held,year-1,key);
    assert.equal(c.q,q,key);
    assert([30,40,50].includes(c.full),key);
    assert(c.conditions.length>20 && c.rubric.length>150,key);
    assert(Array.isArray(list)&&list.length>0,key);
    for(const v of list){
      assert.match(v.label,/^解答例(?:[①②③])?$/,key);
      assert(v.text.length>75,key);
      if(Number.isInteger(v.words))assert.equal(v.text.split(/\s+/).length,v.words,key+" "+v.label);
    }
  }
  assert.equal(Object.values(models).reduce((n,a)=>n+a.length,0),16);
});

test("Ito: header copy matches the five-mock-exam presentation",()=>{
  assert.match(html,/<div class="seal" aria-hidden="true">九<\/div>/);
  assert.match(html,/<p class="kicker">九大前期と九大オープン<\/p>/);
  assert.match(html,/<h1>伊都への恋文｜自由英作文<\/h1>/);
  assert.match(html,/<p class="lede">[^<]*九大オープン[^<]*<\/p>/);
});

test("Ito: revised 2024 and 2025 answer labels",()=>{
  assert.deepEqual(models["open2024-4"].map(x=>x.label),["解答例①","解答例②"]);
  assert.deepEqual(models["open2025-4"].map(x=>x.label),["解答例①","解答例②","解答例③"]);
});

test("Ito: original entrance-exam grading records remain available",()=>{
  for(const key of originalKeys){
    for(const field of ["problem","rubric","instr","model"]) assert(data[field]?.[key],field+" "+key);
  }
  assert.match(html,/const ORIGINAL_PROBLEM_HTML =/);
  assert.match(html,/const ORIGINAL_PROMPT_TEXT =/);
  assert.match(html,/<script src="\.\/open-questions\.js"><\/script>/);
  assert.match(html,/<script src="\.\/early-cases\.js"><\/script>/);
  assert.match(html,/open-cases\.js/);
  assert.match(html,/open-models\.js/);
  assert.match(html,/The population of Japan peaked in 2008/);
  assert.match(html,/問題を読む/);
});

test("Ito: all previous original questions and practice reconstructions exist",()=>{
  const source=html.match(/const ORIGINAL_PROBLEM_HTML = \{[\s\S]*?\n\};/)?.[0];
  assert(source,"Original question block missing");
  const original=JSON.parse(JSON.stringify(vm.runInNewContext(source+"\nORIGINAL_PROBLEM_HTML",{})));
  assert.deepEqual(Object.keys(original).sort(),originalKeys.slice().sort());
  for(const key of originalKeys)assert(original[key].length>100,key);
  assert.match(original["2026-5"],/<svg/);
  assert.deepEqual(Object.keys(questions).sort(),mockKeys.slice().sort());
  for(const key of mockKeys){
    assert(questions[key].text.length>110,key);
    assert.match(questions[key].text,/\b(?:Read|The chart)\b/,key);
    assert(!/定額制動画配信サービス（SVOD）には|不登校の児童生徒が増えている状況/.test(questions[key].text));
  }
  assert.match(questions["open2023-4"].text,/More and more people are enjoying movies on SVOD services/);
  assert.match(questions["open2024-4"].text,/A drone is a pilotless aircraft/);
  assert.match(questions["open2025-4"].text,/299,048/);
  assert.match(questions["open2026-4"].text,/short-term English language programs/);
  assert.match(questions["open2027-4"].text,/What are three essential qualities of good medical doctors\?/);
  const fig=vm.runInNewContext(questionsSource+"\nopenFigureHtml(\"precip\")",{});
  assert.match(fig,/<svg/);
  assert.match(fig,/Naha City/);
  assert.match(fig,/Joetsu City/);
  assert(!html.includes("語数の減点なし："));
});

test("Ito: 2022/2023 original exams use shared rubric and source-specific scoring",()=>{
  const ids=["2022-4","2022-5","2023-4","2023-5"];
  assert.deepEqual(Object.keys(early).sort(),ids);
  for(const id of ids){
    const c=early[id];
    assert.match(c.prompt,/Read the instructions/);
    assert(c.model.text.length>200,id);
    assert(c.rubric.length>400,id);
    assert.match(c.rubric,/全年度共通【自由英作文問題の採点上の原則】/);
  }
  assert.deepEqual(ids.map(id=>early[id].full),[50,30,50,30]);
  assert.deepEqual(ids.map(id=>[early[id].min,early[id].max]),[[80,120],[55,85],[80,120],[null,null]]);
  assert.match(early["2022-4"].rubric,/59語以下−40点/);
  assert.match(early["2022-5"].rubric,/2014年から2020年のＶ字型/);
  assert.match(early["2023-4"].rubric,/明らかに異なるジャンルの方法/);
  assert.match(early["2023-5"].rubric,/３〜４英文/);
  assert.match(early["2023-5"].rubric,/２〜３英文/);
  assert.match(html,/<option value="2023">2023年度 前期<\/option>/);
  assert.match(html,/<option value="2022">2022年度 前期<\/option>/);
  assert.match(html,/const VISUAL_LABEL_CAPITALIZATION_RULE =/);
  assert.match(html,/DATA\.common_rubric \+=/);
  assert.match(html,/図表に由来しない不適切な大文字化/);
  assert.match(html,/１箇所につき−１点/);
  assert.doesNotMatch(html,/DATA\.rubric\["2026-5"\] \+=/);
  assert.doesNotMatch(cases["open2027-5"].rubric,/【2027年〔５〕固有の補足】/);
  const c2022q5=vm.runInNewContext(earlySource+"\nearlyQuestionHtml('2022-5')",{});
  const c2023q5=vm.runInNewContext(earlySource+"\nearlyQuestionHtml('2023-5')",{});
  assert.match(c2022q5,/<svg/);
  assert.match(c2022q5,/8,736/);
  assert.match(c2023q5,/<svg/);
  assert.match(c2023q5,/Japanese citizens by age category/);
});

test("Ito: clinic-style QA guidance does not overwrite case rubrics or solicit external model answers",()=>{
  assert.match(html,/const ITO_FEEDBACK_QUALITY = \[/);
  assert.match(html,/max\(0, M－C－E－W\)/);
  assert.match(html,/減点一覧の各行の合計とC・E・Wが一致/);
  assert.match(html,/減点対象外の改善提案/);
  assert.match(html,/文数条件がある問題では文数も確認/);
  assert.match(html,/同じ種類の誤りで減点を重ねない箇所も修正案/);
  assert.match(html,/公開解答例の追加検索は行わず/);
  assert.doesNotMatch(html,/公開解答例の検索・紹介が明示的に希望されている場合に限り/);
  assert.doesNotMatch(html,/本文Ⅳ未収録/);
  assert.match(data.common,/手書き答案の写真・PDFはChatGPTに直接添付する方式/);
  assert.match(data.common,/手書き答案の写真・PDFではこの値は仮の０語/);
  assert.doesNotMatch(data.common,/「設問条件の要約」は/);
  assert.doesNotMatch(data.common,/読み取った答案は生徒が画面上で確認・修正できるようにしている/);
  assert.deepEqual(Object.keys(data.rubric).sort(),originalKeys.slice().sort());
  assert.deepEqual(Object.keys(data.model).sort(),originalKeys.slice().sort());
  assert.deepEqual(Object.keys(cases).sort(),mockKeys.slice().sort());
  assert.deepEqual(Object.keys(models).sort(),mockKeys.slice().sort());
  assert.deepEqual(Object.keys(early).sort(),["2022-4","2022-5","2023-4","2023-5"]);
  assert.match(data.rubric["2026-4"],/59\s*語以下[\s\S]*－30\s*点/);
  assert.match(data.rubric["2026-5"],/101\s*語以上[\s\S]*－15\s*点/);
  assert.match(cases["open2027-5"].rubric,/紙の辞書の減少/);
  assert.match(early["2023-5"].rubric,/３〜４英文/);
});

test("Ito: locked scoring records and model answers SHA-256 (baseline print)",()=>{
  const rangeLiteral=html.match(/const RANGE = \{[\s\S]*?\n\};/)?.[0];
  assert(rangeLiteral,"Ito native range literals must be present");
  const locked={
    baseRangeSource:rangeLiteral,
    originalCommonRubric:data.common_rubric,
    originalProblem:data.problem,
    originalRubric:data.rubric,
    originalInstructions:data.instr,
    originalModels:data.model,
    earlyCases:early,
    mockCases:cases,
    mockModels:models,
    mockQuestions:questions
  };
  const checksum=crypto.createHash("sha256").update(JSON.stringify(locked),"utf8").digest("hex");
  console.log("ITO_SOURCE_SCORING_SHA256="+checksum);
  assert.match(checksum,/^[a-f0-9]{64}$/);
});

test("Ito: audit corrections keep scoring source intact",()=>{
  assert.match(html,/上限適用前.*上限適用後/);
  assert.match(html,/上限超過で追加減点しない誤りも修正一覧から削除せず/);
  assert.match(html,/満点答案でも差し替え用の１文や部分修正だけにせず/);
  assert.match(html,/減点対象外の表現改善】に置き/);
  assert.match(html,/Word＋PDFの両方を指定して一方だけ作成できた場合/);
  assert.match(html,/指定形式が一つも作成できなかった場合に限り/);
  assert.match(html,/function copyItoPrompt\(text\)/);
  assert.match(html,/const copyPromise=copyItoPrompt\(promptText\)/);
  assert.match(html,/many friend/);
  assert.match(html,/辞書の用例が存在するだけで今回の文脈での誤用を自動的に免除しない/);
  assert.match(data.common,/テキスト入力では【確定語数】以外の語数を使わない。写真・PDFでは最優先指示の手順で確定した語数を使う/);
  assert.doesNotMatch(data.common,/確定語数以外の語数を使わない/);
  assert.doesNotMatch(html,/公開解答例の検索・紹介が明示的に希望されている場合に限り/);
  assert.match(html,/A\/Bラベル除外/);
});

test("Ito: no word-count penalty for 2024 mock question 5",()=>{
  const c=cases["open2024-5"];
  assert.equal(c.min,null);
  assert.equal(c.max,null);
  assert.match(c.rubric,/Aの英文数は3〜4文/);
  assert.match(c.rubric,/Bの英文数は2〜3文/);
});
