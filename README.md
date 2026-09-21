# Task Monitor Extension

A Chrome Extension built with JavaScript and Manifest V3 for monitoring task availability on configurable web pages and sending real-time alerts when new tasks are detected.

The project was designed to automate repetitive page monitoring while keeping configuration, notification logic, and page detection separated into maintainable components.

## Features

- Configurable task-page monitoring
- Automatic detection of available tasks
- Background monitoring using Chrome Extension APIs
- Desktop notifications
- Sound alerts
- Optional Telegram Bot API notifications
- Configurable scan intervals
- Local configuration management
- Manifest V3 architecture
- Automated tests
- No hard-coded credentials or private identifiers

## Architecture

The extension separates responsibilities across multiple components:

- `content.js` — detects task-related elements on the monitored page
- `background.js` — coordinates background events, notifications, and extension state
- `popup.js` — manages user interaction through the extension popup
- `offscreen.js` — handles functionality requiring an offscreen document
- `config.js` — defines public monitoring configuration
- `config.example.js` — provides an example configuration
- `tests/` — contains automated tests
- `icons/` — extension assets

This separation keeps DOM detection independent from notification and background-processing logic.

## Technologies

- JavaScript
- Chrome Extension APIs
- Manifest V3
- DOM APIs
- Asynchronous JavaScript
- Telegram Bot API
- Browser Notifications
- Local Storage

## Configuration

The repository uses generic configuration and does not contain production credentials.

Example:

```javascript
globalThis.TASK_MONITOR_CONFIG = Object.freeze({
  targetUrl: "https://example.com/tasks",
  rowSelector: "table tbody tr",
  cellSelector: "td",
  cardSelector: "",
  scanDelayMs: 800
});
```

Update the target URL and selectors according to the page you want to monitor.

When changing the target domain, also update the corresponding `host_permissions` and `content_scripts.matches` entries in `manifest.json`.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project directory.
6. Configure the target page and selectors.

## Notifications

When matching tasks are detected, the extension can notify the user through:

- Chrome desktop notifications
- Sound alerts
- Optional Telegram notifications

Telegram integration should be configured without committing bot tokens or private identifiers to the repository.

## Security

Sensitive information should never be committed to source control.

The public repository intentionally excludes:

- Telegram bot tokens
- Private chat identifiers
- Authentication credentials
- User-specific information

Configuration examples use placeholder values only.

## Testing

The `tests/` directory contains automated tests for core monitoring behavior.

The monitoring logic is designed so detection behavior can be validated independently from browser notification and UI components.

## Engineering Goals

This project focuses on:

- Separation of concerns
- Maintainable browser-extension architecture
- Asynchronous event handling
- External API integration
- Defensive configuration
- Testable monitoring logic
- Secure handling of credentials

## License

This project is provided for educational and portfolio purposes.
