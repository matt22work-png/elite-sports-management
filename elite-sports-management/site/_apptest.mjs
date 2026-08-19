// Application-form file-upload e2e (College path), browser-style: anon uploads to
// buckets then inserts the players row with the URLs/paths. Verifies public photo is
// readable, private docs are NOT, then reports the created slug for cleanup.
const URL = "https://sbexwyvsgqayxrsrlrpm.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXh3eXZzZ3FheXhyc3JscnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjY5NTYsImV4cCI6MjA5NjA0Mjk1Nn0.PWBwZ0oEYvQeA_ZMdahRA9cVqQv27fwN-1npU1XqTdw";
const H = { apikey:KEY, Authorization:`Bearer ${KEY}` };
const ts = process.hrtime.bigint().toString();
const key = `esmtest-college-${ts}`;
const pass=[]; const fail=[];
const chk=(n,ok,d)=>{ (ok?pass:fail).push(n); console.log(`${ok?"PASS":"FAIL"}  ${n}${d?"  — "+d:""}`); };

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function up(bucket, path, buf, ctype){
  const r = await fetch(`${URL}/storage/v1/object/${bucket}/${path}`, {method:"POST",headers:{...H,"Content-Type":ctype},body:buf});
  return r.status;
}
// uploads
const s1 = await up("application-photos", `${key}/photo.png`, PNG, "image/png");
chk("upload headshot -> application-photos", s1===200, `http=${s1}`);
const s2 = await up("application-docs", `${key}/resume.pdf`, PDF, "application/pdf");
const s3 = await up("application-docs", `${key}/english-cert.pdf`, PDF, "application/pdf");
const s4 = await up("application-docs", `${key}/diploma.pdf`, PDF, "application/pdf");
chk("upload resume/english/diploma -> application-docs", s2===200&&s3===200&&s4===200, `http=${s2}/${s3}/${s4}`);

const photoUrl = `${URL}/storage/v1/object/public/application-photos/${key}/photo.png`;
// insert row
const row = { slug:key, name:"Test College Applicant", "group":"Applicant", sport:"Baseball",
  applying_for:"College Placement", bio:"—", nationality:"Italy", email:"t@example.com",
  phone:"+39 333 1", country:"Italy", position:"Pitcher", age:"18",
  image_url:photoUrl, resume_url:`${key}/resume.pdf`, english_cert_url:`${key}/english-cert.pdf`,
  diploma_url:`${key}/diploma.pdf`, education_level:"High School", study_goals:"Sports Science; scholarship",
  source:"application", status:"pending" };
const ir = await fetch(`${URL}/rest/v1/players`, {method:"POST",headers:{...H,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(row)});
chk("insert College application row (all fields)", ir.status===201, `http=${ir.status}`);

// public photo readable
const pr = await fetch(photoUrl);
chk("anon CAN read public headshot", pr.status===200 && (pr.headers.get("content-type")||"").includes("image"), `http=${pr.status}`);
// private docs NOT readable by anon
const dr1 = await fetch(`${URL}/storage/v1/object/public/application-docs/${key}/resume.pdf`);
const dr2 = await fetch(`${URL}/storage/v1/object/application-docs/${key}/resume.pdf`, {headers:H});
const dr3 = await fetch(`${URL}/storage/v1/object/sign/application-docs/${key}/resume.pdf`, {method:"POST",headers:{...H,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:60})});
chk("anon CANNOT read/sign private resume PDF", dr1.status>=400&&dr2.status>=400&&dr3.status>=400, `public=${dr1.status} authed=${dr2.status} sign=${dr3.status}`);

import fs from "fs";
fs.writeFileSync("_apptest_key.txt", key);
console.log(`\nSUMMARY ${pass.length}/${pass.length+fail.length} passed; slug=${key}`);
