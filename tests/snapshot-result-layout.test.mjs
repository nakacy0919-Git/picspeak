import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scoring=fs.readFileSync(new URL('../js/scoring.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../js/snapshot_result_ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../css/snapshot_result.css',import.meta.url),'utf8');
const handlers={},elements={};
const cl=()=>({hidden:true,add(k){if(k==='hidden')this.hidden=true},
  remove(k){if(k==='hidden')this.hidden=false},contains(k){return k==='hidden'&&this.hidden},
  toggle(){}});
const view={classList:cl(),style:{removeProperty(){},height:''}};
const host={innerHTML:'',removeAttribute(){},parentElement:{removeAttribute(){}}};
const workspace={dataset:{}};
const el=id=>{
  if(id==='view-result')return view;
  if(id==='ranking-container')return host;
  return elements[id] ||= {
    id,innerHTML:'',textContent:'',scrollTop:24,classList:cl(),attributes:{},style:{},
    setAttribute(k,v){this.attributes[k]=v},querySelector(){return {focus(){}}},
    querySelectorAll(){return []},focus(){this.focused=true}
  };
};
const doc={
  readyState:'complete',getElementById:el,activeElement:null,
  querySelector:q=>q.includes('.snapshot-review-list')?workspace:null,
  addEventListener:(name,fn)=>{handlers[name]=fn}
};
const w={
  renderSnapshotResult(){},appState:{selectedMode:'snapshot',selectedLevel:'junior_high',customTimeLimit:30},
  snapshotVerifiedTranscript:'boy happy park running',snapshotVerifiedSeconds:30
};
vm.runInNewContext(scoring,{window:w,Set,Map,String,Number,Math,Array,console});
const words=['boy','happy','park','running'].map((text,i)=>({
  text,ja:'日本語',category:['object','attribute','detail','gist'][i],points:10
}));
const sentences=[
  {text:'The boy is happy.',ja:'少年は幸せです。',category:'object',coverageCategories:['object','attribute'],points:40},
  {text:'The park is nearby.',ja:'公園は近くです。',category:'detail',coverageCategories:['detail'],points:40},
  {text:'The boy is running.',ja:'少年は走っています。',category:'gist',coverageCategories:['gist'],points:40},
  {text:'It is sunny.',ja:'晴れています。',category:'attribute',coverageCategories:['attribute'],points:40}
];
w.currentTheme={id:'test',scoringData:{junior_high:{words,chunks:[],sentences}}};
words.forEach(word=>w.foundWordsSet.add(word.text));
assert.equal(w.getCompletionStats(w.currentTheme,'junior_high').completionRate,70);
let submissions=0,logs=0,audios=0,practices=0;
w.setupSubmitButton=()=>{submissions++};
w.saveLearningLog=()=>{logs++};
w.playResultTTS=()=>{audios++};
w.openPractice=()=>{practices++};
el('scoreDisplay').textContent='280';
vm.runInNewContext(source,{window:w,document:doc,Set,Map,String,Number,Math,Array,console});
w.renderSnapshotResult();

const button=(dataset,selector)=>({
  dataset,focused:false,focus(){this.focused=true},
  closest(q){return q===selector||q==='#ranking-container'?this:null}
});
const click=(b)=>handlers.click({target:b});
const tabs=el('snapshot-category-tabs').innerHTML;
for(const name of ['物・人','様子・色','位置・背景','動き・要点'])assert.ok(tabs.includes(name));
assert.equal((tabs.match(/class="snapshot-category-tab"/g)||[]).length,4);
assert.equal((tabs.match(/class="snapshot-icon-svg"/g)||[]).length,4);
assert.doesNotMatch(tabs,/snapshot-category-hint|人や物の名前|色・形・様子|場所・周りの様子|動作・伝えたいこと/);
assert.match(host.innerHTML,/id="snapshot-review-dialog"/);
assert.match(host.innerHTML,/snapshot-goal-button/);
assert.match(host.innerHTML,/あと30％/);
assert.equal(el('snapshot-review-dialog').classList.hidden,true);
assert.equal(submissions,1);
assert.equal(logs,1);

const categoryButton=button({category:'detail'},'#snapshot-category-tabs [data-category]');
click(categoryButton);
assert.equal(el('snapshot-review-dialog').classList.hidden,false,'category popup opens');
assert.match(el('snapshot-list-title').textContent,/位置・背景/);
assert.match(el('snapshot-item-grid').innerHTML,/×/);
assert.match(el('snapshot-item-grid').innerHTML,/○|The park is nearby/);
assert.equal(el('snapshot-item-grid').scrollTop,0);
const closeButton=button({feedbackAction:'close-review'},'[data-feedback-action]');
click(closeButton);
assert.equal(el('snapshot-review-dialog').classList.hidden,true,'close button works');
assert.equal(categoryButton.focused,true,'focus returns to the invoking button');

const goalButton=button({feedbackAction:'goal'},'[data-feedback-action]');
click(goalButton);
assert.equal(el('snapshot-review-dialog').classList.hidden,false,'goal popup opens');
assert.match(el('snapshot-list-description').textContent,/70％ → 100％/);
assert.equal((el('snapshot-item-grid').innerHTML.match(/class="snapshot-item-row"/g)||[]).length,3,
  'actual scoring formula requires three distinct level sentences');
assert.match(el('snapshot-list-tip').textContent,/音読練習だけでは今回の点数は変わりません/);
click(button({feedbackAction:'audio',index:'0'},'[data-feedback-action]'));
assert.equal(audios,1);
click(button({feedbackAction:'practice',index:'0'},'[data-feedback-action]'));
assert.equal(practices,1);
assert.equal(w.foundSentencesSet.size,0,'goal preview cannot change original score');
assert.equal(w.foundWordsSet.size,4);
assert.equal(logs,1,'history is saved only once');

assert.match(css,/min-height:73px!important/);
assert.match(css,/grid-template-columns:40px minmax\(0,1fr\)/);
assert.match(css,/snapshot-review-overlay\.hidden/);
assert.match(css,/snapshot-review-list\[data-mode="goal"\]/);
assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
const play=fs.readFileSync(new URL('../play.html',import.meta.url),'utf8');
assert.match(play,/20261112-compact-review-goal-v1/);
console.log('Snapshot compact iPad tabs, modal review, real scoring goal calculation and actions: PASS');
