"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname,"..");
const html = fs.readFileSync(path.join(root,"ito/index.html"),"utf8");
const casesSource = fs.readFileSync(path.join(root,"ito/open-cases.js"),"utf8");
const modelsSource = fs.readFileSync(path.join(root,"ito/open-models.js"),"utf8");
const cases=JSON.parse(JSON.stringify(vm.runInNewContext(casesSource+"\nOPEN_CASES", {})));
const models=JSON.parse(JSON.stringify(vm.runInNewContext(modelsSource+"\nOPEN_MODELS", {})));
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
  assert.match(html,/<p class="lede">2024～26年度（前期）および九大オープン５回分を、独自の基準に基づき添削します。<\/p>/);
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
  assert.match(html,/const MOCK_PRACTICE_HTML =/);
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
  const practiceSource=html.match(/const MOCK_PRACTICE_HTML = (\{[\s\S]*?\n\});\nconst DATA_B64/)?.[1];
  assert(practiceSource,"Practice reconstruction block missing");
  const practice=JSON.parse(practiceSource);
  assert.deepEqual(Object.keys(practice).sort(),mockKeys.slice().sort());
  for(const key of mockKeys)assert(practice[key].length>35,key);
  assert.match(html,/河合塾の原題・図表そのものではありません/);
  assert(!html.includes("語数の減点なし："));
});

test("Ito: no word-count penalty for 2024 mock question 5",()=>{
  const c=cases["open2024-5"];
  assert.equal(c.min,null);
  assert.equal(c.max,null);
  assert.match(c.rubric,/Aの英文数は3〜4文/);
  assert.match(c.rubric,/Bの英文数は2〜3文/);
});
