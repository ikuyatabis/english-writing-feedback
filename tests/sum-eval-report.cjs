"use strict";
// Coordinator-only evaluator for blinded より抜き図書館 grading results.
// Does NOT call any language model or claim any trials were run.
const fs=require("node:fs"),path=require("node:path");
const APPROVED=JSON.parse(fs.readFileSync(path.join(__dirname,"yorinuki-approved-decisions.json"),"utf8")).expected_P;
const HEADER=["filename","attempt","model","session_id","L","P","D","C","W","score","reason"];
const fmt=n=>Number.isInteger(n)?String(n):String(Number(n.toFixed(2)));
const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;

function parseCsv(text){
 const rows=[];let row=[],cell="",quoted=false;
 const t=text.replace(/^\uFEFF/,"");
 for(let i=0;i<t.length;i++){
  const ch=t[i];
  if(quoted){
   if(ch==='"'){
    if(t[i+1]==='"'){cell+='"';i++;}else quoted=false;
   }else cell+=ch;
  }else if(ch==='"'){
   if(cell!=="")throw Error("Malformed CSV: quote inside unquoted value");
   quoted=true;
  }else if(ch===","){row.push(cell);cell="";}
  else if(ch==="\n"){
   row.push(cell);rows.push(row);row=[];cell="";
  }else if(ch==="\r"){
   if(t[i+1]!=="\n")throw Error("Malformed CSV: CR without LF");
  }else cell+=ch;
 }
 if(quoted)throw Error("Malformed CSV: unterminated quote");
 if(row.length||cell!==""){row.push(cell);rows.push(row);}
 return rows;
}
function loadInput(csvText,key){
 if(!key||!Array.isArray(key.cases)||key.cases.length!==10)throw Error("Expected ten coordinator case mappings");
 const matrix=parseCsv(csvText);
 if(!matrix.length||matrix[0].join("|")!==HEADER.join("|"))throw Error("CSV header differs from template");
 const known=new Map(key.cases.map(x=>[x.filename,x]));
 if(known.size!==10)throw Error("Duplicate or invalid coordinator mappings");
 const expected=new Set();
 for(const file of known.keys())for(let attempt=1;attempt<=3;attempt++)expected.add(file+"#"+attempt);
 const seen=new Set(),records=[];
 for(const [n,cells] of matrix.slice(1).entries()){
  const rowNum=n+2;
  if(cells.length!==HEADER.length)throw Error("CSV row "+rowNum+" has "+cells.length+" columns, expected "+HEADER.length);
  const o=Object.fromEntries(HEADER.map((h,i)=>[h,cells[i]]));
  const key=o.filename+"#"+o.attempt;
  if(!expected.has(key))throw Error("CSV row "+rowNum+" has unknown filename or attempt: "+key);
  if(seen.has(key))throw Error("Duplicate CSV row: "+key);
  seen.add(key);
  const fields=["model","session_id","L","P","D","C","W","score","reason"];
  const required=["model","session_id","C","W","score","reason"];
  const filled=fields.filter(x=>o[x].trim()!=="").length;
  if(filled===0){records.push({...o,completed:false});continue;}
  const absent=required.filter(x=>o[x].trim()==="");
  if(absent.length){
   records.push({...o,completed:false,incompleteReason:"Missing required observations: "+absent.join(", ")});
   continue;
  }
  if(o.model.length>120||o.session_id.length>120)throw Error("CSV row "+rowNum+": excessively long model/session identifier");
  const numeric={};
  for(const name of ["L","P","D","C","W","score"]){
   if(["L","P","D"].includes(name)&&o[name].trim()===""){numeric[name]=null;continue;}
   if(!/^\d+(?:\.\d{1,2})?$/.test(o[name].trim()))throw Error("CSV row "+rowNum+": "+name+" must be a nonnegative number with at most 2 decimals");
   numeric[name]=Number(o[name]);
   if(numeric[name]>40)throw Error("CSV row "+rowNum+": "+name+" cannot exceed M=40");
  }
  Object.assign(o,numeric);
  if(o.P!==null&&![0,10,20].includes(o.P))throw Error("CSV row "+rowNum+": P must be 0, 10 or 20 for M=40");
  if(o.W!==0)throw Error("CSV row "+rowNum+": these 10 controlled summaries all satisfy 120 characters, so W must be 0");
  for(const component of ["L","P","D"]){
   if(o[component]!==null&&o.C+0.005<o[component]){
    throw Error("CSV row "+rowNum+": C cannot be less than reported "+component+"="+o[component]);
   }
  }
  const arithmeticVerified=[o.L,o.P,o.D].every(x=>x!==null);
  if(arithmeticVerified){
   const contentLoss=Math.min(40,Math.max(o.L,o.P)+o.D);
   if(Math.abs(o.C-contentLoss)>0.005)throw Error("CSV row "+rowNum+": C="+o.C+" disagrees with max(L,P)+D="+fmt(contentLoss));
  }
  const score=Math.max(0,40-o.C-o.W);
  if(Math.abs(o.score-score)>0.005)throw Error("CSV row "+rowNum+": score="+o.score+" disagrees with 40-C-W="+fmt(score));
  records.push({...o,completed:true,arithmetic_verified:arithmeticVerified,
   original_case:known.get(o.filename).original_case});
 }
 if(seen.size!==expected.size)throw Error("CSV must contain exactly 3 rows for each of 10 files; found "+seen.size+" of "+expected.size);
 const sessionIds=new Set();
 for(const o of records.filter(x=>x.completed)){
  if(sessionIds.has(o.session_id))throw Error("Repeated session_id "+o.session_id+". Independent conversations need distinct identifiers");
  sessionIds.add(o.session_id);
 }
 return records;
}

function summarize(csv,key){
 const rows=loadInput(csv,key);
 const complete=rows.filter(r=>r.completed);
 const byFile=new Map(key.cases.map(x=>[x.filename,x]));
 const cases=key.cases.map(info=>{
  const v=complete.filter(x=>x.filename===info.filename);
  const scores=v.map(x=>x.score),penalties=v.map(x=>x.P);
  const knownP=penalties.filter(x=>x!==null);
  return {
   case_id:info.original_case,file:info.filename,completed:v.length,penalty_observations:knownP.length,
   arithmetic_verified_trials:v.filter(x=>x.arithmetic_verified).length,
   average_score:mean(scores),range_score:scores.length?[Math.min(...scores),Math.max(...scores)]:null,
   observed_scores:scores,observed_P:penalties,
   exact_score_agreement:v.length===3?new Set(scores).size===1:null,
   content_penalty_agreement:v.length===3&&knownP.length===3?new Set(knownP).size===1:null,
   approved_expected_P:APPROVED[info.original_case]?.value??null,
   approved_observed_P:APPROVED[info.original_case]?knownP.length:null,
   approved_matching_P:APPROVED[info.original_case]?knownP.filter(p=>p===APPROVED[info.original_case].value).length:null,
   approved_status:!APPROVED[info.original_case]?null:
    knownP.some(p=>p!==APPROVED[info.original_case].value)?"MISMATCH":
    knownP.length===3?"MATCH":"UNVERIFIED"
  };
 });
 const entries=new Map(cases.map(x=>[x.case_id,x]));
 const comparisons=[["B2","C4"],["C2","B3"],["B3","C3"],["B4","C3"],["B5","B6"]].map(([a,b])=>{
  const x=entries.get(a),y=entries.get(b);
  return {pair:a+" vs "+b,complete:x?.completed===3&&y?.completed===3,
   mean_score_difference:x?.completed===3&&y?.completed===3?Number((x.average_score-y.average_score).toFixed(2)):null};
 });
 const models=[...new Set(complete.map(x=>x.model))];
 return {
  status:complete.length===30?"30/30 recorded":"INCOMPLETE: "+complete.length+"/30 recorded",
  completed_trials:complete.length,expected_trials:30,models,
  incomplete_rows:rows.filter(x=>!x.completed&&x.incompleteReason).map(x=>({file:x.filename,attempt:x.attempt,issue:x.incompleteReason})),
  cases,comparisons,
  approved_reference:{
   cases:Object.keys(APPROVED),
   expected_trials:3*Object.keys(APPROVED).length,
   observed_trials:cases.reduce((n,c)=>n+(c.approved_observed_P??0),0),
   matching_trials:cases.reduce((n,c)=>n+(c.approved_matching_P??0),0),
   mismatching_trials:cases.reduce((n,c)=>n+(c.approved_observed_P??0)-(c.approved_matching_P??0),0),
   status:cases.some(c=>c.approved_status==="MISMATCH")?"MISMATCH":
    cases.filter(c=>c.approved_expected_P!==null).every(c=>c.approved_status==="MATCH")?"MATCH":"UNVERIFIED"
  },
  all_penalty_agreement:complete.length===30&&cases.every(x=>x.penalty_observations===3)?cases.every(x=>x.content_penalty_agreement):null,
  all_score_agreement:complete.length===30?cases.every(x=>x.exact_score_agreement):null,
  warning:"Consistency is NOT correctness: three identical P=0 judgments for B3/C4 contradict the approved P=10 even though they agree with one another. An omitted P is UNKNOWN, not zero. C/W arithmetic is checked even when L/P/D are unknown. Independent model sessions cannot be verified from CSV; model/session IDs are self-reported. No model calls were made by this analyzer."
 };
}

function renderMarkdown(result){
 const f=x=>x===null?"—":fmt(x);
 const lines=[
 "# より抜き図書館｜独立採点結果の集計",
 "",
 "**記録状況："+result.status+"**",
 "",
 "この報告はCSVに記録された試行だけを集計します。空欄は０点と見なさず，独立セッションを実行したとも主張しません。",
 "",
 "| 条件 | 採点記録 | Pの記録 | 平均点 | 点数範囲 | 減点P（不明は？） | 点数一致 | P一致 | 確定判定への適合 |",
 "|---|---:|---:|---:|---|---|---|---|---|"
 ];
 for(const c of result.cases){
  const range=c.range_score?c.range_score.map(f).join("～"):"—";
  lines.push("| "+c.case_id+" ("+c.file+") | "+c.completed+"/3 | "+c.penalty_observations+"/3 | "+f(c.average_score)+" | "+range+" | "+
   (c.observed_P.length?c.observed_P.map(x=>x===null?"？":f(x)).join("，"):"—")+" | "+
   (c.exact_score_agreement===null?"未判定":c.exact_score_agreement?"一致":"不一致")+" | "+
   (c.content_penalty_agreement===null?"未判定":c.content_penalty_agreement?"一致":"不一致")+" | "+
   (c.approved_status===null?"対象外":c.approved_status==="UNVERIFIED"?"未検証("+c.approved_matching_P+"/"+c.approved_observed_P+"件が既知Pに一致)":c.approved_status==="MISMATCH"?"不適合("+c.approved_matching_P+"/"+c.approved_observed_P+"件一致)":"適合(3/3)")+" |");
 }
 lines.push("","**B3・C4の確定判定との照合：** "+result.approved_reference.status+
 "（P記録"+result.approved_reference.observed_trials+"/"+result.approved_reference.expected_trials+
 "件，適合"+result.approved_reference.matching_trials+"件，不適合"+result.approved_reference.mismatching_trials+"件）",
 "","この照合はユーザーが確定したB3・C4のP=10だけに適用し，他の８答案の正解を断定しません。３回とも同じ誤判定の場合も「不適合」とします。","",
 "## 対比する組み合わせ","","| 比較 | 状況 | ３回ずつの平均点差（前者－後者） |","|---|---|---:|");
 for(const c of result.comparisons)lines.push("| "+c.pair+" | "+(c.complete?"比較可能":"未完了")+" | "+f(c.mean_score_difference)+" |");
 if(result.incomplete_rows.length)lines.push("","**入力が途中の行：** "+result.incomplete_rows.map(x=>x.file+" #"+x.attempt+" ("+x.issue+")").join("，"));
 if(result.models.length>1)lines.push("","**注意：複数のモデル名が混在しています。モデル内の反復とモデル間比較を混同しないでください。**");
 lines.push("","**注意：**"+result.warning,"",
 "Pが不明の試行があれば，その答案のP一致は未判定です。記録不足を減点不適用（P=0）と混同しないでください。","",
 "この集計は実測データがない場合に採点の一貫性を証明しません。３回とも同じ結果でも，未知の答案で再現する保証はありません。");
 return lines.join("\n")+"\n";
}

function reportBundle(dir){
 const key=JSON.parse(fs.readFileSync(path.join(dir,"private-key.json"),"utf8"));
 const csv=fs.readFileSync(path.join(dir,"results-template.csv"),"utf8");
 const result=summarize(csv,key);
 fs.writeFileSync(path.join(dir,"analysis.json"),JSON.stringify(result,null,2)+"\n");
 fs.writeFileSync(path.join(dir,"analysis.md"),renderMarkdown(result));
 return result;
}

if(require.main===module){
 try{
  if(!process.argv[2])throw Error("Usage: node tests/sum-eval-report.cjs PATH_TO_COORDINATOR_DIR");
  const r=reportBundle(path.resolve(process.argv[2]));
  process.stdout.write("Report created: "+r.status+". Results are NOT automatically verified as independent sessions.\n");
 }catch(e){process.stderr.write("Analysis failed: "+e.message+"\n");process.exitCode=1;}
}
module.exports={parseCsv,loadInput,summarize,renderMarkdown,reportBundle};
