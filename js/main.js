// js/main.js

// ==========================================
// 1. 変数とDOM要素の取得
// ==========================================
let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let timeLeft = 30; // 制限時間(秒)
let selectedPlayers = 2; // デフォルトのプレイヤー人数

// UIの取得 (View関連)
const viewStart = document.getElementById('view-start');
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

// UIの取得 (ボタン関連)
const btnStartGame = document.getElementById('btn-start-game');
const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');
const playerBtns = document.querySelectorAll('.player-btn'); // ★追加: 人数選択ボタン

// UIの取得 (ゲーム画面関連)
const promptImage = document.getElementById('prompt-image');
const transcriptBox = document.getElementById('transcript-box');
const transcriptText = document.getElementById('transcript-text');
const scoreDisplay = document.getElementById('scoreDisplay');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const statusText = document.getElementById('status-text');

// UIの取得 (演出関連)
const comboOverlay = document.getElementById('combo-overlay');
const comboContent = document.getElementById('combo-content');

// ==========================================
// 2. 画面切り替えと初期化ロジック
// ==========================================
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
        currentTheme = themes[0]; // 今回はテストとしてテーマ1を固定でロード
        console.log("テーマロード完了:", currentTheme);
    } catch (error) {
        console.error("テーマの読み込みに失敗しました:", error);
    }
}

// ==========================================
// 3. タイマーとゲーム進行ロジック
// ==========================================
function startTimer() {
    timeLeft = currentTheme.timeLimit || 30;
    timerText.textContent = `${timeLeft}s`;
    timerBar.style.width = '100%';
    timerBar.style.transition = 'none';
    
    setTimeout(() => {
        timerBar.style.transition = `width ${timeLeft}s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    gameTimer = setInterval(() => {
        timeLeft--;
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

// ==========================================
// 4. 音声認識と演出ロジック (コア部分)
// ==========================================
let accumulatedTranscript = ""; 

function highlightText(text, result) {
    if (!result) return text;
    let html = text;

    const phrases = [...result.foundChunks, ...result.foundSentences.map(s => s.text)];
    phrases.forEach(phrase => {
        const regex = new RegExp(`(${phrase})`, 'gi');
        html = html.replace(regex, `<span class="hl-phrase">$1</span>`);
    });

    result.foundWords.forEach(word => {
        const regex = new RegExp(`\\b(${word})\\b(?![^<]*>|[^<>]*<\/span>)`, 'gi');
        html = html.replace(regex, `<span class="hl-mandatory">$1</span>`);
    });

    return html;
}

function handleSpeechResult(finalText, interimText) {
    if (finalText.trim().length > 0) {
        const result = calculateScore(finalText, currentTheme);
        
        if (result && result.addedPoints > 0) {
            scoreDisplay.textContent = result.score;
            scoreDisplay.classList.remove('animate-zoom');
            void scoreDisplay.offsetWidth; 
            scoreDisplay.classList.add('animate-zoom');

            const highlightedText = highlightText(finalText, result);
            accumulatedTranscript += `<span class="text-black font-medium">${highlightedText}</span>. `;
            
            if (parseFloat(result.multiplier) > 1.0) {
                showComboAnimation(result.multiplier, result.addedPoints);
            }
        } else {
            accumulatedTranscript += `<span class="text-gray-800">${finalText}</span>. `;
        }
    }

    transcriptBox.innerHTML = `
        <p class="mb-2 leading-relaxed">${accumulatedTranscript}</p>
        <p class="text-gray-400 italic">${interimText}</p>
    `;
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
    
    setTimeout(() => {
        comboOverlay.classList.add('hidden');
    }, 1500);
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

// ==========================================
// 5. イベントリスナー (ボタンの動作)
// ==========================================

// ★追加: プレイヤー人数の選択
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // すべてのボタンから選択状態を解除
        playerBtns.forEach(b => {
            b.classList.remove('selected-player-btn', 'border-white', 'bg-white/40');
            b.classList.add('border-transparent');
        });
        
        // クリックされたボタンを選択状態にする
        const target = e.target;
        target.classList.remove('border-transparent');
        target.classList.add('selected-player-btn', 'border-white', 'bg-white/40');
        
        selectedPlayers = parseInt(target.getAttribute('data-players'));
        console.log(`現在の設定人数: ${selectedPlayers}人`);
    });
});

// START画面 -> PLAY画面
btnStartGame.addEventListener('click', () => {
    if (currentTheme) {
        promptImage.src = currentTheme.imageSrc;
        promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    accumulatedTranscript = "";
    resetScore(); 
    scoreDisplay.textContent = "0";
    showView(viewPlay);
});

// ターン開始
btnStartTurn.addEventListener('click', () => {
    startSpeech();
    isRecording = true;
    
    btnStartTurn.classList.add('hidden');
    recordingIndicator.classList.remove('hidden');
    statusText.textContent = "Speak Now!";
    
    promptImage.classList.remove('blur-md');
    promptImage.classList.add('blur-none');
    
    transcriptBox.innerHTML = `<p class="text-gray-400 italic">Listening...</p>`;
    
    if (timeLeft === 30 || timeLeft === currentTheme.timeLimit) {
        startTimer();
    }
});

// 録音一時停止
recordingIndicator.addEventListener('click', () => {
    stopSpeech();
    statusText.textContent = "Paused";
    btnStartTurn.classList.remove('hidden');
    recordingIndicator.classList.add('hidden');
});

// ターン終了 -> RESULT画面
btnFinishTurn.addEventListener('click', () => {
    clearInterval(gameTimer);
    
    const rankingContainer = document.getElementById('ranking-container');
    const finalScore = scoreDisplay.textContent;
    rankingContainer.innerHTML = `
        <div class="bg-white rounded-xl p-4 flex items-center shadow-sm border-2 border-yellow-400 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-2 h-full bg-yellow-400"></div>
            <div class="text-3xl font-black text-yellow-500 w-12 text-center mr-2">1</div>
            <div class="flex-1">
                <div class="font-bold text-gray-800 text-lg">You</div>
                <div class="text-xs text-gray-500">Great Speaking!</div>
            </div>
            <div class="text-2xl font-black text-indigo-600">${finalScore}</div>
        </div>
    `;
    
    showView(viewResult);
});

// RESULT画面 -> START画面
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

// アプリのロード時に初期化
window.addEventListener('DOMContentLoaded', initApp);