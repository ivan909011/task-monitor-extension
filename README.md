# Task Monitor Extension

A configurable Chrome extension that watches a task listing page, reloads it periodically, and alerts when new row text appears. Built with JavaScript and Chrome Manifest V3, with optional Telegram notifications.

The first scan establishes a baseline. Later scans compare the visible text against the previous scan. The extension never clicks controls, accepts tasks, or submits work.

## Configure and install

Requires Chrome 120 or later. No build step or third-party packages are needed.

1. Extract this folder to a permanent location.
2. Edit `config.js`, using `config.example.js` as a reference. Replace `https://example.com/tasks` with your task listing URL. Matching uses the exact origin and pathname; query strings and fragments are ignored.
3. In `manifest.json`, replace `https://example.com/*` in **both** `host_permissions` and `content_scripts.matches` with the matching origin pattern, such as `https://your-host.example/*`. Keep permissions restricted to the host you intend to monitor.
4. Set `rowSelector` and `cellSelector` for your page. Defaults read `table tbody tr` and `td`. For cards, set `cardSelector` to a selector that matches each complete card. Empty disables cards. Adjust `scanDelayMs` if your page takes longer to render.
5. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this folder.
6. Reload the configured task page, open the extension popup, choose alert options, and select **Start monitoring**.

`example.com` is a safe placeholder, not a working task service. Site configuration is required before this extension can monitor your tasks. After changing configuration, reload the extension and task page. Keep private deployment URLs out of your public repository; restore the example configuration before publishing.

## Use and alerts

- Refresh defaults to 10 seconds, with a minimum of 5 seconds. Choose an interval appropriate for the service.
- The page schedules its next reload after the scan. A background alarm provides a fallback, at least 30 seconds apart. Browser throttling can delay both.
- Sound uses a locally generated beep. Desktop alerts depend on browser and operating-system notification settings.
- **Test alerts** tests enabled channels. Settings are saved when changed.
- **Stop** cancels the page timers and background alarm. Closing the tab, navigating away from the configured pathname, or restarting the browser ends monitoring.
- If installation happened while the page was already open, reload the page before starting.

## Optional Telegram setup

1. Create your own bot through Telegram's `@BotFather` and obtain its token.
2. Message the bot, and obtain your destination chat ID through a method you trust, such as the Bot API's `getUpdates` method.
3. Enter the token and chat ID in the popup, enable **Send Telegram alerts**, and use **Test alerts**.

No credentials ship with this project. Enter credentials only in the popup, not in source files. They are stored in `chrome.storage.local` in your browser profile, without application-level encryption or browser sync. Content scripts cannot read that storage. Disable Telegram and clear both fields to remove saved credentials.

Telegram receives the new-row count and up to three row-text previews. Desktop notifications also contain those previews. Enable these channels only when that content is appropriate to share or display. Telegram is the only external notification endpoint; ordinary page reloads contact your configured site.

## Permissions

| Permission | Purpose |
| --- | --- |
| `alarms` | Fallback reload scheduling |
| `notifications` | Desktop alerts |
| `storage` | Local settings and session monitoring state |
| `tabs` | Validate the current page and reload monitored tabs |
| `offscreen` | Play local sound from an offscreen document |
| Configured host | Run the reader on your chosen site |
| `https://api.telegram.org/*` | Send optional Telegram messages |

## Design and limitations

- `config.js`: public site URL, selectors, and scan delay; `config.example.js`: safe reference.
- `content.js`: reads visible row/card text, sends snapshots, schedules reloads.
- `background.js`: maintains per-tab session state, compares snapshots, delivers alerts.
- `popup.*`: monitoring controls and browser-local credential entry.
- `offscreen.*`: locally generated audio.
- `icons/`: optional generic artwork; notification bitmaps are generated in memory.

Comparison uses full row text, not stable task IDs: changes to counts or labels can produce new alerts, and a row that disappears and returns can alert again. Dynamic pages may require a longer scan delay or different selectors. A page with no matching rows produces an empty snapshot. Reloading may discard unsaved page state. Starting multiple tabs may produce duplicate notifications. Changing the refresh interval while monitoring takes full effect after Stop and Start.

Use only pages you are authorized to access and follow their rules. This project is independent of any task platform.

## Verification

Run the dependency-free checks with Node.js 18 or later:

```sh
node tests/extension.test.cjs
```

Tests exercise baseline/diff behavior, sender restrictions, Telegram error redaction, target URL matching, and cancellation of pending scans. They use mocked Chrome APIs; they do not replace a browser test.

Before publishing, review your local configuration and any added assets for private data. `.gitignore` excludes common local secret files, but cannot remove secrets from tracked files or Git history. The public archive contains only example configuration.
