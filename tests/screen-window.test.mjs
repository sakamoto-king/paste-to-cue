import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { browser, mockSpeech, until, delay } from './cdp.mjs';
import { staticServer } from './support.mjs';

let page, web;
before(async()=>{web=await staticServer();page=await browser();await page.call('Page.addScriptToEvaluateOnNewDocument',{source:mockSpeech});});
after(async()=>{try{await page?.close();}finally{await web?.close();}});
async function load(saved={},key='paste-to-cue-v4.0'){
  const id=crypto.randomUUID();
  const init=await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify({ui:'en',uiChosen:true,asrMode:'browser',...saved}))});window.__screenId=${JSON.stringify(id)};`});
  try{await page.call('Page.navigate',{url:web.url+'/?'+id});await until(()=>page.eval(`window.__screenId===${JSON.stringify(id)}&&!!window.__cueDebug&&document.readyState==='complete'`));}
  finally{await page.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:init.identifier});}
}
async function mount(html,{width=560,height=260,anchor='[data-cue-id=l20]'}={}){
  await page.eval(`document.querySelector('#hEditor').click();__cueDebug.loadHtml(${JSON.stringify(html)});document.querySelector('#stage').style.width='${width}px';document.querySelector('#stage').style.height='${height}px'`);
  await delay(100);
  await page.eval(`__cueDebug.setAnchor(Math.max(0,__cueDebug.tokenIndexOf(${JSON.stringify(anchor)})));__cueDebug.stopMic()`);
  await delay(40);
  return scope();
}
const scope=()=>page.eval('__cueDebug.matchScope()');
const state=()=>page.eval('__cueDebug.getState()');
async function controls(above,below){await page.eval(`for(const [key,value] of [['extraAboveLines',${above}],['extraBelowLines',${below}]]){const e=document.getElementById(key);e.value=value;e.dispatchEvent(new Event('input'));}`);return scope();}
const lineDoc=(n=80,commandLine=-1,phrase='please turn this page now')=>Array.from({length:n},(_,i)=>`<p style="margin:0" data-cue-id="l${i}">${i===commandLine?phrase:`entry${i} quiet morning reading`}</p>`).join('');
async function scrollToText(selector,edge='top'){
  await page.eval(`(()=>{__cueDebug.stopMic();const s=document.querySelector('#scroller'),e=document.querySelector(${JSON.stringify(selector)}),r=document.createRange();r.selectNodeContents(e);const b=r.getClientRects()[0],v=s.getBoundingClientRect();s.scrollTop+=${edge==='above'?'b.bottom-v.top+1':edge==='below'?'b.top-v.top-s.clientHeight-1':'b.top-v.top'};})()`);
  return scope();
}

test('hidden Home has no fake candidates; setup uses its actual clipping viewport',async()=>{
  await load();let s=await scope();assert.equal(s.hidden,true);assert.deepEqual(s.indices,[]);
  const result=await page.eval(`__cueDebug.match('Zoom from fifty percent all the way')`);assert.equal(result,null);
  s=await mount(lineDoc());assert.equal(s.hidden,false);assert.ok(s.visibleRows.length>0);assert.ok(s.indices.length>0);
  assert.ok(s.viewport.bottom>s.viewport.top);assert.ok(s.indices.length<=600);
  assert.equal(await page.eval('document.querySelector("#extraAboveLines").getAttribute("aria-label")'),'Extra lines above screen');
  await page.eval('__cueDebug.setUi("zh")');assert.equal(await page.eval('document.querySelector("#extraBelowLines").getAttribute("aria-label")'),'屏幕外下方多搜几行');
});

test('above and below count actual wrapped lines independently including 0 and 10',async()=>{
  await load();
  const words=Array.from({length:1000},(_,i)=>'wrapped'+i).join(' ');
  await mount(`<p data-cue-id="long" style="margin:0">${words}</p>`,{width:320,height:210,anchor:'[data-cue-id=long]'});
  await page.eval(`__cueDebug.setAnchor(500);__cueDebug.stopMic()`);
  const zero=await controls(0,0), both=await controls(2,3);
  assert.ok(zero.visibleRows.length>=3);assert.equal(zero.rows.length,zero.visibleRows.length);
  assert.equal(both.rows.length,zero.rows.length+5);
  const above=await controls(10,0), below=await controls(0,10);
  assert.equal(above.rows.length,zero.rows.length+10);assert.equal(below.rows.length,zero.rows.length+10);
  assert.equal(above.rows.at(-1).id,zero.rows.at(-1).id);assert.equal(below.rows[0].id,zero.rows[0].id);
  assert.ok(above.indices[0]<zero.indices[0]);assert.equal(above.indices.at(-1),zero.indices.at(-1));
  assert.equal(below.indices[0],zero.indices[0]);assert.ok(below.indices.at(-1)>zero.indices.at(-1));
  // Independent DOM oracle: every selected row has real text rectangles, even
  // though all these rows belong to one paragraph.
  const actual=await page.eval(`(()=>{const n=document.querySelector('[data-cue-id=long]').firstChild,r=document.createRange(),s=document.querySelector('#scroller'),tops=new Set();for(const m of n.textContent.matchAll(/\\S+/g)){r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);for(const b of r.getClientRects())if(b.width&&b.height)tops.add(Math.round(b.top-s.getBoundingClientRect().top+s.scrollTop));}return [...tops].sort((a,b)=>a-b);})()`);
  assert.ok(actual.length>50);assert.ok(actual.length>=below.rows.at(-1).id+1);
  const positions=below.rows.map(row=>actual.indexOf(Math.round(row.top)));
  assert.ok(positions.every(p=>p>=0));assert.ok(positions.every((p,i)=>!i||p===positions[i-1]+1));
  for(let i=1;i<below.rows.length;i++)assert.ok(below.rows[i].top>below.rows[i-1].top);
});

test('wrapped table cells use actual rows rather than table row or paragraph counts',async()=>{
  await load();
  const text=Array.from({length:400},()=> 'gentle woodland breeze').join(' ');
  const s=await mount(`<table><tr><th>Script</th><th>Notes</th></tr><tr><td><p data-cue-id="cell" style="margin:0">${text}</p></td><td><p style="margin:0">brief</p></td></tr></table>`,{width:410,height:200,anchor:'[data-cue-id=cell]'});
  await page.eval('__cueDebug.setAnchor(250);__cueDebug.stopMic()');
  const zero=await controls(0,0), plus=await controls(2,3);
  assert.equal(plus.rows.length,zero.rows.length+5);assert.ok(plus.rows.length>5);
  assert.ok(plus.indices.length<s.rawCount+200);assert.equal(await page.eval('document.querySelectorAll("#content tr:not(:has(th))").length'),1);
});

test('manual and automatic scrolling update membership without full geometry rereads',async()=>{
  await load();await mount(lineDoc());
  const a=await controls(0,0);
  await page.eval(`document.querySelector('#scroller').scrollTop+=210`);const b=await scope();
  assert.ok(b.indices[0]>a.indices[0]);assert.equal(b.geometryRevision,a.geometryRevision);
  await page.eval(`__cueDebug.startVoice()`);await delay(100);
  const c=await scope();
  await page.eval(`__cueDebug.simulateHit(__cueDebug.tokenIndexOf('[data-cue-id=l35]'))`);await delay(600);
  const d=await scope();assert.ok(d.indices[0]>c.indices[0]);assert.ok((await state()).scrollTop>0);
  await page.eval('__cueDebug.stopMic()');
});

test('font, real zoom, stage size and browser viewport all recompute geometry',async()=>{
  await load();await mount(lineDoc(140),{width:480,height:380});await controls(0,0);
  const a=await scope();
  await page.eval(`for(let i=0;i<6;i++)document.querySelector('#fUp').click()`);const b=await scope();assert.ok(b.geometryRevision>a.geometryRevision);assert.notDeepEqual(b.indices,a.indices);
  await page.eval(`document.querySelector('#zoom').value=200;document.querySelector('#zoom').dispatchEvent(new Event('input'))`);await delay(100);
  const c=await scope();assert.ok(c.geometryRevision>b.geometryRevision);assert.ok(c.indices.length<b.indices.length);
  await page.eval(`document.querySelector('#stage').style.height='180px'`);await delay(100);
  const d=await scope();assert.ok(d.indices.length<c.indices.length);
  await page.call('Emulation.setDeviceMetricsOverride',{width:320,height:340,deviceScaleFactor:1,mobile:false});await delay(100);
  const e=await scope();assert.ok(e.geometryRevision>d.geometryRevision);assert.notDeepEqual(e.indices,d.indices);
  await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
});

test('oversized stage is clipped by its real parent rather than treated as all visible',async()=>{
  await load();const s=await mount(lineDoc(200),{width:560,height:1800});await controls(0,0);
  const result=await scope();const parentHeight=await page.eval('document.querySelector("#stageWrap").clientHeight');
  assert.ok(result.viewport.bottom-result.viewport.top<=parentHeight+1);
  assert.ok(result.visibleRows.length<35);assert.equal(s.hidden,false);
});

test('old cache generations all migrate token counts; only explicit valid line versions persist',async t=>{
  for(const key of ['paste-to-cue-v4.0','paste-to-cue-v3.3','paste-to-cue-v3.2','paste-to-cue-v3','paste-to-cue-v2'])await t.test(key,async()=>{
    await load({backWin:173,fwdWin:11,backWinVer:2,fwdWinVer:2},key);
    assert.deepEqual([(await state()).extraAboveLines,(await state()).extraBelowLines],[2,3]);
  });
  for(const saved of [{lineWindowVer:0,extraAboveLines:0,extraBelowLines:10},{lineWindowVer:1,extraAboveLines:-1,extraBelowLines:3},{lineWindowVer:1,extraAboveLines:2,extraBelowLines:11},{lineWindowVer:1,extraAboveLines:'2',extraBelowLines:3}]){
    await load(saved);assert.deepEqual([(await state()).extraAboveLines,(await state()).extraBelowLines],[2,3]);
  }
  await load({lineWindowVer:1,extraAboveLines:0,extraBelowLines:10,backWin:8,fwdWin:90});
  assert.deepEqual([(await state()).extraAboveLines,(await state()).extraBelowLines],[0,10]);
  await controls(10,0);await page.eval('window.__cueDebug=null');await page.call('Page.reload');await until(()=>page.eval('!!window.__cueDebug'));
  assert.deepEqual([(await state()).extraAboveLines,(await state()).extraBelowLines],[10,0]);
});

function distinctiveWords(n){let seed=0x31415926;return Array.from({length:n},()=>Array.from({length:11},()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return String.fromCharCode(97+(seed>>>0)%26);}).join(''));}
test('600-token cap keeps the nearest contiguous membership and cannot leak dropped candidates',async t=>{
  for(const language of ['en','zh'])await t.test(language,async()=>{
    await page.call('Emulation.setDeviceMetricsOverride',{width:3200,height:2200,deviceScaleFactor:1,mobile:false});
    const phrase=language==='en'?'please turn this page now':'请马上回到顶部';
    await load({fontSize:14,zoom:50,commands:[{text:phrase,action:'top'}],lineWindowVer:1,extraAboveLines:10,extraBelowLines:10});
    const words=language==='en'?distinctiveWords(1800):Array.from({length:1800},(_,i)=>'清晨树林花香月光河水'[i%10]);
    const html=`<p data-cue-id="command" style="margin:0">${phrase}</p>`+Array.from({length:60},(_,i)=>`<p style="margin:0" data-cue-id="l${i}">${words.slice(i*30,i*30+30).join(language==='en'?' ':'')}</p>`).join('');
    await mount(html,{width:2800,height:1700,anchor:'[data-cue-id=l30]'});
    let s=await scope();assert.ok(s.rawCount>600,JSON.stringify({raw:s.rawCount,rows:s.rows.length}));assert.equal(s.indices.length,600);assert.equal(s.capped,true);
    const anchor=(await state()).anchorIdx;assert.ok(s.indices.includes(anchor));assert.equal(s.ranges.length,1);
    assert.ok(!s.indices.includes(0));assert.ok(Math.abs(s.indices[0]-anchor)<=301);assert.ok(Math.abs(s.indices.at(-1)-anchor)<=301);
    assert.equal(await page.eval(`__cueDebug.match(${JSON.stringify(phrase)})`),null);
    let result=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)},true)`);assert.equal(result.commandCount,1);assert.equal(result.monitor.final,'');
    await page.eval(`__cueDebug.setAnchor(0);__cueDebug.stopMic();__cueDebug.clearTranscript()`);s=await scope();assert.ok(s.indices.includes(0));
    result=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)},true)`);assert.equal(result.commandCount,1);assert.equal(result.monitor.final,phrase);
    await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  });
});

test('equal repeated long phrases choose the nearer backward occurrence, without a capped distance tie',async()=>{
  await load({fontSize:14,zoom:50});
  const phrase='morning sunlight fills our peaceful garden beside the old stone bridge';
  const gap=distinctiveWords(180).join(' '), tail=distinctiveWords(100).join(' ');
  await mount(`<p data-cue-id="far">${phrase}</p><p>${gap}</p><p data-cue-id="near">${phrase}</p><p data-cue-id="anchor">${tail}</p>`,{width:1100,height:650,anchor:'[data-cue-id=anchor]'});
  await page.eval(`__cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id=anchor]',-1));__cueDebug.stopMic()`);
  const hit=await page.eval(`__cueDebug.match(${JSON.stringify(phrase)})`);
  const bounds=await page.eval(`[__cueDebug.tokenIndexOf('[data-cue-id=near]'),__cueDebug.tokenIndexOf('[data-cue-id=near]',-1)]`);
  assert.ok(hit&&hit.idx>=bounds[0]&&hit.idx<=bounds[1],JSON.stringify({hit,bounds}));
});

test('a command straddling the cap boundary is not reassembled from dropped query-end tokens',async()=>{
  await page.call('Emulation.setDeviceMetricsOverride',{width:3200,height:2200,deviceScaleFactor:1,mobile:false});
  const phrase='please turn this page now';
  await load({fontSize:14,zoom:50,commands:[{text:phrase,action:'top'}]});
  const words=distinctiveWords(1500),html=()=>`<p data-cue-id="whole" style="margin:0">${words.join(' ')}</p>`;
  await mount(html(),{width:2800,height:1700,anchor:'[data-cue-id=whole]'});
  await page.eval('__cueDebug.setAnchor(500);__cueDebug.stopMic()');
  let s=await scope();assert.equal(s.indices.length,600);
  const boundary=s.indices.at(-1);words.splice(boundary-2,5,...phrase.split(' '));
  await page.eval(`__cueDebug.loadHtml(${JSON.stringify(html())});__cueDebug.setAnchor(500);__cueDebug.stopMic()`);
  s=await scope();assert.ok(s.indices.includes(boundary-2));assert.ok(s.indices.includes(boundary));assert.ok(!s.indices.includes(boundary+1));
  assert.equal(await page.eval(`__cueDebug.match(${JSON.stringify(phrase)})`),null);
  const result=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)},true)`);assert.equal(result.commandCount,1);assert.equal(result.monitor.final,'');
  await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
});

test('long distinctive evidence beats a nearby matching short tail',async()=>{
  await load({fontSize:14});
  const phrase='bright lanterns guide travelers through winding mountain paths toward our quiet wooden cabin';
  const tail=phrase.split(' ').slice(-6).join(' ');
  await mount(`<p data-cue-id="near">${tail}</p><p>${distinctiveWords(90).join(' ')}</p><p data-cue-id="far">${phrase}</p>`,{width:1000,height:700,anchor:'[data-cue-id=near]'});
  const result=await page.eval(`({hit:__cueDebug.match(${JSON.stringify(phrase)}),idx:__cueDebug.tokenIndexOf('[data-cue-id=far]')})`);
  assert.ok(result.hit&&result.hit.idx>=result.idx,JSON.stringify(result));
});

test('short repetitions prefer the nearest plausible forward match',async()=>{
  await load({fontSize:14});const phrase='follow the bright morning light';
  await mount(`<p data-cue-id="anchor">start reading now</p><p data-cue-id="near">${phrase}</p><p>${distinctiveWords(140).join(' ')}</p><p data-cue-id="far">${phrase}</p>`,{width:1000,height:700,anchor:'[data-cue-id=anchor]'});
  const result=await page.eval(`({hit:__cueDebug.match(${JSON.stringify(phrase)}),lo:__cueDebug.tokenIndexOf('[data-cue-id=near]'),hi:__cueDebug.tokenIndexOf('[data-cue-id=near]',-1)})`);
  assert.ok(result.hit&&result.hit.idx>=result.lo&&result.hit.idx<=result.hi,JSON.stringify(result));
});

test('paragraph heads outside visible plus extra rows never bypass membership',async()=>{
  await load();const phrase='distinctive lanterns illuminate the ancient garden path';
  await mount(`<p data-cue-id="start">${distinctiveWords(900).join(' ')}</p><p data-cue-id="outside">${phrase}</p>`,{width:400,height:180,anchor:'[data-cue-id=start]'});
  await controls(0,0);assert.equal(await page.eval(`__cueDebug.match(${JSON.stringify(phrase)})`),null);
  const before=await state();assert.equal((await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)})`)).anchorIdx,before.anchorIdx);
  await page.eval(`__cueDebug.setAnchor(__cueDebug.tokenIndexOf('[data-cue-id=outside]'));__cueDebug.stopMic()`);
  assert.ok(await page.eval(`__cueDebug.match(${JSON.stringify(phrase)})`));
});

test('commands share the actual above/below membership including zero lines',async t=>{
  for(const direction of ['above','below'])await t.test(direction,async()=>{
    const phrase='please turn this page now';await load({commands:[{text:phrase,action:'top'}]});
    await mount(lineDoc(80,20,phrase),{width:560,height:180,anchor:direction==='above'?'[data-cue-id=l22]':'[data-cue-id=l18]'});
    await controls(0,0);await scrollToText('[data-cue-id=l20]',direction);
    let result=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)},true)`);assert.equal(result.commandCount,1);assert.equal(result.monitor.final,'');
    await controls(direction==='above'?1:0,direction==='below'?1:0);
    await page.eval('__cueDebug.clearTranscript()');await scrollToText('[data-cue-id=l20]',direction);
    result=await page.eval(`__cueDebug.feedTranscript(${JSON.stringify(phrase)},true)`);assert.equal(result.commandCount,1);assert.equal(result.monitor.final,phrase);
    const s=await scope(),bounds=await page.eval(`[__cueDebug.tokenIndexOf('[data-cue-id=l20]'),__cueDebug.tokenIndexOf('[data-cue-id=l20]',-1)]`);
    assert.ok(s.indices.includes(bounds[0])&&s.indices.includes(bounds[1]));
  });
});

test('punctuation-only rendered lines count as extra lines without adding matching tokens',async()=>{
  const phrase='please turn this page now';await load({commands:[{text:phrase,action:'top'}]});
  let html=lineDoc(80,20,phrase).replace('<p style="margin:0" data-cue-id="l21">','<p style="margin:0" data-cue-id="punct">… — …</p><p style="margin:0" data-cue-id="l21">');
  await mount(html,{width:560,height:180,anchor:'[data-cue-id=l22]'});
  await controls(1,0);await scrollToText('[data-cue-id=punct]','above');
  let s=await scope();assert.equal(s.rows[0].indices.length,0);
  const commandIndex=await page.eval(`__cueDebug.tokenIndexOf('[data-cue-id=l20]')`);assert.ok(!s.indices.includes(commandIndex));
  await controls(2,0);s=await scope();assert.ok(s.indices.includes(commandIndex));
});

test('no runtime browser exceptions in viewport tests',()=>assert.deepEqual(page.errors,[]));
