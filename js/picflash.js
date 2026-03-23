// ==========================================
// Pic Flash 専用ロジック (js/picflash.js)
// ==========================================

const pfState = {
    mode: 'practice', 
    category: '',
    targetLevel: 'all', 
    questionCount: 5,   
    cards: [],
    currentIndex: 0,
    currentLevel: 1, 
    maxLevel: 1,     
    startTime: 0,
    penalty: 0,
    timerId: null,
    isPlaying: false,
    hasAnswered: false 
};

window.CATEGORIES_DATA = [];

// ------------------------------------------
// ★ iPad用：音声ブロック解除の魔法のコード
// ------------------------------------------
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

// ------------------------------------------
// サウンド演出
// ------------------------------------------
function playPfSound(type) {
    if (type === 'correct' || type === 'levelUp' || type === 'practiceCorrect') {
        // ★ 何度でも鳴るように巻き戻して再生
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

// ------------------------------------------
// ★ 新・激甘判定ロジック (余計な単語が混ざってもOK)
// ------------------------------------------
function checkIsCorrect(targetWordsArray, transcript) {
    return targetWordsArray.some(targetPhrase => {
        const words = targetPhrase.toLowerCase().replace(/[.,!?]/g, '').trim().split(/\s+/);
        return words.every(w => transcript.includes(w));
    });
}

// ------------------------------------------
// 音声認識のセットアップ
// ------------------------------------------
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

        // --- タイムアタック中の判定 ---
        if (pfState.isPlaying && pfState.mode === 'trial' && !pfState.hasAnswered) {
            if (cleanTranscript.includes("skip")) {
                handleSkip();
                return;
            }

            const card = pfState.cards[pfState.currentIndex];
            const levelData = card[`level${pfState.currentLevel}`];
            if (!levelData || !levelData.words) return;

            if (checkIsCorrect(levelData.words, cleanTranscript)) {
                handleCorrect();
            }
        }
        
        // --- 学習モードでの発音判定 ---
        if (pfState.mode === 'practice' && window.practiceTargetWords) {
            const isCorrect = checkIsCorrect(window.practiceTargetWords, cleanTranscript);
            const statusEl = document.getElementById(window.practiceStatusId);
            
            if (isCorrect) {
                statusEl.innerHTML = `<span class="text-green-500 font-black">⭕️ Excellent! <span class="text-xs text-green-600/70 block mt-0.5">(${currentTranscript})</span></span>`;
                playPfSound('practiceCorrect'); 
                triggerPracticeSuccessAnim();   
                try { pfRec.abort(); } catch(err){}
                window.practiceTargetWords = null; 
            } else {
                statusEl.innerHTML = `<span class="text-gray-600 font-bold flex items-center justify-end gap-1"><span class="animate-pulse">🎙</span> ${currentTranscript}</span>`;
            }
        }
    };

    pfRec.onend = () => {
        if (pfState.isPlaying && pfState.mode === 'trial') {
            try { pfRec.start(); } catch(err){}
        }
        if (pfState.mode === 'practice' && window.practiceTargetWords) {
            const statusEl = document.getElementById(window.practiceStatusId);
            if(statusEl && !statusEl.innerHTML.includes("Excellent")) {
                 statusEl.innerHTML = `<span class="text-pink-400 font-bold">Try again!</span>`;
            }
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

function triggerPracticeSuccessAnim() {
    const animEl = document.getElementById('pf-practice-success-anim');
    animEl.classList.remove('hidden');
    // アニメーションを確実に再実行させる魔法
    void animEl.offsetWidth; 
    animEl.classList.add('animate-practice-success');
    setTimeout(() => {
        animEl.classList.add('hidden');
        animEl.classList.remove('animate-practice-success');
    }, 1500);
}

// ------------------------------------------
// 学習モード (Practice) グリッド＆モーダル
// ------------------------------------------
function renderPracticeGrid() {
    const gridEl = document.getElementById('pf-practice-grid');
    gridEl.innerHTML = '';

    pfState.cards.forEach((card, cardIdx) => {
        let targetWord = card.level1.words[0];
        if (pfState.category === 'months') {
            targetWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
        }

        gridEl.innerHTML += `
            <div onclick="openPracticeModal(${cardIdx})" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer transform hover:-translate-y-2 transition-all hover:shadow-lg hover:border-pink-300 group flex flex-col">
                <div class="w-full aspect-square bg-gray-50 relative p-3 md:p-4 flex items-center justify-center shrink-0">
                    <img src="${card.img}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-3 md:p-4 text-center bg-white border-t border-gray-100 flex-1 flex items-center justify-center">
                    <div class="font-black text-gray-800 text-2xl md:text-3xl lg:text-4xl break-words leading-tight w-full px-1 line-clamp-2">${targetWord}</div>
                </div>
            </div>
        `;
    });
}

function formatSentence(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

window.openPracticeModal = function(cardIdx) {
    const card = pfState.cards[cardIdx];
    const contentEl = document.getElementById('pf-practice-modal-content');
    
    let html = `
        <div class="flex flex-col md:flex-row gap-4 md:gap-8 w-full items-stretch">
            <div class="w-full md:w-2/5 flex flex-col justify-center">
                <div class="w-full aspect-video md:aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 relative flex items-center justify-center p-4 border border-gray-100 shadow-inner">
                    <img src="${card.img}" class="w-full h-full object-contain">
                </div>
            </div>
            <div class="w-full md:w-3/5 flex flex-col gap-3 justify-center">
    `;

    [1, 2, 3].forEach(lv => {
        const levelData = card[`level${lv}`];
        if (!levelData) return;

        let displayText = "";
        
        if (lv === 3) {
            let sentences = [];
            const likeSt = levelData.words.find(w => w.startsWith('i like'));
            const dontLikeSt = levelData.words.find(w => w.startsWith("i don't like") || w.startsWith("i do not like"));
            
            if (likeSt) sentences.push(formatSentence(likeSt));
            if (dontLikeSt) sentences.push(formatSentence(dontLikeSt));

            if (sentences.length > 0) {
                displayText = sentences.join(' <span class="text-sm font-bold text-gray-300 mx-1">/</span> ');
            } else {
                displayText = formatSentence(levelData.words[0]);
            }
        } else {
            displayText = levelData.words[0];
            if (pfState.category === 'months') {
                displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);
            }
        }

        const statusId = `prac-status-modal-${lv}`;
        let colorCls = "bg-green-100 text-green-700";
        if (lv === 2) colorCls = "bg-blue-100 text-blue-700";
        if (lv === 3) colorCls = "bg-purple-100 text-purple-700";

        let promptHtml = "";
        if (lv === 3) {
            promptHtml = `<div class="text-xs md:text-sm font-bold text-pink-500 mb-1">💡 実際に文で言ってみよう！</div>`;
        }

        html += `
            <div class="p-4 md:p-5 rounded-2xl bg-white border border-gray-200 relative overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-2 py-0.5 rounded text-xs font-black tracking-wider ${colorCls}">Lv.${lv}</span>
                        <span class="text-xs md:text-sm font-bold text-gray-500">${levelData.ja}</span>
                    </div>
                    ${promptHtml}
                    <div class="text-xl md:text-3xl font-black text-gray-800 mb-2 leading-tight">${displayText}</div>
                </div>
                
                <div class="flex items-center justify-between mt-auto pt-2">
                    <div class="flex gap-2 relative z-10 shrink-0">
                        <button onclick="playPfTTS(${cardIdx}, ${lv})" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:bg-gray-100 font-bold text-xs md:text-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                            🔊 聞く
                        </button>
                        <button onclick="startPracticeRec(${cardIdx}, ${lv}, '${statusId}')" class="px-3 py-2 bg-pink-50 text-pink-600 border border-pink-200 rounded-lg shadow-sm hover:bg-pink-100 font-bold text-xs md:text-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                            🎙 音読する
                        </button>
                    </div>
                    <div id="${statusId}" class="text-xs md:text-sm font-black text-gray-400 relative z-10 text-right ml-2 leading-tight"></div>
                </div>
            </div>
        `;
    });

    html += `
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

window.playPfTTS = function(cardIdx, lv) {
    speechSynthesis.cancel();
    const card = pfState.cards[cardIdx];
    const words = card[`level${lv}`].words;
    
    let textToSpeak = words[0];
    if (lv === 3) {
        const likeSt = words.find(w => w.startsWith('i like'));
        const dontLikeSt = words.find(w => w.startsWith("i don't like"));
        if (likeSt && dontLikeSt) {
            textToSpeak = likeSt + ". " + dontLikeSt + ".";
        }
    }

    const u = new SpeechSynthesisUtterance(textToSpeak);
    u.lang = 'en-US';
    speechSynthesis.speak(u);
};

window.startPracticeRec = function(cardIdx, lv, statusId) {
    if (!pfRec) return alert("音声認識非対応です");
    const card = pfState.cards[cardIdx];
    window.practiceTargetWords = card[`level${lv}`].words; 
    window.practiceStatusId = statusId;
    
    document.getElementById(statusId).innerHTML = `<span class="text-pink-500 animate-pulse">Listening...🎙</span>`;
    try { pfRec.abort(); setTimeout(() => pfRec.start(), 100); } catch(e) {}
};

// ------------------------------------------
// 履歴の保存・自己ベスト判定
// ------------------------------------------
function saveAndRenderHistory(finalTime) {
    const historyKey = 'picflash_history';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    const catObj = window.CATEGORIES_DATA.find(c => c.id === pfState.category);
    const catName = catObj ? catObj.title : pfState.category;
    
    const sameConditionHistory = history.filter(r => r.category === catName && r.count === pfState.questionCount && r.targetLevel === pfState.targetLevel);
    let isNewBest = false;
    
    if (sameConditionHistory.length > 0) {
        const bestPastTime = Math.min(...sameConditionHistory.map(r => parseFloat(r.time)));
        if (finalTime < bestPastTime) isNewBest = true;
    } else {
        isNewBest = true; 
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    const newRecord = {
        date: dateStr,
        time: finalTime.toFixed(2),
        category: catName,
        count: pfState.questionCount,
        targetLevel: pfState.targetLevel
    };
    
    history.unshift(newRecord); 
    if(history.length > 15) history = history.slice(0, 15);
    localStorage.setItem(historyKey, JSON.stringify(history));
    
    const listEl = document.getElementById('pf-history-list');
    listEl.innerHTML = '';
    history.forEach((rec, idx) => {
        const bgClass = idx === 0 ? "bg-pink-50 rounded-xl px-2" : "";
        const levelStr = rec.targetLevel === 'all' ? 'All' : `Lv.${rec.targetLevel}`;
        const countStr = rec.count === 'ALL' ? 'ALL' : `${rec.count} sets`;
        
        listEl.innerHTML += `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 ${bgClass}">
                <div class="flex flex-col">
                    <span class="text-sm md:text-base font-bold text-gray-700">
                        ${rec.category} 
                        <span class="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full ml-1 border border-purple-100">${levelStr}</span>
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

// ------------------------------------------
// ゲームフロー
// ------------------------------------------
async function startPfGame() {
    if (!pfState.category) return;
    const startBtn = document.getElementById('btn-pf-start');
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50');

    try {
        const res = await fetch(`data/picflash/${pfState.category}.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("データの読み込みに失敗");
        const rawCards = await res.json();
        
        if (pfState.mode === 'practice') {
            pfState.cards = rawCards; 
            renderPracticeGrid();
            showPfView('view-picflash-practice');
        } else {
            let filteredCards = rawCards;
            if (pfState.targetLevel !== 'all') {
                const targetKey = `level${pfState.targetLevel}`;
                filteredCards = rawCards.filter(card => card[targetKey] && card[targetKey].words);
            }

            if (filteredCards.length === 0) {
                alert(`このジャンルには Level ${pfState.targetLevel} の問題がありません。\n別のレベルかジャンルを選んでください。`);
                startBtn.classList.remove('opacity-50');
                updateStartButtonState();
                return;
            }

            const shuffled = filteredCards.sort(() => Math.random() - 0.5);
            
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
    document.getElementById('pf-total-count').innerText = pfState.cards.length;
    
    const statusTextEl = document.getElementById('pf-status-text');
    if (statusTextEl) statusTextEl.innerText = 'Listening...';

    showPfView('view-picflash-play');
    
    pfState.startTime = Date.now();
    if (pfState.timerId) clearInterval(pfState.timerId);
    pfState.timerId = setInterval(() => {
        const current = (Date.now() - pfState.startTime) / 1000 + pfState.penalty;
        document.getElementById('pf-timer').innerText = current.toFixed(2);
    }, 50);

    loadPfCard(true);
    try { if (pfRec) pfRec.start(); } catch(e){}
}

function loadPfCard(isNewImage) {
    setTimeout(() => { pfState.hasAnswered = false; }, 100);

    const card = pfState.cards[pfState.currentIndex];
    
    if (isNewImage) {
        if (pfState.targetLevel === 'all') {
            pfState.currentLevel = 1;
            pfState.maxLevel = 1;
            if (card.level2) pfState.maxLevel = 2;
            if (card.level3) pfState.maxLevel = 3;
        } else {
            pfState.currentLevel = parseInt(pfState.targetLevel);
            pfState.maxLevel = parseInt(pfState.targetLevel); 
        }
        
        document.getElementById('pf-card-count').innerText = (pfState.currentIndex + 1);
        document.getElementById('pf-image').src = card.img;
    }

    updateLevelUI();
    document.getElementById('pf-overlay-correct').classList.add('hidden');
    document.getElementById('pf-overlay-skip').classList.add('hidden');
    document.getElementById('pf-card').classList.remove('scale-95');
}

function updateLevelUI() {
    const cardEl = document.getElementById('pf-card');
    const badgeEl = document.getElementById('pf-level-badge');
    const hintEl = document.getElementById('pf-hint-text');
    const card = pfState.cards[pfState.currentIndex];

    cardEl.classList.remove('card-level-1', 'card-level-2', 'card-level-3');
    badgeEl.classList.remove('bg-green-400', 'bg-blue-400', 'bg-purple-400');

    if (pfState.currentLevel === 1) {
        cardEl.classList.add('card-level-1');
        badgeEl.classList.add('bg-green-400');
        badgeEl.innerText = "🟩 LEVEL 1 (Base)";
        const ja = card.level1 ? card.level1.ja : "";
        hintEl.innerHTML = `シンプルな単語で！<br><span class="text-base md:text-2xl text-gray-400 mt-2 block">(${ja})</span>`;
    } 
    else if (pfState.currentLevel === 2) {
        cardEl.classList.add('card-level-2');
        badgeEl.classList.add('bg-blue-400');
        badgeEl.innerText = "🟦 LEVEL 2 (Chunk)";
        const prevAnswer = card.level1 ? card.level1.words[0] : "";
        hintEl.innerHTML = `状態や動きを足そう！<br><span class="text-base md:text-2xl text-blue-500 mt-2 block">${prevAnswer ? `Hint: ... ${prevAnswer}` : ""}</span>`;
    } 
    else if (pfState.currentLevel === 3) {
        cardEl.classList.add('card-level-3');
        badgeEl.classList.add('bg-purple-400');
        badgeEl.innerText = "🟪 LEVEL 3 (Sentence)";
        const prevAnswer = card.level2 ? card.level2.words[0] : (card.level1 ? card.level1.words[0] : "");
        hintEl.innerHTML = `文にしてみよう！<br><span class="text-base md:text-2xl text-purple-500 mt-2 block">${prevAnswer ? `Hint: ... ${prevAnswer}` : ""}</span>`;
    }
}

function handleCorrect() {
    if (pfState.hasAnswered) return;
    pfState.hasAnswered = true;

    const cardEl = document.getElementById('pf-card');
    cardEl.classList.add('scale-95');
    
    // 従来の「⭕️」は表示せず、代わりに新しいSVGアニメーションを表示
    const checkAnimEl = document.getElementById('correct-answer-anim');
    if (checkAnimEl) {
        checkAnimEl.classList.remove('hidden');
        checkAnimEl.classList.add('animate-pop-check');
        // 0.6秒後にアニメーションクラスをリセットして隠す
        setTimeout(() => {
            checkAnimEl.classList.remove('animate-pop-check');
            checkAnimEl.classList.add('hidden');
        }, 600); 
    }

    if (pfState.currentLevel < pfState.maxLevel) {
        playPfSound('levelUp');
        setTimeout(() => {
            pfState.currentLevel++;
            try { pfRec.abort(); } catch(e){} 
            loadPfCard(false); 
        }, 250); // アニメーションが一瞬見えるように 250ms に微調整
    } else {
        playPfSound('correct');
        setTimeout(() => {
            pfState.currentIndex++;
            if (pfState.currentIndex >= pfState.cards.length) endPfGame();
            else { try { pfRec.abort(); } catch(e){} loadPfCard(true); }
        }, 250); // 同上
    }
}

function handleSkip() {
    if (pfState.hasAnswered) return; 
    pfState.hasAnswered = true;
    
    playPfSound('skip');
    
    if (pfState.mode === 'trial') {
        pfState.penalty += 2.0; 
    }

    const cardEl = document.getElementById('pf-card');
    cardEl.classList.add('scale-95');
    document.getElementById('pf-overlay-skip').classList.remove('hidden');
    
    setTimeout(() => {
        pfState.currentIndex++;
        if (pfState.currentIndex >= pfState.cards.length) endPfGame();
        else { try { pfRec.abort(); } catch(e){} loadPfCard(true); }
    }, 200);
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
// 初期化
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

document.addEventListener('DOMContentLoaded', () => {
    
    document.querySelectorAll('.pf-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            pfState.mode = target.getAttribute('data-mode');
            
            document.querySelectorAll('.pf-mode-btn').forEach(b => b.classList.remove('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300'));
            target.classList.add('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300');

            const levelSection = document.getElementById('section-level-select');
            const countSection = document.getElementById('section-count-select');
            const catTitle = document.getElementById('title-category-select');
            
            if (pfState.mode === 'trial') {
                levelSection.classList.remove('hidden');
                countSection.classList.remove('hidden');
                catTitle.innerText = "4. ジャンルを選ぶ";
            } else {
                levelSection.classList.add('hidden');
                countSection.classList.add('hidden');
                catTitle.innerText = "2. ジャンルを選ぶ";
            }
            updateStartButtonState();
        });
    });

    document.querySelectorAll('.pf-level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pfState.targetLevel = e.target.getAttribute('data-level');
            document.querySelectorAll('.pf-level-btn').forEach(b => {
                b.classList.remove('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
                b.classList.add('bg-gray-50', 'text-gray-400');
            });
            e.target.classList.add('bg-gradient-to-br', 'from-pink-400', 'to-rose-400', 'text-white', 'shadow-md', 'scale-105');
            e.target.classList.remove('bg-gray-50', 'text-gray-400');
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