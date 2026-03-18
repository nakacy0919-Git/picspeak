// js/scoring.js
// ==========================================
// スコアリングおよび達成率計算システム (柔軟なアカデミック採点版)
// ==========================================

let currentScore = 0;
let foundWordsSet = new Set();
let foundChunksSet = new Set();
let foundSentencesSet = new Set();

// ★評価に影響させないストップワード（冠詞、be動詞、前置詞など）
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 
    'in', 'on', 'at', 'to', 'of', 'and', 'it', 'he', 'she', 'they', 
    'with', 'for', 'there', 'some'
]);

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

// ★NEW: 柔軟なマッチング判定（コア単語の60%以上が含まれていればOK）
function flexibleMatch(targetText, spokenWordsArray) {
    if (!targetText) return false;
    
    // ターゲットテキストを小文字化し、記号を消して配列化
    const targetWords = targetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/);
    
    // ストップワードを除外した「コア単語」を抽出
    const coreWords = targetWords.filter(w => !STOP_WORDS.has(w) && w.length > 0);
    
    // もしコア単語が空になってしまったら、元の単語で判定
    const wordsToMatch = coreWords.length > 0 ? coreWords : targetWords;

    if (wordsToMatch.length === 0) return false;

    let matchCount = 0;
    wordsToMatch.forEach(w => {
        const isMatch = spokenWordsArray.some(spoken => {
            if (spoken === w) return true;
            // 3文字以上の単語なら部分一致を許容（例: read と reading、sit と sitting等）
            if (w.length >= 3 && spoken.length >= 3) {
                return spoken.includes(w) || w.includes(spoken);
            }
            return false;
        });
        if (isMatch) matchCount++;
    });

    // コア単語の60%以上が発話に含まれていればクリア
    return (matchCount / wordsToMatch.length) >= 0.6;
}

function calculateScore(transcript, theme, selectedLevel) {
    if (!transcript || !theme || !theme.scoringData) return null;

    // ユーザーの発話を小文字化して配列にする
    const spokenWordsArray = transcript.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
    const targetData = getAggregatedData(theme, selectedLevel);

    let newWords = [];
    let newChunks = [];
    let newSentences = [];
    let pointsToAdd = 0;

    // Wordsの判定
    targetData.words.forEach(wordObj => {
        if (!foundWordsSet.has(wordObj.text)) {
            if (flexibleMatch(wordObj.text, spokenWordsArray)) {
                foundWordsSet.add(wordObj.text);
                newWords.push(wordObj.text);
                pointsToAdd += (wordObj.points || 10);
            }
        }
    });

    // Chunksの判定
    targetData.chunks.forEach(chunkObj => {
        if (!foundChunksSet.has(chunkObj.text)) {
            if (flexibleMatch(chunkObj.text, spokenWordsArray)) {
                foundChunksSet.add(chunkObj.text);
                newChunks.push(chunkObj.text);
                pointsToAdd += (chunkObj.points || 50);
            }
        }
    });

    // Sentencesの判定
    targetData.sentences.forEach(sentenceObj => {
        if (!foundSentencesSet.has(sentenceObj.text)) {
            if (flexibleMatch(sentenceObj.text, spokenWordsArray)) {
                foundSentencesSet.add(sentenceObj.text);
                newSentences.push(sentenceObj);
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

// 認知心理学アプローチに基づく、重要度(points)ベースの達成率計算
function getCompletionStats(theme, selectedLevel) {
    const targetData = getAggregatedData(theme, selectedLevel);
    
    let totalPoints = 0;
    let earnedPoints = 0;

    // ★NEW: カテゴリー(type)別の集計データを追加作成
    const categoryStats = {
        "object": { label: "Object (物体・人物)", cleared: [], missed: [] },
        "attribute": { label: "Attribute (属性・状態)", cleared: [], missed: [] },
        "detail": { label: "Detail (詳細・背景)", cleared: [], missed: [] },
        "gist": { label: "Gist (要点・動作)", cleared: [], missed: [] },
        "inference": { label: "Inference (推測・雰囲気)", cleared: [], missed: [] },
        "other": { label: "Others (その他)", cleared: [], missed: [] }
    };

    const processItems = (items, foundSet, fallbackPoints) => {
        items.forEach(item => {
            const pts = item.points || fallbackPoints;
            totalPoints += pts;
            
            const type = item.type || "other";
            if (!categoryStats[type]) {
                categoryStats[type] = { label: type, cleared: [], missed: [] };
            }

            if (foundSet.has(item.text)) {
                earnedPoints += pts;
                categoryStats[type].cleared.push(item);
            } else {
                categoryStats[type].missed.push(item);
            }
        });
    };

    processItems(targetData.words, foundWordsSet, 10);
    processItems(targetData.chunks, foundChunksSet, 10);
    processItems(targetData.sentences, foundSentencesSet, 10);

    const completionRate = totalPoints > 0 ? Math.min(100, Math.round((earnedPoints / totalPoints) * 100)) : 0;
    
    // 従来のデータ形式との互換性を保ちつつ、新しいカテゴリーデータもUIに渡す
    return {
        completionRate,
        missedWords: targetData.words.filter(w => !foundWordsSet.has(w.text)),
        missedChunks: targetData.chunks.filter(c => !foundChunksSet.has(c.text)),
        missedSentences: targetData.sentences.filter(s => !foundSentencesSet.has(s.text)),
        clearedWords: targetData.words.filter(w => foundWordsSet.has(w.text)),
        clearedChunks: targetData.chunks.filter(c => foundChunksSet.has(c.text)),
        clearedSentences: targetData.sentences.filter(s => foundSentencesSet.has(s.text)),
        categories: categoryStats // ← これを使ってリザルト画面をアップデート可能！
    };
}