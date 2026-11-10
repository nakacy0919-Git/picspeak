// js/scoring.js
// ==========================================
// スコアリングおよび達成率計算システム (厳格＆バケツ方式版)
// ==========================================

window.currentScore = 0;
window.foundWordsSet = new Set();
window.foundChunksSet = new Set();
window.foundSentencesSet = new Set();

window.STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 
    'in', 'on', 'at', 'to', 'of', 'and', 'it', 'he', 'she', 'they', 
    'with', 'for', 'there', 'some'
]);

window.getAggregatedData = function(theme, level) {
    const data = { words: [], chunks: [], sentences: [] };
    if (!theme || !theme.scoringData) return data;

    const levelsToInclude = [];
    if (level === 'elementary') levelsToInclude.push('elementary');
    else if (level === 'junior_high') levelsToInclude.push('elementary', 'junior_high');
    else if (level === 'high_school') levelsToInclude.push('elementary', 'junior_high', 'high_school');

    levelsToInclude.forEach(lvl => {
        if (theme.scoringData[lvl]) {
            data.words.push(...(theme.scoringData[lvl].words || []));
            data.chunks.push(...(theme.scoringData[lvl].chunks || []));
            data.sentences.push(...(theme.scoringData[lvl].sentences || []));
        }
    });
    // De-duplicate inherited targets across school levels.
    for (const kind of ['words','chunks','sentences']) {
      const seen=new Set();
      data[kind]=data[kind].filter(item=>{
        const key=String(item?.text||'').trim().toLowerCase().replace(/\s+/g,' ');
        if(!key||seen.has(key))return false;
        seen.add(key);return true;
      });
    }
    return data;
};

// Target expression coverage; not pronunciation or grammar accuracy.
window.picSpeakTokens = text => String(text||'').toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9'\s]/g,' ').trim().split(/\s+/).filter(Boolean);
window.picSpeakEscapeHTML = value => String(value??'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
window.picSpeakWordEquivalent = function(expected, actual) {
  if(expected===actual)return true;
  if(expected.length<3)return false;
  const forms=new Set([expected+'s',expected+'es',expected+'ed',expected+'ing']);
  if(expected.endsWith('e')){forms.add(expected+'d');forms.add(expected.slice(0,-1)+'ing');}
  if(expected.endsWith('y'))forms.add(expected.slice(0,-1)+'ies');
  if(/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(expected))forms.add(expected+expected.slice(-1)+'ing');
  return forms.has(actual);
};
window.picSpeakMatchPhrase = function(target,transcript,allowInflections=false) {
  const a=window.picSpeakTokens(target),b=window.picSpeakTokens(transcript);
  if(!a.length||a.length>b.length)return false;
  for(let i=0;i<=b.length-a.length;i++){
    if(a.every((w,j)=>allowInflections?window.picSpeakWordEquivalent(w,b[i+j]):w===b[i+j]))return true;
  }
  return false;
};
window.picSpeakKeywordHits = function(transcript, keywords) {
  const unique=[...new Set((Array.isArray(keywords)?keywords:[]).map(k=>String(k).trim().toLowerCase()).filter(Boolean))];
  return unique.filter(k=>window.picSpeakMatchPhrase(k,transcript,true));
};
window.picSpeakAnswerRating = function(transcript,keywords,modelAnswers) {
  const said=window.picSpeakTokens(transcript);
  if(said.length<3)return 0;
  const hits=window.picSpeakKeywordHits(transcript,keywords);
  const exactModel=(Array.isArray(modelAnswers)?modelAnswers:[]).some(m=>window.picSpeakTokens(m).join(' ')===said.join(' '));
  if(said.length>=4&&(exactModel||hits.length>=2))return 2;
  return hits.length>=1?1:0;
};
window.picSpeakOrderedWordAccuracy = function(expected,transcript) {
  const a=window.picSpeakTokens(expected),b=window.picSpeakTokens(transcript);
  if(!a.length)return 0;
  const prev=new Uint16Array(b.length+1);
  for(let i=1;i<=a.length;i++){let diag=0;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=a[i-1]===b[j-1]?diag+1:Math.max(prev[j],prev[j-1]);diag=old;}}
  return Math.round(prev[b.length]*100/a.length);
};
window.flexibleMatch = function(target,spokenWordsArray,itemType) {
  const transcript=Array.isArray(spokenWordsArray)?spokenWordsArray.join(' '):spokenWordsArray;
  return window.picSpeakMatchPhrase(target,transcript,itemType==='word');
};

window.calculateScore = function(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    if (window.appState && window.appState.selectedMode === 'ngword' && typeof window.ngWordGame !== 'undefined') {
        if (window.ngWordGame.checkNgWord(transcript)) {
            return null; 
        }
    }

    // Use identical token normalization for the target and confirmed speech.
    // Stripping apostrophes only on the speech side caused false negatives.
    const spokenWordsArray = window.picSpeakTokens(transcript);
    const targetData = window.getAggregatedData(theme, selectedLevel);

    let newWords = [];
    let newChunks = [];
    let newSentences = [];
    let pointsToAdd = 0;

    targetData.words.forEach(wordObj => {
        if (!window.foundWordsSet.has(wordObj.text) && window.flexibleMatch(wordObj.text, spokenWordsArray, 'word')) {
            window.foundWordsSet.add(wordObj.text);
            newWords.push(wordObj.text);
            pointsToAdd += (wordObj.points || 10);
        }
    });

    targetData.chunks.forEach(chunkObj => {
        if (!window.foundChunksSet.has(chunkObj.text) && window.flexibleMatch(chunkObj.text, spokenWordsArray, 'chunk')) {
            window.foundChunksSet.add(chunkObj.text);
            newChunks.push(chunkObj.text);
            pointsToAdd += (chunkObj.points || 50);
        }
    });

    targetData.sentences.forEach(sentenceObj => {
        if (!window.foundSentencesSet.has(sentenceObj.text) && window.flexibleMatch(sentenceObj.text, spokenWordsArray, 'sentence')) {
            window.foundSentencesSet.add(sentenceObj.text);
            newSentences.push(sentenceObj);
            pointsToAdd += (sentenceObj.points || 200);
        }
    });

    const newHitsCount = newWords.length + newChunks.length + newSentences.length;
    if (newHitsCount > 0) {
        const chunkCombo = window.foundChunksSet.size * 0.2;
        const sentenceCombo = window.foundSentencesSet.size * 0.5;
        const totalMultiplier = 1.0 + chunkCombo + sentenceCombo;
        const finalPoints = Math.floor(pointsToAdd * totalMultiplier);
        window.currentScore += finalPoints;

        return {
            score: window.currentScore, addedPoints: finalPoints, multiplier: totalMultiplier.toFixed(1),
            newWords, allFoundWords: Array.from(window.foundWordsSet), allFoundChunks: Array.from(window.foundChunksSet),
            allFoundSentences: Array.from(window.foundSentencesSet), isPerfect: newSentences.length > 0 
        };
    }
    return null; 
};

window.resetScore = function() {
    window.currentScore = 0; 
    window.foundWordsSet.clear(); 
    window.foundChunksSet.clear(); 
    window.foundSentencesSet.clear();
};

window.getCompletionStats = function(theme, selectedLevel, overrideFoundSets = null) {
    const targetData = window.getAggregatedData(theme, selectedLevel);
    const scoredWords = overrideFoundSets?.words || window.foundWordsSet;
    const scoredChunks = overrideFoundSets?.chunks || window.foundChunksSet;
    const scoredSentences = overrideFoundSets?.sentences || window.foundSentencesSet;
    
    // ★ 各要素の評価ウェイト（合計100%）と、それを満たすための「目標ポイント」
    const CATEGORY_TARGETS = {
      object:{weight:20},attribute:{weight:20},detail:{weight:20},gist:{weight:40}
    };
    const CATEGORY_ALIASES={
      object:'object',person:'object',animal:'object',food:'object',clothing:'object',material:'object',
      attribute:'attribute',description:'attribute',emotion:'attribute',state:'attribute',color:'attribute',weather:'attribute',
      detail:'detail',location:'detail',place:'detail',background:'detail',event:'detail',time:'detail',number:'detail',
      gist:'gist',inference:'gist',action:'gist',concept:'gist',reason:'gist',purpose:'gist'
    };
    const normalizedCategory=(item,kind)=>CATEGORY_ALIASES[String(item.category||item.type||'').trim().toLowerCase()]
      || ({words:'object',chunks:'detail',sentences:'gist'}[kind]||'gist');

    const categoryStats = {
        "object": { label: "Object (物体・人物)", earned: 0, max: 0, cleared: [], missed: [] },
        "attribute": { label: "Attribute (属性・状態)", earned: 0, max: 0, cleared: [], missed: [] },
        "detail": { label: "Detail (詳細・背景)", earned: 0, max: 0, cleared: [], missed: [] },
        "gist": { label: "Gist (要点・推測)", earned: 0, max: 0, cleared: [], missed: [] },
        "other": { label: "Others (その他)", earned: 0, max: 0, cleared: [], missed: [] }
    };

    const processItems = (items, foundSet, fallbackPoints, kind) => {
        items.forEach(item => {
            const pts = item.points || fallbackPoints;
            const rawCategory=normalizedCategory(item,kind);

            categoryStats[rawCategory].max += pts;

            if (foundSet.has(item.text)) {
                categoryStats[rawCategory].earned += pts;
                categoryStats[rawCategory].cleared.push(item);
            } else {
                categoryStats[rawCategory].missed.push(item);
            }
        });
    };

    // 理論上のポイントは 単語10pt、チャンク20pt、文章40pt をベースとする
    processItems(targetData.words, scoredWords, 10, 'words');
    processItems(targetData.chunks, scoredChunks, 20, 'chunks');
    processItems(targetData.sentences, scoredSentences, 40, 'sentences');

    let completionRate = 0;
    let totalValidWeight = 0;

    // 写真によっては特定のカテゴリー（例：detailがない等）が存在しない場合の救済処理
    Object.keys(CATEGORY_TARGETS).forEach(key => {
        if (categoryStats[key].max > 0) {
            totalValidWeight += CATEGORY_TARGETS[key].weight;
        }
    });
    const weightMultiplier = totalValidWeight > 0 ? (100 / totalValidWeight) : 1;
    
    // True coverage of all unique targets, not a capped point threshold.
    Object.keys(CATEGORY_TARGETS).forEach(key=>{
      const cat=categoryStats[key];
      const weight=CATEGORY_TARGETS[key].weight*weightMultiplier;
      const rate=cat.max>0?Math.min(1,cat.earned/cat.max):0;
      completionRate+=rate*weight;
      cat.matchRate=Math.floor(rate*100);
    });

    // other（その他）の表示用計算
    if (categoryStats.other.max > 0) {
        categoryStats.other.matchRate = Math.min(100, Math.floor((categoryStats.other.earned / categoryStats.other.max) * 100));
    }

    completionRate = Math.min(100, Math.floor(completionRate));

    return {
        completionRate,
        missedWords: targetData.words.filter(w => !scoredWords.has(w.text)),
        missedChunks: targetData.chunks.filter(c => !scoredChunks.has(c.text)),
        missedSentences: targetData.sentences.filter(s => !scoredSentences.has(s.text)),
        clearedWords: targetData.words.filter(w => scoredWords.has(w.text)),
        clearedChunks: targetData.chunks.filter(c => scoredChunks.has(c.text)),
        clearedSentences: targetData.sentences.filter(s => scoredSentences.has(s.text)),
        categories: categoryStats 
    };
};

// Pure, non-mutating Snapshot preview. The 4-category coverage and points use
// precisely the same source targets and matching logic as the final scoring.
// Interim ASR text may be previewed, but it must NOT enter found* sets.
window.getSnapshotScorePreview = function(transcript, theme, level) {
    const spoken = String(transcript || '');
    const data = window.getAggregatedData(theme, level);
    const sets = {words:new Set(),chunks:new Set(),sentences:new Set()};
    const pointDefaults = {words:10,chunks:50,sentences:200};
    let points = 0;
    for (const kind of ['words','chunks','sentences']) {
        const itemType = kind === 'words' ? 'word' : kind === 'chunks' ? 'chunk' : 'sentence';
        for (const item of data[kind]) {
            if (!item?.text || !window.flexibleMatch(item.text,spoken,itemType)) continue;
            sets[kind].add(item.text);
            points += item.points || pointDefaults[kind];
        }
    }
    const multiplier = 1 + sets.chunks.size * 0.2 + sets.sentences.size * 0.5;
    const score = Math.floor(points * multiplier);
    const stats = window.getCompletionStats(theme,level,sets);
    return {score,completionRate:stats.completionRate,stats,sets};
};
