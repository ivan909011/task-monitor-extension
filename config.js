// Public example configuration. Never put tokens or private identifiers here.
// Update manifest.json host_permissions and content_scripts.matches to match.
globalThis.TASK_MONITOR_CONFIG = Object.freeze({
  targetUrl: "https://example.com/tasks",
  rowSelector: "table tbody tr",
  cellSelector: "td",
  // Optional selector for cards; empty disables card detection.
  cardSelector: "",
  scanDelayMs: 800
});
