// tabs.js

// Use one root-scoped proxy worker. The tabs page itself is /d/, so the
// worker must control this page before its iframe navigates to /a/.
const PROXY_SW = "/sw.js?v=2026-09-17-root-1";

window.__proxyReady = (async () => {
  if (!("serviceWorker" in navigator)) return false;

  try {
    let removedSpecificWorker = false;
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
      const scopePath = new URL(registration.scope).pathname;
      if (scopePath !== "/a/") continue;

      // /a/ is no longer used as a worker scope. A more-specific stale worker
      // would otherwise win over the root worker and send /a/... to Express.
      await registration.unregister();
      removedSpecificWorker = true;
    }

    const registration = await navigator.serviceWorker.register(PROXY_SW, {
      scope: "/",
      updateViaCache: "none",
    });

    await registration.update();
    await navigator.serviceWorker.ready;

    // A newly installed worker cannot reliably control an already-open page
    // until the page navigates again. Reload once so the iframe's /a/ request
    // is guaranteed to pass through the proxy worker instead of Express.
    if (!navigator.serviceWorker.controller && !sessionStorage.getItem("root-sw-reloaded")) {
      sessionStorage.setItem("root-sw-reloaded", "1");
      location.reload();
      return false;
    }

    if (removedSpecificWorker && !sessionStorage.getItem("old-proxy-cleaned")) {
      sessionStorage.setItem("old-proxy-cleaned", "1");
      location.reload();
      return false;
    }

    sessionStorage.removeItem("root-sw-reloaded");
    sessionStorage.removeItem("old-proxy-cleaned");
    return Boolean(registration.active && navigator.serviceWorker.controller);
  } catch (error) {
    console.error("Proxy service worker setup failed:", error);
    return false;
  }
})();

document.addEventListener("DOMContentLoaded", async () => {
  const proxyReady = await window.__proxyReady;
  if (!proxyReady) return;

  const form = document.getElementById("fv");
  const input = document.getElementById("input");
  if (form && input) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const formValue = input.value.trim();
      const url = isUrl(formValue)
        ? prependHttps(formValue)
        : `https://search.brave.com/search?q=${formValue}`;
      await processUrl(url);
    });
  }

  async function getPxyUrl(url) {
    return `/a/${__uv$config.encodeUrl(url)}`;
  }

  function getPxyUrlSync(url) {
    return `/a/${__uv$config.encodeUrl(url)}`;
  }

  async function processUrl(url) {
    const pxyUrl = await getPxyUrl(url);
    sessionStorage.setItem("GoUrl", pxyUrl);
    const activeIframe = document.querySelector("#frame-container iframe.active");
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
    return url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;
  }

  window.__isGetPxyUrl = getPxyUrlSync;

  const addTabButton = document.getElementById("add-tab");
  const tabList = document.getElementById("tab-list");
  const iframeContainer = document.getElementById("frame-container");
  let tabCounter = 1;

  addTabButton.addEventListener("click", () => {
    createNewTab();
    Load();
  });

  function createNewTab() {
    const newTab = document.createElement("li");
    const tabTitle = document.createElement("span");
    const newIframe = document.createElement("iframe");

    newIframe.sandbox =
      "allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals allow-orientation-lock allow-presentation allow-storage-access-by-user-activation";
    tabTitle.textContent = `New Tab ${tabCounter}`;
    tabTitle.className = "t";
    newTab.dataset.tabId = tabCounter;
    newTab.setAttribute("draggable", true);
    newTab.addEventListener("click", switchTab);

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
          const pxyUrl = window.__isGetPxyUrl
            ? window.__isGetPxyUrl(url)
            : `/a/${__uv$config.encodeUrl(url)}`;
          sessionStorage.setItem("URL", pxyUrl);
          createNewTab();
          return null;
        };
        Load();
      } catch {}
    });

    const resolveStoredUrl = value =>
      !value ? null : value.startsWith("/") ? window.location.origin + value : value;
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
    const id = event.target.closest("li").dataset.tabId;
    const tab = tabList.querySelector(`[data-tab-id='${id}']`);
    const iframe = iframeContainer.querySelector(`[data-tab-id='${id}']`);
    if (!tab || !iframe) return;
    tab.remove();
    iframe.remove();
    const remaining = Array.from(tabList.querySelectorAll("li"));
    if (!remaining.length) {
      tabCounter = 0;
      document.getElementById("input").value = "";
    } else {
      switchTab({ target: remaining[0] });
    }
  }

  function switchTab(event) {
    const id = event.target.closest("li").dataset.tabId;
    tabList.querySelectorAll("li").forEach(tab => tab.classList.remove("active"));
    iframeContainer.querySelectorAll("iframe").forEach(iframe => iframe.classList.remove("active"));
    tabList.querySelector(`[data-tab-id='${id}']`)?.classList.add("active");
    iframeContainer.querySelector(`[data-tab-id='${id}']`)?.classList.add("active");
    Load();
  }

  let dragTab = null;
  tabList.addEventListener("dragstart", event => { dragTab = event.target; });
  tabList.addEventListener("dragover", event => {
    event.preventDefault();
    const target = event.target;
    if (target.tagName === "LI" && target !== dragTab) {
      const ti = Array.from(tabList.children).indexOf(target);
      const di = Array.from(tabList.children).indexOf(dragTab);
      tabList.insertBefore(dragTab, ti < di ? target : target.nextSibling);
    }
  });
  tabList.addEventListener("dragend", () => { dragTab = null; });

  createNewTab();
});

function reload() {
  const iframe = document.querySelector("#frame-container iframe.active");
  if (iframe) { iframe.src = iframe.src; Load(); }
}

function popout() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;
  const newWindow = window.open("about:blank", "_blank");
  if (!newWindow) return;
  const name = localStorage.getItem("name") || "My Drive - Google Drive";
  const icon = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";
  newWindow.document.title = name;
  const link = newWindow.document.createElement("link");
  link.rel = "icon";
  link.href = encodeURI(icon);
  newWindow.document.head.appendChild(link);
  const iframe = newWindow.document.createElement("iframe");
  Object.assign(iframe.style, { position:"fixed", top:"0", bottom:"0", left:"0", right:"0", border:"none", outline:"none", width:"100%", height:"100%" });
  iframe.src = activeIframe.src;
  newWindow.document.body.appendChild(iframe);
}

function eToggle() {
  const iframe = document.querySelector("#frame-container iframe.active");
  if (!iframe?.contentWindow) return;
  const win = iframe.contentWindow;
  if (win.eruda) { if (win.eruda._isInit) win.eruda.destroy(); return; }
  const doc = iframe.contentDocument;
  if (!doc) return;
  const script = doc.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.onload = () => win.eruda?.init();
  doc.head.appendChild(script);
}

function FS() {
  const iframe = document.querySelector("#frame-container iframe.active");
  if (!iframe) return;
  if (iframe.contentDocument.fullscreenElement) iframe.contentDocument.exitFullscreen();
  else iframe.contentDocument.documentElement.requestFullscreen();
}

function Home() { window.location.href = "./"; }
function goBack() { const iframe = document.querySelector("#frame-container iframe.active"); if (iframe) { iframe.contentWindow.history.back(); Load(); } }
function goForward() { const iframe = document.querySelector("#frame-container iframe.active"); if (iframe) { iframe.contentWindow.history.forward(); Load(); } }

document.addEventListener("DOMContentLoaded", () => {
  const tb = document.getElementById("tabs-button");
  const nb = document.getElementById("right-side-nav");
  tb.addEventListener("click", () => {
    const iframe = document.querySelector("#frame-container iframe.active");
    if (!iframe) return;
    if (nb.style.display === "none") {
      nb.style.display = ""; iframe.style.top = "10%"; iframe.style.height = "90%";
      tb.querySelector("i").classList.replace("fa-magnifying-glass-plus", "fa-magnifying-glass-minus");
    } else {
      nb.style.display = "none"; iframe.style.top = "5%"; iframe.style.height = "95%";
      tb.querySelector("i").classList.replace("fa-magnifying-glass-minus", "fa-magnifying-glass-plus");
    }
  });
});

function Load() {
  const iframe = document.querySelector("#frame-container iframe.active");
  if (!iframe || iframe.contentWindow.document.readyState !== "complete") return;
  try {
    const website = iframe.contentWindow.document.location.href;
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
  return decodeURIComponent(str).split("").map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join("") + (search.length ? `?${search.join("?")}` : "");
}
