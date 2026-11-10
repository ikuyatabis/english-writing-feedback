"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {buildBundle}=require("./sum-eval-bundle.cjs");
const {parseCsv,summarize,renderMarkdown,reportBundle}=require("./sum-eval-report.cjs");

function withBundle(f){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"yorinuki-stats-"));
 try{
  buildBundle(tmp);
  const key=JSON.parse(fs.readFileSync(path.join(tmp,"private-key.json"),"utf8"));
  return f(tmp,key);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
function filledRows(key,scoreFor){
 const h="filename,attempt,model,session_id,L,P,D,C,W,score,reason";
 const lines=[h];
 for(let i=0;i<key.cases.length;i++){
  const file=key.cases[i].filename;
  for(let attempt=1;attempt<=3;attempt++){
   const {L=0,P=0,D=0}=scoreFor(i,attempt);
   const C=Math.min(40,Math.max(L,P)+D);
   const score=Math.max(0,40-C);
   lines.push([file,attempt,"gpt-6","session-"+i+"-"+attempt,L,P,D,C,0,score,'"This summary includes a causal claim, and could change grading."'].join(","));
  }
 }
 return lines.join("\n")+"\n";
}
test("CSV supports UTF-8 BOM, quotes with comma and embedded line breaks",()=>{
 const input='\uFEFFfilename,attempt,model,session_id,L,P,D,C,W,score,reason\r\ncase_01.txt,1,gpt-6,abc,0,10,0,10,0,30,"This is a ""quoted"" reason, with\r\nnew line"\r\n';
 const parsed=parseCsv(input);
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].length,11);
 assert.equal(parsed[1].length,11);
 assert.equal(parsed[1][10],'This is a "quoted" reason, with\r\nnew line');
 assert.throws(()=>parseCsv('x,y\n1,"unclosed'),/unterminated quote/);
});

test("Blank 30-row template stays explicitly INCOMPLETE, with no measured agreement",()=>{
 withBundle((tmp,key)=>{
  const text=fs.readFileSync(path.join(tmp,"results-template.csv"),"utf8");
  const r=summarize(text,key);
  assert.equal(r.completed_trials,0);
  assert.equal(r.status,"INCOMPLETE: 0/30 recorded");
  assert.equal(r.all_penalty_agreement,null);
  assert.equal(r.all_score_agreement,null);
  assert(r.cases.every(c=>c.completed===0&&c.content_penalty_agreement===null));
  const output=reportBundle(tmp);
  assert.equal(output.completed_trials,0);
  const md=fs.readFileSync(path.join(tmp,"analysis.md"),"utf8");
  assert(md.includes("INCOMPLETE: 0/30 recorded"));
  assert(!md.includes("30/30 recorded"));
 });
});

test("Synthetic completed observations distinguish stable and unstable penalty decisions",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,(i)=>({L:0,P:i%3===0?10:i%3===1?20:0,D:0}));
  const r=summarize(csv,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.all_penalty_agreement,true);
  assert.equal(r.all_score_agreement,true);
  assert.equal(r.models.length,1);
  assert(r.comparisons.every(c=>c.complete));
  const all=csv.split("\n");
  const target=key.cases[0].filename+",2,";
  const found=all.findIndex(row=>row.startsWith(target));
  assert(found>0);
  const parts=parseCsv(all[found]+"\n")[0];
  parts[5]="0";parts[7]="0";parts[9]="40"; // Switch P=10 to P=0 on one run
  all[found]=parts.slice(0,10).join(",")+',"Reason changed for a synthetic trial"';
  const wobble=summarize(all.join("\n"),key);
  assert.equal(wobble.completed_trials,30);
  assert.equal(wobble.all_penalty_agreement,false);
  assert.equal(wobble.all_score_agreement,false);
  assert(wobble.cases.some(c=>c.content_penalty_agreement===false));
  assert(renderMarkdown(wobble).includes("不一致"));
 });
});

test("Partial row cannot masquerade as zero or a completed trial",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,()=>({P:10}));
  const rows=csv.split("\n");
  const cells=parseCsv(rows[1]+"\n")[0];
  cells[9]="";
  rows[1]=cells.slice(0,10).join(",")+',"Not scored"';
  const r=summarize(rows.join("\n"),key);
  assert.equal(r.completed_trials,29);
  assert.equal(r.status,"INCOMPLETE: 29/30 recorded");
  assert.equal(r.all_penalty_agreement,null);
  assert.equal(r.incomplete_rows.length,1);
 });
});

test("Reject wrong content arithmetic, forbidden penalties and duplicate sessions",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,()=>({L:4,P:10,D:1}));
  const lines=csv.trimEnd().split("\n");
  const update=(column,value)=>{
   const rows=[...lines],parts=parseCsv(rows[1]+"\n")[0];
   parts[column]=value;
   rows[1]=parts.slice(0,10).join(",")+',"Synthetic test"';
   return rows.join("\n")+"\n";
  };
  assert.throws(()=>summarize(update(7,"15"),key),/disagrees with max\(L,P\)\+D/);
  assert.throws(()=>summarize(update(9,"10"),key),/disagrees with 40-C-W/);
  assert.throws(()=>summarize(update(5,"5"),key),/P must be 0, 10 or 20/);
  assert.throws(()=>summarize(update(8,"15"),key),/W must be 0/);
  assert.throws(()=>summarize(update(4,"-2"),key),/nonnegative number/);
  const duplicate=update(3,"session-0-2");
  assert.throws(()=>summarize(duplicate,key),/Repeated session_id/);
  const missing=lines.slice(0,-1).join("\n")+"\n";
  assert.throws(()=>summarize(missing,key),/exactly 3 rows/);
 });
});

test("Optional L/P/D remain UNKNOWN without erasing actual grading results",()=>{
 withBundle((tmp,key)=>{
  const rows=filledRows(key,()=>({L:0,P:0,D:0})).trimEnd().split("\n");
  for(let i=1;i<rows.length;i++){
   const fields=parseCsv(rows[i]+"\n")[0];
   fields[4]="";fields[5]="";fields[6]="";
   rows[i]=fields.slice(0,10).join(",")+',"An actual answer might not spell out every content component"';
  }
  const data=rows.join("\n")+"\n";
  const result=summarize(data,key);
  assert.equal(result.completed_trials,30);
  assert.equal(result.all_score_agreement,true);
  assert.equal(result.all_penalty_agreement,null);
  assert(result.cases.every(x=>x.penalty_observations===0));
  assert(result.cases.every(x=>x.arithmetic_verified_trials===0));
  assert(result.cases.every(x=>x.content_penalty_agreement===null));
  const md=renderMarkdown(result);
  assert(md.includes("Pが不明の試行"));
  assert(md.includes("？"));
  assert(!md.includes("P一致 | 不一致"));
 });
});

test("Explicit P can be analyzed while L/D are unknown, without inventing missing values",()=>{
 withBundle((tmp,key)=>{
  const rows=filledRows(key,()=>({P:10})).trimEnd().split("\n");
  for(let i=1;i<rows.length;i++){
   const fields=parseCsv(rows[i]+"\n")[0];
   fields[4]="";fields[6]="";
   rows[i]=fields.slice(0,10).join(",")+',"Case scored, but original points were not itemized"';
  }
  const report=summarize(rows.join("\n")+"\n",key);
  assert.equal(report.completed_trials,30);
  assert.equal(report.all_penalty_agreement,true);
  assert.equal(report.all_score_agreement,true);
  assert(report.cases.every(x=>x.penalty_observations===3));
  assert(report.cases.every(x=>x.arithmetic_verified_trials===0));
  // P and C contradict each other, even if L and D are missing.
  const bad=[...rows],cells=parseCsv(bad[1]+"\n")[0];
  cells[7]="5";cells[9]="35";
  bad[1]=cells.slice(0,10).join(",")+',"Inconsistent partial subtotal"';
  assert.throws(()=>summarize(bad.join("\n")+"\n",key),/C cannot be less than reported P/);
 });
});

function approvedCaseFile(key,id){
 const info=key.cases.find(c=>c.original_case===id);
 assert(info,"Approved case absent: "+id);
 return info.filename;
}
function editRecordedTrial(csv,file,attempt,updates){
 const rows=csv.trimEnd().split("\n");
 const pos=rows.findIndex(row=>row.startsWith(file+","+attempt+","));
 assert(pos>0,"Trial not found: "+file+" / "+attempt);
 const cells=parseCsv(rows[pos]+"\n")[0];
 for(const [index,value] of Object.entries(updates))cells[Number(index)]=String(value);
 rows[pos]=cells.slice(0,10).join(",")+',"Synthetic test data, not a real ChatGPT evaluation"';
 return rows.join("\n")+"\n";
}

test("Approved references include B3/C2/C4 and do not invent outcomes for seven other cases",()=>{
 withBundle((tmp,key)=>{
  const r=summarize(fs.readFileSync(path.join(tmp,"results-template.csv"),"utf8"),key);
  assert.deepEqual(r.approved_reference.cases,["B3","C2","C4"]);
  assert.equal(r.approved_reference.status,"UNVERIFIED");
  assert.equal(r.approved_reference.expected_trials,9);
  assert.equal(r.approved_reference.observed_trials,0);
  assert.equal(r.approved_reference.matching_trials,0);
  assert.equal(r.approved_reference.mismatching_trials,0);
  assert.equal(r.cases.find(c=>c.case_id==="C2").approved_expected_P,0);
  assert.equal(r.cases.find(c=>c.case_id==="C2").approved_expected_score,40);
  assert(r.cases.filter(c=>["B3","C4"].includes(c.case_id)).every(c=>c.approved_expected_P===10));
  assert(r.cases.filter(c=>c.approved_expected_P===null).every(c=>c.approved_status===null));
  assert(renderMarkdown(r).includes("P記録0/9件"));
 });
});

test("Three identical erroneous P=0 deductions fail the approved-reference check",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,()=>({P:0}));
  const r=summarize(csv,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.all_score_agreement,true);
  assert.equal(r.all_penalty_agreement,true);
  assert.equal(r.approved_reference.status,"MISMATCH");
  assert.equal(r.approved_reference.mismatching_trials,6);
  assert.equal(r.approved_reference.matching_trials,3);
  assert.equal(r.cases.find(c=>c.case_id==="C2").approved_status,"MATCH");
  for(const id of ["B3","C4"]){
   const c=r.cases.find(x=>x.case_id===id);
   assert.equal(c.content_penalty_agreement,true);
   assert.equal(c.approved_status,"MISMATCH");
   assert.equal(c.approved_matching_P,0);
   assert.equal(c.approved_observed_P,3);
  }
  assert(renderMarkdown(r).includes("不適合(P 0/3"));
 });
});

test("Only B3 and C4 with P=10 satisfy approved 25-percent deductions",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,i=>({
    P:["B3","C4"].includes(key.cases[i].original_case)?10:0
  }));
  const r=summarize(csv,key);
  assert.equal(r.approved_reference.status,"MATCH");
  assert.equal(r.approved_reference.observed_trials,9);
  assert.equal(r.approved_reference.matching_trials,9);
  assert.equal(r.approved_reference.mismatching_trials,0);
  assert.equal(r.all_penalty_agreement,true);
  assert.equal(r.all_score_agreement,true);
  for(const id of ["B3","C4"]){
   const c=r.cases.find(x=>x.case_id===id);
   assert.equal(c.approved_status,"MATCH");
   assert.deepEqual(c.observed_scores,[30,30,30]);
  }
  assert.equal(r.cases.find(x=>x.case_id==="C2").approved_status,"MATCH");
  assert.deepEqual(r.cases.find(x=>x.case_id==="C2").observed_scores,[40,40,40]);
  assert(renderMarkdown(r).includes("適合(3/3)"));
 });
});

test("A missing P for an approved case remains unverified, not a hidden zero",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,i=>({
    P:["B3","C4"].includes(key.cases[i].original_case)?10:0
  }));
  const file=approvedCaseFile(key,"B3");
  // Absence of P is not a positive or negative approved-reference observation.
  const partial=editRecordedTrial(csv,file,1,{4:"",5:"",6:""});
  const r=summarize(partial,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.approved_reference.status,"UNVERIFIED");
  assert.equal(r.approved_reference.observed_trials,8);
  assert.equal(r.approved_reference.matching_trials,8);
  assert.equal(r.approved_reference.mismatching_trials,0);
  const c=r.cases.find(x=>x.case_id==="B3");
  assert.equal(c.approved_status,"UNVERIFIED");
  assert.equal(c.approved_observed_P,2);
  assert.equal(c.content_penalty_agreement,null);
 });
});

test("One bad C4 penalty fails against approved rule despite five correct observations",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,i=>({
    P:["B3","C4"].includes(key.cases[i].original_case)?10:0
  }));
  const file=approvedCaseFile(key,"C4");
  const bad=editRecordedTrial(csv,file,3,{5:"0",7:"0",9:"40"});
  const r=summarize(bad,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.approved_reference.status,"MISMATCH");
  assert.equal(r.approved_reference.matching_trials,8);
  assert.equal(r.approved_reference.mismatching_trials,1);
  assert.equal(r.cases.find(x=>x.case_id==="C4").approved_status,"MISMATCH");
 });
});

test("C2: 3 repeated deductions of 25% disagree with user-approved no-deduction decision",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,i=>({P:
   key.cases[i].original_case==="C2"?10:
   ["B3","C4"].includes(key.cases[i].original_case)?10:0
  }));
  const r=summarize(csv,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.all_penalty_agreement,true);
  assert.equal(r.all_score_agreement,true);
  assert.equal(r.approved_reference.mismatching_trials,3);
  assert.equal(r.approved_reference.matching_trials,6);
  assert.equal(r.approved_reference.status,"MISMATCH");
  const c=r.cases.find(x=>x.case_id==="C2");
  assert.equal(c.approved_expected_P,0);
  assert.equal(c.approved_expected_score,40);
  assert.equal(c.approved_observed_P,3);
  assert.equal(c.approved_matching_P,0);
  assert.equal(c.approved_matching_score,0);
  assert.equal(c.approved_status,"MISMATCH");
  assert.deepEqual(c.observed_scores,[30,30,30]);
 });
});

test("C2: P=0 still fails if 40-point score is not awarded",()=>{
 withBundle((tmp,key)=>{
  const csv=filledRows(key,i=>({P:["B3","C4"].includes(key.cases[i].original_case)?10:0}));
  const file=approvedCaseFile(key,"C2");
  // A hypothetical separate 10-point deduction, not a real observed grading result.
  const bad=editRecordedTrial(csv,file,2,{4:"0",5:"0",6:"10",7:"10",9:"30"});
  const r=summarize(bad,key);
  assert.equal(r.completed_trials,30);
  assert.equal(r.approved_reference.mismatching_trials,0);
  assert.equal(r.approved_reference.matching_trials,9);
  assert.equal(r.approved_reference.status,"MISMATCH");
  const c=r.cases.find(x=>x.case_id==="C2");
  assert.equal(c.approved_matching_P,3);
  assert.equal(c.approved_matching_score,2);
  assert.equal(c.approved_status,"MISMATCH");
  assert(renderMarkdown(r).includes("得点 2/3"));
 });
});
