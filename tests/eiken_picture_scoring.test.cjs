// Run: node tests/eiken_picture_scoring.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const scoring=require('../js/eiken_picture_scoring.js');
const root=path.resolve(__dirname,'../data/eiken_oralquest');
const index=JSON.parse(fs.readFileSync(path.join(root,'image_scoring_manifest.json'),'utf8'));
const cards=JSON.parse(fs.readFileSync(path.join(root,'grade3.json'),'utf8'));
assert.equal(index.cards.length,120);
assert.equal(cards.length,30);
const active=index.cards.filter(c=>c.rubricFile);
assert.equal(active.length,1,'Only Stage01 hand-drawn rubric may be active during redesign');
assert.equal(active[0].cardId,'e3_001');
for(const card of cards){
 assert.equal(card.visual.imageSrc,null,'GitHub image binary not committed: '+card.id);
 assert.equal(card.visual.redesignStyleVersion,'eiken-handdrawn-v2');
 const entry=index.cards.find(x=>x.cardId===card.id);
 assert.ok(entry,'missing scoring entry '+card.id);
 if(card.stage>1)assert.equal(entry.rubricFile,null,'old photo rubric must be disabled '+card.id);
}
const rubric=JSON.parse(fs.readFileSync(path.join(root,active[0].rubricFile),'utf8'));
assert.equal(rubric.imageChecked,true);
assert.equal(rubric.imageSha256,'46ba3b04c7ee8bd4896eb1e7595c3dabbde2bb7287db1df35efc5fcacceb03ba');
const checks=[
 ['free',0,'A boy is reading a book at the table. A girl is carrying three books. A librarian is behind the counter in the library.',100],
 ['q',2,'He is reading a book.',100],
 ['q',2,'The boy is reading.',100],
 ['q',2,'The girl is reading a book.',0],
 ['q',3,'She is carrying three books.',100],
 ['q',3,'Three.',100],
 ['q',3,'Two.',0]
];
for(const [kind,n,text,expected] of checks){
 const result=kind==='free'?scoring.scoreFree(rubric,text):scoring.scoreQuestion(rubric,n,text);
 assert.equal(result.score,expected,text);
}
console.log('Eiken Grade3 hand-drawn redesign: 1 verified sample, 29 pending, '+checks.length+' scoring regression cases.');
