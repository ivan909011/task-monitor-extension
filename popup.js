const $ = (id) => document.getElementById(id);
let activeTab;

const defaults = { intervalSeconds: 10, soundEnabled: true, desktopNotifications: true, telegramEnabled: false, telegramBotToken: "", telegramChatId: "" };

function readSettings() {
  return {
    intervalSeconds: Math.max(5, Number($("interval").value) || 10),
    soundEnabled: $("sound").checked,
    desktopNotifications: $("desktop").checked,
    telegramEnabled: $("telegram").checked,
    telegramBotToken: $("telegramToken").value.trim(),
    telegramChatId: $("telegramChatId").value.trim()
  };
}

async function save() { await chrome.runtime.sendMessage({ type: "saveSettings", settings: readSettings() }); }

async function init() {
  const saved = await chrome.storage.local.get(defaults);
  $("interval").value = saved.intervalSeconds;
  $("sound").checked = saved.soundEnabled;
  $("desktop").checked = saved.desktopNotifications;
  $("telegram").checked = saved.telegramEnabled;
  $("telegramToken").value = saved.telegramBotToken;
  $("telegramChatId").value = saved.telegramChatId;
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const target = new URL(TASK_MONITOR_CONFIG.targetUrl);
  const current = activeTab?.url ? new URL(activeTab.url) : null;
  const valid = current?.origin === target.origin && current?.pathname === target.pathname;
  $("pageStatus").textContent = valid ? "Ready: configured task page detected." : "Open the configured task page, then reopen this popup.";
  $("start").disabled = $("stop").disabled = !valid;
  if (valid) {
    const response = await chrome.runtime.sendMessage({ type: "getStatus", tabId: activeTab.id });
    if (response?.monitor?.running) $("pageStatus").textContent = "Monitoring is active for this tab.";
  }
}

$("start").addEventListener("click", async () => {
  await save();
  const response = await chrome.runtime.sendMessage({ type: "popupStart", tabId: activeTab.id });
  $("pageStatus").textContent = response.ok ? "Monitoring started. Existing rows are your baseline." : `Could not start: ${response.error}`;
});
$("stop").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "popupStop", tabId: activeTab.id });
  $("pageStatus").textContent = "Monitoring stopped.";
});
$("test").addEventListener("click", async () => {
  await save();
  const response = await chrome.runtime.sendMessage({ type: "testAlerts" });
  if (!response.ok) $("pageStatus").textContent = `Test failed: ${response.error}`;
  else if (response.telegram?.sent) $("pageStatus").textContent = "Test sent. Check the computer and Telegram.";
  else $("pageStatus").textContent = `Computer test completed. Telegram: ${response.telegram?.reason || "not configured"}`;
});
document.querySelectorAll("input").forEach((input) => input.addEventListener("change", save));
init().catch(() => { $("pageStatus").textContent = "Unable to load settings. Check config.js and reload the extension."; $("start").disabled = true; });
