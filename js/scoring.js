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

// ★修正: 誤認識を防ぎ、適度な厳格さを持つマッチングエンジン
function flexibleMatch(targetText, spokenWordsArray) {
    if (!targetText) return false;
    const targetWords = targetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/);
    const coreWords = targetWords.filter(w => !STOP_WORDS.has(w) && w.length > 0);
    const wordsToMatch = coreWords.length > 0 ? coreWords : targetWords;
    if (wordsToMatch.length === 0) return false;

    let matchCount = 0;
    wordsToMatch.forEach(w => {
        const isMatch = spokenWordsArray.some(spoken => {
            // 完全一致
            if (spoken === w) return true;
            // 語形変化（複数形、進行形、過去形）のみを許容。部分一致（sun が Sunday になる等）は弾く！
            if (spoken === w + 's' || spoken === w + 'es' || spoken === w + 'ing' || spoken === w + 'ed' || spoken === w + 'd') return true;
            if (w === spoken + 's' || w === spoken + 'es' || w === spoken + 'ing' || w === spoken + 'ed' || w === spoken + 'd') return true;
            return false;
        });
        if (isMatch) matchCount++;
    });

    // ★採点の厳格化
    // 単語数が2語以下の短いフレーズは「100%（すべて）」言えないとバツ。
    // 3語以上の文は「80%以上」のコア単語が言えていればマル。
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

function getCompletionStats(theme, selectedLevel) {
    const targetData = getAggregatedData(theme, selectedLevel);
    
    // 全体の満点目安（レベルに応じて変動）
    let overallCap = 100;
    let categoryCap = 20;

    if (selectedLevel === 'junior_high') { overallCap = 200; categoryCap = 40; } 
    else if (selectedLevel === 'high_school') { overallCap = 300; categoryCap = 60; }

    let totalEarnedPoints = 0;
    
    // カテゴリーの初期化
    const categoryStats = {
        "object": { label: "Object (物体・人物)", earned: 0, cleared: [], missed: [] },
        "attribute": { label: "Attribute (属性・状態)", earned: 0, cleared: [], missed: [] },
        "detail": { label: "Detail (詳細・背景)", earned: 0, cleared: [], missed: [] },
        "gist": { label: "Gist (要点・動作)", earned: 0, cleared: [], missed: [] },
        "inference": { label: "Inference (推測・雰囲気)", earned: 0, cleared: [], missed: [] },
        "other": { label: "Others (その他)", earned: 0, cleared: [], missed: [] }
    };

    const processItems = (items, foundSet, fallbackPoints) => {
        items.forEach(item => {
            const pts = item.points || fallbackPoints;
            // ★ここを修正: JSONデータに書かれている "category" キーを見るように変更しました！
            // JSONにcategoryの指定がない場合は "other" に分類します。
            const categoryName = item.category || item.type || "other";
            
            if (!categoryStats[categoryName]) {
                categoryStats[categoryName] = { label: categoryName, earned: 0, cleared: [], missed: [] };
            }

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

    // 全体の達成率（最大100%）
    const completionRate = Math.min(100, Math.floor((totalEarnedPoints / overallCap) * 100));
    
    // 各カテゴリーの達成率（カテゴリー内のアイテム数に対するクリア数の割合で計算）
    Object.keys(categoryStats).forEach(key => {
        const cat = categoryStats[key];
        const totalItemsInCat = cat.cleared.length + cat.missed.length;
        if (totalItemsInCat > 0) {
            cat.matchRate = Math.min(100, Math.floor((cat.cleared.length / totalItemsInCat) * 100));
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