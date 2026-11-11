const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const project=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(project,'app.js'),'utf8');
const core=source.slice(source.indexOf('  const VERSION'),source.indexOf('  // UI'));
const {levels,evaluate,normalizeBoard,removeGate,expandGate}=new Function(core+';return {levels,evaluate,normalizeBoard,removeGate,expandGate};')();
const edge=text=>({source:text.replace('!',''),inverted:text.startsWith('!')});
const raw=(ports,outputs)=>({gates:ports.map(items=>({type:'MAJ',ports:items.map(edge)})),outputs:Object.fromEntries(Object.entries(outputs).map(([name,value])=>[name,edge(value)])),input:0});
const library={AND:raw([['A','B','0']],{Y:'P1'}),OR:raw([['A','B','1']],{Y:'P1'}),XOR:raw([['A','B','0'],['A','B','1'],['!P1','P2','0']],{Y:'P3'})};
const full=raw([['A','B','Cin'],['A','B','!Cin'],['!P1','P2','Cin']],{S:'P3',Cout:'P1'});
const game={version:2,level:5,introDone:true,library,bests:{and:1,or:1,xor:3,half:4,full:3},boards:{full},motion:false};
const fullLevel=levels.find(item=>item.id==='full');
const normalize=normalizeBoard(fullLevel,{...full,layout:{wide:[{x:4,y:-10},{x:NaN,y:5},{x:0.4,y:30000}]}},library);
assert.deepEqual(normalize.layout.wide,[{x:1,y:0},null,{x:0.4,y:8192}]);
const moduleBoard={gates:[{type:'XOR',ports:['A','B'].map(edge)},{type:'AND',ports:['A','B'].map(edge)}],outputs:{S:edge('P1'),C:edge('P2')},input:0,layout:{wide:[{x:0.1,y:80},{x:1,y:90}],narrow:[{x:0,y:0},{x:0,y:300}]}};
const expanded=expandGate(moduleBoard,0,library);
assert.equal(expanded.layout.wide.length,4);assert.deepEqual(expanded.layout.wide[3],{x:1,y:90});
const removed=removeGate(moduleBoard,0);assert.deepEqual(removed.layout.wide,[{x:1,y:90}]);
for(let row=0;row<4;row++)assert.deepEqual(evaluate({inputs:['A','B'],outputs:['S','C']},moduleBoard,row,library).outputs,evaluate({inputs:['A','B'],outputs:['S','C']},expanded,row,library).outputs);
const site=process.env.SITE_URL||pathToFileURL(path.join(project,'index.html')).href;
const out=path.join(project,'.artifacts/layout-review');fs.mkdirSync(out,{recursive:true});
const errors=[];
let browser;
(async()=>{
 browser=await chromium.launch({channel:process.env.PW_CHANNEL||'msedge',headless:true});
 async function open(width,saved=game,touch=false){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});
  await context.addInitScript(saved=>{if(!localStorage.getItem('parametron-puzzle:v2'))localStorage.setItem('parametron-puzzle:v2',JSON.stringify(saved));},saved);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(site,{waitUntil:'networkidle'});await page.locator('[data-move-gate="0"]').waitFor();
  assert.match(await page.locator('#pw-status').innerText(),/クリア！.*使用3個/);
  return {page,context};
 }
 const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('parametron-puzzle:v2')));
 const circuit=state=>JSON.stringify({gates:state.boards.full.gates,outputs:state.boards.full.outputs,input:state.boards.full.input});
 async function geometry(page){return page.evaluate(()=>{const origin=document.querySelector('#pw-gates').getBoundingClientRect();return [...document.querySelectorAll('.gate-card')].map(card=>{const r=card.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,width:r.width,height:r.height};});});}
 async function check(page){
  await page.waitForTimeout(60);
  const points=await geometry(page);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j];assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),'Cards must not overlap after placement');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.locator('[data-routing="fallback"]').count(),0,'Moved connections must still route around the cards');
  assert.match(await page.locator('#pw-status').innerText(),/クリア！.*使用3個/);
 }
 const {page,context}=await open(1280);
 const initial=await geometry(page);const signature=circuit(game);
 const handle=page.locator('[data-move-gate="0"]');await handle.scrollIntoViewIfNeeded();const h=await handle.boundingBox();
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+110,h.y+h.height/2+80,{steps:10});await page.mouse.up();
 await check(page);const after=await saved(page);assert.equal(circuit(after),signature);assert.ok(after.boards.full.layout.wide[0].y>=64);
 const moved=await geometry(page);assert.ok(moved[0].x>initial[0].x+60);assert.ok(moved[0].y>initial[0].y+60);
 await page.screenshot({path:path.join(out,'desktop-dragged.png'),fullPage:true});
 await page.locator('[data-move-gate="0"]').focus();await page.keyboard.press('Shift+ArrowDown');
 const keyMoved=await saved(page);assert.equal(keyMoved.boards.full.layout.wide[0].y,after.boards.full.layout.wide[0].y+64);
 await page.locator('#pw-undo').click();assert.deepEqual((await saved(page)).boards.full.layout,after.boards.full.layout);
 await page.reload({waitUntil:'networkidle'});await check(page);assert.deepEqual((await geometry(page))[0],moved[0]);
 const cancelHandle=page.locator('[data-move-gate="0"]');await cancelHandle.scrollIntoViewIfNeeded();const cancelBox=await cancelHandle.boundingBox();
 await page.mouse.move(cancelBox.x+cancelBox.width/2,cancelBox.y+cancelBox.height/2);await page.mouse.down();await page.mouse.move(cancelBox.x+cancelBox.width/2+64,cancelBox.y+cancelBox.height/2+48,{steps:4});
 assert.equal(await page.locator('.gate-card.is-dragging').count(),1);
 await page.screenshot({path:path.join(out,'desktop-during-drag.png')});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
 await check(page);assert.deepEqual((await geometry(page))[0],moved[0]);
 await page.locator('#pw-arrange').click();assert.equal((await saved(page)).boards.full.layout,undefined);await check(page);
 await page.locator('#pw-undo').click();assert.deepEqual((await saved(page)).boards.full.layout,after.boards.full.layout);
 const persisted=await saved(page);await context.close();
 for(const width of [390,320]){
  const {page,context}=await open(width,persisted,true);
  await page.locator('[data-move-gate="0"]').tap();
  assert.equal(await page.locator('#pw-move-controls').isVisible(),true,'A tap must reveal the movement controls');
  await page.locator('[data-move-gate="0"]').tap();
  assert.equal(await page.locator('#pw-move-controls').isVisible(),false,'A second tap must close the controls without moving a gate');
  const before=await geometry(page);const handle=page.locator('[data-move-gate="2"]');await handle.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));const h=await handle.boundingBox();
  const client=await context.newCDPSession(page),x=h.x+h.width/2,y=h.y+h.height/2;
  const scrollBefore=await page.evaluate(()=>scrollY);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=8;step++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*12}]});await page.waitForTimeout(16);}
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await check(page);const dragged=await saved(page);assert.equal(circuit(dragged),signature);assert.ok(dragged.boards.full.layout.narrow[2].y<before[2].y-50);
  const scrollAfter=await page.evaluate(()=>scrollY);
  assert.ok(Math.abs(scrollAfter-scrollBefore)<2,`A touch drag away from the viewport edges must not scroll the page: ${scrollBefore} → ${scrollAfter}; handle y=${y}`);
  assert.deepEqual(dragged.boards.full.layout.wide,persisted.boards.full.layout.wide,'Mobile arrangements must not overwrite desktop arrangements');
  if(await page.locator('#pw-move-controls').isHidden())await page.locator('[data-move-gate="2"]').tap();
  const moveLabel=await page.locator('#pw-move-label').innerText();
  await page.locator('[data-nudge="down"]').tap();
  await page.waitForFunction(y=>JSON.parse(localStorage.getItem('parametron-puzzle:v2')).boards.full.layout.narrow[2].y!==y,dragged.boards.full.layout.narrow[2].y,{timeout:2000});
  const nudged=await saved(page);
  assert.equal(nudged.boards.full.layout.narrow[2].y,dragged.boards.full.layout.narrow[2].y+16,JSON.stringify({moveLabel,afterLabel:await page.locator('#pw-move-label').textContent(),before:dragged.boards.full.layout.narrow,after:nudged.boards.full.layout.narrow,coach:await page.locator('#pw-coach').innerText()}));
  await page.screenshot({path:path.join(out,`touch-moved-${width}.png`),fullPage:true});
  await page.reload({waitUntil:'networkidle'});await check(page);
  assert.equal((await geometry(page))[2].y,nudged.boards.full.layout.narrow[2].y);
  await context.close();
 }
 await browser.close();assert.deepEqual(errors,[]);
 console.log('PASS: real mouse and touch dragging; keyboard/arrow-button moves; no overlapping cards; live routed wires; unchanged circuits and score; undo/auto-arrange; reload and separate mobile/desktop layouts; add/remove/expand persistence mapping.');
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
