import "./config.js";

const DEFAULTS = {
  intervalSeconds: 10,
  soundEnabled: true,
  desktopNotifications: true,
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: ""
};

const alarmName = (tabId) => `task-monitor-${tabId}`;

async function settings() {
  const saved = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...saved };
}

async function monitorFor(tabId) {
  const key = `monitor:${tabId}`;
  const value = await chrome.storage.session.get(key);
  return value[key];
}

async function setMonitor(tabId, value) {
  await chrome.storage.session.set({ [`monitor:${tabId}`]: value });
}

async function start(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!isTargetUrl(tab.url)) throw new Error("Open the configured task page first.");
  const config = await settings();
  await setMonitor(tabId, { running: true, previousRows: null, startedAt: Date.now() });
  await chrome.alarms.clear(alarmName(tabId));
  // Chrome alarms use minutes. Ten seconds is handled by a page-side timer after
  // each load; this alarm is only a fallback if the page timer is interrupted.
  await chrome.alarms.create(alarmName(tabId), { periodInMinutes: Math.max(0.5, config.intervalSeconds / 60) });
  try {
    await chrome.tabs.sendMessage(tabId, { type: "startMonitoring", intervalSeconds: config.intervalSeconds });
  } catch {
    await stop(tabId);
    throw new Error("Reload the task page after installing the extension, then try again.");
  }
}

async function stop(tabId) {
  await chrome.alarms.clear(alarmName(tabId));
  await chrome.tabs.sendMessage(tabId, { type: "stopMonitoring" }).catch(() => {});
  await chrome.storage.session.remove(`monitor:${tabId}`);
}

async function sendTelegram(message, config) {
  if (!config.telegramEnabled) return { sent: false, reason: "Telegram alerts are not enabled." };
  if (!config.telegramBotToken) return { sent: false, reason: "Bot token is missing." };
  if (!config.telegramChatId) return { sent: false, reason: "Chat ID is missing." };
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChatId, text: message })
  }).catch(() => { throw new Error("Telegram request failed. Check your connection and settings."); });
  if (!response.ok) {
    throw new Error(`Telegram rejected the message (HTTP ${response.status}).`);
  }
  return { sent: true };
}

async function alertForNewRows(tabId, rows) {
  const config = await settings();
  const preview = rows.slice(0, 3).join("\n");
  const message = `New task${rows.length === 1 ? "" : "s"} listed (${rows.length}).\n${preview}`;

  if (config.desktopNotifications) {
    await showNotification("Task Monitor Extension", message);
  }
  if (config.soundEnabled) {
    await playSound();
  }
  try {
    await sendTelegram(`🚨 ${message}`, config);
  } catch (error) {
    console.warn("Telegram notification failed:", error);
  }
}

async function notificationIcon() {
  // Chrome notifications require a bitmap. Generate a small PNG in memory so
  // the extension does not depend on an external download or an SVG icon.
  const canvas = new OffscreenCanvas(128, 128);
  const context = canvas.getContext("2d");
  context.fillStyle = "#2563eb";
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = "#fbbf24";
  context.beginPath();
  context.moveTo(64, 22);
  context.lineTo(116, 110);
  context.lineTo(12, 110);
  context.closePath();
  context.fill();
  context.fillStyle = "#111827";
  context.fillRect(58, 52, 12, 30);
  context.fillRect(58, 91, 12, 12);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
  let text = "";
  for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:image/png;base64,${btoa(text)}`;
}

async function showNotification(title, message) {
  try {
    await chrome.notifications.create({ type: "basic", iconUrl: await notificationIcon(), title, message });
  } catch (error) {
    // Notifications are optional. A Windows setting must not prevent sound or Telegram.
    console.warn("Desktop notification failed:", error);
  }
}

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a short local alert when a new task is detected."
  });
}

async function playSound() {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: "offscreenPlayAlert" });
  } catch (error) {
    console.warn("Sound alert failed:", error);
  }
}

function isTargetUrl(value) {
  try {
    const actual = new URL(value);
    const target = new URL(TASK_MONITOR_CONFIG.targetUrl);
    return actual.origin === target.origin && actual.pathname === target.pathname;
  } catch { return false; }
}

async function processSnapshot(message, sender) {
  const tabId = sender.tab?.id;
  if (tabId === undefined || !isTargetUrl(sender.url) || !Array.isArray(message.rows)) return;
  const monitor = await monitorFor(tabId);
  if (!monitor?.running) return;
  const currentRows = [...new Set(message.rows.filter(row => typeof row === "string").slice(0, 1000))];
  const previous = new Set(monitor.previousRows || []);
  const newRows = currentRows.filter(row => !previous.has(row));
  await setMonitor(tabId, { ...monitor, previousRows: currentRows });
  if (monitor.previousRows !== null && newRows.length) await alertForNewRows(tabId, newRows);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("task-monitor-")) return;
  const tabId = Number(alarm.name.replace("task-monitor-", ""));
  const monitor = await monitorFor(tabId);
  if (!monitor?.running) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!isTargetUrl(tab?.url)) return stop(tabId);
  await chrome.tabs.reload(tabId).catch(() => stop(tabId));
});

chrome.tabs.onRemoved.addListener((tabId) => stop(tabId));

// A content script is recreated after every page reload. Re-arm it once the
// Projects page has finished loading so the next ordinary reload is scheduled.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && !isTargetUrl(changeInfo.url)) return stop(tabId);
  if (changeInfo.status !== "complete" || !isTargetUrl(tab.url)) return;
  const monitor = await monitorFor(tabId);
  if (!monitor?.running) return;
  const config = await settings();
  await chrome.tabs.sendMessage(tabId, { type: "startMonitoring", intervalSeconds: config.intervalSeconds }).catch(() => {});
});

// Only the extension popup may read settings or control the monitor.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) {
    if (message.type !== "snapshot") return false;
    processSnapshot(message, sender).then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (sender.url !== chrome.runtime.getURL("popup.html")) return false;
  (async () => {
    switch (message.type) {
      case "getStatus": return { monitor: await monitorFor(message.tabId) };
      case "popupStart": await start(message.tabId); return { ok: true };
      case "popupStop": await stop(message.tabId); return { ok: true };
      case "saveSettings": {
        const input = message.settings || {};
        const safe = {
          intervalSeconds: Math.max(5, Math.min(86400, Number(input.intervalSeconds) || 10)),
          soundEnabled: input.soundEnabled === true,
          desktopNotifications: input.desktopNotifications === true,
          telegramEnabled: input.telegramEnabled === true,
          telegramBotToken: String(input.telegramBotToken || "").trim(),
          telegramChatId: String(input.telegramChatId || "").trim()
        };
        await chrome.storage.local.set(safe);
        return { ok: true };
      }
      case "testAlerts": {
        const config = await settings();
        if (config.desktopNotifications) await showNotification("Task Monitor Extension", "Test alert: notifications are working.");
        if (config.soundEnabled) await playSound();
        const telegram = await sendTelegram("Test alert: Task Monitor Extension is connected.", config);
        return { ok: true, telegram };
      }
      default: return { ok: false, error: "Unknown request." };
    }
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

// Credentials are available only to trusted extension pages, not content scripts.
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
