// Run: node tests/eiken_picture_scoring.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const scoring=require('../js/eiken_picture_scoring.js');
const root=path.resolve(__dirname,'../data/eiken_oralquest/');
const get=id=>JSON.parse(fs.readFileSync(path.join(root,'scoring_rubrics',id+'.json'),'utf8'));
const a=get('e3_001'),b=get('e3_002');
let checked=0;
function expectScore(rubric,kind,num,text,expected){
  const result=kind==='free'?scoring.scoreFree(rubric,text):scoring.scoreQuestion(rubric,num,text);
  assert.ok(result,'scoring result absent');
  assert.equal(result.score,expected,rubric.cardId+': '+text+' expected '+expected+' got '+result.score);
  assert.equal(result.practiceOnly,true);
  checked++;
}
expectScore(a,'free',null,'A boy is reading a book at a table. A girl is holding three books. The librarian is at the counter. They are in the library.',100);
expectScore(a,'q',2,'He is reading a book.',100);
expectScore(a,'q',2,'Reading a book.',100);
expectScore(a,'q',2,'The girl is reading a book.',0);
expectScore(a,'q',3,'Three.',100);
expectScore(a,'q',3,'She is carrying three books.',100);
expectScore(a,'q',3,'Two books.',0);
expectScore(b,'free',null,'A girl is watering the flowers. A boy is planting seeds. There is a bucket next to the bench. They are in the school garden.',100);
expectScore(b,'free',null,'The boy is watering the flowers. The girl is planting seeds. There is a bucket near the bench. They are in the garden.',30);
expectScore(b,'q',2,'She is watering the flowers.',100);
expectScore(b,'q',2,'She is giving water to the plants.',100);
expectScore(b,'q',2,'Watering the flowers.',100);
expectScore(b,'q',2,'The girl is watering.',55);
expectScore(b,'q',2,'The boy is watering the flowers.',0);
expectScore(b,'q',2,'The girl is not watering the flowers.',0);
expectScore(b,'q',3,'It is near the bench.',100);
expectScore(b,'q',3,'The bucket is beside the bench.',100);
expectScore(b,'q',3,'Next to the bench.',100);
expectScore(b,'q',3,'The bucket is under the bench.',0);
expectScore(b,'q',3,'The bucket is far from the bench.',0);
expectScore(b,'q',3,'The bucket is near the building.',0);
assert.equal(scoring.scoreFree(null,'A girl is watering flowers.'),null);
const index=JSON.parse(fs.readFileSync(path.join(root,'image_scoring_manifest.json'),'utf8'));
assert.equal(index.cards.length,120);
assert.equal(index.cards.filter(c=>c.rubricFile).length,2);
for(const card of index.cards.filter(c=>c.rubricFile)){
 const rubric=get(card.cardId);
 assert.equal(rubric.cardId,card.cardId);
 assert.equal(rubric.imageChecked,true);
 assert.equal(rubric.notOfficialEikenScore,true);
 assert.equal(rubric.freeDescription.facts.reduce((n,x)=>n+x.points,0),100);
}
console.log('Eiken picture scoring tests passed:',checked,'scenarios, 2 image-reviewed rubrics, 118 pending.');
