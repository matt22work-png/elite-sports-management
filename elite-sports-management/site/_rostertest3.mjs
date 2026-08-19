const BASE="https://elite-sports-management.vercel.app";
const ver=await (await fetch("http://localhost:9222/json/version")).json();
const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(m,pr={},s)=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {result}=await send("Target.createTarget",{url:"about:blank"});
const {result:att}=await send("Target.attachToTarget",{targetId:result.targetId,flatten:true});const sid=att.sessionId;
await send("Page.enable",{},sid);await send("Runtime.enable",{},sid);
await send("Runtime.evaluate",{expression:`try{localStorage.setItem('esm_lang','en')}catch(e){}`},sid);
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(4000);
const ev=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result?.value;

console.log("cards on load (untouched):", await ev(`document.querySelectorAll('#roster .card').length`));
console.log("state:", await ev(`JSON.stringify({activeSport:(typeof activeSport!=='undefined'?activeSport:'?'), active:(typeof active!=='undefined'?active:'?'), players:(typeof PLAYERS!=='undefined'?PLAYERS.length:'?')})`));
// click only position chips (sport untouched = All), by dataset.f
const res = await ev(`(async()=>{
  const w=()=>new Promise(r=>setTimeout(r,250));
  const chips=Array.from(document.querySelectorAll('#filters .chip'));
  const out={};
  for(const c of chips){ c.click(); await w(); out[c.dataset.f||c.textContent.trim()]=document.querySelectorAll('#roster .card').length; }
  // reset to All
  chips[0].click(); await w();
  return out;
})()`);
console.log("per-position (sport=All):", JSON.stringify(res));
const all=res["All"]; const parts=Object.entries(res).filter(([k])=>k!=="All").reduce((a,[,v])=>a+v,0);
console.log(`  All=${all} sum(positions)=${parts} -> ${all===parts?"PARTITION CLEAN":"CHECK"}`);
// now sport filter
const sportRes = await ev(`(async()=>{
  const w=()=>new Promise(r=>setTimeout(r,250));
  const sc=Array.from(document.querySelectorAll('#sportFilters .chip, [id*=sport] .chip, [class*=sport] .chip'));
  const out={found:sc.length};
  for(const c of sc){ c.click(); await w(); out[c.dataset.sf||c.textContent.trim()]=document.querySelectorAll('#roster .card').length; }
  return out;
})()`);
console.log("per-sport:", JSON.stringify(sportRes));
// modal
const modal = await ev(`(async()=>{
  document.querySelectorAll('#filters .chip')[0].click(); await new Promise(r=>setTimeout(r,300));
  const c=document.querySelector('#roster .card'); if(!c) return 'no cards';
  (c.querySelector('button,a')||c).click(); await new Promise(r=>setTimeout(r,700));
  return 'modal open='+(document.getElementById('modal')?.classList.contains('open'))+' contentLen='+(document.getElementById('sheetContent')?.textContent.length||0);
})()`);
console.log("modal:", modal);
await send("Target.closeTarget",{targetId:result.targetId});ws.close();
