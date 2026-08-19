const BASE="https://elite-sports-management.vercel.app";
const ver=await (await fetch("http://localhost:9222/json/version")).json();
const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(m,pr={},s)=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {result}=await send("Target.createTarget",{url:"about:blank"});
const {result:att}=await send("Target.attachToTarget",{targetId:result.targetId,flatten:true});const sid=att.sessionId;
await send("Page.enable",{},sid);await send("Runtime.enable",{},sid);
// force EN
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(1000);
await send("Runtime.evaluate",{expression:`localStorage.setItem('esm_lang','en')`},sid);
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(3800);
const ev=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result?.value;

// Identify the two filter rows
const groups = await ev(`(()=>{
  const rows={};
  const sport=document.querySelector('#sportFilters, .sport-filters, #sportTabs');
  const pos=document.getElementById('filters');
  rows.sportChips = sport? Array.from(sport.querySelectorAll('.chip')).map(c=>c.dataset.sf||c.textContent.trim()):[];
  rows.posChips = pos? Array.from(pos.querySelectorAll('.chip')).map(c=>c.dataset.f||c.textContent.trim()):[];
  return rows;
})()`);
console.log("sport chips:", JSON.stringify(groups.sportChips));
console.log("position chips:", JSON.stringify(groups.posChips));

// With sport=All, click each position chip and count visible cards
const part = await ev(`(async()=>{
  const wait=()=>new Promise(r=>setTimeout(r,200));
  // ensure sport = All
  const sportAll=document.querySelector('#sportFilters .chip, .sport-filters .chip');
  if(sportAll){ sportAll.click(); await wait(); }
  const posChips=Array.from(document.getElementById('filters').querySelectorAll('.chip'));
  const counts={};
  for(const c of posChips){ c.click(); await wait();
    const key=(c.dataset.f||c.textContent.trim());
    counts[key]=document.querySelectorAll('#roster .card').length;
  }
  return counts;
})()`);
console.log("cards per position filter (sport=All):", JSON.stringify(part));
const vals=Object.entries(part);
const all=vals.find(([k])=>/^all$/i.test(k))?.[1];
const others=vals.filter(([k])=>!/^all$/i.test(k)).map(([,v])=>v);
const sum=others.reduce((a,b)=>a+b,0);
console.log(`  All=${all}, sum(other positions)=${sum} -> partition ${all===sum?"CLEAN (no overlap/gaps)":"MISMATCH (check overlap)"}`);

// modal test on populated roster (click All first)
const modal = await ev(`(async()=>{
  document.querySelector('#filters .chip').click(); await new Promise(r=>setTimeout(r,300));
  const card=document.querySelector('#roster .card'); if(!card) return 'no cards';
  (card.querySelector('button,a,[role=button]')||card).click();
  await new Promise(r=>setTimeout(r,700));
  const m=document.querySelector('#modal');
  return 'open='+(m&&m.classList.contains('open'))+' content-len='+(document.getElementById('sheetContent')?.textContent.length||0);
})()`);
console.log("player modal:", modal);
await send("Target.closeTarget",{targetId:result.targetId});ws.close();
