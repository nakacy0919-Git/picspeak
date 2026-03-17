// js/scoring.js
// ==========================================
// スコアリングおよび達成率計算システム
// ==========================================

let currentScore = 0;
let foundWordsSet = new Set();
let foundChunksSet = new Set();
let foundSentencesSet = new Set();

function getAggregatedData(theme, level) {
    const data = { words: [], chunks: [], sentences: [] };
    if (!theme || !theme.scoringData) return data;

    const levelsToInclude = [];
    if (level === 'elementary') {
        levelsToInclude.push('elementary');
    } else if (level === 'junior_high') {
        levelsToInclude.push('elementary', 'junior_high');
    } else if (level === 'high_school') {
        levelsToInclude.push('elementary', 'junior_high', 'high_school');
    }

    levelsToInclude.forEach(lvl => {
        if (theme.scoringData[lvl]) {
            data.words.push(...(theme.scoringData[lvl].words || []));
            data.chunks.push(...(theme.scoringData[lvl].chunks || []));
            data.sentences.push(...(theme.scoringData[lvl].sentences || []));
        }
    });
    return data;
}

function normalizeText(str) {
    return str.toLowerCase().replace(/[.,!?'"-\s]/g, '');
}

function calculateScore(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    const lowerTranscript = transcript.toLowerCase();
    const normalizedTranscript = normalizeText(transcript); 
    
    const targetData = getAggregatedData(theme, selectedLevel);

    let newWords = [];
    let newChunks = [];
    let newSentences = [];
    let pointsToAdd = 0;

    targetData.words.forEach(wordObj => {
        const wordText = wordObj.text;
        if (!foundWordsSet.has(wordText)) {
            const regex = new RegExp(`\\b${wordText.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerTranscript)) {
                foundWordsSet.add(wordText);
                newWords.push(wordText);
                // ★修正: 新データは設定ポイント、旧データは従来通り10点
                pointsToAdd += (wordObj.points || 10);
            }
        }
    });

    targetData.chunks.forEach(chunkObj => {
        const chunkText = chunkObj.text;
        if (!foundChunksSet.has(chunkText)) {
            const normalizedChunk = normalizeText(chunkText);
            if (normalizedTranscript.includes(normalizedChunk)) {
                foundChunksSet.add(chunkText);
                newChunks.push(chunkText);
                // ★修正: 新データは設定ポイント、旧データは従来通り50点
                pointsToAdd += (chunkObj.points || 50);
            }
        }
    });

    targetData.sentences.forEach(sentenceObj => {
        if (!foundSentencesSet.has(sentenceObj.text)) {
            const normalizedSentence = normalizeText(sentenceObj.text);
            if (normalizedTranscript.includes(normalizedSentence)) {
                foundSentencesSet.add(sentenceObj.text);
                newSentences.push(sentenceObj);
                // ★修正: 新データは設定ポイント、旧データは従来通り200点
                pointsToAdd += (sentenceObj.points || 200);
            }
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
            score: currentScore,
            addedPoints: finalPoints,
            multiplier: totalMultiplier.toFixed(1),
            newWords: newWords, 
            allFoundWords: Array.from(foundWordsSet),
            allFoundChunks: Array.from(foundChunksSet),
            allFoundSentences: Array.from(foundSentencesSet),
            isPerfect: newSentences.length > 0 
        };
    }
    return null; 
}

function resetScore() {
    currentScore = 0;
    foundWordsSet.clear();
    foundChunksSet.clear();
    foundSentencesSet.clear();
}

// ★NEW: 認知心理学アプローチに基づく、重要度(points)ベースの達成率計算
function getCompletionStats(theme, selectedLevel) {
    const targetData = getAggregatedData(theme, selectedLevel);
    
    let totalPoints = 0;
    let earnedPoints = 0;

    // アイテムごとのポイントを加算するヘルパー関数
    const processPoints = (items, foundSet, fallbackPoints) => {
        items.forEach(item => {
            // 新JSONは重み付け(points)、旧JSONは一律 fallbackPoints（10点）で個数ベース計算を再現
            const pts = item.points || fallbackPoints;
            totalPoints += pts;
            if (foundSet.has(item.text)) {
                earnedPoints += pts;
            }
        });
    };

    // すべてfallbackPointsを「10」に設定することで、
    // 古いJSONデータでは「全体の個数に対する言えた個数」と数学的に同じ結果になります。
    processPoints(targetData.words, foundWordsSet, 10);
    processPoints(targetData.chunks, foundChunksSet, 10);
    processPoints(targetData.sentences, foundSentencesSet, 10);

    // 100%満点での達成率（重み付けされたポイントベース）
    const completionRate = totalPoints > 0 ? Math.min(100, Math.round((earnedPoints / totalPoints) * 100)) : 0;
    
    // 未達成（言えなかった）アイテム
    const missedWords = targetData.words.filter(w => !foundWordsSet.has(w.text));
    const missedChunks = targetData.chunks.filter(c => !foundChunksSet.has(c.text));
    const missedSentences = targetData.sentences.filter(s => !foundSentencesSet.has(s.text));

    // 達成済（言えた）アイテム
    const clearedWords = targetData.words.filter(w => foundWordsSet.has(w.text));
    const clearedChunks = targetData.chunks.filter(c => foundChunksSet.has(c.text));
    const clearedSentences = targetData.sentences.filter(s => foundSentencesSet.has(s.text));
    
    return {
        completionRate,
        missedWords, missedChunks, missedSentences,
        clearedWords, clearedChunks, clearedSentences
    };
}