"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {loadCases,loadPassage,buildPrompt,buildBundle,countJa}=require("./sum-eval-bundle.cjs");

test("blinded evaluation fixtures: ten unique summaries with verified length",()=>{
 const cases=loadCases(), passage=loadPassage();
 assert.equal(cases.length,10);
 assert.equal(new Set(cases.map(x=>x.id)).size,10);
 assert(passage.includes("Mind wandering can be deleterious"));
 for(const c of cases){
  assert(c.chars<=120);
  assert.equal(countJa(c.answer),c.chars);
  assert(!c.answer.includes("有害だが"),"Unqualified common phrase leaked");
 }
});

test("blinded input construction: actual app prompt and no revealed evaluation keys",()=>{
 const cases=loadCases();
 const pass=loadPassage();
 const prompts=cases.map(c=>buildPrompt(pass,c.answer));
 assert.equal(new Set(prompts).size,10);
 for(const prompt of prompts){
  assert(prompt.includes("配点：40点満点"));
  assert(prompt.includes("字数指定：120字以内"));
  assert(prompt.includes("公開解答例の検索・紹介は希望されていないため実施しない"));
  assert(prompt.includes("上限を超えたら超過量によらず一律－15点"));
  assert(prompt.includes("原文にない内容を加えて要約の適切さを明らかに損なう場合はMの25％"));
  assert(prompt.includes("原文と明らかに矛盾する重大な内容を加えた場合はMの50％"));
  assert(!prompt.includes("事前の検討用仮説"));
  assert(!prompt.includes("単回の暫定採点"));
  assert(!prompt.includes("original_case"));
 }
});

test("exported evaluation bundle: ten prompts and thirty empty result rows",()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"yorinuki-eval-"));
 try{
  const output=buildBundle(tmp);
  assert.equal(output.records.length,10);
  assert.equal(new Set(output.records.map(r=>r.filename)).size,10);
  const key=JSON.parse(fs.readFileSync(path.join(tmp,"private-key.json"),"utf8"));
  assert.equal(key.cases.length,10);
  for(const rec of output.records){
   const value=fs.readFileSync(path.join(tmp,"prompts",rec.filename),"utf8").trimEnd();
   assert.equal(crypto.createHash("sha256").update(value).digest("hex"),rec.sha256);
   assert(value.includes("配点：40点満点"));
   assert(value.includes("参考字数"));
   assert(value.includes(rec.characters+"字。"),"Mismatch between preview count and manifest for "+rec.filename);
  }
  const csv=fs.readFileSync(path.join(tmp,"results-template.csv"),"utf8").trimEnd().split("\n");
  assert.equal(csv.length,31);
  const emptyScores=csv.slice(1).every(row=>row.split(",")[9]==="");
  assert(emptyScores);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
