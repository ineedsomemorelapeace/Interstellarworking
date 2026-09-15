(function () {
  "use strict";

  function isIOSWebKit() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function migrate() {
    let hadLegacy =
      localStorage.getItem("pChoice") !== null ||
      localStorage.getItem("uv") !== null ||
      localStorage.getItem("dy") !== null;

    localStorage.removeItem("pChoice");
    localStorage.removeItem("uv");
    localStorage.removeItem("dy");

    let v = localStorage.getItem("pchoice");

    // iPadOS/iOS Safari has WebKit limitations with Scramjet's
    // service-worker response handling, which can leave proxied CSS
    // and other resources blank. Use the existing Ultraviolet engine there.
    if (isIOSWebKit()) {
      localStorage.setItem("pchoice", "uv");
      return "uv";
    }

    if (v === "sc") {
      localStorage.setItem("pchoice", "sj");
      return "sj";
    }

    if (hadLegacy) {
      localStorage.setItem("pchoice", "sj");
      return "sj";
    }

    if (v === "uv" || v === "dy" || v === "sj") {
      return v;
    }

    localStorage.setItem("pchoice", "sj");
    return "sj";
  }

  window.resolveProxyPchoice = migrate;
  migrate();
})();
