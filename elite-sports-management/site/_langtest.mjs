const BASE="https://elite-sports-management.vercel.app";
const ver=await (await fetch("http://localhost:9222/json/version")).json();
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(method,params={},sessionId)=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params,sessionId}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const {result}=await send("Target.createTarget",{url:"about:blank"});
const {result:att}=await send("Target.attachToTarget",{targetId:result.targetId,flatten:true});const sid=att.sessionId;
await send("Page.enable",{},sid);await send("Runtime.enable",{},sid);
await send("Page.navigate",{url:BASE+"/"},sid);await sleep(3500);
const ev=async expr=>(await send("Runtime.evaluate",{expression:expr,returnByValue:true},sid)).result.result?.value;
const sel=`document.querySelector('[data-i18n-html="hero_h1"]')`;
console.log("EN hero:", (await ev(`${sel}?.textContent`))?.slice(0,50));
await ev(`document.querySelector('#lang button[data-l="it"]').click()`);await sleep(500);
const it=await ev(`${sel}?.textContent`);
console.log("IT hero:", it);
console.log("  IT tagline correct + à renders:", /livello successivo/.test(it||"") && it.includes("visibilità"));
await ev(`document.querySelector('#lang button[data-l="es"]').click()`);await sleep(500);
const es=await ev(`${sel}?.textContent`);
console.log("ES hero:", es?.slice(0,60));
console.log("  ES switch works:", /b[eé]isbol/i.test(es||""));
// lang buttons exist on all pages?
for(const pg of ["/register/","/scout/","/portal/","/tenerife/"]){
  await send("Page.navigate",{url:BASE+pg},sid);await sleep(2500);
  const n=await ev(`document.querySelectorAll('#lang button, [data-l]').length`);
  console.log(`  ${pg} language buttons: ${n}`);
}
await send("Target.closeTarget",{targetId:result.targetId});ws.close();
