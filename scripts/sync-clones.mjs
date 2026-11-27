// The canonical repository is the sole source of shared content.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const [kind,sourceArg,targetArg]=process.argv.slice(2);
if(!['eiken','hq'].includes(kind)||!sourceArg||!targetArg)throw new Error('Usage: sync-clones.mjs eiken|hq SOURCE TARGET');
const source=resolve(sourceArg), target=resolve(targetArg);
if(source===target)throw new Error('Source and target must differ');
if(kind==='eiken'){
  const html=readFileSync(resolve(source,'eiken/index.html'),'utf8');
  assert.match(html,/<footer><a class="footer-home-link" href="\.\.\/">Shibata Writing Lab｜柴田答案ラボ<\/a><\/footer>/);
  const clone=html.replaceAll('../assets/','./assets/');
  assert.equal(clone.replaceAll('./assets/','../assets/'),html);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(match[1].trim())new vm.Script(match[1]);
  }
  const assets=new Set([...html.matchAll(/\.\.\/assets\/([A-Za-z0-9_./%-]+)/g)].map(m=>m[1]));
  assert(assets.has('shibata-seal.png'));
  for(const name of assets){
    if(name.split('/').some(p=>p==='..'||p==='.'||!p))throw new Error('Invalid asset path: '+name);
    const out=resolve(target,'assets',name);
    mkdirSync(dirname(out),{recursive:true});
    copyFileSync(resolve(source,'assets',name),out);
  }
  writeFileSync(resolve(target,'index.html'),clone);
  assert.equal(readFileSync(resolve(target,'index.html'),'utf8'),clone);
  console.log('Eiken clone verified (only relative asset paths differ).');
}else{
  const {parseClinicSource,parseClinicSnapshot,buildPrompt,contentPenaltyDefaults}=await import(pathToFileURL(resolve(target,'grading-core.mjs')).href);
  const file=resolve(source,'misc/index.html');
  const sourceBlob=execFileSync('git',['-C',source,'hash-object',file],{encoding:'utf8'}).trim();
  const snapshot={schemaVersion:1,sourceBlob,clinic:parseClinicSource(readFileSync(file,'utf8'))};
  const c=parseClinicSnapshot(JSON.parse(JSON.stringify(snapshot)));
  for(const kind of ['opinion','chart','task'])for(const outputMode of ['screen','word','both'])for(const mode of ['text','file']){
    const fields={kind,maxScore:50,invalidAnswerPenalty:50,problemMode:mode,answerMode:mode,problemText:'Discuss the topic.',answerText:'I agree.',word:{mode:'none'},conditions:[{label:'長所の記述',points:25}],contentPenalties:contentPenaltyDefaults(kind,50),outputMode};
    const prompt=buildPrompt(fields,c);
    assert(prompt.includes('今回の満点は50点'));
    assert(prompt.includes('長所の記述'));
    assert(prompt.includes(c.common));
    assert.equal(prompt.includes(c.exportTexts.pdf),outputMode==='both');
    assert.equal(prompt.includes(c.exportTexts.word),outputMode!=='screen');
    assert.equal(prompt.includes('未添付なら開始を保留'),mode==='file');
  }
  writeFileSync(resolve(target,'clinic-rules.json'),JSON.stringify(snapshot,null,2)+'\n');
  assert.deepEqual(parseClinicSnapshot(JSON.parse(readFileSync(resolve(target,'clinic-rules.json'),'utf8'))),c);
  console.log('Clinic snapshot verified against canonical source; 18 prompt variants passed: '+sourceBlob);
}
