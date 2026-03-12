// js/scoring.js

let currentScore = 0;
// 一度得点したものを記憶して重複加点を防ぐ「箱」
let foundWordsSet = new Set();
let foundChunksSet = new Set();
let foundSentencesSet = new Set();

// ★NEW: 選択されたレベルに応じて、下位レベルのデータもすべて結合する関数
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

    // 指定されたレベルまでのすべての単語・文法データを合体させる
    levelsToInclude.forEach(lvl => {
        if (theme.scoringData[lvl]) {
            data.words.push(...(theme.scoringData[lvl].words || []));
            data.chunks.push(...(theme.scoringData[lvl].chunks || []));
            data.sentences.push(...(theme.scoringData[lvl].sentences || []));
        }
    });

    return data;
}

function calculateScore(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    const lowerTranscript = transcript.toLowerCase();
    
    // ★NEW: 単独のレベルではなく、合体させた「累積データ」を採点ターゲットにする
    const targetData = getAggregatedData(theme, selectedLevel);

    let newWords = [];
    let newChunks = [];
    let newSentences = [];
    let pointsToAdd = 0;

    // 1. 単語(Words)の判定 (新規のみ 10点)
    targetData.words.forEach(word => {
        if (!foundWordsSet.has(word)) { // まだ得点していない場合のみ
            const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerTranscript)) {
                foundWordsSet.add(word);
                newWords.push(word);
                pointsToAdd += 10;
            }
        }
    });

    // 2. フレーズ(Chunks)の判定 (新規のみ 50点)
    targetData.chunks.forEach(chunk => {
        if (!foundChunksSet.has(chunk)) {
            if (lowerTranscript.includes(chunk.toLowerCase())) {
                foundChunksSet.add(chunk);
                newChunks.push(chunk);
                pointsToAdd += 50;
            }
        }
    });

    // 3. センテンス(Sentences)の判定 (新規のみ 200点)
    targetData.sentences.forEach(sentenceObj => {
        if (!foundSentencesSet.has(sentenceObj.text)) {
            const sentenceText = sentenceObj.text.toLowerCase().replace(/[.,]/g, '');
            if (lowerTranscript.replace(/[.,]/g, '').includes(sentenceText)) {
                foundSentencesSet.add(sentenceObj.text);
                newSentences.push(sentenceObj);
                pointsToAdd += 200;
            }
        }
    });

    // 今回新しく見つけたものがあれば、コンボ計算をしてスコアを加算
    const newHitsCount = newWords.length + newChunks.length + newSentences.length;
    if (newHitsCount > 0) {
        // コンボは「これまでに見つけたフレーズ・文の総数」で倍率が上がる
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
            allFoundSentences: Array.from(foundSentencesSet)
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