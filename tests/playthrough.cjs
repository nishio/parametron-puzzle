const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const errors=[],documents=[];
const SAVE_KEY='parametron-puzzle:v2';
function start(saved,denyStorage=false) {
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error));
  const dom=new JSDOM(html,{url:'https://nishio.github.io/parametron-puzzle/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  documents.push(dom);
  if(saved)dom.window.localStorage.setItem(SAVE_KEY,saved);
  if(denyStorage)Object.defineProperty(dom.window,'localStorage',{get(){throw new Error('Storage unavailable');}});
  dom.window.eval(source);
  return dom;
}
async function playthrough() {
  const dom=start(),window=dom.window,document=window.document;
  const $=selector=>{const node=document.querySelector(selector);assert.ok(node,`Missing ${selector}`);return node;};
  const dialog=()=>$('#pw-connect-dialog');
  const socket=(gate,port)=>`button.socket[data-gate-index="${gate}"][data-port-index="${port}"]`;
  const outputSocket=name=>`button.socket[data-output="${name}"]`;
  const savedGame=()=>JSON.parse(window.localStorage.getItem(SAVE_KEY));
  const board=()=>{const game=savedGame();return game.boards[['intro','and','or','xor','half','full'][game.level]];};
  const flushWires=()=>new Promise(resolve=>window.requestAnimationFrame(()=>resolve()));
  function connect(selector,value) {
    const button=$(selector);assert.equal(button.tagName,'BUTTON');assert.equal(button.disabled,false);button.click();
    assert.equal(dialog().open,true,'Selecting an input must open the signal picker');
    const inverted=value.startsWith('!'),sourceName=value.replace('!','');
    $('#pw-connect-invert').checked=inverted;
    $(`#pw-connect-options button[data-connect-source="${sourceName}"]`).click();
    assert.equal(dialog().open,false,'A chosen signal must close the picker');
    assert.equal(document.activeElement,$(selector),'Focus must return to the edited input');
  }
  function ports(node,values) {values.forEach((value,port)=>connect(socket(node-1,port),value));}
  function output(name,value) {connect(outputSocket(name),value);}
  function next(level) {assert.equal($('#pw-next').disabled,false);$('#pw-next').click();assert.equal($('#pw-level').value,String(level));}
  function cleared(cost) {assert.match($('#pw-status').textContent,/クリア！/);assert.ok($('#pw-status').textContent.includes(`使用${cost}個`),$('#pw-status').textContent);}
  function notCleared() {assert.doesNotMatch($('#pw-status').textContent,/クリア！/);}
  function closeWithoutChanging(selector,viaCancelEvent=false) {
    const before=JSON.stringify(board());$(selector).click();
    assert.equal(dialog().open,true);
    if(viaCancelEvent) {
      const event=new window.Event('cancel',{bubbles:false,cancelable:true});
      dialog().dispatchEvent(event);assert.equal(event.defaultPrevented,true);
    } else $('#pw-connect-cancel').click();
    assert.equal(dialog().open,false);assert.equal(JSON.stringify(board()),before);
    assert.equal(document.activeElement,$(selector));
  }

  // The novice's first action changes a majority without editing a circuit.
  assert.equal($('#pw-level').value,'0');
  assert.equal(document.querySelector(outputSocket('Y')),null,'The majority observation must not expose output rewiring');
  assert.ok(document.querySelector('span.output-terminal[data-sink="output:Y"]'));
  assert.equal($('#pw-level option[value="5"]').disabled,true);
  assert.match($('#pw-status').textContent,/1が1票、0が2票.*出力は0/);
  assert.match($('#pw-coach').textContent,/B/);
  assert.ok(document.querySelectorAll('.wave-motion').length>=4);
  assert.equal($(socket(0,2)).disabled,true,'The observation example must not invite circuit editing');
  $('[data-toggle-input="B"]').click();
  assert.match($('#pw-status').textContent,/1が2票、0が1票.*出力は1/);
  await flushWires();
  assert.equal(document.querySelectorAll('#pw-wires path[data-wire-from]').length,4,'The diagram must contain actual connections, not isolated decoration');
  assert.ok(document.querySelector('#pw-wires [data-wire-from="B"][data-wire-to="gate:0:1"]'));
  next(1);

  // A/B and the result are already connected: one choice earns AND.
  assert.equal($('#pw-palette').hidden,true);
  assert.equal(document.querySelector(outputSocket('Y')),null,'The first AND must keep the output preconnected without an editing control');
  assert.equal(document.querySelectorAll('select').length,2,'No per-port dropdown editor should return');
  assert.equal($(socket(0,2)).getAttribute('aria-label'),'P1の入力3をつなぐ');
  assert.ok($(socket(0,2)).classList.contains('is-suggested'));
  $(socket(0,2)).click();
  assert.equal($('#pw-connect-invert').closest('label').hidden,true);
  assert.deepEqual([...document.querySelectorAll('[data-connect-source]')].map(button=>button.dataset.connectSource),['0','1','A','B']);
  $('#pw-connect-cancel').click();
  connect(socket(0,2),'0');cleared(1);
  assert.equal(board().gates[0].ports[0].source,'A');assert.equal(board().gates[0].ports[1].source,'B');assert.equal(board().outputs.Y.source,'P1');
  await flushWires();
  assert.ok(document.querySelector('#pw-wires [data-wire-from="0"][data-wire-to="gate:0:2"]'));
  assert.ok(document.querySelector('#pw-wires [data-wire-from="P1"][data-wire-to="output:Y"]'));
  assert.equal($('#pw-next').disabled,false);
  $('#pw-undo').click();notCleared();assert.equal(board().gates[0].ports[2].source,'');
  assert.equal($('#pw-next').disabled,true);connect(socket(0,2),'0');cleared(1);
  next(2);
  assert.equal(document.querySelector(outputSocket('Y')),null,'The first OR must keep the output preconnected without an editing control');

  // OR uses the same single connection action, with cancellation and undo safety.
  connect(socket(0,2),'1');cleared(1);
  closeWithoutChanging(socket(0,2));
  closeWithoutChanging(socket(0,2),true);
  $('#pw-reset').click();notCleared();assert.equal(board().gates[0].ports[2].source,'');
  assert.equal(savedGame().bests.or,1,'Restarting a problem must preserve earned progress');
  $('#pw-undo').click();cleared(1);
  next(3);

  // Connections are edited through buttons and a picker. Future/self references are absent.
  $(socket(0,0)).click();
  assert.equal(dialog().tagName,'DIALOG');assert.ok(dialog().getAttribute('aria-labelledby'));
  assert.equal(document.querySelector('#pw-connect-options [data-connect-source="P1"]'),null);
  assert.equal(document.querySelector('#pw-connect-options [data-connect-source="P2"]'),null);
  assert.equal(document.querySelector('#pw-connect-options [data-connect-source="P3"]'),null);
  assert.equal(document.activeElement,$('#pw-connect-options button'));
  $('#pw-connect-cancel').click();
  $(socket(2,0)).click();
  assert.ok(document.querySelector('#pw-connect-options [data-connect-source="P1"]'));
  assert.ok(document.querySelector('#pw-connect-options [data-connect-source="P2"]'));
  assert.equal(document.querySelector('#pw-connect-options [data-connect-source="P3"]'),null);
  $('#pw-connect-cancel').click();
  ports(1,['A','B','0']);ports(2,['A','B','1']);ports(3,['!P1','P2','0']);cleared(3);
  assert.equal(board().outputs.Y.source,'P3','The introductory XOR output must already be connected');
  assert.equal(board().gates[2].ports[0].inverted,true);
  await flushWires();assert.ok(document.querySelector('#pw-wires .wire-inversion'));
  next(4);

  // Reuse earned parts, open them, then share an internal signal to improve the solution.
  assert.equal(board().outputs.S.source,'P1');assert.equal(board().outputs.C.source,'P2');
  ports(1,['A','B']);ports(2,['A','B']);cleared(4);
  $('[data-expand-gate="0"]').click();cleared(4);
  assert.equal(document.querySelectorAll('.gate-card').length,4);
  output('C','P1');cleared(3);
  $('[data-remove-gate="3"]').click();cleared(3);
  assert.equal(document.querySelectorAll('.gate-card').length,3);
  next(5);

  // The earned-block full adder and direct majority solution must both be accepted.
  assert.equal(board().outputs.S.source,'P2');assert.equal(board().outputs.Cout.source,'P5');
  ports(1,['A','B']);ports(2,['P1','Cin']);ports(3,['A','B']);ports(4,['P1','Cin']);ports(5,['P3','P4']);cleared(9);
  for(let index=4;index>=0;index--)$(`[data-remove-gate="${index}"]`).click();
  assert.equal(document.querySelectorAll('.gate-card').length,0);assert.ok($('.empty-board').textContent.includes('装置'));
  assert.equal($('#pw-undo').disabled,false);
  $('#pw-undo').click();assert.equal(document.querySelectorAll('.gate-card').length,1);
  $('[data-remove-gate="0"]').click();
  $('#pw-part').value='MAJ';$('#pw-part').dispatchEvent(new window.Event('change',{bubbles:true}));
  for(let index=0;index<3;index++)$('#pw-add').click();
  ports(1,['A','B','Cin']);ports(2,['A','B','!Cin']);ports(3,['!P1','P2','Cin']);
  output('S','P3');output('Cout','P1');cleared(3);
  assert.match($('#pw-status').textContent,/最少達成/);assert.equal($('#pw-next').hidden,true);
  assert.equal(document.querySelectorAll('[data-test-row]').length,8);assert.equal(document.querySelectorAll('#pw-table tbody tr').length,8);
  for(let row=0;row<8;row++)$(`[data-test-row="${row}"]`).click();
  assert.ok([...document.querySelectorAll('[data-test-row] .test-result')].every(label=>label.textContent==='正解'));
  assert.equal(board().input,7);
  closeWithoutChanging(outputSocket('Cout'),true);
  $(outputSocket('Cout')).click();$('#pw-disconnect').click();notCleared();
  assert.equal(board().outputs.Cout.source,'');$('#pw-undo').click();cleared(3);
  $('#pw-motion').click();assert.ok($('#parametron-workshop').classList.contains('motion-paused'));

  const saved=window.localStorage.getItem(SAVE_KEY),progress=JSON.parse(saved);
  assert.equal(progress.bests.full,3);assert.equal(progress.bests.half,3);assert.equal(progress.library.XOR.gates.length,3);
  const reloaded=start(saved),reloadedDocument=reloaded.window.document;
  assert.equal(reloadedDocument.querySelector('#pw-level').value,'5');
  assert.match(reloadedDocument.querySelector('#pw-status').textContent,/自己ベスト3個/);
  assert.equal(reloadedDocument.querySelectorAll('.gate-card').length,3);
  assert.ok(reloadedDocument.querySelector('#parametron-workshop').classList.contains('motion-paused'));

  // Existing players retain their work and earned records when early boards gain
  // the new UI's promised A/B/output scaffolding, both on load and cross-tab sync.
  const copy=value=>JSON.parse(JSON.stringify(value));
  const edge=source=>({source,inverted:false});
  const legacyBoard=(third,input)=>({gates:[{type:'MAJ',ports:[edge(''),edge(''),edge(third)]}],outputs:{Y:edge('')},input});
  const legacy=copy(progress);
  legacy.level=1;legacy.boards.and=legacyBoard('1',2);legacy.boards.or=legacyBoard('0',1);
  const migrated=start(JSON.stringify(legacy));
  assert.equal(migrated.window.document.querySelector('#pw-level').value,'1');
  assert.match(migrated.window.document.querySelector(socket(0,0)).textContent,/A/);
  assert.match(migrated.window.document.querySelector(socket(0,1)).textContent,/B/);
  assert.equal(migrated.window.document.querySelector(outputSocket('Y')),null);
  assert.ok(migrated.window.document.querySelector('span.output-terminal[data-sink="output:Y"]'));
  migrated.window.document.querySelector('#pw-motion').click();
  const migrationResult=JSON.parse(migrated.window.localStorage.getItem(SAVE_KEY));
  for(const [id,third,input] of [['and','1',2],['or','0',1]]) {
    const migratedBoard=migrationResult.boards[id];
    assert.deepEqual(migratedBoard.gates[0].ports,[edge('A'),edge('B'),edge(third)],`${id}: migrate only the missing scaffold, not the player's third input`);
    assert.deepEqual(migratedBoard.outputs.Y,edge('P1'));
    assert.equal(migratedBoard.input,input,`${id}: preserve the observed input pattern`);
  }
  assert.deepEqual(migrationResult.bests,progress.bests,'Migration must preserve earned clear records and personal bests');
  assert.deepEqual(migrationResult.library,progress.library,'Migration must preserve the player-built parts');
  assert.deepEqual(migrationResult.boards.full,progress.boards.full,'Migration must not alter later puzzles');

  const emptyLegacy=copy(progress);
  emptyLegacy.level=1;
  emptyLegacy.boards.and={gates:[],outputs:{Y:edge('')},input:3};
  emptyLegacy.boards.or={gates:[],outputs:{Y:edge('')},input:2};
  const emptyReload=start(JSON.stringify(emptyLegacy));
  emptyReload.window.document.querySelector('#pw-motion').click();
  const emptyReloadProgress=JSON.parse(emptyReload.window.localStorage.getItem(SAVE_KEY));
  for(const [id,input] of [['and',3],['or',2]]) {
    assert.equal(emptyReloadProgress.boards[id].gates.length,1,'An old empty board needs a starting device');
    assert.deepEqual(emptyReloadProgress.boards[id].gates[0].ports,[edge('A'),edge('B'),edge('')]);
    assert.deepEqual(emptyReloadProgress.boards[id].outputs.Y,edge('P1'));
    assert.equal(emptyReloadProgress.boards[id].input,input,'Repairing an empty old board must preserve its input pattern');
  }
  assert.deepEqual(emptyReloadProgress.library,progress.library);
  assert.deepEqual(emptyReloadProgress.bests,progress.bests);

  const alreadySolved=copy(progress);
  alreadySolved.level=2;
  alreadySolved.boards.and={gates:[{type:'MAJ',ports:[edge('B'),edge('A'),edge('0')]}],outputs:{Y:edge('P1')},input:3};
  alreadySolved.boards.or={gates:[{type:'MAJ',ports:[edge('B'),edge('A'),edge('1')]}],outputs:{Y:edge('P1')},input:2};
  const solvedReload=start(JSON.stringify(alreadySolved));
  solvedReload.window.document.querySelector('#pw-motion').click();
  const solvedReloadProgress=JSON.parse(solvedReload.window.localStorage.getItem(SAVE_KEY));
  assert.deepEqual(solvedReloadProgress.boards.and,alreadySolved.boards.and,'A completed AND circuit must not be rewired');
  assert.deepEqual(solvedReloadProgress.boards.or,alreadySolved.boards.or,'A completed OR circuit must not be rewired');
  assert.deepEqual(solvedReloadProgress.bests,progress.bests);

  const synced=start(saved),syncLegacy=copy(legacy);
  syncLegacy.level=2;
  const syncJSON=JSON.stringify(syncLegacy);
  synced.window.localStorage.setItem(SAVE_KEY,syncJSON);
  synced.window.dispatchEvent(new synced.window.StorageEvent('storage',{key:'unrelated-setting',newValue:syncJSON}));
  assert.equal(synced.window.document.querySelector('#pw-level').value,'5','Unrelated storage changes must be ignored');
  synced.window.dispatchEvent(new synced.window.StorageEvent('storage',{key:SAVE_KEY,newValue:syncJSON}));
  assert.equal(synced.window.document.querySelector('#pw-level').value,'2');
  assert.equal(synced.window.document.querySelector('#pw-undo').disabled,true,'Cross-tab state replacement must discard stale edit history');
  synced.window.document.querySelector('#pw-motion').click();
  const syncProgress=JSON.parse(synced.window.localStorage.getItem(SAVE_KEY));
  assert.deepEqual(syncProgress.boards.or.gates[0].ports,[edge('A'),edge('B'),edge('0')]);
  assert.deepEqual(syncProgress.boards.or.outputs.Y,edge('P1'));
  assert.equal(syncProgress.boards.or.input,1);
  assert.deepEqual(syncProgress.library,progress.library);
  assert.deepEqual(syncProgress.bests,progress.bests);

  const noStorage=start(null,true),noStorageDocument=noStorage.window.document;
  noStorageDocument.querySelector('[data-toggle-input="B"]').click();
  assert.match(noStorageDocument.querySelector('#pw-storage').textContent,/保存できません/);
  assert.match(noStorageDocument.querySelector('#pw-status').textContent,/出力は1/);
  assert.equal(errors.length,0,errors.map(error=>error.message).join('; '));
  console.log('PASS: DOM playthrough through one-connection AND/OR, socket/picker wiring, legal sources, actual wire elements, earned parts, full-adder optimization to 3 elements, undo/reset, disconnect/cancel/focus, persistence, old-board migration on load/storage, and denied-storage fallback. Native browser keyboard defaults and visual layout require browser verification.');
}
playthrough().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>documents.forEach(dom=>dom.window.close()));
