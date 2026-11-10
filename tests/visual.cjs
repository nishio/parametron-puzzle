const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const out=path.resolve(root,process.env.PW_ARTIFACT_DIR||'.artifacts/ui-review');
const site=process.env.SITE_URL||pathToFileURL(path.join(root,'index.html')).href;
fs.mkdirSync(out,{recursive:true});
const reports=[],errors=[];
(async()=>{
 const browser=await chromium.launch({channel:process.env.PW_CHANNEL||'msedge',headless:true});
 async function connect(page,gate,port,source){
  await page.locator(`[data-gate-index="${gate-1}"][data-port-index="${port-1}"]`).click();
  await page.locator('#pw-connect-invert').setChecked(source.startsWith('!'));
  await page.locator(`[data-connect-source="${source.replace('!','')}"]`).click();
 }
 async function output(page,name,source){await page.locator(`[data-output="${name}"]`).click();await page.locator('#pw-connect-invert').setChecked(false);await page.locator(`[data-connect-source="${source}"]`).click();}
 async function clear(page,count){assert.match(await page.locator('#pw-status').innerText(),new RegExp(`クリア！.*使用${count}個`));}
 async function capture(page,name){
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});
  const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollY,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,stage:document.querySelector('#parametron-workshop').dataset.level,next:document.querySelector('#pw-next').getBoundingClientRect().toJSON(),input3:document.querySelector('[data-gate-index="0"][data-port-index="2"]')?.getBoundingClientRect().toJSON(),wireCount:document.querySelectorAll('path[data-wire-from]').length,fallbacks:[...document.querySelectorAll('path[data-routing="fallback"]')].map(node=>node.dataset.wireFrom+' → '+node.dataset.wireTo)}));
  assert.ok(metrics.documentWidth<=metrics.width+1,`${name}: horizontal page overflow`);
  assert.deepEqual(metrics.fallbacks,[],`${name}: wires must route around all cards`);
  const collisions=await page.evaluate(()=>{
   const svg=document.querySelector('#pw-wires'),origin=svg.getBoundingClientRect();
   const cards=[...document.querySelectorAll('.signal-source,.gate-card,.output-card')];
   const result=[];
   for(const wire of svg.querySelectorAll('path[data-wire-from]')){
    const source=document.querySelector(`[data-source="${wire.dataset.wireFrom}"]`),sink=document.querySelector(`[data-sink="${wire.dataset.wireTo}"]`);
    const from=source.closest('.gate-card')||source,to=sink.closest('.gate-card,.output-card')||sink;
    const obstacles=cards.filter(card=>card!==from&&card!==to).map(card=>card.getBoundingClientRect());
    const length=wire.getTotalLength();
    for(let distance=0;distance<=length;distance+=8){const p=wire.getPointAtLength(distance),x=p.x+origin.left,y=p.y+origin.top;if(obstacles.some(r=>x>r.left+.5&&x<r.right-.5&&y>r.top+.5&&y<r.bottom-.5)){result.push(wire.dataset.wireFrom+' → '+wire.dataset.wireTo);break;}}
   }
   return result;
  });
  assert.deepEqual(collisions,[],`${name}: actual line geometry must not cross other cards`);
  reports.push({name,...metrics});return metrics;
 }
 for(const width of [1280,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:width===1280?900:844},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(site,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#parametron-workshop')?.dataset.level==='intro');
  const intro=await capture(page,`intro-${width}`);
  if(width===1280)assert.ok(intro.next.bottom<=900,'The desktop introduction must show the next action without scrolling');
  await page.locator('[data-toggle-input="B"]').click();
  assert.match(await page.locator('#pw-status').innerText(),/1が2票、0が1票.*出力は1/);
  await page.locator('#pw-next').click();
  const and=await capture(page,`and-${width}`);
  if(width<=390)assert.ok(and.input3.y>=0&&and.input3.bottom<=844,`${width}: first connection must be on screen`);
  const socket=page.locator('[data-gate-index="0"][data-port-index="2"]');
  await socket.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#pw-connect-dialog').evaluate(node=>node.open),true);
  await capture(page,`picker-${width}`);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pw-connect-dialog').evaluate(node=>node.open),false);
  assert.equal(await socket.evaluate(node=>node===document.activeElement),true);
  await connect(page,1,3,'1');assert.doesNotMatch(await page.locator('#pw-status').innerText(),/クリア/);
  await page.locator('#pw-undo').click();
  await connect(page,1,3,'0');await clear(page,1);
  const andClear=await capture(page,`and-clear-${width}`);
  assert.ok(andClear.next.y>=0&&andClear.next.bottom<=andClear.height+1,'After the first success, the next action must be visible');
  await page.locator('#pw-next').click();await connect(page,1,3,'1');await clear(page,1);
  await capture(page,`or-clear-${width}`);
  if(width===1280||width===390){
   await page.locator('#pw-next').click();
   for(const [i,ports] of [['A','B','0'],['A','B','1'],['!P1','P2','0']].entries())for(const [j,source] of ports.entries())await connect(page,i+1,j+1,source);
   await clear(page,3);await capture(page,`xor-clear-${width}`);
   await page.locator('#pw-next').click();
   for(const gate of [1,2])for(const [port,source] of ['A','B'].entries())await connect(page,gate,port+1,source);
   await clear(page,4);await capture(page,`half-clear-${width}`);
   await page.locator('#pw-next').click();
   for(const [i,ports] of [['A','B'],['P1','Cin'],['A','B'],['P1','Cin'],['P3','P4']].entries())for(const [j,source] of ports.entries())await connect(page,i+1,j+1,source);
   await clear(page,9);await capture(page,`full-parts-${width}`);
   for(let i=4;i>=0;i--){await page.locator(`.gate-card[data-index="${i}"] summary`).click();await page.locator(`[data-remove-gate="${i}"]`).click();}
   for(let i=0;i<3;i++)await page.locator('#pw-add').click();
   for(const [i,ports] of [['A','B','Cin'],['A','B','!Cin'],['!P1','P2','Cin']].entries())for(const [j,source] of ports.entries())await connect(page,i+1,j+1,source);
   await output(page,'S','P3');await output(page,'Cout','P1');await clear(page,3);
   await page.locator('[data-test-row="7"]').click();
   await capture(page,`full-optimal-${width}`);
   await page.locator('[data-gate-index="2"][data-port-index="0"]').focus();
   assert.equal(await page.locator('.signal-source.is-wire-source,.gate-output.is-wire-source').count(),1);
   assert.equal(await page.locator('#pw-wires path.is-traced').count(),1);
   await capture(page,`wire-trace-${width}`);
   await page.reload({waitUntil:'networkidle'});await clear(page,3);
  }
  await page.close();
 }
 await browser.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({site,reports,errors},null,2));
 console.log(JSON.stringify({pass:true,viewports:[1280,768,390,320],screenshots:reports.length,checks:'visible first connection, no horizontal overflow, native Enter/Escape and focus return, incorrect choice and undo, earned parts, 9- and 3-element full adders, reload',output:out}));
})().catch(error=>{console.error(error);process.exitCode=1;});
