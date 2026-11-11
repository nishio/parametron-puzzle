
(() => {
  const VERSION = 2;
  const levels = [
    {id:'intro',name:'00 · 多数決を観察',inputs:['A','B','C'],outputs:['Y'],budget:1,minimum:1,demo:true,title:'3つのうち、多いほうが出力になる',lesson:'パラメトロンは、同じ強さの3つの入力の多数決をとります。入力を押して、0が2つなら0、1が2つなら1になる様子を確かめよう。',target:([a,b,c])=>({Y:+(a+b+c>=2)})},
    {id:'and',name:'01 · AND / 1素子',inputs:['A','B'],outputs:['Y'],budget:1,minimum:1,reward:'AND',title:'1個のパラメトロンでANDを作ろう',lesson:'AとBが両方1のときだけ、Yを1にします。3つの入力には、A・Bのほかに定数0や1もつなげます。',target:([a,b])=>({Y:a&b})},
    {id:'or',name:'02 · OR / 1素子',inputs:['A','B'],outputs:['Y'],budget:1,minimum:1,reward:'OR',title:'1個のパラメトロンでORを作ろう',lesson:'AとBの少なくとも一方が1なら、Yを1にします。できた回路は、あとで部品として再利用できます。',target:([a,b])=>({Y:a|b})},
    {id:'xor',name:'03 · XOR / 3素子',inputs:['A','B'],outputs:['Y'],budget:3,minimum:3,reward:'XOR',invert:true,title:'3個のパラメトロンでXORを作ろう',lesson:'AとBが異なるときだけ、Yを1にします。P1などの出力を次の素子につなぎ、「反転」で0と1を入れ替えられます。',target:([a,b])=>({Y:a^b})},
    {id:'half',name:'04 · 半加算器 / 4素子以内',inputs:['A','B'],outputs:['S','C'],budget:4,minimum:3,parts:true,invert:true,title:'作った部品を組み合わせて、半加算器に',lesson:'A+Bの下位ビットをS、繰り上がりをCに出そう。XORとANDを再利用できます。「展開」で部品の中の配線も編集できます。',target:([a,b])=>({S:(a+b)%2,C:+(a+b>=2)})},
    {id:'full',name:'05 · 全加算器 / 9素子以内',inputs:['A','B','Cin'],outputs:['S','Cout'],budget:9,minimum:3,parts:true,invert:true,title:'全加算器を作り、さらに素子を減らそう',lesson:'A+B+Cinの下位ビットをS、繰り上がりをCoutに出そう。部品の組み合わせでもクリア。多数決を直接使ったり、配線を共有したりして素子数の自己ベストを縮めよう。',target:([a,b,c])=>({S:(a+b+c)%2,Cout:+(a+b+c>=2)})}
  ];
  const blankEdge = () => ({source:'',inverted:false});
  const clone = value => JSON.parse(JSON.stringify(value));
  const arity = type => type==='MAJ' ? 3 : 2;
  const blankGate = (type='MAJ') => ({type,ports:Array.from({length:arity(type)},blankEdge)});
  const freshBoard = level => {
    const types = level.id==='xor' ? ['MAJ','MAJ','MAJ'] : level.id==='half' ? ['XOR','AND'] : level.id==='full' ? ['XOR','XOR','AND','AND','OR'] : ['MAJ'];
    const board = {gates:types.map(blankGate),outputs:Object.fromEntries(level.outputs.map(name=>[name,blankEdge()])),input:0};
    if(level.demo) { board.gates[0].ports=level.inputs.map(source=>({source,inverted:false})); board.outputs.Y={source:'P1',inverted:false}; board.input=4; }
    if(level.id==='and'||level.id==='or') {
      board.gates[0].ports[0]={source:'A',inverted:false};
      board.gates[0].ports[1]={source:'B',inverted:false};
      board.outputs.Y={source:'P1',inverted:false};
    }
    if(level.id==='xor')board.outputs.Y={source:'P3',inverted:false};
    if(level.id==='half'){board.outputs.S={source:'P1',inverted:false};board.outputs.C={source:'P2',inverted:false};}
    if(level.id==='full'){board.outputs.S={source:'P2',inverted:false};board.outputs.Cout={source:'P5',inverted:false};}
    return board;
  };
  const majority = (a,b,c) => +(a+b+c>=2);
  function readEdge(edge,values) {
    const value=values[edge.source];
    return value===0 || value===1 ? (edge.inverted ? 1-value : value) : null;
  }
  function evaluate(level,board,row,library={}) {
    const values={'0':0,'1':1};
    level.inputs.forEach((name,i)=>{values[name]=(row>>(level.inputs.length-1-i))&1;});
    board.gates.forEach((gate,i)=>{
      const inputs=gate.ports.map(edge=>readEdge(edge,values));
      let value=null;
      if(inputs.every(v=>v!==null)) {
        if(gate.type==='MAJ') value=majority(...inputs);
        else if(library[gate.type]) {
          const inner=library[gate.type];
          value=evaluate({inputs:['A','B'],outputs:['Y']},inner,inputs[0]*2+inputs[1],{}).outputs.Y;
        }
      }
      values['P'+(i+1)]=value;
    });
    return {values,outputs:Object.fromEntries(level.outputs.map(name=>[name,readEdge(board.outputs[name],values)]))};
  }
  function usedNodes(board) {
    const used=new Set();
    function visit(source) {
      if(!/^P[1-9][0-9]*$/.test(source)||used.has(source)) return;
      const gate=board.gates[Number(source.slice(1))-1];
      if(!gate) return;
      used.add(source); gate.ports.forEach(edge=>visit(edge.source));
    }
    Object.values(board.outputs).forEach(edge=>visit(edge.source));
    return used;
  }
  const partCost = (type,library) => type==='MAJ' ? 1 : library[type] ? usedNodes(library[type]).size : Infinity;
  const allocatedCost = (board,library) => board.gates.reduce((sum,gate)=>sum+partCost(gate.type,library),0);
  const usedCost = (board,library) => [...usedNodes(board)].reduce((sum,name)=>sum+partCost(board.gates[Number(name.slice(1))-1].type,library),0);
  function score(level,board,library) {
    let matched=0,incomplete=false;
    const total=2**level.inputs.length;
    for(let row=0;row<total;row++) {
      const inputs=level.inputs.map((_,i)=>(row>>(level.inputs.length-1-i))&1);
      const expected=level.target(inputs),actual=evaluate(level,board,row,library).outputs;
      if(level.outputs.some(name=>actual[name]===null)) incomplete=true;
      if(level.outputs.every(name=>actual[name]===expected[name])) matched++;
    }
    const cost=usedCost(board,library);
    return {matched,total,incomplete,cost,clear:matched===total&&cost<=level.budget&&allocatedCost(board,library)<=level.budget};
  }
  function allowedTypes(level,library) { return ['MAJ',...(level.parts?['AND','OR','XOR'].filter(type=>library[type]):[])]; }
  function normalizeBoard(level,candidate,library={}) {
    if(level.demo) { const board=freshBoard(level); if(Number.isInteger(candidate?.input)) board.input=Math.max(0,Math.min(7,candidate.input)); return board; }
    const fallback=()=>{const board=freshBoard(level); if(allocatedCost(board,library)>level.budget) board.gates=[blankGate()]; return board;};
    if(!candidate||!Array.isArray(candidate.gates)||candidate.gates.length>level.budget) return fallback();
    const types=allowedTypes(level,library);
    const normalizeEdge=(value,choices)=>({source:choices.includes(value?.source)?value.source:'',inverted:level.invert===true&&value?.inverted===true});
    const base=['','0','1',...level.inputs];
    const gates=candidate.gates.map((gate,i)=>{
      const type=types.includes(gate?.type)?gate.type:'MAJ';
      const choices=[...base,...Array.from({length:i},(_,n)=>'P'+(n+1))];
      return {type,ports:Array.from({length:arity(type)},(_,p)=>normalizeEdge(gate?.ports?.[p],choices))};
    });
    const choices=[...base,...gates.map((_,i)=>'P'+(i+1))];
    const outputs=Object.fromEntries(level.outputs.map(name=>[name,normalizeEdge(candidate.outputs?.[name],choices)]));
    const board={gates,outputs,input:Number.isInteger(candidate.input)?Math.max(0,Math.min(2**level.inputs.length-1,candidate.input)):0};
    if(candidate.layout&&typeof candidate.layout==='object'){
      board.layout={};
      for(const mode of ['wide','narrow'])if(Array.isArray(candidate.layout[mode])){
        board.layout[mode]=gates.map((_,i)=>{
          const point=candidate.layout[mode][i];
          return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:Math.max(0,Math.min(1,point.x)),y:Math.max(0,Math.min(8192,point.y))}:null;
        });
      }
    }
    return allocatedCost(board,library)<=level.budget?board:fallback();
  }
  function removeGate(board,index) {
    const result=clone(board),removed='P'+(index+1);
    const map=edge=>{
      if(edge.source===removed) return blankEdge();
      if(/^P[1-9][0-9]*$/.test(edge.source)&&Number(edge.source.slice(1))>index+1) return {...edge,source:'P'+(Number(edge.source.slice(1))-1)};
      return edge;
    };
    result.gates.splice(index,1);
    if(result.layout)for(const positions of Object.values(result.layout))positions.splice(index,1);
    result.gates.forEach(gate=>{gate.ports=gate.ports.map(map);});
    Object.keys(result.outputs).forEach(name=>{result.outputs[name]=map(result.outputs[name]);});
    return result;
  }
  function expandGate(board,index,library) {
    const part=library[board.gates[index]?.type];
    if(!part) return clone(board);
    const gates=[],mapping={};
    const mapEdge=(edge,map)=>{
      const replacement=map[edge.source]||{source:edge.source,inverted:false};
      return {source:replacement.source,inverted:replacement.inverted!==edge.inverted};
    };
    board.gates.forEach((gate,i)=>{
      if(i!==index) {
        gates.push({type:gate.type,ports:gate.ports.map(edge=>mapEdge(edge,mapping))});
        mapping['P'+(i+1)]={source:'P'+gates.length,inverted:false};
      } else {
        const innerMap={A:mapEdge(gate.ports[0],mapping),B:mapEdge(gate.ports[1],mapping)};
        part.gates.forEach((inner,j)=>{
          gates.push({type:'MAJ',ports:inner.ports.map(edge=>mapEdge(edge,innerMap))});
          innerMap['P'+(j+1)]={source:'P'+gates.length,inverted:false};
        });
        mapping['P'+(i+1)]=mapEdge(part.outputs.Y,innerMap);
      }
    });
    const result={gates,outputs:Object.fromEntries(Object.entries(board.outputs).map(([name,edge])=>[name,mapEdge(edge,mapping)])),input:board.input};
    if(board.layout){
      result.layout=clone(board.layout);
      for(const positions of Object.values(result.layout)){
        const origin=positions[index];
        positions.splice(index,1,...part.gates.map((_,i)=>origin?{x:origin.x,y:Math.min(8192,origin.y+i*280)}:null));
      }
    }
    return result;
  }
  function normalizeGame(candidate) {
    const game={version:VERSION,level:0,introDone:false,boards:{},library:{},bests:{},motion:true};
    if(candidate?.version!==VERSION) return game;
    game.introDone=candidate.introDone===true; game.motion=candidate.motion!==false;
    for(const level of levels.filter(item=>item.reward)) {
      const part=normalizeBoard(level,candidate.library?.[level.reward],{});
      if(score(level,part,{}).clear) game.library[level.reward]=part;
    }
    for(const level of levels) {
      if(candidate.boards?.[level.id]) game.boards[level.id]=normalizeBoard(level,candidate.boards[level.id],game.library);
      const best=candidate.bests?.[level.id];
      if(Number.isInteger(best)&&best>=level.minimum&&best<=level.budget) game.bests[level.id]=best;
      if(level.reward&&!game.library[level.reward]) delete game.bests[level.id];
    }
    const unlocked=index=>index===0||(index===1?game.introDone:game.bests[levels[index-1].id]!==undefined);
    if(Number.isInteger(candidate.level)&&levels[candidate.level]&&unlocked(candidate.level)) game.level=candidate.level;
    return game;
  }
  // UI
  const root=document.getElementById('parametron-workshop');
  const $=selector=>root.querySelector(selector);
  const SAVE_KEY='parametron-puzzle:v2';
  const copy={
    intro:{title:'まずは、3つの信号の多数決。',lesson:'信号は「0」か「1」。丸い装置は3本の信号を受け取り、多いほうを出します。まずBのスイッチを押してみよう。',goal:'0が2票なら0。1が2票なら1。',short:'多数決'},
    and:{title:'ふたつとも1のときだけ、1にしよう。',lesson:'これがANDの回路です。A・Bと出力はつないであります。空いている「入力3」を押して、残りの1本を選ぼう。',goal:'AとBが両方1 → 出力1。それ以外 → 出力0。',short:'AND'},
    or:{title:'どちらかが1なら、1にしよう。',lesson:'これがORの回路です。ANDと同じ装置を使います。空いている「入力3」につなぐ信号を変えると、動きも変わります。',goal:'AかBのどちらかが1 → 出力1。両方0 → 出力0。',short:'OR'},
    xor:{title:'違っているときだけ、1にしよう。',lesson:'これがXORです。3個の装置の入力をつなごう。装置の出力も次の装置に使えます。「反転する」は0と1を入れ替える配線です。',goal:'AとBが違う → 出力1。同じ → 出力0。',short:'XOR'},
    half:{title:'作った部品で、1 + 1を計算しよう。',lesson:'XORとANDを部品として使えます。1 + 1 = 2は、2進数では10。「1の位」が0、「2の位」が1になります。',goal:'Sは1の位、Cは2の位。2本の出力でA + Bを表そう。',short:'半加算器'},
    full:{title:'3つの入力を足す回路を作ろう。',lesson:'A + B + Cinを計算します。Cinは前の桁から来た1。まず部品で完成させよう。「中を開く」で配線を見直すと、さらに装置を減らせます。',goal:'Sは1の位、Coutは2の位。たとえば1 + 1 + 1 = 3は「11」。',short:'全加算器'}
  };
  function loadGame(){try{return normalizeGame(JSON.parse(localStorage.getItem(SAVE_KEY)));}catch(_){return normalizeGame(null);}}
  let game=loadGame();
  // Keep earned parts and records while giving old, unfinished introductory boards
  // the same pre-wired starting point promised by the new instructions.
  function migrateStartingBoards(){
    for(const id of ['and','or']){
      const board=game.boards[id];
      if(!board)continue;
      const level=levels.find(item=>item.id===id);
      if(score(level,board,game.library).clear)continue;
      if(board.gates.length!==1||board.gates[0].type!=='MAJ'){
        game.boards[id]=freshBoard(level);game.boards[id].input=board.input;continue;
      }
      board.gates[0].ports[0]={source:'A',inverted:false};
      board.gates[0].ports[1]={source:'B',inverted:false};
      board.outputs.Y={source:'P1',inverted:false};
    }
  }
  migrateStartingBoards();
  const history={};
  const hints={};
  let target=null;
  let drawFrame=null;
  let notice='';
  let traceSink=null;
  let moveTarget=null;
  let drag=null;
  let suppressDragClick=false;
  let placements=[];
  let layoutWidth=0;
  let scrollFrame=null;
  const currentLevel=()=>levels[game.level];
  const currentBoard=()=>game.boards[currentLevel().id]||(game.boards[currentLevel().id]=freshBoard(currentLevel()));
  const unlocked=index=>index===0||(index===1?game.introDone:game.bests[levels[index-1].id]!==undefined);
  const valueText=value=>value===0||value===1?String(value):'?';
  const valueAttr=value=>value===0||value===1?String(value):'unknown';
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const outputName=name=>name==='S'?'1の位':name==='C'||name==='Cout'?'2の位':'出力';
  const sourceName=source=>source==='0'?'いつも0':source==='1'?'いつも1':/^P/.test(source)?source+'の出力':source==='Cin'?'Cin（前の桁からの1）':source;
  function save(){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));$('#pw-storage').textContent='進捗はこのブラウザに自動保存されます。';}
    catch(_){$('#pw-storage').textContent='進捗を保存できません。このページを開いている間は遊べます。';}
  }
  function wave(value){
    const baseline='<line x1="0" y1="12" x2="64" y2="12"/>';
    if(value!==0&&value!==1)return `<span class="wave" data-value="unknown" aria-hidden="true"><svg viewBox="0 0 64 24">${baseline}</svg></span>`;
    const points=Array.from({length:129},(_,x)=>`${x?'L':'M'}${x} ${(12+(value===1?-1:1)*7*Math.sin(x*Math.PI/24)).toFixed(3)}`).join(' ');
    return `<span class="wave" data-value="${value}" aria-hidden="true"><svg viewBox="0 0 64 24">${baseline}<g class="wave-motion"><path d="${points}"/></g></svg></span>`;
  }
  function sources(count){return ['0','1',...currentLevel().inputs,...Array.from({length:count},(_,i)=>'P'+(i+1))];}
  function edgeAt(destination){return destination.kind==='gate'?currentBoard().gates[destination.index]?.ports[destination.port]:currentBoard().outputs[destination.name];}
  const sinkId=destination=>destination.kind==='gate'?`gate:${destination.index}:${destination.port}`:`output:${destination.name}`;
  const targetName=destination=>destination.kind==='gate'?`P${destination.index+1}の入力${destination.port+1}`:`${destination.name}（${outputName(destination.name)}）`;
  function focusSink(destination){root.querySelector(`[data-sink="${sinkId(destination)}"]`)?.focus();}
  function closePicker(){
    const dialog=$('#pw-connect-dialog');
    if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
    root.querySelectorAll('.is-target').forEach(node=>node.classList.remove('is-target'));
    const previous=target;target=null;if(previous)focusSink(previous);
  }
  function openPicker(destination){
    const edge=edgeAt(destination);if(!edge)return;
    target=destination;
    const observed=evaluate(currentLevel(),currentBoard(),currentBoard().input,game.library);
    $('#pw-connect-title').textContent=targetName(destination)+'に、何をつなぐ？';
    $('#pw-connect-invert').checked=edge.inverted;
    $('#pw-connect-invert').closest('label').hidden=!currentLevel().invert;
    $('#pw-disconnect').disabled=!edge.source;
    const options=sources(destination.kind==='gate'?destination.index:currentBoard().gates.length);
    $('#pw-connect-options').innerHTML=options.map(source=>`<button type="button" class="source-choice${source===edge.source?' is-current':''}" data-connect-source="${source}" data-value="${valueAttr(observed.values[source])}" aria-label="${escape(sourceName(source))}を${escape(targetName(destination))}につなぐ"><span class="choice-name">${escape(sourceName(source))}</span><span class="choice-description">${source==='0'||source==='1'?'入力が変わっても一定':'いまの信号 '+valueText(observed.values[source])}</span><span class="signal-value">${valueText(observed.values[source])}</span></button>`).join('');
    root.querySelector(`[data-sink="${sinkId(destination)}"]`)?.classList.add('is-target');
    const dialog=$('#pw-connect-dialog');
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    $('#pw-connect-options').querySelector('button')?.focus();
  }
  function edit(mutator,message=''){
    const id=currentLevel().id;
    const wasClear=score(currentLevel(),currentBoard(),game.library).clear;
    (history[id]||(history[id]=[])).push(clone(currentBoard()));
    if(history[id].length>30)history[id].shift();
    const result=mutator(currentBoard());if(result)game.boards[id]=result;
    notice=message;render();save();
    if(!wasClear&&score(currentLevel(),currentBoard(),game.library).clear){
      const success=game.level===levels.length-1?$('#pw-status'):$('#pw-next');
      success.scrollIntoView?.({block:'nearest',behavior:'instant'});
    }
  }
  function testRow(level,row){return level.inputs.map((_,i)=>(row>>(level.inputs.length-1-i))&1);}
  function nextEmpty(board){
    for(let index=0;index<board.gates.length;index++)for(let port=0;port<board.gates[index].ports.length;port++)if(!board.gates[index].ports[port].source)return {kind:'gate',index,port};
    for(const name of currentLevel().outputs)if(!board.outputs[name].source)return {kind:'output',name};
    return null;
  }
  function guide(result){
    const level=currentLevel(),board=currentBoard();
    if(level.demo)return 'スイッチは押すたびに0と1が切り替わります。Bを1にすると、出力はどうなる？';
    if(result.clear)return result.cost>level.minimum?'完成！ 次へ進めます。配線を工夫して、装置を減らすこともできます。':'完成！ すべての入力の組み合わせで正しく動きました。';
    const empty=nextEmpty(board);
    if(empty)return `次の一手：${targetName(empty)}の「つなぐ」を押して、つなぐ信号を選ぼう。`;
    for(let row=0;row<result.total;row++){
      const expected=level.target(testRow(level,row)),actual=evaluate(level,board,row,game.library).outputs;
      const bad=level.outputs.find(name=>expected[name]!==actual[name]);
      if(bad)return `${level.inputs.map((name,i)=>name+'='+testRow(level,row)[i]).join('、')}のとき、${bad}の正解は${expected[bad]}、いまは${valueText(actual[bad])}。下のテストを押して、この場合の信号を追ってみよう。`;
    }
    return '入力のスイッチを切り替えて、動きを確かめよう。';
  }
  function socket(destination,edge,values,editable=true){
    const label=destination.kind==='gate'?`入力${destination.port+1}`:`${destination.name} · ${outputName(destination.name)}`;
    const attrs=destination.kind==='gate'?`data-gate-index="${destination.index}" data-port-index="${destination.port}"`:`data-output="${destination.name}"`;
    const value=readEdge(edge,values);
    return `<button type="button" class="socket${edge.source?'':' is-empty'}" data-sink="${sinkId(destination)}" ${attrs} data-value="${valueAttr(value)}" aria-label="${escape(targetName(destination))}をつなぐ" ${editable?'':'disabled'}><span class="socket-dot" aria-hidden="true"></span><span class="socket-content"><span class="socket-label">${escape(label)}</span><span class="socket-source">${edge.source?escape(sourceName(edge.source))+(edge.inverted?'（反転）':''):'つなぐ'}</span></span><span class="socket-value">${valueText(value)}</span></button>`;
  }
  function render(){
    const level=currentLevel(),board=currentBoard(),info=copy[level.id],observed=evaluate(level,board,board.input,game.library),result=score(level,board,game.library);
    let learned='';
    if(!level.demo&&result.clear){
      game.bests[level.id]=Math.min(game.bests[level.id]??Infinity,result.cost);
      if(level.reward&&!game.library[level.reward]){game.library[level.reward]=clone(board);learned=` ${level.reward}を部品として使えるようになりました。`;}
    }
    $('#pw-level').replaceChildren(...levels.map((item,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i===0?'遊び方':i+'章'} · ${copy[item.id].short}${game.bests[item.id]!==undefined?' ✓':''}`;option.disabled=!unlocked(i);return option;}));
    $('#pw-level').value=String(game.level);
    $('#pw-step').textContent=level.demo?'はじめに':`CHAPTER ${game.level} / 5`;
    $('#pw-title').textContent=info.title;$('#pw-lesson').textContent=info.lesson;$('#pw-goal').textContent=info.goal;
    $('#pw-budget').textContent=level.demo?'多数決の装置 1個':`使っている装置 ${allocatedCost(board,game.library)} / ${level.budget}個${level.parts?'（部品の中身も数えます）':''}`;
    root.dataset.level=level.id;
    root.classList.toggle('motion-paused',!game.motion);
    root.style.setProperty('--wave-delay',(-((Date.now()%1800)/1000))+'s');
    $('#pw-inputs').innerHTML='<h3 class="board-column-label">入力を試す</h3>'+level.inputs.map(name=>{
      const value=observed.values[name];
      return `<div class="signal-source" data-source="${name}" data-value="${value}"><span class="source-label">${escape(name)}</span><button type="button" class="input-toggle" data-toggle-input="${name}" data-value="${value}" aria-label="入力${name}を${1-value}に切り替える" aria-pressed="${value===1}"><span class="signal-value">${value}</span><span class="toggle-caption">押して切替</span></button>${wave(value)}</div>`;
    }).join('')+(level.demo?'':'<h3 class="board-column-label constants-label">固定の信号</h3>'+['0','1'].map(source=>`<div class="signal-source constant-source" data-source="${source}" data-value="${source}"><span class="source-label">いつも${source}</span><span class="signal-value">${source}</span>${wave(Number(source))}</div>`).join(''));
    $('#pw-gates').innerHTML=board.gates.length?board.gates.map((gate,index)=>{
      const value=observed.values['P'+(index+1)];
      const tools=level.demo||game.level<3?'':`<details class="node-tools"><summary>この${gate.type==='MAJ'?'装置':'部品'}を編集</summary><div class="node-actions">${gate.type!=='MAJ'?`<button type="button" data-expand-gate="${index}">中を開く（${partCost(gate.type,game.library)}個）</button>`:''}<button type="button" data-remove-gate="${index}">取り外す</button></div></details>`;
      const handle=level.demo?'':`<button type="button" class="move-handle" data-move-gate="${index}" aria-label="P${index+1}を移動。ドラッグまたは矢印キーで配置" aria-pressed="${moveTarget===index}">移動 <span aria-hidden="true">↕</span></button>`;
      return `<section class="gate-card" data-index="${index}" aria-label="P${index+1} ${gate.type==='MAJ'?'多数決の装置':gate.type+'の部品'}"><div class="node-heading"><span class="node-name">P${index+1}</span><span class="node-type">${gate.type==='MAJ'?'多数決の装置':gate.type+'の部品 · 中身'+partCost(gate.type,game.library)+'個'}</span>${handle}</div><div class="gate-body"><div class="gate-inputs">${gate.ports.map((edge,port)=>socket({kind:'gate',index,port},edge,observed.values,!level.demo)).join('')}</div><div class="gate-core"><div class="majority-core" data-value="${valueAttr(value)}"><span class="core-label">${gate.type==='MAJ'?'多数決':gate.type}</span><strong class="core-value">${valueText(value)}</strong></div><button type="button" class="gate-output" data-source="P${index+1}" data-value="${valueAttr(value)}" aria-label="P${index+1}の出力 ${valueText(value)}" disabled><span>出力</span><span class="signal-value">${valueText(value)}</span>${wave(value)}</button></div></div>${tools}</section>`;
    }).join(''):'<div class="empty-board">装置がありません。下の「部品を追加」から置いてみよう。</div>';
    $('#pw-outputs').innerHTML='<h3 class="board-column-label">できた信号</h3>'+level.outputs.map(name=>{
      const expected=level.target(testRow(level,board.input))[name],value=observed.outputs[name];
      const terminal=game.level<3?`<span class="output-terminal" data-sink="output:${name}" aria-hidden="true"></span>`:socket({kind:'output',name},board.outputs[name],observed.values,true);
      return `<div class="output-card" data-value="${valueAttr(value)}"><span class="output-name">${escape(outputName(name))} <small>${name}</small></span><strong class="output-value">${valueText(value)}</strong>${wave(value)}<span class="expected-value">この入力の正解：${expected}</span>${terminal}</div>`;
    }).join('');
    const next=nextEmpty(board);if(next&&!level.demo)root.querySelector(`[data-sink="${sinkId(next)}"]`)?.classList.add('is-suggested');
    $('#pw-coach').textContent=(notice?notice+' ':'')+guide(result);notice='';
    $('#pw-status').classList.toggle('is-clear',!level.demo&&result.clear);
    if(level.demo){const votes=level.inputs.reduce((sum,name)=>sum+observed.values[name],0);$('#pw-status').textContent=`1が${votes}票、0が${3-votes}票 → 出力は${observed.outputs.Y}`;}
    else if(result.clear)$('#pw-status').textContent=`クリア！ ${result.total}通りすべて正解。使用${result.cost}個 / 自己ベスト${game.bests[level.id]}個${result.cost===level.minimum?' · 最少達成！':''}${learned}`;
    else $('#pw-status').textContent=result.incomplete?'まだ空いている入力があります。まずは配線をつなごう。':`${result.total}通りのうち${result.matched}通りが正解。違っている場合を確かめよう。`;
    const testCases=Array.from({length:result.total},(_,row)=>{
      const inputs=testRow(level,row),expected=level.target(inputs),actual=evaluate(level,board,row,game.library).outputs;
      const pending=level.outputs.some(name=>actual[name]===null),match=level.outputs.every(name=>actual[name]===expected[name]);
      return {row,inputs,expected,actual,pending,match};
    });
    $('#pw-results').hidden=!!level.demo;
    $('#pw-results').innerHTML=testCases.map(item=>`<button type="button" class="test-case ${item.pending?'is-pending':item.match?'is-match':'is-mismatch'}${item.row===board.input?' is-selected':''}" data-test-row="${item.row}" aria-pressed="${item.row===board.input}" aria-label="${escape(level.inputs.map((name,i)=>name+'='+item.inputs[i]).join('、'))}の動きを見る"><span class="test-inputs">${item.inputs.map((value,i)=>level.inputs[i]+' '+value).join(' · ')}</span><span class="test-result">${item.pending?'未接続':item.match?'正解':'ちがう'}</span></button>`).join('');
    $('#pw-table').closest('details').hidden=!!level.demo;
    $('#pw-table').innerHTML=`<thead><tr>${level.inputs.map(name=>`<th scope="col">入力${name}</th>`).join('')}${level.outputs.map(name=>`<th scope="col">${name}の正解</th><th scope="col">いまの${name}</th>`).join('')}<th scope="col">判定</th></tr></thead><tbody>${testCases.map(item=>`<tr${item.row===board.input?' class="is-selected"':''}>${item.inputs.map(value=>`<td>${value}</td>`).join('')}${level.outputs.map(name=>`<td>${item.expected[name]}</td><td>${valueText(item.actual[name])}</td>`).join('')}<td>${item.pending?'未接続':item.match?'正解':'ちがう'}</td></tr>`).join('')}</tbody>`;
    $('#pw-next').hidden=game.level===levels.length-1;
    $('#pw-next').disabled=!level.demo&&!result.clear;
    $('#pw-next').textContent=level.demo?'回路を作ってみる →':game.level<levels.length-1?`次へ：${copy[levels[game.level+1].id].short} →`:'次へ';
    $('#pw-undo').hidden=!!level.demo;$('#pw-undo').disabled=!(history[level.id]?.length);
    $('#pw-reset').hidden=!!level.demo;$('#pw-hint').hidden=!!level.demo;
    $('#pw-palette').hidden=game.level<3;
    const selectedPart=$('#pw-part').value;
    $('#pw-part').replaceChildren(...allowedTypes(level,game.library).map(type=>{const option=document.createElement('option');option.value=type;option.textContent=(type==='MAJ'?'多数決の装置':type+'の部品')+` · ${partCost(type,game.library)}個分`;return option;}));
    $('#pw-part').value=allowedTypes(level,game.library).includes(selectedPart)?selectedPart:'MAJ';
    $('#pw-add').disabled=allocatedCost(board,game.library)+partCost($('#pw-part').value,game.library)>level.budget;
    $('#pw-motion').textContent=game.motion?'振動を止める':'振動を動かす';$('#pw-motion').setAttribute('aria-pressed',String(game.motion));
    showHint();placeGates();refreshMoveControls();scheduleWires();
  }
  function layoutMetrics(){
    const canvas=$('#pw-gates'),width=canvas.clientWidth||canvas.getBoundingClientRect().width||320;
    const columns=width>=640?2:1,cardWidth=Math.min(width,columns===2?(width-32)/2:400);
    return {canvas,width,cardWidth,columns,mode:columns===2?'wide':'narrow',maxX:Math.max(0,width-cardWidth)};
  }
  function separateCards(points,pinned=null){
    const order=points.map((_,i)=>i).sort((a,b)=>points[a].y-points[b].y||points[a].x-points[b].x);
    if(pinned!==null){order.splice(order.indexOf(pinned),1);order.unshift(pinned);}
    const placed=[];
    for(const index of order){
      const point=points[index];
      for(let attempt=0;attempt<points.length+1;attempt++){
        const collisions=placed.filter(other=>point.x<other.x+other.width+16&&point.x+point.width+16>other.x&&point.y<other.y+other.height+28&&point.y+point.height+28>other.y);
        if(!collisions.length)break;
        point.y=Math.max(...collisions.map(other=>other.y+other.height+32));
      }
      placed.push(point);
    }
    return points;
  }
  function paintPlacements(){
    const canvas=$('#pw-gates');
    placements.forEach((point,i)=>{const card=canvas.querySelector(`[data-index="${i}"]`);if(card){card.style.left=point.x+'px';card.style.top=point.y+'px';}});
    canvas.style.height=placements.length?Math.ceil(Math.max(...placements.map(point=>point.y+point.height))+48)+'px':'80px';
  }
  function placeGates(){
    const canvas=$('#pw-gates');canvas.classList.toggle('free-layout',!currentLevel().demo);
    if(currentLevel().demo){canvas.style.height='';placements=[];return;}
    const metrics=layoutMetrics(),saved=currentBoard().layout?.[metrics.mode];
    layoutWidth=metrics.width;
    const cards=[...canvas.querySelectorAll('.gate-card')];cards.forEach(card=>{card.style.width=metrics.cardWidth+'px';});
    const heights=cards.map(card=>card.getBoundingClientRect().height||card.offsetHeight||240);
    let rowY=0;
    placements=cards.map((card,i)=>{
      if(i>0&&i%metrics.columns===0)rowY+=Math.max(...heights.slice(i-metrics.columns,i))+32;
      const fallback={x:(i%metrics.columns)*metrics.maxX,y:rowY};
      const point=saved?.[i];
      return {x:point?point.x*metrics.maxX:fallback.x,y:point?point.y:fallback.y,width:metrics.cardWidth,height:heights[i]};
    });
    separateCards(placements);paintPlacements();
  }
  function rememberPlacements(){
    const {mode,maxX}=layoutMetrics(),board=currentBoard();
    board.layout=board.layout||{};
    board.layout[mode]=placements.map(point=>({x:maxX?point.x/maxX:0,y:Math.min(8192,point.y)}));
  }
  function refreshMoveControls(){
    if(moveTarget!==null&&!currentBoard().gates[moveTarget])moveTarget=null;
    $('#pw-layout-tools').hidden=!!currentLevel().demo||(game.level<3&&moveTarget===null);
    $('#pw-move-controls').hidden=moveTarget===null;
    $('#pw-move-label').textContent=moveTarget===null?'':`P${moveTarget+1}の配置`;
    $('#pw-arrange').disabled=!currentBoard().layout;
    root.querySelectorAll('[data-move-gate]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.moveGate)===moveTarget)));
  }
  function nudgeGate(index,dx,dy){
    if(!placements[index])return;
    const {maxX}=layoutMetrics();
    const point=placements[index];
    const x=Math.max(0,Math.min(maxX,point.x+dx)),y=Math.max(0,Math.min(4096,point.y+dy));
    if(x===point.x&&y===point.y)return;
    const original=clone(currentBoard());point.x=x;point.y=y;separateCards(placements,index);rememberPlacements();
    (history[currentLevel().id]||(history[currentLevel().id]=[])).push(original);
    if(history[currentLevel().id].length>30)history[currentLevel().id].shift();
    notice=`P${index+1}を移動しました。配線はつながったままです。`;render();save();
    root.querySelector(`[data-move-gate="${index}"]`)?.focus({preventScroll:true});
  }
  root.addEventListener('pointerdown',event=>{
    if(!drag)suppressDragClick=false;
    const handle=event.target.closest('[data-move-gate]');if(!handle||event.button!==0||drag)return;
    const index=Number(handle.dataset.moveGate),point=placements[index];if(!point)return;
    const rect=$('#pw-gates').getBoundingClientRect();
    drag={index,pointer:event.pointerId,handle,original:clone(currentBoard()),offsetX:event.clientX-rect.left-point.x,offsetY:event.clientY-rect.top-point.y,startX:event.clientX,startY:event.clientY,moved:false};
    handle.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5)return;
    drag.moved=true;moveTarget=drag.index;
    drag.clientX=event.clientX;drag.clientY=event.clientY;
    const {canvas,maxX}=layoutMetrics(),rect=canvas.getBoundingClientRect(),point=placements[drag.index];
    point.x=Math.max(0,Math.min(maxX,Math.round((event.clientX-rect.left-drag.offsetX)/16)*16));
    point.y=Math.max(0,Math.min(4096,Math.round((event.clientY-rect.top-drag.offsetY)/16)*16));
    canvas.querySelector(`[data-index="${drag.index}"]`).classList.add('is-dragging');
    root.classList.add('layout-dragging');paintPlacements();scheduleWires();event.preventDefault();
    if(scrollFrame===null)scrollFrame=window.requestAnimationFrame(scrollWhileDragging);
  });
  function scrollWhileDragging(){
    scrollFrame=null;if(!drag?.moved)return;
    const amount=drag.clientY<64?-12:drag.clientY>window.innerHeight-64?12:0;
    if(amount){
      const before=window.scrollY;window.scrollBy({top:amount,behavior:'instant'});
      if(window.scrollY!==before){
        const rect=$('#pw-gates').getBoundingClientRect(),point=placements[drag.index];
        point.y=Math.max(0,Math.min(4096,Math.round((drag.clientY-rect.top-drag.offsetY)/16)*16));paintPlacements();scheduleWires();
      }
    }
    scrollFrame=window.requestAnimationFrame(scrollWhileDragging);
  }
  function finishDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointer)return;
    const completed=drag;drag=null;
    if(scrollFrame!==null){window.cancelAnimationFrame(scrollFrame);scrollFrame=null;}
    if(completed.handle.hasPointerCapture?.(completed.pointer))completed.handle.releasePointerCapture(completed.pointer);
    root.classList.remove('layout-dragging');
    if(cancelled){game.boards[currentLevel().id]=completed.original;render();return;}
    if(!completed.moved){
      if(event.pointerType==='touch'){
        moveTarget=moveTarget===completed.index?null:completed.index;refreshMoveControls();suppressDragClick=true;
        completed.handle.focus({preventScroll:true});
      }
      return;
    }
    separateCards(placements,completed.index);rememberPlacements();
    (history[currentLevel().id]||(history[currentLevel().id]=[])).push(completed.original);
    if(history[currentLevel().id].length>30)history[currentLevel().id].shift();
    suppressDragClick=true;notice=`P${completed.index+1}を移動しました。配置は自動保存されます。`;render();save();
    root.querySelector(`[data-move-gate="${completed.index}"]`)?.focus({preventScroll:true});
  }
  root.addEventListener('pointerup',event=>{
    const nudge=event.target.closest('[data-nudge]');
    if(!drag&&event.pointerType==='touch'&&nudge&&moveTarget!==null){
      const direction={left:[-16,0],right:[16,0],up:[0,-16],down:[0,16]}[nudge.dataset.nudge];
      if(direction){event.preventDefault();nudgeGate(moveTarget,...direction);suppressDragClick=true;}
      return;
    }
    finishDrag(event);
  });
  root.addEventListener('pointercancel',event=>finishDrag(event,true));
  root.addEventListener('lostpointercapture',event=>{if(drag&&event.pointerId===drag.pointer)finishDrag(event,true);});
  window.addEventListener('blur',()=>{if(drag)finishDrag({pointerId:drag.pointer},true);});
  root.addEventListener('keydown',event=>{
    if(!drag)suppressDragClick=false;
    const handle=event.target.closest('[data-move-gate]');if(!handle)return;
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(!directions[event.key])return;
    event.preventDefault();moveTarget=Number(handle.dataset.moveGate);const amount=event.shiftKey?64:16;
    nudgeGate(moveTarget,...directions[event.key].map(value=>value*amount));
  });
  function orthogonalRoute(start,end,obstacles,width,height){
    const xs=[...new Set([3,width-3,start.x,end.x,...obstacles.flatMap(box=>[box.left,box.right])])].sort((a,b)=>a-b);
    const ys=[...new Set([3,height-3,start.y,end.y,...obstacles.flatMap(box=>[box.top,box.bottom])])].sort((a,b)=>a-b);
    const nx=xs.length,inside=(x,y)=>obstacles.some(box=>x>box.left&&x<box.right&&y>box.top&&y<box.bottom);
    const available=new Uint8Array(nx*ys.length);
    for(let y=0;y<ys.length;y++)for(let x=0;x<nx;x++)available[y*nx+x]=!inside(xs[x],ys[y]);
    const blocked=(a,b)=>obstacles.some(box=>a.y===b.y?a.y>box.top&&a.y<box.bottom&&Math.max(a.x,b.x)>box.left&&Math.min(a.x,b.x)<box.right:a.x>box.left&&a.x<box.right&&Math.max(a.y,b.y)>box.top&&Math.min(a.y,b.y)<box.bottom);
    const first=ys.indexOf(start.y)*nx+xs.indexOf(start.x),last=ys.indexOf(end.y)*nx+xs.indexOf(end.x);
    const distances=new Float64Array(available.length).fill(Infinity),parents=new Int32Array(available.length).fill(-1),heap=[];
    const point=index=>({x:xs[index%nx],y:ys[Math.floor(index/nx)]});
    function push(index,cost){const item={index,cost};heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].cost<=cost)break;heap[i]=heap[p];i=p;}heap[i]=item;}
    function pop(){const result=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].cost<heap[child].cost)child++;if(heap[child].cost>=tail.cost)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return result;}
    distances[first]=0;push(first,0);
    while(heap.length){
      const {index,cost}=pop();if(cost!==distances[index])continue;if(index===last)break;
      const x=index%nx,y=Math.floor(index/nx),a=point(index);
      const neighbors=[];if(x>0)neighbors.push(index-1);if(x+1<nx)neighbors.push(index+1);if(y>0)neighbors.push(index-nx);if(y+1<ys.length)neighbors.push(index+nx);
      for(const next of neighbors){if(!available[next])continue;const b=point(next);if(blocked(a,b))continue;const distance=cost+Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(distance>=distances[next])continue;distances[next]=distance;parents[next]=index;push(next,distance);}
    }
    if(!Number.isFinite(distances[last]))return null;
    const route=[];for(let index=last;index!==-1;index=parents[index])route.push(point(index));route.reverse();
    return route.filter((item,i)=>i===0||i===route.length-1||!((route[i-1].x===item.x&&route[i+1].x===item.x)||(route[i-1].y===item.y&&route[i+1].y===item.y)));
  }
  function traceWire(sink){
    traceSink=sink;
    root.querySelectorAll('.is-wire-source,.is-wire-target').forEach(node=>node.classList.remove('is-wire-source','is-wire-target'));
    let source=null;
    $('#pw-wires').querySelectorAll('[data-wire-to]').forEach(node=>{const active=node.dataset.wireTo===sink;node.classList.toggle('is-traced',active);if(active&&node.dataset.wireFrom)source=node.dataset.wireFrom;});
    root.classList.toggle('has-wire-trace',source!==null);
    if(source!==null){root.querySelector(`[data-source="${source}"]`)?.classList.add('is-wire-source');root.querySelector(`[data-sink="${sink}"]`)?.classList.add('is-wire-target');$('#pw-wires').querySelectorAll('.is-traced').forEach(node=>$('#pw-wires').appendChild(node));}
  }
  function drawWires(){
    const board=currentBoard(),level=currentLevel(),observed=evaluate(level,board,board.input,game.library),box=$('#pw-board').getBoundingClientRect();
    const svg=$('#pw-wires');svg.setAttribute('viewBox',`0 0 ${Math.max(1,box.width)} ${Math.max(1,box.height)}`);
    const wires=[];
    const obstacles=[...root.querySelectorAll('.signal-source,.gate-card,.output-card')].map(node=>{const r=node.getBoundingClientRect();return {left:r.left-box.left-2,right:r.right-box.left+2,top:r.top-box.top-2,bottom:r.bottom-box.top+2,width:r.width,height:r.height};}).filter(r=>r.width>0&&r.height>0);
    function draw(edge,destination){
      if(!edge.source)return;
      const from=root.querySelector(`[data-source="${edge.source}"]`),to=root.querySelector(`[data-sink="${sinkId(destination)}"]`);if(!from||!to)return;
      const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
      const sourceBox=(from.closest('.gate-card')||from).getBoundingClientRect(),targetBox=(to.closest('.gate-card,.output-card')||to).getBoundingClientRect();
      const verticalSource=from.classList.contains('signal-source')&&box.width<520;
      const sx=verticalSource?a.left+a.width/2-box.left:a.right-box.left,sy=verticalSource?a.bottom-box.top:a.top+a.height/2-box.top,ex=b.left-box.left,ey=b.top+b.height/2-box.top;
      const start=verticalSource?{x:sx,y:sourceBox.bottom-box.top+3}:{x:sourceBox.right-box.left+3,y:sy};
      const end={x:targetBox.left-box.left-3,y:ey};
      const route=orthogonalRoute(start,end,obstacles,box.width,box.height);
      const path=route?`M ${sx} ${sy} ${route.map(p=>`L ${p.x} ${p.y}`).join(' ')} L ${ex} ${ey}`:`M ${sx} ${sy} L ${ex} ${ey}`;
      const value=readEdge(edge,observed.values);
      wires.push(`<path class="wire" data-routing="${route?'clear':'fallback'}" data-value="${valueAttr(value)}" data-wire-from="${edge.source}" data-wire-to="${sinkId(destination)}" d="${path}"><title>${escape(sourceName(edge.source))} → ${escape(targetName(destination))}${edge.inverted?'（反転）':''}</title></path>`);
      if(edge.inverted)wires.push(`<g class="wire-inversion" data-wire-to="${sinkId(destination)}"><circle cx="${ex-7}" cy="${ey}" r="4"/><title>0と1を反転する配線</title></g>`);
    }
    board.gates.forEach((gate,index)=>gate.ports.forEach((edge,port)=>draw(edge,{kind:'gate',index,port})));
    Object.entries(board.outputs).forEach(([name,edge])=>draw(edge,{kind:'output',name}));
    svg.innerHTML=wires.join('');traceWire(traceSink);
  }
  function scheduleWires(){if(drawFrame!==null)window.cancelAnimationFrame?.(drawFrame);if(window.requestAnimationFrame)drawFrame=window.requestAnimationFrame(()=>{drawFrame=null;drawWires();});else drawWires();}
  function showHint(){
    const hintSets={and:['A=0、B=1のときは、出力を0にしたい。残りの1票を0と1のどちらにすれば、0が多数派になる？','入力3に「いつも0」をつなぐと、AもBも1のときだけ1が2票になります。'],or:['A=0、B=1のときも、出力を1にしたい。残りの1票で1を多数派にするには？','入力3に「いつも1」をつなぐと、AかBのどちらか1だけで、1が2票になります。'],xor:['「どちらかが1」の回路から、「両方1」の場合を除くと、違うときだけ1になります。','P1をAND、P2をORに。P3には「P1の反転」「P2」「いつも0」をつないでみよう。'],half:['違う入力なら1の位は1。両方1なら2の位が1です。XORとANDの役割を思い出そう。','XORにもANDにもAとBをつなぎます。XORの出力をS、ANDの出力をCに使います。'],full:['まずXORでAとBを足した結果を作り、もうひとつのXORでCinを足そう。','繰り上がりは「AとBが両方1」または「AとBのXORとCinが両方1」の場合。部品で完成したら、多数決を直接使う方法も考えてみよう。']};
    const index=hints[currentLevel().id]||0,text=hintSets[currentLevel().id]||[];
    $('#pw-hint-text').hidden=index===0;$('#pw-hint-text').textContent=index?text[Math.min(index-1,text.length-1)]||'':'';$('#pw-hint').setAttribute('aria-expanded',String(index>0));
  }
  root.addEventListener('focusin',event=>{const sink=event.target.closest('[data-sink]');if(sink)traceWire(sink.dataset.sink);else if(!$('#pw-connect-dialog').contains(event.target))traceWire(null);});
  root.addEventListener('pointerover',event=>{const sink=event.target.closest('[data-sink]');if(sink)traceWire(sink.dataset.sink);});
  root.addEventListener('pointerout',event=>{const sink=event.target.closest('[data-sink]');if(sink&&!sink.contains(event.relatedTarget)&&!$('#pw-connect-dialog').open&&!document.activeElement?.closest('[data-sink]'))traceWire(null);});
  root.addEventListener('click',event=>{if(suppressDragClick){suppressDragClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  root.addEventListener('click',event=>{
    if(!event.target.closest('button,select,input,summary,dialog'))traceWire(null);
    const mover=event.target.closest('[data-move-gate]');
    if(mover){const index=Number(mover.dataset.moveGate);moveTarget=moveTarget===index?null:index;refreshMoveControls();mover.focus({preventScroll:true});return;}
    const nudge=event.target.closest('[data-nudge]');
    if(nudge&&moveTarget!==null){const direction={left:[-16,0],right:[16,0],up:[0,-16],down:[0,16]}[nudge.dataset.nudge];if(direction)nudgeGate(moveTarget,...direction);return;}
    const input=event.target.closest('[data-toggle-input]');
    if(input){const name=input.dataset.toggleInput,index=currentLevel().inputs.indexOf(name);currentBoard().input^=1<<(currentLevel().inputs.length-1-index);render();save();root.querySelector(`[data-toggle-input="${name}"]`)?.focus();return;}
    const candidate=event.target.closest('[data-connect-source]');
    if(candidate&&target){const destination={...target},source=candidate.dataset.connectSource,inverted=!!currentLevel().invert&&$('#pw-connect-invert').checked;if(!sources(destination.kind==='gate'?destination.index:currentBoard().gates.length).includes(source))return;closePicker();edit(()=>Object.assign(edgeAt(destination),{source,inverted})&&undefined,`${targetName(destination)}を${sourceName(source)}につなぎました。`);focusSink(destination);return;}
    const sink=event.target.closest('[data-sink]');
    if(sink&&!sink.disabled){if(sink.dataset.output)openPicker({kind:'output',name:sink.dataset.output});else openPicker({kind:'gate',index:Number(sink.dataset.gateIndex),port:Number(sink.dataset.portIndex)});return;}
    const test=event.target.closest('[data-test-row]');
    if(test){const row=Number(test.dataset.testRow);currentBoard().input=row;render();save();root.querySelector(`[data-test-row="${row}"]`)?.focus();return;}
    const expand=event.target.closest('[data-expand-gate]');
    if(expand){const index=Number(expand.dataset.expandGate);moveTarget=null;edit(board=>expandGate(board,index,game.library),'部品の中の配線を開きました。つながりはそのままです。');return;}
    const remove=event.target.closest('[data-remove-gate]');
    if(remove){const index=Number(remove.dataset.removeGate);moveTarget=null;edit(board=>removeGate(board,index),'装置を取り外しました。つなぎ直すか、「ひとつ戻す」で戻せます。');return;}
  });
  $('#pw-connect-cancel').addEventListener('click',closePicker);
  $('#pw-connect-dialog').addEventListener('cancel',event=>{event.preventDefault();closePicker();});
  $('#pw-disconnect').addEventListener('click',()=>{if(!target)return;const destination={...target};closePicker();edit(()=>Object.assign(edgeAt(destination),blankEdge())&&undefined,'配線を外しました。');focusSink(destination);});
  $('#pw-next').addEventListener('click',()=>{if(game.level===0)game.introDone=true;else if(!score(currentLevel(),currentBoard(),game.library).clear)return;if(game.level===levels.length-1)return;game.level++;target=null;moveTarget=null;notice='';render();save();$('#pw-title').scrollIntoView?.({block:'start',behavior:'instant'});});
  $('#pw-level').addEventListener('change',()=>{const index=Number($('#pw-level').value);if(!unlocked(index))return;game.level=index;target=null;moveTarget=null;notice='';render();save();});
  $('#pw-undo').addEventListener('click',()=>{const previous=history[currentLevel().id]?.pop();if(!previous)return;game.boards[currentLevel().id]=previous;moveTarget=null;notice='ひとつ前の配線に戻しました。';render();save();});
  $('#pw-reset').addEventListener('click',()=>{moveTarget=null;edit(()=>freshBoard(currentLevel()),'この問題の最初の配線に戻しました。自己ベストは残ります。');});
  $('#pw-arrange').addEventListener('click',()=>{moveTarget=null;edit(board=>{delete board.layout;},'装置の配置を整えました。配線はそのままです。');});
  $('#pw-move-done').addEventListener('click',()=>{const previous=moveTarget;moveTarget=null;refreshMoveControls();root.querySelector(`[data-move-gate="${previous}"]`)?.focus({preventScroll:true});});
  $('#pw-hint').addEventListener('click',()=>{hints[currentLevel().id]=(hints[currentLevel().id]||0)+1;showHint();});
  $('#pw-part').addEventListener('change',()=>{$('#pw-add').disabled=allocatedCost(currentBoard(),game.library)+partCost($('#pw-part').value,game.library)>currentLevel().budget;});
  $('#pw-add').addEventListener('click',()=>{const type=$('#pw-part').value;if(!allowedTypes(currentLevel(),game.library).includes(type)||allocatedCost(currentBoard(),game.library)+partCost(type,game.library)>currentLevel().budget)return;edit(board=>{board.gates.push(blankGate(type));},'装置を追加しました。空いている入力をつないでみよう。');});
  $('#pw-motion').addEventListener('click',()=>{game.motion=!game.motion;render();save();});
  window.addEventListener('resize',()=>{if(drag)finishDrag({pointerId:drag.pointer},true);placeGates();refreshMoveControls();scheduleWires();});
  root.addEventListener('toggle',event=>{if(event.target.classList?.contains('node-tools')&&!drag){placeGates();scheduleWires();}},true);
  window.addEventListener('storage',event=>{if(event.key!==SAVE_KEY)return;if(drag)finishDrag({pointerId:drag.pointer},true);game=loadGame();moveTarget=null;migrateStartingBoards();Object.keys(history).forEach(key=>delete history[key]);render();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!drag&&Math.abs(($('#pw-gates').clientWidth||0)-layoutWidth)>.5)placeGates();scheduleWires();}).observe($('#pw-board'));
  render();
})();
