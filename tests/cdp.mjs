import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, access } from 'node:fs/promises';
import path from 'node:path';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(check, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await check();
    if (value) return value;
    await delay(30);
  }
  throw new Error(`Condition timed out after ${timeout} ms. Last value ${JSON.stringify(value)}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.serial = 0;
    this.pending = new Map();
    this.errors = [];
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    ws.addEventListener('close', () => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP closed')); }
      this.pending.clear();
    });
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

export async function browser() {
  const candidates = [process.env.CUE_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
  if (!executable) throw new Error('Install Edge / Chrome or set CUE_BROWSER');
  const profileRoot = path.resolve('test-results');
  await mkdir(profileRoot, {recursive:true});
  const profile = await mkdtemp(path.join(profileRoot, 'cue-cdp-'));
  let child, cdp, stopped = false;
  const close = async () => {
    if (stopped) return;
    stopped = true;
    try { if (cdp?.ws.readyState === WebSocket.OPEN) await cdp.call('Browser.close'); } catch {}
    if (child && child.exitCode == null && child.signalCode == null) {
      const exited = once(child, 'exit');
      await Promise.race([exited, delay(2500)]);
      if (child.exitCode == null && child.signalCode == null) { child.kill(); await exited; }
    }
    cdp?.ws.close();
    if (path.dirname(path.resolve(profile)) !== profileRoot || !path.basename(profile).startsWith('cue-cdp-')) throw new Error('Unexpected browser profile path');
    await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  };
  try {
    child = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
      '--disable-background-networking', '--disable-features=msEdgeSidebarV2', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { stderr += error.message; });
    const port = await until(async () => {
      if (child.exitCode != null) throw new Error(`Browser exited ${stderr}`);
      try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; }
    });
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const tab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await once(ws, 'open');
    cdp = new CDP(ws);
    await cdp.call('Runtime.enable');
    await cdp.call('Page.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false});
    return Object.assign(cdp, { close });
  } catch (error) { await close(); throw error; }
}

export const mockSpeech = `
window.__recognizers = [];
class TestRecognition {
  constructor() { window.__recognizers.push(this); }
  start() { this.onstart?.(); }
  abort() { this.aborted = true; this.onend?.(); }
  emit(slots, index = 0) {
    const results = slots.map(([text, final]) => { const r = [{transcript:text}]; r.isFinal = final; return r; });
    this.onresult?.({resultIndex:index,results});
  }
}
window.SpeechRecognition = TestRecognition;
window.__mediaContexts = [];
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async () => {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createConstantSource(); source.offset.value = 0;
  source.connect(dest); source.start(); await ctx.resume();
  window.__mediaContexts.push({ctx,dest});
  return dest.stream;
}});
window.__playWav = async url => {
  const {ctx,dest} = window.__mediaContexts.at(-1);
  const buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(dest); source.start();
  return buffer.duration;
};
`;
