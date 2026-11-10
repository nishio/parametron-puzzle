const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const errors=[];
function start(saved,denyStorage=false) {
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error));
  const dom=new JSDOM(html,{url:'https://nishio.github.io/parametron-puzzle/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  if(saved)dom.window.localStorage.setItem('parametron-puzzle:v2',saved);
  if(denyStorage)Object.defineProperty(dom.window,'localStorage',{get(){throw new Error('Storage unavailable');}});
  dom.window.eval(source);
  return dom;
}
const dom=start(),window=dom.window,document=window.document;
const $=selector=>{const node=document.querySelector(selector);assert.ok(node,`Missing ${selector}`);return node;};
const aria=label=>`[aria-label="${label}"]`;
function select(selector,value) {
  const node=$(selector);assert.ok([...node.options].some(option=>option.value===value),`No option ${value} in ${selector}`);
  node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));
}
function ports(node,values) {
  values.forEach((source,i)=>{
    select(aria(`P${node} 入力${i+1}`),source.replace('!',''));
    if(source.startsWith('!'))$(aria(`P${node} 入力${i+1}の反転`)).click();
  });
}
function output(name,value) {select(aria(`出力${name}の接続元`),value);}
function next(level) {$('#pw-next').click();assert.equal($('#pw-level').value,String(level));}
function cleared(cost) {assert.match($('#pw-status').textContent,/クリア！/);assert.ok($('#pw-status').textContent.includes(`使用${cost}素子`));}
assert.equal($('#pw-level').value,'0');
assert.match($('#pw-status').textContent,/1が2票、0が1票/);
assert.ok(document.querySelectorAll('.pw-moving').length>=4);
$('[data-input="2"]').click();
assert.match($('#pw-status').textContent,/1が3票、0が0票/);
next(1);
assert.match($('#pw-status').textContent,/未|つなごう/);
ports(1,['A','B','0']);output('Y','P1');cleared(1);
next(2);
ports(1,['A','B','1']);output('Y','P1');cleared(1);
next(3);
ports(1,['A','B','0']);ports(2,['A','B','1']);ports(3,['!P1','P2','0']);output('Y','P3');cleared(3);
next(4);
ports(1,['A','B']);ports(2,['A','B']);output('S','P1');output('C','P2');cleared(4);
$(aria('P1のXORをパラメトロンに展開')).click();
cleared(4);assert.equal(document.querySelectorAll('.pw-gate').length,4);
output('C','P1');cleared(3);
$(aria('P4を外す')).click();cleared(3);
next(5);
ports(1,['A','B']);ports(2,['P1','Cin']);ports(3,['A','B']);ports(4,['P1','Cin']);ports(5,['P3','P4']);
output('S','P2');output('Cout','P5');cleared(9);
for(let count=5;count>=1;count--)$(aria(`P${count}を外す`)).click();
assert.equal(document.querySelectorAll('.pw-gate').length,0);
for(let count=0;count<3;count++)$('#pw-add').click();
ports(1,['A','B','Cin']);ports(2,['A','B','!Cin']);ports(3,['!P1','P2','Cin']);
output('S','P3');output('Cout','P1');cleared(3);
assert.match($('#pw-status').textContent,/最少達成/);
assert.equal($('#pw-next').hidden,true);
assert.equal(document.querySelectorAll('#pw-table tbody tr').length,8);
for(let row=0;row<8;row++)$(`[data-row="${row}"]`).click();
assert.ok([...document.querySelectorAll('#pw-table tbody button')].every(button=>button.textContent==='一致'));
$('#pw-motion').click();assert.ok($('#parametron-workshop').classList.contains('pw-paused'));
const saved=window.localStorage.getItem('parametron-puzzle:v2');
const savedGame=JSON.parse(saved);assert.equal(savedGame.bests.full,3);assert.equal(savedGame.bests.half,3);
const reloaded=start(saved);
assert.equal(reloaded.window.document.querySelector('#pw-level').value,'5');
assert.match(reloaded.window.document.querySelector('#pw-status').textContent,/自己ベスト3素子/);
assert.equal(reloaded.window.document.querySelectorAll('.pw-gate').length,3);
const noStorage=start(null,true);
noStorage.window.document.querySelector('[data-input="0"]').click();
assert.match(noStorage.window.document.querySelector('#pw-storage').textContent,/保存できません/);
assert.equal(errors.length,0,errors.map(error=>error.message).join('; '));
dom.window.close();reloaded.window.close();noStorage.window.close();
console.log('PASS: DOM playthrough from majority through AND/OR/XOR, earned-block half/full adders, expansion and optimization to 3 elements, all 8 input observations, motion control, reload, and unavailable storage. No DOM runtime errors.');
