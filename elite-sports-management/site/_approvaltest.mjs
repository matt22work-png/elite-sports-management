// Scout approval → roster access test. Signs in as the test scout, checks pending
// state, then (after external SQL approval) re-checks elevated roster access.
const URL = "https://sbexwyvsgqayxrsrlrpm.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXh3eXZzZ3FheXhyc3JscnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjY5NTYsImV4cCI6MjA5NjA0Mjk1Nn0.PWBwZ0oEYvQeA_ZMdahRA9cVqQv27fwN-1npU1XqTdw";
import fs from "fs";
const ids = JSON.parse(fs.readFileSync("_flowtest_ids.json","utf8"));
const email = `esmtest.scout.${ids.ts}@example.com`;
const mode = process.argv[2]; // "before" or "after"

const si = await fetch(`${URL}/auth/v1/token?grant_type=password`, {method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:"TestPass123!"})});
const sj = await si.json();
if(!sj.access_token){ console.log("SIGNIN FAIL", JSON.stringify(sj).slice(0,150)); process.exit(1); }
const H = { apikey:KEY, Authorization:`Bearer ${sj.access_token}`, "Content-Type":"application/json" };

const rr = await fetch(`${URL}/rest/v1/rpc/scout_roster`, {method:"POST",headers:H,body:"{}"});
const rows = await rr.json();
const n = Array.isArray(rows)?rows.length:-1;
const hasContact = Array.isArray(rows)&&rows.length? rows.some(r=>("email" in r)||("phone" in r)) : false;

if(mode==="before"){
  console.log(`BEFORE approval: scout_roster -> ${n} rows  (expect 0)  ${n===0?"PASS":"FAIL"}`);
} else {
  console.log(`AFTER approval: scout_roster -> ${n} rows  (expect >0)  ${n>0?"PASS":"FAIL"}`);
  console.log(`  elevated rows include contact fields (email/phone col present): ${hasContact?"YES":"no"}`);
  // also confirm the scout can now read the elevated data but a plain anon still cannot
  const anonRr = await fetch(`${URL}/rest/v1/rpc/scout_roster`, {method:"POST",headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},body:"{}"});
  const anonRows = await anonRr.json();
  console.log(`  anon calling scout_roster -> ${Array.isArray(anonRows)?anonRows.length:JSON.stringify(anonRows).slice(0,80)} rows (expect 0)`);
}
