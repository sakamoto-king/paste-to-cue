import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { delay, until } from './cdp.mjs';

export const modelDir = 'local-asr/models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20';
export async function staticServer() {
  const server = http.createServer(async (req, res) => {
    const files = { '/': 'index.html', '/index.html': 'index.html', '/0.wav': `${modelDir}/test_wavs/0.wav`, '/1.wav': `${modelDir}/test_wavs/1.wav` };
    const file = files[req.url?.split('?')[0]];
    if (!file) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : 'text/html; charset=utf-8'); res.end(await readFile(file)); }
    catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

export async function unreadyServer() {
  const connections = new Set();
  const server = http.createServer();
  server.on('connection', connection => {
    connections.add(connection);
    connection.on('close', () => connections.delete(connection));
  });
  server.on('upgrade', (request, connection) => {
    const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    connection.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    // A successful handshake without ready exercises the frontend's deadline.
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return {url:`ws://127.0.0.1:${server.address().port}`,close:async()=>{
    for(const connection of connections) connection.destroy();
    await new Promise(resolve=>server.close(resolve));
  }};
}

export async function localServer() {
  const python = process.env.CUE_PYTHON || (process.platform === 'win32' ? 'local-asr/.venv/Scripts/python.exe' : 'local-asr/.venv/bin/python');
  const child = spawn(python, ['local-asr/server.py', '--port', '0'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', stopped = false;
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('error', error => { output += error.message; });
  const close = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode == null && child.signalCode == null) {
      const exited = once(child, 'exit'); child.kill();
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode == null && child.signalCode == null) throw new Error('ASR child did not exit');
    }
  };
  try {
    const url = await until(() => {
      if (child.exitCode != null) throw new Error(`ASR exited ${output}`);
      return output.match(/Listening (ws:\/\/127\.0\.0\.1:\d+)/)?.[1];
    }, 60000);
    return { url, health: url.replace('ws:', 'http:') + '/health', close, output: () => output };
  } catch (error) { await close(); throw error; }
}

export async function socket(url) {
  const messages = [];
  const ws = new WebSocket(url);
  ws.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  await once(ws, 'open');
  return { ws, messages, send: value => ws.send(JSON.stringify(value)),
    wait: (type, predicate = () => true) => until(() => messages.find(m => m.type === type && predicate(m)), 20000),
    close: async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = once(ws, 'close'); ws.close(); await closed; } };
}

export function wavPcm(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Expected WAV');
  let format, data;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + size);
    if (type === 'fmt ') format = { encoding: chunk.readUInt16LE(0), channels: chunk.readUInt16LE(2), rate: chunk.readUInt32LE(4), bits: chunk.readUInt16LE(14) };
    if (type === 'data') data = chunk;
    offset += 8 + size + size % 2;
  }
  if (!data || format?.encoding !== 1 || format.channels !== 1 || format.rate !== 16000 || format.bits !== 16) throw new Error(`Unsupported WAV ${JSON.stringify(format)}`);
  return data;
}
