// End-to-end flow test harness (player + scout). Run: node _flowtest.mjs
// Uses only the public anon key + real auth signups, exactly as a browser would.
const URL = "https://sbexwyvsgqayxrsrlrpm.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhc2UiLCJyZWYiOiJzYmV4d3l2c2dxYXl4cnNybHJwbSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgwNDY2OTU2LCJleHAiOjIwOTYwNDI5NTZ9.PWBwZ0oEYvQeA_ZMdahRA9cVqQv27fwN-1npU1XqTdw";
// NOTE: anon key above is intentionally the real public one used by the site.
const REAL_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXh3eXZzZ3FheXhyc3JscnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjY5NTYsImV4cCI6MjA5NjA0Mjk1Nn0.PWBwZ0oEYvQeA_ZMdahRA9cVqQv27fwN-1npU1XqTdw";
const KEY = REAL_ANON;

const ts = process.hrtime.bigint().toString();
const results = [];
function log(name, ok, detail){ results.push({name, ok, detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  — "+detail:""}`); }

async function signup(email, role, first, last){
  const r = await fetch(`${URL}/auth/v1/signup`, { method:"POST", headers:{apikey:KEY,"Content-Type":"application/json"},
    body: JSON.stringify({email, password:"TestPass123!", data:{first_name:first,last_name:last,role}}) });
  const j = await r.json();
  return { token: j.access_token, uid: j.user?.id, raw:j };
}
function auth(tok){ return { apikey:KEY, Authorization:`Bearer ${tok}`, "Content-Type":"application/json" }; }
function anon(){ return { apikey:KEY, Authorization:`Bearer ${KEY}`, "Content-Type":"application/json" }; }

async function rest(method, path, headers, body, prefer){
  const h = {...headers}; if(prefer) h.Prefer = prefer;
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers:h, body: body?JSON.stringify(body):undefined });
  let data=null; try{ data = await r.json(); }catch(e){}
  return { status:r.status, data };
}

const created = { players:[], profiles:[], scouts:[], uids:[] };

// ---------------- PLAYER FLOW ----------------
async function playerFlow(){
  const email = `esmtest.player.${ts}@example.com`;
  const su = await signup(email, "player", "Test","Player");
  if(!su.token){ log("player signup", false, JSON.stringify(su.raw).slice(0,150)); return; }
  log("player signup returns session (no email-confirm block)", !!su.token, `uid=${su.uid?.slice(0,8)}`);
  created.uids.push(su.uid);
  const H = auth(su.token);

  const p1 = await rest("POST","profiles",H,{id:su.uid,role:"player",first_name:"Test",last_name:"Player",email,account_status:"pending",payment_status:"unpaid"},"return=minimal");
  log("player: insert OWN profile (pending/unpaid)", p1.status===201, `http=${p1.status}`);

  const slug = `esmtest-player-${ts}`;
  const pl = await rest("POST","players",H,{slug,name:"Test Player","group":"Player",position:"Pitcher",sport:"Baseball",owner_id:su.uid,status:"pending",source:"registration",email},"return=minimal");
  log("player: insert OWN player row (pending)", pl.status===201, `http=${pl.status}`);
  created.players.push(slug); created.profiles.push(su.uid);

  const rp = await rest("GET",`profiles?select=role,account_status,payment_status`,H);
  log("player: read OWN profile via RLS", rp.status===200 && Array.isArray(rp.data)&&rp.data.length===1, `http=${rp.status} rows=${rp.data?.length}`);

  const rpl = await rest("GET",`players?select=name,status,position&owner_id=eq.${su.uid}`,H);
  log("player: read OWN player row (portal data)", rpl.status===200 && rpl.data?.length===1 && rpl.data[0].position==="Pitcher", `http=${rpl.status} rows=${rpl.data?.length}`);

  // pending player must NOT be publicly visible
  const anonSee = await rest("GET",`players?select=slug&slug=eq.${slug}`,anon());
  log("player: anon CANNOT see pending player (public roster)", anonSee.status===200 && anonSee.data?.length===0, `rows=${anonSee.data?.length}`);

  // another signed-in user must NOT read this player's profile
  const other = await signup(`esmtest.other.${ts}@example.com`,"player","Other","User");
  created.uids.push(other.uid);
  if(other.token){
    const cross = await rest("GET",`profiles?select=email&id=eq.${su.uid}`,auth(other.token));
    log("player: OTHER user cannot read this profile (RLS isolation)", cross.status===200 && cross.data?.length===0, `rows=${cross.data?.length}`);
  }
}

// ---------------- SCOUT FLOW ----------------
async function scoutFlow(){
  const email = `esmtest.scout.${ts}@example.com`;
  const su = await signup(email, "scout", "Test","Scout");
  if(!su.token){ log("scout signup", false, JSON.stringify(su.raw).slice(0,150)); return; }
  log("scout signup returns session", !!su.token, `uid=${su.uid?.slice(0,8)}`);
  created.uids.push(su.uid);
  const H = auth(su.token);

  const p1 = await rest("POST","profiles",H,{id:su.uid,role:"scout",first_name:"Test",last_name:"Scout",email,account_status:"pending",payment_status:"unpaid"},"return=minimal");
  log("scout: insert OWN profile (pending)", p1.status===201, `http=${p1.status}`);
  created.profiles.push(su.uid);

  const sc = await rest("POST","scouts",H,{id:su.uid,name_or_team:"Test Scouts Org",nationality:"American",title:"Head Scout",country:"USA",phone:"+1 555 0000",looking_for:"RHP + IF"},"return=minimal");
  log("scout: insert OWN scouts row (new fields)", sc.status===201, `http=${sc.status}`);
  created.scouts.push(su.uid);

  // pending scout must get EMPTY roster from scout_roster()
  const rr = await fetch(`${URL}/rest/v1/rpc/scout_roster`, {method:"POST",headers:H,body:"{}"});
  const rrData = await rr.json();
  log("scout: PENDING scout gets EMPTY roster (scout_roster)", rr.status===200 && Array.isArray(rrData) && rrData.length===0, `http=${rr.status} rows=${Array.isArray(rrData)?rrData.length:"?"}`);
  return su.uid;
}

await playerFlow();
console.log("");
const scoutUid = await scoutFlow();

// write created ids for cleanup + approval test
import fs from "fs";
fs.writeFileSync("_flowtest_ids.json", JSON.stringify({...created, scoutUid, ts}));
console.log("\nSUMMARY:", results.filter(r=>r.ok).length+"/"+results.length, "passed");
console.log("created ids written to _flowtest_ids.json");
