// js/main.js

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let supportInterval = null; 
let timeLeft = 30; 
let timeElapsed = 0; 
let themeList = [];

let selectedPlayers = 1;
let selectedLevel = 'elementary'; 
let customTimeLimit = 30; 

// Practice Mode Variables
let isPracticeMode = false;
let practiceTargetText = "";
let practiceRawTranscript = "";

// UI Elements
const viewStart = document.getElementById('view-start');
const viewSelect = document.getElementById('view-select'); 
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

const btnGotoSelect = document.getElementById('btn-goto-select'); 
const btnBackToStart = document.getElementById('btn-back-to-start'); 
const themeGrid = document.getElementById('theme-grid'); 
const supportToggle = document.getElementById('support-toggle'); 
const supportTextContainer = document.getElementById('support-text-container'); 

const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');
const btnHomeFromPlay = document.getElementById('btn-home-from-play'); 

// Modals
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const settingsModal = document.getElementById('settings-modal');

const btnOpenTutorial = document.getElementById('btn-open-tutorial');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const tutorialModal = document.getElementById('tutorial-modal');

const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');

const practiceModal = document.getElementById('practice-modal');
const btnClosePractice = document.getElementById('btn-close-practice');
const btnStartPractice = document.getElementById('btn-start-practice');
const practiceTranscriptBox = document.getElementById('practice-transcript');
const practiceFeedbackBox = document.getElementById('practice-feedback');

const playerBtns = document.querySelectorAll('.player-btn');
const levelBtns = document.querySelectorAll('.level-btn'); 
const timeBtns = document.querySelectorAll('.time-btn');

const promptImage = document.getElementById('prompt-image');
const transcriptBox = document.getElementById('transcript-box');
const scoreDisplay = document.getElementById('scoreDisplay');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const liveWpmDisplay = document.getElementById('liveWpmDisplay');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const statusText = document.getElementById('status-text');
const currentLevelBadge = document.getElementById('current-level-badge'); 
const liveCompletionBar = document.getElementById('live-completion-bar');
const liveCompletionText = document.getElementById('live-completion-text');

const comboOverlay = document.getElementById('combo-overlay');
const comboContent = document.getElementById('combo-content');
const perfectOverlay = document.getElementById('perfect-overlay'); 
const perfectContent = document.getElementById('perfect-content');
const pinContainer = document.getElementById('pin-container');

let accumulatedTranscript = ""; 
let rawTranscriptForCounting = ""; 
let audioCtx = null;

// ==========================================
// Text-to-Speech
// ==========================================
window.speakText = function(text) {
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'en-US';
    speechSynthesis.speak(ut);
};

// ==========================================
// ローカルストレージ
// ==========================================
function saveLearningLog(logData) {
    let logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
    logs.unshift(logData);
    if(logs.length > 50) logs = logs.slice(0, 50);
    localStorage.setItem('picspeak_logs', JSON.stringify(logs));
}

function renderHistoryLogs() {
    let logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
    if(logs.length === 0) {
        historyList.innerHTML = `<p class="text-center text-gray-400 py-10 font-bold text-xl">まだプレイ履歴がありません。<br>遊んでスコアを残そう！</p>`;
        return;
    }
    let html = '';
    logs.forEach(log => {
        const dateObj = new Date(log.date);
        const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        let levelColor = "text-gray-500";
        if(log.level === 'elementary') levelColor = "text-green-500";
        if(log.level === 'junior_high') levelColor = "text-blue-500";
        if(log.level === 'high_school') levelColor = "text-pink-500";

        html += `
            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                <div>
                    <div class="text-sm md:text-base text-gray-400 font-bold">${dateStr} | Image: ${log.imageId}</div>
                    <div class="text-lg md:text-xl font-black uppercase mt-1 ${levelColor}">${log.level.replace('_', ' ')}</div>
                </div>
                <div class="text-right flex gap-6 md:gap-10">
                    <div class="flex flex-col items-center">
                        <span class="text-xs md:text-sm font-bold text-gray-400 uppercase">Score</span>
                        <span class="text-2xl md:text-3xl font-black text-gray-800">${log.score}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <span class="text-xs md:text-sm font-bold text-pink-400 uppercase">Comp.</span>
                        <span class="text-2xl md:text-3xl font-black text-pink-600">${log.completion}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    historyList.innerHTML = html;
}

// ==========================================
// 音声生成エンジン
// ==========================================
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    
    if (type === 'match') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); 
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); 
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } 
    else if (type === 'combo' || type === 'practice_perfect') {
        const freqs = [523.25, 659.25, 783.99, 1046.50]; 
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.value = f;
            const startTime = now + (i * 0.08);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            osc.start(startTime);
            osc.stop(startTime + 0.4);
        });
    }
    else if (type === 'perfect') {
        const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.value = f;
            const startTime = now + (i * 0.05); 
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.5);
            osc.start(startTime);
            osc.stop(startTime + 1.5);
        });
    }
}

function showView(viewElement) {
    if(!viewStart || !viewSelect || !viewPlay || !viewResult || !viewElement) return;
    viewStart.classList.add('hidden');
    viewSelect.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewElement.classList.remove('hidden');
    viewElement.classList.add('fade-in');
}

async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。\niPhoneをお使いの場合は、標準の「Safari」アプリを開いてプレイしてください。");
        if(btnGotoSelect) {
            btnGotoSelect.disabled = true;
            btnGotoSelect.textContent = "ブラウザ非対応";
        }
        return; 
    }
    initSpeechRecognition(handleSpeechResult, handleSpeechEnd);
    try {
        const response = await fetch('data/theme_list.json?t=' + new Date().getTime());
        themeList = await response.json();
    } catch (error) {
        console.error("テーマリスト読み込み失敗:", error);
    }
}

// ==========================================
// Practice Mode Logic
// ==========================================
window.openPractice = function(text, ja) {
    isPracticeMode = true;
    practiceTargetText = text;
    document.getElementById('practice-target').textContent = text;
    document.getElementById('practice-ja').textContent = ja;
    practiceTranscriptBox.innerHTML = "Tap START and speak...";
    practiceTranscriptBox.className = "text-2xl md:text-5xl font-medium text-gray-400 italic text-center leading-relaxed";
    practiceFeedbackBox.classList.add('hidden');
    btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🎙️</span> START';
    btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
    practiceModal.classList.remove('hidden');
}

btnClosePractice.addEventListener('click', () => {
    isPracticeMode = false;
    if(isRecording) stopSpeech();
    isRecording = false;
    practiceModal.classList.add('hidden');
});

btnStartPractice.addEventListener('click', () => {
    if(isRecording) {
        stopSpeech();
        isRecording = false;
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🔄</span> RETRY';
        btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
    } else {
        practiceRawTranscript = "";
        practiceTranscriptBox.innerHTML = "Listening...";
        practiceTranscriptBox.className = "text-3xl md:text-6xl font-bold text-gray-800 text-center leading-relaxed";
        practiceFeedbackBox.classList.add('hidden');
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🛑</span> STOP';
        btnStartPractice.classList.replace('bg-sns-gradient', 'bg-gray-800');
        startSpeech();
        isRecording = true;
    }
});

function processPracticeDiff(spoken, target) {
    if (!spoken.trim()) return { html: "", isPerfect: false };
    const targetWords = target.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
    const spokenWordsRaw = spoken.trim().split(/\s+/);
    let html = '';
    spokenWordsRaw.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?]/g, '');
        if (cleanWord && !targetWords.includes(cleanWord)) {
            html += `<span class="text-purple-600 font-black border-b-[6px] border-purple-300 bg-purple-50 px-2 mx-1 rounded-lg">${word}</span>`;
        } else {
            html += `${word} `;
        }
    });
    const normalizedSpoken = spoken.toLowerCase().replace(/[.,!?]/g, '');
    const normalizedTarget = target.toLowerCase().replace(/[.,!?]/g, '');
    const isPerfect = normalizedSpoken.includes(normalizedTarget) && normalizedTarget.length > 0;
    return { html: html.trim(), isPerfect };
}

// ==========================================
// Support Mode Logic
// ==========================================
function triggerSupportHint() {
    if (!supportToggle.checked || !currentTheme || timeLeft <= 0 || !isRecording) return;
    const targetData = getAggregatedData(currentTheme, selectedLevel);
    const availableHints = [];
    targetData.chunks.forEach(c => { if(!foundChunksSet.has(c.text)) availableHints.push(c); });
    targetData.sentences.forEach(s => { if(!foundSentencesSet.has(s.text)) availableHints.push(s); });
    
    if (availableHints.length > 0) {
        const hint = availableHints[Math.floor(Math.random() * availableHints.length)];
        const hintEl = document.createElement('div');
        hintEl.className = 'absolute top-[50%] left-[50%] flex flex-col items-center justify-center support-text-float w-[90%] pointer-events-none z-[30]';
        hintEl.innerHTML = `
            <div class="bg-black/70 backdrop-blur-md text-white px-8 py-6 rounded-3xl shadow-2xl border border-white/20 text-center">
                <div class="text-3xl md:text-5xl lg:text-6xl font-black tracking-wide drop-shadow-md mb-2">${hint.text}</div>
                <div class="text-lg md:text-2xl font-bold text-gray-300">${hint.ja}</div>
            </div>
        `;
        supportTextContainer.appendChild(hintEl);
        setTimeout(() => { if(supportTextContainer.contains(hintEl)) supportTextContainer.removeChild(hintEl); }, 5000);
    }
}


// ==========================================
// Core Game Logic
// ==========================================
function startTimer() {
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

        const currentWords = parseInt(wordCountDisplay.textContent) || 0;
        const currentWpm = Math.round(currentWords / (timeElapsed / 60));
        if(liveWpmDisplay) liveWpmDisplay.textContent = currentWpm;

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            stopRecording();
            statusText.textContent = "Time's Up!";
        }
    }, 1000);
}

function dropPin(word, theme, isHint = false) {
    if (!theme || !theme.pins || !theme.pins[word.toLowerCase()]) return;
    const pinData = theme.pins[word.toLowerCase()];
    const pin = document.createElement('div');
    pin.className = 'absolute flex flex-col items-center justify-center pin-drop z-20';
    pin.style.left = `${pinData.x}%`;
    pin.style.top = `${pinData.y}%`;
    pin.style.transform = 'translate(-50%, -100%)';
    
    const opacityClass = isHint ? 'opacity-80 bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-white text-gray-900 drop-shadow-md';
    const heart = isHint ? '📍' : '❤️';
    
    pin.innerHTML = `<div class="${opacityClass} text-xs md:text-lg lg:text-xl font-black px-3 md:px-4 py-1 md:py-2 rounded-full shadow-lg border-2 mb-1.5 md:mb-2 tracking-wider uppercase">${heart} ${word}</div><div class="w-1.5 md:w-2 h-4 md:h-6 bg-gray-300 shadow-sm rounded-b-full"></div>`;
    
    if(!isHint) {
        const popEffect = document.createElement('div');
        popEffect.className = 'pin-pop-effect';
        pin.appendChild(popEffect);
    }
    pinContainer.appendChild(pin);
}

function highlightGlobalText(text) {
    if (!text) return "";
    let html = text;
    const phrases = [...Array.from(foundChunksSet), ...Array.from(foundSentencesSet)].sort((a, b) => b.length - a.length);
    phrases.forEach(phrase => {
        const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(regex, `<span class="hl-phrase">$1</span>`);
    });
    const words = Array.from(foundWordsSet).sort((a, b) => b.length - a.length);
    words.forEach(word => {
        const regex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?![^<]*>|[^<>]*<\/span>)`, 'gi');
        html = html.replace(regex, `<span class="hl-mandatory">$1</span>`);
    });
    return html;
}

function handleSpeechResult(finalText, interimText) {
    if (isPracticeMode) {
        if (finalText.trim().length > 0) practiceRawTranscript += finalText + " ";
        const currentTempText = practiceRawTranscript + interimText;
        const diffResult = processPracticeDiff(currentTempText, practiceTargetText);
        practiceTranscriptBox.innerHTML = diffResult.html || "Listening...";
        
        if (diffResult.isPerfect) {
            practiceFeedbackBox.innerHTML = '<span class="text-transparent bg-clip-text bg-sns-gradient text-5xl md:text-7xl font-black drop-shadow-md animate-perfect">Great Job! ✨</span>';
            practiceFeedbackBox.classList.remove('hidden');
            playSound('practice_perfect');
            stopSpeech();
            isRecording = false;
            btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">✅</span> NEXT';
            btnStartPractice.classList.replace('bg-gray-800', 'bg-gray-300');
        }
        return;
    }

    if (finalText.trim().length > 0) rawTranscriptForCounting += finalText + " ";
    const currentTempText = rawTranscriptForCounting + interimText;
    const wordsArray = currentTempText.trim().split(/[\s,.?!]+/).filter(w => w.length > 0);
    wordCountDisplay.textContent = wordsArray.length;
    
    if (currentTempText.trim().length > 0 && currentTheme) {
        const result = calculateScore(currentTempText, currentTheme, selectedLevel);
        if (result && result.addedPoints > 0) {
            scoreDisplay.textContent = result.score;
            const stats = getCompletionStats(currentTheme, selectedLevel);
            if(liveCompletionBar && liveCompletionText) {
                liveCompletionBar.style.width = `${stats.completionRate}%`;
                liveCompletionText.textContent = `${stats.completionRate}%`;
            }
            if (result.newWords && result.newWords.length > 0) {
                result.newWords.forEach(word => { dropPin(word, currentTheme); });
            }
            if (result.isPerfect) {
                playSound('perfect');
                showPerfectAnimation(result.addedPoints);
            } else if (parseFloat(result.multiplier) > 1.0) {
                playSound('combo');
                showComboAnimation(result.multiplier, result.addedPoints);
            } else {
                playSound('match');
            }
        }
    }
    
    let highlightedHTML = highlightGlobalText(currentTempText);
    if (currentTempText.trim().length > 0) {
         transcriptBox.innerHTML = `<p class="mb-2 leading-relaxed font-medium text-gray-900">${highlightedHTML}</p>`;
    } else {
         transcriptBox.innerHTML = `<p class="text-gray-400 italic font-medium uppercase tracking-wide">Press START and speak loudly. </p>`;
    }
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

function handleSpeechEnd() {
    isRecording = false;
    if (isPracticeMode) {
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🔄</span> RETRY';
        btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
        return;
    }
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if (timeLeft > 0) {
        if(btnStartTurn) {
            btnStartTurn.classList.remove('hidden');
            btnStartTurn.classList.add('animate-attention');
        }
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden'); 
        if(statusText) statusText.textContent = "Paused";
    } else {
        if(btnStartTurn) btnStartTurn.classList.add('hidden');
        if(btnFinishTurn) btnFinishTurn.classList.remove('hidden');
        if(statusText) statusText.textContent = "Time's Up!";
    }
}

function stopRecording() {
    stopSpeech();
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if(supportInterval) clearInterval(supportInterval);

    if (timeLeft <= 0) {
        if(btnStartTurn) btnStartTurn.classList.add('hidden');
        if(btnFinishTurn) btnFinishTurn.classList.remove('hidden'); 
        if(statusText) statusText.textContent = "Time's Up!";
    } else {
        if(btnStartTurn) {
            btnStartTurn.classList.remove('hidden');
            btnStartTurn.classList.add('animate-attention');
        }
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(statusText) statusText.textContent = "Paused";
    }
    if(timerBar) timerBar.style.transition = 'none';
}

function showComboAnimation(multiplier, points) {
    if(!comboOverlay) return;
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `<div class="text-6xl md:text-8xl lg:text-9xl font-black text-transparent bg-clip-text bg-sns-gradient drop-shadow-2xl animate-combo tracking-tighter">x${multiplier} COMBO!</div><div class="text-3xl md:text-5xl font-bold text-gray-800 mt-4 animate-phrase">+${points} pts</div>`;
    setTimeout(() => { comboOverlay.classList.add('hidden'); }, 1500);
}

function showPerfectAnimation(points) {
    if(!perfectOverlay) return;
    perfectOverlay.classList.remove('hidden');
    perfectContent.innerHTML = `<div class="text-7xl md:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(252,175,69,1)] animate-perfect tracking-tighter uppercase">PERFECT!!</div><div class="text-4xl md:text-6xl font-black text-white mt-6 drop-shadow-xl animate-phrase">+${points} pts 🔥</div>`;
    setTimeout(() => { perfectOverlay.classList.add('hidden'); }, 2000);
}

// ★修正: リザルト画面のアコーディオン内の文字やボタンも大きく
function createFeedbackSection(title, items, type, isCleared) {
    if(items.length === 0) return '';
    const limit = type === 'sentence' ? 2 : 6;
    let bgColor = isCleared ? 'bg-blue-50' : 'bg-gray-50';
    let borderColor = isCleared ? 'border-blue-100' : 'border-gray-200';
    let textColor = isCleared ? 'text-blue-800' : 'text-gray-700';
    let subTextColor = isCleared ? 'text-blue-500' : 'text-gray-400';
    
    let html = `<div class="mb-10"><p class="text-lg md:text-2xl font-black text-gray-400 mb-6 uppercase tracking-widest border-b-2 pb-2 flex items-center justify-between"><span>${title} <span class="text-base md:text-lg bg-gray-200 text-gray-600 px-3 py-1 rounded-full ml-3">${items.length}</span></span></p><div class="${type === 'sentence' ? 'space-y-4' : 'flex flex-wrap gap-3'}">`;
    items.forEach((item, index) => {
        const hiddenClass = index >= limit ? 'hidden extra-item' : '';
        const escapedText = item.text.replace(/'/g, "\\'");
        const btnHTML = `<div class="flex items-center gap-2 shrink-0 bg-white/60 rounded-full px-2 py-1 border border-black/10"><button class="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full hover:bg-white transition-colors text-xl md:text-2xl shadow-sm" onclick="speakText('${escapedText}')" title="Read Aloud">🔊</button><button class="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full hover:bg-white transition-colors text-xl md:text-2xl shadow-sm" onclick="openPractice('${escapedText}', '${item.ja}')" title="Practice Pronunciation">🎤</button></div>`;
        if (type === 'sentence') {
            html += `<div class="${bgColor} p-6 md:p-8 rounded-3xl border-2 ${borderColor} shadow-sm ${hiddenClass} transition-all"><div class="flex justify-between items-start gap-6"><div class="font-bold ${textColor} text-xl md:text-3xl leading-snug">${item.text}</div>${btnHTML}</div><div class="text-base md:text-xl ${subTextColor} font-medium mt-3">${item.ja}</div></div>`;
        } else {
            html += `<div class="${bgColor} pl-5 pr-2 py-2 rounded-full border-2 ${borderColor} shadow-sm flex items-center justify-between gap-4 ${hiddenClass}"><div><span class="font-bold ${textColor} text-lg md:text-2xl">${item.text}</span><span class="text-sm md:text-lg font-medium ${subTextColor} ml-3">${item.ja}</span></div>${btnHTML}</div>`;
        }
    });
    html += `</div>`;
    if(items.length > limit) html += `<button class="mt-6 text-lg md:text-xl font-black text-pink-500 hover:text-pink-600 transition-colors toggle-more-btn flex items-center gap-2"><span class="pointer-events-none">もっと表現を確認する</span> <span class="text-2xl pointer-events-none">▼</span></button>`;
    html += `</div>`;
    return html;
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-more-btn')) {
        const parent = e.target.closest('div.mb-10');
        const extraItems = parent.querySelectorAll('.extra-item');
        const isHidden = extraItems[0].classList.contains('hidden');
        extraItems.forEach(item => item.classList.toggle('hidden'));
        e.target.innerHTML = isHidden ? '<span class="pointer-events-none">閉じる</span> <span class="text-2xl pointer-events-none">▲</span>' : '<span class="pointer-events-none">もっと表現を確認する</span> <span class="text-2xl pointer-events-none">▼</span>';
    }
});

// ==========================================
// Setup & Listeners
// ==========================================
if(btnOpenTutorial) btnOpenTutorial.addEventListener('click', () => tutorialModal.classList.remove('hidden'));
if(btnCloseTutorial) btnCloseTutorial.addEventListener('click', () => tutorialModal.classList.add('hidden'));
if(btnOpenHistory) { btnOpenHistory.addEventListener('click', () => { renderHistoryLogs(); historyModal.classList.remove('hidden'); }); }
if(btnCloseHistory) btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));
if(btnOpenSettings) btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
if(btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

timeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        timeBtns.forEach(b => { b.classList.remove('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200'); });
        const target = e.currentTarget;
        target.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200');
        target.classList.add('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        customTimeLimit = parseInt(target.getAttribute('data-time'));
    });
});

playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => { b.classList.remove('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-white', 'border-gray-200', 'text-gray-700'); });
        const target = e.currentTarget; 
        target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
        target.classList.add('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        selectedPlayers = parseInt(target.getAttribute('data-players'));
    });
});

levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelBtns.forEach(b => { b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-white', 'border-gray-200', 'text-gray-700'); });
        const target = e.currentTarget;
        target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
        target.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        selectedLevel = target.getAttribute('data-level');
        let levelText = "中学生レベル";
        if (selectedLevel === "elementary") levelText = "小学生レベル";
        if (selectedLevel === "high_school") levelText = "高校生レベル";
        if(currentLevelBadge) currentLevelBadge.textContent = levelText;
    });
});

// ★修正: サムネイル画像も巨大化
async function renderThemeGrid() {
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-2xl">Loading Images...</div>';
    let html = '';
    for (const id of themeList) {
        try {
            const res = await fetch(`data/themes/${id}.json?t=${new Date().getTime()}`);
            let data = await res.json();
            data = Array.isArray(data) ? data[0] : data;
            html += `
                <div class="theme-card cursor-pointer rounded-3xl overflow-hidden shadow-lg border-4 border-transparent hover:border-pink-400 hover:shadow-2xl transition-all relative transform hover:-translate-y-2 bg-white" data-id="${id}">
                    <img src="${data.imageSrc}" class="w-full h-32 md:h-48 lg:h-64 object-cover">
                    <div class="p-4 md:p-6 text-center text-sm md:text-lg lg:text-xl font-black text-gray-700 truncate border-t-2 border-gray-100">${data.description || 'No Title'}</div>
                </div>
            `;
        } catch(e) { console.error(e); }
    }
    themeGrid.innerHTML = html;
    document.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            startGameWithTheme(id);
        });
    });
}

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
        
        showView(viewSelect);
        renderThemeGrid();
    });
}

if (btnBackToStart) {
    btnBackToStart.addEventListener('click', () => { showView(viewStart); });
}

async function startGameWithTheme(id) {
    try {
        const res = await fetch(`data/themes/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) {
        alert(`データの読み込みに失敗しました。`);
        return; 
    }
    if (currentTheme && currentTheme.imageSrc) {
        promptImage.src = currentTheme.imageSrc;
        if(promptImage.classList.contains('blur-none')) promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    timeLeft = customTimeLimit; timeElapsed = 0; rawTranscriptForCounting = ""; accumulatedTranscript = ""; 
    resetScore(); scoreDisplay.textContent = "0"; wordCountDisplay.textContent = "0";
    if(liveWpmDisplay) liveWpmDisplay.textContent = "0";
    if(liveCompletionBar) liveCompletionBar.style.width = '0%';
    if(liveCompletionText) liveCompletionText.textContent = '0%';
    pinContainer.innerHTML = ''; supportTextContainer.innerHTML = '';
    transcriptBox.innerHTML = `<p class="text-gray-400 italic font-bold uppercase tracking-wide">Press START and speak loudly. </p>`;
    
    if(btnStartTurn) btnStartTurn.classList.add('animate-attention');
    showView(viewPlay);
}

if (btnStartTurn) {
    btnStartTurn.addEventListener('click', () => {
        startSpeech();
        isRecording = true;
        btnStartTurn.classList.remove('animate-attention');
        btnStartTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.remove('hidden');
        if(statusText) statusText.textContent = "Speak Now!";
        if(promptImage) { promptImage.classList.remove('blur-md'); promptImage.classList.add('blur-none'); }
        
        if (timeElapsed === 0 && supportToggle && supportToggle.checked) {
            const targetData = getAggregatedData(currentTheme, selectedLevel);
            targetData.words.forEach(w => dropPin(w.text, currentTheme, true));
            supportInterval = setInterval(triggerSupportHint, 6000);
        }
        if (timeElapsed === 0) startTimer();
    });
}

if (recordingIndicator) recordingIndicator.addEventListener('click', () => stopRecording());

if (btnHomeFromPlay) {
    btnHomeFromPlay.addEventListener('click', () => {
        if (isRecording) stopRecording();
        clearInterval(gameTimer);
        if(supportInterval) clearInterval(supportInterval);
        showView(viewStart);
    });
}

if (btnFinishTurn) {
    btnFinishTurn.addEventListener('click', () => {
        clearInterval(gameTimer);
        if(supportInterval) clearInterval(supportInterval);
        const finalScore = scoreDisplay.textContent;
        const finalWordCount = parseInt(wordCountDisplay.textContent) || 0;
        let wpm = timeElapsed > 0 ? Math.round(finalWordCount / (timeElapsed / 60)) : 0;
        const stats = getCompletionStats(currentTheme, selectedLevel);

        saveLearningLog({ date: new Date().toISOString(), imageId: currentTheme.id || 'unknown', level: selectedLevel, score: finalScore, completion: stats.completionRate, wpm: wpm });

        // ★修正: リザルト画面の文字もダイナミックに！
        const rankingContainer = document.getElementById('ranking-container');
        let html = `
            <div class="flex flex-col xl:flex-row gap-8 mb-10">
                <div class="xl:w-2/5 shrink-0 bg-white rounded-3xl p-4 shadow-lg border border-gray-100 flex items-center justify-center">
                    <img src="${currentTheme.imageSrc}" class="w-full h-64 xl:h-full object-cover rounded-2xl">
                </div>
                <div class="xl:w-3/5 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 content-start">
                    <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Score</span><span class="text-5xl md:text-7xl font-black text-gray-900">${finalScore}</span></div>
                    <div class="bg-sns-gradient rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-xl text-white transform hover:scale-[1.02] transition-transform"><span class="text-white/80 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Completion</span><span class="text-5xl md:text-7xl font-black">${stats.completionRate}<span class="text-3xl">%</span></span></div>
                    <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Words</span><span class="text-5xl md:text-7xl font-black text-gray-900">${finalWordCount}</span></div>
                    <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">WPM</span><span class="text-5xl md:text-7xl font-black text-gray-900">${wpm}</span></div>
                    <div class="col-span-2 md:col-span-4 bg-gray-50 rounded-3xl p-6 md:p-10 border border-gray-200 mt-4 h-64 overflow-y-auto shadow-inner"><span class="text-gray-400 font-extrabold text-sm md:text-xl tracking-widest mb-4 block uppercase">Your Transcript</span><div class="text-2xl md:text-4xl font-medium text-gray-700 leading-relaxed">${highlightGlobalText(rawTranscriptForCounting) || "No words recorded."}</div></div>
                </div>
            </div>
            <div class="flex flex-col gap-10">
                <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                    <div class="bg-gray-100 px-8 py-6 border-b border-gray-200 flex items-center justify-between"><h3 class="text-2xl md:text-4xl font-black text-gray-700 tracking-wider">💡 NEXT TARGETS <span class="text-lg md:text-2xl font-bold text-gray-500 ml-4">言えなかった表現</span></h3></div>
                    <div class="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
                        <div>${createFeedbackSection('Words', stats.missedWords, 'word', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                        <div>${createFeedbackSection('Chunks', stats.missedChunks, 'chunk', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                        <div>${createFeedbackSection('Sentences', stats.missedSentences, 'sentence', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                    </div>
                </div>
                <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                    <div class="bg-blue-100 px-8 py-6 border-b border-blue-200 flex items-center justify-between"><h3 class="text-2xl md:text-4xl font-black text-blue-800 tracking-wider">✨ CLEARED <span class="text-lg md:text-2xl font-bold text-blue-600 ml-4">言えた表現</span></h3></div>
                    <div class="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
                        <div>${createFeedbackSection('Words', stats.clearedWords, 'word', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                        <div>${createFeedbackSection('Chunks', stats.clearedChunks, 'chunk', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                        <div>${createFeedbackSection('Sentences', stats.clearedSentences, 'sentence', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                    </div>
                </div>
            </div>
        `;
        rankingContainer.innerHTML = html;
        showView(viewResult);
    });
}

if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.add('hidden');
        if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
        if(statusText) statusText.textContent = "Ready";
        if (promptImage) { promptImage.classList.remove('blur-none'); promptImage.classList.add('blur-md'); }
        showView(viewSelect);
        renderThemeGrid();
    });
}

const resizer = document.getElementById('resizer');
const imagePanel = document.getElementById('image-panel');
let startY = 0; let startHeight = 0;
if (resizer && imagePanel) {
    resizer.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; startHeight = imagePanel.getBoundingClientRect().height; e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', (e) => {
        if (startY === 0) return;
        let newHeight = startHeight + (e.touches[0].clientY - startY);
        if (newHeight < 100) newHeight = 100;
        if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
        imagePanel.style.height = `${newHeight}px`;
    }, { passive: false });
    document.addEventListener('touchend', () => { startY = 0; });
}

window.addEventListener('DOMContentLoaded', initApp);