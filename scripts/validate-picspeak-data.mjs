// Static PicSpeak content checks (run with: node scripts/validate-picspeak-data.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const file=p=>path.join(root,p);
const read=p=>{
 try {const raw=fs.readFileSync(file(p),'utf8');if(!raw.trim())throw Error('empty file');return JSON.parse(raw);}
 catch(e){errors.push(p+': '+e.message);return null;}
};
const exists=p=>fs.existsSync(file(p));
const walk=dir=>{
 for(const entry of fs.readdirSync(file(dir),{withFileTypes:true})){
  const rel=path.posix.join(dir,entry.name);
  if(entry.isDirectory())walk(rel);else if(rel.endsWith('.json'))read(rel);
 }
};
walk('data');
const themeIds=read('data/theme_list.json')||[];
const catalog=read('data/theme_catalog.json')||[];
const mosaic=read('data/mosaic_list.json')||[];
const oral=read('data/oralquest_list.json')||[];
const detective=read('data/detective_list.json')||[];
const stories=read('data/story_list.json')||[];
const cats=read('data/picflash/categories.json')||[];
const ensureFile=p=>{if(!exists(p))errors.push('missing '+p);};
for(const id of themeIds)ensureFile('data/themes/'+id+'.json');
for(const item of catalog)if(item.imageSrc)ensureFile(item.imageSrc);
if(themeIds.length!==catalog.length)errors.push('theme list/catalog count mismatch');
for(const item of mosaic){ensureFile('data/mosaic/'+item.id+'.json');if(item.data?.imageSrc)ensureFile(item.data.imageSrc);}
for(const item of oral){ensureFile('data/oralquest/'+item.id+'.json');if(item.imageSrc)ensureFile(item.imageSrc);}
for(const item of detective){ensureFile('data/detective/'+item.id+'.json');}
for(const id of stories)ensureFile('data/stories/'+id+'.json');
for(const category of cats) {
 const cards=read('data/picflash/'+category.id+'.json')||[];
 if(!cards.length)errors.push('empty category '+category.id);
 const ids=new Set();
 for(const card of cards){
  if(ids.has(card.id))errors.push('duplicate '+category.id+'/'+card.id);
  ids.add(card.id);
  if(!card.targets?.['en-US']?.length)errors.push('missing en-US '+category.id+'/'+card.id);
  if(Object.keys(card.targets||{}).length!==19)errors.push('language count '+category.id+'/'+card.id);
  if(!card.img||!exists(card.img))errors.push('missing image '+category.id+'/'+card.img);
 }
}
if(errors.length){console.error('Data checks failed:\n'+errors.join('\n'));process.exitCode=1;}
else console.log('PicSpeak dataset checks passed: '+themeIds.length+' themes, '+mosaic.length+' mosaics, '+cats.length+' flash categories');
