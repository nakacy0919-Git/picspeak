// ==========================================
// Pic Flash 専用ロジック (js/picflash.js)
// ==========================================

const LANG_INFO = {
    "en-US": { cc: "us", name: "English", hintLang: "ja-JP" },
    "ja-JP": { cc: "jp", name: "日本語", hintLang: "en-US" },
    "pt-BR": { cc: "br", name: "Português", hintLang: "en-US" },
    "vi-VN": { cc: "vn", name: "Tiếng Việt", hintLang: "en-US" },
    "tl-PH": { cc: "ph", name: "Tagalog", hintLang: "en-US" },
    "es-ES": { cc: "es", name: "Español", hintLang: "en-US" },
    "zh-CN": { cc: "cn", name: "中文", hintLang: "en-US" },
    "ko-KR": { cc: "kr", name: "한국어", hintLang: "en-US" },
    "id-ID": { cc: "id", name: "Indonesia", hintLang: "en-US" },
    "ne-NP": { cc: "np", name: "ネパール語", hintLang: "en-US" },
    "th-TH": { cc: "th", name: "タイ語", hintLang: "en-US" },
    "hi-IN": { cc: "in", name: "ヒンディー", hintLang: "en-US" },
    "ru-RU": { cc: "ru", name: "ロシア語", hintLang: "en-US" },
    "fr-FR": { cc: "fr", name: "Français", hintLang: "en-US" },
    "de-DE": { cc: "de", name: "Deutsch", hintLang: "en-US" },
    "it-IT": { cc: "it", name: "Italiano", hintLang: "en-US" },
    "ar-SA": { cc: "sa", name: "العربية", hintLang: "en-US" },
    "tr-TR": { cc: "tr", name: "Türkçe", hintLang: "en-US" },
    "my-MM": { cc: "mm", name: "ビルマ語", hintLang: "en-US" }
};

// ★ 漢字→ひらがな自動変換用辞書（頻出単語）
const KANJI_TO_KANA_MAP = {
    '熊':'くま', '犬':'いぬ', '猫':'ねこ', '鳥':'とり', '豚':'ぶた', 
    '牛':'うし', '馬':'うま', '猿':'さる', '羊':'ひつじ', '象':'ぞう', 
    '兎':'うさぎ', '狐':'きつね', '鹿':'しか', '蛙':'かえる', '蛇':'へび', 
    '虫':'むし', '魚':'さかな', '蝶':'ちょう', '亀':'かめ', '虎':'とら', '鼠':'ねずみ',
    '水':'みず', '木':'き', '花':'はな', '山':'やま', '空':'そら', '海':'うみ',
    '太陽':'たいよう', '月':'つき', '星':'ほし', '車':'くるま', '電車':'でんしゃ',
    '飛行機':'ひこうき', '船':'ふね', '自転車':'じてんしゃ',
    '本':'ほん', '鞄':'かばん', '靴':'くつ', '傘':'かさ', '帽子':'ぼうし', '服':'ふく',
    '机':'つくえ', '椅子':'いす', '時計':'とけい', '鉛筆':'えんぴつ',
    '林檎':'りんご', '苺':'いちご', '葡萄':'ぶどう', '桃':'もも', '蜜柑':'みかん',
    '男の子':'おとこのこ', '女の子':'おんなのこ', '男性':'だんせい', '女性':'じょせい',
    '子供':'こども', '子ども':'こども', '家':'いえ', '学校':'がっこう', '公園':'こうえん'
};

function normalizeJapanese(str) {
    // 1. カタカナをひらがなに変換
    let res = str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    // 2. 辞書にある漢字をひらがなに変換
    for (let kanji in KANJI_TO_KANA_MAP) {
        const regex = new RegExp(kanji, 'g');
        res = res.replace(regex, KANJI_TO_KANA_MAP[kanji]);
    }
    return res;
}

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 
    'in', 'on', 'at', 'to', 'of', 'and', 'it', 'he', 'she', 'they', 
    'with', 'for', 'there', 'some'
]);

function getFlagHtml(cc, classes = "w-5 h-auto inline-block rounded-sm shadow-sm") {
    if (!cc || cc === "un") return "🌍"; 
    return `<img src="https://flagcdn.com/w40/${cc}.png" class="${classes} object-contain" alt="flag">`;
}

const pfState = {
    mode: 'practice', 
    category: '',
    languages: [], 
    currentLangIndex: 0,  
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
    isTransitioning: false, 
    isSwitchingMic: false,
    comboCount: 0 
};

window.CATEGORIES_DATA = [];

const correctAudio = new Audio('assets/sounds/correct.mp3');

// 音声リストをあらかじめ読み込んでおく
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => {
        window.pfAvailableVoices = speechSynthesis.getVoices();
    };
    window.pfAvailableVoices = speechSynthesis.getVoices();
}

function unlockAudio() {
    correctAudio.volume = 0;
    correctAudio.play().then(() => {
        correctAudio.pause(); correctAudio.volume = 1; correctAudio.currentTime = 0;
    }).catch(e => console.log("Unlock failed, but will retry:", e));
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
}
document.addEventListener('touchstart', unlockAudio, {once: true});
document.addEventListener('click', unlockAudio, {once: true});

function playPfSound(type) {
    if (type === 'correct' || type === 'stepCorrect' || type === 'practiceCorrect') {
        correctAudio.currentTime = 0;
        correctAudio.play().catch(e => {});
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

function getTargetWordForLang(card, langCode) {
    let targetWord = card.targets && card.targets[langCode] ? card.targets[langCode][0] : "";
    if (!targetWord && langCode === 'en-US' && card.level1) targetWord = card.level1.words[0];
    return targetWord;
}

function checkIsCorrect(card, transcript, targetLang) {
    let targetWordsArray = [];
    if (card.targets && card.targets[targetLang]) {
        targetWordsArray = card.targets[targetLang];
    } else if (targetLang === 'en-US' && card.level1 && card.level1.words) {
        targetWordsArray = card.level1.words.map(w => w.text || w);
    }

    if (!targetWordsArray || targetWordsArray.length === 0) return false;
    
    return targetWordsArray.some(targetPhrase => {
        if (targetLang === 'ja-JP') {
            // ★ 日本語判定：漢字もカタカナもひらがなに統一して比較
            const transcriptNoSpace = normalizeJapanese(transcript.toLowerCase()).replace(/\s+/g, '');
            const phraseNoSpace = normalizeJapanese(targetPhrase.toLowerCase()).replace(/\s+/g, '');
            return transcriptNoSpace.includes(phraseNoSpace);
        } else if (targetLang === 'zh-CN') {
            const transcriptNoSpace = transcript.toLowerCase().replace(/\s+/g, '');
            const phraseNoSpace = targetPhrase.toLowerCase().replace(/\s+/g, '');
            return transcriptNoSpace.includes(phraseNoSpace);
        } else {
            const targetWords = targetPhrase.toLowerCase().replace(/[.,!?'"-]/g, '').trim().split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 0);
            const spokenWords = transcript.toLowerCase().replace(/[.,!?'"-]/g, '').trim().split(/\s+/).filter(w => w.length > 0);
            
            if (targetWords.length === 0) return false;

            let matchCount = 0;
            targetWords.forEach(tw => {
                const isMatch = spokenWords.some(sw => {
                    if (sw === tw) return true;
                    if (sw === tw + 's' || sw === tw + 'es' || sw === tw + 'ing' || sw === tw + 'ed' || sw === tw + 'd') return true;
                    if (tw === sw + 's' || tw === sw + 'es' || tw === sw + 'ing' || tw === sw + 'ed' || tw === sw + 'd') return true;
                    return false;
                });
                if (isMatch) matchCount++;
            });

            const requiredRate = targetWords.length <= 2 ? 1.0 : 0.8;
            return (matchCount / targetWords.length) >= requiredRate;
        }
    });
}

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let pfRec = null;

if (SpeechRec) {
    pfRec = new SpeechRec();
    pfRec.interimResults = true;
    pfRec.continuous = true;
    pfRec.maxAlternatives = 3; 
    
    pfRec.onresult = (e) => {
        if (pfState.isTransitioning || pfState.isSwitchingMic || pfState.hasAnswered) return;

        let transcripts = ['', '', ''];
        for (let i = 0; i < e.results.length; ++i) {
            transcripts[0] += e.results[i][0].transcript.toLowerCase() + ' ';
            transcripts[1] += (e.results[i][1] ? e.results[i][1].transcript.toLowerCase() : e.results[i][0].transcript.toLowerCase()) + ' ';
            transcripts[2] += (e.results[i][2] ? e.results[i][2].transcript.toLowerCase() : e.results[i][0].transcript.toLowerCase()) + ' ';
        }

        const mainTranscript = transcripts[0].trim();

        // --- 本番モード(Trial) の処理 ---
        if (pfState.isPlaying && pfState.mode === 'trial') {
            const statusTextEl = document.getElementById('pf-status-text');
            if (statusTextEl) statusTextEl.innerText = mainTranscript || 'Listening...';

            if (mainTranscript.includes("skip") || mainTranscript.includes("スキップ")) {
                handleSkip();
                return;
            }

            const card = pfState.cards[pfState.currentIndex];
            const currentLang = pfState.languages[pfState.currentLangIndex];

            for (let t of transcripts) {
                if (checkIsCorrect(card, t, currentLang)) {
                    const completedLangIndex = pfState.currentLangIndex;
                    pfState.currentLangIndex++;
                    
                    revealAllHints('step', completedLangIndex); 
                    
                    if (pfState.currentLangIndex >= pfState.languages.length) {
                        handleCorrect();
                    } else {
                        pfState.hasAnswered = true;
                        pfState.isTransitioning = true;
                        playPfSound('stepCorrect');
                        
                        const checkAnimEl = document.getElementById('correct-answer-anim');
                        if (checkAnimEl) {
                            checkAnimEl.classList.remove('hidden');
                            checkAnimEl.classList.add('animate-pop-check');
                            setTimeout(() => {
                                checkAnimEl.classList.remove('animate-pop-check');
                                checkAnimEl.classList.add('hidden');
                            }, 600); 
                        }

                        updateTrialLangUI();
                        
                        setTimeout(() => {
                            updateHintUI();
                            pfState.cardStartTime = Date.now(); 
                            document.getElementById('pf-status-text').innerText = 'Ready...';
                            
                            pfState.isSwitchingMic = true;
                            try { pfRec.abort(); } catch(err){}
                            pfRec.lang = pfState.languages[pfState.currentLangIndex];
                            
                            setTimeout(() => { 
                                pfState.isSwitchingMic = false;
                                pfState.isTransitioning = false;
                                pfState.hasAnswered = false; 
                                if (pfState.isPlaying) {
                                    try { pfRec.start(); } catch(err){} 
                                }
                            }, 400);
                        }, 600); 
                    }
                    return; 
                }
            }
        } 
        // --- 練習モード(Practice) の処理 ---
        else if (pfState.mode === 'practice' && window.practiceTargetWords) {
            const statusEl = document.getElementById(window.practiceStatusId);
            let isMatch = false;
            const mockCard = { targets: { [pfRec.lang]: window.practiceTargetWords } };
            
            for (let t of transcripts) {
                if (checkIsCorrect(mockCard, t, pfRec.lang)) {
                    isMatch = true;
                    break;
                }
            }

            if (isMatch) {
                if(statusEl) statusEl.innerHTML = `<span class="text-green-500 font-black text-sm md:text-base">✨ Excellent!</span>`;
                playPfSound('practiceCorrect');
                if(typeof window.createConfetti === 'function') window.createConfetti();
                window.practiceTargetWords = null; 
                try { pfRec.stop(); } catch(err){}
            } else {
                if(statusEl && window.practiceTargetWords) {
                    statusEl.innerHTML = `<span class="text-pink-500 animate-pulse">Listening...🎙</span><div class="text-gray-400 font-normal text-[10px] mt-1 w-full truncate max-w-[120px]">${mainTranscript}</div>`;
                }
            }
        }
    };

    pfRec.onend = () => {
        if (pfState.isPlaying && pfState.mode === 'trial' && !pfState.isSwitchingMic) {
            setTimeout(() => { 
                if (pfState.isPlaying && !pfState.isSwitchingMic) {
                    try { pfRec.start(); } catch(err){} 
                }
            }, 200);
        } else if (pfState.mode === 'practice' && window.practiceTargetWords && !pfState.isSwitchingMic) {
            setTimeout(() => { 
                if (window.practiceTargetWords && !pfState.isSwitchingMic) {
                    try { pfRec.start(); } catch(err){} 
                }
            }, 200);
        }
    };
}

function showPfView(viewId) {
    document.querySelectorAll('.app-container > div').forEach(el => {
        if(el.id !== 'pf-practice-modal') el.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

function initLangCheckboxes() {
    const container = document.getElementById('pf-lang-checkboxes');
    if(!container) return;
    container.innerHTML = '';
    
    Object.entries(LANG_INFO).forEach(([code, info]) => {
        const isChecked = '';
        container.innerHTML += `
            <label class="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-pink-50 hover:border-pink-200 transition-colors">
                <input type="checkbox" value="${code}" class="pf-lang-cb w-5 h-5 text-pink-500 rounded focus:ring-pink-500" ${isChecked}>
                <span class="font-bold text-gray-700 text-sm md:text-base flex items-center gap-1.5">${getFlagHtml(info.cc)} ${info.name}</span>
            </label>
        `;
    });

    document.querySelectorAll('.pf-lang-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = Array.from(document.querySelectorAll('.pf-lang-cb:checked')).map(el => el.value);
            pfState.languages = checked;
        });
    });
}

function renderPracticeGrid() {
    const gridEl = document.getElementById('pf-practice-grid');
    gridEl.innerHTML = '';

    pfState.cards.forEach((card, cardIdx) => {
        const primaryLang = pfState.languages[0];
        let targetWord = getTargetWordForLang(card, primaryLang) || "???";
        const fileName = card.img.split('/').pop();
        const info = LANG_INFO[primaryLang];

        gridEl.innerHTML += `
            <div onclick="openPracticeModal(${cardIdx})" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer transform hover:-translate-y-2 transition-all hover:shadow-lg hover:border-pink-300 group flex flex-col">
                <div class="w-full aspect-[4/3] bg-gray-50 relative p-3 md:p-4 flex items-center justify-center shrink-0">
                    <img src="assets/images/picflash/${fileName}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-3 md:p-4 text-center bg-white border-t border-gray-100 flex-1 flex items-center justify-center flex-col">
                    <div class="text-[10px] text-gray-400 font-bold mb-1 flex items-center justify-center gap-1">${getFlagHtml(info.cc, "w-3 h-auto")} ${info.name}</div>
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
    if (pfState.languages.length === 0) {
        alert("少なくとも1つの言語を選んでください！");
        return;
    }

    if (!pfState.category) return;

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
    }
}

function startTrialMode() {
    pfState.currentIndex = 0;
    pfState.penalty = 0; 
    pfState.comboCount = 0;
    pfState.isPlaying = false; 
    pfState.hasAnswered = false;
    pfState.isTransitioning = false;
    
    const lampsContainer = document.getElementById('pf-progress-lamps');
    if (lampsContainer) {
        lampsContainer.innerHTML = '';
        pfState.cards.forEach((_, i) => {
            lampsContainer.innerHTML += `<div id="lamp-${i}" class="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gray-200 border-2 border-white shadow-inner transition-colors duration-300"></div>`;
        });
    }

    document.getElementById('pf-total-count').innerText = pfState.cards.length;
    document.getElementById('pf-status-text').innerText = 'Ready...';
    
    if (pfState.timePerCard !== 'none') {
        document.getElementById('pf-timer').innerText = pfState.timePerCard.toFixed(2);
    } else {
        document.getElementById('pf-timer').innerText = '0.00';
    }

    const timerContainer = document.getElementById('pf-card-timer-container');
    if (pfState.timePerCard !== 'none') timerContainer.classList.remove('hidden');
    else timerContainer.classList.add('hidden');

    showPfView('view-picflash-play');
    
    pfState.currentLangIndex = 0;
    loadPfCard(true);

    document.getElementById('pf-start-overlay').classList.remove('hidden');
}

document.getElementById('btn-pf-real-start').addEventListener('click', () => {
    document.getElementById('pf-start-overlay').classList.add('hidden');
    
    pfState.isPlaying = true;
    pfState.startTime = Date.now();
    pfState.cardStartTime = Date.now();
    
    if (pfState.timerId) clearInterval(pfState.timerId);
    
    pfState.timerId = setInterval(() => {
        if (pfState.hasAnswered || pfState.isTransitioning) return;

        const cardElapsed = (Date.now() - pfState.cardStartTime) / 1000;

        if (pfState.timePerCard !== 'none') {
            let remaining = pfState.timePerCard - cardElapsed;
            if (remaining <= 0) {
                remaining = 0;
                document.getElementById('pf-timer').innerText = '0.00';
                handleSkip(); 
            } else {
                document.getElementById('pf-timer').innerText = remaining.toFixed(2);
                
                let hintInterval = pfState.timePerCard / 4;
                if (cardElapsed > hintInterval) revealHintChar(0);
                if (cardElapsed > hintInterval * 2) revealHintChar(1);
                if (cardElapsed > hintInterval * 3) revealHintChar(2);

                const bar = document.getElementById('pf-card-timer-bar');
                if (bar) {
                    const percent = (remaining / pfState.timePerCard) * 100;
                    bar.style.width = `${percent}%`;
                    if (percent < 30) {
                        bar.classList.replace('from-purple-400', 'from-red-500');
                        bar.classList.replace('to-pink-500', 'to-red-600');
                    }
                }
            }
        } 
        else {
            document.getElementById('pf-timer').innerText = cardElapsed.toFixed(2);
            
            if (cardElapsed > 3.0) revealHintChar(0);
            if (cardElapsed > 6.0) revealHintChar(1);
            if (cardElapsed > 9.0) revealHintChar(2);
        }
    }, 50);

    document.getElementById('pf-status-text').innerText = 'Listening...';
    
    pfState.hasAnswered = false;
    pfState.isTransitioning = false;
    pfState.isSwitchingMic = true;
    try { pfRec.abort(); } catch(e){}
    if (pfRec) pfRec.lang = pfState.languages[pfState.currentLangIndex];
    setTimeout(() => {
        pfState.isSwitchingMic = false;
        if (pfState.isPlaying) {
            try { pfRec.start(); } catch(e){}
        }
    }, 400);
});

function loadPfCard(isNewImage) {
    if (pfState.isPlaying) pfState.cardStartTime = Date.now();
    pfState.currentLangIndex = 0; 

    if (pfState.timePerCard !== 'none') {
        document.getElementById('pf-timer').innerText = pfState.timePerCard.toFixed(2);
    } else {
        document.getElementById('pf-timer').innerText = '0.00';
    }

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

    const fileName = card.img.split('/').pop();
    document.getElementById('pf-image').src = `assets/images/picflash/${fileName}`;

    document.getElementById('pf-overlay-correct').classList.add('hidden');
    document.getElementById('pf-overlay-skip').classList.add('hidden');
    document.getElementById('pf-card').classList.remove('scale-95');

    document.getElementById('pf-status-text').innerText = 'Ready...';

    updateTrialLangUI();
    updateHintUI();
}

function updateTrialLangUI() {
    const stepsEl = document.getElementById('pf-trial-steps');
    if (!stepsEl) return;
    stepsEl.innerHTML = '';
    
    pfState.languages.forEach((langCode, i) => {
        const info = LANG_INFO[langCode] || { cc: "un", name: langCode };
        let statusHtml = "";
        let borderClass = "border-gray-100 bg-gray-50 text-gray-400 opacity-50"; 
        
        if (i < pfState.currentLangIndex) {
            statusHtml = "✅";
            borderClass = "border-green-200 bg-green-50 text-green-600";
        } else if (i === pfState.currentLangIndex) {
            statusHtml = "🎙";
            borderClass = "border-pink-400 bg-white text-pink-600 shadow-md transform scale-[1.02] animate-pulse-slow";
        }
        
        stepsEl.innerHTML += `
            <div class="flex items-center justify-between p-2 md:p-3 rounded-xl border-2 transition-all duration-300 ${borderClass}">
                <div class="font-black text-sm md:text-base flex items-center gap-1.5">${getFlagHtml(info.cc)} ${info.name}</div>
                <div class="text-lg md:text-xl">${statusHtml}</div>
            </div>
        `;
    });
}

function updateHintUI() {
    const card = pfState.cards[pfState.currentIndex];
    const currentLang = pfState.languages[pfState.currentLangIndex];
    const info = LANG_INFO[currentLang] || { hintLang: 'en-US' };
    
    let targetWord = getTargetWordForLang(card, currentLang);
    
    let hintMeaning = "";
    if (currentLang.startsWith('en')) hintMeaning = getTargetWordForLang(card, 'ja-JP');
    else hintMeaning = getTargetWordForLang(card, 'en-US');
    
    document.getElementById('pf-hint-meaning').innerText = hintMeaning || "???";

    const squaresContainer = document.getElementById('pf-hint-squares');
    if (squaresContainer) {
        squaresContainer.innerHTML = '';
        for (let i = 0; i < targetWord.length; i++) {
            let char = targetWord[i];
            if (char === ' ') {
                squaresContainer.innerHTML += `<div class="w-2 md:w-3"></div>`;
            } else {
                squaresContainer.innerHTML += `<div id="hint-sq-${i}" data-char="${char}" class="w-6 h-8 md:w-8 md:h-10 bg-gray-100 rounded-lg shadow-inner flex items-center justify-center border border-gray-200 text-sm md:text-xl font-black text-pink-500 uppercase"></div>`;
            }
        }
    }
}

function revealHintChar(index) {
    const sq = document.getElementById(`hint-sq-${index}`);
    if (sq && sq.innerHTML === '') {
        sq.innerHTML = sq.getAttribute('data-char');
        sq.classList.add('hint-char-reveal');
        sq.classList.replace('bg-gray-100', 'bg-pink-50');
        sq.classList.replace('border-gray-200', 'border-pink-200');
    }
}

function revealAllHints(status, targetIndex = null) {
    const card = pfState.cards[pfState.currentIndex];
    let targetLangIndex = targetIndex !== null ? targetIndex : pfState.currentLangIndex;
    if (status === 'correct') targetLangIndex = pfState.languages.length - 1; 

    const currentLang = pfState.languages[targetLangIndex];
    const targetWord = getTargetWordForLang(card, currentLang);
    
    let sqIndex = 0;
    for (let i = 0; i < targetWord.length; i++) {
        if (targetWord[i] === ' ') continue;
        const sq = document.getElementById(`hint-sq-${sqIndex}`);
        if (sq) {
            sq.innerHTML = sq.getAttribute('data-char');
            sq.classList.remove('bg-gray-100', 'border-gray-200', 'text-pink-500', 'bg-pink-50', 'border-pink-200');
            
            if (status === 'correct' || status === 'step') {
                sq.classList.add('bg-green-50', 'border-green-300', 'text-green-600');
            } else if (status === 'skip') {
                sq.classList.add('bg-red-50', 'border-red-300', 'text-red-600');
            }
            sq.classList.add('hint-char-reveal');
        }
        sqIndex++;
    }
}

function handleCorrect() {
    if (pfState.hasAnswered || pfState.isTransitioning) return;
    pfState.hasAnswered = true;
    pfState.isTransitioning = true;
    pfState.comboCount++;

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

    revealAllHints('correct');

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
        if (pfState.currentIndex >= pfState.cards.length) {
            pfState.isTransitioning = false;
            endPfGame();
        } else { 
            pfState.isSwitchingMic = true;
            try { pfRec.abort(); } catch(e){} 
            pfState.currentLangIndex = 0; 
            if (pfRec) pfRec.lang = pfState.languages[0]; 
            loadPfCard(true); 

            setTimeout(() => { 
                pfState.isSwitchingMic = false;
                pfState.isTransitioning = false;
                pfState.hasAnswered = false; 
                if (pfState.isPlaying) {
                    try { pfRec.start(); } catch(e){} 
                }
            }, 400); 
        }
    }, 1200); 
}

function handleSkip() {
    if (pfState.hasAnswered || pfState.isTransitioning) return; 
    pfState.hasAnswered = true;
    pfState.isTransitioning = true;
    pfState.comboCount = 0; 
    
    const lamp = document.getElementById(`lamp-${pfState.currentIndex}`);
    if (lamp) lamp.classList.replace('bg-gray-200', 'bg-red-400');

    playPfSound('skip');
    if (pfState.mode === 'trial') pfState.penalty += 2.0; 

    const cardEl = document.getElementById('pf-card');
    cardEl.classList.add('scale-95');
    
    const ans = getTargetWordForLang(pfState.cards[pfState.currentIndex], pfState.languages[pfState.currentLangIndex]);
    const skipOverlay = document.getElementById('pf-overlay-skip');
    skipOverlay.innerHTML = `
        <span class="text-5xl md:text-7xl transform animate-pop mb-2">⏭️</span>
        <span class="font-black text-2xl md:text-4xl text-white drop-shadow-lg text-red-500 tracking-widest mb-4">SKIP</span>
        <div class="bg-white px-6 py-3 rounded-2xl shadow-xl animate-pop flex flex-col items-center border-4 border-red-200">
            <span class="text-sm font-black text-red-400 mb-1">ANSWER</span>
            <span class="text-3xl md:text-5xl font-black text-gray-800">${ans}</span>
        </div>
    `;
    skipOverlay.classList.remove('hidden');
    revealAllHints('skip');
    
    setTimeout(() => {
        pfState.currentIndex++;
        if (pfState.currentIndex >= pfState.cards.length) {
            pfState.isTransitioning = false;
            endPfGame();
        } else { 
            pfState.isSwitchingMic = true;
            try { pfRec.abort(); } catch(e){} 
            pfState.currentLangIndex = 0; 
            if (pfRec) pfRec.lang = pfState.languages[0]; 
            loadPfCard(true); 
            
            setTimeout(() => { 
                pfState.isSwitchingMic = false;
                pfState.isTransitioning = false;
                pfState.hasAnswered = false; 
                if (pfState.isPlaying) {
                    try { pfRec.start(); } catch(e){} 
                }
            }, 400); 
        }
    }, 1500); 
}

// ------------------------------------------
// リザルトと履歴保存
// ------------------------------------------
function saveAndRenderHistory(finalTime) {
    const historyKey = 'picflash_history';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    const catObj = window.CATEGORIES_DATA.find(c => c.id === pfState.category);
    const catName = catObj ? catObj.title : pfState.category;
    
    const langsJoined = pfState.languages.join(',');
    const sameConditionHistory = history.filter(r => r.category === catName && r.count === pfState.questionCount && r.language === langsJoined);
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
        language: langsJoined
    };
    
    history.unshift(newRecord); 
    if(history.length > 15) history = history.slice(0, 15);
    localStorage.setItem(historyKey, JSON.stringify(history));
    
    const listEl = document.getElementById('pf-history-list');
    listEl.innerHTML = '';
    history.forEach((rec, idx) => {
        const bgClass = idx === 0 ? "bg-pink-50 rounded-xl px-2" : "";
        const countStr = rec.count === 'ALL' ? 'ALL' : `${rec.count} sets`;
        
        const langArr = rec.language ? rec.language.split(',') : ['en-US'];
        let langBadges = langArr.slice(0, 3).map(l => {
            const info = LANG_INFO[l];
            return info ? `<span class="bg-blue-50 px-1 py-0.5 rounded border border-blue-100 flex items-center justify-center shadow-sm">${getFlagHtml(info.cc, "w-4 h-auto")}</span>` : '';
        }).join('');
        if (langArr.length > 3) langBadges += '<span class="text-xs text-gray-400">...</span>';

        listEl.innerHTML += `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 ${bgClass}">
                <div class="flex flex-col">
                    <span class="text-sm md:text-base font-bold text-gray-700 flex items-center gap-1.5">
                        ${rec.category} 
                        <span class="flex gap-0.5 ml-1">${langBadges}</span>
                        <span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200 ml-1">${countStr}</span>
                    </span>
                    <span class="text-xs text-gray-400 mt-1">${rec.date}</span>
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
    
    const pbBadge = document.getElementById('pf-pb-badge');
    const resultBox = document.getElementById('pf-result-box');
    
    if (saveAndRenderHistory(finalTime)) {
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
                startPfGame(); 
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
    const fileName = card.img.split('/').pop();

    let langBlocksHtml = "";
    pfState.languages.forEach((lang, i) => {
        let targetWord = getTargetWordForLang(card, lang) || "???";
        const info = LANG_INFO[lang];
        const statusId = `prac-status-modal-${i}`;

        langBlocksHtml += `
            <div class="p-3 md:p-4 rounded-2xl bg-white border border-gray-200 relative overflow-hidden shadow-sm flex flex-col justify-between shrink-0">
                <div>
                    <div class="text-xs md:text-sm font-bold text-gray-500 mb-1 flex items-center gap-2">${getFlagHtml(info.cc, "w-4 h-auto")} ${info.name}</div>
                    <div class="text-2xl md:text-3xl font-black text-gray-800 mb-3 leading-tight">${targetWord}</div>
                </div>
                <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                    <div class="flex gap-2 relative z-10 shrink-0">
                        <button onclick="playPfTTS(${cardIdx}, '${lang}')" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl shadow-sm text-gray-600 hover:bg-gray-100 font-black text-xs flex items-center gap-1 transition-colors whitespace-nowrap">
                            🔊 聞く
                        </button>
                        <button onclick="startPracticeRec(${cardIdx}, '${lang}', '${statusId}')" class="px-3 py-2 bg-pink-50 text-pink-600 border border-pink-200 rounded-xl shadow-sm hover:bg-pink-100 font-black text-xs flex items-center gap-1 transition-colors whitespace-nowrap">
                            🎙 話す
                        </button>
                    </div>
                    <div id="${statusId}" class="text-xs font-black text-gray-400 relative z-10 text-right ml-2 leading-tight"></div>
                </div>
            </div>
        `;
    });

    // ★ 修正：右側のリスト部分にのみ「max-height: 65vh;」を直接指定し、確実にスクロールさせる
    let html = `
        <div class="flex flex-col md:flex-row gap-4 md:gap-6 w-full items-start">
            <div class="w-full md:w-2/5 flex flex-col justify-center shrink-0 sticky top-0 z-10 bg-white pt-2 pb-2 md:pb-0 md:pt-0">
                <div class="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 relative flex items-center justify-center p-4 border border-gray-100 shadow-inner">
                    <img src="assets/images/picflash/${fileName}" class="w-full h-full object-contain drop-shadow-md">
                </div>
            </div>
            <div class="w-full md:w-3/5 flex flex-col gap-3 justify-start overflow-y-auto custom-scrollbar pr-2 pb-6" style="max-height: 65vh;">
                ${langBlocksHtml}
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

window.playPfTTS = function(cardIdx, lang) {
    speechSynthesis.cancel();
    const card = pfState.cards[cardIdx];
    let textToSpeak = getTargetWordForLang(card, lang) || "???";
    
    const u = new SpeechSynthesisUtterance(textToSpeak);
    u.lang = lang; 
    u.rate = 0.9;
    
    // 最新の音声リストを取得
    let voices = speechSynthesis.getVoices();
    if (voices.length === 0 && window.pfAvailableVoices) {
        voices = window.pfAvailableVoices;
    }
    
    const shortLang = lang.split('-')[0];
    
    // ★ 修正：その言語の音声をすべて抽出し、「高品質な音声（Google, Siri, Premium等）」を優先的に選ぶ
    let targetVoices = voices.filter(v => v.lang === lang || v.lang.replace('_', '-') === lang || v.lang.startsWith(shortLang));
    
    if (targetVoices.length > 0) {
        let bestVoice = targetVoices.find(v => 
            v.name.includes('Google') || 
            v.name.includes('Premium') || 
            v.name.includes('Natural') || 
            v.name.includes('Siri')
        );
        
        // 高品質な音声が見つからなければ、その言語の最初の音声をセット
        if (!bestVoice) bestVoice = targetVoices[0];
        
        u.voice = bestVoice;
    }

    speechSynthesis.speak(u);
};

window.startPracticeRec = function(cardIdx, lang, statusId) {
    if (!pfRec) return alert("音声認識に非対応のブラウザです");
    const card = pfState.cards[cardIdx];
    
    let targets = card.targets && card.targets[lang] ? card.targets[lang] : [];
    if (targets.length === 0 && lang === 'en-US' && card.level1) targets = card.level1.words.map(w => w.text || w);
    
    window.practiceTargetWords = targets; 
    window.practiceStatusId = statusId;
    
    pfState.isSwitchingMic = true;
    try { pfRec.abort(); } catch(e) {}
    pfRec.lang = lang; 
    
    document.getElementById(statusId).innerHTML = `<span class="text-pink-500 animate-pulse">Listening...🎙</span>`;
    setTimeout(() => { 
        pfState.isSwitchingMic = false;
        try { pfRec.start(); } catch(e) {} 
    }, 100);
};

document.addEventListener('DOMContentLoaded', () => {
    initLangCheckboxes();

    document.querySelectorAll('.pf-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            pfState.mode = target.getAttribute('data-mode');
            
            document.querySelectorAll('.pf-mode-btn').forEach(b => b.classList.remove('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300'));
            target.classList.add('bg-gradient-to-br', 'from-pink-100', 'to-white', 'border-pink-300');

            const trialSection = document.getElementById('section-trial-settings');
            
            if (pfState.mode === 'trial') {
                trialSection.classList.remove('hidden');
            } else {
                trialSection.classList.add('hidden');
            }
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

    document.getElementById('btn-pf-skip').addEventListener('click', handleSkip);
    
    document.getElementById('btn-pf-quit').addEventListener('click', () => {
        pfState.isPlaying = false;
        clearInterval(pfState.timerId);
        try { pfRec.abort(); } catch(e){}
        showPfView('view-picflash-select');
    });
});
// ==========================================
// ★ index.html への遷移を play.html (モード選択) に強制変更するコード
// ==========================================
document.addEventListener('click', (e) => {
    // onclick="window.location.href='index.html'" を持っているボタンを捕まえる
    const toIndexBtn = e.target.closest('[onclick*="index.html"]');
    
    if (toIndexBtn) {
        // HTMLの直接リンクを強制的にキャンセル
        e.preventDefault();
        e.stopImmediatePropagation();
        
        // 録音等の動作を安全に停止
        if (typeof pfState !== 'undefined' && pfState.isPlaying) {
            pfState.isPlaying = false;
            if (pfState.timerId) clearInterval(pfState.timerId);
            try { if (typeof pfRec !== 'undefined' && pfRec) pfRec.abort(); } catch(err){}
        }
        if (window.isRecording && typeof window.stopSpeech === 'function') {
            window.stopSpeech();
        }
        
        // ゲームモード選択画面 (play.html) へ強制ジャンプ！
        window.location.href = 'play.html';
    }
}, true); // true = HTMLのonclickより先に実行（キャプチャフェーズ）