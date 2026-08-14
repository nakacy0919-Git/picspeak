// ==========================================
// Pic Flash 専用ロジック (js/picflash.js)
// ==========================================

const pfState = {
    mode: 'practice', 
    category: '',
    language: 'en-US',   
    timePerCard: 5,      
    questionCount: 10,   
    cards: [],
    currentIndex: 0,
    startTime: 0,
    cardStartTime: 0,    
    penalty: 0,
    timerId: null,
    isPlaying: false,
    hasAnswered: false,
    comboCount: 0 // ★ 追加: 連続正解カウント
};

window.CATEGORIES_DATA = [];

const correctAudio = new Audio('assets/sounds/correct.mp3');

function unlockAudio() {
    correctAudio.volume = 0;
    correctAudio.play().then(() => {
        correctAudio.pause();
        correctAudio.volume = 1;
        correctAudio.currentTime = 0;
    }).catch(e => console.log("Unlock failed, but will retry:", e));
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
}
document.addEventListener('touchstart', unlockAudio, {once: true});
document.addEventListener('click', unlockAudio, {once: true});

function playPfSound(type) {
    if (type === 'correct' || type === 'levelUp' || type === 'practiceCorrect') {
        correctAudio.currentTime = 0;
        correctAudio.play().catch(e => console.log("音声再生エラー:", e));
    } else if (type === 'skip') {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        } catch(e) {}
    }
}

function checkIsCorrect(card, transcript) {
    let targetWordsArray = [];
    if (card.targets && card.targets[pfState.language]) {
        targetWordsArray = card.targets[pfState.language];
    } else if (card.level1 && card.level1.words) {
        targetWordsArray = card.level1.words;
    }

    if (!targetWordsArray || targetWordsArray.length === 0) return false;

    return targetWordsArray.some(targetPhrase => {
        const words = targetPhrase.toLowerCase().replace(/[.,!?]/g, '').trim().split(/\s+/);
        return words.every(w => transcript.includes(w));
    });
}

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let pfRec = null;

if (SpeechRec) {
    pfRec = new SpeechRec();
    pfRec.lang = 'en-US'; 
    pfRec.interimResults = true;
    pfRec.continuous = true;
    
    pfRec.onresult = (e) => {
        let currentTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
            currentTranscript += e.results[i][0].transcript.toLowerCase();
        }
        const cleanTranscript = currentTranscript.replace(/[.,!?]/g, '');

        if (pfState.isPlaying && pfState.mode === 'trial') {
            const statusTextEl = document.getElementById('pf-status-text');
            if (statusTextEl) statusTextEl.innerText = currentTranscript || 'Listening...';
        }

        if (pfState.isPlaying && pfState.mode === 'trial' && !pfState.hasAnswered) {
            if (cleanTranscript.includes("skip") || cleanTranscript.includes("スキップ")) {
                handleSkip();
                return;
            }

            const card = pfState.cards[pfState.currentIndex];
            if (checkIsCorrect(card, cleanTranscript)) {
                handleCorrect();
            }
        }
    };

    pfRec.onend = () => {
        if (pfState.isPlaying && pfState.mode === 'trial') {
            try { pfRec.start(); } catch(err){}
        }
    };
}

function showPfView(viewId) {
    document.querySelectorAll('.app-container > div').forEach(el => {
        if(el.id !== 'pf-practice-modal') el.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

function updateStartButtonState() {
    const startBtn = document.getElementById('btn-pf-start');
    if (pfState.category !== '') {
        startBtn.disabled = false;
        startBtn.className = "w-full max-w-lg py-6 md:py-8 rounded-[2rem] bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-3xl md:text-4xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all tracking-widest";
    } else {
        startBtn.disabled = true;
        startBtn.className = "w-full max-w-lg py-6 md:py-8 rounded-[2rem] bg-gray-300 text-white font-black text-3xl md:text-4xl shadow-none transition-all tracking-widest cursor-not-allowed";
    }
}

function renderPracticeGrid() {
    const gridEl = document.getElementById('pf-practice-grid');
    gridEl.innerHTML = '';

    pfState.cards.forEach((card, cardIdx) => {
        let targetWord = "???";
        if (card.targets && card.targets[pfState.language]) {
            targetWord = card.targets[pfState.language][0];
        } else if (card.level1 && card.level1.words) {
            targetWord = card.level1.words[0];
        }
        const fileName = card.img.split('/').pop();

        gridEl.innerHTML += `
            <div onclick="openPracticeModal(${cardIdx})" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer transform hover:-translate-y-2 transition-all hover:shadow-lg hover:border-pink-300 group flex flex-col">
                <div class="w-full aspect-[4/3] bg-gray-50 relative p-3 md:p-4 flex items-center justify-center shrink-0">
                    <img src="assets/images/picflash/${fileName}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-3 md:p-4 text-center bg-white border-t border-gray-100 flex-1 flex items-center justify-center">
                    <div class="font-black text-gray-800 text-xl md:text-2xl lg:text-3xl break-words leading-tight w-full px-1 line-clamp-2">${targetWord}</div>
                </div>
            </div>
        `;
    });
}

// ------------------------------------------
// ★ ゲームフローとタイマー・ヒント演出
// ------------------------------------------
async function startPfGame() {
    if (!pfState.category) return;
    const startBtn = document.getElementById('btn-pf-start');
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50');

    if (pfRec) pfRec.lang = pfState.language;

    try {
        const res = await fetch(`data/picflash/${pfState.category}.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("データの読み込みに失敗");
        const rawCards = await res.json();
        
        if (pfState.mode === 'practice') {
            pfState.cards = rawCards; 
            renderPracticeGrid();
            showPfView('view-picflash-practice');
        } else {
            const shuffled = rawCards.sort(() => Math.random() - 0.5);
            let qCount = shuffled.length;
            if (pfState.questionCount !== 'ALL') {
                qCount = Math.min(shuffled.length, parseInt(pfState.questionCount));
            }
            pfState.cards = shuffled.slice(0, qCount); 
            startTrialMode();
        }
    } catch (error) {
        alert("エラー: JSONデータが見つかりません。");
    } finally {
        if (!pfState.isPlaying) {
            startBtn.classList.remove('opacity-50');
            updateStartButtonState();
        }
    }
}

function startTrialMode() {
    pfState.currentIndex = 0;
    pfState.isPlaying = true;
    pfState.penalty = 0; 
    pfState.comboCount = 0;
    
    // ★ 上部ランプの生成
    const lampsContainer = document.getElementById('pf-progress-lamps');
    if (lampsContainer) {
        lampsContainer.innerHTML = '';
        pfState.cards.forEach((_, i) => {
            lampsContainer.innerHTML += `<div id="lamp-${i}" class="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gray-200 border-2 border-white shadow-inner transition-colors duration-300"></div>`;
        });
    }

    document.getElementById('pf-total-count').innerText = pfState.cards.length;
    document.getElementById('pf-status-text').innerText = 'Listening...';

    const timerContainer = document.getElementById('pf-card-timer-container');
    if (pfState.timePerCard !== 'none') timerContainer.classList.remove('hidden');
    else timerContainer.classList.add('hidden');

    showPfView('view-picflash-play');
    
    pfState.startTime = Date.now();
    if (pfState.timerId) clearInterval(pfState.timerId);
    
    pfState.timerId = setInterval(() => {
        const current = (Date.now() - pfState.startTime) / 1000 + pfState.penalty;
        document.getElementById('pf-timer').innerText = current.toFixed(2);

        // ★ 経過時間に応じたヒントの自動開示
        const cardElapsed = (Date.now() - pfState.cardStartTime) / 1000;
        
        // 3秒経過で1文字目、6秒経過で2文字目を開ける（時間制限がない場合も作動）
        if (cardElapsed > 3.0) revealHintChar(0);
        if (cardElapsed > 6.0) revealHintChar(1);
        if (cardElapsed > 9.0) revealHintChar(2);

        if (pfState.timePerCard !== 'none' && !pfState.hasAnswered) {
            const remaining = pfState.timePerCard - cardElapsed;
            const bar = document.getElementById('pf-card-timer-bar');
            
            if (remaining > 0) {
                const percent = (remaining / pfState.timePerCard) * 100;
                bar.style.width = `${percent}%`;
                if (percent < 30) {
                    bar.classList.replace('from-purple-400', 'from-red-500');
                    bar.classList.replace('to-pink-500', 'to-red-600');
                }
            } else {
                bar.style.width = `0%`;
                handleSkip();
            }
        }
    }, 50);

    loadPfCard(true);
    try { if (pfRec) pfRec.start(); } catch(e){}
}

function loadPfCard(isNewImage) {
    setTimeout(() => { pfState.hasAnswered = false; }, 100);

    pfState.cardStartTime = Date.now();
    const bar = document.getElementById('pf-card-timer-bar');
    if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '100%';
        bar.classList.replace('from-red-500', 'from-purple-400');
        bar.classList.replace('to-red-600', 'to-pink-500');
        setTimeout(() => { bar.style.transition = 'all 0.05s ease-linear'; }, 50);
    }

    const card = pfState.cards[pfState.currentIndex];
    document.getElementById('pf-card-count').innerText = (pfState.currentIndex + 1);

    // ★ 言語に応じたヒントの表示設定
    let targetWord = card.targets && card.targets[pfState.language] ? card.targets[pfState.language][0] : "";
    let hintMeaning = "";
    
    // 選択言語が英語なら日本語ヒント、それ以外なら英語ヒント
    if (pfState.language.startsWith('en')) {
        hintMeaning = card.targets && card.targets['ja-JP'] ? card.targets['ja-JP'][0] : "";
    } else {
        hintMeaning = card.targets && card.targets['en-US'] ? card.targets['en-US'][0] : "";
    }
    document.getElementById('pf-hint-meaning').innerText = hintMeaning;

    // ★ 四角形の生成
    const squaresContainer = document.getElementById('pf-hint-squares');
    if (squaresContainer) {
        squaresContainer.innerHTML = '';
        for (let i = 0; i < targetWord.length; i++) {
            let char = targetWord[i];
            if (char === ' ') {
                squaresContainer.innerHTML += `<div class="w-3 md:w-4"></div>`;
            } else {
                // カスタムデータ属性に正解の文字を忍ばせておく
                squaresContainer.innerHTML += `<div id="hint-sq-${i}" data-char="${char}" class="w-8 h-10 md:w-10 md:h-12 bg-gray-100 rounded-lg shadow-inner flex items-center justify-center border border-gray-200 text-lg md:text-2xl font-black text-pink-500 uppercase"></div>`;
            }
        }
    }

    const fileName = card.img.split('/').pop();
    document.getElementById('pf-image').src = `assets/images/picflash/${fileName}`;

    document.getElementById('pf-overlay-correct').classList.add('hidden');
    document.getElementById('pf-overlay-skip').classList.add('hidden');
    document.getElementById('pf-card').classList.remove('scale-95');
}

// 時間経過で呼ばれる、ヒントの文字を浮かび上がらせる関数
function revealHintChar(index) {
    const sq = document.getElementById(`hint-sq-${index}`);
    if (sq && sq.innerHTML === '') {
        sq.innerHTML = sq.getAttribute('data-char');
        sq.classList.add('hint-char-reveal');
        sq.classList.replace('bg-gray-100', 'bg-pink-50');
        sq.classList.replace('border-gray-200', 'border-pink-200');
    }
}

function handleCorrect() {
    if (pfState.hasAnswered) return;
    pfState.hasAnswered = true;
    pfState.comboCount++;

    // ランプを緑に
    const lamp = document.getElementById(`lamp-${pfState.currentIndex}`);
    if (lamp) lamp.classList.replace('bg-gray-200', 'bg-green-400');

    const cardEl = document.getElementById('pf-card');
    cardEl.classList.add('scale-95');
    
    const checkAnimEl = document.getElementById('correct-answer-anim');
    if (checkAnimEl) {
        checkAnimEl.classList.remove('hidden');
        checkAnimEl.classList.add('animate-pop-check');
        setTimeout(() => {
            checkAnimEl.classList.remove('animate-pop-check');
            checkAnimEl.classList.add('hidden');
        }, 600); 
    }

    // ★ コンボ演出 (2連続以上で発動)
    if (pfState.comboCount >= 2) {
        const comboEl = document.getElementById('pf-combo-anim');
        const comboText = document.getElementById('pf-combo-text');
        if (comboEl && comboText) {
            comboText.innerText = `${pfState.comboCount} COMBO!🔥`;
            comboEl.classList.remove('hidden');
            comboEl.classList.add('animate-combo-fire');
            setTimeout(() => {
                comboEl.classList.remove('animate-combo-fire');
                comboEl.classList.add('hidden');
            }, 1200);
        }
    }

    playPfSound('correct');
    setTimeout(() => {
        pfState.currentIndex++;
        if (pfState.currentIndex >= pfState.cards.length) endPfGame();
        else { try { pfRec.abort(); } catch(e){} loadPfCard(true); }
    }, 400); // 演出を見せるために少しだけ待機時間を延長
}

function handleSkip() {
    if (pfState.hasAnswered) return; 
    pfState.hasAnswered = true;
    pfState.comboCount = 0; // スキップでコンボが途切れる
    
    // ランプを赤に
    const lamp = document.getElementById(`lamp-${pfState.currentIndex}`);
    if (lamp) lamp.classList.replace('bg-gray-200', 'bg-red-400');

    playPfSound('skip');
    if (pfState.mode === 'trial') pfState.penalty += 2.0; 

    const cardEl = document.getElementById('pf-card');
    cardEl.classList.add('scale-95');
    document.getElementById('pf-overlay-skip').classList.remove('hidden');
    
    setTimeout(() => {
        pfState.currentIndex++;
        if (pfState.currentIndex >= pfState.cards.length) endPfGame();
        else { try { pfRec.abort(); } catch(e){} loadPfCard(true); }
    }, 400);
}

// ------------------------------------------
// リザルトと履歴保存
// ------------------------------------------
function saveAndRenderHistory(finalTime) {
    const historyKey = 'picflash_history';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    const catObj = window.CATEGORIES_DATA.find(c => c.id === pfState.category);
    const catName = catObj ? catObj.title : pfState.category;
    
    const sameConditionHistory = history.filter(r => r.category === catName && r.count === pfState.questionCount && r.language === pfState.language);
    let isNewBest = false;
    
    if (sameConditionHistory.length > 0) {
        const bestPastTime = Math.min(...sameConditionHistory.map(r => parseFloat(r.time)));
        if (finalTime < bestPastTime) isNewBest = true;
    } else {
        isNewBest = true; 
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    // 履歴データに言語情報(language)を追加して保存
    const newRecord = {
        date: dateStr,
        time: finalTime.toFixed(2),
        category: catName,
        count: pfState.questionCount,
        language: pfState.language
    };
    
    history.unshift(newRecord); 
    if(history.length > 15) history = history.slice(0, 15);
    localStorage.setItem(historyKey, JSON.stringify(history));
    
    const listEl = document.getElementById('pf-history-list');
    listEl.innerHTML = '';
    history.forEach((rec, idx) => {
        const bgClass = idx === 0 ? "bg-pink-50 rounded-xl px-2" : "";
        const countStr = rec.count === 'ALL' ? 'ALL' : `${rec.count} sets`;
        const langStr = rec.language ? rec.language.split('-')[0].toUpperCase() : 'EN';
        
        listEl.innerHTML += `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 ${bgClass}">
                <div class="flex flex-col">
                    <span class="text-sm md:text-base font-bold text-gray-700">
                        ${rec.category} 
                        <span class="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full ml-1 border border-blue-100">${langStr}</span>
                        <span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full ml-1 border border-gray-200">${countStr}</span>
                    </span>
                    <span class="text-xs text-gray-400 mt-0.5">${rec.date}</span>
                </div>
                <div class="font-black text-xl md:text-2xl text-pink-500 tabular-nums">${rec.time}<span class="text-sm text-pink-300 ml-0.5">s</span></div>
            </div>
        `;
    });

    return isNewBest; 
}

function endPfGame() {
    pfState.isPlaying = false;
    clearInterval(pfState.timerId);
    try { pfRec.abort(); } catch(e){}
    
    const finalTime = (Date.now() - pfState.startTime) / 1000 + pfState.penalty;
    document.getElementById('pf-final-time').innerText = finalTime.toFixed(2);
    
    const isPB = saveAndRenderHistory(finalTime); 
    
    const pbBadge = document.getElementById('pf-pb-badge');
    const resultBox = document.getElementById('pf-result-box');
    
    if (isPB) {
        pbBadge.classList.remove('hidden');
        resultBox.classList.remove('from-pink-500', 'to-rose-400');
        resultBox.classList.add('from-yellow-400', 'via-yellow-500', 'to-yellow-600', 'animate-pulse'); 
    } else {
        pbBadge.classList.add('hidden');
        resultBox.classList.remove('from-yellow-400', 'via-yellow-500', 'to-yellow-600', 'animate-pulse');
        resultBox.classList.add('from-pink-500', 'to-rose-400'); 
    }

    showPfView('view-picflash-result');
}

// ------------------------------------------
// 初期化とUIイベントの設定
// ------------------------------------------
async function initPicFlashCategories() {
    try {
        const res = await fetch(`data/picflash/categories.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("categories.jsonが見つかりません");
        window.CATEGORIES_DATA = await res.json();
        
        const grid = document.getElementById('pf-category-grid');
        grid.innerHTML = '';
        
        window.CATEGORIES_DATA.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = "pf-cat-btn bg-white text-gray-700 p-4 md:p-6 rounded-3xl shadow-sm border-4 border-transparent hover:border-pink-300 transition-all flex flex-col items-center gap-2";
            btn.innerHTML = `<span class="text-4xl md:text-5xl mb-1">${cat.icon}</span><span class="font-black capitalize text-base md:text-lg">${cat.title}</span>`;
            
            btn.onclick = () => {
                pfState.category = cat.id;
                document.querySelectorAll('.pf-cat-btn').forEach(b => {
                    b.classList.remove('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
                    b.classList.add('bg-white', 'text-gray-700');
                });
                
                btn.classList.remove('bg-white', 'text-gray-700');
                btn.classList.add('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
                
                updateStartButtonState(); 
            };
            grid.appendChild(btn);
        });
    } catch (error) { console.error("カテゴリー読込失敗:", error); }
}

// ------------------------------------------
// 学習モードのポップアップと音声読み上げ
// ------------------------------------------
window.openPracticeModal = function(cardIdx) {
    const card = pfState.cards[cardIdx];
    const contentEl = document.getElementById('pf-practice-modal-content');
    
    let enWord = card.targets && card.targets["en-US"] ? card.targets["en-US"][0] : "???";
    let targetWord = card.targets && card.targets[pfState.language] ? card.targets[pfState.language][0] : enWord;

    const statusId = 'prac-status-modal';
    const fileName = card.img.split('/').pop();

    let html = `
        <div class="flex flex-col md:flex-row gap-4 md:gap-8 w-full items-stretch">
            <div class="w-full md:w-2/5 flex flex-col justify-center">
                <div class="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 relative flex items-center justify-center p-4 border border-gray-100 shadow-inner">
                    <img src="assets/images/picflash/${fileName}" class="w-full h-full object-contain drop-shadow-md">
                </div>
            </div>
            <div class="w-full md:w-3/5 flex flex-col gap-3 justify-center">
                <div class="p-4 md:p-5 rounded-2xl bg-white border border-gray-200 relative overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                        <div class="text-xs md:text-sm font-bold text-pink-500 mb-1 uppercase tracking-widest">🌍 Target Language</div>
                        <div class="text-3xl md:text-4xl lg:text-5xl font-black text-gray-800 mb-3 leading-tight">${targetWord}</div>
                        <div class="text-sm md:text-base font-bold text-gray-400 bg-gray-50 inline-block px-3 py-1 rounded-lg border border-gray-100">🇺🇸 English: ${enWord}</div>
                    </div>
                    <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                        <div class="flex gap-2 relative z-10 shrink-0">
                            <button onclick="playPfTTS(${cardIdx})" class="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm text-gray-600 hover:bg-gray-100 font-black text-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                                🔊 音声を聞く
                            </button>
                            <button onclick="startPracticeRec(${cardIdx}, '${statusId}')" class="px-4 py-2.5 bg-pink-50 text-pink-600 border border-pink-200 rounded-xl shadow-sm hover:bg-pink-100 font-black text-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                                🎙 声に出す
                            </button>
                        </div>
                        <div id="${statusId}" class="text-xs md:text-sm font-black text-gray-400 relative z-10 text-right ml-2 leading-tight"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    contentEl.innerHTML = html;
    window.practiceTargetWords = null;
    document.getElementById('pf-practice-modal').classList.remove('hidden');
}

window.closePracticeModal = function() {
    document.getElementById('pf-practice-modal').classList.add('hidden');
    if (pfRec) { try { pfRec.abort(); } catch(e){} }
    window.practiceTargetWords = null;
}

window.playPfTTS = function(cardIdx) {
    speechSynthesis.cancel();
    const card = pfState.cards[cardIdx];
    let textToSpeak = card.targets && card.targets[pfState.language] ? card.targets[pfState.language][0] : "???";
    
    const u = new SpeechSynthesisUtterance(textToSpeak);
    u.lang = pfState.language; 
    u.rate = 0.9;
    speechSynthesis.speak(u);
};

window.startPracticeRec = function(cardIdx, statusId) {
    if (!pfRec) return alert("音声認識に非対応のブラウザです");
    const card = pfState.cards[cardIdx];
    window.practiceTargetWords = card.targets && card.targets[pfState.language] ? card.targets[pfState.language] : []; 
    window.practiceStatusId = statusId;
    
    pfRec.lang = pfState.language; 
    
    document.getElementById(statusId).innerHTML = `<span class="text-pink-500 animate-pulse">Listening...🎙</span>`;
    try { pfRec.abort(); setTimeout(() => pfRec.start(), 100); } catch(e) {}
};

document.addEventListener('DOMContentLoaded', () => {
    const langSelect = document.getElementById('pf-lang-select');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            pfState.language = e.target.value;
        });
    }

    document.querySelectorAll('.pf-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            pfState.mode = target.getAttribute('data-mode');
            
            document.querySelectorAll('.pf-mode-btn').forEach(b => b.classList.remove('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300'));
            target.classList.add('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300');

            const trialSection = document.getElementById('section-trial-settings');
            const catTitle = document.getElementById('title-category-select');
            
            if (pfState.mode === 'trial') {
                trialSection.classList.remove('hidden');
                catTitle.innerText = "5. ジャンルを選ぶ";
            } else {
                trialSection.classList.add('hidden');
                catTitle.innerText = "3. ジャンルを選ぶ";
            }
            updateStartButtonState();
        });
    });

    document.querySelectorAll('.pf-count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.getAttribute('data-count');
            pfState.questionCount = val === 'ALL' ? 'ALL' : parseInt(val);
            document.querySelectorAll('.pf-count-btn').forEach(b => {
                b.classList.remove('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
                b.classList.add('bg-gray-50', 'text-gray-400');
            });
            e.target.classList.add('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
            e.target.classList.remove('bg-gray-50', 'text-gray-400');
        });
    });

    document.querySelectorAll('.pf-time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.getAttribute('data-time');
            pfState.timePerCard = val === 'none' ? 'none' : parseInt(val);
            document.querySelectorAll('.pf-time-btn').forEach(b => {
                b.classList.remove('bg-gradient-to-br', 'from-purple-400', 'to-indigo-400', 'text-white', 'shadow-md', 'scale-105');
                b.classList.add('bg-gray-50', 'text-gray-400');
            });
            e.target.classList.add('bg-gradient-to-br', 'from-purple-400', 'to-indigo-400', 'text-white', 'shadow-md', 'scale-105');
            e.target.classList.remove('bg-gray-50', 'text-gray-400');
        });
    });

    document.querySelector('.pf-mode-btn[data-mode="practice"]').click();
    initPicFlashCategories();

    document.getElementById('btn-pf-start').addEventListener('click', startPfGame);
    document.getElementById('btn-pf-skip').addEventListener('click', handleSkip);
    
    document.getElementById('btn-pf-quit').addEventListener('click', () => {
        pfState.isPlaying = false;
        clearInterval(pfState.timerId);
        try { pfRec.abort(); } catch(e){}
        showPfView('view-picflash-select');
        updateStartButtonState(); 
    });
});