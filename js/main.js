// js/main.js

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let timeLeft = 30; 
let timeElapsed = 0; 

let selectedPlayers = 2;
let selectedLevel = 'junior_high'; 
let customTimeLimit = 30; // ★NEW: ユーザーが設定した時間

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

// ★NEW: 設定モーダル関連UI
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const settingsModal = document.getElementById('settings-modal');
const timeBtns = document.querySelectorAll('.time-btn');

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

// 音声記録用変数
let accumulatedTranscript = ""; 
let rawTranscriptForCounting = ""; 

function showView(viewElement) {
    viewStart.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewElement.classList.remove('hidden');
    viewElement.classList.add('fade-in');
}

async function initApp() {
    // Safari/Chromeの音声認識APIサポートチェック
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。\n\niPhoneをお使いの場合は、標準の「Safari」アプリを開いてプレイしてください。");
        btnStartGame.disabled = true;
        btnStartGame.classList.replace('bg-red-600', 'bg-gray-600');
        btnStartGame.textContent = "ブラウザ非対応";
        return; 
    }

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
    // ★NEW: 選択されたカスタム時間を適用
    timeLeft = customTimeLimit;
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
            timerBar.classList.replace('bg-red-600', 'bg-orange-500');
            timerText.classList.replace('text-white', 'text-orange-400');
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
        <div class="bg-red-600 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 md:py-1 rounded-full shadow-lg border border-white mb-1 tracking-wider uppercase">
            ${word}
        </div>
        <div class="w-1 h-3 md:h-4 bg-red-700 shadow-sm rounded-b-full"></div>
    `;
    pinContainer.appendChild(pin);
}

function highlightGlobalText(text) {
    if (!text) return "";
    let html = text;

    const phrases = [...Array.from(foundChunksSet), ...Array.from(foundSentencesSet)];
    phrases.sort((a, b) => b.length - a.length);

    phrases.forEach(phrase => {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        html = html.replace(regex, `<span class="hl-phrase">$1</span>`);
    });

    const words = Array.from(foundWordsSet);
    words.sort((a, b) => b.length - a.length);
    words.forEach(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escaped})\\b(?![^<]*>|[^<>]*<\/span>)`, 'gi');
        html = html.replace(regex, `<span class="hl-mandatory">$1</span>`);
    });

    return html;
}

function handleSpeechResult(finalText, interimText) {
    if (finalText.trim().length > 0) {
        rawTranscriptForCounting += finalText + " ";
    }
    
    const currentTempText = rawTranscriptForCounting + interimText;
    
    const wordsArray = currentTempText.trim().split(/[\s,.?!]+/).filter(w => w.length > 0);
    wordCountDisplay.textContent = wordsArray.length;
    
    if (currentTempText.trim().length > 0 && currentTheme) {
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
    
    const displayHTML = highlightGlobalText(currentTempText);

    if (currentTempText.trim().length > 0) {
         transcriptBox.innerHTML = `<p class="mb-2 leading-relaxed text-gray-800 font-medium">${displayHTML}</p>`;
    } else {
         transcriptBox.innerHTML = `<p class="text-gray-400 italic">Listening...</p>`;
    }
    
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

function showComboAnimation(multiplier, points) {
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `
        <div class="text-5xl md:text-6xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] animate-combo tracking-tighter">
            x${multiplier} COMBO!
        </div>
        <div class="text-2xl md:text-3xl font-bold text-white mt-2 animate-phrase">
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

// ==========================================
// イベントリスナー群
// ==========================================

// ★NEW: リサイズ機能 (スマホ表示時の縦幅調整)
const resizer = document.getElementById('resizer');
const imagePanel = document.getElementById('image-panel');
let startY = 0;
let startHeight = 0;

if (resizer && imagePanel) {
    resizer.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startHeight = imagePanel.getBoundingClientRect().height;
        e.preventDefault(); // スクロール防止
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (startY === 0) return;
        const currentY = e.touches[0].clientY;
        const dy = currentY - startY;
        let newHeight = startHeight + dy;
        
        // 画像が小さすぎたり、大きすぎてテキストが見えなくなるのを防ぐ
        if (newHeight < 100) newHeight = 100;
        if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
        
        imagePanel.style.height = `${newHeight}px`;
    }, { passive: false });

    document.addEventListener('touchend', () => {
        startY = 0;
    });
}

// 設定モーダルの開閉と時間選択
btnOpenSettings.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});
btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

timeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        timeBtns.forEach(b => {
            b.classList.remove('selected-time-btn', 'bg-blue-600/30', 'border-blue-500');
            b.classList.add('bg-gray-800', 'border-transparent');
        });
        const target = e.currentTarget;
        target.classList.remove('bg-gray-800', 'border-transparent');
        target.classList.add('selected-time-btn', 'bg-blue-600/30', 'border-blue-500');
        customTimeLimit = parseInt(target.getAttribute('data-time'));
    });
});

// 人数・レベル選択
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => {
            b.classList.remove('selected-player-btn', 'border-red-500', 'bg-red-600/30');
            b.classList.add('border-transparent', 'bg-white/10');
        });
        const target = e.currentTarget; 
        target.classList.remove('border-transparent', 'bg-white/10');
        target.classList.add('selected-player-btn', 'border-red-500', 'bg-red-600/30');
        selectedPlayers = parseInt(target.getAttribute('data-players'));
    });
});

levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelBtns.forEach(b => {
            b.classList.remove('selected-level-btn', 'border-red-500', 'bg-red-600/30');
            b.classList.add('border-transparent', 'bg-white/10');
        });
        const target = e.currentTarget;
        target.classList.remove('border-transparent', 'bg-white/10');
        target.classList.add('selected-level-btn', 'border-red-500', 'bg-red-600/30');
        selectedLevel = target.getAttribute('data-level');
        
        let levelText = "中学生レベル";
        if (selectedLevel === "elementary") levelText = "小学生レベル";
        if (selectedLevel === "high_school") levelText = "高校生レベル";
        currentLevelBadge.textContent = levelText;
    });
});

// ゲーム開始（遷移のみ。マイク許可のハックを削除してChromeエラーを回避）
btnStartGame.addEventListener('click', () => {
    if (currentTheme) {
        promptImage.src = currentTheme.imageSrc;
        promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    rawTranscriptForCounting = "";
    resetScore(); 
    scoreDisplay.textContent = "0";
    wordCountDisplay.textContent = "0";
    pinContainer.innerHTML = ''; 
    transcriptBox.innerHTML = `<p class="text-gray-400 italic">Press START and speak loudly.</p>`;
    
    showView(viewPlay);
});

// ★NEW: 実際の「START」ボタンを押した瞬間に、純正の音声認識がマイク許可を求める
btnStartTurn.addEventListener('click', () => {
    // startSpeech() が走ると、ブラウザが自動的にマイクの許可ダイアログを出します
    startSpeech();
    isRecording = true;
    
    btnStartTurn.classList.add('hidden');
    recordingIndicator.classList.remove('hidden');
    statusText.textContent = "Speak Now!";
    
    promptImage.classList.remove('blur-md');
    promptImage.classList.add('blur-none');
    
    if (timeLeft === customTimeLimit) {
        startTimer();
    }
});

recordingIndicator.addEventListener('click', () => {
    stopRecording(); 
});

// 結果画面への遷移
btnFinishTurn.addEventListener('click', () => {
    clearInterval(gameTimer);
    
    const finalScore = scoreDisplay.textContent;
    const finalWordCount = parseInt(wordCountDisplay.textContent) || 0;
    
    let wpm = 0;
    if (timeElapsed > 0) {
        // timeElapsed（実際の経過秒数）で計算するため、設定時間が何秒でもWPMは正確に出ます
        wpm = Math.round(finalWordCount / (timeElapsed / 60));
    }

    const modelAnswersData = currentTheme.scoringData[selectedLevel].sentences || [];
    let modelAnswersHTML = `<ul class="space-y-3 mt-3">`;
    modelAnswersData.forEach(ans => {
        modelAnswersHTML += `
            <li class="flex items-start bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                <span class="text-red-500 mr-2 md:mr-3 mt-0.5 text-xl">💡</span>
                <div>
                    <div class="font-bold text-gray-800 text-lg md:text-xl">${ans.text}</div>
                    <div class="text-xs md:text-sm font-bold text-red-500 mt-1 uppercase tracking-wider">Target: ${ans.grammar}</div>
                </div>
            </li>
        `;
    });
    modelAnswersHTML += `</ul>`;

    const finalTranscriptHTML = highlightGlobalText(rawTranscriptForCounting);

    const rankingContainer = document.getElementById('ranking-container');
    
    rankingContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-2">
            <div class="bg-white rounded-2xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-xs md:text-sm tracking-widest mb-1 uppercase">Total Score</span>
                <span class="text-4xl md:text-5xl font-black text-orange-500">${finalScore}</span>
            </div>
            <div class="bg-white rounded-2xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-xs md:text-sm tracking-widest mb-1 uppercase">Words Spoken</span>
                <span class="text-4xl md:text-5xl font-black text-gray-800">${finalWordCount}</span>
            </div>
            <div class="bg-white rounded-2xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                <span class="text-gray-400 font-bold text-xs md:text-sm tracking-widest mb-1 uppercase">WPM (Speed)</span>
                <span class="text-4xl md:text-5xl font-black text-red-600">${wpm}</span>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg border border-gray-100 flex-1 flex flex-col overflow-hidden mb-2">
            <div class="bg-gray-900 px-4 md:px-6 py-3 md:py-4 border-b border-gray-800 flex justify-between items-center">
                <h3 class="text-lg md:text-xl font-black text-white tracking-wider">🎯 MODEL ANSWERS</h3>
                <span class="text-[10px] md:text-xs font-bold text-red-600 bg-white px-2 py-1 rounded border border-red-200">${currentLevelBadge.textContent}</span>
            </div>
            <div class="p-4 md:p-6 overflow-y-auto flex-1">
                ${modelAnswersHTML}
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg border border-gray-100 flex-1 flex flex-col overflow-hidden">
            <div class="bg-gray-100 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
                <h3 class="text-lg md:text-xl font-bold text-gray-700 tracking-wider">📝 YOUR TRANSCRIPT</h3>
            </div>
            <div class="p-4 md:p-6 overflow-y-auto flex-1 text-lg md:text-2xl leading-relaxed text-gray-800 font-medium">
                ${finalTranscriptHTML || "Oops, no words were recorded. Try again!"}
            </div>
        </div>
    `;
    
    showView(viewResult);
});

btnPlayAgain.addEventListener('click', () => {
    timerBar.classList.replace('bg-orange-500', 'bg-red-600');
    timerText.classList.replace('text-orange-400', 'text-white');
    timerText.classList.remove('animate-pulse');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    
    btnFinishTurn.classList.add('hidden');
    btnStartTurn.classList.remove('hidden');
    promptImage.classList.replace('blur-none', 'blur-md');
    
    showView(viewStart);
});

window.addEventListener('DOMContentLoaded', initApp);