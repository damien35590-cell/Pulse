// ==UserScript==
// @name         Pulse · courbes des sorties Strava depuis Intervals.icu
// @namespace    pulse-bay-eight
// @version      1.0.0
// @description  À l'ouverture d'intervals.icu (au plus toutes les 12 h) : demande à Pulse les sorties sans trace, lit leurs courbes dans la session du navigateur et les envoie à Pulse.
// @match        https://intervals.icu/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      pulse-bay-eight.vercel.app
// ==/UserScript==

/*
 * Pourquoi ici : Intervals.icu refuse au serveur de Pulse (401) les courbes des sorties venues de Strava,
 * mais les donne au navigateur connecté. Côté Pulse : app/api/sync/streams/route.ts, lib/sync/intervals-streams.ts.
 * Discrétion : au plus un passage toutes les 12 h, seulement les sorties qui manquent (6 au plus), espacées de quelques secondes.
 * Le secret (PULSE_STREAM_SECRET, dans Vercel) est demandé une fois et gardé dans Tampermonkey, jamais dans ce fichier.
 * Menu Tampermonkey : « Synchroniser maintenant » (ignore le délai de 12 h) et « Changer le secret ».
 */
(function () {
  "use strict";

  const PULSE = "https://pulse-bay-eight.vercel.app/api/sync/streams";
  const EVERY_MS = 12 * 3600 * 1000;
  const MAX_PER_RUN = 6;
  const log = (...a) => console.log("[Pulse]", ...a);

  function secret(ask) {
    let s = GM_getValue("secret", "");
    if (!s || ask) {
      s = (window.prompt("Pulse : colle la valeur de PULSE_STREAM_SECRET (Vercel)", s) || "").trim();
      if (s) GM_setValue("secret", s);
    }
    return s;
  }

  /** Requête vers Pulse (GM_xmlhttpRequest : pas de blocage CORS, le secret ne passe pas par la page). */
  function pulse(method, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: PULSE,
        headers: { Authorization: "Bearer " + secret(false), "Content-Type": "application/json" },
        data: body ? JSON.stringify(body) : undefined,
        timeout: 60000,
        onload: (r) => {
          let json = null;
          try { json = JSON.parse(r.responseText); } catch (e) { /* réponse non JSON */ }
          if (r.status >= 200 && r.status < 300) resolve(json);
          else reject(new Error((json && json.error) || "HTTP " + r.status));
        },
        onerror: () => reject(new Error("Pulse injoignable")),
        ontimeout: () => reject(new Error("Pulse ne répond pas")),
      });
    });
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  function toast(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 14px;border-radius:12px;background:#141417;color:#F5F5F7;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);border:1px solid #C6F432;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  async function run(force) {
    if (!force && Date.now() - GM_getValue("lastRun", 0) < EVERY_MS) return;
    if (!secret(false)) { log("pas de secret : menu Tampermonkey › Changer le secret"); return; }

    const list = await pulse("GET");
    GM_setValue("lastRun", Date.now());
    const missing = ((list && list.missing) || []).slice(0, MAX_PER_RUN);
    if (!missing.length) { log("rien à envoyer"); if (force) toast("Pulse : tout est à jour"); return; }

    let sent = 0, vma = null;
    for (const [i, m] of missing.entries()) {
      if (i) await pause(2000 + Math.random() * 3000);
      try {
        const r = await fetch("/api/activity/" + encodeURIComponent(m.externalId) + "/streams", { credentials: "include", headers: { Accept: "application/json" } });
        if (!r.ok) { log(m.externalId, "courbes indisponibles", r.status); continue; }
        const streams = await r.json();
        const res = await pulse("POST", { externalId: m.externalId, streams });
        sent++;
        if (res && res.vma != null) vma = res.vma;
        log(m.externalId, "envoyée", res);
      } catch (e) {
        log(m.externalId, "échec", e.message);
      }
    }
    if (sent) toast("Pulse : " + sent + " sortie(s) complétée(s)" + (vma != null ? " · VMA " + vma + " km/h" : ""));
  }

  GM_registerMenuCommand("Pulse : synchroniser maintenant", () => run(true).catch((e) => toast("Pulse : " + e.message)));
  GM_registerMenuCommand("Pulse : changer le secret", () => secret(true));

  run(false).catch((e) => { log("échec", e.message); if (/unauthorized/.test(e.message)) toast("Pulse : secret refusé (menu Tampermonkey › Changer le secret)"); });
})();
