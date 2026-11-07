import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { browser, mockSpeech, until, delay } from './cdp.mjs';
import { staticServer, localServer } from './support.mjs';

let page, web, asr;
before(async () => {
  web = await staticServer(); page = await browser();
  await page.call('Page.addScriptToEvaluateOnNewDocument', {source:mockSpeech});
  await page.call('Page.addScriptToEvaluateOnNewDocument', {source:`window.__sockets=[];const Native=WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);__sockets.push(this);}};`});
});
after(async () => { try { await page?.close(); } finally { try { await web?.close(); } finally { await asr?.close(); } } });

async function load(saved = {}) {
  const id = crypto.randomUUID();
  const script = await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('paste-to-cue-v4.0',${JSON.stringify(JSON.stringify({ui:'zh',uiChosen:true,asrMode:'browser',...saved}))});window.__id=${JSON.stringify(id)};`});
  try {
    await page.call('Page.navigate',{url:web.url+'/?id='+id});
    await until(()=>page.eval(`window.__id===${JSON.stringify(id)} && !!window.__cueDebug && document.readyState==='complete'`));
  } finally { await page.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier}); }
  return state();
}
const state = () => page.eval('__cueDebug.getState()');
async function script(html, selector, nth) {
  return page.eval(`(()=>{if(__cueDebug.getState().mode==='home')document.querySelector('#hEditor').click();__cueDebug.loadHtml(${JSON.stringify(html)});__cueDebug.clearTranscript();__cueDebug.setAnchor(__cueDebug.tokenIndexOf(${JSON.stringify(selector)},${JSON.stringify(nth)}));return __cueDebug.getState();})()`);
}
async function emit(slots, index=0) { return page.eval(`__recognizers.at(-1).emit(${JSON.stringify(slots)},${index});__cueDebug.getState()`); }
async function closeConflict() { await page.eval(`if(document.querySelector('#commandConflict').open) document.querySelector('#conflictOk').click()`); }
const paragraphsZh = ['清晨的阳光洒在窗前我慢慢打开笔记本','沿着安静的小路我看见远处的山峰','午后的微风吹过树林带来了花的香气','傍晚我坐在河边记录今天发生的故事','夜色渐浓的时候我们终于回到了家里'];
const paragraphsEn = ['I open my notebook beside the window to record a beautiful quiet morning','Along the quiet path I can see mountains rising beyond the distant river','The afternoon breeze moves through the trees and brings a gentle floral scent','At sunset we sit beside the water and write about our memorable journey','We finally arrive home after darkness covers the village and all the fields'];
const doc = rows => rows.map((t,i)=>`<p data-cue-id="p${i}">${t}</p>`).join('');

test('v1.2 line defaults, all legacy count migration and deliberate new line values', async t => {
  const initial=await load();assert.equal(initial.extraAboveLines,2);assert.equal(initial.extraBelowLines,3);
  const ranges=await page.eval(`['extraAboveLines','extraBelowLines'].map(id=>{const e=document.getElementById(id);return [e.min,e.max,e.value]})`);
  assert.deepEqual(ranges,[['0','10','2'],['0','10','3']]);
  for(const saved of [{backWin:8,fwdWin:90},{backWin:40,fwdWin:40},{backWin:20,fwdWin:120},{backWin:18,fwdWin:90,fwdWinVer:2},{backWin:8,backWinVer:2,fwdWin:30},{backWin:200,fwdWin:10}])await t.test(JSON.stringify(saved),async()=>{
    const result=await load(saved);assert.deepEqual([result.extraAboveLines,result.extraBelowLines],[2,3]);
    const cache=await page.eval('JSON.parse(localStorage.getItem("paste-to-cue-v4.0"))');assert.equal('backWin' in cache,false);assert.equal('fwdWin' in cache,false);
    await page.eval(`document.querySelector('#extraAboveLines').value=0;document.querySelector('#extraAboveLines').dispatchEvent(new Event('input'))`);
    assert.equal((await state()).extraBelowLines,3);
    await page.eval('window.__cueDebug=null');await page.call('Page.reload');await until(()=>page.eval('!!window.__cueDebug'));
    assert.equal((await state()).extraAboveLines,0);assert.equal((await state()).extraBelowLines,3);
  });
});

test('Chinese and English reread previous one and two paragraphs within each configured window', async t => {
  for (const [lang,rows] of [['zh',paragraphsZh],['en',paragraphsEn]]) for (const delta of [1,2]) await t.test(`${lang} ${delta}`,async()=>{
    await load();const before=await script(doc(rows),'[data-cue-id=p3]',5);
    const heard=rows[3-delta];
    const result=await page.eval(`({hit:__cueDebug.match(${JSON.stringify(heard)}),s:__cueDebug.feedTranscript(${JSON.stringify(heard)})})`);
    assert.ok(result.hit,JSON.stringify(result)); assert.ok(result.s.anchorIdx<before.anchorIdx-2,JSON.stringify(result));
    const bounds=await page.eval(`[__cueDebug.tokenIndexOf('[data-cue-id=p${3-delta}]'),__cueDebug.tokenIndexOf('[data-cue-id=p${3-delta}]',-1)]`);
    assert.ok(result.s.anchorIdx>=bounds[0]&&result.s.anchorIdx<=bounds[1],JSON.stringify(result));
  });
});

test('actual animation rewinds smoothly and settles around the 40 percent eyeline', async () => {
  await load({backWin:200});
  const rows=Array.from({length:25},(_,i)=>paragraphsZh[i%5]);
  await script(doc(rows),'[data-cue-id=p18]');
  await page.eval('__cueDebug.startVoice()');
  await delay(150);
  const before=await page.eval(`__cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id=p18]'))`);
  const samples=await page.eval(`(async()=>{
    __recognizers.at(-1).emit([[${JSON.stringify(paragraphsZh[1])},false]]);
    const points=[__cueDebug.getState().scrollTop];
    for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,16));points.push(__cueDebug.getState().scrollTop);}
    return {points,state:__cueDebug.getState(),offset:__cueDebug.eyeOffset()};
  })()`);
  assert.equal(samples.points[0],before.scrollTop);
  assert.ok(samples.state.anchorIdx<before.anchorIdx,JSON.stringify(samples.state));
  assert.ok(samples.points.at(-1)<before.scrollTop-20,JSON.stringify(samples));
  assert.ok(new Set(samples.points.map(Math.round)).size>8);
  assert.ok(samples.points.every((v,i)=>!i||v<=samples.points[i-1]+1),JSON.stringify(samples.points));
  assert.ok(Math.abs(samples.offset)<85,JSON.stringify(samples));
  await page.eval('__cueDebug.stopMic()');
});

test('short repeated phrases, random speech, and old final tails cannot cause false rewind', async () => {
  await load();
  const before=await script('<p>我已经准备好了然后继续往下说</p><p>这里的内容完全不同现在开始讲话</p>','p:nth-child(2)',-1);
  for(const text of ['准备好了','准备好了准备好了','早上好早上好','喂喂听见没有']){
    const next=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(text)})`);
    assert.equal(next.anchorIdx,before.anchorIdx,text);
  }
  for(const [html,heard] of [
    ['<p>准备好了准备好了准备好了</p><p>这是新的一段我继续往后说</p>','准备好了准备好了'],
    ['<p>we are ready we are ready we are ready</p><p>This is another completely different line of speech</p>','we are ready we are ready we are ready'],
  ]) {
    const start=await script(html,'p:last-child',5);
    assert.equal((await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(heard)})`)).anchorIdx,start.anchorIdx);
  }
  await script(doc(paragraphsZh),'[data-cue-id=p1]');
  await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(paragraphsZh[0])},true);__cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id=p2]'))`);
  const prior=(await state()).anchorIdx;
  assert.equal((await page.eval(`__cueDebug.feedTranscript('嗯')`)).anchorIdx,prior);
});

test('standalone default commands work in Chinese and English and strip both buffers',async t=>{
  for(const [ui,commands] of [['zh',['上一页','下一页','回到顶部']],['en',['previous page','next page','back to top']]]){
    for(const [i,text] of commands.entries())await t.test(`${ui} ${text}`,async()=>{
      await load({ui});const before=await script(doc(Array.from({length:40},(_,i)=>paragraphsZh[i%5])),'[data-cue-id=p20]');
      await page.eval('__cueDebug.startVoice()');
      const partial=await emit([[text,false]]);
      assert.equal(partial.commandCount,0);assert.equal(partial.monitor.interim,'');
      const final=await emit([[text,true]]);
      assert.equal(final.commandCount,1);assert.equal(final.monitor.final,'');assert.equal(final.monitor.interim,'');
      assert.ok(i===1?final.anchorIdx>before.anchorIdx:final.anchorIdx<before.anchorIdx,JSON.stringify(final));
      if(i===2)assert.equal(final.anchorIdx,0);
      assert.equal(await page.eval('document.querySelector("#toast").textContent'),ui==='zh'?`语音命令：${text}`:`Voice command: ${text[0].toUpperCase()+text.slice(1)}`);
      await emit([[text,true]]); await emit([[text+' stale revision',false]]);
      assert.equal((await state()).commandCount,1);assert.equal((await state()).monitor.interim,'');
      await page.eval('__cueDebug.stopMic()');
    });
  }
});

test('incidental substrings, word suffixes and revised interim sentences stay ordinary speech',async()=>{
  await load();await script(doc(paragraphsEn),'p:nth-child(2)');await page.eval('__cueDebug.startVoice()');
  for(const [i,text] of ['please go to the next page now','next pages','next pager','我提到下一页这个词'].entries())await emit([[text,true]],i?0:0), await page.eval('__cueDebug.clearTranscript()');
  await emit([['next page',false]]);assert.equal((await state()).commandCount,0);
  await emit([['next page is a phrase in my sentence',true]]);
  const result=await state();assert.equal(result.commandCount,0);assert.ok(result.monitor.final.includes('is a phrase'));
  await page.eval('__cueDebug.stopMic()');
});

test('script-local conflicts block commands backwards and forwards; outside windows triggers',async t=>{
  for(const [ui,phrase] of [['zh','下一页'],['en','next page']])for(const direction of [-1,1])await t.test(`${ui} ${direction}`,async()=>{
    await load({ui,backWin:40,fwdWin:40});
    const rows=ui==='zh'?['开场白之后我会说'+phrase,'这里是我当前阅读的句子','继续朗读故事到了'+phrase]:['I will now say '+phrase,'Here I am reading my current sentence','The story continues with '+phrase];
    const html=direction<0?doc(rows.slice(0,2)):doc(rows.slice(1));
    const before=await script(html,direction<0?'p:nth-child(2)':'p:first-child');
    await page.eval('__cueDebug.startVoice()');await emit([[phrase,true]]);
    assert.equal((await state()).commandCount,0);assert.ok((await state()).monitor.final.includes(phrase));
    await page.eval('__cueDebug.clearTranscript()');
    const spaced=direction<0?`<p>${phrase}</p><p>${'padding '.repeat(900)}</p><p>Current spoken words are here</p>`:`<p>Current spoken words are here</p><p>${'padding '.repeat(900)}</p><p>${phrase}</p>`;
    await script(spaced,direction<0?'p:last-child':'p:first-child');
    await emit([[phrase,true]]);assert.equal((await state()).commandCount,1);
    await page.eval('__cueDebug.stopMic()');
  });
});

test('English command recognition uses whole words in script',async()=>{
  await load();await script('<p>next pages are different words</p><p>current words here</p>','p:last-child');
  await page.eval('__cueDebug.startVoice()');await emit([['next page',true]]);assert.equal((await state()).commandCount,1);
  await page.eval('__cueDebug.stopMic()');
});

test('command configuration supports text/action edit, add, delete, sanitization and persistence',async()=>{
  await load({ui:'en'});
  await page.eval(`document.querySelector('.btnSet').click();const row=document.querySelector('.command-row');row.querySelector('input').value='<b>please rewind</b>';row.querySelector('input').dispatchEvent(new Event('change'));row.querySelector('select').value='top';row.querySelector('select').dispatchEvent(new Event('change'));document.querySelector('#addCommand').click();`);
  let s=await state();assert.equal(s.commands[0].text,'please rewind');assert.equal(s.commands[0].action,'top');assert.equal(s.commands.length,7);
  await page.eval(`document.querySelector('.command-row:last-child button').click()`);
  assert.equal((await state()).commands.length,6);
  await page.eval(`const input=document.querySelectorAll('.command-row input')[1];input.value='please rewind';input.dispatchEvent(new Event('change'))`);
  assert.equal((await state()).commands[1].text,'下一页');assert.match(await page.eval('document.querySelector("#commandError").textContent'),/duplicates/);
  await page.call('Page.reload');await until(()=>page.eval('!!window.__cueDebug'));
  assert.equal((await state()).commands[0].text,'please rewind');assert.equal((await state()).commands[0].action,'top');
  await script(doc(paragraphsEn),'p:nth-child(4)');await page.eval('__cueDebug.startVoice()');await emit([['please rewind',true]]);
  assert.equal((await state()).anchorIdx,0);assert.equal((await state()).commandCount,1);
  await page.eval(`__cueDebug.stopMic();document.querySelector('.command-row button').click();__cueDebug.clearTranscript();__cueDebug.startVoice()`);
  await emit([['please rewind',true]]);assert.equal((await state()).commandCount,1);assert.equal((await state()).monitor.final,'please rewind');
  await page.eval('__cueDebug.stopMic()');
  await load({commands:[{text:'do harm',action:'eval'},{text:'<b>safe phrase</b>',action:'top'},null]});
  assert.deepEqual((await state()).commands,[{text:'safe phrase',action:'top'}]);
});

test('paragraph action whitelist navigates without evaluating settings',async()=>{
  await load({commands:[{text:'go earlier',action:'previousParagraph'},{text:'go later',action:'nextParagraph'}]});
  const before=await script(doc(paragraphsEn),'p:nth-child(3)');await page.eval('__cueDebug.startVoice()');
  await emit([['go earlier',true]]);const prior=(await state()).anchorIdx;assert.ok(prior<before.anchorIdx);
  await emit([['go earlier',true],['go later',true]],1);assert.equal((await state()).anchorIdx,before.anchorIdx);
  await page.eval('__cueDebug.stopMic()');
});

test('command endpoint retransmits, stale final revisions, cooldown and clear epoch are safe',async()=>{
  await load();await script(doc(Array.from({length:25},()=>paragraphsEn[0])),'p:nth-child(12)');await page.eval('__cueDebug.startVoice()');
  await emit([['ordinary prior speech',true],['next',false]]);
  assert.equal((await state()).monitor.interim,'');
  await emit([['ordinary prior speech',true],['next page',false]],1);
  const s=await emit([['ordinary prior speech',true],['next page',true]],1);assert.equal(s.commandCount,1);assert.equal(s.monitor.final,'ordinary prior speech');
  await emit([['ordinary prior speech',true],['next page stale words',true]],1);
  await emit([['ordinary prior speech',true],['next page',true],['next page',true]],2);
  assert.equal((await state()).commandCount,1);assert.equal((await state()).monitor.final,'ordinary prior speech');
  await delay(1550);await emit([['ordinary prior speech',true],['next page',true],['next page',true],['next page',true]],3);assert.equal((await state()).commandCount,2);
  await page.eval(`window.__stale=__recognizers.at(-1).onresult;__cueDebug.clearTranscript();const r=[{transcript:'back to top'}];r.isFinal=true;__stale({resultIndex:0,results:[r]});`);
  assert.equal((await state()).commandCount,2);assert.equal((await state()).monitor.final,'');
  await page.eval('__cueDebug.stopMic()');
});

test('browser automatic restart uses a new epoch and accepts fresh result indices',async()=>{
  await load();await script(doc(paragraphsEn),'p:nth-child(3)');await page.eval('__cueDebug.startVoice()');
  await emit([['ordinary final speech',true]]);
  const before=await state();
  await page.eval(`window.__oldHandler=__recognizers.at(-1).onresult;__recognizers.at(-1).onend()`);
  await until(async()=> (await state()).recEpoch>before.recEpoch);
  await emit([['fresh session speech',true]]);assert.ok((await state()).monitor.final.includes('fresh session speech'));
  await page.eval(`const r=[{transcript:'back to top'}];r.isFinal=true;__oldHandler({resultIndex:0,results:[r]})`);
  assert.equal((await state()).commandCount,0);await page.eval('__cueDebug.stopMic()');
});

test('latest batch command wins over an earlier script final in the same browser event',async()=>{
  await load();await script(doc(Array.from({length:25},()=>paragraphsEn[0])),'p:nth-child(12)');await page.eval('__cueDebug.startVoice()');
  const result=await emit([[paragraphsEn[0],true],['back to top',true]]);
  assert.equal(result.commandCount,1);assert.equal(result.anchorIdx,0);
  assert.equal(result.monitor.final,paragraphsEn[0]);assert.equal(result.monitor.interim,'');
  await page.eval('__cueDebug.stopMic()');
});

async function paste(root,html,plain='') {
  await page.eval(`(()=>{const root=document.querySelector(${JSON.stringify(root)});root.focus();const r=document.createRange();r.selectNodeContents(root);const s=getSelection();s.removeAllRanges();s.addRange(r);const data=new DataTransfer();data.setData('text/html',${JSON.stringify(html)});data.setData('text/plain',${JSON.stringify(plain)});root.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));})()`);
}
test('actual home paste, import and editor paste scan conflicts, map table spoken cells, sanitize raw input',async()=>{
  await load();
  const html='<h2>文稿标题</h2><p>这是第一段下一页</p><table><thead><tr><th>编号</th><th>口播文案</th><th>备注</th></tr></thead><tbody><tr><td>01</td><td><p>我会说上一页</p><p>接着说回到顶部</p></td><td>下一页只在备注</td></tr></tbody></table><p onclick="window.__bad=1">第三段下一页<img src=x onerror="window.__bad=2"><script>window.__bad=3</script></p>';
  await paste('#homeInput',html);
  await until(()=>page.eval('document.querySelector("#commandConflict").open'));
  let items=await page.eval('[...document.querySelectorAll("#conflictList li")].map(x=>x.textContent)');
  assert.ok(items.includes('「下一页」：第 1, 3 段'),JSON.stringify(items));assert.ok(items.includes('「上一页」：第 2 段'));assert.ok(items.includes('「回到顶部」：第 2 段'));
  assert.equal(await page.eval('!!window.__bad'),false);assert.equal(await page.eval('document.querySelectorAll("#homeInput [onclick],#homeInput img,#homeInput script").length'),0);
  await closeConflict();await page.eval('document.querySelector("#hImport").click()');await delay(180);
  assert.equal((await state()).mode,'cue');assert.equal(await page.eval('document.querySelector("#commandConflict").open'),false);
  await page.eval(`document.querySelector('#btnBack').click()`);
  await paste('#content','<p>替换稿文上一页</p><p>另一段回到顶部</p>');
  await delay(500);
  assert.equal(await page.eval('document.querySelector("#commandConflict").open'),true,await page.eval('document.querySelector("#content").innerHTML'));
  items=await page.eval('[...document.querySelectorAll("#conflictList li")].map(x=>x.textContent)');assert.ok(items.includes('「上一页」：第 1 段'),JSON.stringify(items));
  await page.eval('document.querySelector("#editCommands").click()');
  assert.equal(await page.eval('document.querySelector("#pop").classList.contains("show")'),true);
  assert.equal(await page.eval('document.activeElement.getAttribute("aria-label")'),'命令文本 1');
  await page.eval('document.querySelector("#content").dispatchEvent(new Event("input"))');await delay(400);
  assert.equal(await page.eval('document.querySelector("#commandConflict").open'),false);
});

test('English import conflict UI, whole word document scan, dialog buttons and theme visibility',async t=>{
  for(const theme of ['paper','studio'])await t.test(theme,async()=>{
    await load({ui:'en',theme});
    await paste('#homeInput','<p>next pages and previous pager do not count</p><p>Next page is mentioned here</p><p>I go back to top in this passage</p>');
    // Import before the paste debounce fires: the loaded document is the scan target.
    await page.eval('document.querySelector("#hEditor").click()');
    await until(()=>page.eval('document.querySelector("#commandConflict").open'));
    const text=await page.eval('document.querySelector("#commandConflict").textContent');
    assert.match(text,/These commands will not trigger near these passages/);assert.match(text,/“next page”: paragraphs 2/);assert.match(text,/“back to top”: paragraphs 3/);assert.doesNotMatch(text,/“previous page”:/);
    assert.equal(await page.eval('document.querySelector("#commandConflict").getAttribute("aria-describedby")'),'conflictHelp');
    await page.eval('document.querySelector("#conflictOk").click();document.querySelector("#btnSample").click()');
    await until(()=>page.eval('document.querySelector("#commandConflict").open'));
    assert.match(await page.eval('document.querySelector("#conflictList").textContent'),/next page/);
    await page.eval('document.querySelector("#editCommands").click()');
    const ui=await page.eval(`(()=>{const p=document.querySelector('#pop'),r=document.querySelector('.command-row input'),c=getComputedStyle(r);return {title:p.querySelector('h4').textContent,fg:c.color,bg:c.backgroundColor,rows:document.querySelectorAll('.command-row').length,visible:r.getBoundingClientRect().width>40};})()`);
    assert.equal(ui.title,'Voice commands');assert.equal(ui.rows,6);assert.ok(ui.visible);assert.notEqual(ui.fg,ui.bg);
  });
});

test('each real import button scans a new script without waiting for a paste event',async t=>{
  for(const [button,mode] of [['hImport','cue'],['hEditor','setup'],['hFormat','cue']])await t.test(button,async()=>{
    await load({ui:'en'});
    // CDP insertText uses the browser editing path, rather than calling loadHtml.
    await page.eval('document.querySelector("#homeInput").focus()');
    await page.call('Input.insertText',{text:'This passage mentions next page so I can explain the rule.'});
    await page.eval(`document.querySelector('#${button}').click()`);
    await until(()=>page.eval('document.querySelector("#commandConflict").open'));
    assert.equal((await state()).mode,mode);assert.match(await page.eval('document.querySelector("#conflictList").textContent'),/“next page”: paragraphs 1/);
    await closeConflict();
  });
});

test('mixed Chinese and English text still reports Chinese phrases next to Latin words',async()=>{
  await load();await paste('#homeInput','<p>我在example下一页demo这一段解释命令</p>');
  await until(()=>page.eval('document.querySelector("#commandConflict").open'));
  assert.match(await page.eval('document.querySelector("#conflictList").textContent'),/「下一页」：第 1 段/);
  await closeConflict();
  await paste('#homeInput','<p>换了一份稿文仍然提到下一页</p>');
  await until(()=>page.eval('document.querySelector("#commandConflict").open'));
  assert.match(await page.eval('document.querySelector("#conflictList").textContent'),/「下一页」：第 1 段/);
  await closeConflict();
});

test('small-screen command controls fit both themes with localized labels',async t=>{
  for(const [ui,theme] of [['zh','paper'],['en','studio']])await t.test(`${ui} ${theme}`,async()=>{
    await load({ui,theme});
    await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await page.eval('document.querySelector(".btnSet").click()');
    const result=await page.eval(`(()=>{const p=document.querySelector('#pop'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,width:p.clientWidth,scroll:p.scrollWidth,labels:[...document.querySelectorAll('.command-row input,.command-row select')].map(e=>e.getAttribute('aria-label')),note:document.querySelector('[data-i18n=windowHelp]').textContent};})()`);
    assert.ok(result.left>=0&&result.right<=390,JSON.stringify(result));assert.equal(result.width,result.scroll);
    assert.ok(result.labels.every(Boolean));assert.match(result.note,/0–10/);
    await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  });
});

test('tutorial keeps row 07/08 anchors, is first person, contains conflict-safe commands and sample CTA',async()=>{
  await load();
  for(const [ui,selector] of [['zh','tr'],['en','.cue-seg']]){
    await page.eval(`if(__cueDebug.getState().mode==='home')document.querySelector('#hEditor').click();__cueDebug.setUi(${JSON.stringify(ui)});${ui==='zh'?'__cueDebug.loadExample()':'__cueDebug.loadExampleEn()'}`);
    const source=await page.eval('document.querySelector("#content").textContent');
    assert.ok(ui==='zh'?source.includes('我可以单独说上一页'):source.includes('I can say previous page'));
    assert.ok(source.includes(ui==='zh'?'默认上方两行、下方三行':'two above and three below by default'));
    const local=await page.eval(`(()=>{const unit=[...document.querySelectorAll('#content ${selector}')].find(e=>e.textContent.includes(${JSON.stringify(ui==='zh'?'我可以单独说上一页':'I can say previous page')}));__cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id="'+unit.dataset.cueId+'"]',10));__cueDebug.feedTranscript(${JSON.stringify(ui==='zh'?'下一页':'next page')},true);return __cueDebug.getState();})()`);
    assert.equal(local.commandCount,0);
    assert.ok((await page.eval('document.querySelector("#hSample").textContent.trim()')).length>0);
    assert.ok((await page.eval('document.querySelector(".sample-note").textContent')).length>15);
  }
});

test('local ASR shares command intake, strips partial/final and rejects old sequence revisions', {timeout:90000},async()=>{
  asr=await localServer();
  await load({asrMode:'local',asrUrl:asr.url});await script(doc(Array.from({length:25},()=>paragraphsEn[0])),'p:nth-child(12)');
  await page.eval('__cueDebug.startVoice()');assert.equal((await state()).asrActiveEngine,'local');
  const message=async m=>page.eval(`__sockets.at(-1).dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(m))}}));__cueDebug.getState()`);
  await message({type:'partial',seq:0,text:'next page'});assert.equal((await state()).monitor.interim,'');
  const start=await state();await message({type:'final',seq:0,text:'next page'});assert.equal((await state()).commandCount,1);assert.ok((await state()).anchorIdx>start.anchorIdx);
  await message({type:'final',seq:0,text:'next page'});await message({type:'partial',seq:0,text:'next page stale revision'});
  await until(()=>page.eval('!__cueDebug.getState().awaitingReset'));
  await message({type:'final',seq:0,text:'stale text'});
  assert.equal((await state()).monitor.final,'');assert.equal((await state()).monitor.interim,'');assert.equal((await state()).commandCount,1);
  await message({type:'final',seq:1,text:'ordinary final speech'});assert.equal((await state()).monitor.final,'ordinary final speech');
  await message({type:'final',seq:1,text:'回到顶部'});assert.equal((await state()).commandCount,2);assert.equal((await state()).anchorIdx,0);
  await until(()=>page.eval('!__cueDebug.getState().awaitingReset'));
  for(const [direction,phrase] of [[-1,'previous page'],[1,'下一页']]){
    await page.eval('__cueDebug.clearTranscript()');await until(()=>page.eval('!__cueDebug.getState().awaitingReset'));
    await script(direction<0?'<p>Say previous page here</p><p>Current sentence in my script</p>':'<p>现在我读到这段内容</p><p>随后我会提到下一页</p>',direction<0?'p:last-child':'p:first-child');
    await until(()=>page.eval('!__cueDebug.getState().awaitingReset'));
    const seq=(await state()).utterSeq, count=(await state()).commandCount;
    await message({type:'partial',seq,text:phrase});await message({type:'final',seq,text:phrase});
    assert.equal((await state()).commandCount,count);assert.equal((await state()).monitor.final,phrase);
  }
  await page.eval('__cueDebug.stopMic()');await asr.close();assert.deepEqual(page.errors,[]);
});

test('all tracked text deliverables have no excluded names, color or pictographs',async()=>{
  // Split the disallowed literals so this check also complies with the artifact rule.
  const excluded=new RegExp(['Za'+'lify','Ry'+'an','最'+'终稿','#E5'+'FE3C'].join('|'),'i');
  for(const file of ['index.html','README.md','package.json','tests/frontend.test.mjs','tests/v1.2.test.mjs','tests/cdp.mjs','tests/support.mjs','tests/local-asr.test.mjs','local-asr/README.md','local-asr/server.py','local-asr/start.ps1','local-asr/start.sh','local-asr/requirements.txt','LICENSE','.gitignore','progress.json','handoff/log.md','tests/screen-window.test.mjs']){
    const source=await readFile(file,'utf8');assert.doesNotMatch(source,excluded,file);assert.doesNotMatch(source,/\p{Extended_Pictographic}/u,file);
  }
});
