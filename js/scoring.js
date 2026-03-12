// js/scoring.js

let currentScore = 0;

// 複数のレベル（小・中・高）のデータを平坦化して結合するヘルパー関数
function getAllTargets(scoringData, type) {
    let targets = [];
    if (scoringData.elementary && scoringData.elementary[type]) {
        targets = targets.concat(scoringData.elementary[type]);
    }
    if (scoringData.junior_high && scoringData.junior_high[type]) {
        targets = targets.concat(scoringData.junior_high[type]);
    }
    if (scoringData.high_school && scoringData.high_school[type]) {
        targets = targets.concat(scoringData.high_school[type]);
    }
    return targets;
}

function calculateScore(transcript, theme) {
    if (!transcript || !theme || !theme.scoringData) return null;

    const lowerTranscript = transcript.toLowerCase();
    
    // 各ターゲットの抽出
    const allWords = getAllTargets(theme.scoringData, 'words');
    const allChunks = getAllTargets(theme.scoringData, 'chunks');
    // sentencesはオブジェクトの配列 [{text: "...", grammar: "..."}, ...] なのでテキストだけ抽出
    const allSentenceObjs = getAllTargets(theme.scoringData, 'sentences');
    const allSentences = allSentenceObjs.map(s => s.text);

    let foundWords = [];
    let foundChunks = [];
    let foundSentences = [];
    let pointsToAdd = 0;

    // 1. 単語(Words)の判定 (1ヒット 10点)
    allWords.forEach(word => {
        // 単語の完全一致を正規表現でチェック（例: "read" が "reading" に誤反応しないように）
        const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
        if (regex.test(lowerTranscript)) {
            foundWords.push(word);
            pointsToAdd += 10;
        }
    });

    // 2. フレーズ(Chunks)の判定 (1ヒット 50点 + コンボの起点)
    allChunks.forEach(chunk => {
        if (lowerTranscript.includes(chunk.toLowerCase())) {
            foundChunks.push(chunk);
            pointsToAdd += 50;
        }
    });

    // 3. センテンス(Sentences)の判定 (1ヒット 200点 + 特大ボーナス)
    // ※ 完全に一致しなくても、文の80%以上が含まれていればOKとする簡易マッチング
    allSentenceObjs.forEach(sentenceObj => {
        const sentenceText = sentenceObj.text.toLowerCase().replace(/[.,]/g, ''); // 記号を除去
        
        // ユーザーの発話に、例文が含まれているか（または大部分が一致するか）
        if (lowerTranscript.replace(/[.,]/g, '').includes(sentenceText)) {
            foundSentences.push(sentenceObj);
            pointsToAdd += 200;
        }
    });

    // コンボ倍率の計算
    // チャンク（フレーズ）や文を言えるほど倍率が跳ね上がる
    const chunkCombo = foundChunks.length * 0.2; // チャンク1つにつき +0.2倍
    const sentenceCombo = foundSentences.length * 0.5; // 文1つにつき +0.5倍
    const totalMultiplier = 1.0 + chunkCombo + sentenceCombo;

    const finalPoints = Math.floor(pointsToAdd * totalMultiplier);
    currentScore += finalPoints;

    return {
        score: currentScore,
        addedPoints: finalPoints,
        multiplier: totalMultiplier.toFixed(1),
        foundWords: foundWords,
        foundChunks: foundChunks,
        foundSentences: foundSentences
    };
}

function resetScore() {
    currentScore = 0;
}