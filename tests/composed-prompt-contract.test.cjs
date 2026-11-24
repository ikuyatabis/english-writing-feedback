"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {test}=require("node:test");
const root=path.resolve(__dirname,"..");
const pages=["ito","buncan","mita","misc","trans","sum","eiken"];
const modes=["screen","word","pdf","both"];
const formats={word:"Word（.docx）",pdf:"PDF（.pdf）",both:"PDF（.pdf）とWord（.docx）"};
const rules={
 ito:["【対象】","【採点基準（正本）】","【得点と減点表の照合】"],
 buncan:["【機械的に確認済みの事実","形式判定：形式違反","【最終表示の判定について】"],
 mita:["【最優先の判断根拠","【改善例の表示】"],
 misc:["【最終回答の構成：３部構成】","【今回の採点対象】","【変更箇所の強調】"],
 trans:["【初回の添削結果の表示順】","2．参考得点と具体的な減点内訳"],
 sum:["【添削結果の表示順】","【今回の採点条件】"],
 eiken:["【表示順】①形式・語数・設問条件の確認","②参考得点","【今回の条件】"]
};
function extractFn(html,sig){
 const start=html.indexOf(sig);assert(start>=0,"missing function "+sig);
 const open=html.indexOf("{",start+sig.length);assert(open>=0);
 for(let i=html.indexOf("}",open);i>=0;i=html.indexOf("}",i+1)){
  const part=html.slice(start,i+1);
  try{new vm.Script(part);return part}catch(_){}
 }
 assert.fail("cannot isolate "+sig);
}
function actualCommon(html){
 const start=html.indexOf("const COMMON="),end=html.indexOf("function getExportInstruction(){",start);
 assert(start>=0&&end>start);
 return html.slice(start,end);
}
function override(html){
 const start=html.indexOf("const CHATGPT_OUTPUT_OVERRIDE"),tick=String.fromCharCode(96);
 assert(start>=0);const begin=html.indexOf(tick,start),end=html.indexOf(tick+";",begin+1);
 assert(begin>=0&&end>begin);
 return html.slice(start,end+2);
}
function environment(mode,extra={}){
 const defaults={problem:"Explain two sides of social media.",answer:"I think social media is helpful.",topic:"Should we use social media?",
 points:"communication information",source:"A short source passage.",instructions:"Summarize the text.",
 examPoints:"40",examUniversity:"",examYear:"2026",examSession:"",examFaculty:"",examQuestion:"",
 problemFile:false,answerFile:false,includePublicExamples:false,paraphrase:false};
 const values={...defaults,...(extra.values||{})};
 const fields=Object.fromEntries(Object.entries(values).map(([id,v])=>[id,{
  value:typeof v==="boolean"?"":v,checked:typeof v==="boolean"?v:false,validity:{badInput:false}
 }]));
 let copied;
 return {
  document:{querySelector(selector){assert.equal(selector,'input[name="outputFormat"]:checked');return {value:mode}}},
  window:{isSecureContext:true,open(){return null}},
  navigator:{clipboard:{async writeText(v){copied=v}}},
  showHandoffToast(){},showHandoffBox(){},
  async copyItoPrompt(v){copied=v;return true},
  copied(){return copied},
  el(id){assert(fields[id],"unmocked field "+id);return fields[id]},
  selected(id){return (extra.selected||{})[id]||(id==="kind"?"task":"p2")},
  wordRules(){return {mode:"approx",low:100,high:100,freeLow:90,freeHigh:110,exempt:false}},
  kinds:{task:{label:"課題の遂行",full:40}},
  specs:{p2:{name:"2級",essay:[80,100],summary:[45,55]}},
  countWords(t){return t.trim().split(/\s+/).filter(Boolean).length},
  label(k){return k},fullwidthSingleDigit(n){return String(n)},SOURCE_LABEL:{text:"テキスト入力"},
  RANGE:{"2026-4":{full:40}},
  DATA:{common:"九大共通条件",common_rubric:"九大採点原則",
   problem:{"2026-4":"教師の能力を３つ述べる"},
   rubric:{"2026-4":"年度別基準"},instr:{"2026-4":"年度別指示"},
   model:{"2026-4":{words:100,text:"An example.",variants:[]}}},
  ITO_FEEDBACK_QUALITY:"【得点と減点表の照合】",CORE_RULES:"【慶應経済採点規則】"
 };
}
async function fullPrompt(page,html,mode,extra){
 const ctx=environment(mode,extra),legacy=["ito","buncan","mita"].includes(page);
 if(page==="eiken"){const select=ctx.selected;ctx.selected=(id)=>id==="kind"?"essay":select(id)}
 const parts=[extractFn(html,"function getExportInstruction(")];
 if(legacy){
  parts.unshift(override(html));
  parts.push(extractFn(html,"async function handoffToChatGPT("));
  parts.push(extractFn(html,"function buildPrompt("));
  if(page==="buncan")parts.push(extractFn(html,"function buildAnswerRefsText("));
 }else{
  parts.unshift(actualCommon(html));
  parts.push(extractFn(html,page==="eiken"?"function buildPrompt(":"function makePrompt("));
 }
 const context=vm.createContext(ctx);
 vm.runInContext(parts.join("\n"),context,{timeout:3000});
 if(!legacy)return vm.runInContext(page==="eiken"?"buildPrompt()":"makePrompt()",context,{timeout:3000});
 let base;
 if(page==="ito"){
  base=vm.runInContext('buildPrompt("2026-4","A response.",2,"text")',context,{timeout:3000});
 }else if(page==="buncan"){
  const problem={summary_en:"Social media can ...",passage:"Source",translation:"訳",
   summary_ja:"要約",flow:"流れ",key_points:"要点",notes:"注意",
   criteria:{"形式上の条件":"形式規則","十分な答案":"十分","不十分な答案":"不十分","方向のずれた答案":"方向のずれ"},
   answers:[{source:"sample",answer_text:"help students learn.",wordcount:3}]};
  const fmt={overlap:{found:true,typo:false,length:3,phrase:"learn about others"},wordCount:11,wcOk:false,ok:false};
  base=vm.runInContext("buildPrompt",context)(problem,"Learn about others on social media",fmt,false,null);
 }else{
  const problem={year:2026,letter:"A",question:"Write an opinion",notes:["Use source I"],
   cite:"Ⅰ～Ⅳ",passages:{"Ⅰ":{text:"Sample passage"}},ivNote:"本文Ⅳは未収録",
   point:{comparison:"counterargument"}};
  base=vm.runInContext("buildPrompt",context)(problem,"I agree with the author.",false,"","");
 }
 context.__base=base;
 await vm.runInContext("handoffToChatGPT(__base)",context,{timeout:3000});
 const result=ctx.copied();assert.equal(typeof result,"string","no text copied");
 return result;
}
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page,"index.html"),"utf8");
 for(const mode of modes){
  test(page+"/"+mode+": full assembled ChatGPT prompt",async()=>{
   const p=await fullPrompt(page,html,mode);
   assert(p.length>300,"incomplete prompt");
   for(const r of rules[page])assert(p.includes(r),page+" missing original rule "+r);
   if(page==="misc"){
    assert(p.includes("文書の最初の行に，独立した１行で"));
    assert(p.includes("得点行の直後には独立した空行をちょうど１行入れ"));
   }else assert(!p.includes("得点行の直後には独立した空行をちょうど１行入れ"));
   if(mode==="screen"){
    assert(!p.includes("【Word書式：共通仕様】"));return;
   }
   assert(p.includes("【添削結果の出力形式：最優先】"));
   assert(p.includes("指定形式："+formats[mode]));
   assert(p.includes("【Word書式：共通仕様】"));
   if(page==="eiken"){
    assert(p.includes("この添削は学習支援のための参考情報であり、英検協会の公式採点・CSEスコア・合否を保証するものではありません。"));
    assert(p.includes("共通採点指示の表示順⑧の短い注意書きはこの定型文に置き換え"));
    assert(p.includes("この定型文は一字一句変更せず，省略・要約・言い換えを禁止する"));
    assert(p.includes("生成後は指定形式の各ファイルで末尾に全文が１回だけ記載されていることを確認し，不足があれば修正してから提供する"));
   }
   assert(p.includes("アポストロフィ自体の欧文フォント（WordのASCII／hAnsi）をCenturyに直接指定"));
   assert(p.includes("表の見出し行は全列の見出しセルを中央揃え"));
   assert(p.includes("通常文字の色を黒などに直接固定せず「自動」を使う"));
   assert.equal(p.includes("【PDF書式：Wordから変換】"),mode==="pdf"||mode==="both");
   if(page==="misc"){
    assert(p.includes("文書の最初の行に，独立した１行で"));
    assert(p.includes("得点行の直後には独立した空行をちょうど１行入れ"));
    assert(p.includes("未変更箇所は標準書式とし，Word・PDFでは文字色を「自動」とする"));
    assert(p.includes("ＭＳ ゴシック・必要な太字だけを直接指定し，文字色は「自動」とする"));
    assert(!p.includes("未変更箇所は黒・標準"));
    assert(!p.includes("ＭＳ ゴシック・黒・必要な太字"));
    assert(p.includes("修正箇所のみ赤（#FF0000）・太字"));
   }else assert(!p.includes("得点行の直後には独立した空行をちょうど１行入れ"));
  });
 }
}
test("unscored translation and summary preserve their no-score exemption",async()=>{
 const trans=fs.readFileSync(path.join(root,"trans/index.html"),"utf8");
 const sum=fs.readFileSync(path.join(root,"sum/index.html"),"utf8");
 const t=await fullPrompt("trans",trans,"word",{values:{examPoints:""}});
 const s=await fullPrompt("sum",sum,"pdf",{values:{examPoints:"0"},selected:{kind:"en"}});
 assert(t.includes("配点未入力。点数・減点数値は表示せず"));
 assert(s.includes("【得点なし添削：最優先指示】"));
});
test("unavailable passage IV survives Mita's final handoff",async()=>{
 const html=fs.readFileSync(path.join(root,"mita/index.html"),"utf8");
 const p=await fullPrompt("mita",html,"pdf");
 assert(p.includes("【最優先の例外ルール：本文Ⅳが未収録の場合の扱い】"));
 assert(p.includes("【本文Ⅳ未収録時のハードストップ】"));
});