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
