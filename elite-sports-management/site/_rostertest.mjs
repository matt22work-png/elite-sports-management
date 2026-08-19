const BASE="https://elite-sports-management.vercel.app";
const ver=await (await fetch("http://localhost:9222/json/version")).json();
const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(m,pr={},s)=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {result}=await send("Target.createTarget",{url:"about:blank"});
const {result:att}=await send("Target.attachToTarget",{targetId:result.targetId,flatten:true});const sid=att.sessionId;
await send("Page.enable",{},sid);await send("Runtime.enable",{},sid);
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(3800);
const ev=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result.result?.value;

console.log("=== ROSTER ===");
console.log("players rendered:", await ev(`document.querySelectorAll('#roster .card, .roster-card, [data-slug]').length || document.querySelectorAll('#roster .card').length`));
// filter tabs
const filters = await ev(`Array.from(document.querySelectorAll('#filters .chip, .filters .chip')).map(c=>c.textContent.trim())`);
console.log("filter tabs:", JSON.stringify(filters));
// click each filter, count visible cards, ensure no error
const filterResult = await ev(`(async()=>{
  const chips=Array.from(document.querySelectorAll('#filters .chip'));
  const out=[];
  for(const c of chips){ c.click(); await new Promise(r=>setTimeout(r,150));
    const vis=Array.from(document.querySelectorAll('#roster .card')).filter(x=>x.offsetParent!==null).length;
    out.push(c.textContent.trim()+'='+vis);
  }
  return out.join(', ');
})()`);
console.log("visible-per-filter:", filterResult);

console.log("=== PLAYER MODAL ===");
const modalTest = await ev(`(async()=>{
  const card=document.querySelector('#roster .card [data-view], #roster .card .btn, #roster .card');
  const first=document.querySelector('#roster .card');
  if(!first) return 'no cards';
  first.querySelector('button, a, [role=button]')?.click() || first.click();
  await new Promise(r=>setTimeout(r,600));
  const modal=document.querySelector('#modal, .modal');
  const open=modal && (modal.classList.contains('open')||getComputedStyle(modal).display!=='none');
  const hasContent=(document.querySelector('#sheetContent, .sheet')?.textContent||'').length>20;
  return 'modal-open='+open+' has-content='+hasContent;
})()`);
console.log(modalTest);
// close modal
await ev(`document.querySelector('[data-close]')?.click()`);

console.log("=== NAV LINKS (in-page anchors + external) ===");
const navlinks = await ev(`Array.from(document.querySelectorAll('nav a, header a, .nav a')).map(a=>({t:a.textContent.trim().slice(0,20),h:a.getAttribute('href')})).filter(x=>x.h)`);
console.log(JSON.stringify(navlinks,null,0).slice(0,600));
await send("Target.closeTarget",{targetId:result.targetId});ws.close();
