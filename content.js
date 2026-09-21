let reloadTimer = null;
let scanTimer = null;

function taskRows() {
  const config = TASK_MONITOR_CONFIG;
  const normalize = element => (element.innerText || "").replace(/\s+/g, " ").trim();
  const rows = [...document.querySelectorAll(config.rowSelector)]
    .map(row => [...row.querySelectorAll(config.cellSelector)].map(normalize).filter(Boolean).join(" | "))
    .filter(Boolean);
  const cards = config.cardSelector ? [...document.querySelectorAll(config.cardSelector)].map(normalize).filter(Boolean) : [];
  return [...new Set([...rows, ...cards])];
}

function stopTimers() {
  clearTimeout(scanTimer);
  clearTimeout(reloadTimer);
}

chrome.runtime.onMessage.addListener(message => {
  if (message.type === "startMonitoring") {
    stopTimers();
    scanTimer = setTimeout(async () => {
      try {
        // Schedule before awaiting so Stop can cancel a pending reload.
        reloadTimer = setTimeout(() => location.reload(), Math.max(5, Number(message.intervalSeconds) || 10) * 1000);
        await chrome.runtime.sendMessage({ type: "snapshot", rows: taskRows() });
      } catch {
        stopTimers();
        console.warn("Task scan failed. Check the configured selectors and reload the page.");
      }
    }, Math.max(0, Number(TASK_MONITOR_CONFIG.scanDelayMs) || 0));
  }
  if (message.type === "stopMonitoring") stopTimers();
});
