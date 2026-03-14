// js/scoring.js

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

    // ★修正: wordObj.text を抽出して判定するように変更
    targetData.words.forEach(wordObj => {
        const wordText = wordObj.text;
        if (!foundWordsSet.has(wordText)) {
            const regex = new RegExp(`\\b${wordText.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerTranscript)) {
                foundWordsSet.add(wordText);
                newWords.push(wordText);
                pointsToAdd += 10;
            }
        }
    });

    // ★修正: chunkObj.text を抽出して判定するように変更
    targetData.chunks.forEach(chunkObj => {
        const chunkText = chunkObj.text;
        if (!foundChunksSet.has(chunkText)) {
            const normalizedChunk = normalizeText(chunkText);
            if (normalizedTranscript.includes(normalizedChunk)) {
                foundChunksSet.add(chunkText);
                newChunks.push(chunkText);
                pointsToAdd += 50;
            }
        }
    });

    targetData.sentences.forEach(sentenceObj => {
        if (!foundSentencesSet.has(sentenceObj.text)) {
            const normalizedSentence = normalizeText(sentenceObj.text);
            if (normalizedTranscript.includes(normalizedSentence)) {
                foundSentencesSet.add(sentenceObj.text);
                newSentences.push(sentenceObj);
                pointsToAdd += 200;
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