import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/snapshot_result_ui.js',import.meta.url),'utf8');
const handlers={};
const elements={};
const cls=()=>({add(){},remove(){},toggle(){}});
const view={classList:cls(),style:{removeProperty(){},height:''}};
const host={innerHTML:'',removeAttribute(){},parentElement:{removeAttribute(){}}};
const workspace={dataset:{}};
const getId=id=>{
  if(id==='view-result')return view;
  if(id==='ranking-container')return host;
  return elements[id] ||= {innerHTML:'',textContent:'',disabled:false,
    classList:cls(),style:{},querySelector(){return {focus(){}}}};
};
const doc={
  readyState:'complete',getElementById:getId,
  querySelector:q=>q.includes('snapshot-workspace')?workspace:null,
  addEventListener:(name,callback)=>{handlers[name]=callback}
};
const words=Array.from({length:8},(_,i)=>({text:'target word '+(i+1),ja:'日本語 '+(i+1),points:10}));
const cat=(cleared,missed,matchRate)=>({cleared,missed,matchRate});
const cats={
  object:cat(words.slice(0,2),words,25),
  attribute:cat([],words.slice(0,3),0),
  detail:cat([],words.slice(0,2),0),
  gist:cat([],[],0),
  other:cat([],[],0)
};
const stats={categories:cats,completionRate:25};
let submits=0,logs=0,practices=0;
const w={
  renderSnapshotResult(){},
  appState:{selectedMode:'snapshot',selectedLevel:'elementary',customTimeLimit:30},
  currentTheme:{id:'test-theme'},
  snapshotVerifiedTranscript:'I see a cat',snapshotVerifiedSeconds:30,
  innerWidth:1024,innerHeight:768,
  addEventListener:(name,callback)=>{handlers[name]=callback},
  getCompletionStats:()=>stats,
  getAggregatedData:()=>({words,chunks:[],sentences:[]}),
  picSpeakEscapeHTML:v=>String(v).replace(/</g,'&lt;'),
  setupSubmitButton(){submits++},
  saveLearningLog(){logs++},
  openPractice(){practices++}
};
getId('scoreDisplay').textContent='200';
vm.runInNewContext(source,{window:w,document:doc,Set,Map,String,Number,Math,Array,console});
w.renderSnapshotResult();
assert.match(host.innerHTML,/class="snapshot-aside"/);
assert.match(host.innerHTML,/class="snapshot-workspace"/);
assert.match(host.innerHTML,/小学生モード/);
assert.match(host.innerHTML,/4つの要素の達成度/);
assert.equal((getId('snapshot-item-grid').innerHTML.match(/snapshot-item-card/g)||[]).length,4);
assert.match(getId('snapshot-item-grid').innerHTML,/単語/);
assert.match(getId('snapshot-item-grid').innerHTML,/🎤 音読練習/);
assert.match(getId('snapshot-status-tabs').innerHTML,/\(8\)/); // overlap counts once
assert.equal(submits,1);
assert.equal(logs,1);
const resize=(width,height,expected)=>{
  w.innerWidth=width;w.innerHeight=height;handlers.resize();
  assert.equal((getId('snapshot-item-grid').innerHTML.match(/snapshot-item-card/g)||[]).length,expected);
};
resize(768,1024,6);
resize(390,844,2);
resize(390,680,1);
w.innerWidth=1024;w.innerHeight=768;handlers.resize();
const click=(selector,dataset)=>{
  const target={dataset,closest:q=>q===selector?target:null};
  handlers.click({target});
};
click('#snapshot-status-tabs [data-status]',{status:'cleared'});
assert.equal(workspace.dataset.status,'cleared');
assert.match(getId('snapshot-list-title').textContent,/言えた表現/);
assert.match(getId('snapshot-item-grid').innerHTML,/target word 1/);
click('#snapshot-status-tabs [data-status]',{status:'missed'});
click('#snapshot-category-tabs [data-category]',{category:'attribute'});
assert.match(getId('snapshot-list-title').textContent,/様子・色/);
assert.equal((getId('snapshot-item-grid').innerHTML.match(/snapshot-item-card/g)||[]).length,3);
assert.equal(practices,0);
assert.equal(logs,1); // tab switch must not save again
console.log('Snapshot result layout and interaction regression passed');
