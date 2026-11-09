"use strict";
// These tests verify ACTUAL PROMPT CONSTRUCTION and fixture provenance.
// They do not simulate model judgments or claim the model will score B3/C4 correctly.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {loadCases,loadPassage,countJa}=require("./sum-eval-bundle.cjs");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"sum","index.html"),"utf8");
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(js,"Summary application's inline JavaScript must exist");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const baseSentence="原文にない軽微な補足でも原文の趣旨を損なわなければ，それ自体では減点しない。";
const content25="原文にない内容を加えて要約の適切さを明らかに損なう場合はMの25％";
const content50="原文と明らかに矛盾する重大な内容を加えた場合はMの50％";
const b3="原文が述べていない教育方針などの主張を結論として加え，原文の趣旨を不当に拡張した場合は25％減点の対象とする。";
const c4="原文の可能性・限定・留保を取り除き，根拠なく無条件の断定へ変えて意味をゆがめた場合も同様とする。";
const guard="原文にないというだけで自動的に減点せず，趣旨を損なわない軽微な補足は減点しない。";
const severe="重大で明白な原文矛盾には50％減点を優先する。";
const formula="内容減点合計Cは min(M, max(L,P)+D) とし，LとPを両方足してはならない。";

function harness(opts={}){
 const elements=Object.fromEntries(ids.map(id=>[id,{
  value:"",checked:false,hidden:false,textContent:"",
  validity:{badInput:false},addEventListener(){}
 }]));
 const values={
  examPoints:"40",approxWords:"100",minWords:"80",maxWords:"120",withinWords:"120",
  problem:"The original text is not a school policy.",answer:"要約の内容。",...opts.values
 };
 for(const [id,value] of Object.entries(values)){
  assert(elements[id],"Input ID not present: "+id);
  elements[id].value=value;
 }
 const selections={kind:"ja",wordmode:"within",outputFormat:"screen",...opts.select};
 for(const [id,checked] of Object.entries(opts.checked||{})){
  assert(elements[id],"Unknown checkbox "+id);
  elements[id].checked=checked;
 }
 const doc={
  getElementById(id){assert(elements[id],"Missing element "+id);return elements[id];},
  querySelector(q){
   for(const [k,v] of Object.entries(selections)){
    if(q==='input[name="'+k+'"]:checked')return {value:v};
   }
   throw Error("Unknown selector "+q);
  },
  querySelectorAll(q){
   return q===".word-unit"?Array.from({length:8},()=>({textContent:""})):[];
  }
 };
 const context=vm.createContext({document:doc,window:{},navigator:{}});
 vm.runInContext(js,context,{timeout:4000});
 return {prompt:vm.runInContext("makePrompt()",context,{timeout:4000}),elements,selections};
}

// 01–08: every important positive and negative clause reaches ChatGPT.
for(const [name,needle] of [
 ["preserves the old lightweight-supplement exemption",baseSentence],
 ["preserves the old 25-percent threshold",content25],
 ["preserves the old 50-percent threshold",content50],
 ["includes the B3 unsupported conclusion guidance",b3],
 ["includes the C4 excessive-certainty guidance",c4],
 ["explicitly forbids automatic penalty for minor additions",guard],
 ["retains severe-contradiction priority",severe],
 ["retains content-overlap formula without additive L+P",formula]
]){
 test("Content rubric: "+name,()=>assert(harness().prompt.includes(needle),name));
}

// 09–10: no leakage of audit labels or previously expected answers.
test("Prompt contains no B3/C4 fixture label, expected score or audit classification",()=>{
 const p=harness().prompt;
 for(const s of ["B3型","C4型","B3の得点","C4の得点","事前の検討用仮説","30回の観点別検証"]){
  assert(!p.includes(s),"Auditor note leaked to model: "+s);
 }
});
test("New content rubric is included exactly once and inside the scoring COMMON rules",()=>{
 const p=harness().prompt;
 assert.equal(p.split(b3).length,2);
 assert.equal(p.split(c4).length,2);
 assert(p.indexOf("【原文にない内容・事実との矛盾】")<p.indexOf(b3));
 assert(p.indexOf(c4)<p.indexOf("【日本文要約：日本語表現】"));
});

// 11–20: ten distinct real summary fixtures, not invented answer bodies.
const cases=loadCases(),passage=loadPassage();
const contents={
 B1:"たとえば，新しい構図を考える芸術家には有益である。",
 B2:"教室で注意がそれた生徒への叱責は，見当違いかもしれない。",
 B3:"したがって，学校では授業中の空想を積極的に認めるべきだ。",
 B4:"したがって，全校で授業中の空想を常に奨励するよう義務づけるべきだ。",
 B5:"運転中に気がそれても危険は生じず，集中は不要である。",
 B6:"運転中の注意散漫は重大事故につながりうる。",
 C1:"したがって，空想を一概に否定することはできない。",
 C2:"この考察は，授業中の空想への指導を再考する手掛かりとなる。",
 C3:"筆者は，学校が授業中の空想を積極的に認めるべきだと結論づける。",
 C4:"授業で空想する生徒への叱責は，常に誤りである。"
};
for(const [id,tail] of Object.entries(contents)){
 test("Fixture "+id+" has original wording, normalized character count and remains below 120",()=>{
  const c=cases.find(x=>x.id===id);
  assert(c,"missing boundary case "+id);
  assert(c.answer.endsWith(tail),"fixture content changed for "+id);
  assert.equal(c.chars,countJa(c.answer));
  assert(c.chars<=120,"case exceeds limit "+id);
  const p=harness({values:{
   problem:"次の英文を日本語120字以内で要約してください。\n\n"+passage,
   answer:c.answer
  }}).prompt;
  assert(p.includes(JSON.stringify(c.answer)),"fixture not passed unmodified");
  assert(p.includes(b3)&&p.includes(c4),"fixture evaluated using old rubric");
  assert(p.includes("配点：40点満点")&&p.includes("字数指定：120字以内"));
 });
}

// 21–30: scoring points, 0/blank scoring, both answer languages.
for(const kind of ["ja","en"]){
 for(const points of ["","0","10","20","40"]){
  test("Score setting "+kind+" / "+(points||"blank")+" preserves content rubric and points setting",()=>{
   const p=harness({select:{kind},values:{examPoints:points,answer:kind==="en"?"Mind wandering can help creativity.":"要約の内容。"}}).prompt;
   assert(p.includes(b3)&&p.includes(c4)&&p.includes(severe));
   assert(p.includes(formula));
   if(points===""||points==="0"){
    assert(p.includes("【得点なし添削：最優先指示】"));
    assert(p.includes("最終得点は一切表示しない"));
   }else{
    assert(p.includes("配点："+points+"点満点"));
    assert(!p.includes("【得点なし添削：最優先指示】"));
   }
  });
 }
}

// 31–38: four length-rule modes with each language.
for(const kind of ["ja","en"]){
 for(const wordmode of ["none","within","approx","range"]){
  test("Length rule "+kind+" / "+wordmode+" preserves meaning criteria and length rule",()=>{
   const p=harness({select:{kind,wordmode},values:{answer:kind==="en"?"Concentration can help.":"要約の内容。"}}).prompt;
   assert(p.includes(b3)&&p.includes(c4)&&p.includes(content25)&&p.includes(content50));
   if(wordmode==="none")assert(p.includes("数値減点Wは0点"));
   else assert(p.includes("一律－15点"));
   if(wordmode==="within")assert(p.includes("下限は設けず"));
   if(wordmode==="range")assert(p.includes("範囲指定は上下限厳守"));
   if(wordmode==="approx")assert(p.includes("程度」の許容は基本±10％"));
  });
 }
}

// 39–46: all four output formats in both languages.
for(const kind of ["ja","en"]){
 for(const outputFormat of ["screen","word","pdf","both"]){
  test("Output "+kind+" / "+outputFormat+" changes delivery but not content rubric",()=>{
   const p=harness({select:{kind,outputFormat},values:{answer:kind==="en"?"Creativity benefits.":"要約の内容。"}}).prompt;
   assert(p.includes(b3)&&p.includes(c4)&&p.includes(formula));
   if(outputFormat==="screen")assert(!p.includes("【添削結果の出力形式：最優先指示】"));
   else{
    assert(p.includes("【添削結果の出力形式：最優先指示】"));
    assert(p.includes("JIS B5（182×257 mm）"));
   }
  });
 }
}

// 47–48: quotation toggle must not override content meaning requirements.
for(const enabled of [false,true]){
 test("Quotation checkbox "+(enabled?"enabled":"disabled")+" retains independent rubric",()=>{
  const p=harness({select:{kind:"en"},checked:{paraphrase:enabled},values:{answer:"Mind wandering helps with creativity."}}).prompt;
  assert(p.includes(b3)&&p.includes(c4));
  if(enabled)assert(p.includes("言い換え指示チェックあり"));
  else assert(p.includes("言い換え指示チェックなし"));
 });
}

// 49–52: photo/PDF flags are independent of new grading policy.
for(const problemFile of [false,true]){
 for(const answerFile of [false,true]){
  test("Attachment flags "+problemFile+"/"+answerFile+" retain content policy",()=>{
   const p=harness({checked:{problemFile,answerFile}}).prompt;
   assert(p.includes(b3)&&p.includes(c4)&&p.includes(formula));
   assert(p.includes("【問題文・資料の写真・PDF添付】\n"+(problemFile?"あり":"なし")));
   assert(p.includes("【答案の写真・PDF添付】\n"+(answerFile?"あり":"なし")));
  });
 }
}

// 53–57: original numeric overlap examples remain mathematically coherent.
for(const [name,M,L,P,D,C,score] of [
 ["A1",40,18,20,11,31,9],
 ["A2",40,20,20,0,20,20],
 ["A3",40,25,10,3,28,12],
 ["A4",40,30,20,15,40,0],
 ["A5",10,2,5,4,9,1]
]){
 test("Overlap formula example "+name+" is numerically correct and documented",()=>{
  const v=Math.min(M,Math.max(L,P)+D);
  assert.equal(v,C);
  assert.equal(Math.max(0,M-v),score);
  assert(harness().prompt.includes(formula));
 });
}

// 58–60: safety and presentation control.
test("Audit prompts are derived from the unchanged primary 2025 passage",()=>{
 assert(passage.includes("Mind wandering can be deleterious"));
 assert(passage.includes("perhaps misconceived"));
 assert(passage.includes("fatal collision"));
});
test("No new HTML grading knobs or mandatory inputs were added",()=>{
 assert(!html.includes('id="b3Penalty"'));
 assert(!html.includes('id="c4Penalty"'));
 const input=harness();
 assert(input.prompt.includes("【要約答案（テキスト・JSON文字列）】"));
});
test("Current app continues to instruct no public-solution searches by default",()=>{
 assert(harness().prompt.includes("公開解答例の検索・紹介は希望されていないため実施しない"));
});
