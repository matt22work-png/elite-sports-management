// Headless-Chrome CDP harness: per-page console/exception/404 capture + interaction
// assertions against the LIVE Vercel site. Node v24 global WebSocket, no deps.
const BASE = "https://elite-sports-management.vercel.app";
const ver = await (await fetch("http://localhost:9222/json/version")).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

let msgId = 0; const pending = new Map(); const listeners = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else listeners.forEach(fn => fn(m));
};
function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise(res => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testPage(name, path, { mobile = false } = {}) {
  const { result } = await send("Target.createTarget", { url: "about:blank" });
  const targetId = result.targetId;
  const { result: att } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sid = att.sessionId;
  const errors = [], warnings = [], badReqs = [];
  listeners.push(m => {
    if (m.sessionId !== sid) return;
    if (m.method === "Runtime.exceptionThrown") {
      const ex = m.params.exceptionDetails;
      errors.push("EXCEPTION: " + (ex.exception?.description || ex.text || "").split("\n")[0]);
    }
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error"))
      errors.push("console.error: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "warning")
      warnings.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 120));
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400)
      badReqs.push(m.params.response.status + " " + m.params.response.url.slice(0, 100));
  });
  await send("Runtime.enable", {}, sid);
  await send("Network.enable", {}, sid);
  await send("Page.enable", {}, sid);
  if (mobile) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sid);
  else await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
  await send("Page.navigate", { url: BASE + path }, sid);
  await sleep(3500); // let JS + Supabase boot run
  const label = `${name}${mobile ? " [mobile]" : ""}`;
  const filtBad = badReqs.filter(b => !/favicon/.test(b));
  console.log(`\n─ ${label} (${path}) ─`);
  console.log(`  console errors: ${errors.length}${errors.length ? "\n    " + errors.join("\n    ") : ""}`);
  console.log(`  failed requests(>=400): ${filtBad.length}${filtBad.length ? "\n    " + filtBad.join("\n    ") : ""}`);
  return { sid, targetId, errors, badReqs: filtBad, warnings };
}

async function evalOn(sid, expr) {
  const { result } = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid);
  return result.result?.value;
}
async function closeTarget(targetId) { await send("Target.closeTarget", { targetId }); }

const summary = [];
// ---- HOME + interactions ----
{
  const h = await testPage("home", "/");
  // hero photo loaded?
  const heroLoaded = await evalOn(h.sid, `(()=>{const i=document.querySelector('.hero-photo img');return i? (i.complete && i.naturalWidth>0):'NO_IMG';})()`);
  console.log(`  hero photo loaded (naturalWidth>0): ${heroLoaded}`);
  // broken images anywhere?
  const broken = await evalOn(h.sid, `Array.from(document.images).filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc||i.src).slice(0,10)`);
  console.log(`  broken images: ${JSON.stringify(broken)}`);
  // language switcher
  const langBefore = await evalOn(h.sid, `document.querySelector('[data-i18n="hero_h1"]')?.textContent?.slice(0,30)`);
  await evalOn(h.sid, `document.querySelector('#lang button[data-l="it"]')?.click()`);
  await sleep(400);
  const langIt = await evalOn(h.sid, `document.querySelector('[data-i18n="hero_h1"]')?.textContent`);
  const itOk = /livello successivo/.test(langIt||"") && /visibilità/.test(langIt||"");
  console.log(`  lang switch EN->IT works + à renders: ${itOk}  ("${(langIt||"").slice(0,60)}...")`);
  await evalOn(h.sid, `document.querySelector('#lang button[data-l="es"]')?.click()`); await sleep(300);
  const langEs = await evalOn(h.sid, `document.querySelector('[data-i18n="hero_h1"]')?.textContent`);
  console.log(`  lang switch ->ES works: ${/béisbol|beisbol/i.test(langEs||"")}`);
  await evalOn(h.sid, `document.querySelector('#lang button[data-l="en"]')?.click()`); await sleep(200);
  // application dropdown switching
  const dropOpts = await evalOn(h.sid, `Array.from(document.querySelectorAll('#applyingSelect option')).map(o=>o.value)`);
  console.log(`  dropdown options: ${JSON.stringify(dropOpts)}`);
  // select Teams and Scouts -> teams fields visible, rep hidden
  const teamsCheck = await evalOn(h.sid, `(()=>{const s=document.getElementById('applyingSelect');s.value='Teams and Scouts';s.dispatchEvent(new Event('change'));
    const nameOrTeam=document.querySelector('[name="name_or_team"]'); const firstName=document.querySelector('[name="first_name"]');
    const repHidden = firstName.closest('.af').hidden; const teamsShown = !nameOrTeam.closest('.af').hidden;
    return {teamsShown, repHidden};})()`);
  console.log(`  Teams&Scouts selected -> teams fields shown=${teamsCheck.teamsShown}, rep hidden=${teamsCheck.repHidden}`);
  const collegeCheck = await evalOn(h.sid, `(()=>{const s=document.getElementById('applyingSelect');s.value='College Placement';s.dispatchEvent(new Event('change'));
    const dip=document.querySelector('[name="diploma"]'); const teams=document.querySelector('[name="name_or_team"]');
    return {collegeShown: !dip.closest('.af').hidden, teamsHidden: teams.closest('.af').hidden};})()`);
  console.log(`  College selected -> college docs shown=${collegeCheck.collegeShown}, teams hidden=${collegeCheck.teamsHidden}`);
  // T&C blocks submit when unchecked
  const tcBlocks = await evalOn(h.sid, `(()=>{const f=document.getElementById('applyForm');const s=document.getElementById('applyingSelect');s.value='Baseball Representation';s.dispatchEvent(new Event('change'));
    document.getElementById('joinTc').checked=false; f.requestSubmit(); const msg=document.getElementById('formMsg'); return (msg.classList.contains('err')||msg.textContent.length>0);})()`);
  console.log(`  T&C unchecked blocks submit (shows msg): ${tcBlocks}`);
  summary.push(["home", h.errors.length, h.badReqs.length]);
  await closeTarget(h.targetId);
}
// ---- other pages ----
for (const [name, path] of [["register","/register/"],["scout","/scout/"],["portal","/portal/"],["admin","/admin/"],["tenerife","/tenerife/"]]) {
  const r = await testPage(name, path);
  summary.push([name, r.errors.length, r.badReqs.length]);
  await closeTarget(r.targetId);
}
// ---- mobile home ----
{ const m = await testPage("home", "/", { mobile:true });
  const overflow = await evalOn(m.sid, `document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  console.log(`  mobile horizontal overflow px (0 = none): ${overflow}`);
  summary.push(["home-mobile", m.errors.length, m.badReqs.length]);
  await closeTarget(m.targetId);
}

console.log("\n================ SUMMARY ================");
for (const [n,e,b] of summary) console.log(`  ${n.padEnd(14)} console-errors=${e}  failed-requests=${b}`);
ws.close();
