// js/main.js

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let timeLeft = 30; 
let timeElapsed = 0; 

let selectedPlayers = 2;
let selectedLevel = 'junior_high'; 

// UIの取得
const viewStart = document.getElementById('view-start');
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

const btnStartGame = document.getElementById('btn-start-game');
const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');

const playerBtns = document.querySelectorAll('.player-btn');
const levelBtns = document.querySelectorAll('.level-btn'); 

const promptImage = document.getElementById('prompt-image');
const transcriptBox = document.getElementById('transcript-box');
const scoreDisplay = document.getElementById('scoreDisplay');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const statusText = document.getElementById('status-text');
const currentLevelBadge = document.getElementById('current-level-badge'); 

const comboOverlay = document.getElementById('combo-overlay');
const comboContent = document.getElementById('combo-content');
const pinContainer = document.getElementById('pin-container');

// 音声記録用変数（ハイライトが消えないように、純粋なテキストのみを蓄積します）
let rawTranscriptForCounting = ""; 

function showView(viewElement) {
    viewStart.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewElement.classList.remove('hidden');
    viewElement.classList.add('fade-in');
}

async function initApp() {
    initSpeechRecognition(handleSpeechResult, handleSpeechEnd);
    try {
        const response = await fetch('data/themes.json');
        const themes = await response.json();
        currentTheme = themes[0]; 
    } catch (error) {
        console.error("テーマの読み込みに失敗しました:", error);
    }
}

function startTimer() {
    timeLeft = currentTheme.timeLimit || 30;
    timeElapsed = 0;
    timerText.textContent = `${timeLeft}s`;
    timerBar.style.width = '100%';
    timerBar.style.transition = 'none';
    
    setTimeout(() => {
        timerBar.style.transition = `width ${timeLeft}s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    gameTimer = setInterval(() => {
        timeLeft--;
        timeElapsed++;
        timerText.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 5) {
            timerBar.classList.replace('bg-blue-500', 'bg-red-500');
            timerText.classList.replace('text-blue-600', 'text-red-600');
            timerText.classList.add('animate-pulse');
        }

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            stopRecording();
            statusText.textContent = "Time's Up!";
        }
    }, 1000);
}

function dropPin(word, theme) {
    if (!theme || !theme.pins || !theme.pins[word.toLowerCase()]) return;
    const pinData = theme.pins[word.toLowerCase()];
    
    const pin = document.createElement('div');
    pin.className = 'absolute flex flex-col items-center justify-center pin-drop z-20';
    pin.style.left = `${pinData.x}%`;
    pin.style.top = `${pinData.y}%`;
    pin.style.transform = 'translate(-50%, -100%)';

    pin.innerHTML = `
        <div class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white mb-1">
            ${word}
        </div>
        <div class="w-1 h-4 bg-red-600 shadow-sm rounded-b-full"></div>
    `;
    pinContainer.appendChild(pin);
}

// ★NEW: 過去のテキストも含めて、画面全体を再ハイライトする最強の関数
function highlightGlobalText(text) {
    if (!text) return "";
    let html = text;

    // 獲得済みのフレーズや文を長い順に並び替え（短い単語の誤爆を防ぐ）
    const phrases = [...Array.from(foundChunksSet), ...Array.from(foundSentencesSet)];
    phrases.sort((a, b) => b.length - a.length);

    phrases.forEach(phrase => {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        html = html.replace(regex, `<span class="hl-phrase">$1</span>`);
    });

    // 獲得済みの単語を長い順に並び替え
    const words = Array.from(foundWordsSet);
    words.sort((a, b) => b.length - a.length);
    words.forEach(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 既にフレーズとしてハイライトされている中身は書き換えない正規表現
        const regex = new RegExp(`\\b(${escaped})\\b(?![^<]*>|[^<>]*<\/span>)`, 'gi');
        html = html.replace(regex, `<span class="hl-mandatory">$1</span>`);
    });

    return html;
}

function handleSpeechResult(finalText, interimText) {
    // 確定したテキストを蓄積
    if (finalText.trim().length > 0) {
        rawTranscriptForCounting += finalText + " ";
    }
    
    // これまで話した全テキスト ＋ 現在認識中のテキスト
    const currentTempText = rawTranscriptForCounting + interimText;
    
    // 語数カウント
    const wordsArray = currentTempText.trim().split(/[\s,.?!]+/).filter(w => w.length > 0);
    wordCountDisplay.textContent = wordsArray.length;
    
    if (currentTempText.trim().length > 0 && currentTheme) {
        // 直近の言葉だけでなく「これまで話した全テキスト」から得点を再計算（取りこぼし防止）
        const result = calculateScore(currentTempText, currentTheme, selectedLevel);
        
        if (result && result.addedPoints > 0) {
            scoreDisplay.textContent = result.score;
            
            if (result.newWords && result.newWords.length > 0) {
                result.newWords.forEach(word => {
                    dropPin(word, currentTheme);
                });
            }

            if (parseFloat(result.multiplier) > 1.0) {
                showComboAnimation(result.multiplier, result.addedPoints);
            }
        }
    }
    
    // ★NEW: 常に「全てのテキスト」に対してハイライトをかけ直す！
    const displayHTML = highlightGlobalText(currentTempText);

    if (currentTempText.trim().length > 0) {
         transcriptBox.innerHTML = `<p class="mb-2 leading-relaxed text-black font-medium">${displayHTML}</p>`;
    } else {
         transcriptBox.innerHTML = `<p class="text-gray-400 italic">Press START to reveal the picture.</p>`;
    }
    
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

function showComboAnimation(multiplier, points) {
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `
        <div class="text-6xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] animate-combo">
            x${multiplier} COMBO!
        </div>
        <div class="text-3xl font-bold text-white mt-2 animate-phrase">
            +${points} pts
        </div>
    `;
    setTimeout(() => { comboOverlay.classList.add('hidden'); }, 1500);
}

function handleSpeechEnd() {
    isRecording = false;
    recordingIndicator.classList.add('hidden');
    if (timeLeft > 0) {
        btnStartTurn.classList.remove('hidden');
        statusText.textContent = "Paused";
    }
}

function stopRecording() {
    stopSpeech();
    recordingIndicator.classList.add('hidden');
    btnFinishTurn.classList.remove('hidden'); 
    statusText.textContent = "Finished!";
    timerBar.style.transition = 'none';
}

// イベントリスナー（人数・レベル選択）
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => {
            b.classList.remove('selected-player-btn', 'border-white', 'bg-white/40');
            b.classList.add('border-transparent');
        });
        const target = e.currentTarget; 
        target.classList.remove('border-transparent');
        target.classList.add('selected-player-btn', 'border-white', 'bg-white/40');
        selectedPlayers = parseInt(target.getAttribute('data-players'));
    });
});

levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelBtns.forEach(b => {
            b.classList.remove('selected-level-btn', 'border-white', 'bg-white/40');
            b.classList.add('border-transparent', 'bg-white/20');
        });
        const target = e.currentTarget;
        target.classList.remove('border-transparent', 'bg-white/20');
        target.classList.add('selected-level-btn', 'border-white', 'bg-white/40');
        selectedLevel = target.getAttribute('data-level');
        
        let levelText = "中学生レベル";
        if (selectedLevel === "elementary") levelText = "小学生レベル";
        if (selectedLevel === "high_school") levelText = "高校生レベル";
        currentLevelBadge.textContent = levelText;
    });
});

// ゲームコントロール
btnStartGame.addEventListener('click', async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        alert("マイクの使用が許可されませんでした。ブラウザの設定からマイクをオンにしてください。");
        return; 
    }

    if (currentTheme) {
        promptImage.src = currentTheme.imageSrc;
        promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    rawTranscriptForCounting = "";
    resetScore(); 
    scoreDisplay.textContent = "0";
    wordCountDisplay.textContent = "0";
    pinContainer.innerHTML = ''; 
    transcriptBox.innerHTML = `<p class="text-gray-400 italic">Press START to reveal the picture.</p>`;
    
    showView(viewPlay);
});

btnStartTurn.addEventListener('click', () => {
    startSpeech();
    isRecording = true;
    
    btnStartTurn.classList.add('hidden');
    recordingIndicator.classList.remove('hidden');
    statusText.textContent = "Speak Now!";
    
    promptImage.classList.remove('blur-md');
    promptImage.classList.add('blur-none');
    
    if (timeLeft === 30 || timeLeft === currentTheme.timeLimit) {
        startTimer();
    }
});

recordingIndicator.addEventListener('click', () => {
    stopRecording(); 
});

btnFinishTurn.addEventListener('click', () => {
    clearInterval(gameTimer);
    
    const finalScore = scoreDisplay.textContent;
    const finalWordCount = parseInt(wordCountDisplay.textContent) || 0;
    
    let wpm = 0;
    if (timeElapsed > 0) {
        wpm = Math.round(finalWordCount / (timeElapsed / 60));
    }

    // 模範解答の生成
    const modelAnswersData = currentTheme.scoringData[selectedLevel].sentences || [];
    let modelAnswersHTML = `<ul class="space-y-3 mt-3">`;
    modelAnswersData.forEach(ans => {
        modelAnswersHTML += `
            <li class="flex items-start bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span class="text-blue-500 mr-2 mt-1">💡</span>
                <div>
                    <div class="font-bold text-gray-800 text-xl">${ans.text}</div>
                    <div class="text-sm font-bold text-pink-500 mt-1">Target: ${ans.grammar}</div>
                </div>
            </li>
        `;
    });
    modelAnswersHTML += `</ul>`;

    // ★NEW: リザルト画面用の永久ハイライト済みテキスト
    const finalTranscriptHTML = highlightGlobalText(rawTranscriptForCounting);

    const rankingContainer = document.getElementById('ranking-container');
    
    rankingContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div class="bg-white rounded-2xl p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-sm tracking-wider mb-1">TOTAL SCORE</span>
                <span class="text-5xl font-black text-orange-500">${finalScore}</span>
            </div>
            <div class="bg-white rounded-2xl p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-sm tracking-wider mb-1">WORDS SPOKEN</span>
                <span class="text-5xl font-black text-blue-500">${finalWordCount}</span>
            </div>
            <div class="bg-white rounded-2xl p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-sm tracking-wider mb-1">WPM (Speed)</span>
                <span class="text-5xl font-black text-green-500">${wpm}</span>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg border border-gray-100 flex-1 flex flex-col overflow-hidden mb-2">
            <div class="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                <h3 class="text-xl font-black text-indigo-700">🎯 Model Answers</h3>
                <span class="text-xs font-bold text-indigo-500 bg-white px-2 py-1 rounded-full shadow-sm">${currentLevelBadge.textContent}</span>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                ${modelAnswersHTML}
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg border border-gray-100 flex-1 flex flex-col overflow-hidden">
            <div class="bg-gray-100 px-6 py-4 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-700">📝 Your Transcript</h3>
            </div>
            <div class="p-6 overflow-y-auto flex-1 text-2xl leading-relaxed text-gray-800">
                ${finalTranscriptHTML || "Oops, no words were recorded. Try again!"}
            </div>
        </div>
    `;
    
    showView(viewResult);
});

btnPlayAgain.addEventListener('click', () => {
    timeLeft = currentTheme ? currentTheme.timeLimit : 30;
    timerBar.classList.replace('bg-red-500', 'bg-blue-500');
    timerText.classList.replace('text-red-600', 'text-blue-600');
    timerText.classList.remove('animate-pulse');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    
    btnFinishTurn.classList.add('hidden');
    btnStartTurn.classList.remove('hidden');
    promptImage.classList.replace('blur-none', 'blur-md');
    
    showView(viewStart);
});

window.addEventListener('DOMContentLoaded', initApp);