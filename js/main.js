// js/main.js
// ==========================================
// アプリケーションの司令塔
// ==========================================

window.appState = { 
    selectedMode: null,
    selectedLevel: null,
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

// ==========================================
// ★ 新・アカデミックリザルト描画機能 (Snapshot)
// ==========================================
window.renderSnapshotResult = function() {
    // スコアリングのデータを取得
    const stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel);
    // 音声認識の結果を取得
    const finalTranscript = document.getElementById('transcript-box').innerText.replace("Press START and speak loudly.（STARTを押して、大きな声で話しましょう）", "").trim();

    // 以前のranking-containerを使用する（元のidに合わせています）
    const container = document.getElementById('ranking-container');
    if (!container) return;

    let categoryHtml = "";
    
    const themeColors = {
        "object": { light: "bg-green-50", border: "border-green-200", text: "text-green-700", dark: "bg-green-500", label: "text-green-500" },
        "attribute": { light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dark: "bg-orange-500", label: "text-orange-500" },
        "detail": { light: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dark: "bg-purple-500", label: "text-purple-500" },
        "gist": { light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dark: "bg-blue-500", label: "text-blue-500" },
        "inference": { light: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", dark: "bg-pink-500", label: "text-pink-500" },
        "other": { light: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dark: "bg-gray-500", label: "text-gray-500" }
    };

    if (stats.categories) {
        Object.entries(stats.categories).forEach(([key, cat]) => {
            if (cat.cleared.length === 0 && cat.missed.length === 0) return;
            
            const colors = themeColors[key] || themeColors["other"];
            let itemsHtml = "";
            
            cat.cleared.forEach(item => {
                itemsHtml += `
                    <div class="flex items-start gap-2 mb-2 ${colors.light} p-2 rounded-lg border ${colors.border}">
                        <span class="text-sm font-bold ${colors.text} flex-1">${item.ja} <span class="text-xs opacity-70 font-normal ml-1">(${item.text})</span></span>
                        <span class="${colors.label} font-black text-lg shrink-0">✅</span>
                    </div>`;
            });
            
            cat.missed.forEach(item => {
                itemsHtml += `
                    <div class="flex items-start gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-200 opacity-80">
                        <span class="text-sm font-bold text-gray-500 flex-1 line-through decoration-gray-400">${item.ja} <span class="text-xs font-normal ml-1">(${item.text})</span></span>
                        <span class="text-red-400 font-black text-lg shrink-0">❌</span>
                    </div>`;
            });

            const totalInCat = cat.cleared.length + cat.missed.length;
            const catMatchRate = totalInCat === 0 ? 0 : Math.floor((cat.cleared.length / totalInCat) * 100);
            
            categoryHtml += `
                <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-200 mb-5 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full ${colors.dark}"></div>
                    <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                        <h4 class="font-black text-gray-800 text-lg pl-2">${cat.label}</h4>
                        <span class="font-black ${catMatchRate >= 80 ? 'text-green-500' : catMatchRate >= 50 ? 'text-yellow-500' : 'text-pink-500'} text-2xl">${catMatchRate}%</span>
                    </div>
                    <div class="flex flex-col">${itemsHtml}</div>
                </div>
            `;
        });
    }

    const totalWords = finalTranscript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w).length;
    const wpm = Math.round(totalWords / (window.appState.customTimeLimit / 60));

    let html = `
        <div class="flex flex-col lg:flex-row gap-4 md:gap-6 h-full w-full max-w-6xl mx-auto">
            <div class="w-full lg:w-1/3 flex flex-col gap-4 shrink-0 pb-4 lg:pb-0">
                <div class="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-6 flex flex-col items-center shadow-lg text-white relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 opacity-10 text-9xl">📸</div>
                    <span class="text-white/90 font-extrabold text-xs tracking-widest mb-1 uppercase">Overall Accuracy</span>
                    <span class="text-7xl font-black">${stats.completionRate}<span class="text-3xl">%</span></span>
                    <p class="text-sm font-medium text-white/90 mt-4 text-center">写真の情報をどれだけ正確に、詳しく伝えられたかの達成率です。</p>
                </div>
                <div class="flex gap-4">
                    <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-sm border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[10px] tracking-widest mb-1 uppercase">Total Words</span>
                        <span class="text-3xl font-black text-gray-800">${totalWords}</span>
                    </div>
                    <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-sm border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[10px] tracking-widest mb-1 uppercase">WPM (Speed)</span>
                        <span class="text-3xl font-black text-gray-800">${wpm || 0}</span>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-3xl p-5 shadow-inner border border-gray-200 flex-1 overflow-y-auto">
                    <span class="text-gray-400 font-extrabold text-[10px] tracking-widest mb-2 uppercase block">Your Speech (あなたの音声)</span>
                    <div class="text-base font-medium text-gray-700 italic leading-relaxed">"${finalTranscript || 'No speech recorded.'}"</div>
                </div>
            </div>

            <div class="w-full lg:w-2/3 flex flex-col lg:h-full lg:overflow-y-auto pb-20">
                <div class="mb-4">
                    <h3 class="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                        Category Analysis
                    </h3>
                    <p class="text-sm text-gray-600 font-bold bg-blue-50 p-3 rounded-xl border border-blue-100">
                        💡 <span class="text-pink-600">❌ がついている表現</span> があなたの説明に不足していた要素です。次回はこのカテゴリーの単語を意識して使ってみましょう！
                    </p>
                </div>
                ${categoryHtml}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
};

// ★修正: ゲーム終了時に新しいリザルト関数を呼び出すように変更
window.finishGameAndShowResult = function() {
    window.stopRecording();
    if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    
    // リザルト画面を描画！
    window.renderSnapshotResult();
    
    if (typeof showView === 'function') showView(viewResult);
};


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
        if(!window.appState.selectedLevel || !window.appState.selectedMode) return;

        if (window.appState.selectedMode === 'story') {
            window.location.href = 'story.html';
            return;
        }

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

// 終了ボタンのイベントリスナーは finishGameAndShowResult() に差し替え済み
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