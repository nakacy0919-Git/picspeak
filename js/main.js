// js/main.js

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let timeLeft = 30; 
let timeElapsed = 0; 
let themeList = [];

let selectedPlayers = 1;
let selectedLevel = 'elementary'; 
let customTimeLimit = 30; 

// UI Elements
const viewStart = document.getElementById('view-start');
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

const btnStartGame = document.getElementById('btn-start-game');
const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');
const btnHomeFromPlay = document.getElementById('btn-home-from-play'); 

// Modals & Buttons
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

const playerBtns = document.querySelectorAll('.player-btn');
const levelBtns = document.querySelectorAll('.level-btn'); 
const timeBtns = document.querySelectorAll('.time-btn');

const promptImage = document.getElementById('prompt-image');
const transcriptBox = document.getElementById('transcript-box');
const scoreDisplay = document.getElementById('scoreDisplay');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const liveWpmDisplay = document.getElementById('liveWpmDisplay'); // ★新規追加
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
// ローカルストレージ (学習ログ) 管理
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
        historyList.innerHTML = `<p class="text-center text-gray-400 py-10 font-bold">まだプレイ履歴がありません。<br>遊んでスコアを残そう！</p>`;
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
            <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                <div>
                    <div class="text-xs text-gray-400 font-bold">${dateStr} | Image: ${log.imageId}</div>
                    <div class="text-sm font-black uppercase mt-1 ${levelColor}">${log.level.replace('_', ' ')}</div>
                </div>
                <div class="text-right flex gap-4 md:gap-6">
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] font-bold text-gray-400 uppercase">Score</span>
                        <span class="text-lg font-black text-gray-800">${log.score}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] font-bold text-pink-400 uppercase">Comp.</span>
                        <span class="text-lg font-black text-pink-600">${log.completion}%</span>
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
    else if (type === 'combo') {
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
    if(!viewStart || !viewPlay || !viewResult || !viewElement) return;
    viewStart.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewElement.classList.remove('hidden');
    viewElement.classList.add('fade-in');
}

async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。\niPhoneをお使いの場合は、標準の「Safari」アプリを開いてプレイしてください。");
        if(btnStartGame) {
            btnStartGame.disabled = true;
            btnStartGame.classList.replace('bg-sns-gradient', 'bg-gray-200');
            btnStartGame.classList.replace('text-white', 'text-gray-500');
            btnStartGame.classList.replace('shadow-xl', 'shadow-none');
            btnStartGame.textContent = "ブラウザ非対応";
            btnStartGame.style.pointerEvents = 'none';
        }
        return; 
    }

    initSpeechRecognition(handleSpeechResult, handleSpeechEnd);
    
    try {
        const response = await fetch('data/theme_list.json');
        themeList = await response.json();
    } catch (error) {
        console.error("テーマリストの読み込みに失敗しました:", error);
    }
}

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

        // ★追加: プレイ中のリアルタイムWPM計算
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

function dropPin(word, theme) {
    if (!theme || !theme.pins || !theme.pins[word.toLowerCase()]) return;
    const pinData = theme.pins[word.toLowerCase()];
    
    const pin = document.createElement('div');
    pin.className = 'absolute flex flex-col items-center justify-center pin-drop z-20';
    pin.style.left = `${pinData.x}%`;
    pin.style.top = `${pinData.y}%`;
    pin.style.transform = 'translate(-50%, -100%)';

    pin.innerHTML = `
        <div class="bg-white text-gray-900 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full shadow-lg border-2 border-white mb-1.5 tracking-wider uppercase drop-shadow-sm">
            ❤️ ${word}
        </div>
        <div class="w-1.5 h-3.5 md:h-4.5 bg-gray-200 shadow-sm rounded-b-full"></div>
    `;

    const popEffect = document.createElement('div');
    popEffect.className = 'pin-pop-effect';
    pin.appendChild(popEffect);
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
         transcriptBox.innerHTML = `<p class="text-gray-400 italic font-medium uppercase tracking-wide">Press START and speak loudly. ❤️📍🏙️✨</p>`;
    }
    
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

function showComboAnimation(multiplier, points) {
    if(!comboOverlay) return;
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `
        <div class="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-sns-gradient drop-shadow-xl animate-combo tracking-tighter">
            x${multiplier} COMBO!
        </div>
        <div class="text-2xl md:text-3xl font-bold text-gray-800 mt-2 animate-phrase">
            +${points} pts
        </div>
    `;
    setTimeout(() => { comboOverlay.classList.add('hidden'); }, 1500);
}

function showPerfectAnimation(points) {
    if(!perfectOverlay) return;
    perfectOverlay.classList.remove('hidden');
    perfectContent.innerHTML = `
        <div class="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(252,175,69,1)] animate-perfect tracking-tighter uppercase">
            PERFECT!!
        </div>
        <div class="text-3xl md:text-4xl font-black text-white mt-4 drop-shadow-lg animate-phrase">
            +${points} pts 🔥
        </div>
    `;
    setTimeout(() => { perfectOverlay.classList.add('hidden'); }, 2000);
}

function handleSpeechEnd() {
    isRecording = false;
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if (timeLeft > 0) {
        if(btnStartTurn) {
            btnStartTurn.classList.remove('hidden');
            // ★一時停止になったら再び揺らす
            btnStartTurn.classList.add('animate-attention');
        }
        if(statusText) statusText.textContent = "Paused";
    }
}

function stopRecording() {
    stopSpeech();
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if(btnFinishTurn) btnFinishTurn.classList.remove('hidden'); 
    if(statusText) statusText.textContent = "Finished!";
    if(timerBar) timerBar.style.transition = 'none';
}

// ==========================================
// イベントリスナー群
// ==========================================

if(btnOpenTutorial) btnOpenTutorial.addEventListener('click', () => tutorialModal.classList.remove('hidden'));
if(btnCloseTutorial) btnCloseTutorial.addEventListener('click', () => tutorialModal.classList.add('hidden'));

if(btnOpenHistory) {
    btnOpenHistory.addEventListener('click', () => {
        renderHistoryLogs();
        historyModal.classList.remove('hidden');
    });
}
if(btnCloseHistory) btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));

if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

if (btnHomeFromPlay) {
    btnHomeFromPlay.addEventListener('click', () => {
        if (isRecording) stopRecording();
        clearInterval(gameTimer);
        showView(viewStart);
    });
}

const resizer = document.getElementById('resizer');
const imagePanel = document.getElementById('image-panel');
let startY = 0;
let startHeight = 0;

if (resizer && imagePanel) {
    resizer.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startHeight = imagePanel.getBoundingClientRect().height;
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (startY === 0) return;
        let newHeight = startHeight + (e.touches[0].clientY - startY);
        if (newHeight < 100) newHeight = 100;
        if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
        imagePanel.style.height = `${newHeight}px`;
    }, { passive: false });

    document.addEventListener('touchend', () => { startY = 0; });
}

timeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        timeBtns.forEach(b => {
            b.classList.remove('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            b.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200');
        });
        const target = e.currentTarget;
        target.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200');
        target.classList.add('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        customTimeLimit = parseInt(target.getAttribute('data-time'));
    });
});

playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => {
            b.classList.remove('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            b.classList.add('bg-white', 'border-gray-200', 'text-gray-700');
        });
        const target = e.currentTarget; 
        target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
        target.classList.add('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        selectedPlayers = parseInt(target.getAttribute('data-players'));
    });
});

levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelBtns.forEach(b => {
            b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            b.classList.add('bg-white', 'border-gray-200', 'text-gray-700');
        });
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

// --- (js/main.js の btnStartGame 処理を以下にまるごと差し替え) ---

if (btnStartGame) {
    // asyncを外し、ユーザーのクリック直後に安全にフルスクリーンを実行させる
    btnStartGame.addEventListener('click', () => {
        
        // 1. フルスクリーン化（他の処理に邪魔されないように一番最初に実行）
        try {
            const elem = document.documentElement;
            if (!document.fullscreenElement) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(e => console.warn("フルスクリーン拒否:", e));
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                }
            }
        } catch (e) {
            console.warn("フルスクリーン処理エラー:", e);
        }

        // 2. 音声エンジンの起動
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // 3. 重い処理（データの読み込み・画面遷移）は別の関数に投げてクラッシュを防ぐ！
        launchGameSequence();
    });
}

// ★新規追加: データの読み込みや画面遷移を行うための専用関数
async function launchGameSequence() {
    if (themeList.length === 0) themeList = ["301"];

    if (themeList.length > 0) {
        const randomId = themeList[Math.floor(Math.random() * themeList.length)];
        try {
            const res = await fetch(`data/themes/${randomId}.json`);
            const fetchedData = await res.json();
            currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
        } catch (e) {
            alert(`データの読み込みに失敗しました。`);
            return; 
        }
    }

    if (currentTheme && currentTheme.imageSrc) {
        promptImage.src = currentTheme.imageSrc;
        if(promptImage.classList.contains('blur-none')) promptImage.classList.replace('blur-none', 'blur-md'); 
    }
    
    timeLeft = customTimeLimit;
    timeElapsed = 0;
    rawTranscriptForCounting = "";
    accumulatedTranscript = ""; 
    resetScore(); 
    
    scoreDisplay.textContent = "0";
    wordCountDisplay.textContent = "0";
    if(liveWpmDisplay) liveWpmDisplay.textContent = "0";
    if(liveCompletionBar) liveCompletionBar.style.width = '0%';
    if(liveCompletionText) liveCompletionText.textContent = '0%';
    pinContainer.innerHTML = ''; 
    transcriptBox.innerHTML = `<p class="text-gray-400 italic font-bold uppercase tracking-wide">Press START and speak loudly. ❤️📍🏙️✨</p>`;
    
    if(btnStartTurn) btnStartTurn.classList.add('animate-attention');
    
    showView(viewPlay);
}

// -------------------------------------------------------------------

if (btnStartTurn) {
    btnStartTurn.addEventListener('click', () => {
        startSpeech();
        isRecording = true;
        
        // ★ボタンを押したら揺れを止める
        btnStartTurn.classList.remove('animate-attention');
        btnStartTurn.classList.add('hidden');
        
        if(recordingIndicator) recordingIndicator.classList.remove('hidden');
        if(statusText) statusText.textContent = "Speak Now!";
        
        if(promptImage) {
            promptImage.classList.remove('blur-md');
            promptImage.classList.add('blur-none');
        }
        
        if (timeElapsed === 0) startTimer();
    });
}

if (recordingIndicator) {
    recordingIndicator.addEventListener('click', () => stopRecording());
}

if (btnFinishTurn) {
    btnFinishTurn.addEventListener('click', () => {
        clearInterval(gameTimer);
        
        const finalScore = scoreDisplay.textContent;
        const finalWordCount = parseInt(wordCountDisplay.textContent) || 0;
        
        let wpm = 0;
        if (timeElapsed > 0) {
            wpm = Math.round(finalWordCount / (timeElapsed / 60));
        }

        const stats = getCompletionStats(currentTheme, selectedLevel);

        saveLearningLog({
            date: new Date().toISOString(),
            imageId: currentTheme.id || 'unknown',
            level: selectedLevel,
            score: finalScore,
            completion: stats.completionRate,
            wpm: wpm
        });

        let missedHTML = '';
        if(stats.missedWords.length > 0 || stats.missedChunks.length > 0) {
            missedHTML += `<div class="mb-4"><p class="text-xs font-extrabold text-gray-400 mb-2 uppercase tracking-widest">Words & Chunks</p><div class="flex flex-wrap gap-2">`;
            stats.missedWords.forEach(w => missedHTML += `<span class="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-sm font-bold border border-gray-200">${w.text} <span class="text-xs font-medium text-gray-400 ml-1">${w.ja}</span></span>`);
            stats.missedChunks.forEach(c => missedHTML += `<span class="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-sm font-bold border border-gray-200">${c.text} <span class="text-xs font-medium text-gray-400 ml-1">${c.ja}</span></span>`);
            missedHTML += `</div></div>`;
        }
        if(stats.missedSentences.length > 0) {
            missedHTML += `<div><p class="text-xs font-extrabold text-gray-400 mb-2 uppercase tracking-widest">Sentences</p><ul class="space-y-2">`;
            stats.missedSentences.forEach(s => missedHTML += `<li class="bg-gray-50 p-3.5 rounded-xl border border-gray-200"><div class="font-bold text-gray-700 text-md md:text-lg">${s.text}</div><div class="text-sm text-gray-500 mt-1">${s.ja}</div><div class="text-[10px] font-extrabold text-gray-400 mt-1.5 uppercase tracking-wider">Target: ${s.grammar}</div></li>`);
            missedHTML += `</ul></div>`;
        }
        if(!missedHTML) missedHTML = `<div class="text-center text-gray-500 font-bold py-6">🎉 PERFECT! 全てクリアしました！</div>`;

        let clearedHTML = '';
        if(stats.clearedWords.length > 0 || stats.clearedChunks.length > 0) {
            clearedHTML += `<div class="mb-4"><p class="text-xs font-extrabold text-blue-400 mb-2 uppercase tracking-widest">Words & Chunks</p><div class="flex flex-wrap gap-2">`;
            stats.clearedWords.forEach(w => clearedHTML += `<span class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-200 shadow-sm">👍 ${w.text} <span class="text-xs font-medium text-blue-500 ml-1">${w.ja}</span></span>`);
            stats.clearedChunks.forEach(c => clearedHTML += `<span class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-200 shadow-sm">👍 ${c.text} <span class="text-xs font-medium text-blue-500 ml-1">${c.ja}</span></span>`);
            clearedHTML += `</div></div>`;
        }
        if(stats.clearedSentences.length > 0) {
            clearedHTML += `<div><p class="text-xs font-extrabold text-blue-400 mb-2 uppercase tracking-widest">Sentences</p><ul class="space-y-2">`;
            stats.clearedSentences.forEach(s => clearedHTML += `<li class="bg-blue-50 p-3.5 rounded-xl border border-blue-200 shadow-sm"><div class="font-bold text-blue-800 text-md md:text-lg">🌟 ${s.text}</div><div class="text-sm text-blue-600 mt-1">${s.ja}</div></li>`);
            clearedHTML += `</ul></div>`;
        }
        if(!clearedHTML) clearedHTML = `<div class="text-center text-gray-400 font-bold py-6">まだクリアした表現がありません。次は頑張ろう！</div>`;

        const finalTranscriptHTML = highlightGlobalText(rawTranscriptForCounting);
        const rankingContainer = document.getElementById('ranking-container');
        
        rankingContainer.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-2">
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">Score</span>
                    <span class="text-3xl md:text-5xl font-black text-gray-900">${finalScore}</span>
                </div>
                <div class="bg-sns-gradient rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg text-white transform hover:scale-[1.02] transition-transform">
                    <span class="text-white/80 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">Completion</span>
                    <span class="text-3xl md:text-5xl font-black">${stats.completionRate}<span class="text-xl md:text-3xl">%</span></span>
                </div>
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">Words</span>
                    <span class="text-3xl md:text-5xl font-black text-gray-900">${finalWordCount}</span>
                </div>
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">WPM</span>
                    <span class="text-3xl md:text-5xl font-black text-gray-900">${wpm}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-2">
                <div class="bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col overflow-hidden">
                    <div class="bg-gray-50 px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="text-md md:text-xl font-black text-gray-700 tracking-wider">💡 NEXT TARGETS</h3>
                        <span class="text-[10px] md:text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">これを言えれば100%!</span>
                    </div>
                    <div class="p-4 md:p-6 overflow-y-auto flex-1">
                        ${missedHTML}
                    </div>
                </div>

                <div class="bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col overflow-hidden">
                    <div class="bg-blue-50 px-4 md:px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                        <h3 class="text-md md:text-xl font-black text-blue-800 tracking-wider">✨ CLEARED</h3>
                        <span class="text-[10px] md:text-xs font-bold bg-blue-200 text-blue-700 px-2 py-1 rounded">素晴らしい！</span>
                    </div>
                    <div class="p-4 md:p-6 overflow-y-auto flex-1">
                        ${clearedHTML}
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-3xl shadow-xl border border-gray-100 flex-1 flex flex-col overflow-hidden mt-2">
                <div class="bg-gray-100 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
                    <h3 class="text-lg md:text-xl font-extrabold text-gray-600 tracking-wider">📝 YOUR TRANSCRIPT</h3>
                </div>
                <div class="p-4 md:p-6 overflow-y-auto flex-1 text-lg md:text-2xl leading-relaxed text-gray-800 font-medium">
                    ${finalTranscriptHTML || "Oops, no words were recorded. Try again!"}
                </div>
            </div>
        `;
        
        showView(viewResult);
    });
}

if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.add('hidden');
        
        if(btnStartTurn) {
            btnStartTurn.classList.remove('hidden');
            // ★プレイアゲイン時もSTARTボタンを揺らす
            btnStartTurn.classList.add('animate-attention');
        }
        
        if(statusText) statusText.textContent = "Ready";
        
        if (promptImage) {
            promptImage.classList.remove('blur-none');
            promptImage.classList.add('blur-md');
        }
        
        if (timerBar && timerText) {
            timerBar.style.transition = 'none';
            timerBar.style.width = '100%';
            timerText.textContent = `${customTimeLimit}s`;
        }
        
        showView(viewStart);
    });
}

window.addEventListener('DOMContentLoaded', initApp);