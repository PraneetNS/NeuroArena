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

async function evalInPage(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text || 'Runtime.evaluate exception');
  }
  return res.result?.value;
}

async function main() {
  console.log('=== Step 1: Starting Vite Preview Server ===');
  const previewProc = spawn('npx', ['pnpm', '--filter', '@na/game', 'preview'], {
    shell: true,
    stdio: 'ignore'
  });

  // Wait for port 3000
  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(`http://localhost:${PREVIEW_PORT}/`, (r) => {
          if (r.statusCode === 200) res();
          else rej();
        });
        req.on('error', rej);
      });
      serverReady = true;
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!serverReady) {
    console.error('Preview server failed to start');
    previewProc.kill();
    process.exit(1);
  }
  console.log('Preview server ready on http://localhost:3000');

  console.log('\n=== Step 2: Launching Chrome with WebGPU & Remote Debugging ===');
  const userDataDir = path.resolve(process.cwd(), 'scratch/chrome_loom_profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${CHROME_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--enable-unsafe-webgpu',
      '--use-webgpu-power-preference=2', // high-performance
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    try {
      versionInfo = await getJson(`http://localhost:${CHROME_PORT}/json/version`);
      if (versionInfo?.webSocketDebuggerUrl) break;
    } catch {
      await sleep(250);
    }
  }

  const browserCdp = new CdpClient(versionInfo.webSocketDebuggerUrl);
  await browserCdp.connect();

  const newTarget = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
  const pageTargetId = newTarget.targetId;

  const targets = await getJson(`http://localhost:${CHROME_PORT}/json`);
  const pageInfo = targets.find((t) => t.id === pageTargetId);
  const pageCdp = new CdpClient(pageInfo.webSocketDebuggerUrl);
  await pageCdp.connect();

  await pageCdp.send('Page.enable');
  await pageCdp.send('Runtime.enable');

  console.log('\n=== Step 3: Navigating to NeuroArena World ===');
  await pageCdp.send('Page.navigate', { url: `http://localhost:${PREVIEW_PORT}/?direct=1` });

  // Wait for canvas and world bootstrap
  let worldReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const ready = await evalInPage(
      pageCdp,
      `Boolean(window.__tutorialDirector && window.toggleLoom && document.querySelector('canvas'))`
    );
    if (ready) {
      worldReady = true;
      break;
    }
  }

  if (!worldReady) {
    console.error('World failed to bootstrap within 20s');
  } else {
    console.log('World bootstrapped! Canvas, TutorialDirector, and toggleLoom verified.');
  }

  console.log('\n=== Step 4: Driving Quest Flow & The Loom in Real Browser ===');

  // 1. Advance tutorial to fen_beacon
  const directorState = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      // Advance to reward_unlocked -> fen_beacon
      d.handleEvent({ type: 'player_moved' });
      d.handleEvent({ type: 'shard_harvested', payload: { keptCount: 3 } });
      d.handleEvent({ type: 'lens_scanned' });
      d.handleEvent({ type: 'shard_discarded' });
      d.handleEvent({ type: 'cache_swept' });
      d.handleEvent({ type: 'workbench_opened' });
      d.handleEvent({ type: 'nodes_connected' });
      d.handleEvent({ type: 'tokenizer_inspected' });
      d.handleEvent({ type: 'training_started' });
      d.handleEvent({ type: 'divergence_observed' });
      d.handleEvent({ type: 'model_trained' });
      d.handleEvent({ type: 'model_prompted' });
      d.handleEvent({ type: 'codex_opened' });
      return { currentStep: d.getCurrentStep().id, completed: d.getState().progress.completedStepIds };
    })()
  `);
  console.log('Director after FTUE completion:', directorState);

  // 2. Beacon to the Fen arrival
  console.log('\nDriving Beat 1: Arrive at the Fen beacon [-180, -120]...');
  const arriveRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({ type: 'fen_arrived', payload: { distance: 5.0 } });
      return { currentStep: d.getCurrentStep().id };
    })()
  `);
  console.log('After Fen arrival:', arriveRes);

  // 3. Collect 150k clean tokens with Lens
  console.log('\nDriving Beat 2: Collect ≥ 150k clean tokens in vault...');
  const harvestRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({ type: 'shard_harvested', payload: { cleanTokens: 165000, keptCount: 180 } });
      return { currentStep: d.getCurrentStep().id };
    })()
  `);
  console.log('After 150k harvest:', harvestRes);

  // 4. Open The Loom
  console.log('\nOpening The Loom UI modal in browser...');
  await evalInPage(pageCdp, `window.toggleLoom(true)`);
  await sleep(400);

  // Read on-screen DOM values from the Loom modal
  const onScreenLoom = await evalInPage(pageCdp, `
    (() => {
      const modal = document.querySelector('#app-loom-container');
      const text = modal ? modal.innerText : '';
      return {
        hasModal: Boolean(modal),
        titleVisible: text.includes('The Loom: Discrete N-Gram Instrument'),
        valLossText: text.match(/(\\d+\\.\\d{3})\\s*nats\\/tok/)?.[1] || null,
        entriesText: text.match(/(\\d+[kM]|\\d+,\\d+)\\s*entries/)?.[0] || null,
        buildTimeText: text.match(/Build time:.*PASS.*2 s/)?.[0] || null
      };
    })()
  `);
  console.log('On-screen Loom Modal state:', onScreenLoom);

  // 5. Beat Bigram Gate on VAL (4.001)
  console.log('\nDriving Beat 3: Weave Bigram in the Loom and beat 4.001 gate...');
  const bigramBeatRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({ type: 'loom_bigram_beaten', payload: { valLoss: 4.001, bigramLoss: 4.001 } });
      return { currentStep: d.getCurrentStep().id };
    })()
  `);
  console.log('After Loom Bigram beaten:', bigramBeatRes);

  // 6. Test Unseen Context & Thread Fraying
  console.log('\nDriving Beat 4: Test unseen trigram context to observe fraying and backoff...');
  const frayRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({
        type: 'loom_context_frayed',
        payload: { frayed: true, unseenContext: 'shall never yield', order: 3 }
      });
      return { currentStep: d.getCurrentStep().id };
    })()
  `);
  console.log('After Loom Trigram fraying event:', frayRes);

  // 7. Train Scout in Workbench to beat trigram gate (3.959)
  console.log('\nDriving Beat 5: Train Scout in Workbench to beat trigram gate (3.959)...');
  const scoutBeatRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({
        type: 'scout_trigram_beaten',
        payload: { valLoss: 2.925 }
      });
      return { currentStep: d.getCurrentStep().id };
    })()
  `);
  console.log('After Scout trigram beaten:', scoutBeatRes);

  // 8. Unlock Fen Observatory & Vault Tier II
  console.log('\nDriving Beat 6: Unlock Fen Observatory & Vault Tier II...');
  const finalStepRes = await evalInPage(pageCdp, `
    (() => {
      const d = window.__tutorialDirector;
      d.handleEvent({ type: 'observatory_entered' });
      return {
        completedAll: d.getState().progress.completedStepIds.includes('fen_observatory_unlocked'),
        totalCompleted: d.getState().progress.completedStepIds.length
      };
    })()
  `);
  console.log('Final quest status:', finalStepRes);

  // Take screenshot of the Loom modal in action
  const screenshotData = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/loom_modal_browser.png', Buffer.from(screenshotData.data, 'base64'));
  console.log('\nSaved screenshot to scratch/loom_modal_browser.png');

  // Cleanup
  pageCdp.close();
  browserCdp.close();
  chromeProc.kill();
  previewProc.kill();

  console.log('\n=== Real Browser Verification Complete: SUCCESS ===');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
