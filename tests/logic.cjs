const assert=require('node:assert/strict');
(async()=>{
const {levels,freshBoard,evaluate,score,usedCost,allocatedCost,normalizeBoard,normalizeGame,removeGate,expandGate,canConnect,allowedTypes}=await import('../editor/src/engine.js');
const edge=text=>({source:text.replace('!',''),inverted:text.startsWith('!')});
const raw=(ports,outputs)=>({gates:ports.map(items=>({type:'MAJ',ports:items.map(edge)})),outputs:Object.fromEntries(Object.entries(outputs).map(([name,source])=>[name,edge(source)])),input:0});
const lookup=id=>levels.find(level=>level.id===id);
const solutions={
  and:raw([['A','B','0']],{Y:'P1'}),
  or:raw([['A','B','1']],{Y:'P1'}),
  xor:raw([['A','B','0'],['A','B','1'],['!P1','P2','0']],{Y:'P3'}),
  half:raw([['A','B','0'],['A','B','1'],['!P1','P2','0']],{S:'P3',C:'P1'}),
  full:raw([['A','B','Cin'],['A','B','!Cin'],['!P1','P2','Cin']],{S:'P3',Cout:'P1'}),
  mux:raw([['A','!S','0'],['B','S','0'],['P1','P2','1']],{Y:'P3'})
};
const library={AND:solutions.and,OR:solutions.or,XOR:solutions.xor};
assert.deepEqual(allowedTypes(lookup('xor'),{AND:library.AND,OR:library.OR}),['MAJ','AND','OR'],'Earned AND/OR blueprints must already be available in the XOR puzzle');
const {materializeBoard,placeBlueprint,ungroupBlueprint}=await import('../editor/src/blueprints.js');
const twistLesson=freshBoard(lookup('twist'));
assert.equal(score(lookup('twist'),twistLesson,library).clear,false);
twistLesson.gates[0].ports[1].inverted=true;
assert.deepEqual([0,1,2,3].map(row=>evaluate(lookup('twist'),twistLesson,row,library).outputs.Y),[0,0,1,0]);
assert.equal(score(lookup('twist'),twistLesson,library).clear,true);
const tutorialSave=normalizeGame({version:2,level:6,levelId:'twist',introDone:true,library,bests:{and:1,or:1},boards:{twist:twistLesson}});
assert.equal(tutorialSave.level,3,'Chapter IDs must take precedence over old numeric positions');
assert.equal(tutorialSave.boards.twist.gates[0].ports[1].inverted,true);
const oldTwist=normalizeBoard(lookup('twist'),raw([['!A','0','1']],{Y:'P1'}),library);
assert.equal(score(lookup('twist'),oldTwist,library).clear,true,'Previous NOT lesson progress must migrate to the new two-input lesson');
for (const id of ['xor','half','mux']) {
  const empty=freshBoard(lookup(id),library);
  assert.equal(empty.gates.length,0,'Challenges must start without placed elements');
  assert.ok(Object.values(empty.outputs).every(port=>port.source===''));
}
let rows=0;
for(const [id,board] of Object.entries(solutions)) {
  const level=lookup(id),result=score(level,board,library);
  assert.ok(result.clear,`${id} must be solvable`);
  assert.equal(result.cost,level.minimum);
  assert.deepEqual(normalizeBoard(level,board,library),board);
  for(let row=0;row<2**level.inputs.length;row++) {
    const inputs=level.inputs.map((_,i)=>(row>>(level.inputs.length-1-i))&1);
    assert.deepEqual(evaluate(level,board,row,library).outputs,level.target(inputs));rows++;
  }
}
const moduleFull={gates:[
  {type:'XOR',ports:['A','B'].map(edge)},
  {type:'XOR',ports:['P1','Cin'].map(edge)},
  {type:'AND',ports:['A','B'].map(edge)},
  {type:'AND',ports:['P1','Cin'].map(edge)},
  {type:'OR',ports:['P3','P4'].map(edge)}
],outputs:{S:edge('P2'),Cout:edge('P5')},input:0};
const moduleHalf={gates:[{type:'XOR',ports:['A','B'].map(edge)},{type:'AND',ports:['A','B'].map(edge)}],outputs:{S:edge('P1'),C:edge('P2')},input:0};
assert.equal(score(lookup('half'),moduleHalf,library).clear,true);
assert.equal(usedCost(moduleHalf,library),4);
assert.equal(score(lookup('full'),moduleFull,library).clear,true);
assert.equal(usedCost(moduleFull,library),9,'Composite blocks must be charged by physical element count');
let expanded=moduleFull;
for(let index=0;index<expanded.gates.length;index++)if(expanded.gates[index].type!=='MAJ') {
  const next=expandGate(expanded,index,library);
  assert.equal(allocatedCost(next,library),9);
  for(let row=0;row<8;row++)assert.deepEqual(evaluate(lookup('full'),next,row,library).outputs,evaluate(lookup('full'),moduleFull,row,library).outputs,'Expansion must preserve both outputs and fanout');
  expanded=next;
}
assert.equal(expanded.gates.length,9);
assert.ok(expanded.gates.every(gate=>gate.type==='MAJ'));
const invertedModule={gates:[{type:'XOR',ports:['!A','B'].map(edge)}],outputs:{Y:edge('!P1')},input:0};
const invertedLibrary={...library,XOR:{...solutions.xor,outputs:{Y:edge('!P3')}}};
for(let row=0;row<4;row++)assert.deepEqual(evaluate(lookup('xor'),expandGate(invertedModule,0,invertedLibrary),row,invertedLibrary).outputs,evaluate(lookup('xor'),invertedModule,row,invertedLibrary).outputs,'Input, internal, and output inversions must compose');
const removed=removeGate(moduleFull,0);
assert.equal(removed.gates[0].ports[0].source,'');
assert.equal(removed.gates[2].ports[0].source,'');
assert.equal(removed.outputs.S.source,'P1');
assert.equal(removed.outputs.Cout.source,'P4');
assert.equal(score(lookup('full'),removed,library).clear,false);
const invalid=normalizeBoard(lookup('xor'),raw([['P1','P99','A']],{Y:'P4'}),library);
assert.equal(invalid.gates[0].ports[0].source,'');
assert.equal(invalid.gates[0].ports[1].source,'');
assert.equal(invalid.outputs.Y.source,'');
assert.equal(score(lookup('xor'),invalid,library).clear,false);
assert.equal(score(lookup('and'),freshBoard(lookup('and')),library).incomplete,true);
const intro=freshBoard(levels[0]);
assert.equal(evaluate(levels[0],intro,6,library).outputs.Y,1);
assert.equal(evaluate(levels[0],intro,1,library).outputs.Y,0);
const restored=normalizeGame({version:2,level:5,introDone:true,library,bests:{and:1,or:1,xor:3,half:4},boards:{full:moduleFull}});
assert.equal(restored.level,7);
assert.equal(restored.levelId,'full');
assert.deepEqual(restored.onboarding,{welcomeDone:true,majorityDone:true,firstWireDone:true},'Returning players must retain progress without being forced through onboarding');
assert.deepEqual(normalizeGame(null).onboarding,{welcomeDone:false,majorityDone:false,firstWireDone:false});
const partialGuide=normalizeGame({version:2,levelId:'intro',onboarding:{welcomeDone:true,majorityDone:true},boards:{intro:freshBoard(lookup('intro'))}});
assert.equal(partialGuide.onboarding.welcomeDone,true);
assert.equal(partialGuide.onboarding.majorityDone,true);
assert.equal(restored.bests.twist,1,'Existing advanced progress must survive insertion of a new tutorial');
assert.equal(score(lookup('full'),restored.boards.full,restored.library).clear,true);
assert.equal(normalizeGame({version:1,level:5}).level,0);
assert.equal(normalizeGame({version:2,level:5}).level,0);
// Exact lower bound: enumerate every network of zero, one, or two MAJ3 nodes,
// allowing constants, repeated inputs, arbitrary input/edge/output inversions,
// and arbitrary fanout. If parity is absent, full addition cannot use <3 nodes.
function lowerBound(variables,target) {
  const mask=(1<<(1<<variables))-1;
  const base=new Set([0,mask]);
  for(let input=0;input<variables;input++) {
    let value=0;
    for(let row=0;row<1<<variables;row++)value|=((row>>(variables-1-input))&1)<<row;
    base.add(value);base.add(value^mask);
  }
  const results=signals=>{
    const values=[...signals],found=new Set();
    for(let a=0;a<values.length;a++)for(let b=a;b<values.length;b++)for(let c=b;c<values.length;c++) {
      const value=(values[a]&values[b])|(values[a]&values[c])|(values[b]&values[c]);
      found.add(value);found.add(value^mask);
    }
    return found;
  };
  assert.ok(!base.has(target));
  const first=results(base);assert.ok(!first.has(target));
  let networks=0;
  for(const value of first) {
    const second=results(new Set([...base,value,value^mask]));
    assert.ok(!second.has(target),`Parity unexpectedly reachable with two nodes: ${variables} variables`);
    networks+=second.size;
  }
  return {firstFunctions:first.size,secondFunctionsAcrossFirstChoices:networks};
}
const xorLower=lowerBound(2,0b0110),fullLower=lowerBound(3,0b10010110),muxLower=lowerBound(3,0b10101100);
const backwards=raw([['P2','A','0'],['A','B','0']],{Y:'P1'});
for(let row=0;row<4;row++)assert.equal(evaluate(lookup('and'),backwards,row,library).outputs.Y,+(row===3),'The circuit must work independently of node creation order');
assert.equal(canConnect(backwards,'P1',1),false,'A dependency cycle must be rejected');
assert.equal(canConnect(backwards,'P2',0),true);
const cyclic=normalizeBoard(lookup('xor'),raw([['P2','A','0'],['P1','B','0']],{Y:'P1'}),library);
assert.ok(cyclic.gates.some(gate=>gate.ports.some(edge=>!edge.source)),'A cycle in imported data must be disconnected');
assert.equal(evaluate(lookup('xor'),cyclic,3,library).outputs.Y,null);
const oldGame=normalizeGame({version:2,level:1,introDone:true,boards:{and:raw([['','','']],{Y:''})}});
assert.deepEqual(oldGame.boards.and.gates[0].ports.slice(0,2).map(edge=>edge.source),['A','B']);
assert.equal(oldGame.boards.and.outputs.Y.source,'P1');
const flowBoard={...solutions.full,flow:{wide:{'gate:0':{x:123,y:456},'gate:1':{x:500,y:22},'output:S':{x:800,y:10},unknown:{x:0,y:0}}}};
const imported=normalizeBoard(lookup('full'),flowBoard,library);
assert.equal(imported.flow.wide.unknown,undefined);
assert.deepEqual(removeGate(imported,0).flow.wide['gate:0'],{x:500,y:22});
assert.deepEqual(normalizeGame({version:2,level:5,introDone:true,library,bests:{and:1,or:1,xor:3,half:4},boards:{full:flowBoard}}).boards.full.flow.wide['gate:0'],{x:123,y:456});
const legacyFixed={...solutions.and,flow:{blueprintWide:{constants:{x:250,y:300}}}};
const splitFixed=normalizeBoard(lookup('and'),legacyFixed,library);
assert.deepEqual(splitFixed.flow.blueprintWide['constant:0'],{x:250,y:300});
assert.deepEqual(splitFixed.flow.blueprintWide['constant:1'],{x:250,y:364});
assert.equal(splitFixed.flow.blueprintWide.constants,undefined);
assert.equal(score(lookup('and'),splitFixed,library).clear,true,'Splitting fixed sources must preserve existing connections');

// A placed blueprint is an editable copy of the user's actual saved netlist.
const migrated=normalizeBoard(lookup('full'),moduleFull,library);
assert.equal(migrated.gates.length,9);
assert.equal(migrated.blueprints.length,5);
assert.ok(migrated.gates.every(gate=>gate.type==='MAJ'));
assert.equal(score(lookup('full'),migrated,{}).clear,true,'Placed circuits must run without a blueprint library or logic-gate primitives');
const placed=placeBlueprint({gates:[],outputs:{Y:edge('')},input:0},'XOR',library);
assert.equal(placed.gates.length,3);
assert.ok(placed.gates.every(gate=>gate.type==='MAJ'&&gate.ports.length===3));
assert.equal(placed.gates[0].ports[2].source,'0');
assert.equal(placed.gates[1].ports[2].source,'1');
assert.equal(placed.gates[0].ports[2].fixed,true);
assert.equal(placed.gates[1].ports[2].fixed,true);
assert.equal(placed.gates[2].ports[0].inverted,true);
placed.gates.forEach(gate=>gate.ports.forEach(port=>{if(port.socket)port.source=port.socket;}));
placed.outputs.Y={...placed.blueprints[0].output};
assert.equal(score(lookup('xor'),placed,{}).clear,true);
const ungrouped=ungroupBlueprint(placed,placed.blueprints[0].id);
assert.deepEqual(ungrouped.gates,placed.gates);
assert.deepEqual(ungrouped.outputs,placed.outputs);
assert.equal(score(lookup('xor'),ungrouped,{}).clear,true);
assert.equal(normalizeBoard(lookup('xor'),ungrouped,library).gates[0].ports[2].fixed,true,'Local constants must survive save/reload after removing the blueprint frame');
for (const [name, bit] of [['AND','0'],['OR','1']]) {
  const stamp=placeBlueprint({gates:[],outputs:{Y:edge('')},input:0},name,library);
  assert.equal(stamp.gates.length,1);
  assert.equal(stamp.gates[0].type,'MAJ');
  assert.equal(stamp.gates[0].ports[2].source,bit);
  assert.equal(stamp.gates[0].ports[2].fixed,true,'AND/OR stamps must contain a local constant, requiring no external cable');
  stamp.gates[0].ports.forEach(port=>{if(port.socket)port.source=port.socket;});
  stamp.outputs.Y={...stamp.blueprints[0].output};
  assert.equal(score(lookup(name.toLowerCase()),stamp,{}).clear,true);
  const legacy=JSON.parse(JSON.stringify(stamp));
  delete legacy.gates[0].ports[2].fixed;
  assert.equal(normalizeBoard(lookup('xor'),legacy,library).gates[0].ports[2].fixed,true,'Existing saved blueprint instances must gain local constant inputs');
}
const second=placeBlueprint(placed,'XOR',library);
second.gates[3].ports[2].source='1';
assert.equal(second.gates[0].ports[2].source,'0','Blueprint instances must be independent');
assert.equal(library.XOR.gates[0].ports[2].source,'0','Placement must not mutate the saved blueprint');
const {removeBlueprint}=await import('../editor/src/engine.js');
const without=removeBlueprint(second,placed.blueprints[0].id);
assert.equal(without.gates.length,3);
assert.equal(without.outputs.Y.source,'');
assert.deepEqual(without.blueprints[0].gates,[0,1,2]);
assert.ok(freshBoard(lookup('full'),library).gates.every(gate=>gate.type==='MAJ'));
assert.equal(freshBoard(lookup('full'),library).gates.length,9);
const alternative=raw([['!P2','P3','0'],['A','B','0'],['A','B','1']],{Y:'P1'});
const alternativeStamp=placeBlueprint({gates:[],outputs:{Y:edge('')},input:0},'XOR',{XOR:alternative});
alternativeStamp.gates.forEach(gate=>gate.ports.forEach(port=>{if(port.socket)port.source=port.socket;}));
alternativeStamp.outputs.Y={...alternativeStamp.blueprints[0].output};
assert.equal(alternativeStamp.gates[0].ports[0].source,'P2','The user\'s own circuit topology must be copied, including references to later-created nodes');
assert.equal(score(lookup('xor'),alternativeStamp,{}).clear,true);

console.log('PASS: all puzzle truth tables, earned blocks, expansion, inversions, removal, progress, and exact 3-node lower bounds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
