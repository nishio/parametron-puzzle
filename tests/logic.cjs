const assert=require('node:assert/strict');
(async()=>{
const {levels,freshBoard,evaluate,score,usedCost,allocatedCost,normalizeBoard,normalizeGame,removeGate,expandGate,canConnect}=await import('../editor/src/engine.js');
const edge=text=>({source:text.replace('!',''),inverted:text.startsWith('!')});
const raw=(ports,outputs)=>({gates:ports.map(items=>({type:'MAJ',ports:items.map(edge)})),outputs:Object.fromEntries(Object.entries(outputs).map(([name,source])=>[name,edge(source)])),input:0});
const lookup=id=>levels.find(level=>level.id===id);
const solutions={
  and:raw([['A','B','0']],{Y:'P1'}),
  or:raw([['A','B','1']],{Y:'P1'}),
  xor:raw([['A','B','0'],['A','B','1'],['!P1','P2','0']],{Y:'P3'}),
  half:raw([['A','B','0'],['A','B','1'],['!P1','P2','0']],{S:'P3',C:'P1'}),
  full:raw([['A','B','Cin'],['A','B','!Cin'],['!P1','P2','Cin']],{S:'P3',Cout:'P1'})
};
const library={AND:solutions.and,OR:solutions.or,XOR:solutions.xor};
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
assert.equal(restored.level,5);
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
const xorLower=lowerBound(2,0b0110),fullLower=lowerBound(3,0b10010110);
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
const flowBoard={...moduleFull,flow:{wide:{'gate:0':{x:123,y:456},'gate:1':{x:500,y:22},'output:S':{x:800,y:10},unknown:{x:0,y:0}}}};
const imported=normalizeBoard(lookup('full'),flowBoard,library);
assert.equal(imported.flow.wide.unknown,undefined);
assert.deepEqual(removeGate(imported,0).flow.wide['gate:0'],{x:500,y:22});
assert.deepEqual(normalizeGame({version:2,level:5,introDone:true,library,bests:{and:1,or:1,xor:3,half:4},boards:{full:flowBoard}}).boards.full.flow.wide['gate:0'],{x:123,y:456});

console.log('PASS: all puzzle truth tables, earned blocks, expansion, inversions, removal, progress, and exact 3-node lower bounds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
