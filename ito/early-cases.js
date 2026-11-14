"use strict";
// 2022・2023年度 九州大学前期〔４〕〔５〕
// English question statements and marking rubrics transcribed from the four supplied source files.
// The graph paths are visual redrawings of the supplied scanned figures.
// Unlabelled intermediate graph points are diagram positions, not claimed exact tabular data.
const EARLY_CASES = {
 "2022-4":{
  year:2022,q:4,full:50,min:80,max:120,kind:"意見の論述",
  prompt:"〔４〕 Read the instructions and write a paragraph in English. (50 points)\n\nThe number of immigrants to Japan is likely to increase in the coming decades. Introduce and explain either (a) the benefits, (b) the drawbacks, or (c) both the benefits and the drawbacks of living in a multicultural society. Compose a well-structured paragraph, supported by examples, using about 100 English words.",
  model:{words:100,text:"One benefit of living in a multicultural society is that it enables you to establish your own cultural identity. When you experience foreign cultures, you are sure to become keenly aware of the differences, which makes you feel prouder of your cultural heritage. Then, you will learn to appreciate what you have had, and begin to inherit your traditions. One drawback is that in a multicultural society, people sometimes have conflicts. In places where many minority groups live, the difference of values or religious ideas can prevent each person from building equal relationships. Some conflicts can even develop into violence."},
  rubric: [
   "【2022年度前期〔４〕：意見の論述（50点満点）】",
   "①内容面：50点を持ち点とする。設問の対象は多文化社会に暮らすことの長所・短所である。移民増加への言及自体は必須ではない。",
   "・多文化社会に全く触れず，移民の増加それ自体の利害のみを論じるなど設問の対象を満たさない場合は内容面から−50点。",
   "・(a)長所のみ，(b)短所のみ，(c)長所と短所の両方のいずれも認める。両方を挙げる場合の長短の分量・バランスは不問。",
   "・選んだ構成について，抽象的な主張だけで具体性に欠ける，稚拙・不自然・不明瞭，賛否だけ，自分の体験の説明に終始する場合は一律−25点（この項目の上限−25点）。",
   "・問題文の最初の一文 The number of immigrants to Japan is likely to increase in the coming decades. を明らかに文単位でそのまま引用した箇所があれば−10点。語句レベルの引用は不問。",
   "②文法・語法・語彙・書式：既存の全年度共通【自由英作文問題の採点上の原則】に従う。内容面と同一原因の誤りは二重減点しない。",
   "③語数：59語以下−40点，60〜79語−20点，80〜120語減点なし，121語以上−20点。",
   "④得点：内容の持ち点から②③を引く。得点の下限は０点。"
  ].join("\n")
 },
 "2022-5":{
  year:2022,q:5,full:30,min:55,max:85,kind:"図表の説明",
  prompt:"〔５〕 Read the instructions and write your answer in English. (30 points)\n\nThe graph below shows changes in the number of global UFO sightings recorded from 1990 to 2020:\n\n[Line graph: the number of global UFO sightings, 1990–2020. Labelled values: 1990 = 319; 2014 = 8,736; 2020 = 7,267. Overall increase to 2014, a sharp fall until 2018, and a rise toward 2020.]\n\nUsing about 75 English words, describe the trends in UFO sightings between 1990 and 2020.\n\nNote: Words that express a number, such as 319 or 1990, are counted as one word.",
  model:{words:75,text:"Overall, the number of global UFO sightings increased from 1990 to 2020. In fact, the number of sightings was more than twenty times as large in 2020 as in 1990. Between 1990 and 2010, there was a general increase; the number amounted to about 5,000 in 2010. However, after that, the number sharply and repeatedly increased — in 2014, the number reached 8,736, fell below 4,000 four years after, and went up to 7,267 in 2020."},
  rubric:[
   "【2022年度前期〔５〕：図表の説明（30点満点）】",
   "①内容面：30点を持ち点とする。次の(a)(b)をいずれも評価する。記載の順序は問わない。",
   "・(a)1990年から2014年にかけての増加傾向：言及がない，または数値誤読・明白な事実誤認がある場合−15点（上限−15点）。正しい増加傾向の説明があれば具体的数値は必須ではなく，概数も認める。",
   "・(b)2014年から2020年のＶ字型の変化：言及がない，または数値誤読・明白な事実誤認がある場合−15点（上限−15点）。2014年に8,736，2018年には4,000未満，2020年に7,267という傾向を適切に言い表せればよい。概数や数値を使わない説明も認める。",
   "・過去を基準とする時制・現在を基準とする時制ともに認める。2020年を過去・現在として扱うのも可。明白な時制の誤り・著しい不統一は一律−5点。",
   "・増減，差，比較・倍数，割合などの表現が重大に誤っている場合は，個数を問わず一律−10点。対象・比較構造・前置詞などを確認し，同じ箇所を英語面でも重複して引かない。軽微な誤りは共通原則で評価する。",
   "・この問題の数値は the number of UFO sightings が増減する。UFO sightings increased とだけして数値が増減したように述べる誤り，増加・減少先を表す to の欠落，倍数比較の対象の不一致などの重大な表現誤りに注意する。",
   "・グラフの紹介文 The graph below shows changes in the number of global UFO sightings recorded from 1990 to 2020. の文単位の明白な引用は−10点。語句の利用は認める。",
   "・原因や私見の追加だけでは減点しないが，無関係な意見を加点対象としない。",
   "②文法・語法・語彙・書式：既存の全年度共通【自由英作文問題の採点上の原則】に従う。内容面との二重減点は避ける。",
   "③語数：54語以下−15点，55〜85語減点なし，86語以上−15点。",
   "④得点：内容の持ち点から②③を引く。得点の下限は０点。"
  ].join("\n")
 },
 "2023-4":{
  year:2023,q:4,full:50,min:80,max:120,kind:"意見の論述",
  prompt:"〔４〕 Read the instructions and write a well-organized answer in English. (50 points)\n\nVirtual reality (VR)* refers to a high-quality simulation of reality created by a computer. Probably the most famous use for VR so far is gaming. But VR has also been used to improve society in various fields such as education, medicine, and engineering. Describe a single specific way that virtual reality can be used to improve society. Explain your idea in detail in about 100 English words.\n\nNotes:\nVirtual reality (VR)*: VR systems use special glasses that completely cover the user’s eyes. These glasses show a very realistic picture of a world created by the computer. In addition, the systems can tell when the user moves their head, arms, and sometimes other body parts. So users can control the action by natural movement. Some systems even let users feel like they are touching things. Thus, VR systems can make users feel like they are really in another world.",
  model:{words:101,text:"In order to improve medicine, we can make more use of VR systems. Of course, in recent years, medical science has been making great progress. However, a lot of patients still suffer from diseases which cannot be treated easily due to the small number of appropriately skilled doctors. More patients can be treated if surgeons are trained via VR systems to perform delicate operations. In addition, patients’ quality of life can be improved through the systems. If we introduce VR systems which are known to help patients feel relaxed, anxiety and pain get reduced during stays in hospital or before operations."},
  rubric:[
   "【2023年度前期〔４〕：意見の論述（50点満点）】",
   "①内容面：50点を持ち点とする。VRを用いて社会を改善する具体的な方法を述べることが必要。教育・医療・工学以外の分野や，社会改善につながるゲーム分野も認める。",
   "・VRの機能・感想・自身の経験だけを述べ，社会の改善につながる利用方法を説明しない場合は内容面から−50点。",
   "・Describe a single specific way に反し，明らかに異なるジャンルの方法を二つ以上並列して述べる場合は−25点。一つの分野の補足説明は機械的に複数とは扱わない。",
   "・事実に反する，根拠が乏しい，具体性がない，例が不適切，内容が稚拙・不自然などの問題があれば一律−25点。VRを使わずに実現できるオンライン授業・遠隔会話などをVRの特有の利点として示す場合に注意する。",
   "・趣旨が不明瞭，社会改善との関連が不明瞭な場合は一律−10点。原因が重大な語彙・構文の誤りであれば同じ箇所を英語面で重複して減点しない。",
   "・冗長・不要・重複した説明には一律−10点。VRの一般的な機能説明やゲームの説明が長く，社会改善との関係が読み取れない場合を含む。",
   "・問題文から文単位で明らかに引用した箇所があれば一律−10点。語句の自然な利用は不問。",
   "②文法・語法・語彙・書式：既存の全年度共通【自由英作文問題の採点上の原則】に従う。",
   "③語数：59語以下−40点，60〜79語−20点，80〜120語減点なし，121語以上−20点。",
   "④得点：内容の持ち点から②③を引く。得点の下限は０点。"
  ].join("\n")
 },
 "2023-5":{
  year:2023,q:5,full:30,min:null,max:null,kind:"図表の説明",
  prompt:"〔５〕 Read the instructions and write your answer in English. (30 points)\n\nThere are two graphs on the next page about the population in Japan in 2018. The top graph shows the number of Japanese citizens in millions (example: 10 = 10 million people) in different age groups (example: 0–4 = Japanese citizens who are 0 to 4 years old). The bottom graph shows the number of foreign residents living in Japan in thousands (example: 500 = 500 thousand people) in different age groups.\n\nComplete both tasks (A) and (B).\n(A) Describe the differences between these two graphs in either 3 or 4 English sentences.\n(B) Why do you think these differences exist? Explain in either 2 or 3 English sentences.\n\n[Two line graphs: Japanese citizens by age category (in millions), and foreign residents by age category (in thousands). Japanese citizens have older peaks around 40–49 and 65–74; foreign residents peak among people in their twenties. Source: graphs from Nippon.com, data from Ministry of Internal Affairs and Communications.]",
  model:{words:81,text:"(A) The number of Japanese citizens under 40 years old is small, compared with the number of those 40 years old and over. In fact, citizens who are 40 to 49 and 65 to 74 years old make up the largest groups. On the other hand, foreign residents in Japan are relatively young.\n(B) One reason for the difference is the decreasing birthrate in Japan. Another reason is that young foreigners, especially those in their twenties, come to Japan to study or work."},
  rubric:[
   "【2023年度前期〔５〕：図表の説明（30点満点）】",
   "①内容面：30点を持ち点とする。日本の事情として記述したことが答案のどこにも明確でなければ−30点。",
   "・(A)日本人と在留外国人の年齢構成の違い：説明がない，３〜４英文の指定を守らない，または明白な数値・グラフの事実誤認があれば−15点（Aの上限−15点）。",
   "・Aでは『日本人は若年層が少なく，外国人住民は若年層が多い』という対比を適切に示せばよい。日本人のピーク年齢（40〜54歳・65〜70代）や外国人の20代のピーク，具体的な人口数値は必須ではない。",
   "・(B)違いの背景にある要因：説明がない，２〜３英文の指定を守らない，理由に事実誤認・根拠不足・具体性不足などがあれば−15点（Bの上限−15点）。出生率の低下や若い外国人の留学・就労などは妥当な例だが，それ以外も日本の実情に合えば認める。",
   "・(A)(B)を一段落で連続して述べても，二段落に分けてもよい。A/Bの順は設問順に沿って把握する。両方に語数の規定はない。",
   "・趣旨不明瞭・テーマとの関連不明瞭は一律−10点。重大な英語の誤りで意味が分からない場合は内容と英語面で二重減点しない。",
   "・原題から文単位で明らかに引用した箇所があれば一律−10点。語句の利用は認める。",
   "②文法・語法・語彙・書式：既存の全年度共通【自由英作文問題の採点上の原則】に従う。",
   "③語数の加減点は行わず，(A)(B)それぞれの指定英文数を確認する。",
   "④得点：内容の持ち点から②を引く。得点の下限は０点。"
  ].join("\n")
 }
};

function earlyEsc(s){return String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));}
function earlySvgWrapper(label,body,w,h,minWidth){
 return '<div class="tt-wrap"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+earlyEsc(label)+'" style="display:block;width:100%;max-width:'+w+'px;min-width:'+minWidth+'px" xmlns="http://www.w3.org/2000/svg">'+body+'</svg></div>';
}
function earlyGrid(xLeft,xRight,yBase,max,step,height){
 let out="";
 for(let v=0;v<=max;v+=step){
  const y=yBase-v/max*height;
  out+='<line x1="'+xLeft+'" y1="'+y+'" x2="'+xRight+'" y2="'+y+'" stroke="currentColor" stroke-opacity=".17"/>';
  out+='<text x="'+(xLeft-9)+'" y="'+(y+5)+'" text-anchor="end" font-size="12" fill="currentColor">'+v.toLocaleString("en-US")+'</text>';
 }
 return out;
}
function earlySightingsChart(){
 const vals=[319,410,340,360,450,1500,1110,1390,2000,3150,3050,3450,3700,4400,4750,4530,4190,4760,5250,4950,4770,5570,8160,7750,8736,7000,5800,5070,3500,6380,7267];
 let z='<text x="50" y="26" font-size="17" fill="currentColor">Global UFO sightings, 1990–2020</text>';
 z+=earlyGrid(56,742,322,10000,2000,263);
 const x=i=>60+i*22.3,y=v=>322-v/10000*263;
 z+='<polyline points="'+vals.map((v,i)=>x(i)+","+y(v)).join(" ")+'" fill="none" stroke="#5c012b" stroke-width="2.7" stroke-linejoin="round"/>';
 vals.forEach((v,i)=>{z+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.8" fill="#5c012b"/>';});
 for(let y0=1990;y0<=2020;y0+=2){let pos=x(y0-1990);z+='<text x="'+pos+'" y="341" font-size="11" text-anchor="middle" fill="currentColor">'+y0+'</text>';}
 [[0,"319",-5,-17],[24,"8,736",0,-18],[30,"7,267",-2,-18]].forEach(([i,label,dx,dy])=>z+='<text x="'+(x(i)+dx)+'" y="'+(y(vals[i])+dy)+'" font-size="15" text-anchor="middle" font-weight="bold" fill="currentColor">'+label+'</text>');
 return earlySvgWrapper("Global UFO sightings 1990–2020. 1990: 319; 2014: 8,736; 2020: 7,267. Other intermediate points visually retraced from scanned source.",z,770,355,650);
}
function earlyAgeChart(){
 const groups=["0–4","5–9","10–14","15–19","20–24","25–29","30–34","35–39","40–44","45–49","50–54","55–59","60–64","65–69","70–74","75–79","80–84","85–89","90–94","95–99","100+"];
 // These arrays encode approximate plotted heights visible on the scanned source, not exact unpublished census values.
 const jp=[5,5.3,5.6,6,6.4,6.4,7.1,7,9.4,9.8,8.3,7.6,7.4,9.2,8.5,7,5.3,3.7,1.9,.7,.2];
 const foreign=[100,90,70,110,410,405,312,268,210,194,165,130,90,65,52,45,30,11,2,1,0];
 let z='';
 const x=i=>65+i*31,makePanel=(name,values,max,step,base,height,units)=>{
  let panel='<text x="65" y="'+(base-height-28)+'" font-size="17" fill="currentColor">'+earlyEsc(name)+' ('+units+')</text>';
  panel+=earlyGrid(65,694,base,max,step,height);
  panel+='<polyline points="'+values.map((v,i)=>x(i)+","+(base-v/max*height)).join(" ")+'" fill="none" stroke="#333" stroke-width="2.3"/>';
  values.forEach((v,i)=>panel+='<circle cx="'+x(i)+'" cy="'+(base-v/max*height)+'" r="4.0" fill="white" stroke="#333" stroke-width="1.6"/>');
  groups.forEach((g,i)=>{panel+='<text transform="translate('+x(i)+' '+(base+15)+') rotate(-48)" text-anchor="end" font-size="10.5" fill="currentColor">'+earlyEsc(g)+'</text>';});
  return panel;
 };
 z+=makePanel("Japanese citizens by age category",jp,12,2,246,158,"millions");
 z+=makePanel("Foreign residents by age category",foreign,500,100,546,158,"thousands");
 return earlySvgWrapper("Age population distribution in Japan, 2018. Japanese citizens peak around ages 40–49 and 65–74, while foreign residents peak in their twenties. Source graph redrawn.",z,720,605,650);
}
function earlyQuestionHtml(id){
 const c=EARLY_CASES[id];if(!c)return "<p>問題文のデータがありません。</p>";
 if(id==="2022-4")return '<p>〔４〕 Read the instructions and write a paragraph <u><b>in English</b></u>. (50 points)</p>'+
 '<p>The number of immigrants to Japan is likely to increase in the coming decades. Introduce and explain either (a) the benefits, (b) the drawbacks, or (c) both the benefits and the drawbacks of living in a multicultural society. Compose a well-structured paragraph, supported by examples, using about <u><b>100 English words</b></u>.</p>';
 if(id==="2022-5")return '<p>〔５〕 Read the instructions and write your answer <u><b>in English</b></u>. (30 points)</p>'+
 '<p>The graph below shows changes in the number of global UFO sightings recorded from 1990 to 2020:</p>'+
 earlySightingsChart()+
 '<p>Using about <u><b>75 English words</b></u>, describe the trends in UFO sightings between 1990 and 2020.</p>'+
 '<p>Note: Words that express a number, such as 319 or 1990, are counted as one word.</p>';
 if(id==="2023-4")return '<p>〔４〕 Read the instructions and write a well-organized answer <u><b>in English</b></u>. (50 points)</p>'+
 '<p>Virtual reality (VR)* refers to a high-quality simulation of reality created by a computer. Probably the most famous use for VR so far is gaming. But VR has also been used to improve society in various fields such as education, medicine, and engineering. Describe a <u><b>single</b></u> specific way that virtual reality can be used to improve society. Explain your idea in detail <u><b>in about 100 English words</b></u>.</p>'+
 '<p>Notes:<br>Virtual reality (VR)*: VR systems use special glasses that completely cover the user’s eyes. These glasses show a very realistic picture of a world created by the computer. In addition, the systems can tell when the user moves their head, arms, and sometimes other body parts. So users can control the action by natural movement. Some systems even let users feel like they are touching things. Thus, VR systems can make users feel like they are really in another world.</p>';
 if(id==="2023-5")return '<p>〔５〕 Read the instructions and write your answer <u><b>in English</b></u>. (30 points)</p>'+
 '<p>There are two graphs on the next page about the population in Japan in 2018. The top graph shows the number of Japanese citizens in millions (example: 10 = 10 million people) in different age groups (example: 0–4 = Japanese citizens who are 0 to 4 years old). The bottom graph shows the number of foreign residents living in Japan in thousands (example: 500 = 500 thousand people) in different age groups.</p>'+
 '<p>Complete both tasks (A) and (B).<br>(A) Describe the differences between these two graphs <u><b>in either 3 or 4 English sentences</b></u>.<br>(B) Why do you think these differences exist? Explain <u><b>in either 2 or 3 English sentences</b></u>.</p>'+
 earlyAgeChart()+
 '<p>Based on graphs from Nippon.com. Data from the Ministry of Internal Affairs and Communications.</p>';
 return "";
}
