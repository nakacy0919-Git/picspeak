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
    return data;
};

window.flexibleMatch = function(targetText, spokenWordsArray, itemType) {
    if (!targetText) return false;
    const targetWords = targetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/);
    
    let wordsToMatch = targetWords;
    
    if (itemType === 'word') {
        const coreWords = targetWords.filter(w => !window.STOP_WORDS.has(w) && w.length > 0);
        wordsToMatch = coreWords.length > 0 ? coreWords : targetWords;
    }

    if (wordsToMatch.length === 0) return false;

    let matchCount = 0;
    wordsToMatch.forEach(w => {
        const isMatch = spokenWordsArray.some(spoken => {
            if (spoken === w) return true;
            if (spoken === w + 's' || spoken === w + 'es' || spoken === w + 'ing' || spoken === w + 'ed' || spoken === w + 'd') return true;
            if (w === spoken + 's' || w === spoken + 'es' || w === spoken + 'ing' || w === spoken + 'ed' || w === spoken + 'd') return true;
            return false;
        });
        if (isMatch) matchCount++;
    });

    const requiredRate = wordsToMatch.length <= 2 ? 1.0 : 0.8;
    return (matchCount / wordsToMatch.length) >= requiredRate;
};

window.calculateScore = function(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    if (window.appState && window.appState.selectedMode === 'ngword' && typeof window.ngWordGame !== 'undefined') {
        if (window.ngWordGame.checkNgWord(transcript)) {
            return null; 
        }
    }

    const spokenWordsArray = transcript.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
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

window.getCompletionStats = function(theme, selectedLevel) {
    const targetData = window.getAggregatedData(theme, selectedLevel);
    
    // ★ 各要素の評価ウェイト（合計100%）と、それを満たすための「目標ポイント」
    const CATEGORY_TARGETS = {
        object: { target: 40, weight: 20 },     // 40pt分言えれば20%獲得
        attribute: { target: 40, weight: 20 },  // 40pt分言えれば20%獲得
        detail: { target: 40, weight: 20 },     // 40pt分言えれば20%獲得
        gist: { target: 60, weight: 40 }        // 60pt分（文章など）言えれば40%獲得
    };

    const categoryStats = {
        "object": { label: "Object (物体・人物)", earned: 0, max: 0, cleared: [], missed: [] },
        "attribute": { label: "Attribute (属性・状態)", earned: 0, max: 0, cleared: [], missed: [] },
        "detail": { label: "Detail (詳細・背景)", earned: 0, max: 0, cleared: [], missed: [] },
        "gist": { label: "Gist (要点・推測)", earned: 0, max: 0, cleared: [], missed: [] },
        "other": { label: "Others (その他)", earned: 0, max: 0, cleared: [], missed: [] }
    };

    const processItems = (items, foundSet, fallbackPoints) => {
        items.forEach(item => {
            const pts = item.points || fallbackPoints;
            let rawCategory = item.category || item.type || "other";
            
            // 高度な情報である inference は gist（要点）の枠で高く評価する
            if (rawCategory === 'inference') rawCategory = 'gist';
            if (!categoryStats[rawCategory]) rawCategory = 'other';

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
    processItems(targetData.words, window.foundWordsSet, 10);
    processItems(targetData.chunks, window.foundChunksSet, 20);
    processItems(targetData.sentences, window.foundSentencesSet, 40);

    let completionRate = 0;
    let totalValidWeight = 0;

    // 写真によっては特定のカテゴリー（例：detailがない等）が存在しない場合の救済処理
    Object.keys(CATEGORY_TARGETS).forEach(key => {
        if (categoryStats[key].max > 0) {
            totalValidWeight += CATEGORY_TARGETS[key].weight;
        }
    });
    const weightMultiplier = totalValidWeight > 0 ? (100 / totalValidWeight) : 1;
    
    // バケツ方式で各カテゴリの達成率を計算
    Object.keys(CATEGORY_TARGETS).forEach(key => {
        const cat = categoryStats[key];
        const target = CATEGORY_TARGETS[key].target;
        const weight = CATEGORY_TARGETS[key].weight * weightMultiplier;
        
        // そのカテゴリーの問題数が少なく、目標ポイントに満たない場合は、ある分だけで満点とする
        const actualTarget = Math.min(target, cat.max > 0 ? cat.max : target);
        
        if (actualTarget > 0 && cat.max > 0) {
            const rate = Math.min(1.0, cat.earned / actualTarget);
            completionRate += rate * weight;
            cat.matchRate = Math.floor(rate * 100); 
        } else {
            cat.matchRate = 0;
        }
    });

    // other（その他）の表示用計算
    if (categoryStats.other.max > 0) {
        categoryStats.other.matchRate = Math.min(100, Math.floor((categoryStats.other.earned / categoryStats.other.max) * 100));
    }

    completionRate = Math.min(100, Math.floor(completionRate));

    return {
        completionRate,
        missedWords: targetData.words.filter(w => !window.foundWordsSet.has(w.text)),
        missedChunks: targetData.chunks.filter(c => !window.foundChunksSet.has(c.text)),
        missedSentences: targetData.sentences.filter(s => !window.foundSentencesSet.has(s.text)),
        clearedWords: targetData.words.filter(w => window.foundWordsSet.has(w.text)),
        clearedChunks: targetData.chunks.filter(c => window.foundChunksSet.has(c.text)),
        clearedSentences: targetData.sentences.filter(s => window.foundSentencesSet.has(s.text)),
        categories: categoryStats 
    };
};