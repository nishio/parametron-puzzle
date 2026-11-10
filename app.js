
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
    if(level.demo) { board.gates[0].ports=level.inputs.map(source=>({source,inverted:false})); board.outputs.Y={source:'P1',inverted:false}; board.input=6; }
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
    return {gates,outputs:Object.fromEntries(Object.entries(board.outputs).map(([name,edge])=>[name,mapEdge(edge,mapping)])),input:board.input};
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
  function loadGame() {
    try { return normalizeGame(JSON.parse(localStorage.getItem(SAVE_KEY))); }
    catch (_) { return normalizeGame(null); }
  }
  let game=loadGame();
  const currentLevel=()=>levels[game.level];
  const currentBoard=()=>game.boards[currentLevel().id]||(game.boards[currentLevel().id]=freshBoard(currentLevel()));
  const valueLabel=value=>value===null||value===undefined?'·':String(value);
  const unlocked=index=>index===0||(index===1?game.introDone:game.bests[levels[index-1].id]!==undefined);
  function save() {
    try {
      localStorage.setItem(SAVE_KEY,JSON.stringify(game));
      $('#pw-storage').textContent='進捗はこのブラウザに自動保存されます。';
    } catch (_) {
      $('#pw-storage').textContent='この環境では進捗を保存できません。ページを閉じるまで遊べます。';
    }
  }
  function fillSelect(select,choices,selected) {
    select.replaceChildren();
    choices.forEach(choice=>{const option=document.createElement('option');option.value=choice.value;option.textContent=choice.label;option.disabled=choice.disabled===true;select.appendChild(option);});
    select.value=selected;
  }
  function sources(count) { return ['','0','1',...currentLevel().inputs,...Array.from({length:count},(_,i)=>'P'+(i+1))].map(source=>({value:source,label:source||'未接続'})); }
  function waveMarkup(value) {
    const baseline='<line x1="0" y1="12" x2="72" y2="12"/>';
    if(value!==0&&value!==1) return `<svg viewBox="0 0 72 24" aria-hidden="true">${baseline}</svg>`;
    const points=Array.from({length:145},(_,x)=>`${x===0?'M':'L'}${x} ${(12+(value===1?-1:1)*7*Math.sin(x*Math.PI/24)).toFixed(3)}`).join(' ');
    return `<svg viewBox="0 0 72 24" aria-hidden="true">${baseline}<g class="pw-moving"><path d="${points}"/></g></svg>`;
  }
  function addWave(parent,kind,key,port) {
    const wave=document.createElement('span');wave.className='pw-wave';wave.dataset.wave=kind;wave.dataset.key=String(key);if(port!==undefined)wave.dataset.port=String(port);wave.setAttribute('aria-hidden','true');parent.appendChild(wave);
  }
  function makeEdgeControls(edge,choices,label,onChange,allowInvert) {
    const row=document.createElement('div');row.className='pw-port';
    const select=document.createElement('select');select.className='form-select';select.setAttribute('aria-label',label);fillSelect(select,choices,edge.source);
    select.addEventListener('change',()=>{edge.source=select.value;onChange();});row.appendChild(select);
    if(allowInvert) {
      const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='反転';button.setAttribute('aria-label',label+'の反転');button.setAttribute('aria-pressed',String(edge.inverted));
      button.addEventListener('click',()=>{edge.inverted=!edge.inverted;button.setAttribute('aria-pressed',String(edge.inverted));onChange();});row.appendChild(button);
    }
    return row;
  }
  function refreshSteps() {
    const selected=String(game.level);
    fillSelect($('#pw-level'),levels.map((level,i)=>({value:String(i),label:level.name+(game.bests[level.id]!==undefined?' ✓':''),disabled:!unlocked(i)})),selected);
  }
  function build() {
    const level=currentLevel(),board=currentBoard();
    refreshSteps();$('#pw-title').textContent=level.title;$('#pw-lesson').textContent=level.lesson;
    const inputs=$('#pw-inputs');inputs.replaceChildren();
    level.inputs.forEach((name,i)=>{
      const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.input=String(i);
      const label=document.createElement('span');label.dataset.inputLabel=name;button.appendChild(label);addWave(button,'input',name);
      button.addEventListener('click',()=>{board.input^=1<<(level.inputs.length-1-i);changed();});inputs.appendChild(button);
    });
    const gates=$('#pw-gates');gates.replaceChildren();
    board.gates.forEach((gate,index)=>{
      const section=document.createElement('section');section.className='pw-gate';section.setAttribute('aria-label',`P${index+1} ${gate.type==='MAJ'?'パラメトロン':gate.type}`);
      const heading=document.createElement('div');heading.className='viz-row';
      const label=document.createElement('span');label.textContent=`P${index+1} · ${gate.type==='MAJ'?'多数決':gate.type}（${partCost(gate.type,game.library)}素子）`;heading.appendChild(label);
      if(!level.demo) {
        const remove=document.createElement('button');remove.type='button';remove.className='btn btn-ghost';remove.textContent='外す';remove.setAttribute('aria-label',`P${index+1}を外す`);
        remove.addEventListener('click',()=>{game.boards[level.id]=removeGate(board,index);build();save();});heading.appendChild(remove);
        if(gate.type!=='MAJ') {
          const expand=document.createElement('button');expand.type='button';expand.className='btn';expand.textContent='展開';expand.setAttribute('aria-label',`P${index+1}の${gate.type}をパラメトロンに展開`);
          expand.addEventListener('click',()=>{game.boards[level.id]=expandGate(board,index,game.library);build();save();});heading.appendChild(expand);
        }
      }
      const wiring=document.createElement('div');wiring.className='pw-wiring';
      const ports=document.createElement('div');ports.className='pw-ports';
      gate.ports.forEach((edge,port)=>{
        if(level.demo) {
          const row=document.createElement('div');row.className='pw-fixed-port';const text=document.createElement('span');text.dataset.portText=String(port);row.appendChild(text);addWave(row,'port',index,port);ports.appendChild(row);
        } else ports.appendChild(makeEdgeControls(edge,sources(index),`P${index+1} 入力${port+1}`,changed,level.invert));
      });
      const symbol=document.createElement('div');
      const paths=gate.ports.length===3?'M0 24H18L35 61M0 78H30M0 132H18L35 95':'M0 48H18L33 66M0 108H18L33 90';
      const shape=gate.type==='MAJ'?'<circle cx="63" cy="78" r="34"/>':'<rect x="29" y="44" width="68" height="68" rx="3"/>';
      symbol.innerHTML=`<svg class="pw-symbol" viewBox="0 0 108 156" role="img" data-symbol="${index}" aria-label="P${index+1}の出力"><path d="${paths}M97 78H108"/>${shape}<text x="63" y="68" text-anchor="middle">${gate.type==='MAJ'?'多数決':gate.type}</text><text x="63" y="95" text-anchor="middle" data-gate="${index}">·</text></svg>`;
      addWave(symbol,'gate',index);wiring.append(ports,symbol);section.append(heading,wiring);gates.appendChild(section);
    });
    $('#pw-palette').hidden=level.demo;
    fillSelect($('#pw-part'),allowedTypes(level,game.library).map(type=>({value:type,label:`${type==='MAJ'?'パラメトロン':type} · ${partCost(type,game.library)}素子`})), 'MAJ');
    const outputs=$('#pw-outputs');outputs.replaceChildren();
    if(!level.demo) level.outputs.forEach(name=>{
      const row=document.createElement('div');row.className='pw-output';
      const label=document.createElement('span');label.textContent=`出力 ${name}`;
      const controls=makeEdgeControls(board.outputs[name],sources(board.gates.length),`出力${name}の接続元`,changed,level.invert);
      const value=document.createElement('span');value.dataset.outputLabel=name;
      row.append(label,controls,value);addWave(row,'output',name);outputs.appendChild(row);
    });
    update();
  }
  function update() {
    const level=currentLevel(),board=currentBoard(),observed=evaluate(level,board,board.input,game.library),result=score(level,board,game.library);
    const priorBest=game.bests[level.id];
    let learned=false;
    if(!level.demo&&result.clear) {
      game.bests[level.id]=Math.min(priorBest??Infinity,result.cost);
      if(level.reward&&!game.library[level.reward]) {game.library[level.reward]=clone(board);learned=true;}
    }
    refreshSteps();
    $('#pw-budget').textContent=level.demo?'1個のパラメトロン':`配置 ${allocatedCost(board,game.library)} / ${level.budget}素子 · 出力に使用 ${result.cost}素子`;
    $('#pw-add').disabled=allocatedCost(board,game.library)+partCost($('#pw-part').value,game.library)>level.budget;
    $('#pw-inputs').querySelectorAll('button').forEach((button,i)=>{
      const name=level.inputs[i],value=observed.values[name];button.querySelector('[data-input-label]').textContent=`${name} = ${value} `;button.setAttribute('aria-pressed',String(value===1));button.setAttribute('aria-label',`${name} = ${value}、切り替え`);
    });
    root.querySelectorAll('[data-gate]').forEach(text=>{
      const value=observed.values['P'+(Number(text.dataset.gate)+1)];text.textContent=valueLabel(value);
      const svg=text.parentNode;svg.querySelector('circle,rect').classList.toggle('pw-on',value===1);svg.setAttribute('aria-label',`P${Number(text.dataset.gate)+1}の出力：${value===null?'未接続':value}`);
    });
    root.querySelectorAll('[data-port-text]').forEach(text=>{const edge=board.gates[0].ports[Number(text.dataset.portText)];text.textContent=`${edge.source} = ${readEdge(edge,observed.values)}`;});
    root.querySelectorAll('[data-output-label]').forEach(text=>{text.textContent='= '+valueLabel(observed.outputs[text.dataset.outputLabel]);});
    root.style.setProperty('--pw-delay',(-((Date.now()%1800)/1000))+'s');
    root.querySelectorAll('[data-wave]').forEach(wave=>{
      let value=null;const key=wave.dataset.key;
      if(wave.dataset.wave==='input')value=observed.values[key];
      else if(wave.dataset.wave==='gate')value=observed.values['P'+(Number(key)+1)];
      else if(wave.dataset.wave==='port')value=readEdge(board.gates[Number(key)].ports[Number(wave.dataset.port)],observed.values);
      else value=observed.outputs[key];
      wave.innerHTML=waveMarkup(value);
    });
    root.classList.toggle('pw-paused',!game.motion);$('#pw-motion').textContent=game.motion?'振動を止める':'振動を動かす';$('#pw-motion').setAttribute('aria-pressed',String(game.motion));
    if(level.demo) {
      const votes=level.inputs.reduce((sum,name)=>sum+observed.values[name],0);$('#pw-status').textContent=`1が${votes}票、0が${3-votes}票 → 出力 Y = ${observed.outputs.Y}`;
    } else if(result.clear) {
      const best=game.bests[level.id];
      $('#pw-status').textContent=`クリア！ ${result.total}/${result.total}一致 · 使用${result.cost}素子 · 自己ベスト${best}素子${result.cost===level.minimum?' · 最少達成！':' · さらに削減できる'}${learned?' · '+level.reward+'を部品に追加':''}`;
    } else $('#pw-status').textContent=`${result.matched}/${result.total}一致${result.incomplete?' · 出力まで配線をつなごう':''}${priorBest!==undefined?' · 自己ベスト'+priorBest+'素子':''}`;
    const focusedRow=document.activeElement?.dataset?.row;
    const rows=Array.from({length:result.total},(_,row)=>{
      const inputs=level.inputs.map((_,i)=>(row>>(level.inputs.length-1-i))&1),target=level.target(inputs),actual=evaluate(level,board,row,game.library).outputs;
      const match=level.outputs.every(name=>target[name]===actual[name]);
      return `<tr class="${row===board.input?'pw-selected-row':''}">${inputs.map(value=>`<td class="text-center">${value}</td>`).join('')}${level.outputs.map(name=>`<td class="text-center">${target[name]} / ${valueLabel(actual[name])}</td>`).join('')}<td><button type="button" class="btn btn-ghost" data-row="${row}" aria-label="入力${inputs.join('')}を観察" aria-pressed="${row===board.input}">${level.demo?'見る':level.outputs.some(name=>actual[name]===null)?'未接続':match?'一致':'不一致'}</button></td></tr>`;
    });
    $('#pw-table').innerHTML=`<thead><tr>${level.inputs.map(name=>`<th scope="col" class="text-center">${name}</th>`).join('')}${level.outputs.map(name=>`<th scope="col" class="text-center">${name}<br><span class="text-small">目標 / 現在</span></th>`).join('')}<th scope="col">観察</th></tr></thead><tbody>${rows.join('')}</tbody>`;
    if(focusedRow!==undefined)$('#pw-table').querySelector(`[data-row="${focusedRow}"]`)?.focus();
    $('#pw-next').hidden=game.level===levels.length-1;
    $('#pw-next').disabled=!level.demo&&!result.clear;
    $('#pw-next').textContent=level.demo?'ANDに挑戦する':game.level<levels.length-1?levels[game.level+1].name.split(' / ')[0].slice(5)+'へ進む':'次へ';
  }
  function changed() {update();save();}
  $('#pw-level').addEventListener('change',()=>{const index=Number($('#pw-level').value);if(!unlocked(index))return;game.level=index;build();save();});
  $('#pw-part').addEventListener('change',()=>update());
  $('#pw-add').addEventListener('click',()=>{const board=currentBoard(),type=$('#pw-part').value;if(!allowedTypes(currentLevel(),game.library).includes(type)||allocatedCost(board,game.library)+partCost(type,game.library)>currentLevel().budget)return;board.gates.push(blankGate(type));build();save();});
  $('#pw-next').addEventListener('click',()=>{if(game.level===0)game.introDone=true;else if(!score(currentLevel(),currentBoard(),game.library).clear)return;if(game.level>=levels.length-1)return;game.level++;build();save();});
  $('#pw-motion').addEventListener('click',()=>{game.motion=!game.motion;changed();});
  $('#pw-table').addEventListener('click',event=>{const button=event.target.closest('button[data-row]');if(!button)return;currentBoard().input=Number(button.dataset.row);changed();});
  window.addEventListener('storage',event=>{if(event.key!==SAVE_KEY)return;game=loadGame();build();});
  build();
})();
