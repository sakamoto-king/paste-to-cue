import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { browser, mockSpeech, until } from './cdp.mjs';
import { staticServer, unreadyServer } from './support.mjs';

let page, server;
before(async () => {
  server = await staticServer();
  page = await browser();
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: mockSpeech });
});
after(async () => { try { await page?.close(); } finally { await server?.close(); } });

async function load(saved = {}, key = 'paste-to-cue-v4.0') {
  const id = crypto.randomUUID();
  const script = await page.call('Page.addScriptToEvaluateOnNewDocument', {source:
    `localStorage.clear();localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify({ui:'zh',uiChosen:true,...saved}))});window.__loadId=${JSON.stringify(id)};`});
  try {
    await page.call('Page.navigate', { url: server.url + '/?load=' + id });
    await until(() => page.eval(`window.__loadId === ${JSON.stringify(id)} && !!window.__cueDebug && document.readyState === 'complete'`));
  } finally { await page.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier}); }
  await page.eval("document.querySelector('#hEditor').click()");
  return page.eval('__cueDebug.getState()');
}

test('fresh defaults, synchronized bilingual copy, static single file and icons', async () => {
  const state = await load();
  assert.equal(state.eyeLine, 40); assert.equal(state.extraBelowLines, 3); assert.equal(state.extraAboveLines,2);
  assert.equal(await page.eval('getComputedStyle(document.documentElement).getPropertyValue("--eye").trim()'), '40%');
  assert.equal(await page.eval('document.querySelector("#eyeLineVal").textContent'), '40%');
  assert.equal(await page.eval('document.querySelector("[data-i18n=s3t]").textContent'), '盯住五分之二视线');
  await page.eval('__cueDebug.setUi("en")');
  assert.equal(await page.eval('document.querySelector("[data-i18n=s3t]").textContent'), 'Eyes on the 2/5 eyeline');
  assert.equal(await page.eval('[...document.querySelectorAll("svg")].every(el => el.getAttribute("stroke-width") === "1.5")'), true);
  assert.equal(await page.eval('document.querySelectorAll("script[src]").length'), 0);
  const source = await readFile('index.html', 'utf8');
  assert.doesNotMatch(source, /\p{Extended_Pictographic}/u);
  assert.equal(await page.eval(`__cueDebug.isStockDoc(__EXAMPLE_HTML__) && __cueDebug.isStockDoc(__EXAMPLE_HTML__.replace('屏幕五分之二处的黄金视线','屏幕上方的黄金视线')) && __cueDebug.isStockDoc(__EXAMPLE_EN_HTML__) && __cueDebug.isStockDoc(__EXAMPLE_EN_HTML__.replace('the 2/5 golden eyeline','the golden eyeline near the top'))`),true);
});

test('all five storage generations migrate defaults and preserve custom/manual values', async t => {
  for (const key of ['paste-to-cue-v4.0', 'paste-to-cue-v3.3', 'paste-to-cue-v3.2', 'paste-to-cue-v3', 'paste-to-cue-v2']) {
    for (const eye of [23, 34, 30, 48]) {
      await t.test(`${key} eye ${eye}`, async () => {
        const state = await load({ eyeLine: eye, fwdWin: 40 }, key);
        assert.equal(state.eyeLine, [23, 34].includes(eye) ? 40 : eye);
        assert.equal(state.extraBelowLines, 3);
      });
    }
    await t.test(`${key} manual markers`, async () => {
      const state = await load({ eyeLine: 23, eyeLineVer: 2, fwdWin: 40, fwdWinVer: 2 }, key);
      assert.equal(state.eyeLine, 23); assert.equal(state.extraBelowLines, 3);
    });
  }
});

test('guide drag clamps at 15 and 55 and saves manual markers', async () => {
  await load({asrMode:'browser'});
  await page.eval('__cueDebug.loadExample(); __cueDebug.startVoice()');
  await page.eval('__cueDebug.stopMic()');
  const rect = await page.eval('(() => {const r=document.querySelector("#guideHandle").getBoundingClientRect(); const s=document.querySelector("#stage").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,top:s.top,bottom:s.bottom};})()');
  await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.top + 1, button: 'left', buttons: 1 });
  assert.equal((await page.eval('__cueDebug.getState()')).eyeLine, 15);
  await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.bottom - 1, button: 'left', buttons: 1 });
  await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.bottom - 1, button: 'left' });
  assert.equal((await page.eval('__cueDebug.getState()')).eyeLine, 55);
  assert.equal(await page.eval('JSON.parse(localStorage.getItem("paste-to-cue-v4.0")).eyeLineVer'), 2);
});

const speechA = '字号还支持4号还支持从50%字号还支持4号还支持';
const speechB = '需要手动快进需要手动快进之后还支持从50%一直放大到500就算把浏览器缩成窄窄的一条之后还支持从50%之后还支持';
const historical = '盯住屏幕上方的黄金视线，需要手动快进或者倒回去重录一句，鼠标移到右边触控条轻轻一滑就能随时接管。';
test('exact real speech A/B jump from row 07 to 08 with current and historical wording', async t => {
  await load();
  for (const old of [false, true]) for (const [name, speech] of [['A',speechA],['B',speechB]]) {
    await t.test(`${old ? 'historical' : 'updated'} ${name}`, async () => {
      const state = await page.eval(`(() => {
        let html=window.__EXAMPLE_HTML__;
        if (${old}) html=html.replace('屏幕五分之二处的黄金视线','屏幕上方的黄金视线');
        __cueDebug.loadHtml(html);
        const rows=[...document.querySelectorAll('#content tr')];
        const row=rows.find(r=>r.cells[0]?.textContent.trim()==='07');
        if (${old}) row.cells[1].textContent=${JSON.stringify(historical)};
        __cueDebug.loadHtml(document.querySelector('#content').innerHTML);
        const tr=[...document.querySelectorAll('#content tr')].find(r=>r.cells[0]?.textContent.trim()==='07');
        __cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id="'+tr.dataset.cueId+'"] td:nth-child(2)'));
        __cueDebug.clearTranscript();
        const before=__cueDebug.getState().anchorIdx;
        const hit=__cueDebug.match(${JSON.stringify(speech)});
        const state=__cueDebug.feedTranscript(${JSON.stringify(speech)});
        return {state,hit,before,label:__cueDebug.anchorRowLabel(),dedup:__cueDebug.dedup(${JSON.stringify(speech)})};
      })()`);
      assert.ok(state.hit, JSON.stringify(state));
      assert.equal(state.label, '08', JSON.stringify(state));
      assert.ok(state.state.anchorIdx > state.before);
    });
  }
});

test('Chinese numbers and percent prefixes align bidirectionally with valid DOM spans', async t => {
  await load();
  for (const [number, spoken] of [['50%','百分之五十'],['500%','百分之五百'],['500%','500'],['60','六十'],['40','四十'],['100','一百'],['12.5%','百分之十二点五']]) {
    for (const [script, heard] of [[number,spoken],[spoken,number]]) await t.test(`${script} / ${heard}`, async () => {
      const state = await page.eval(`(() => {
        __cueDebug.loadHtml('<p data-cue-id="n">字号支持从${script}一直放大就能接管</p>');
        __cueDebug.setAnchor(0); __cueDebug.clearTranscript();
        return {hit:__cueDebug.match('字号支持从${heard}一直放大'), normalized:__cueDebug.normalized('${heard}'), snippet:__cueDebug.rowInfo(__cueDebug.tokenIndexOf('[data-cue-id=n]',-1)).snippet};
      })()`);
      assert.ok(state.hit, JSON.stringify(state)); assert.ok(state.hit.ratio >= 0.8, JSON.stringify(state));
      if (number === '500%') assert.ok(!state.snippet.includes('500%500%'), state.snippet);
    });
  }
  assert.deepEqual(await page.eval('__cueDebug.normalized("01 09 0 9")'), ['01','09','0','9']);
  for (const [n,word] of [[0,'零'],[10,'十'],[40,'四十'],[50,'五十'],[60,'六十'],[100,'一百'],[500,'五百'],[10001,'一万零一'],[10010,'一万零一十'],[99999,'九万九千九百九十九']])
    assert.equal(await page.eval(`__cueDebug.chineseNumber(${n})`), word);
  assert.deepEqual(await page.eval('__cueDebug.normalized("50% 500% 60 40 100")'), [...'百分之五十百分之五百六十四十一百']);
  assert.deepEqual(await page.eval('__cueDebug.normalized("50％")'), [...'百分之五十']);
});

test('jump to a table spoken cell within the real viewport is included', async () => {
  await load({fwdWin:30});
  const result = await page.eval(`(() => {
    __cueDebug.loadHtml('<table><tr><td><p>01</p></td><td><p>'+ '开始朗读前面的句子'.repeat(25) +'</p></td><td><p>摄影备注</p></td></tr><tr><td><p>02</p></td><td><p>下一段字号还支持从百分之五十一直放大</p></td><td><p>摄影备注</p></td></tr></table>');
    __cueDebug.setAnchor(0); return {hit:__cueDebug.match('下一段字号还支持从50%'),idx:__cueDebug.tokenIndexOf('tr:nth-child(2) td:nth-child(2)')};
  })()`);
  assert.ok(result.hit); assert.ok(result.hit.idx >= result.idx);
});

test('English skip ahead from 06 to 08 and 09, random speech stays put', async () => {
  await load();
  for (const [seg, text] of [['08','Zoom from fifty percent all the way'],['09','No signup your script lives only in this browser']]) {
    const result = await page.eval(`(() => {__cueDebug.loadExampleEn(); __cueDebug.clearTranscript(); __cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id="seg-06"]')); __cueDebug.feedTranscript(${JSON.stringify(text)});return __cueDebug.anchorRowLabel();})()`);
    assert.equal(result, seg);
  }
  const result = await page.eval(`(() => {__cueDebug.loadExample();__cueDebug.clearTranscript();__cueDebug.setAnchor(0);const a=__cueDebug.getState(); const hit=__cueDebug.match('喂喂听得到吗今天天气不错');const b=__cueDebug.feedTranscript('喂喂听得到吗今天天气不错');return {a,b,hit};})()`);
  assert.equal(result.hit,null); assert.equal(result.b.anchorIdx,result.a.anchorIdx); assert.equal(result.b.missCount,result.a.missCount+1);
});

test('clear replaces browser recognition, rejects stale epoch callbacks and preserves meter/live', async () => {
  await load({asrMode:'browser'});
  await page.eval('__cueDebug.startVoice()');
  await page.eval(`(() => {const rec=__recognizers.at(-1);window.__oldResult=rec.onresult;window.__oldRec=rec;rec.emit([['before final',true],['before interim',false]]);})()`);
  const before = await page.eval('__cueDebug.getState()');
  await page.eval('document.querySelector("[data-act=clear]").click()');
  let result = await page.eval('__cueDebug.getState()');
  assert.equal(result.wantMic,true); assert.equal(result.vstate,'live'); assert.equal(result.meterRunning,true);
  assert.ok(result.recEpoch > before.recEpoch);
  assert.equal(result.monitor.final,''); assert.equal(result.monitor.interim,'');
  await page.eval(`(() => {
    const old=[{transcript:'before buffered'}];old.isFinal=true;
    __oldResult({resultIndex:0,results:[old]});
    __recognizers.at(-1).emit([['new final',true],['new interim',false]]);
  })()`);
  result = await page.eval('__cueDebug.getState()');
  assert.equal(result.monitor.final,'new final'); assert.equal(result.monitor.interim,'　new interim');
  assert.equal(await page.eval('__oldRec.aborted'),true);
  await page.eval('__cueDebug.feedTranscript("完整行字幕排版测试".repeat(150))');
  const box = await page.eval('(() => {const e=document.querySelector("#vmText");const c=getComputedStyle(e);return {top:e.scrollTop,height:e.clientHeight,scroll:e.scrollHeight,overflow:c.overflowY,line:c.lineHeight,padding:c.paddingTop};})()');
  assert.equal(box.overflow,'auto'); assert.equal(box.line,'18px'); assert.equal(box.padding,'7px');
  assert.ok(box.scroll > box.height); assert.ok(box.top + box.height >= box.scroll - 2,JSON.stringify(box));
  await page.eval('__cueDebug.stopMic()');
  assert.deepEqual(page.errors,[]);
});

test('auto ready timeout falls back at 350 ms without an error flash', async () => {
  const unready=await unreadyServer();
  try {
    await load({asrMode:'auto',asrUrl:unready.url});
    const result=await page.eval(`(async()=>{
      const states=[];const observer=new MutationObserver(()=>states.push(document.querySelector('#vmon').dataset.state));
      observer.observe(document.querySelector('#vmon'),{attributes:true,attributeFilter:['data-state']});
      const start=performance.now();await __cueDebug.startVoice();const elapsed=performance.now()-start;
      observer.disconnect();return {states,elapsed,state:__cueDebug.getState()};
    })()`);
    assert.equal(result.state.asrActiveEngine,'browser');assert.equal(result.state.vstate,'live');
    assert.ok(result.elapsed>=340&&result.elapsed<500,JSON.stringify(result));
    assert.ok(!result.states.some(s=>s.startsWith('err')),JSON.stringify(result));
  } finally {await page.eval('__cueDebug.stopMic()');await unready.close();}
});
