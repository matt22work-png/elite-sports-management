/* ============================================================================
   ESM — Baseball-Reference-style "Register" stats: shared client module.
   Single source of truth for column layout, the derived-stat math (mirroring the
   Supabase calc triggers in supabase-bbref-stats.sql), the "All Levels" totals
   row, and the read-only public table renderer. Loaded as a classic <script> by
   the admin editor, the homepage player modal, and the static player pages.
   Plain ES5-ish JS, no deps — attaches window.BBREF.
   ============================================================================ */
(function () {
  "use strict";

  // IP / INN are stored in baseball notation (0.1 = 1 out, 0.2 = 2 outs). Convert
  // to real innings for every rate calc: outs = floor*3 + fracDigit, real = outs/3.
  function ipToReal(ip) {
    if (ip == null || ip === "") return null;
    var n = Number(ip); if (!isFinite(n)) return null;
    var whole = Math.trunc(n), frac = Math.round((n - whole) * 10);
    return whole + frac / 3;
  }
  // sum of IPs (baseball notation) -> baseball notation, via outs (5.2 + 5.2 = 11.1)
  function sumIpNotation(list) {
    var outs = 0, any = false;
    for (var i = 0; i < list.length; i++) {
      var v = list[i]; if (v == null || v === "") continue;
      var real = ipToReal(v); if (real == null) continue;
      outs += Math.round(real * 3); any = true;
    }
    if (!any) return null;
    return Math.floor(outs / 3) + (outs % 3) / 10;
  }
  function numOr0(v) { if (v == null || v === "") return 0; var n = Number(v); return isFinite(n) ? n : 0; }

  // ---- display formatting ----
  function f3(x) { return (x == null || !isFinite(x)) ? "—" : x.toFixed(3).replace(/^(-?)0\./, "$1."); } // .317 / 1.000
  function f2(x) { return (x == null || !isFinite(x)) ? "—" : x.toFixed(2); }
  function f1(x) { return (x == null || !isFinite(x)) ? "—" : x.toFixed(1); }
  function fInt(x) { return (x == null || !isFinite(x)) ? "—" : String(Math.round(x)); }
  function fIp(x) { return (x == null || !isFinite(x)) ? "" : Number(x).toFixed(1); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Column layout per stat kind, in Baseball-Reference order.
  //   type: 'num' = editable integer  |  'txt' = editable text (year/team/IP notation)
  //         'calc' = read-only, computed from raw (fmt = display formatter)
  var COLUMNS = {
    batting: [
      { k: "year", h: "Year", type: "txt" }, { k: "age", h: "Age", type: "num" }, { k: "age_dif", h: "AgeDif", type: "txt" },
      { k: "tm", h: "Tm", type: "txt" }, { k: "lg", h: "Lg", type: "txt" }, { k: "lev", h: "Lev", type: "txt" }, { k: "aff", h: "Aff", type: "txt" },
      { k: "g", h: "G", type: "num" }, { k: "pa", h: "PA", type: "num" }, { k: "ab", h: "AB", type: "num" }, { k: "r", h: "R", type: "num" }, { k: "h", h: "H", type: "num" },
      { k: "doubles", h: "2B", type: "num" }, { k: "triples", h: "3B", type: "num" }, { k: "hr", h: "HR", type: "num" }, { k: "rbi", h: "RBI", type: "num" },
      { k: "sb", h: "SB", type: "num" }, { k: "cs", h: "CS", type: "num" }, { k: "bb", h: "BB", type: "num" }, { k: "so", h: "SO", type: "num" },
      { k: "ba", h: "BA", type: "calc", fmt: f3 }, { k: "obp", h: "OBP", type: "calc", fmt: f3 }, { k: "slg", h: "SLG", type: "calc", fmt: f3 }, { k: "ops", h: "OPS", type: "calc", fmt: f3 }, { k: "tb", h: "TB", type: "calc", fmt: fInt },
      { k: "hbp", h: "HBP", type: "num" }, { k: "sh", h: "SH", type: "num" }, { k: "sf", h: "SF", type: "num" }, { k: "ibb", h: "IBB", type: "num" }, { k: "gdp", h: "GDP", type: "num" }
    ],
    pitching: [
      { k: "year", h: "Year", type: "txt" }, { k: "age", h: "Age", type: "num" }, { k: "age_dif", h: "AgeDif", type: "txt" },
      { k: "tm", h: "Tm", type: "txt" }, { k: "lg", h: "Lg", type: "txt" }, { k: "lev", h: "Lev", type: "txt" }, { k: "aff", h: "Aff", type: "txt" },
      { k: "w", h: "W", type: "num" }, { k: "l", h: "L", type: "num" }, { k: "w_l_pct", h: "W-L%", type: "calc", fmt: f3 },
      { k: "era", h: "ERA", type: "calc", fmt: f2 }, { k: "ra9", h: "RA9", type: "calc", fmt: f2 },
      { k: "g", h: "G", type: "num" }, { k: "gs", h: "GS", type: "num" }, { k: "gf", h: "GF", type: "num" }, { k: "cg", h: "CG", type: "num" }, { k: "sho", h: "SHO", type: "num" }, { k: "sv", h: "SV", type: "num" },
      { k: "ip", h: "IP", type: "txt" },
      { k: "h", h: "H", type: "num" }, { k: "r", h: "R", type: "num" }, { k: "er", h: "ER", type: "num" }, { k: "hr", h: "HR", type: "num" }, { k: "bb", h: "BB", type: "num" }, { k: "ibb", h: "IBB", type: "num" }, { k: "so", h: "SO", type: "num" }, { k: "hbp", h: "HBP", type: "num" }, { k: "bk", h: "BK", type: "num" }, { k: "wp", h: "WP", type: "num" }, { k: "bf", h: "BF", type: "num" },
      { k: "whip", h: "WHIP", type: "calc", fmt: f3 }, { k: "h9", h: "H9", type: "calc", fmt: f1 }, { k: "hr9", h: "HR9", type: "calc", fmt: f1 }, { k: "bb9", h: "BB9", type: "calc", fmt: f1 }, { k: "so9", h: "SO9", type: "calc", fmt: f1 }, { k: "so_w", h: "SO/W", type: "calc", fmt: f2 }
    ],
    fielding: [
      { k: "year", h: "Year", type: "txt" }, { k: "age", h: "Age", type: "num" },
      { k: "tm", h: "Tm", type: "txt" }, { k: "lg", h: "Lg", type: "txt" }, { k: "lev", h: "Lev", type: "txt" }, { k: "aff", h: "Aff", type: "txt" },
      { k: "position", h: "Pos", type: "txt" },
      { k: "g", h: "G", type: "num" }, { k: "gs", h: "GS", type: "num" }, { k: "cg", h: "CG", type: "num" }, { k: "inn", h: "Inn", type: "txt" },
      { k: "ch", h: "Ch", type: "num" }, { k: "po", h: "PO", type: "num" }, { k: "a", h: "A", type: "num" }, { k: "e", h: "E", type: "num" }, { k: "dp", h: "DP", type: "num" },
      { k: "fld_pct", h: "Fld%", type: "calc", fmt: f3 }, { k: "rf9", h: "RF/9", type: "calc", fmt: f2 }, { k: "rf_g", h: "RF/G", type: "calc", fmt: f2 },
      { k: "pb", h: "PB", type: "num" }, { k: "wp", h: "WP", type: "num" }, { k: "sb", h: "SB", type: "num" }, { k: "cs", h: "CS", type: "num" },
      { k: "cs_pct", h: "CS%", type: "calc", fmt: f3 }, { k: "lg_cs_pct", h: "lgCS%", type: "txt" }
    ]
  };

  function rawNumKeys(kind) {
    return COLUMNS[kind].filter(function (c) { return c.type === "num"; }).map(function (c) { return c.k; });
  }

  // Derived stats from one row's raw values — mirrors the SQL triggers exactly.
  function calc(kind, r) {
    r = r || {};
    var n = function (k) { return numOr0(r[k]); };
    if (kind === "batting") {
      var ab = n("ab"), h = n("h"), bb = n("bb"), hbp = n("hbp"), sf = n("sf");
      var tb = h + n("doubles") + 2 * n("triples") + 3 * n("hr");
      var den = ab + bb + hbp + sf;
      var ba = ab > 0 ? h / ab : null, obp = den > 0 ? (h + bb + hbp) / den : null, slg = ab > 0 ? tb / ab : null;
      var ops = (obp != null || slg != null) ? ((obp || 0) + (slg || 0)) : null;
      var anyRaw = ["ab", "h", "doubles", "triples", "hr"].some(function (k) { return r[k] != null && r[k] !== ""; });
      return { ba: ba, obp: obp, slg: slg, ops: ops, tb: anyRaw ? tb : null };
    }
    if (kind === "pitching") {
      var ipr = ipToReal(r.ip), w = n("w"), l = n("l");
      var rate = function (x) { return (ipr != null && ipr > 0) ? x * 9 / ipr : null; };
      return {
        w_l_pct: (w + l) > 0 ? w / (w + l) : null,
        era: rate(n("er")), ra9: rate(n("r")),
        whip: (ipr != null && ipr > 0) ? (n("bb") + n("h")) / ipr : null,
        h9: rate(n("h")), hr9: rate(n("hr")), bb9: rate(n("bb")), so9: rate(n("so")),
        so_w: n("bb") > 0 ? n("so") / n("bb") : null
      };
    }
    // fielding
    var po = n("po"), a = n("a"), e = n("e"), sb = n("sb"), cs = n("cs"), fden = po + a + e, innr = ipToReal(r.inn);
    return {
      fld_pct: fden > 0 ? (po + a) / fden : null,
      rf9: (innr != null && innr > 0) ? (po + a) * 9 / innr : null,
      rf_g: n("g") > 0 ? (po + a) / n("g") : null,
      cs_pct: (cs + sb) > 0 ? cs / (cs + sb) : null
    };
  }

  // "All Levels" totals: sum the RAW stats across rows, then recompute derived
  // stats FROM the summed raw (not averaged) — matching how Baseball-Reference does it.
  function totals(kind, rows) {
    var sum = {}, keys = rawNumKeys(kind), i, j;
    for (i = 0; i < keys.length; i++) sum[keys[i]] = 0;
    for (i = 0; i < rows.length; i++) {
      for (j = 0; j < keys.length; j++) {
        var v = rows[i][keys[j]];
        if (v != null && v !== "") sum[keys[j]] += numOr0(v);
      }
    }
    var ipField = kind === "pitching" ? "ip" : (kind === "fielding" ? "inn" : null);
    var ipNotation = null;
    if (ipField) {
      ipNotation = sumIpNotation(rows.map(function (r) { return r[ipField]; }));
      sum[ipField] = ipNotation;
    }
    return { sum: sum, calc: calc(kind, sum), ipNotation: ipNotation };
  }

  function distinctSeasons(rows) {
    var s = {};
    for (var i = 0; i < rows.length; i++) {
      var y = String(rows[i].year == null ? "" : rows[i].year).trim();
      if (y) s[y] = 1;
    }
    return Object.keys(s).length;
  }

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      var ay = String(a.year || ""), by = String(b.year || "");
      if (ay !== by) return ay < by ? -1 : 1;
      return ((a.sort_order || 0) - (b.sort_order || 0)) || ((a.id || 0) - (b.id || 0));
    });
  }

  // ---- read-only renderer (public profile display) ----
  function renderTable(kind, rows) {
    if (!rows || !rows.length) return "";
    var cols = COLUMNS[kind], sorted = sortRows(rows);
    var head = cols.map(function (c) { return "<th>" + esc(c.h) + "</th>"; }).join("");
    var body = sorted.map(function (r) {
      var comp = calc(kind, r);
      return "<tr>" + cols.map(function (c) {
        if (c.type === "calc") return '<td class="bb-c">' + c.fmt(comp[c.k]) + "</td>";
        var v = r[c.k];
        var val = (v == null || v === "") ? "" : esc(v);
        if (c.k === "year") return '<td class="bb-yr">' + val + "</td>";
        return "<td>" + val + "</td>";
      }).join("") + "</tr>";
    }).join("");
    var tot = totals(kind, rows), nS = distinctSeasons(rows);
    var totCells = cols.map(function (c, i) {
      if (i === 0) return '<td class="bb-yr">All Levels (' + nS + " Season" + (nS === 1 ? "" : "s") + ")</td>";
      if (c.type === "calc") return '<td class="bb-c">' + c.fmt(tot.calc[c.k]) + "</td>";
      if (c.type === "num") return "<td>" + (tot.sum[c.k] ? tot.sum[c.k] : "") + "</td>";
      if ((kind === "pitching" && c.k === "ip") || (kind === "fielding" && c.k === "inn")) return "<td>" + fIp(tot.ipNotation) + "</td>";
      return "<td></td>";
    }).join("");
    return '<div class="bb-scroll"><table class="bb-table"><thead><tr>' + head + "</tr></thead><tbody>" + body +
      '</tbody><tfoot><tr class="bb-tot">' + totCells + "</tr></tfoot></table></div>";
  }

  // data = { batting:[], pitching:[], fielding:[] } -> full HTML (only non-empty sections)
  function renderAll(data, labels) {
    labels = labels || { batting: "Batting", pitching: "Pitching", fielding: "Fielding" };
    var order = ["batting", "pitching", "fielding"], out = "";
    for (var i = 0; i < order.length; i++) {
      var k = order[i], t = renderTable(k, (data && data[k]) || []);
      if (t) out += '<div class="bb-block"><div class="bb-title">' + esc(labels[k]) + "</div>" + t + "</div>";
    }
    return out;
  }

  // Default CSS for the read-only tables — injected once by injectCss() so every
  // consumer (modal + static pages) looks consistent without duplicating styles.
  var CSS =
    ".bb-block{margin:0 0 22px}.bb-title{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#e7c878;font-weight:800;margin:0 0 8px}" +
    ".bb-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(217,177,84,.22);border-radius:12px}" +
    ".bb-table{border-collapse:collapse;font-size:12.5px;min-width:max-content;width:100%}" +
    ".bb-table th,.bb-table td{padding:6px 9px;text-align:right;white-space:nowrap;border-bottom:1px solid rgba(217,177,84,.1)}" +
    ".bb-table thead th{position:sticky;top:0;color:#e7c878;font-weight:700;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;background:rgba(8,26,51,.96)}" +
    ".bb-table tbody td{color:#d6e1f2}.bb-table .bb-yr{text-align:left;font-weight:700;color:#eaf0fa}" +
    ".bb-table .bb-c{color:#5fb8c2;font-weight:600}" +
    ".bb-table tbody tr:nth-child(even) td{background:rgba(8,26,51,.4)}" +
    ".bb-table tfoot .bb-tot td{font-weight:800;color:#eaf0fa;border-top:2px solid rgba(217,177,84,.35);background:rgba(217,177,84,.06)}" +
    ".bb-table tfoot .bb-tot .bb-c{color:#8fd4dc}";
  function injectCss() {
    if (typeof document === "undefined" || document.getElementById("bbref-css")) return;
    var s = document.createElement("style"); s.id = "bbref-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  window.BBREF = {
    ipToReal: ipToReal, sumIpNotation: sumIpNotation, numOr0: numOr0,
    COLUMNS: COLUMNS, rawNumKeys: rawNumKeys, calc: calc, totals: totals,
    distinctSeasons: distinctSeasons, sortRows: sortRows, esc: esc,
    fmt: { f3: f3, f2: f2, f1: f1, fInt: fInt, fIp: fIp },
    renderTable: renderTable, renderAll: renderAll, injectCss: injectCss, TABLES: {
      batting: "player_batting_stats", pitching: "player_pitching_stats", fielding: "player_fielding_stats"
    }
  };
})();
