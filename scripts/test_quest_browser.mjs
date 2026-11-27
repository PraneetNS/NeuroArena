import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PORT = 9222;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/?direct=1';

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
  console.log('Launching headless Chrome with WebGPU on port', CHROME_PORT);
  const profileDir = path.resolve(process.cwd(), 'scratch/chrome_quest_profile');
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CHROME_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--enable-unsafe-webgpu',
      '--use-webgpu-power-preference=2',
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

  if (!versionInfo?.webSocketDebuggerUrl) {
    throw new Error('Failed to connect to Chrome debugging endpoint');
  }

  const browserCdp = new CdpClient(versionInfo.webSocketDebuggerUrl);
  await browserCdp.connect();

  const newTarget = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
  const targets = await getJson(`http://localhost:${CHROME_PORT}/json`);
  const pageInfo = targets.find((t) => t.id === newTarget.targetId);
  const pageCdp = new CdpClient(pageInfo.webSocketDebuggerUrl);
  await pageCdp.connect();

  await pageCdp.send('Page.enable');
  await pageCdp.send('Runtime.enable');
  await pageCdp.send('Console.enable');

  pageCdp.ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Console.messageAdded') {
      console.log('[Browser Console]', data.params.message.text);
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('[Browser Exception]', data.params.exceptionDetails);
    }
  });

  console.log('Navigating to', APP_URL);
  await pageCdp.send('Page.navigate', { url: APP_URL });

  console.log('Waiting for game bootstrap...');
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    ready = await evalInPage(
      pageCdp,
      `Boolean(window.__game && window.vault && document.querySelector('canvas'))`
    );
    if (ready) break;
  }

  if (!ready) {
    throw new Error('Game failed to bootstrap within 20s');
  }

  console.log('Game bootstrapped successfully!');
  const info = await evalInPage(pageCdp, `
    (() => {
      const g = window.__game;
      const v = window.vault;
      const d = window.__tutorialDirector;
      return {
        shardsCount: g.shardWorld.worldState.shards.length,
        initialVaultTokens: v.getState().stats.cleanTokens,
        initialVaultPages: v.getState().stats.count,
        directorStep: d.getCurrentStep().id
      };
    })()
  `);
  console.log('Game State:', info);

  pageCdp.close();
  browserCdp.close();
  chromeProc.kill('SIGINT');
}

main().catch(console.error);
