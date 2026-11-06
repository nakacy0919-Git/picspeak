// Run: node tests/eiken_oralquest_content.test.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.join(__dirname, '..', 'data', 'eiken_oralquest');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'),'utf8'));
assert.equal(manifest.published,false);
assert.equal(manifest.totalCards,120);
assert.equal(manifest.totalOralQuestions,540);
const seen=new Set();
let totalCards=0,totalQuestions=0;
for (const spec of manifest.grades) {
 const cards=JSON.parse(fs.readFileSync(path.join(dir,spec.file),'utf8'));
 assert.equal(cards.length,30,spec.file);
 for (const [index,card] of cards.entries()) {
  const stage=index+1;
  assert.equal(card.stage,stage);
  assert.ok(!seen.has(card.id),'duplicate '+card.id); seen.add(card.id);
  assert.equal(card.band,stage<=10?'guided':stage<=20?'practice':'mock');
  assert.equal(card.questions.length,spec.questionsPerCard,card.id);
  assert.ok(card.title && card.grade===spec.key,card.id);
  assert.equal(card.visual.status,'pending');
  assert.equal(card.visual.imageSrc,null);
  for (const q of card.questions) {
   assert.ok(q.prompt && q.modelAnswers.length>0 && q.modelAnswers.every(Boolean),card.id);
  }
  if (spec.key==='pre1') {
   assert.equal(card.visual.panels.length,4,card.id);
   assert.ok(card.narration.modelAnswers[0].startsWith(card.storyLeadIn),card.id);
   assert.ok(card.narration.wordCount>=75 && card.narration.wordCount<=130,card.id);
  } else {
   const range=spec.key==='3'?[27,42]:spec.key==='pre2'?[45,60]:[55,70];
   assert.ok(card.passage.wordCount>=range[0]&&card.passage.wordCount<=range[1],card.id);
   assert.equal(card.passage.wordCount,card.passage.text.trim().split(/\s+/).length,card.id);
   if (spec.key==='2') {
    assert.equal(card.visual.panels.length,3,card.id);
    assert.ok(card.questions[1].modelAnswers[0].startsWith(card.storyLeadIn),card.id);
   }
   if (spec.key==='pre2') assert.equal(card.visual.panels.length,2,card.id);
  }
  totalQuestions+=card.questions.length;totalCards++;
 }
}
assert.equal(totalCards,manifest.totalCards);
assert.equal(totalQuestions,manifest.totalOralQuestions);
console.log(`Eiken Oral Quest content validated: ${totalCards} cards, ${totalQuestions} questions, no images published.`);
