import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/snapshot_result_ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../css/snapshot_result.css',import.meta.url),'utf8');
const handlers={};
const elements={};
const cls=()=>({add(){},remove(){},toggle(){}});
const view={classList:cls(),style:{removeProperty(){},height:''}};
const host={innerHTML:'',removeAttribute(){},parentElement:{removeAttribute(){}}};
const workspace={dataset:{}};
const getId=id=>{
  if(id==='view-result') return view;
  if(id==='ranking-container') return host;
  return elements[id] ||= {innerHTML:'',textContent:'',scrollTop:24,disabled:false,
    classList:cls(),style:{},querySelector(){return {focus(){}}}};
};
const doc={
  readyState:'complete',getElementById:getId,
  querySelector:q=>q.includes('.snapshot-review-list')?workspace:null,
  addEventListener:(name,callback)=>{handlers[name]=callback}
};
const targets=[
  {text:'The boy is playing soccer.',ja:'少年はサッカーをしています。',points:40},
  {text:'The girl is reading.',ja:'少女は読書をしています。',points:40},
  {text:'There is a tree.',ja:'木があります。',points:40},
  {text:'The boy is outside.',ja:'少年は外にいます。',points:40}
];
const word={text:'soccer',ja:'サッカー',points:10};
const cat=(cleared,missed,matchRate)=>({cleared,missed,matchRate});
const cats={
  object:cat([targets[0]],[targets[1],word],50),
  attribute:cat([],[targets[1]],0),
  detail:cat([targets[2]],[targets[3]],50),
  gist:cat([targets[0]],[],100),
  other:cat([],[],0)
};
const stats={categories:cats,completionRate:50};
let submits=0,logs=0,practices=0,audios=0;
const w={
  renderSnapshotResult(){},
  appState:{selectedMode:'snapshot',selectedLevel:'elementary',customTimeLimit:30},
  currentTheme:{id:'test-theme'},snapshotVerifiedTranscript:'The boy is playing soccer.',
  snapshotVerifiedSeconds:30,
  innerWidth:1024,innerHeight:768,
  addEventListener:(name,callback)=>{handlers[name]=callback},
  getCompletionStats:()=>stats,
  getAggregatedData:()=>({words:[word],chunks:[],sentences:targets}),
  picSpeakEscapeHTML:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  setupSubmitButton(){submits++},
  saveLearningLog(){logs++},
  openPractice(){practices++},
  playResultTTS(){audios++}
};
getId('scoreDisplay').textContent='200';
vm.runInNewContext(source,{window:w,document:doc,Set,Map,String,Number,Math,Array,console});

w.renderSnapshotResult();
assert.match(host.innerHTML,/id="snapshot-category-tabs"/);
assert.match(host.innerHTML,/id="snapshot-item-grid"/);
assert.match(host.innerHTML,/小学生モード/);
assert.equal((getId('snapshot-category-tabs').innerHTML.match(/class="snapshot-category-tab"/g)||[]).length,4);
const renderedTabs=getId('snapshot-category-tabs').innerHTML;
assert.equal((renderedTabs.match(/class="snapshot-icon-svg"/g)||[]).length,4,
  'every element tab must contain a real inline SVG icon, not an emoji fallback');
assert.equal((renderedTabs.match(/class="snapshot-category-name"/g)||[]).length,4,
  'every element tab must show a text label');
assert.equal((renderedTabs.match(/<svg /g)||[]).length,4,
  'SVG icons must render even when the device has no matching emoji font');
for (const tint of ['#d1fae5','#fef3c7','#ede9fe','#dbeafe'])
  assert.ok(renderedTabs.includes(tint),'category tint missing: '+tint);

for (const label of ['物・人','様子・色','位置・背景','動き・要点'])
  assert.ok(getId('snapshot-category-tabs').innerHTML.includes(label),label+' is always visible');
assert.equal((getId('snapshot-item-grid').innerHTML.match(/class="snapshot-item-row"/g)||[]).length,3);
assert.match(getId('snapshot-item-grid').innerHTML,/snapshot-item-mark.*×/);
assert.match(getId('snapshot-item-grid').innerHTML,/snapshot-item-mark.*○/);
assert.ok(getId('snapshot-item-grid').innerHTML.indexOf('The girl is reading.') <
  getId('snapshot-item-grid').innerHTML.indexOf('The boy is playing soccer.'),'unmatched rows first');
assert.match(getId('snapshot-status-tabs').innerHTML,/言えた/);
assert.match(getId('snapshot-status-tabs').innerHTML,/言えなかった/);
assert.equal(submits,1);
assert.equal(logs,1);
assert.equal(workspace.dataset.status,'all');
const click=(selector,dataset)=>{
  const target={dataset,closest:q=>{
    if(q===selector || (q==='#ranking-container' && selector==='[data-feedback-action]'))return target;
    return null;
  }};
  handlers.click({target});
};

click('#snapshot-category-tabs [data-category]',{category:'detail'});
assert.match(getId('snapshot-list-title').textContent,/位置・背景/);
assert.match(getId('snapshot-item-grid').innerHTML,/There is a tree./);
assert.match(getId('snapshot-item-grid').innerHTML,/The boy is outside./);
assert.equal((getId('snapshot-item-grid').innerHTML.match(/snapshot-item-mark/g)||[]).length,2);
assert.equal(getId('snapshot-item-grid').scrollTop,0,'category changes reset list scroll');
click('#snapshot-status-tabs [data-status]',{status:'cleared'});
assert.equal(workspace.dataset.status,'cleared');
assert.equal((getId('snapshot-item-grid').innerHTML.match(/class="snapshot-item-row"/g)||[]).length,1);
assert.match(getId('snapshot-item-grid').innerHTML,/There is a tree./);
click('#snapshot-status-tabs [data-status]',{status:'missed'});
assert.match(getId('snapshot-item-grid').innerHTML,/The boy is outside./);
click('#snapshot-status-tabs [data-status]',{status:'all'});
assert.equal((getId('snapshot-item-grid').innerHTML.match(/class="snapshot-item-row"/g)||[]).length,2);
click('[data-feedback-action]',{feedbackAction:'audio',index:'0'});
assert.equal(audios,1);
assert.equal(practices,0);
assert.equal(logs,1);
for (const selector of ['.snapshot-categories','.snapshot-category-tab','.snapshot-expression-list',
  '@media (max-width:699px)','.snapshot-item-mark'])
 assert.ok(css.includes(selector),selector+' missing in css');
assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/\.snapshot-category-icon \.snapshot-icon-svg/);
assert.match(css,/\.snapshot-category-name \{/);
assert.match(css,/white-space:normal!important/);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/); // phones
assert.match(css,/visibility:visible!important/);

assert.match(css,/overflow-y:auto/);
const play=fs.readFileSync(new URL('../play.html',import.meta.url),'utf8');
assert.match(play,/20261112-visible-svg-icons-v2/);
console.log('Snapshot four-tab, ○× listing, actions, scrolling, CSS layout and data integrity tests passed');
