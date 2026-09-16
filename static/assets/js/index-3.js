// Service worker registration for the Interstellar home page.
// Navigation/search handling is owned by t3.js on the tabs page.
window.addEventListener("load", () => {
  const isIOSWebKit =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const serviceWorker = isIOSWebKit
    ? "/assets/sw.js?v=2026-09-15-ios-4"
    : "/sw.js?v=2025-04-15";

  navigator.serviceWorker.register(serviceWorker, {
    scope: "/a/",
    updateViaCache: "none",
  }).catch(error => {
    console.error("Service worker registration failed:", error);
  });
});
