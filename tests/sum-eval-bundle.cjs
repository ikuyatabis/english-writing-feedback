"use strict";
// Deterministic grading-input generator for より抜き図書館.
// This does NOT make model requests: each prompt comes from actual makePrompt().
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const sha=s=>crypto.createHash("sha256").update(s,"utf8").digest("hex");
const countJa=s=>Array.from(s.normalize("NFC")).filter(c=>!/\s/u.test(c)).length;

function loadCases(){
 const md=fs.readFileSync(path.join(__dirname,"yorinuki-content-boundary-cases.md"),"utf8");
 const base=md.match(/^> (.+)$/m)?.[1];if(!base)throw Error("Missing baseline summary");
 const rows=[...md.matchAll(/^\|\s*([BC][1-6])\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/gm)];
 if(rows.length!==10)throw Error("Expected 10 test summaries, found "+rows.length);
 const cases=rows.map(([,id,part,n])=>{
  const answer=base+part.trim(),chars=countJa(answer);
  if(chars!==Number(n)||chars>120)throw Error(id+": invalid character count");
  return {id,answer,chars};
 });
 if(new Set(cases.map(c=>c.id)).size!==10)throw Error("Duplicate IDs");
 return cases;
}

function loadPassage(){
 const src=fs.readFileSync(path.join(root,"buncan","index.html"),"utf8");
 const match=src.match(/"id":\s*"2025_文"[\s\S]*?"passage":\s*("(?:\\.|[^"\\])*")/);
 if(!match)throw Error("Source passage not found");
 const passage=JSON.parse(match[1]);
 for(const part of ["Mind wandering can be deleterious","fatal collision","creativity and problem solving"]){
  if(!passage.includes(part))throw Error("Source passage verification failed: "+part);
 }
 return passage;
}

function buildPrompt(passage,answer){
 const html=fs.readFileSync(path.join(root,"sum","index.html"),"utf8");
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 if(!script)throw Error("App JavaScript not found");
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const elements=Object.fromEntries(ids.map(id=>[id,{
  value:"",checked:false,hidden:false,textContent:"",validity:{badInput:false},addEventListener(){}
 }]));
 const values={
  examPoints:"40",approxWords:"100",minWords:"80",maxWords:"120",withinWords:"120",
  problem:"次の英文を日本語120字以内で要約してください。\n\n"+passage,answer
 };
 for(const [k,v] of Object.entries(values)){
  if(!elements[k])throw Error("Input missing: "+k);
  elements[k].value=v;
 }
 const selections={kind:"ja",wordmode:"within",outputFormat:"screen"};
 const doc={
  getElementById(id){if(!elements[id])throw Error("Missing element: "+id);return elements[id];},
  querySelector(q){
   for(const [k,v] of Object.entries(selections)){
    if(q==='input[name="'+k+'"]:checked')return {value:v};
   }
   throw Error("Unexpected querySelector: "+q);
  },
  querySelectorAll(q){return q===".word-unit"?Array.from({length:8},()=>({textContent:""})):[];}
 };
 const ctx=vm.createContext({document:doc,navigator:{},window:{}});
 vm.runInContext(script,ctx,{timeout:5000});
 const prompt=vm.runInContext("makePrompt()",ctx,{timeout:5000});
 for(const part of ["配点：40点満点","字数指定：120字以内","【要約答案（テキスト・JSON文字列）】","【英文本文・設問指示（テキスト・JSON文字列）】","上限を超えたら超過量によらず一律－15点"]){
  if(!prompt.includes(part))throw Error("App prompt diverged: "+part);
 }
 if(!prompt.includes(JSON.stringify(answer))||!prompt.includes(JSON.stringify(values.problem))){
  throw Error("Source or answer not preserved in app prompt");
 }
 return prompt;
}

function buildBundle(outDir){
 const passage=loadPassage(),cases=loadCases();
 cases.sort((a,b)=>sha("yorinuki-blind-v1:"+a.id).localeCompare(sha("yorinuki-blind-v1:"+b.id)));
 const dir=path.join(outDir,"prompts");fs.mkdirSync(dir,{recursive:true});
 const records=cases.map((c,i)=>{
  const filename="case_"+String(i+1).padStart(2,"0")+".txt";
  const prompt=buildPrompt(passage,c.answer);
  fs.writeFileSync(path.join(dir,filename),prompt+"\n","utf8");
  return {filename,original_case:c.id,characters:c.chars,sha256:sha(prompt)};
 });
 fs.writeFileSync(path.join(outDir,"private-key.json"),JSON.stringify({
  note:"Do NOT share this key or earlier expected scores with independent evaluators.",
  source_sha256:sha(passage),cases:records
 },null,2)+"\n");
 const rows=["filename,attempt,model,session_id,L,P,D,C,W,score,reason"];
 for(const rec of records)for(let i=1;i<=3;i++)rows.push(rec.filename+","+i+",,,,,,,,,");
 fs.writeFileSync(path.join(outDir,"results-template.csv"),rows.join("\n")+"\n");
 fs.writeFileSync(path.join(outDir,"README.md"),[
  "# より抜き図書館：独立反復採点セット",
  "",
  "10 test prompts. These are actual UI-generated prompts, with no answer keys in each prompt.",
  "",
  "1. Send each file in prompts/ as the whole user message in a fresh ChatGPT session. Repeat each case three times with the same model/settings.",
  "2. Do not send private-key.json, prior review scores or any earlier model output to evaluators.",
  "3. Record the evaluation (L, P, D, C, W, score, and reasons) in results-template.csv.",
  "4. Only after gathering all scores, open private-key.json and compare matched case pairs.",
  "5. All prompts use Japanese summary, 40 points, 120-character maximum, no quotation checkbox and screen output.",
  "6. Prompts are constructed from the real sum/index.html makePrompt() function and the 2025 literature passage from buncan/index.html.",
  "7. This script never calls AI models and therefore does not measure scoring reproducibility by itself.",
  "8. After filling in results-template.csv with ALL 30 independent-session scoring results, run: node tests/sum-eval-report.cjs PATH_TO_COORDINATOR_DIR",
  "9. The analyzer writes analysis.md and analysis.json. Blank rows are NOT treated as zeros or completed evaluations. Invalid score arithmetic is rejected.",
  "10. Model names and session IDs are self-reported and cannot independently prove that a conversation was new. The coordinator alone should retain the private key and results.",
  "",
  "Generate: node tests/sum-eval-bundle.cjs OUTPUT_DIR"
 ].join("\n")+"\n");
 return {records,passageHash:sha(passage)};
}

if(require.main===module){
 if(!process.argv[2]){process.stderr.write("Usage: node tests/sum-eval-bundle.cjs OUTPUT_DIR\n");process.exitCode=2;}
 else{const result=buildBundle(path.resolve(process.argv[2]));process.stdout.write("Generated "+result.records.length+" blind prompts.\n");}
}
module.exports={loadCases,loadPassage,buildPrompt,buildBundle,countJa};
