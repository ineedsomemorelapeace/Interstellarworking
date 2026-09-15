(() => {
  const isIOSWebKit =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (!isIOSWebKit) return;

  // iPadOS Safari can fail to load resources from a sandboxed proxy iframe.
  // UV provides the proxy isolation, so remove only the iframe sandbox on iOS.
  const unsandbox = () => {
    document.querySelectorAll("#frame-container iframe[sandbox]").forEach(iframe => {
      iframe.removeAttribute("sandbox");
    });
  };

  unsandbox();
  new MutationObserver(unsandbox).observe(document.getElementById("frame-container") || document.body, {
    childList: true,
    subtree: true
  });
})();
