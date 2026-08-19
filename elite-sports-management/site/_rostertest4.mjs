const BASE="https://elite-sports-management.vercel.app";
const ver=await (await fetch("http://localhost:9222/json/version")).json();
const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(m,pr={},s)=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {result}=await send("Target.createTarget",{url:"about:blank"});
const {result:att}=await send("Target.attachToTarget",{targetId:result.targetId,flatten:true});const sid=att.sessionId;
await send("Page.enable",{},sid);await send("Runtime.enable",{},sid);
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(4000);
const ev=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result?.value;

console.log("pcards on load:", await ev(`document.querySelectorAll('#rosterList .pcard').length`));
console.log("of which link-cards(<a>):", await ev(`document.querySelectorAll('#rosterList a.pcard').length`), " modal-cards(button[data-slug]):", await ev(`document.querySelectorAll('#rosterList button.pcard[data-slug]').length`));

// position filters (leave sport=All): find chips with dataset.f
const posRes = await ev(`(async()=>{
  const w=()=>new Promise(r=>setTimeout(r,250));
  const chips=Array.from(document.querySelectorAll('.chip[data-f]'));
  const out={};
  for(const c of chips){ c.click(); await w(); out[c.dataset.f]=document.querySelectorAll('#rosterList .pcard').length; }
  chips.find(c=>c.dataset.f==='All')?.click(); await w();
  return out;
})()`);
console.log("per-position (sport=All):", JSON.stringify(posRes));
const all=posRes.All; const sum=Object.entries(posRes).filter(([k])=>k!=='All').reduce((a,[,v])=>a+v,0);
console.log(`  All=${all} sum=${sum} -> ${all===sum?"PARTITION CLEAN (no overlap/gaps)":"MISMATCH"}`);

// sport filters
const sportRes = await ev(`(async()=>{
  const w=()=>new Promise(r=>setTimeout(r,250));
  const chips=Array.from(document.querySelectorAll('.chip[data-sf]'));
  const out={};
  for(const c of chips){ c.click(); await w(); out[c.dataset.sf]=document.querySelectorAll('#rosterList .pcard').length; }
  chips.find(c=>c.dataset.sf==='All')?.click(); await w();
  return out;
})()`);
console.log("per-sport:", JSON.stringify(sportRes));

// modal: click a modal-type card (button[data-slug]) if any; else verify link cards navigate
const modal = await ev(`(async()=>{
  const btn=document.querySelector('#rosterList button.pcard[data-slug]');
  if(btn){ btn.click(); await new Promise(r=>setTimeout(r,700));
    return 'modal-card: open='+(document.getElementById('modal')?.classList.contains('open'))+' contentLen='+(document.getElementById('sheetContent')?.textContent.length||0);
  }
  const a=document.querySelector('#rosterList a.pcard');
  return 'no modal-cards; first link href='+(a?a.getAttribute('href'):'none');
})()`);
console.log("modal/card-click:", modal);
await send("Runtime.evaluate",{expression:`document.querySelector('[data-close]')?.click()`},sid);
await send("Target.closeTarget",{targetId:result.targetId});ws.close();
