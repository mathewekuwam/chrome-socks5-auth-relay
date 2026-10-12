const $ = (id) => document.getElementById(id);

async function render() {
  const { enabled = false, host = "127.0.0.1", port = 1080 } = await chrome.storage.local.get(["enabled", "host", "port"]);
  $("toggle").textContent = enabled ? "Turn proxy OFF" : "Turn proxy ON";
  $("toggle").className = enabled ? "on" : "off";
  $("status").textContent = enabled ? `Routing all traffic via socks5://${host}:${port}` : "Direct connection";
}

$("toggle").onclick = async () => {
  const { enabled = false } = await chrome.storage.local.get("enabled");
  await chrome.storage.local.set({ enabled: !enabled });
  $("test").textContent = "";
  render();
};

$("check").onclick = async (e) => {
  e.preventDefault();
  $("test").textContent = "Testing…";
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal, cache: "no-store" });
    $("test").textContent = "Current public IP: " + (await r.json()).ip;
  } catch {
    $("test").textContent = "Failed. Is the relay running? Are credentials correct?";
  }
};

$("opts").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
chrome.storage.onChanged.addListener(render);
render();
