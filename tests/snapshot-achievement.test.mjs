import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const w={};
vm.runInNewContext(fs.readFileSync(new URL('../js/scoring.js',import.meta.url),'utf8'),{window:w});
const cafe=JSON.parse(fs.readFileSync(new URL('../data/themes/theme_l2_024.json',import.meta.url)));
const preview=(t,l,text)=>w.getSnapshotScorePreview(text,t,l);
const elementary=cafe.scoringData.elementary.sentences;
assert.equal(preview(cafe,'elementary',elementary.slice(0,4).map(s=>s.text).join(' ')).completionRate,100);
const noState=[elementary[0],elementary[1],elementary[3]].map(s=>s.text).join(' ');
assert.equal(preview(cafe,'elementary',noState).completionRate,75);
assert.ok(preview(cafe,'elementary',Array(4).fill(elementary[0].text).join(' ')).completionRate<100);
assert.ok(preview(cafe,'high_school',elementary.slice(0,4).map(s=>s.text).join(' ')).completionRate<=70);
assert.ok(preview(cafe,'elementary','friend happy cafe talk').completionRate<=70);
assert.equal(preview(cafe,'elementary','').completionRate,0);
const before=w.foundSentencesSet.size;
preview(cafe,'elementary',elementary.map(s=>s.text).join(' '));
assert.equal(w.foundSentencesSet.size,before,'preview must not mutate confirmed speech');
let levels=0;let near=0;const lows=[];
for(const id of JSON.parse(fs.readFileSync(new URL('../data/theme_list.json',import.meta.url)))){
 let t=JSON.parse(fs.readFileSync(new URL('../data/themes/'+id+'.json',import.meta.url)));if(Array.isArray(t))t=t[0];
 for(const l of ['elementary','junior_high','high_school']){
  const models=t.scoringData[l].sentences;
  const result=preview(t,l,models.map(s=>s.text).join(' '));
  assert.equal(preview(t,l,models.slice(0,4).map(s=>s.text).join(' ')).completionRate,100,'four models '+id+'/'+l);
  levels++;if(result.completionRate>=90)near++;else lows.push([id,l,result.completionRate]);
  for(const missing of ['object','attribute','detail','gist']){
   const sets={words:new Set(),chunks:new Set(),sentences:new Set()};
   // Explicit empty speech never acquires a category by normalization.
   assert.equal(w.getCompletionStats(t,l,sets).categories[missing].matchRate,0);
  }
 }
}
console.log('Cafe first four models: 100%; without state: 75%; repetition and level gates passed.');
console.log('Model-only audit:',near,'of',levels,'levels >=90%. Below:',JSON.stringify(lows));
