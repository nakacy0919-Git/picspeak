// js/main.js
// ==========================================
// アプリケーションの司令塔（初期化・状態管理・イベントの束ね役）
// ==========================================

// グローバル状態管理
window.appState = { selectedPlayers: 1, selectedLevel: 'elementary', customTimeLimit: 30 };

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let supportInterval = null; 
let timeLeft = 30; 
let timeElapsed = 0; 
let themeList = [];
let isPracticeMode = false;
let practiceTargetText = "";
let practiceRawTranscript = "";
let accumulatedTranscript = ""; 
let rawTranscriptForCounting = ""; 
let audioCtx = null;

// DOM 要素の取得
const viewStart = document.getElementById('view-start');
const viewSelect = document.getElementById('view-select'); 
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');
const themeGrid = document.getElementById('theme-grid'); 
const supportToggle = document.getElementById('support-toggle'); 
const supportTextContainer = document.getElementById('support-text-container'); 

const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');
const btnHomeFromPlay = document.getElementById('btn-home-from-play'); 
const btnGotoSelect = document.getElementById('btn-goto-select'); 
const btnBackToStart = document.getElementById('btn-back-to-start'); 

const practiceModal = document.getElementById('practice-modal');
const btnStartPractice = document.getElementById('btn-start-practice');
const practiceTranscriptBox = document.getElementById('practice-transcript');
const practiceFeedbackBox = document.getElementById('practice-feedback');

const promptImage = document.getElementById('prompt-image');
const transcriptBox = document.getElementById('transcript-box');
const scoreDisplay = document.getElementById('scoreDisplay');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const liveWpmDisplay = document.getElementById('liveWpmDisplay');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const statusText = document.getElementById('status-text');
const liveCompletionBar = document.getElementById('live-completion-bar');
const liveCompletionText = document.getElementById('live-completion-text');
const comboOverlay = document.getElementById('combo-overlay');
const comboContent = document.getElementById('combo-content');
const perfectOverlay = document.getElementById('perfect-overlay'); 
const perfectContent = document.getElementById('perfect-content');
const pinContainer = document.getElementById('pin-container');

// 初期化処理
async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。\niPhoneをお使いの場合は、標準の「Safari」アプリを開いてプレイしてください。");
        if(btnGotoSelect) { btnGotoSelect.disabled = true; btnGotoSelect.textContent = "ブラウザ非対応"; }
        return; 
    }
    initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    try {
        const response = await fetch('data/theme_list.json?t=' + new Date().getTime());
        themeList = await response.json();
    } catch (error) {
        console.error("テーマリスト読み込み失敗:", error);
    }
}

// サムネイル一覧の生成と表示
async function renderThemeGrid() {
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-2xl">Loading Images...</div>';
    let html = '';
    for (const id of themeList) {
        try {
            const res = await fetch(`data/themes/${id}.json?t=${new Date().getTime()}`);
            let data = await res.json(); data = Array.isArray(data) ? data[0] : data;
            html += `<div class="theme-card cursor-pointer rounded-3xl overflow-hidden shadow-lg border-4 border-transparent hover:border-pink-400 hover:shadow-2xl transition-all relative transform hover:-translate-y-2 bg-white" data-id="${id}"><img src="${data.imageSrc}" class="w-full h-32 md:h-48 lg:h-64 object-cover"><div class="p-4 md:p-6 text-center text-sm md:text-lg lg:text-xl font-black text-gray-700 truncate border-t-2 border-gray-100">${data.description || 'No Title'}</div></div>`;
        } catch(e) { console.error(e); }
    }
    themeGrid.innerHTML = html;
    document.querySelectorAll('.theme-card').forEach(card => { 
        card.addEventListener('click', () => startGameWithTheme(card.getAttribute('data-id'))); 
    });
}

// ゲームの開始設定
async function startGameWithTheme(id) {
    try {
        const res = await fetch(`data/themes/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) { alert(`データの読み込みに失敗しました。`); return; }
    
    if (currentTheme && currentTheme.imageSrc) {
        promptImage.src = currentTheme.imageSrc;
        if(promptImage.classList.contains('blur-none')) promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    timeLeft = window.appState.customTimeLimit; timeElapsed = 0; rawTranscriptForCounting = ""; accumulatedTranscript = ""; 
    resetScore(); scoreDisplay.textContent = "0"; wordCountDisplay.textContent = "0";
    if(liveWpmDisplay) liveWpmDisplay.textContent = "0";
    if(liveCompletionBar) liveCompletionBar.style.width = '0%';
    if(liveCompletionText) liveCompletionText.textContent = '0%';
    pinContainer.innerHTML = ''; supportTextContainer.innerHTML = '';
    transcriptBox.innerHTML = `<p class="text-gray-400 italic font-bold uppercase tracking-wide">Press START and speak loudly. ❤️📍🏙️✨</p>`;
    
    if(btnStartTurn) btnStartTurn.classList.add('animate-attention');
    if (typeof showView === 'function') showView(viewPlay);
}


// --- イベントリスナーの登録（司令塔の役割） ---

window.addEventListener('DOMContentLoaded', initApp);

if (btnGotoSelect) {
    btnGotoSelect.addEventListener('click', () => {
        try {
            const elem = document.documentElement;
            if (!document.fullscreenElement) {
                if (elem.requestFullscreen) elem.requestFullscreen().catch(e=>e);
                else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            }
        } catch (e) {}
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (typeof showView === 'function') showView(viewSelect); 
        renderThemeGrid();
    });
}

if (btnBackToStart) { btnBackToStart.addEventListener('click', () => { if (typeof showView === 'function') showView(viewStart); }); }

if (btnStartTurn) {
    btnStartTurn.addEventListener('click', () => {
        startSpeech(); isRecording = true;
        btnStartTurn.classList.remove('animate-attention'); btnStartTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.remove('hidden');
        if(statusText) statusText.textContent = "Speak Now!";
        if(promptImage) { promptImage.classList.remove('blur-md'); promptImage.classList.add('blur-none'); }
        
        if (timeElapsed === 0 && supportToggle && supportToggle.checked) {
            const targetData = getAggregatedData(currentTheme, window.appState.selectedLevel);
            targetData.words.forEach(w => window.dropPin(w.text, currentTheme, true));
            supportInterval = setInterval(window.triggerSupportHint, 6000);
        }
        if (timeElapsed === 0) window.startTimer();
    });
}

if (recordingIndicator) recordingIndicator.addEventListener('click', () => window.stopRecording());

if (btnHomeFromPlay) {
    btnHomeFromPlay.addEventListener('click', () => {
        if (isRecording) window.stopRecording();
        clearInterval(gameTimer);
        if(supportInterval) clearInterval(supportInterval);
        if (typeof showView === 'function') showView(viewStart);
    });
}

// リザルト画面の生成処理を game.js の関数に丸投げ
if (btnFinishTurn) {
    btnFinishTurn.addEventListener('click', () => {
        window.finishGameAndShowResult();
    });
}

if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.add('hidden');
        if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
        if(statusText) statusText.textContent = "Ready";
        if (promptImage) { promptImage.classList.remove('blur-none'); promptImage.classList.add('blur-md'); }
        if (typeof showView === 'function') showView(viewSelect); 
        renderThemeGrid();
    });
}

// Practice Mode のボタン制御
if(btnStartPractice) {
    btnStartPractice.addEventListener('click', () => {
        if(isRecording) {
            stopSpeech(); isRecording = false;
            btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🔄</span> RETRY';
            btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
        } else {
            practiceRawTranscript = "";
            practiceTranscriptBox.innerHTML = "Listening...";
            practiceTranscriptBox.className = "text-3xl md:text-6xl font-bold text-gray-800 text-center leading-relaxed";
            practiceFeedbackBox.classList.add('hidden');
            btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🛑</span> STOP';
            btnStartPractice.classList.replace('bg-sns-gradient', 'bg-gray-800');
            startSpeech(); isRecording = true;
        }
    });
}