const $ = (id) => document.getElementById(id);
const DEFAULTS = { host: "127.0.0.1", port: 1080, bypass: ["localhost", "127.0.0.1", "<local>"] };

(async () => {
  const c = { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
  $("host").value = c.host;
  $("port").value = c.port;
  $("bypass").value = c.bypass.join("\n");
})();

$("save").onclick = async () => {
  await chrome.storage.local.set({
    host: $("host").value.trim() || DEFAULTS.host,
    port: Number($("port").value) || DEFAULTS.port,
    bypass: $("bypass").value.split("\n").map((s) => s.trim()).filter(Boolean)
  });
  $("msg").textContent = "Saved";
  setTimeout(() => ($("msg").textContent = ""), 1500);
};
