
"use strict";
// Original English question text transcribed from the user-provided Kyudai Open PDFs.
// The four diagrams/tables are redrawn for responsive display from verified source figures.
const OPEN_QUESTIONS = {
  "open2023-4": {
    "text": "〔4〕 Read the instructions and write a paragraph in English. (50 points)\n\nMore and more people are enjoying movies on SVOD services* such as Amazon Prime Video, Netflix, and Disney+, instead of seeing movies at the movie theater or buying DVDs. Introduce and explain either ⒜ the benefits, ⒝ the drawbacks, or ⒞ both the benefits and the drawbacks of SVOD services. Compose a well-structured paragraph, supported by examples, using about 100 English words.\n\nNotes:\nSVOD services* : 定額制動画配信サービス"
  },
  "open2023-5": {
    "figure": "sales",
    "text": "〔5〕 Read the instructions and write your answer in English. (30 points)\n\nThe graph below shows sales trend in the Japanese comics market from 2014 to 2021:\n\n{{FIGURE}}\n\nUsing about 75 English words, describe the trends in the comics market between 2014 and 2021.\n\nNote: Words that express a number, such as 446 or 2014, are counted as one word."
  },
  "open2024-4": {
    "text": "〔4〕 Read the instructions and write a well-organized answer in English. (50 points)\n\nA drone is a pilotless aircraft that is controlled by someone on the ground. The most well-known use for drones is aerial photography or videography. But drones have also been used to improve society in fields such as transportation, medicine, and agriculture. Describe a single specific way that drones can be used to improve society. Explain your idea in detail in about 100 English words."
  },
  "open2024-5": {
    "figure": "precip",
    "text": "〔5〕 Read the instructions and write your answer in English. (30 points)\n\nThe bar graphs below show the monthly precipitation* in Naha City, Okinawa and Joetsu City, Niigata.\n\nComplete both tasks 🄐 and 🄑.\n🄐 Describe the differences between these two graphs in either 3 or 4 English sentences.\n🄑 What factors do you think lie behind these differences? Explain in either 2 or 3 English sentences.\n\nNotes:\nprecipitation* : the amount of water that falls to the ground as rain or snow\n\n{{FIGURE}}\n\nBased on tables from www.data.jma.go.jp. Data from Japan Meteorological Agency."
  },
  "open2025-4": {
    "text": "〔4〕 Read the instructions below and write your answer in English. (40 points)\n\nIn the 2022 academic year, the number of Japanese elementary and junior high school students who refused to go to school increased by 54,108 from the previous year, reaching a record high of 299,048. Futōkō has been a topic of discussion in Japan for a long time. Some educators and government leaders tackling this situation are trying to make positive changes to Japanese society in the academic, domestic, or social areas.\n\nDescribe in about 100 English words two positive future changes we can make by addressing this issue and how they will affect Japanese society and everyday life for the better."
  },
  "open2025-5": {
    "text": "〔5〕 Read the instructions below and write your answer in English. (30 points)\n\nImagine you are a first-year student at Kyushu University. You have just made friends with a foreign student. You are told that this is his/her first visit to Japan. You are thinking of going on a short trip with him/her next Sunday.\n\nYou have two options. Plan A is to visit a city with many shops, cafés, movie theaters, museums, and amusement facilities. You can get there in a short time at little cost, and inexpensive transport systems are also available in the city. On the other hand, Plan B involves a trip to a town surrounded by nature. The town, far away from the city, is famous for its historical shrines, temples, and architecture. You can also enjoy delicious dishes made with locally sourced ingredients and natural beauty there.\n\nWhich plan will you choose and why? Explain your choice with at least two different reasons in about 80 English words."
  },
  "open2026-4": {
    "figure": "courses",
    "text": "〔4〕 Read the instructions below and write your answer in English. (40点)\n\nImagine about 1 year has passed since you entered Kyushu University. You want to further improve your English, which is one of your strengths. You have learned that short-term English language programs will be held on campus this summer. Those who complete one of the programs will receive credits required for graduation.\n\nThere are advantages and disadvantages for each program you are considering. Referring to the outline below, write about which program you would like to choose and explain your reasons in about 100 English words.\n\n{{FIGURE}}"
  },
  "open2026-5": {
    "text": "〔5〕 Read the instructions below and write your answer in English. (30点)\n\nIn Japan today, with less interest in printed books and the spread of the internet, fewer books are borrowed from public libraries, and fewer people are visiting them. In some local communities, due to budget cuts and staff shortages, public libraries are being downsized, merged, or even closed.\n\nExplain in about 80 English words two possible effects of the decline of public libraries in Japan, focusing on characteristic features of the public libraries."
  },
  "open2027-4": {
    "text": "〔4〕 Read the question and instructions below and write your answer in English. (40点)\n\nWhat are three essential qualities of good medical doctors?\n\nExplain your answer in a paragraph of approximately 100 English words."
  },
  "open2027-5": {
    "figure": "tools",
    "text": "〔5〕 The chart shows how students at Kawai High School studied English using three tools in 2005 and 2025. (30点)\n\nSummarize the data presented in the chart using approximately 80 English words.\n\n{{FIGURE}}\n\n※ Digital devices: smartphones, tablets, PCs, etc."
  }
};
const OPEN_SALES = [
  [2014,356.9,88.7],[2015,326.8,116.9],[2016,296.3,149.1],[2017,258.3,174.7],
  [2018,241.2,200.2],[2019,238.7,259.3],[2020,270.6,342.0],[2021,264.5,411.4]
];
const OPEN_PRECIP = {
  Naha:[101.6,114.5,142.8,161.0,245.3,284.4,188.1,240.0,275.2,179.2,119.1,110.0],
  Joetsu:[429.6,263.3,194.7,105.3,87.0,136.5,206.8,184.5,205.8,213.9,334.2,475.5]
};
const OPEN_TOOLS = [
  ["Paper dictionaries",61,18],
  ["Electronic dictionaries",29,24],
  ["Digital devices",10,58]
];
function openEsc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function openSvgWrap(label,content,w,h,minwidth){
  return '<div class="tt-wrap"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+openEsc(label)+'" style="display:block;min-width:'+minwidth+'px;width:100%;max-width:'+w+'px" xmlns="http://www.w3.org/2000/svg">'+content+'</svg></div>';
}
function openGrid(x0,y0,x1,maxVal,step,scale){
  let z='';
  for(let val=0;val<=maxVal;val+=step){
    const y=y0-val*scale;
    z+='<line x1="'+x0+'" y1="'+y+'" x2="'+x1+'" y2="'+y+'" stroke="currentColor" opacity=".16"/>';
    z+='<text x="'+(x0-7)+'" y="'+(y+4)+'" text-anchor="end" font-size="12" fill="currentColor">'+val+'</text>';
  }
  return z;
}
function openSalesGraph(){
  const scale=.32,base=282,left=75;
  let z='<text x="75" y="25" font-size="17" fill="currentColor">Sales trend in the Japanese comics market</text>';
  z+='<text x="75" y="44" font-size="12" fill="currentColor">billion yen</text>';
  z+=openGrid(left,base,750,700,100,scale);
  OPEN_SALES.forEach(([year,paper,digital],i)=>{
    const x=94+i*80, h1=paper*scale,h2=digital*scale,total=paper+digital;
    z+='<rect x="'+x+'" y="'+(base-h1)+'" width="46" height="'+h1+'" fill="#666"/>';
    z+='<rect x="'+x+'" y="'+(base-h1-h2)+'" width="46" height="'+h2+'" fill="#d2d2d2" stroke="#666" stroke-width=".7"/>';
    z+='<text x="'+(x+23)+'" y="'+(base+20)+'" font-size="12" text-anchor="middle" fill="currentColor">'+year+'</text>';
    if(year===2014||year===2018||year===2021){
      z+='<text x="'+(x+23)+'" y="'+(base-total*scale-8)+'" font-size="13" text-anchor="middle" fill="currentColor">'+Math.round(total)+'</text>';
    }
  });
  z+='<rect x="255" y="317" width="12" height="12" fill="#666"/><text x="274" y="328" font-size="13" fill="currentColor">paper-based</text>';
  z+='<rect x="410" y="317" width="12" height="12" fill="#d2d2d2" stroke="#666"/><text x="429" y="328" font-size="13" fill="currentColor">digital</text>';
  return openSvgWrap("Japanese comics market 2014 to 2021, paper-based and digital sales",z,770,346,560);
}
function openPrecipGraph(){
  const base=302,sc=.44;
  let z="";
  [["Precipitation in Naha City, Okinawa",OPEN_PRECIP.Naha,2161.0,30],
   ["Precipitation in Joetsu City, Niigata",OPEN_PRECIP.Joetsu,2837.1,572]].forEach(([name,vals,annual,x0])=>{
    z+='<text x="'+x0+'" y="24" font-size="17" fill="currentColor">'+openEsc(name)+'</text>';
    z+='<text x="'+x0+'" y="44" font-size="13" fill="currentColor">Annual Precipitation: '+annual.toFixed(1)+' mm</text>';
    z+=openGrid(x0+35,base,x0+487,500,100,sc);
    vals.forEach((v,i)=>{
      const x=x0+49+i*36;
      z+='<rect x="'+x+'" y="'+(base-v*sc)+'" width="23" height="'+(v*sc)+'" fill="#777"/>';
      z+='<text x="'+(x+11.5)+'" y="'+(base+18)+'" font-size="11" text-anchor="middle" fill="currentColor">'+(i+1)+'</text>';
    });
  });
  return openSvgWrap("Monthly precipitation for all twelve months in Naha City and Joetsu City, in millimeters",z,1100,333,860);
}
function openCoursesTable(){
  return '<div class="tt-wrap"><table><thead><tr><th></th><th>Program A</th><th>Program B</th></tr></thead><tbody>'+
    '<tr><th>Course</th><td>English Writing</td><td>English Writing</td></tr>'+
    '<tr><th>Class size</th><td>Small class (about 10 students)</td><td>Large class (about 30 students)</td></tr>'+
    '<tr><th>Instructor</th><td>Mr. Smith (Enthusiastic American teacher)</td><td>Ms. Nagayo (Experienced Japanese teacher)</td></tr>'+
    '<tr><th>Language of instruction</th><td>English</td><td>Japanese</td></tr>'+
    '<tr><th>Fee</th><td>80,000 yen</td><td>40,000 yen</td></tr>'+
    '<tr><th>Class rules</th><td>Only textbooks and writing tools allowed in the classroom (no tablets or PCs)</td><td>Tablets or PCs required for classes and assignments</td></tr>'+
    '<tr><th>Assignment submission</th><td>On a special answer sheet (handwritten)</td><td>By email</td></tr>'+
    '</tbody></table></div>';
}
function openToolsGraph(){
  const base=276,scale=2.9,left=65;
  let z='<text x="65" y="24" font-size="16" fill="currentColor">The Percentage of Students by English Learning Tool:</text>'+
    '<text x="65" y="43" font-size="16" fill="currentColor">Kawai High School</text>';
  z+=openGrid(left,base,695,80,10,scale);
  OPEN_TOOLS.forEach(([name,a,b],i)=>{
    const x=116+i*206;
    z+='<rect x="'+x+'" y="'+(base-a*scale)+'" width="50" height="'+(a*scale)+'" fill="#444"/>';
    z+='<rect x="'+(x+56)+'" y="'+(base-b*scale)+'" width="50" height="'+(b*scale)+'" fill="#999"/>';
    z+='<text x="'+(x+25)+'" y="'+(base-a*scale-6)+'" font-size="14" fill="currentColor" text-anchor="middle">'+a+'%</text>';
    z+='<text x="'+(x+81)+'" y="'+(base-b*scale-6)+'" font-size="14" fill="currentColor" text-anchor="middle">'+b+'%</text>';
    z+='<text x="'+(x+53)+'" y="'+(base+19)+'" font-size="12" fill="currentColor" text-anchor="middle">'+openEsc(name)+'</text>';
  });
  z+='<rect x="275" y="324" width="12" height="12" fill="#444"/><text x="292" y="335" font-size="13" fill="currentColor">2005</text>'+
    '<rect x="367" y="324" width="12" height="12" fill="#999"/><text x="384" y="335" font-size="13" fill="currentColor">2025</text>';
  return openSvgWrap("English learning tools used by students at Kawai High School in 2005 and 2025",z,720,355,630);
}
function openFigureHtml(kind){
  switch(kind){
    case "sales":return openSalesGraph();
    case "precip":return openPrecipGraph();
    case "courses":return openCoursesTable();
    case "tools":return openToolsGraph();
    default:return "";
  }
}
function openFigureText(kind){
  switch(kind){
    case "sales":return "Japanese comics market sales (billion yen); year / paper-based / digital: "+
      OPEN_SALES.map(([year,paper,digital])=>year+": "+paper+" / "+digital).join("; ")+".";
    case "precip":return "Monthly precipitation (mm), January to December. Naha: "+OPEN_PRECIP.Naha.join(", ")+
      "; Joetsu: "+OPEN_PRECIP.Joetsu.join(", ")+". Annual totals: Naha 2161.0 mm, Joetsu 2837.1 mm.";
    case "courses":return "Program A: English Writing; small class about 10 students; instructor Mr. Smith, enthusiastic American teacher; instruction in English; 80,000 yen; only textbooks and writing tools allowed, no tablets or PCs; assignments submitted by hand on a special answer sheet. "+
      "Program B: English Writing; large class about 30 students; instructor Ms. Nagayo, experienced Japanese teacher; instruction in Japanese; 40,000 yen; tablets or PCs required for classes and assignments; assignments submitted by email.";
    case "tools":return "Percentages in 2005 and 2025 at Kawai High School: paper dictionaries 61% and 18%; electronic dictionaries 29% and 24%; digital devices 10% and 58%.";
    default:return "";
  }
}
function openQuestionPlainText(id){
  const item=OPEN_QUESTIONS[id];if(!item)return "";
  return item.text.replace("{{FIGURE}}",openFigureText(item.figure));
}
function renderOpenQuestion(id){
  const item=OPEN_QUESTIONS[id];if(!item)return "<p>Problem data not available.</p>";
  return item.text.split(/(\{\{FIGURE\}\})/).map(part=>{
    if(part==="{{FIGURE}}")return openFigureHtml(item.figure);
    return part.split(/\n\s*\n/).filter(Boolean).map(p=>"<p>"+openEsc(p.replace(/^〔4〕/,"〔４〕").replace(/^〔5〕/,"〔５〕")).replace(/\n/g,"<span class=\"original-linebreak\"></span>")+"</p>").join("");
  }).join("")+
  '<p class="problem-attribution">河合塾 九大入試オープンの問題文（英文原文）です。図表・表組みは掲載資料のデータに基づき表示用に再作成しています。</p>';
}
