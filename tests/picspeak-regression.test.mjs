import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(join(root,p),'utf8');
const win={};
vm.runInNewContext(read('js/scoring.js'),{window:win,Set,Math,Uint16Array,String,Number,Array,Object,console});
assert.equal(win.flexibleMatch('a girl is reading a book','book a reading is girl'.split(' '),'sentence'),false);
assert.equal(win.flexibleMatch('a girl is reading a book','a girl is reading a book'.split(' '),'sentence'),true);
assert.equal(win.picSpeakOrderedWordAccuracy('a girl is reading a book','a girl is reading a book'),100);
assert.ok(win.picSpeakOrderedWordAccuracy('a girl is reading a book','book a reading is girl')<70);
assert.equal(win.picSpeakOrderedWordAccuracy('the cat and the cat','the cat'),40);
vm.runInNewContext(read('js/story_scoring.js'),{window:win,Set,Math,console,document:{}});
assert.equal(win.picSpeakStoryMatchTarget({keywords:['ticket machine']},'the ticket machine is here'),true);
assert.equal(win.picSpeakStoryMatchTarget({keywords:['ticket machine']},'the machine has a ticket'),false);
assert.equal(win.picSpeakStoryMatchTarget({text:'She is reading a book'},'a book is on the floor'),false);
assert.equal(win.picSpeakStoryMatchTarget({text:'She is reading a book'},'she is reading a book'),true);
const mosaic=JSON.parse(read('data/mosaic_list.json'));
assert.equal(mosaic.length,35);
assert.equal(mosaic.some(x=>['mosaic_1003','mosaic_1014','mosaic_1022'].includes(x.id)),false);
const school=JSON.parse(read('data/picflash/school_subjects_and_stationery.json'));
const clubs=JSON.parse(read('data/picflash/school_clubs_and_events.json'));
assert.notDeepEqual(school,clubs);
assert.ok(clubs.length===31&&clubs.every(x=>Object.keys(x.targets).length===19));
assert.match(read('teacher.html'),/fetch\('data\/theme_catalog.json'\)/);
assert.match(read('js/oralquest_game.js'),/qaPercent\*0\.30/);
assert.match(read('bridge/copeak-lms-bridge.js'),/qaPercent\*0\.30/);
assert.match(read('bridge/copeak-lms-bridge.js'),/picSpeakStoryMatchTarget/);
const picflash=read('js/picflash.js');
const matcherSource=picflash.slice(picflash.indexOf('function checkIsCorrect'),picflash.indexOf('const SpeechRec'));
const checkFlash=vm.runInNewContext(matcherSource+'\ncheckIsCorrect',{normalizeJapanese:s=>s,STOP_WORDS:new Set()});
assert.equal(checkFlash({targets:{'en-US':['school festival']}},'festival school','en-US'),false);
assert.equal(checkFlash({targets:{'en-US':['school festival']}},'our school festival is tomorrow','en-US'),true);
const game=read('js/game.js');
assert.match(game,/const finishedTranscript = window\.rawTranscriptForCounting \|\| ""/);
assert.match(game,/highlightGlobalText\(finishedTranscript\)/);
assert.match(read('js/storage.js'),/同一端末・同一ブラウザ/);
const storyHtml=read('story.html');
assert.ok(storyHtml.indexOf('src="js/scoring.js"')<storyHtml.indexOf('src="js/story_scoring.js"'));
for(const path of ['js/scoring.js','js/oralquest_game.js','js/story_scoring.js','js/picflash.js','js/speech.js','js/game.js','js/storage.js','bridge/copeak-lms-bridge.js'])
 new vm.Script(read(path),{filename:path});

assert.equal(win.flexibleMatch('departure board','departure'.split(' '),'word'),false);
assert.equal(win.flexibleMatch('departure board','departure board'.split(' '),'word'),true);
assert.equal(win.picSpeakMatchPhrase('a girl is reading a book','book a reading is girl'),false);
assert.equal(win.picSpeakAnswerRating('the ticket machine is here',['ticket machine'],[]),1);
assert.equal(win.picSpeakAnswerRating('I do not like it',['train','bus'],[]),0);
const allThemes=JSON.parse(read('data/theme_list.json'));
const allLevels=['elementary','junior_high','high_school'];
let inspectedTargets=0,checkedLevels=0;
for (const id of allThemes) {
  const json=JSON.parse(read('data/themes/'+id+'.json'));
  const theme=Array.isArray(json)?json[0]:json;
  for (const level of allLevels) {
    const agg=win.getAggregatedData(theme,level);
    const all=[...agg.words,...agg.chunks,...agg.sentences];
    if (!all.length) continue;
    inspectedTargets+=all.length;checkedLevels++;
    win.foundWordsSet=new Set(agg.words.map(x=>x.text));
    win.foundChunksSet=new Set(agg.chunks.map(x=>x.text));
    win.foundSentencesSet=new Set(agg.sentences.map(x=>x.text));
    const full=win.getCompletionStats(theme,level);
    assert.equal(full.completionRate,100,'all targets covered '+id+'/'+level);
    win.foundWordsSet=new Set();
    win.foundChunksSet=new Set();
    win.foundSentencesSet=new Set();
    assert.equal(win.getCompletionStats(theme,level).completionRate,0,'zero targets covered '+id+'/'+level);
    if(all.length>1) {
      win.foundWordsSet=new Set(agg.words.slice(0,1).map(x=>x.text));
      assert.ok(win.getCompletionStats(theme,level).completionRate<100,'no premature 100% '+id+'/'+level);
    }
  }
}
const oralList=JSON.parse(read('data/oralquest_list.json'));
let inspectedQAs=0;
for (const item of oralList) {
  const json=JSON.parse(read('data/oralquest/'+item.id+'.json'));
  const lesson=Array.isArray(json)?json[0]:json;
  for(const question of [lesson.stage1.q1,...lesson.stage3.questions]){
    for(const answer of question.modelAnswers||[]){
      assert.equal(win.picSpeakAnswerRating(answer,question.keywords,question.modelAnswers),2,'model answer '+item.id);
      inspectedQAs++;
    }
  }
}
assert.match(read('js/main.js'),/window\.finishPracticeSuccess\(finalRate\)/);
assert.equal(win.picSpeakPracticeMatchRate('a girl is reading a book','a girl is reading a book'),100);
assert.equal(win.picSpeakPracticeMatchRate('the child is very happy','the child is very'),80);
assert.equal(win.picSpeakPracticeMatchRate('one two three four five six seven eight nine ten','one two three four five six seven eight nine'),90);
assert.ok(win.picSpeakPracticeMatchRate('a girl is reading a book','reading is a girl book')<80);
assert.ok(win.picSpeakPracticeMatchRate('a girl is reading a book','a girl is reading a book and some unrelated extra words')<80);
assert.equal(win.picSpeakPracticeMatchRate('cat','cat'),100);
assert.equal(win.picSpeakPracticeMatchRate('cat','dog'),0);
assert.match(read('js/game.js'),/syncSnapshotPreviewPins/);
assert.match(read('js/oralquest_game.js'),/picSpeakAnswerRating\(fullText/);
assert.match(read('bridge/copeak-lms-bridge.js'),/const mean=Math\.round\(reading\*0\.25/);
console.log('Scoring integrity:',checkedLevels,'theme levels,',inspectedTargets,'targets,',inspectedQAs,'Oral Quest model answers.');

console.log('PicSpeak regression checks passed');
