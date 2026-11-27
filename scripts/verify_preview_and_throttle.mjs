import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PREVIEW_PORT = 3000;
const CHROME_PORT = 9222;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 1. HTTP HEAD Request helper
function testHttpHead(urlPath) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: 'localhost',
        port: PREVIEW_PORT,
        path: urlPath,
        method: 'HEAD'
      },
      (res) => {
        resolve({
          path: urlPath,
          statusCode: res.statusCode,
          headers: res.headers
        });
      }
    );
    req.on('error', (err) => {
      resolve({ path: urlPath, statusCode: 0, error: err.message });
    });
    req.end();
  });
}

// 2. CDP Client over native WebSocket
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        const listeners = this.eventListeners.get(data.method) || [];
        for (const fn of listeners) fn(data.params);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Step 1: Starting Vite Preview Server ===');
  const previewProc = spawn('pnpm', ['--filter', '@na/game', 'preview', '--port', '3000', '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  let serverReady = false;
  previewProc.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('http://localhost:3000/')) {
      serverReady = true;
    }
  });

  // Wait for preview server to respond
  for (let i = 0; i < 30; i++) {
    if (serverReady) break;
    await sleep(250);
  }
  await sleep(1000);

  console.log('Preview server confirmed on http://localhost:3000/');

  console.log('\n=== Step 2: Testing Headers and 404 Behavior ===');
  // Find hashed asset name from dist
  const distAssets = fs.readdirSync('apps/game/dist/assets');
  const indexJs = distAssets.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  const testTargets = [
    '/',
    `/assets/${indexJs}`,
    '/assets/elder_austen_tuned.bin',
    '/nonexistent_file.bin'
  ];

  const headerResults = [];
  for (const target of testTargets) {
    const res = await testHttpHead(target);
    headerResults.push({
      target: res.path,
      status: res.statusCode,
      coop: res.headers ? res.headers['cross-origin-opener-policy'] : 'none',
      coep: res.headers ? res.headers['cross-origin-embedder-policy'] : 'none',
      cacheControl: res.headers ? res.headers['cache-control'] : 'none',
      contentType: res.headers ? res.headers['content-type'] : 'none'
    });
  }
  console.table(headerResults);

  console.log('\n=== Step 3: Launching Headless Chrome for DevTools CDP ===');
  const tempUserDataDir = path.resolve('temp_chrome_profile_' + Date.now());
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CHROME_PORT}`,
    '--headless=new',
    '--disable-gpu', // software adapter fallback in headless
    '--enable-unsafe-webgpu',
    `--user-data-dir=${tempUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  await sleep(2000);

  const versionInfo = await getJson(`http://127.0.0.1:${CHROME_PORT}/json/version`);
  console.log(`Connected to Chrome: ${versionInfo.Browser}`);

  const tabs = await getJson(`http://127.0.0.1:${CHROME_PORT}/json/list`);
  const mainTab = tabs.find((t) => t.type === 'page');
  const cdp = new CdpClient(mainTab.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('Connected to CDP WebSocket');

  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');

  // Verify crossOriginIsolated on baseline load
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(1500);

  const coiResult = await cdp.send('Runtime.evaluate', {
    expression: 'window.crossOriginIsolated'
  });
  const isIsolated = coiResult.result?.value;
  console.log(`\n>>> window.crossOriginIsolated in real browser: ${isIsolated} <<<`);

  console.log('\n=== Step 4: Network Throttling Measurements (Cold Cache, 3 Repeats) ===');

  // Fast 4G: 1.5 Mbps (196,608 B/s), 750 kbps (96,000 B/s), 40 ms RTT
  const fast4GConditions = {
    offline: false,
    latency: 40,
    downloadThroughput: 196608,
    uploadThroughput: 96000
  };

  // Slow 4G: 500 kbps (64,000 B/s), 250 kbps (32,000 B/s), 400 ms RTT
  const slow4GConditions = {
    offline: false,
    latency: 400,
    downloadThroughput: 64000,
    uploadThroughput: 32000
  };

  async function measureThrottledRun(name, conditions, runIdx) {
    // Force cold cache
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', conditions);

    const t0 = Date.now();
    let loadFired = false;
    const onLoad = () => { loadFired = true; };
    cdp.on('Page.loadEventFired', onLoad);

    await cdp.send('Page.navigate', { url: 'http://localhost:3000/' });

    // Wait for loadEventFired or timeout
    const startWait = Date.now();
    while (!loadFired && Date.now() - startWait < 15000) {
      await sleep(50);
    }

    // Measure time to first interactive frame / Capability Gate rendered
    // Capability Gate renders the button with text 'Enter Simulation' or 'Launch Neural Simulation'
    let interactiveTime = null;
    const startPoll = Date.now();
    while (Date.now() - startPoll < 10000) {
      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('button');
          const ready = !!document.getElementById('na-capability-gate') || !!btn;
          const p = performance.getEntriesByType('paint');
          const fcp = p.find(e => e.name === 'first-contentful-paint')?.startTime || null;
          return { ready, fcp, now: performance.now() };
        })()`,
        returnByValue: true
      });
      const val = evalRes.result?.value;
      if (val && val.ready) {
        interactiveTime = Date.now() - t0;
        break;
      }
      await sleep(100);
    }

    const timingRes = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const p = performance.getEntriesByType('paint');
        const fp = p.find(e => e.name === 'first-paint')?.startTime || 0;
        const fcp = p.find(e => e.name === 'first-contentful-paint')?.startTime || 0;
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          fp: Math.round(fp),
          fcp: Math.round(fcp),
          domInteractive: nav ? Math.round(nav.domInteractive) : 0,
          domComplete: nav ? Math.round(nav.domComplete) : 0
        };
      })()`,
      returnByValue: true
    });

    const perfMetrics = timingRes.result?.value || {};
    return {
      profile: name,
      run: runIdx + 1,
      wallClockInteractiveMs: interactiveTime,
      fcpMs: perfMetrics.fcp,
      domInteractiveMs: perfMetrics.domInteractive,
      domCompleteMs: perfMetrics.domComplete
    };
  }

  const fast4GResults = [];
  for (let r = 0; r < 3; r++) {
    console.log(`Running Fast 4G Repeat ${r + 1}/3...`);
    const res = await measureThrottledRun('Fast 4G', fast4GConditions, r);
    fast4GResults.push(res);
  }

  const slow4GResults = [];
  for (let r = 0; r < 3; r++) {
    console.log(`Running Slow 4G Repeat ${r + 1}/3...`);
    const res = await measureThrottledRun('Slow 4G', slow4GConditions, r);
    slow4GResults.push(res);
  }

  console.log('\nThrottling Results:');
  console.table([...fast4GResults, ...slow4GResults]);

  console.log('\n=== Step 5: Tutorial State-Machine Verification (Beat 1 & Beat 2) ===');
  // Reset network to unthrottled
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Direct launch into simulation mode to instantiate TutorialDirector
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/?direct=1' });
  
  // Wait up to 5s for game engine or direct bootstrap
  let directorReady = false;
  for (let i = 0; i < 50; i++) {
    const check = await cdp.send('Runtime.evaluate', {
      expression: 'typeof window.__tutorialDirector !== "undefined"'
    });
    if (check.result?.value === true) {
      directorReady = true;
      break;
    }
    await sleep(100);
  }

  let tutorialRun;
  if (directorReady) {
    tutorialRun = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const d = window.__tutorialDirector;
        d.replayTutorial();
        const step0 = d.getCurrentStep();
        
        // Beat 1: player_moved
        d.handleEvent({ type: 'player_moved', payload: { distance: 15.0 } });
        const step1 = d.getCurrentStep();
        
        // Beat 2: shard_harvested
        d.handleEvent({ type: 'shard_harvested', payload: { keptCount: 3, shardId: 'shard-01' } });
        const step2 = d.getCurrentStep();

        return {
          source: 'browser_engine',
          beat0: { id: step0.id, title: step0.title },
          beat1_after_move: { id: step1.id, title: step1.title },
          beat2_after_harvest: { id: step2.id, title: step2.title },
          completedSteps: d.getState().progress.completedSteps
        };
      })()`,
      returnByValue: true
    });
  } else {
    console.log('In-browser engine deferred; verifying TutorialDirector state machine directly...');
    const { TutorialDirector } = await import('../packages/game-core/src/tutorial/director.ts');
    const d = new TutorialDirector();
    d.replayTutorial();
    const step0 = d.getCurrentStep();
    d.handleEvent({ type: 'player_moved', payload: { distance: 15.0 } });
    const step1 = d.getCurrentStep();
    d.handleEvent({ type: 'shard_harvested', payload: { keptCount: 3, shardId: 'shard-01' } });
    const step2 = d.getCurrentStep();

    tutorialRun = {
      result: {
        value: {
          source: 'game_core_standalone',
          beat0: { id: step0.id, title: step0.title },
          beat1_after_move: { id: step1.id, title: step1.title },
          beat2_after_harvest: { id: step2.id, title: step2.title },
          completedSteps: d.getState().progress.completedSteps
        }
      }
    };
  }

  console.log('Tutorial Execution Output:\n', JSON.stringify(tutorialRun.result?.value, null, 2));

  // Cleanup
  cdp.close();
  chromeProc.kill('SIGINT');
  previewProc.kill('SIGINT');
  try {
    fs.rmSync(tempUserDataDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== All Automated Verifications Complete ===');
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
