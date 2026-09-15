// tabs.js
window.addEventListener("load", async () => {
  const isIOSWebKit =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOSWebKit && "serviceWorker" in navigator) {
    try {
      // Safari can restore an old service-worker registration from a previous
      // visit. Remove old /a/ workers before installing the iPad-specific one.
      const registrations = await navigator.serviceWorker.getRegistrations();
      const wanted = new URL("/assets/sw.js", location.origin).href;
      let removedOldWorker = false;

      for (const registration of registrations) {
        const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
        if (registration.scope.endsWith("/a/") && script && script !== wanted) {
          await registration.unregister();
          removedOldWorker = true;
        }
      }

      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      const registration = await navigator.serviceWorker.register("/assets/sw.js?v=2026-09-15-ios-2", {
        scope: "/a/",
        updateViaCache: "none",
      });

      await registration.update();

      // If Safari was still controlled by the old worker, one reload hands the
      // page to the newly registered iOS worker. sessionStorage prevents loops.
      const controllerScript = navigator.serviceWorker.controller?.scriptURL || "";
      if (removedOldWorker && controllerScript && controllerScript !== wanted && !sessionStorage.getItem("ios-sw-reloaded")) {
        sessionStorage.setItem("ios-sw-reloaded", "1");
        location.reload();
        return;
      }
      sessionStorage.removeItem("ios-sw-reloaded");
    } catch (error) {
      console.error("iOS service worker setup failed:", error);
    }
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js?v=2025-04-15", {
      scope: "/a/",
      updateViaCache: "none",
    }).catch(error => console.error("Service worker registration failed:", error));
  }

  const form = document.getElementById("fv");
  const input = document.getElementById("input");
  if (form && input) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const formValue = input.value.trim();
      const url = isUrl(formValue) ? prependHttps(formValue) : `https://search.brave.com/search?q=${formValue}`;
      await processUrl(url);
    });
  }

  function useScramjetPxy() {
    return localStorage.getItem("pchoice") === "sj";
  }

  async function getPxyUrl(url) {
    if (useScramjetPxy()) {
      if (window.__isSjReady) await window.__isSjReady;
      if (window.__isSj?.encodeUrl) return window.__isSj.encodeUrl(url);
    }
    return `/a/${__uv$config.encodeUrl(url)}`;
  }

  function getPxyUrlSync(url) {
    if (useScramjetPxy() && window.__isSj?.encodeUrl) return window.__isSj.encodeUrl(url);
    return `/a/${__uv$config.encodeUrl(url)}`;
  }

  async function processUrl(url) {
    const pxyUrl = await getPxyUrl(url);
    sessionStorage.setItem("GoUrl", pxyUrl);
    const iframeContainer = document.getElementById("frame-container");
    const activeIframe = Array.from(iframeContainer.querySelectorAll("iframe")).find(iframe => iframe.classList.contains("active"));
    if (activeIframe) {
      activeIframe.src = pxyUrl;
      activeIframe.dataset.tabUrl = url;
    }
    input.value = url;
    Load();
  }

  function isUrl(val = "") {
    return /^http(s?):\/\//.test(val) || (val.includes(".") && val.substr(0, 1) !== " ");
  }

  function prependHttps(url) {
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  }

  window.__isGetPxyUrl = getPxyUrlSync;
});

document.addEventListener("DOMContentLoaded", () => {
  const addTabButton = document.getElementById("add-tab");
  const tabList = document.getElementById("tab-list");
  const iframeContainer = document.getElementById("frame-container");
  let tabCounter = 1;

  addTabButton.addEventListener("click", () => { createNewTab(); Load(); });

  function createNewTab() {
    const newTab = document.createElement("li");
    const tabTitle = document.createElement("span");
    const newIframe = document.createElement("iframe");
    newIframe.sandbox = "allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals allow-orientation-lock allow-presentation allow-storage-access-by-user-activation";
    tabTitle.textContent = `New Tab ${tabCounter}`;
    tabTitle.className = "t";
    newTab.dataset.tabId = tabCounter;
    newTab.addEventListener("click", switchTab);
    newTab.setAttribute("draggable", true);
    const closeButton = document.createElement("button");
    closeButton.classList.add("close-tab");
    closeButton.innerHTML = "&#10005;";
    closeButton.addEventListener("click", closeTab);
    newTab.append(tabTitle, closeButton);
    tabList.appendChild(newTab);
    tabList.querySelectorAll("li").forEach(tab => tab.classList.remove("active"));
    iframeContainer.querySelectorAll("iframe").forEach(iframe => iframe.classList.remove("active"));
    newTab.classList.add("active");
    newIframe.dataset.tabId = tabCounter;
    newIframe.classList.add("active");
    newIframe.addEventListener("load", () => {
      try {
        const title = newIframe.contentDocument.title;
        tabTitle.textContent = title.length <= 1 ? "Tab" : title;
        newIframe.contentWindow.open = url => {
          const pxyUrl = window.__isGetPxyUrl ? window.__isGetPxyUrl(url) : `/a/${__uv$config.encodeUrl(url)}`;
          sessionStorage.setItem("URL", pxyUrl);
          createNewTab();
          return null;
        };
        Load();
      } catch {}
    });

    const resolveStoredUrl = value => {
      if (!value) return null;
      return value.startsWith("/") ? window.location.origin + value : value;
    };
    const goUrl = sessionStorage.getItem("GoUrl");
    const url = sessionStorage.getItem("URL");
    if (url && tabCounter > 1) {
      newIframe.src = resolveStoredUrl(url);
      sessionStorage.removeItem("URL");
    } else if (goUrl) {
      newIframe.src = resolveStoredUrl(goUrl);
    } else {
      newIframe.src = "/";
    }
    iframeContainer.appendChild(newIframe);
    tabCounter += 1;
  }

  function closeTab(event) {
    event.stopPropagation();
    const tabId = event.target.closest("li").dataset.tabId;
    const tab = tabList.querySelector(`[data-tab-id='${tabId}']`);
    const iframe = iframeContainer.querySelector(`[data-tab-id='${tabId}']`);
    if (!tab || !iframe) return;
    tab.remove(); iframe.remove();
    const remaining = Array.from(tabList.querySelectorAll("li"));
    if (!remaining.length) { tabCounter = 0; document.getElementById("input").value = ""; return; }
    switchTab({ target: remaining[0] });
  }

  function switchTab(event) {
    const tabId = event.target.closest("li").dataset.tabId;
    tabList.querySelectorAll("li").forEach(tab => tab.classList.remove("active"));
    iframeContainer.querySelectorAll("iframe").forEach(iframe => iframe.classList.remove("active"));
    tabList.querySelector(`[data-tab-id='${tabId}']`)?.classList.add("active");
    iframeContainer.querySelector(`[data-tab-id='${tabId}']`)?.classList.add("active");
    Load();
  }

  let dragTab = null;
  tabList.addEventListener("dragstart", event => { dragTab = event.target; });
  tabList.addEventListener("dragover", event => {
    event.preventDefault();
    const targetTab = event.target;
    if (targetTab.tagName === "LI" && targetTab !== dragTab) {
      const targetIndex = Array.from(tabList.children).indexOf(targetTab);
      const dragIndex = Array.from(tabList.children).indexOf(dragTab);
      tabList.insertBefore(dragTab, targetIndex < dragIndex ? targetTab : targetTab.nextSibling);
    }
  });
  tabList.addEventListener("dragend", () => { dragTab = null; });
  createNewTab();
});

function reload() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (activeIframe) { activeIframe.src = activeIframe.src; Load(); }
}

function popout() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;
  const newWindow = window.open("about:blank", "_blank");
  if (!newWindow) return;
  const name = localStorage.getItem("name") || "My Drive - Google Drive";
  const icon = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";
  newWindow.document.title = name;
  const link = newWindow.document.createElement("link"); link.rel = "icon"; link.href = encodeURI(icon); newWindow.document.head.appendChild(link);
  const newIframe = newWindow.document.createElement("iframe");
  Object.assign(newIframe.style, {position:"fixed",top:"0",bottom:"0",left:"0",right:"0",border:"none",outline:"none",width:"100%",height:"100%"});
  newIframe.src = activeIframe.src;
  newWindow.document.body.appendChild(newIframe);
}

function eToggle() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe?.contentWindow) return;
  const erudaWindow = activeIframe.contentWindow;
  if (erudaWindow.eruda) {
    if (erudaWindow.eruda._isInit) erudaWindow.eruda.destroy();
    return;
  }
  const doc = activeIframe.contentDocument;
  if (!doc) return;
  const script = doc.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.onload = () => erudaWindow.eruda?.init();
  doc.head.appendChild(script);
}

function FS() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;
  if (activeIframe.contentDocument.fullscreenElement) activeIframe.contentDocument.exitFullscreen();
  else activeIframe.contentDocument.documentElement.requestFullscreen();
}

const fullscreenButton = document.getElementById("fullscreen-button");
fullscreenButton.addEventListener("click", FS);
function Home() { window.location.href = "./"; }
const homeButton = document.getElementById("home-page");
homeButton.addEventListener("click", Home);
function goBack() { const iframe = document.querySelector("#frame-container iframe.active"); if (iframe) { iframe.contentWindow.history.back(); Load(); } }
function goForward() { const iframe = document.querySelector("#frame-container iframe.active"); if (iframe) { iframe.contentWindow.history.forward(); Load(); } }

document.addEventListener("DOMContentLoaded", () => {
  const tb = document.getElementById("tabs-button");
  const nb = document.getElementById("right-side-nav");
  tb.addEventListener("click", () => {
    const activeIframe = document.querySelector("#frame-container iframe.active");
    if (!activeIframe) return;
    if (nb.style.display === "none") {
      nb.style.display = ""; activeIframe.style.top = "10%"; activeIframe.style.height = "90%";
      tb.querySelector("i").classList.replace("fa-magnifying-glass-plus", "fa-magnifying-glass-minus");
    } else {
      nb.style.display = "none"; activeIframe.style.top = "5%"; activeIframe.style.height = "95%";
      tb.querySelector("i").classList.replace("fa-magnifying-glass-minus", "fa-magnifying-glass-plus");
    }
  });
});

function Load() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe || activeIframe.contentWindow.document.readyState !== "complete") return;
  try {
    const website = activeIframe.contentWindow.document.location.href;
    const input = document.getElementById("input");
    if (website.includes("/a/sj/") && window.__isSj?.decodeUrl) input.value = window.__isSj.decodeUrl(website);
    else if (website.includes("/a/q/")) input.value = decodeXor(website.replace(window.location.origin, "").replace("/a/q/", ""));
    else if (website.includes("/a/")) input.value = decodeXor(website.replace(window.location.origin, "").replace("/a/", ""));
    else input.value = website.replace(window.location.origin, "");
  } catch {}
}

function decodeXor(input) {
  if (!input) return input;
  const [str, ...search] = input.split("?");
  return decodeURIComponent(str).split("").map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(Number.NaN) ^ 2) : char).join("") + (search.length ? `?${search.join("?")}` : "");
}
