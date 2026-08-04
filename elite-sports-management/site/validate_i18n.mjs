// Headless site validator (run: `node validate_i18n.mjs` from site/).
// For every i18n page it checks: (1) all <script> blocks parse, (2) a language switcher
// exists, (3) every data-i18n* key used in the HTML resolves in EN/ES/IT with full key
// parity and no key-name fallbacks, and (4) flags short UI strings whose ES/IT is much
// longer than EN (possible overflow — manual glance). Exit code 1 if any hard problem.
import fs from "node:fs";

const PAGES = [
  "index.html", "portal/index.html", "scout/index.html",
  "register/index.html", "tenerife/index.html", "players/adam-moser.html",
];

// string-aware balanced {...} from the opening brace at `open`
function balanced(s, open){
  let d = 0, q = null;
  for (let i = open; i < s.length; i++){
    const c = s[i];
    if (q){ if (c === "\\"){ i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`"){ q = c; continue; }
    if (c === "{") d++;
    else if (c === "}"){ if (--d === 0) return s.slice(open, i + 1); }
  }
  return null;
}
function getDict(s){
  const m = s.match(/\{[\s\n]*en\s*:\s*\{/); if (!m) return null;
  const obj = balanced(s, m.index); if (!obj) return null;
  try { return eval("(" + obj + ")"); } catch { return null; }
}

let problems = 0;
for (const f of PAGES){
  const s = fs.readFileSync(f, "utf8");
  // 1) scripts parse
  for (const m of s.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)){
    let b = m[1].replace(/import\s+\{[^}]*\}\s+from\s+["'][^"']*["'];/g, "const createClient=()=>({});");
    try { new Function("(async()=>{" + b + "})();"); }
    catch (e){ console.log("PARSE ERR", f, e.message); problems++; }
  }
  // 2) switcher
  if (!/id="lang(sw)?"/.test(s)){ console.log("NO SWITCHER", f); problems++; }
  // 3) key resolution + parity
  const D = getDict(s);
  if (!D){ console.log("NO DICT", f); problems++; continue; }
  const used = [...new Set([...s.matchAll(/data-i18n(?:-html|-ph|-tpl)?="([^"]+)"/g)].map(m => m[1]))];
  const langs = ["en", "es", "it"].filter(l => D[l]);
  for (const k of used) for (const l of langs){
    const v = D[l][k];
    if (v === undefined){ console.log("MISSING", f, l, k); problems++; }
    else if (v === k){ console.log("SELF-REF", f, l, k); problems++; }
  }
  for (const l of ["es", "it"]) if (D[l]) for (const k of Object.keys(D.en || {}))
    if (D[l][k] === undefined){ console.log("PARITY-GAP", f, l, k); problems++; }
  // 4) length-overflow flags (advisory, not counted as problems)
  for (const k of Object.keys(D.en || {})){
    const en = String(D.en[k] || ""), es = String(D.es?.[k] || ""), it = String(D.it?.[k] || "");
    if (/[<→←]/.test(en) || !en || en.length > 26) continue;
    const mx = Math.max(es.length, it.length);
    if (mx >= en.length + 10 && mx / Math.max(en.length, 1) >= 1.6)
      console.log("LEN-FLAG(advisory)", f.replace("/index.html", ""), k, `EN"${en}" ES"${es}" IT"${it}"`);
  }
  console.log("OK", f, `langs=${langs.join("/")} keys=${Object.keys(D.en).length} used=${used.length}`);
}
console.log("--- hard problems:", problems, "---");
process.exit(problems ? 1 : 0);
