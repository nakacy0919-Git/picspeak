// js/main.js
// ==========================================
// アプリケーションの司令塔
// ==========================================

window.appState = { 
    selectedPlayers: 1, 
    selectedLevel: 'elementary', 
    customTimeLimit: 30,
    isPracticeMode: false,
    practiceTargetText: "",
    practiceRawTranscript: ""
};

window.isRecording = false;
window.currentTheme = null;
window.gameTimer = null;
window.supportInterval = null; 
window.timeLeft = 30; 
window.timeElapsed = 0; 
window.themeList = [];
window.accumulatedTranscript = ""; 
window.rawTranscriptForCounting = ""; 
window.audioCtx = null;

const viewStart = document.getElementById('view-start');
const viewSelect = document.getElementById('view-select'); 
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');
const viewAbout = document.getElementById('view-about');

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

const btnGotoAbout = document.getElementById('btn-goto-about');
const btnBackFromAbout = document.getElementById('btn-back-from-about');

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
const pinContainer = document.getElementById('pin-container');

async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。");
        if(btnGotoSelect) { btnGotoSelect.disabled = true; btnGotoSelect.textContent = "ブラウザ非対応"; }
        return; 
    }
    initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    try {
        const response = await fetch('data/theme_list.json?t=' + new Date().getTime());
        window.themeList = await response.json();
    } catch (error) { console.error("テーマリスト読み込み失敗:", error); }
}

window.renderThemeGrid = async function() {
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-xl md:text-2xl">Loading Images...</div>';
    
    try {
        const fetchPromises = window.themeList.map(id => 
            fetch(`data/themes/${id}.json?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => ({ id, data: Array.isArray(data) ? data[0] : data }))
            .catch(e => null)
        );
        const results = await Promise.all(fetchPromises);
        
        let html = '';
        results.forEach(item => {
            if(!item || !item.data) return;
            
            // 日本語タイトルのみを取得（description または titleJa）
            let titleText = item.data.description || item.data.titleJa || '名称未設定';

            html += `<div class="theme-card cursor-pointer rounded-2xl md:rounded-3xl overflow-hidden shadow-md border-4 border-transparent hover:border-pink-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" data-id="${item.id}">
                <div class="relative w-full aspect-video bg-gray-100 shrink-0">
                    <img src="${item.data.imageSrc}" class="absolute inset-0 w-full h-full object-cover">
                </div>
                <div class="p-3 md:p-4 text-center text-xs md:text-sm lg:text-base font-black text-gray-700 line-clamp-2 border-t border-gray-100 flex-1 flex items-center justify-center leading-tight bg-white">${titleText}</div>
            </div>`;
        });
        themeGrid.innerHTML = html;
        document.querySelectorAll('.theme-card').forEach(card => { 
            card.addEventListener('click', () => startGameWithTheme(card.getAttribute('data-id'))); 
        });
    } catch(e) {
        themeGrid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading images</div>';
    }
}

async function startGameWithTheme(id) {
    try {
        const res = await fetch(`data/themes/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        window.currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) { alert(`データの読み込みに失敗しました。`); return; }
    
    if (window.currentTheme && window.currentTheme.imageSrc) {
        promptImage.src = window.currentTheme.imageSrc;
        if(promptImage.classList.contains('blur-none')) promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    window.timeLeft = window.appState.customTimeLimit; 
    if(timerText) timerText.textContent = `${window.timeLeft}s`; 
    
    window.timeElapsed = 0; window.rawTranscriptForCounting = ""; window.accumulatedTranscript = ""; 
    resetScore(); scoreDisplay.textContent = "0"; wordCountDisplay.textContent = "0";
    if(liveWpmDisplay) liveWpmDisplay.textContent = "0";
    if(liveCompletionBar) liveCompletionBar.style.width = '0%';
    if(liveCompletionText) liveCompletionText.textContent = '0%';
    pinContainer.innerHTML = ''; supportTextContainer.innerHTML = '';
    
    transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and speak loudly.<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して、大きな声で話しましょう）</span></p>`;
    
    if(btnStartTurn) btnStartTurn.classList.add('animate-attention');
    if (typeof showView === 'function') showView(viewPlay);
}

window.openPractice = function(text, ja) {
    window.appState.isPracticeMode = true;
    window.appState.practiceTargetText = text;
    window.appState.practiceRawTranscript = "";
    
    const practiceTarget = document.getElementById('practice-target');
    const practiceJa = document.getElementById('practice-ja');
    if(practiceTarget) practiceTarget.textContent = text;
    if(practiceJa) practiceJa.textContent = ja;
    
    if(practiceTranscriptBox) {
        practiceTranscriptBox.innerHTML = "Tap START and speak...";
        practiceTranscriptBox.className = "text-2xl md:text-4xl font-medium text-gray-400 italic text-center leading-relaxed";
    }
    if(practiceFeedbackBox) practiceFeedbackBox.classList.add('hidden');
    if(btnStartPractice) {
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-5xl">🎙️</span> START';
        btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
    }
    if(practiceModal) practiceModal.classList.remove('hidden');
};

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
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        if (typeof showView === 'function') showView(viewSelect); 
        window.renderThemeGrid();
    });
}

if (btnBackToStart) { btnBackToStart.addEventListener('click', () => { if (typeof showView === 'function') showView(viewStart); }); }
if (btnGotoAbout) { btnGotoAbout.addEventListener('click', () => { if (typeof showView === 'function') showView(viewAbout); }); }
if (btnBackFromAbout) { btnBackFromAbout.addEventListener('click', () => { if (typeof showView === 'function') showView(viewStart); }); }

if (btnStartTurn) {
    btnStartTurn.addEventListener('click', () => {
        startSpeech(); window.isRecording = true;
        btnStartTurn.classList.remove('animate-attention'); btnStartTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.remove('hidden');
        if(statusText) statusText.textContent = "Speak Now!";
        if(promptImage) { promptImage.classList.remove('blur-md'); promptImage.classList.add('blur-none'); }
        
        if (window.timeElapsed === 0 && supportToggle && supportToggle.checked) {
            const targetData = getAggregatedData(window.currentTheme, window.appState.selectedLevel);
            targetData.words.forEach(w => window.dropPin(w.text, window.currentTheme, true));
            window.supportInterval = setInterval(window.triggerSupportHint, 6000);
        }
        if (window.timeElapsed === 0) window.startTimer();
    });
}

if (recordingIndicator) recordingIndicator.addEventListener('click', () => window.stopRecording());

if (btnHomeFromPlay) {
    btnHomeFromPlay.addEventListener('click', () => {
        if (window.isRecording) window.stopRecording();
        clearInterval(window.gameTimer);
        if(window.supportInterval) clearInterval(window.supportInterval);
        if (typeof showView === 'function') showView(viewStart);
    });
}

if (btnFinishTurn) { btnFinishTurn.addEventListener('click', () => { window.finishGameAndShowResult(); }); }

if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.add('hidden');
        if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
        if(statusText) statusText.textContent = "Ready";
        if (promptImage) { promptImage.classList.remove('blur-none'); promptImage.classList.add('blur-md'); }
        if (typeof showView === 'function') showView(viewSelect); 
        window.renderThemeGrid();
    });
}

const btnClosePractice = document.getElementById('btn-close-practice');
if(btnClosePractice) {
    btnClosePractice.addEventListener('click', () => {
        window.appState.isPracticeMode = false;
        if(window.isRecording) stopSpeech();
        window.isRecording = false;
        if(practiceModal) practiceModal.classList.add('hidden');
    });
}

if(btnStartPractice) {
    btnStartPractice.addEventListener('click', () => {
        if(window.isRecording) {
            stopSpeech(); window.isRecording = false;
            btnStartPractice.innerHTML = '<span class="text-3xl md:text-5xl">🔄</span> RETRY';
            btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
        } else {
            window.appState.practiceRawTranscript = "";
            practiceTranscriptBox.innerHTML = "Listening...";
            practiceTranscriptBox.className = "text-3xl md:text-5xl font-bold text-gray-800 text-center leading-relaxed";
            if(practiceFeedbackBox) practiceFeedbackBox.classList.add('hidden');
            btnStartPractice.innerHTML = '<span class="text-3xl md:text-5xl">🛑</span> STOP';
            btnStartPractice.classList.replace('bg-sns-gradient', 'bg-gray-800');
            startSpeech(); window.isRecording = true;
        }
    });
}