// js/main.js

let isRecording = false;
let currentTheme = null;
let gameTimer = null;
let timeLeft = 30; 
let timeElapsed = 0; 

// 初期値を小学生・1Playerに
let selectedPlayers = 1;
let selectedLevel = 'elementary'; 
let customTimeLimit = 30; 

const viewStart = document.getElementById('view-start');
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');

const btnStartGame = document.getElementById('btn-start-game');
const btnStartTurn = document.getElementById('btn-start-turn');
const btnFinishTurn = document.getElementById('btn-finish-turn');
const btnPlayAgain = document.getElementById('btn-play-again');
const recordingIndicator = document.getElementById('recording-indicator');
const btnHomeFromPlay = document.getElementById('btn-home-from-play'); 

const playerBtns = document.querySelectorAll('.player-btn');
const levelBtns = document.querySelectorAll('.level-btn'); 

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
const perfectOverlay = document.getElementById('perfect-overlay'); 
const perfectContent = document.getElementById('perfect-content');
const pinContainer = document.getElementById('pin-container');

let accumulatedTranscript = ""; 
let rawTranscriptForCounting = ""; 

// ==========================================
// 音声生成エンジン
// ==========================================
let audioCtx = null;

function playSound(type) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
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
        const response = await fetch('data/themes.json');
        const themes = await response.json();
        currentTheme = themes[0]; 
    } catch (error) {
        console.error("テーマの読み込みに失敗しました:", error);
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
            
            if (result.newWords && result.newWords.length > 0) {
                result.newWords.forEach(word => {
                    dropPin(word, currentTheme);
                });
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
        if(btnStartTurn) btnStartTurn.classList.remove('hidden');
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
        const currentY = e.touches[0].clientY;
        const dy = currentY - startY;
        let newHeight = startHeight + dy;
        
        if (newHeight < 100) newHeight = 100;
        if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
        
        imagePanel.style.height = `${newHeight}px`;
    }, { passive: false });

    document.addEventListener('touchend', () => {
        startY = 0;
    });
}

if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
}
if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
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
            b.classList.add('bg-white', 'border', 'border-gray-200', 'text-gray-700');
        });
        const target = e.currentTarget; 
        target.classList.remove('bg-white', 'border', 'border-gray-200', 'text-gray-700');
        target.classList.add('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        selectedPlayers = parseInt(target.getAttribute('data-players'));
    });
});

levelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        levelBtns.forEach(b => {
            b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            b.classList.add('bg-white', 'border', 'border-gray-200', 'text-gray-700');
        });
        const target = e.currentTarget;
        target.classList.remove('bg-white', 'border', 'border-gray-200', 'text-gray-700');
        target.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
        selectedLevel = target.getAttribute('data-level');
        
        let levelText = "中学生レベル";
        if (selectedLevel === "elementary") levelText = "小学生レベル";
        if (selectedLevel === "high_school") levelText = "高校生レベル";
        if(currentLevelBadge) currentLevelBadge.textContent = levelText;
    });
});

if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        if (currentTheme) {
            promptImage.src = currentTheme.imageSrc;
            if(promptImage.classList.contains('blur-none')) {
                promptImage.classList.replace('blur-none', 'blur-md'); 
            }
        }
        
        timeLeft = customTimeLimit;
        timeElapsed = 0;
        
        rawTranscriptForCounting = "";
        accumulatedTranscript = ""; 
        resetScore(); 
        scoreDisplay.textContent = "0";
        wordCountDisplay.textContent = "0";
        pinContainer.innerHTML = ''; 
        transcriptBox.innerHTML = `<p class="text-gray-400 italic font-bold uppercase tracking-wide">Press START and speak loudly. ❤️📍🏙️✨</p>`;
        
        showView(viewPlay);
    });
}

if (btnStartTurn) {
    btnStartTurn.addEventListener('click', () => {
        startSpeech();
        isRecording = true;
        
        btnStartTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.remove('hidden');
        if(statusText) statusText.textContent = "Speak Now!";
        
        if(promptImage) {
            promptImage.classList.remove('blur-md');
            promptImage.classList.add('blur-none');
        }
        
        if (timeElapsed === 0) {
            startTimer();
        }
    });
}

if (recordingIndicator) {
    recordingIndicator.addEventListener('click', () => {
        stopRecording(); 
    });
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

        const modelAnswersData = currentTheme.scoringData[selectedLevel].sentences || [];
        let modelAnswersHTML = `<ul class="space-y-3 mt-3">`;
        modelAnswersData.forEach(ans => {
            modelAnswersHTML += `
                <li class="flex items-start bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span class="text-pink-500 mr-3 mt-0.5 text-xl">💡</span>
                    <div>
                        <div class="font-bold text-gray-800 text-lg md:text-xl tracking-tight">${ans.text}</div>
                        <div class="text-sm font-medium text-gray-500 mt-1">${ans.ja}</div>
                        <div class="text-xs md:text-sm font-extrabold text-gray-400 mt-2 uppercase tracking-widest">Target: ${ans.grammar}</div>
                    </div>
                </li>
            `;
        });
        modelAnswersHTML += `</ul>`;

        const finalTranscriptHTML = highlightGlobalText(rawTranscriptForCounting);
        const rankingContainer = document.getElementById('ranking-container');
        
        rankingContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-2">
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">Total Score</span>
                    <span class="text-4xl md:text-5xl font-black text-gray-900">${finalScore}</span>
                </div>
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">Words Spoken</span>
                    <span class="text-4xl md:text-5xl font-black text-gray-900">${finalWordCount}</span>
                </div>
                <div class="bg-white rounded-3xl p-4 md:p-6 flex flex-col items-center shadow-lg border border-gray-100">
                    <span class="text-gray-400 font-extrabold text-xs md:text-sm tracking-widest mb-1 uppercase">WPM (Speed)</span>
                    <span class="text-4xl md:text-5xl font-black text-gray-900">${wpm}</span>
                </div>
            </div>

            <div class="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 flex-1 flex flex-col overflow-hidden mb-2">
                <div class="bg-white px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 class="text-lg md:text-xl font-black text-gray-900 tracking-wider">🎯 MODEL ANSWERS</h3>
                    <span class="text-[10px] md:text-xs font-extrabold text-gray-700 bg-gray-100 px-3 py-1 rounded-full shadow-inner border border-gray-200">${currentLevelBadge ? currentLevelBadge.textContent : ''}</span>
                </div>
                <div class="p-4 md:p-6 overflow-y-auto flex-1">
                    ${modelAnswersHTML}
                </div>
            </div>

            <div class="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div class="bg-gray-100 px-4 md:px-6 py-3 md:py-4 border-b-2 border-gray-200">
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
        // UIの表示状態を安全にリセット
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(recordingIndicator) recordingIndicator.classList.add('hidden');
        if(btnStartTurn) btnStartTurn.classList.remove('hidden');
        if(statusText) statusText.textContent = "Ready";
        
        // 画像のぼかしを安全に戻す
        if (promptImage) {
            promptImage.classList.remove('blur-none');
            promptImage.classList.add('blur-md');
        }
        
        // タイマーのリセット
        if (timerBar && timerText) {
            timerBar.style.transition = 'none';
            timerBar.style.width = '100%';
            timerText.textContent = `${customTimeLimit}s`;
        }
        
        showView(viewStart);
    });
}

window.addEventListener('DOMContentLoaded', initApp);