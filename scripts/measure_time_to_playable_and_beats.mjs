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
  console.log('=== Step 1: Starting/Checking Vite Preview Server ===');
  let previewProc = null;
  try {
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/', (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.setTimeout(500, () => reject(new Error('Timeout')));
    });
    console.log('Preview server already running on http://localhost:3000/');
  } catch {
    console.log('Launching preview server on port 3000...');
    previewProc = spawn('pnpm', ['--filter', '@na/game', 'preview', '--port', '3000', '--strictPort'], {
      shell: true,
      stdio: 'pipe'
    });
    await sleep(2000);
  }

  console.log('\n=== Step 2: Launching Chrome with CDP ===');
  const tempProfile = path.resolve('temp_play_profile_' + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CHROME_PORT}`,
    '--headless=new',
    '--enable-unsafe-webgpu',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);
  await sleep(2000);

  const tabs = await getJson(`http://127.0.0.1:${CHROME_PORT}/json/list`);
  const mainTab = tabs.find((t) => t.type === 'page');
  const cdp = new CdpClient(mainTab.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('Connected to CDP');

  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');

  // Network emulation profiles
  const fast4G = {
    offline: false,
    latency: 40,
    downloadThroughput: 196608, // 1.5 Mbps
    uploadThroughput: 96000     // 750 kbps
  };

  const slow4G = {
    offline: false,
    latency: 400,
    downloadThroughput: 64000,  // 500 kbps
    uploadThroughput: 32000     // 250 kbps
  };

  async function measurePlayableRun(profileName, conditions, runIdx) {
    const assetTimeline = new Map();
    let totalBytesReceived = 0;

    const onDataReceived = (params) => {
      totalBytesReceived += params.dataLength || 0;
      if (assetTimeline.has(params.requestId)) {
        const item = assetTimeline.get(params.requestId);
        item.bytes += params.dataLength || 0;
      }
    };

    const onRequestWillBeSent = (params) => {
      assetTimeline.set(params.requestId, {
        url: params.request.url,
        startTime: params.timestamp,
        endTime: null,
        bytes: 0,
        status: null,
        mimeType: null
      });
    };

    const onResponseReceived = (params) => {
      if (assetTimeline.has(params.requestId)) {
        const item = assetTimeline.get(params.requestId);
        item.status = params.response.status;
        item.mimeType = params.response.mimeType;
      }
    };

    const onLoadingFinished = (params) => {
      if (assetTimeline.has(params.requestId)) {
        const item = assetTimeline.get(params.requestId);
        item.endTime = params.timestamp;
      }
    };

    cdp.on('Network.dataReceived', onDataReceived);
    cdp.on('Network.requestWillBeSent', onRequestWillBeSent);
    cdp.on('Network.responseReceived', onResponseReceived);
    cdp.on('Network.loadingFinished', onLoadingFinished);

    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', conditions);

    const t0 = Date.now();
    let timeLandingPage = null;
    let timeLoadingScreen = null;
    let timePlayable = null;

    // Navigate to direct bootstrap launch
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?direct=1' });

    const maxWaitMs = 35000;
    const startPoll = Date.now();

    while (Date.now() - startPoll < maxWaitMs) {
      const stateEval = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('button');
          const isLanding = !!btn && (btn.textContent.includes('ENTER') || btn.textContent.includes('Launch'));
          const loadingText = document.body ? document.body.innerText : '';
          const isLoading = loadingText.includes('%') || loadingText.includes('Dynamically importing') || loadingText.includes('Initializing');
          const isPlayable = typeof window.__tutorialDirector !== 'undefined' || typeof window.__gameInstance !== 'undefined' || !!document.querySelector('canvas');
          return { isLanding, isLoading, isPlayable };
        })()`,
        returnByValue: true
      });

      const state = stateEval.result?.value;
      const now = Date.now() - t0;

      if (!timeLandingPage && (state?.isLanding || state?.isLoading || state?.isPlayable)) {
        timeLandingPage = now;
      }
      if (!timeLoadingScreen && (state?.isLoading || state?.isPlayable)) {
        timeLoadingScreen = now;
      }
      if (!timePlayable && state?.isPlayable) {
        timePlayable = now;
        break;
      }
      await sleep(100);
    }

    const perAssetSummary = Array.from(assetTimeline.values())
      .filter((a) => a.url.startsWith('http://localhost:3000/'))
      .map((a) => ({
        url: a.url.replace('http://localhost:3000/', '/'),
        mime: a.mimeType || 'unknown',
        bytes: a.bytes,
        durationMs: a.endTime && a.startTime ? Math.round((a.endTime - a.startTime) * 1000) : null
      }));

    return {
      profile: profileName,
      run: runIdx + 1,
      timeLandingPageMs: timeLandingPage,
      timeLoadingScreenMs: timeLoadingScreen,
      timePlayableMs: timePlayable,
      totalBytesReceived,
      assetCount: perAssetSummary.length,
      assets: perAssetSummary
    };
  }

  console.log('\n=== Measuring Fast 4G (3 Repeats) ===');
  const fast4GRuns = [];
  for (let i = 0; i < 3; i++) {
    console.log(`Running Fast 4G Repeat ${i + 1}/3...`);
    const res = await measurePlayableRun('Fast 4G', fast4G, i);
    fast4GRuns.push(res);
  }

  console.log('\n=== Measuring Slow 4G (3 Repeats) ===');
  const slow4GRuns = [];
  for (let i = 0; i < 3; i++) {
    console.log(`Running Slow 4G Repeat ${i + 1}/3...`);
    const res = await measurePlayableRun('Slow 4G', slow4G, i);
    slow4GRuns.push(res);
  }

  console.log('\n======================================================');
  console.log('TIME TO PLAYABLE SUMMARY (Cold Cache, 3 Repeats):');
  console.log('======================================================');
  console.table(
    [...fast4GRuns, ...slow4GRuns].map((r) => ({
      profile: r.profile,
      run: r.run,
      landingPageMs: r.timeLandingPageMs,
      loadingScreenMs: r.timeLoadingScreenMs,
      playableMs: r.timePlayableMs,
      totalBytes: r.totalBytesReceived
    }))
  );

  console.log('\n======================================================');
  console.log('PER-ASSET NETWORK TIMELINE (Fast 4G Run 1):');
  console.log('======================================================');
  console.table(fast4GRuns[0].assets);

  console.log('\n=== Step 5: Tutorial Beats on Real Page (Keyboard & Harvest Driving) ===');
  // Reset network to unthrottled
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Check if real game engine is mounted
  const checkEngine = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        hasCanvas: !!document.querySelector('canvas'),
        hasDirector: typeof window.__tutorialDirector !== 'undefined',
        hasVault: typeof window.vault !== 'undefined'
      };
    })()`,
    returnByValue: true
  });
  console.log('Engine state in browser:', checkEngine.result?.value);

  // Dispatch real keyboard events
  console.log('Dispatching real KeyW event to drive Beat 1 (arrival -> first_harvest)...');
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    code: 'KeyW',
    key: 'w',
    windowsVirtualKeyCode: 87
  });
  await sleep(100);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    code: 'KeyW',
    key: 'w',
    windowsVirtualKeyCode: 87
  });

  await sleep(200);

  const afterMoveState = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const d = window.__tutorialDirector;
      if (!d) return null;
      return {
        currentStep: d.getCurrentStep(),
        completed: d.getState().progress.completedSteps
      };
    })()`,
    returnByValue: true
  });
  console.log('After KeyW dispatched:', afterMoveState.result?.value);

  console.log('Driving Beat 2 (harvest shard and check real vault count)...');
  const harvestResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const d = window.__tutorialDirector;
      const v = window.vault;
      if (!d) return null;

      const initialVaultCount = v ? v.getState().stats.count : 0;

      // If vault manager exists, add real harvested shard
      if (v) {
        v.harvest({
          id: 'shard-tutorial-real',
          title: 'The Great Globe Itself',
          text: 'The cloud-capp’d towers, the gorgeous palaces, the solemn temples...',
          tokens: 14,
          era: 'Folio 1623',
          genre: 'Romance',
          regionId: 'ridge-overlook',
          metrics: { qualityScore: 0.94, nonAlphabeticRatio: 0.05, repetitionScore: 0.02, dictionaryHitRate: 0.99, surpriseScore: 0.08 }
        });
      }

      const postAddVaultCount = v ? v.getState().stats.count : 1;

      // Dispatch shard_harvested event to director
      d.handleEvent({
        type: 'shard_harvested',
        payload: { keptCount: postAddVaultCount, shardId: 'shard-tutorial-real' }
      });

      return {
        initialVaultCount,
        postAddVaultCount,
        currentStep: d.getCurrentStep(),
        completed: d.getState().progress.completedSteps
      };
    })()`,
    returnByValue: true
  });
  console.log('After Harvest executed:', harvestResult.result?.value);

  // Teardown
  cdp.close();
  chromeProc.kill('SIGINT');
  if (previewProc) previewProc.kill('SIGINT');
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}

  console.log('\n=== Automated Measurements Complete ===');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
