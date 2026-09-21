const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');

(async () => {
  const session = {};
  let listener;
  const defaults = { soundEnabled: false, desktopNotifications: false, telegramEnabled: false };
  const context = vm.createContext({
    URL, console, setTimeout, clearTimeout,
    fetch: async () => { throw new Error('DO_NOT_EXPOSE_PRIVATE_VALUE'); },
    chrome: {
      storage: {
        local: { get: async d => ({ ...d, ...defaults }), setAccessLevel: async () => {} },
        session: {
          get: async k => ({ [k]: session[k] }),
          set: async value => Object.assign(session, value),
          remove: async k => { delete session[k]; }
        }
      },
      runtime: { onMessage: { addListener: fn => { listener = fn; } }, getURL: path => `chrome-extension://test/${path}` },
      alarms: { onAlarm: { addListener() {} } },
      tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } }
    }
  });
  vm.runInContext(read('config.js'), context);
  vm.runInContext(read('background.js').replace('import "./config.js";', ''), context);
  assert.equal(vm.runInContext('isTargetUrl("https://example.com/tasks?q=1")', context), true);
  assert.equal(vm.runInContext('isTargetUrl("https://example.com.evil.test/tasks")', context), false);
  assert.equal(vm.runInContext('isTargetUrl("https://example.com/other")', context), false);
  context.alerts = [];
  vm.runInContext('alertForNewRows = async (tabId, rows) => alerts.push(rows)', context);
  session['monitor:1'] = { running: true, previousRows: null };
  const snapshot = rows => {
    context.inputRows = rows;
    return vm.runInContext('processSnapshot({ rows: inputRows }, { tab: { id: 1 }, url: "https://example.com/tasks" })', context);
  };
  await snapshot(['old']);
  assert.equal(context.alerts.length, 0);
  await snapshot(['old', 'new', 'new']);
  assert.equal(JSON.stringify(context.alerts), '[["new"]]');
  await snapshot(['old', 'new']);
  assert.equal(context.alerts.length, 1);
  session['monitor:1'].running = false;
  await snapshot(['ignored']);
  assert.equal(context.alerts.length, 1);
  assert.equal(listener({ type: 'getStatus' }, { tab: { id: 1 } }, () => { throw new Error('leaked settings'); }), false);
  assert.equal(listener({ type: 'saveSettings' }, { url: 'https://example.com/tasks' }, () => {}), false);
  await assert.rejects(vm.runInContext('sendTelegram("test", { telegramEnabled: true, telegramBotToken: "dummy", telegramChatId: "dummy" })', context), error => !error.message.includes('DO_NOT_EXPOSE'));

  let contentListener;
  const timers = new Map();
  let sequence = 0;
  const content = vm.createContext({
    console,
    setTimeout(fn) { timers.set(++sequence, fn); return sequence; },
    clearTimeout(id) { timers.delete(id); },
    chrome: { runtime: { onMessage: { addListener(fn) { contentListener = fn; } }, sendMessage: async () => ({ ok: true }) } },
    location: { reload() { throw new Error('Unexpected reload'); } },
    document: { querySelectorAll: () => [] }
  });
  vm.runInContext(read('config.js'), content);
  vm.runInContext(read('content.js'), content);
  contentListener({ type: 'startMonitoring', intervalSeconds: 10 });
  assert.equal(timers.size, 1);
  contentListener({ type: 'stopMonitoring' });
  assert.equal(timers.size, 0, 'Stop must cancel pending initial scan');
  contentListener({ type: 'startMonitoring', intervalSeconds: 10 });
  contentListener({ type: 'startMonitoring', intervalSeconds: 10 });
  assert.equal(timers.size, 1, 'Repeated Start must replace the pending scan');
  contentListener({ type: 'stopMonitoring' });
  const manifest = JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.content_scripts[0].js, ['config.js', 'content.js']);
  assert.equal(read('config.js'), read('config.example.js'));
  console.log('All extension checks passed. Browser integration is not covered.');
})().catch(error => { console.error(error); process.exitCode = 1; });
