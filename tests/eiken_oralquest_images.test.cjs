// Run: node tests/eiken_oralquest_images.test.cjs
// Verifies planning data only. No image assets are required yet.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'data','eiken_oralquest');
const index=JSON.parse(fs.readFileSync(path.join(dir,'image_prompts.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
assert.equal(index.totalCompositeImages,120);
assert.equal(index.totalOptionalPanelImages,270);
assert.equal(index.generated,false);
assert.equal(index.images.length,120);
assert.equal(manifest.published,false);
const names=new Set(), cardIds=new Set();
let panelCount=0;
for(const group of manifest.grades){
 const cards=JSON.parse(fs.readFileSync(path.join(dir,group.file),'utf8'));
 const images=index.images.filter(i=>i.gradeKey===group.key);
 assert.equal(images.length,30,group.key);
 for(const card of cards){
  const entry=images.find(i=>i.id===card.id);
  assert.ok(entry,'missing '+card.id);
  assert.equal(card.visual.plannedImageSrc,entry.imagePath);
  assert.equal(card.visual.imageSrc,null);
  assert.equal(card.visual.status,'pending');
  assert.equal(card.visual.promptId,entry.id);
  assert.equal(entry.imagePath.endsWith('/'+card.id+'.webp'),true);
  assert.ok(entry.prompt.includes('ORIGINAL'),entry.id);
  assert.ok(entry.prompt.includes('NO written words'),entry.id);
  assert.equal(names.has(entry.imagePath),false,'duplicate file');
  assert.equal(cardIds.has(entry.id),false,'duplicate card');
  names.add(entry.imagePath);cardIds.add(entry.id);
  assert.equal(entry.panelFiles.length,entry.panels===1?0:entry.panels);
  assert.equal(entry.panelPrompts.length,entry.panelFiles.length);
  panelCount+=entry.panelFiles.length;
 }
}
assert.equal(names.size,120);assert.equal(panelCount,270);
const ui=fs.readFileSync(path.join(root,'eiken-oralquest.html'),'utf8');
const js=fs.readFileSync(path.join(root,'js','eiken_oralquest.js'),'utf8');
const main=fs.readFileSync(path.join(root,'js','main.js'),'utf8');
const home=fs.readFileSync(path.join(root,'play.html'),'utf8');
new Function(js);new Function(main);
assert.ok(home.includes('href="eiken-oralquest.html"'));
assert.ok(ui.includes('id="oq-grade-grid"'));
assert.ok(ui.includes('id="oq-stage-groups"'));
assert.ok(ui.includes('id="oq-practice"'));
assert.ok(ui.includes('href="play.html?oralquestLegacy=1"'));
console.log('Oral Quest UI/image plans valid: 120 cards, 120 composite filenames, 270 optional panel prompts. No images published.');
