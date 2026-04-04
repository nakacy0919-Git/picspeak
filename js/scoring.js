// js/scoring.js
// ==========================================
// スコアリングおよび達成率計算システム (厳格＆誤認識防止版)
// ==========================================

let currentScore = 0;
let foundWordsSet = new Set();
let foundChunksSet = new Set();
let foundSentencesSet = new Set();

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 
    'in', 'on', 'at', 'to', 'of', 'and', 'it', 'he', 'she', 'they', 
    'with', 'for', 'there', 'some'
]);

function getAggregatedData(theme, level) {
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
}

function flexibleMatch(targetText, spokenWordsArray) {
    if (!targetText) return false;
    const targetWords = targetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/);
    const coreWords = targetWords.filter(w => !STOP_WORDS.has(w) && w.length > 0);
    const wordsToMatch = coreWords.length > 0 ? coreWords : targetWords;
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
}

function calculateScore(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    const spokenWordsArray = transcript.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
    const targetData = getAggregatedData(theme, selectedLevel);

    let newWords = [];
    let newChunks = [];
    let newSentences = [];
    let pointsToAdd = 0;

    targetData.words.forEach(wordObj => {
        if (!foundWordsSet.has(wordObj.text) && flexibleMatch(wordObj.text, spokenWordsArray)) {
            foundWordsSet.add(wordObj.text);
            newWords.push(wordObj.text);
            pointsToAdd += (wordObj.points || 10);
        }
    });

    targetData.chunks.forEach(chunkObj => {
        if (!foundChunksSet.has(chunkObj.text) && flexibleMatch(chunkObj.text, spokenWordsArray)) {
            foundChunksSet.add(chunkObj.text);
            newChunks.push(chunkObj.text);
            pointsToAdd += (chunkObj.points || 50);
        }
    });

    targetData.sentences.forEach(sentenceObj => {
        if (!foundSentencesSet.has(sentenceObj.text) && flexibleMatch(sentenceObj.text, spokenWordsArray)) {
            foundSentencesSet.add(sentenceObj.text);
            newSentences.push(sentenceObj);
            pointsToAdd += (sentenceObj.points || 200);
        }
    });

    const newHitsCount = newWords.length + newChunks.length + newSentences.length;
    if (newHitsCount > 0) {
        const chunkCombo = foundChunksSet.size * 0.2;
        const sentenceCombo = foundSentencesSet.size * 0.5;
        const totalMultiplier = 1.0 + chunkCombo + sentenceCombo;
        const finalPoints = Math.floor(pointsToAdd * totalMultiplier);
        currentScore += finalPoints;

        return {
            score: currentScore, addedPoints: finalPoints, multiplier: totalMultiplier.toFixed(1),
            newWords, allFoundWords: Array.from(foundWordsSet), allFoundChunks: Array.from(foundChunksSet),
            allFoundSentences: Array.from(foundSentencesSet), isPerfect: newSentences.length > 0 
        };
    }
    return null; 
}

function resetScore() {
    currentScore = 0; foundWordsSet.clear(); foundChunksSet.clear(); foundSentencesSet.clear();
}

// ★ 大幅修正: 固定の天井を廃止し、全体とカテゴリーを厳密に計算するロジック
function getCompletionStats(theme, selectedLevel) {
    const targetData = getAggregatedData(theme, selectedLevel);
    
    let totalEarnedPoints = 0;
    let maxPossiblePoints = 0; // そのレベルで獲得できる理論上の「満点」
    
    // カテゴリーの初期化 (earned:獲得点, max:そのカテゴリの満点)
    const categoryStats = {
        "object": { label: "Object (物体・人物)", earned: 0, max: 0, cleared: [], missed: [] },
        "attribute": { label: "Attribute (属性・状態)", earned: 0, max: 0, cleared: [], missed: [] },
        "detail": { label: "Detail (詳細・背景)", earned: 0, max: 0, cleared: [], missed: [] },
        "gist": { label: "Gist (要点・動作)", earned: 0, max: 0, cleared: [], missed: [] },
        "inference": { label: "Inference (推測・雰囲気)", earned: 0, max: 0, cleared: [], missed: [] },
        "other": { label: "Others (その他)", earned: 0, max: 0, cleared: [], missed: [] }
    };

    const processItems = (items, foundSet, fallbackPoints) => {
        items.forEach(item => {
            const pts = item.points || fallbackPoints;
            const categoryName = item.category || item.type || "other";
            
            if (!categoryStats[categoryName]) {
                categoryStats[categoryName] = { label: categoryName, earned: 0, max: 0, cleared: [], missed: [] };
            }

            // 全体の満点と、各カテゴリーの満点を加算
            maxPossiblePoints += pts;
            categoryStats[categoryName].max += pts;

            if (foundSet.has(item.text)) {
                totalEarnedPoints += pts;
                categoryStats[categoryName].earned += pts;
                categoryStats[categoryName].cleared.push(item);
            } else {
                categoryStats[categoryName].missed.push(item);
            }
        });
    };

    // ポイント配分：単語10点、チャンク20点、文40点
    processItems(targetData.words, foundWordsSet, 10);
    processItems(targetData.chunks, foundChunksSet, 20);
    processItems(targetData.sentences, foundSentencesSet, 40);

    // ★ 総合達成率（固定の天井ではなく、獲得ポイント ÷ 全問題の総ポイントで厳密計算）
    let completionRate = 0;
    if (maxPossiblePoints > 0) {
        completionRate = Math.min(100, Math.floor((totalEarnedPoints / maxPossiblePoints) * 100));
    }
    
    // ★ 各カテゴリーの達成率（アイテム数ではなく、カテゴリー内の獲得ポイントベースで厳密計算）
    Object.keys(categoryStats).forEach(key => {
        const cat = categoryStats[key];
        if (cat.max > 0) {
            cat.matchRate = Math.min(100, Math.floor((cat.earned / cat.max) * 100));
        } else {
            cat.matchRate = 0;
        }
    });

    return {
        completionRate,
        missedWords: targetData.words.filter(w => !foundWordsSet.has(w.text)),
        missedChunks: targetData.chunks.filter(c => !foundChunksSet.has(c.text)),
        missedSentences: targetData.sentences.filter(s => !foundSentencesSet.has(s.text)),
        clearedWords: targetData.words.filter(w => foundWordsSet.has(w.text)),
        clearedChunks: targetData.chunks.filter(c => foundChunksSet.has(c.text)),
        clearedSentences: targetData.sentences.filter(s => foundSentencesSet.has(s.text)),
        categories: categoryStats 
    };
}