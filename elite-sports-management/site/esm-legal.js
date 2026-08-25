/* ============================================================================
   ESM — GDPR cookie notice + footer legal links (single source, all pages)
   ----------------------------------------------------------------------------
   Included on every page via <script src="/esm-legal.js"></script>. Injects:
     1. A one-time, informational cookie/local-storage notice (bottom banner).
     2. Footer "Privacy Policy · Terms" links (appended to <footer>, or a
        standalone line on pages without a footer).

   INFORMATIONAL, not a consent gate: the site uses ONLY essential/functional
   storage (auth session, language preference, roster access, registration tier)
   and NO advertising, analytics, or third-party tracking. GDPR requires consent
   only for non-essential tracking — there is none here — so this discloses the
   essential storage and lets the visitor dismiss it. If a tracker is ever added,
   turn this into a real opt-in gate before that tracker runs.

   Trilingual EN/ES/IT via the site-wide `esm_lang` localStorage key; re-renders
   when the visitor uses any page's EN/ES/IT switch (all use [data-l] buttons).
   Paths are absolute (site deploys at the domain root on Vercel), so the same
   file works from /, /players/, /register/, etc.
   ========================================================================== */
(function () {
  "use strict";

  var SUP = ["en", "es", "it"];
  var CONSENT_KEY = "esm_cookie_consent"; // "1" once the notice has been dismissed

  var T = {
    en: {
      msg: "This site uses essential cookies and local storage to keep you signed in, remember your language, and store your roster access — nothing for advertising or third-party tracking.",
      accept: "Got it",
      privacy: "Privacy Policy",
      terms: "Terms",
      aria: "Cookie notice"
    },
    es: {
      msg: "Este sitio usa cookies esenciales y almacenamiento local para mantener tu sesión, recordar tu idioma y guardar tu acceso al roster — nada para publicidad ni rastreo de terceros.",
      accept: "Entendido",
      privacy: "Política de Privacidad",
      terms: "Términos",
      aria: "Aviso de cookies"
    },
    it: {
      msg: "Questo sito usa cookie essenziali e archiviazione locale per mantenerti connesso, ricordare la tua lingua e conservare il tuo accesso al roster — niente per pubblicità o tracciamento di terze parti.",
      accept: "Ho capito",
      privacy: "Informativa sulla Privacy",
      terms: "Termini",
      aria: "Avviso sui cookie"
    }
  };

  function curLang() {
    try {
      var l = localStorage.getItem("esm_lang");
      return SUP.indexOf(l) >= 0 ? l : "en";
    } catch (e) {
      return "en";
    }
  }
  function t(k) {
    var l = curLang();
    return (T[l] && T[l][k]) || T.en[k] || k;
  }
  function consented() {
    try {
      return localStorage.getItem(CONSENT_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  /* One-time scoped styles (classnames prefixed `esml-` to avoid collisions).
     Literal colour values mirror the site's --navy-2/--gold/--ink/... tokens so
     the notice looks native on pages that don't define those CSS variables. */
  function injectStyles() {
    if (document.getElementById("esml-style")) return;
    var css =
      ".esml-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;" +
      "background:rgba(6,20,42,.97);border-top:1px solid rgba(217,177,84,.3);" +
      "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" +
      "box-shadow:0 -14px 40px rgba(0,0,0,.4);" +
      "padding:14px 18px calc(14px + env(safe-area-inset-bottom,0px));" +
      "font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif}" +
      ".esml-in{max-width:1000px;margin:0 auto;display:flex;gap:16px;" +
      "align-items:center;flex-wrap:wrap;justify-content:center}" +
      ".esml-msg{flex:1;min-width:240px;color:#cdd9ec;font-size:13.5px;line-height:1.55}" +
      ".esml-msg a{color:#e7c878;font-weight:700;text-decoration:underline}" +
      ".esml-accept{flex:none;background:#d9b154;color:#05101f;border:0;border-radius:999px;" +
      "padding:11px 22px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;" +
      "letter-spacing:.02em;transition:background .2s,transform .2s}" +
      ".esml-accept:hover{background:#e7c878;transform:translateY(-1px)}" +
      ".esml-accept:focus-visible{outline:2px solid #d9b154;outline-offset:2px}" +
      "@media(max-width:560px){.esml-in{flex-direction:column;align-items:stretch}" +
      ".esml-accept{width:100%}}" +
      /* footer legal links */
      ".esml-foot{display:flex;gap:12px;align-items:center;justify-content:center;" +
      "flex-wrap:wrap;font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:12.5px;" +
      "margin-top:14px}" +
      ".esml-foot a{color:#9fb1cc;font-weight:700;text-decoration:none;transition:color .2s}" +
      ".esml-foot a:hover{color:#e7c878}" +
      ".esml-foot span{color:rgba(159,177,204,.5)}" +
      ".esml-foot-standalone{padding:22px 16px calc(26px + env(safe-area-inset-bottom,0px))}";
    var s = document.createElement("style");
    s.id = "esml-style";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- Cookie notice ---- */
  var bannerEl = null;
  function buildBanner() {
    if (consented() || bannerEl) return;
    injectStyles();
    bannerEl = document.createElement("div");
    bannerEl.className = "esml-banner";
    bannerEl.setAttribute("role", "region");
    bannerEl.setAttribute("aria-label", t("aria"));
    bannerEl.innerHTML =
      '<div class="esml-in">' +
      '<div class="esml-msg"><span class="esml-msg-text"></span> ' +
      '<a href="/privacy/" class="esml-msg-link"></a></div>' +
      '<button type="button" class="esml-accept"></button>' +
      "</div>";
    renderBanner();
    bannerEl.querySelector(".esml-accept").addEventListener("click", function () {
      try {
        localStorage.setItem(CONSENT_KEY, "1");
      } catch (e) {}
      if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
      bannerEl = null;
    });
    document.body.appendChild(bannerEl);
  }
  function renderBanner() {
    if (!bannerEl) return;
    bannerEl.setAttribute("aria-label", t("aria"));
    bannerEl.querySelector(".esml-msg-text").textContent = t("msg");
    var link = bannerEl.querySelector(".esml-msg-link");
    link.textContent = t("privacy");
    bannerEl.querySelector(".esml-accept").textContent = t("accept");
  }

  /* ---- Footer legal links ---- */
  var footEl = null;
  function buildFooter() {
    if (footEl) return;
    injectStyles();
    footEl = document.createElement("div");
    footEl.className = "esml-foot";
    footEl.innerHTML =
      '<a href="/privacy/" class="esml-foot-privacy"></a>' +
      "<span>·</span>" +
      '<a href="/terms.html" class="esml-foot-terms"></a>';
    renderFooter();
    var foot = document.querySelector("footer");
    if (foot) {
      foot.appendChild(footEl);
    } else {
      footEl.classList.add("esml-foot-standalone");
      document.body.appendChild(footEl);
    }
  }
  function renderFooter() {
    if (!footEl) return;
    footEl.querySelector(".esml-foot-privacy").textContent = t("privacy");
    footEl.querySelector(".esml-foot-terms").textContent = t("terms");
  }

  function render() {
    renderBanner();
    renderFooter();
  }

  function init() {
    buildFooter();
    buildBanner();
    /* Re-translate when the visitor switches language on any page. All pages use
       [data-l] EN/ES/IT buttons that set esm_lang; run after their handler. */
    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-l]");
      if (!b) return;
      if (SUP.indexOf(b.getAttribute("data-l")) < 0) return;
      setTimeout(render, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
