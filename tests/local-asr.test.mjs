import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { browser, mockSpeech, until, delay } from './cdp.mjs';
import { localServer, staticServer, socket, wavPcm, modelDir } from './support.mjs';

let asr, web, page;
before(async () => { asr = await localServer(); web = await staticServer(); }, {timeout:90000});
after(async () => { try { await page?.close(); } finally { try { await web?.close(); } finally { await asr?.close(); } } });

test('real recognizer health GET and OPTIONS permit local-network access', async () => {
  for (const method of ['GET','OPTIONS']) {
    const response = await fetch(asr.health, {method});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),'*');
    assert.equal(response.headers.get('access-control-allow-private-network'),'true');
    assert.deepEqual(await response.json(),{ok:true,engine:'sherpa-onnx',model:'streaming-zipformer-bilingual-zh-en',sampleRate:16000});
  }
});

test('real WAVs stream partials/finals with hotwords, reset and flush', {timeout:120000}, async t => {
  for (const file of ['0','1']) await t.test(`WAV ${file}`, async () => {
    const client = await socket(asr.url);
    try {
      const ready = await client.wait('ready'); assert.equal(ready.sampleRate,16000); assert.equal(ready.seq,0);
      client.send({type:'config',lang:'auto',hotwords:['Paste to Cue','语音识别','unlisted punctuation !@#$','\u{1f642}','龘']});
      const pcm = wavPcm(await readFile(`${modelDir}/test_wavs/${file}.wav`));
      // Send the first section, then reset an active utterance before it finishes.
      for (let i = 0; i < Math.min(pcm.length,64000); i+=3200) { client.ws.send(pcm.subarray(i,i+3200)); await delay(5); }
      await client.wait('partial', m => !!m.text);
      client.send({type:'reset',seq:7});
      await client.wait('reset_ack',m => m.seq===7);
      const resetIndex = client.messages.findIndex(m=>m.type==='reset_ack');
      client.send({type:'flush'}); await delay(150);
      assert.equal(client.messages.slice(resetIndex+1).some(m=>m.type==='final'&&m.text),false);
      // 100 ms Int16 chunks. Accelerated transport keeps this a short regression test.
      for (let i = 0; i < pcm.length; i+=3200) { client.ws.send(pcm.subarray(i,i+3200)); await delay(5); }
      client.send({type:'flush'});
      const final = await client.wait('final',m=>m.seq===7&&!!m.text);
      assert.ok(final.text.length>=3,JSON.stringify(client.messages));
      assert.ok(client.messages.some(m=>m.type==='partial'&&m.seq===7&&m.text));
      assert.ok(client.messages.slice(resetIndex+1).every(m=>m.seq===7));
      // A real endpoint with trailing silence emits a final without flush.
      client.send({type:'reset',seq:8}); await client.wait('reset_ack',m=>m.seq===8);
      for (let i = 0; i < pcm.length; i+=3200) client.ws.send(pcm.subarray(i,i+3200));
      for (let i=0;i<25;i++) client.ws.send(new Uint8Array(3200));
      await client.wait('final',m=>m.seq===8&&!!m.text);
    } finally { await client.close(); }
  });
});

test('real browser auto local detection, WebAudio WAV streaming, clear and dual-engine fallback', {timeout:120000}, async () => {
  page = await browser();
  await page.call('Page.addScriptToEvaluateOnNewDocument',{source:mockSpeech});
  await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__localSockets=[]; const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);__localSockets.push(this);}};`});
  await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('paste-to-cue-v4.0',JSON.stringify({ui:'zh',uiChosen:true,asrMode:'auto',asrUrl:${JSON.stringify(asr.url)}}));`});
  await page.call('Page.navigate',{url:web.url});
  await until(()=>page.eval('!!window.__cueDebug'));
  const start = await page.eval('performance.now()');
  await page.eval('__cueDebug.startVoice()');
  let state = await page.eval('__cueDebug.getState()');
  const elapsed = await page.eval(`performance.now()-${start}`);
  assert.equal(state.asrActiveEngine,'local',JSON.stringify(state)); assert.ok(elapsed<500,`Local connection ${elapsed}ms`);
  assert.equal(state.monitor.state,'已连接 · 本地极速流式'); assert.equal(state.asrMode,'auto');
  assert.ok((await page.eval('__cueDebug.extractHotwords()')).length>0);
  await page.eval('__cueDebug.setUi("en")');
  assert.equal((await page.eval('__cueDebug.getState()')).monitor.state,'Voice Sync · Local Streaming');
  await page.eval('__cueDebug.setUi("zh"); __playWav("/0.wav")');
  await until(()=>page.eval('!!(__cueDebug.getState().monitor.interim || __cueDebug.getState().monitor.final)'),20000);
  await page.eval(`document.querySelector('[data-act=clear]').click(); __localSockets.at(-1).dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'partial',seq:1,text:'unacknowledged words'})}));`);
  state=await page.eval('__cueDebug.getState()');
  assert.equal(state.monitor.final,'');assert.equal(state.monitor.interim,'');assert.equal(state.vstate,'live');assert.equal(state.wantMic,true);
  assert.equal(state.utterSeq,1);assert.equal(state.meterRunning,true);
  await until(()=>page.eval('!__cueDebug.getState().awaitingReset'));
  await page.eval(`__localSockets.at(-1).dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'partial',seq:0,text:'stale pre-clear words'})}));`);
  assert.equal(await page.eval('__cueDebug.getState().monitor.interim.includes("stale pre-clear words")'),false);
  await page.eval('__playWav("/1.wav")');
  await until(()=>page.eval('!!(__cueDebug.getState().monitor.interim || __cueDebug.getState().monitor.final)'),20000);
  // Stop only this test's child. The active take must remain live on Browser Speech.
  const stoppedAt=Date.now(); await asr.close();
  await until(()=>page.eval('__cueDebug.getState().asrActiveEngine === "browser"'),2000);
  assert.ok(Date.now()-stoppedAt<1000);
  state=await page.eval('__cueDebug.getState()');assert.equal(state.wantMic,true);assert.equal(state.vstate,'live');assert.equal(state.meterRunning,true);
  await page.eval('__recognizers.at(-1).emit([["fallback live words",false]])');
  assert.ok((await page.eval('__cueDebug.getState()')).monitor.interim.includes('fallback live words'));
  await page.eval('__cueDebug.stopMic()');
  const offline=await page.eval('(async()=>{const start=performance.now();await __cueDebug.startVoice();return {elapsed:performance.now()-start,state:__cueDebug.getState()};})()');
  assert.equal(offline.state.asrActiveEngine,'browser');assert.equal(offline.state.vstate,'live');assert.ok(offline.elapsed<500,JSON.stringify(offline));
  // Settings and compact monitor selectors persist and switch through normal UI events.
  await page.eval('document.querySelector("#vmEngine").value="local"; document.querySelector("#vmEngine").dispatchEvent(new Event("change"))');
  await until(()=>page.eval('__cueDebug.getState().vstate === "errNet"'));
  state=await page.eval('__cueDebug.getState()');assert.ok(state.monitor.hint.includes('start.ps1'));assert.equal(state.asrMode,'local');
  await page.eval('document.querySelector("#asrMode").value="browser";document.querySelector("#asrMode").dispatchEvent(new Event("change"));__cueDebug.startVoice()');
  assert.equal((await page.eval('__cueDebug.getState()')).asrActiveEngine,'browser');
  assert.equal(await page.eval('JSON.parse(localStorage.getItem("paste-to-cue-v4.0")).asrMode'),'browser');
  await page.eval('__cueDebug.stopMic()');
  assert.deepEqual(page.errors,[]);
});
