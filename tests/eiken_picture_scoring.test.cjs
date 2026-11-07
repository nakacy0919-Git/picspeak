// Run: node tests/eiken_picture_scoring.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const scorer=require('../js/eiken_picture_scoring.js');
const dir=path.resolve(__dirname,'../data/eiken_oralquest');
const data=(name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const index=data('image_scoring_manifest.json');
const grade=data('grade3.json');
const ids=['e3_001','e3_002','e3_003','e3_004','e3_005'];
assert.equal(index.cards.length,120);
assert.equal(grade.length,30);
assert.deepEqual(index.cards.filter(c=>c.rubricFile).map(c=>c.cardId),ids);
for(const c of grade){
 assert.equal(c.visual.imageSrc,null,'No binary image committed on branch: '+c.id);
 if(c.stage>5) assert.equal(index.cards.find(x=>x.cardId===c.id).rubricFile,null);
}
const rub=ids.map(id=>{
 const r=data('scoring_rubrics/'+id+'.json');
 assert.equal(r.imageChecked,true);
 assert.equal(r.notOfficialEikenScore,true);
 assert.equal(r.freeDescription.facts.reduce((s,f)=>s+f.points,0),100);
 return r;
});
const cases=[
 [0,'free',0,'A boy is reading a book. A girl is carrying three books. A librarian is at the counter in a library.',100],
 [0,'q',2,'He is reading a book.',100],
 [0,'q',3,'Three books.',100],
 [1,'free',0,'A girl is watering flowers. A boy is planting seeds. A bucket is next to a bench. They are in a school garden.',100],
 [1,'q',2,'She is watering the flowers.',100],
 [1,'q',2,'The boy is watering the flowers.',0],
 [1,'q',3,'Next to the bench.',100],
 [1,'q',3,'Under the bench.',0],
 [2,'free',0,'A girl is holding an umbrella. A boy is wearing a yellow raincoat. A bicycle is next to a tree. It is raining.',100],
 [2,'q',2,'She is holding an umbrella.',100],
 [2,'q',2,'The boy is holding an umbrella.',0],
 [2,'q',3,'Next to the tree.',100],
 [2,'q',3,'Under the tree.',0],
 [3,'free',0,'A father is cutting carrots. His daughter is washing tomatoes. There are three plates on the table. They are cooking in the kitchen.',100],
 [3,'q',2,'He is cutting carrots.',100],
 [3,'q',2,'The girl is cutting carrots.',0],
 [3,'q',3,'There are three plates.',100],
 [3,'q',3,'Two plates.',0],
 [4,'free',0,'A zookeeper is feeding a giraffe. Two children are watching the giraffe. The giraffe is eating leaves. They are at the zoo.',100],
 [4,'q',2,'He is feeding a giraffe.',100],
 [4,'q',2,'The girl is feeding a giraffe.',0],
 [4,'q',3,'Two.',100],
 [4,'q',3,'Three.',0]
];
for(const [i,t,num,answer,expected] of cases){
 const score=t==='free'?scorer.scoreFree(rub[i],answer):scorer.scoreQuestion(rub[i],num,answer);
 assert.equal(score.score,expected,answer);
}
console.log('Hand-drawn Eiken Grade 3: 5 illustrated rubrics active, '+cases.length+' scoring checks pass; 25 images pending.');
