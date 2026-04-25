/*!
 * Monolith Analytics Tracker (CF Analytics Engine)
 * Adapted from HanAnalytics (MIT) — https://github.com/uxiaohan/HanAnalytics
 *
 * 用法：在第三方站点的 </body> 前插入：
 *   <script defer src="https://your-site.pages.dev/tracker.js"
 *           data-website-id="my-blog"
 *           data-endpoint="https://your-worker.workers.dev/api/track"></script>
 *
 * 自有站点已通过 React Router 集成，无需手动加载本脚本。
 */
(function () {
  "use strict";
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  if (!script) return;

  var website = script.getAttribute("data-website-id") || "default";
  var endpoint = script.getAttribute("data-endpoint") || "/api/track";
  var VID_KEY = "monolith_vid";
  var VID_TTL = 30 * 24 * 60 * 60 * 1000;
  var enterAt = 0;
  var lastPath = "";

  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  function vid() {
    try {
      var raw = localStorage.getItem(VID_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (Date.now() - p.ts < VID_TTL && p.id) return p.id;
      }
    } catch (_) { /* ignore */ }
    var id = hash(Date.now() + "|" + Math.random() + "|" + navigator.userAgent + "|" + screen.width + "x" + screen.height);
    try { localStorage.setItem(VID_KEY, JSON.stringify({ id: id, ts: Date.now() })); } catch (_) { /* ignore */ }
    return id;
  }

  function send(body, beacon) {
    var json = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([json], { type: "application/json" }));
      return;
    }
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
        keepalive: true,
        credentials: "omit",
      }).catch(function () { /* silent */ });
    } catch (_) { /* ignore */ }
  }

  function payload(path, duration) {
    return {
      website: website,
      path: path,
      referer: document.referrer || "",
      screen: screen.width + "x" + screen.height,
      language: navigator.language || "",
      visitorId: vid(),
      duration: duration || 0,
    };
  }

  function track() {
    var path = location.pathname + location.search;
    if (path === lastPath) return;
    if (lastPath && enterAt > 0) send(payload(lastPath, Date.now() - enterAt), false);
    lastPath = path;
    enterAt = Date.now();
    send(payload(path, 0), false);
  }

  function flush() {
    if (!lastPath || enterAt <= 0) return;
    send(payload(lastPath, Date.now() - enterAt), true);
  }

  // 初始 + History API hook
  track();
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function () { origPush.apply(this, arguments); track(); };
  history.replaceState = function () { origReplace.apply(this, arguments); track(); };
  window.addEventListener("popstate", track);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
})();
