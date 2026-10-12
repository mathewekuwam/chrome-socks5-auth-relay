// State lives in chrome.storage (service workers can be shut down at any time).
const DEFAULTS = {
  enabled: false,
  host: "127.0.0.1",
  port: 1080,
  bypass: ["localhost", "127.0.0.1", "<local>"]
};

async function getConfig() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}

async function applyProxy() {
  const c = await getConfig();
  if (c.enabled) {
    await chrome.proxy.settings.set({
      scope: "regular",
      value: {
        mode: "fixed_servers",
        rules: {
          // socks5 => Chrome sends hostnames to the proxy (remote DNS, no DNS leak)
          singleProxy: { scheme: "socks5", host: c.host, port: Number(c.port) },
          bypassList: c.bypass
        }
      }
    });
    // Stop WebRTC from exposing your real IP
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: "disable_non_proxied_udp" });
  } else {
    await chrome.proxy.settings.clear({ scope: "regular" });
    await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
  }
  await updateBadge();
}

async function updateBadge() {
  const { enabled } = await getConfig();
  const { levelOfControl } = await chrome.proxy.settings.get({ incognito: false });
  const conflict = enabled && levelOfControl !== "controlled_by_this_extension";
  await chrome.action.setBadgeText({ text: conflict ? "!" : enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: conflict ? "#d93025" : "#188038" });
  await chrome.action.setTitle({
    title: conflict
      ? "Proxy conflict: another extension controls proxy settings"
      : enabled ? "Proxy ON" : "Proxy OFF"
  });
}

// Re-apply on install, browser start, and whenever settings change.
chrome.runtime.onInstalled.addListener(applyProxy);
chrome.runtime.onStartup.addListener(applyProxy);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") applyProxy();
});
chrome.proxy.settings.onChange.addListener(updateBadge);
