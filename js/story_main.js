// js/story_main.js
// ==========================================
// Story Mode 専用の メインシステム（Reading & Retelling制御）
// ==========================================

// --- 設定・状態管理 ---
window.pssSettings = {
    retellingTime: 20,
    effectsOn: true
};

window.storyState = { 
    selectedLevel: 'junior_high',
    currentStoryId: null,
    currentStory: null,
    currentSceneIndex: 0,
    playMode: null, 
    phase: 'select', 
    readingTranscripts: ["", "", "", ""], 
    retellingTranscripts: ["", "", "", ""]
};

// マイクの状態: 'idle', 'listening', 'paused'
window.micState = 'idle'; 
window.isTTSPlaying = false;
window.currentUtterance = null;
window.retellingTimer = null;
window.timeLeft = 0;
window.storyList = [];
window.perfectedSentences = new Set(); // 文単位の正解記録

const levelMap = { 'elementary': '小学生', 'junior_high': '中学生', 'high_school': '高校生' };

const viewSelect = document.getElementById('view-select');
const viewReading = document.getElementById('view-reading');
const viewRetelling = document.getElementById('view-retelling');
const viewResultStory = document.getElementById('view-result-story');
const storyModeModal = document.getElementById('story-mode-modal');

// --- サウンド合成（外部ファイル不要） ---
function playSyntheticSound(type) {
    if (!window.pssSettings.effectsOn) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'perfect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'match') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch(e) { console.warn("Sound play failed", e); }
}

// --- アプリ初期化 ---
async function initStoryApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("お使いのブラウザは音声認識に非対応です。"); return; }
    
    window.handleSpeechResult = handleStorySpeechResult;
    window.handleSpeechEnd = handleStorySpeechEnd;
    if(typeof initSpeechRecognition === 'function') {
        initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    }

    // 設定の復元
    const savedLevel = localStorage.getItem('picSpeakSelectedLevel');
    if (savedLevel) window.storyState.selectedLevel = savedLevel;
    
    const savedSettings = JSON.parse(localStorage.getItem('pss-settings'));
    if (savedSettings) {
        window.pssSettings = { ...window.pssSettings, ...savedSettings };
    }
    const timeSelect = document.getElementById('setting-time-select');
    const effectToggle = document.getElementById('setting-effect-toggle');
    if (timeSelect) timeSelect.value = window.pssSettings.retellingTime;
    if (effectToggle) effectToggle.checked = window.pssSettings.effectsOn;

    initResizers();
    initFontSliders();
    await fetchStoryData();
}

window.savePssSettings = function() {
    const timeSelect = document.getElementById('setting-time-select');
    const effectToggle = document.getElementById('setting-effect-toggle');
    if (timeSelect) window.pssSettings.retellingTime = parseInt(timeSelect.value);
    if (effectToggle) window.pssSettings.effectsOn = effectToggle.checked;
    localStorage.setItem('pss-settings', JSON.stringify(window.pssSettings));
    const modal = document.getElementById('pss-settings-modal');
    if (modal) modal.classList.add('hidden');
};

async function fetchStoryData() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10">Loading Stories...</div>';
    try {
        const response = await fetch('data/story_list.json?t=' + new Date().getTime());
        const storyIds = await response.json();
        const fetchPromises = storyIds.map(id => fetch(`data/stories/${id}.json?t=${new Date().getTime()}`).then(res => res.ok ? res.json() : null).catch(e => null));
        const results = await Promise.all(fetchPromises);
        window.storyList = results.filter(data => data !== null);
        renderStoryGrid();
    } catch (error) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading stories</div>';
    }
}

function renderStoryGrid() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    let html = '';
    window.storyList.forEach(story => {
        html += `<div class="cursor-pointer rounded-3xl overflow-hidden shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" onclick="openStoryModeSelect('${story.id}')">
            <div class="relative w-full aspect-video bg-gray-50 shrink-0 p-4">
                <img src="${story.imageSrc}" onerror="this.src='assets/images/icon.png'" class="absolute inset-0 w-full h-full object-contain p-2">
            </div>
            <div class="p-4 text-center text-sm md:text-lg font-black text-gray-700 border-t border-gray-100 bg-white">${story.titleJa}</div>
        </div>`;
    });
    grid.innerHTML = html;
}

window.openStoryModeSelect = function(storyId) {
    window.storyState.currentStoryId = storyId;
    if(storyModeModal) storyModeModal.classList.remove('hidden');
};
document.getElementById('btn-close-story-mode')?.addEventListener('click', () => {
    if(storyModeModal) storyModeModal.classList.add('hidden');
});

window.selectStoryMode = function(mode) {
    if(storyModeModal) storyModeModal.classList.add('hidden');
    window.storyState.playMode = mode;
    window.storyState.currentStory = window.storyList.find(s => s.id === window.storyState.currentStoryId);
    window.storyState.currentSceneIndex = 0;
    
    document.getElementById('btn-next-retelling')?.classList.add('hidden');
    if (mode === 'reading') {
        window.storyState.phase = 'reading';
        window.storyState.readingTranscripts = ["", "", "", ""];
        loadReadingScene(0);
        showStoryView(viewReading);
    } else if (mode === 'retelling') {
        window.storyState.phase = 'retelling';
        window.storyState.retellingTranscripts = ["", "", "", ""];
        document.getElementById('retelling-finish-overlay')?.classList.add('hidden');
        document.getElementById('retelling-start-overlay')?.classList.remove('hidden');
        loadRetellingScene(0); 
        showStoryView(viewRetelling);
    }
};

// ==========================================
// UI制御 (リサイズ, フォント)
// ==========================================
function initFontSliders() {
    const setupSlider = (sliderId, targetId, storageKey) => {
        const slider = document.getElementById(sliderId);
        const target = document.getElementById(targetId);
        if (!slider || !target) return;
        const saved = localStorage.getItem(storageKey);
        if (saved) { slider.value = saved; target.style.fontSize = `${saved}px`; }
        slider.addEventListener('input', (e) => {
            target.style.fontSize = `${e.target.value}px`;
            localStorage.setItem(storageKey, e.target.value);
        });
    };
    setupSlider('font-slider-en', 'reading-text-content', 'pss-font-en');
    setupSlider('font-slider-ja', 'reading-text-ja', 'pss-font-ja');
    setupSlider('font-slider-transcript', 'reading-transcript', 'pss-font-tr');
}

function initResizers() {
    const container = document.getElementById('reading-panes-container');
    const rightContainer = document.getElementById('right-container');
    const paneImage = document.getElementById('pane-image');
    const paneText = document.getElementById('pane-text');
    const resizer1 = document.getElementById('resizer-1');
    const resizer2 = document.getElementById('resizer-2');
    if (!container || !rightContainer || !paneImage || !paneText || !resizer1 || !resizer2) return;

    const savedSizes = JSON.parse(localStorage.getItem('pss-pane-sizes-v4')) || { imgP: 35, textP: 45 };
    paneImage.style.flexBasis = `${savedSizes.imgP}%`;
    paneText.style.flexBasis = `${savedSizes.textP}%`;

    let isResizing = false; let currentResizer = null; let startPos = 0; let startBasisPrev = 0;

    const onStart = (e, resizer) => {
        isResizing = true; currentResizer = resizer;
        const isTouch = e.type.includes('touch');
        const isPC = window.innerWidth >= 768; 
        
        if (resizer.id === 'resizer-1') {
            if (isPC) {
                startPos = isTouch ? e.touches[0].clientX : e.clientX;
                startBasisPrev = (paneImage.getBoundingClientRect().width / container.getBoundingClientRect().width) * 100;
                document.body.style.cursor = 'col-resize';
            } else {
                startPos = isTouch ? e.touches[0].clientY : e.clientY;
                startBasisPrev = (paneImage.getBoundingClientRect().height / container.getBoundingClientRect().height) * 100;
                document.body.style.cursor = 'row-resize';
            }
        } else {
            startPos = isTouch ? e.touches[0].clientY : e.clientY;
            startBasisPrev = (paneText.getBoundingClientRect().height / rightContainer.getBoundingClientRect().height) * 100;
            document.body.style.cursor = 'row-resize';
        }
        e.preventDefault(); 
    };

    resizer1.addEventListener('mousedown', (e) => onStart(e, resizer1));
    resizer1.addEventListener('touchstart', (e) => onStart(e, resizer1), { passive: false });
    resizer2.addEventListener('mousedown', (e) => onStart(e, resizer2));
    resizer2.addEventListener('touchstart', (e) => onStart(e, resizer2), { passive: false });

    const onMove = (e) => {
        if (!isResizing || !currentResizer) return;
        const isPC = window.innerWidth >= 768; const isTouch = e.type.includes('touch');
        if (currentResizer.id === 'resizer-1') {
            const currentPos = isPC ? (isTouch ? e.touches[0].clientX : e.clientX) : (isTouch ? e.touches[0].clientY : e.clientY);
            const delta = currentPos - startPos;
            const containerSize = isPC ? container.getBoundingClientRect().width : container.getBoundingClientRect().height;
            const newBasis = startBasisPrev + (delta / containerSize) * 100;
            if (newBasis > 10 && newBasis < 85) paneImage.style.flexBasis = `${newBasis}%`;
        } else {
            const currentY = isTouch ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startPos;
            const newBasis = startBasisPrev + (deltaY / rightContainer.getBoundingClientRect().height) * 100;
            if (newBasis > 15 && newBasis < 85) paneText.style.flexBasis = `${newBasis}%`;
        }
    };

    const onEnd = () => {
        if (isResizing) {
            isResizing = false; document.body.style.cursor = 'default';
            const isPC = window.innerWidth >= 768;
            const imgP = isPC ? (paneImage.getBoundingClientRect().width / container.getBoundingClientRect().width) * 100 : (paneImage.getBoundingClientRect().height / container.getBoundingClientRect().height) * 100;
            const textP = (paneText.getBoundingClientRect().height / rightContainer.getBoundingClientRect().height) * 100;
            localStorage.setItem('pss-pane-sizes-v4', JSON.stringify({ imgP, textP }));
        }
    };

    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);
}

// ==========================================
// Reading Practice モード
// ==========================================
function loadReadingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    const levelData = scene.levels ? scene.levels[level] : scene; 
    
    setMicState('idle');
    speechSynthesis.cancel();
    updateTTSButtonUI();
    window.perfectedSentences.clear();
    
    const sceneBadge = document.getElementById('reading-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-blue-600 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-blue-100 rounded-lg text-blue-600 align-middle shadow-sm border border-blue-200">${levelMap[level]}</span>`;
    }
    
    document.getElementById('reading-text-content').innerHTML = levelData.readingText || "";
    document.getElementById('reading-text-ja').textContent = levelData.readingJa || "日本語訳はありません。";
    document.getElementById('reading-accuracy').textContent = "0%";
    
    const transcriptBox = document.getElementById('reading-transcript');
    transcriptBox.textContent = "下の「START」ボタンを押して、英語を読んでみましょう！";
    transcriptBox.className = "flex-1 overflow-y-auto text-gray-400 font-bold italic leading-relaxed pt-1 transition-all";
    
    document.getElementById('ja-container').classList.add('hidden');
    const btnToggleJa = document.getElementById('btn-toggle-ja');
    if (btnToggleJa) {
        btnToggleJa.innerHTML = '🇯🇵 訳を表示';
        btnToggleJa.classList.replace('bg-gray-100', 'bg-white');
    }

    const imgEl = document.getElementById('reading-image');
    if (imgEl) {
        imgEl.src = scene.imageSrc;
        imgEl.onerror = () => { imgEl.src = 'assets/images/icon.png'; };
    }
    
    const btnNext = document.getElementById('btn-next-scene');
    if (index === 3) {
        btnNext.innerHTML = '✨ 終了する';
        btnNext.classList.replace('bg-blue-600', 'bg-pink-500');
        btnNext.classList.replace('hover:bg-blue-500', 'hover:bg-pink-400');
        btnNext.classList.replace('shadow-blue-200', 'shadow-pink-200');
    } else {
        btnNext.innerHTML = 'NEXT ➔';
        btnNext.classList.replace('bg-pink-500', 'bg-blue-600');
        btnNext.classList.replace('hover:bg-pink-400', 'hover:bg-blue-500');
        btnNext.classList.replace('shadow-pink-200', 'shadow-blue-200');
    }
}

document.getElementById('btn-toggle-ja')?.addEventListener('click', (e) => {
    const jaArea = document.getElementById('ja-container');
    if (jaArea.classList.contains('hidden')) {
        jaArea.classList.remove('hidden');
        e.currentTarget.innerHTML = '🇯🇵 訳を隠す';
        e.currentTarget.classList.replace('bg-white', 'bg-gray-100');
    } else {
        jaArea.classList.add('hidden');
        e.currentTarget.innerHTML = '🇯🇵 訳を表示';
        e.currentTarget.classList.replace('bg-gray-100', 'bg-white');
    }
});

// TTS 
function updateTTSButtonUI() {
    const icon = document.getElementById('tts-icon');
    const btn = document.getElementById('btn-read-aloud');
    if (icon && btn) {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            icon.textContent = '⏸'; btn.classList.add('bg-indigo-100');
        } else {
            icon.textContent = '▶'; btn.classList.remove('bg-indigo-100');
        }
    }
}

function playCurrentTTS() {
    const idx = window.storyState.currentSceneIndex;
    const levelData = window.storyState.currentStory.scenes[idx].levels[window.storyState.selectedLevel];
    window.currentUtterance = new SpeechSynthesisUtterance(levelData.readingText.replace(/<[^>]*>?/gm, ''));
    window.currentUtterance.lang = 'en-US';
    window.currentUtterance.onend = updateTTSButtonUI;
    speechSynthesis.speak(window.currentUtterance);
    updateTTSButtonUI();
}

document.getElementById('btn-read-aloud')?.addEventListener('click', () => {
    if (speechSynthesis.speaking) { speechSynthesis.paused ? speechSynthesis.resume() : speechSynthesis.pause(); } 
    else { playCurrentTTS(); }
    setTimeout(updateTTSButtonUI, 50); 
});

document.getElementById('btn-tts-rewind')?.addEventListener('click', () => {
    speechSynthesis.cancel(); setTimeout(playCurrentTTS, 100);
});

document.getElementById('btn-next-scene')?.addEventListener('click', () => {
    setMicState('idle');
    speechSynthesis.cancel();
    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        loadReadingScene(window.storyState.currentSceneIndex);
    } else {
        showStoryView(viewSelect);
    }
});

// マイク制御 (State Machine)
function setMicState(state) {
    window.micState = state;
    const btn = document.getElementById('btn-start-reading');
    const transcriptBox = document.getElementById('reading-transcript');
    if (!btn || !transcriptBox) return;
    
    if (state === 'listening') {
        window.isRecording = true;
        if(typeof startSpeech === 'function') startSpeech();
        btn.innerHTML = '<span class="animate-pulse">🔴</span> Listening...';
        btn.className = "flex-1 md:flex-none px-8 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 min-w-[200px] bg-red-50 text-red-600 border-2 border-red-200 shadow-inner";
        transcriptBox.className = "flex-1 overflow-y-auto text-gray-800 font-bold leading-relaxed pt-1 transition-all";
        if(transcriptBox.textContent.includes("START")) transcriptBox.textContent = "聞き取っています...";
    } else if (state === 'paused') {
        window.isRecording = false;
        if(typeof stopSpeech === 'function') stopSpeech();
        btn.innerHTML = '⏸️ PAUSE (再開)';
        btn.className = "flex-1 md:flex-none px-8 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 min-w-[200px] bg-gray-500 text-white shadow-md";
    } else { // idle
        window.isRecording = false;
        if(typeof stopSpeech === 'function') stopSpeech();
        btn.innerHTML = '🎤 START';
        btn.className = "flex-1 md:flex-none px-8 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 min-w-[200px] bg-red-500 hover:bg-red-400 text-white shadow-md";
    }
}

document.getElementById('btn-start-reading')?.addEventListener('click', () => {
    speechSynthesis.cancel(); updateTTSButtonUI();
    if (window.micState === 'idle' || window.micState === 'paused') setMicState('listening');
    else setMicState('paused');
});

// ==========================================
// 音声認識ハンドラ & 判定ロジック
// ==========================================
function handleStorySpeechResult(finalText, interimText) {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    const levelData = window.storyState.currentStory.scenes[idx].levels[window.storyState.selectedLevel];

    // Retelling処理 (リアルタイム色付け)
    if (window.storyState.phase === 'retelling') {
        if (finalText.trim().length > 0) window.storyState.retellingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.retellingTranscripts[idx] + interimText;
        
        let allText = "";
        for(let i=0; i<idx; i++){ allText += window.storyState.retellingTranscripts[i] + " "; }
        allText += currentTempText;

        // ターゲット語彙の抽出とハイライト
        let targetWords = [];
        if(levelData.words) targetWords = levelData.words.map(w=>w.text.toLowerCase().replace(/[.,!?]/g, ''));
        const targetSet = new Set(targetWords);
        
        const htmlText = allText.split(/\s+/).map(w => {
            const cleanW = w.toLowerCase().replace(/[.,!?]/g, '');
            if(targetSet.has(cleanW)) {
                if(!window.perfectedSentences.has(cleanW)) { 
                    playSyntheticSound('match'); window.perfectedSentences.add(cleanW);
                }
                return `<span class="text-green-500 font-black">${w}</span>`;
            }
            return w;
        }).join(" ");

        const box = document.getElementById('retelling-transcript-box');
        if(box) { box.innerHTML = htmlText; box.scrollTop = box.scrollHeight; }
        return;
    }

    // Reading処理
    if (window.storyState.phase === 'reading') {
        if (finalText.trim().length > 0) window.storyState.readingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.readingTranscripts[idx] + interimText;
        
        const targetText = levelData.readingText.replace(/<[^>]*>?/gm, '');
        const targetSentences = targetText.match(/[^.!?]+[.!?]+/g) || [targetText];
        const spokenRaw = currentTempText.toLowerCase().replace(/[.,!?]/g, '');
        
        // 文単位のPerfect判定
        targetSentences.forEach((sentence, sIdx) => {
            if (window.perfectedSentences.has(sIdx)) return;
            const sClean = sentence.toLowerCase().replace(/[.,!?]/g, '').trim();
            if (sClean.length > 5 && spokenRaw.includes(sClean)) {
                window.perfectedSentences.add(sIdx);
                playSyntheticSound('perfect');
                const anim = document.getElementById('perfect-animation');
                if (anim && window.pssSettings.effectsOn) {
                    anim.classList.remove('hidden'); anim.classList.add('flex', 'animate-pop');
                    setTimeout(() => { anim.classList.remove('flex', 'animate-pop'); anim.classList.add('hidden'); }, 1500);
                }
            }
        });

        // 全体一致率とハイライト
        const tWords = targetText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w);
        const sWords = currentTempText.split(/\s+/);
        const sSet = new Set(sWords.map(w => w.replace(/[.,!?]/g, '').toLowerCase()).filter(w=>w));
        
        let matchCount = 0;
        tWords.forEach(w => { if(sSet.has(w)) matchCount++; });
        let acc = Math.min(100, Math.floor((matchCount / tWords.length) * 100));
        document.getElementById('reading-accuracy').textContent = `${acc}%`;

        const tSetForMatch = new Set(tWords);
        const htmlTranscript = sWords.map(w => {
            const cleanW = w.replace(/[.,!?]/g, '').toLowerCase();
            return (cleanW && !tSetForMatch.has(cleanW)) ? `<span class="text-purple-600 font-black underline decoration-purple-300" title="本文にない単語">${w}</span>` : w;
        }).join(" ");
        
        document.getElementById('reading-transcript').innerHTML = htmlTranscript || "聞き取っています...";
    }
}

function handleStorySpeechEnd() {
    if (window.micState === 'listening') {
        try { startSpeech(); } catch(e) {}
    }
}

// ==========================================
// Retelling Practice
// ==========================================
function loadRetellingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const sceneBadge = document.getElementById('retelling-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-pink-400 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-pink-100 rounded-lg text-pink-600 align-middle shadow-sm">${levelMap[window.storyState.selectedLevel]}</span>`;
    }
    
    const imgEl = document.getElementById('retelling-image');
    if (imgEl) imgEl.src = scene.imageSrc;

    const overlay = document.getElementById('retelling-start-overlay');
    if (index === 0 && overlay) {
        document.getElementById('retelling-start-time-num').textContent = window.pssSettings.retellingTime;
        overlay.classList.remove('hidden');
        document.getElementById('retelling-transcript-box').textContent = "Press START to begin...";
        window.perfectedSentences.clear(); // Retelling用にクリア
    }
}

document.getElementById('btn-start-retelling')?.addEventListener('click', () => {
    document.getElementById('retelling-start-overlay').classList.add('hidden');
    document.getElementById('retelling-recording-indicator').classList.remove('hidden');
    document.getElementById('btn-next-retelling').classList.remove('hidden');
    document.getElementById('retelling-transcript-box').textContent = "";
    
    if (typeof startSpeech === 'function') { startSpeech(); window.isRecording = true; window.micState = 'listening'; }
    startRetellingTimer();
});

document.getElementById('btn-next-retelling')?.addEventListener('click', advanceRetellingScene);
document.getElementById('btn-finish-retelling')?.addEventListener('click', finishStoryRetelling);

function advanceRetellingScene() {
    clearInterval(window.retellingTimer);
    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        loadRetellingScene(window.storyState.currentSceneIndex);
        startRetellingTimer();
    } else {
        window.isRecording = false; window.micState = 'idle';
        if (typeof stopSpeech === 'function') stopSpeech();
        document.getElementById('retelling-recording-indicator').classList.add('hidden');
        document.getElementById('btn-next-retelling').classList.add('hidden');
        document.getElementById('retelling-finish-overlay').classList.remove('hidden');
        document.getElementById('retelling-finish-overlay').classList.add('flex');
    }
}

function startRetellingTimer() {
    window.timeLeft = window.pssSettings.retellingTime; 
    const timerText = document.getElementById('retelling-timer-text');
    const timerBar = document.getElementById('retelling-timer-bar');

    timerText.textContent = `${window.timeLeft}s`;
    timerBar.style.width = '100%'; timerBar.style.transition = 'none';
    
    setTimeout(() => {
        timerBar.style.transition = `width ${window.pssSettings.retellingTime}s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    window.retellingTimer = setInterval(() => {
        window.timeLeft--; timerText.textContent = `${window.timeLeft}s`;
        if (window.timeLeft <= 0) advanceRetellingScene();
    }, 1000);
}

// ==========================================
// リザルト生成 (Retelling完了時)
// ==========================================
function finishStoryRetelling() {
    window.isRecording = false; window.micState = 'idle'; if (typeof stopSpeech === 'function') stopSpeech();
    
    const fullTranscript = window.storyState.retellingTranscripts.join(" ").trim();
    const spokenWordsRaw = fullTranscript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
    const spokenSet = new Set(spokenWordsRaw);
    
    let allTargets = [];
    let clearedTargets = [];
    let missedTargets = [];
    const level = window.storyState.selectedLevel;

    window.storyState.currentStory.scenes.forEach(scene => {
        const levelData = scene.levels ? scene.levels[level] : scene;
        if(levelData.targets) {
            levelData.targets.forEach(t => {
                allTargets.push(t);
                const targetWords = t.text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
                const isMatch = targetWords.every(w => spokenSet.has(w));
                if (isMatch) clearedTargets.push(t);
                else missedTargets.push(t);
            });
        }
    });

    const completionRate = allTargets.length === 0 ? 0 : Math.floor((clearedTargets.length / allTargets.length) * 100);
    const totalWords = fullTranscript.split(/\s+/).filter(w=>w).length;
    const wpm = Math.round(totalWords / ( (window.pssSettings.retellingTime * 4) / 60) ); // 設定秒数に基づいて計算

    const container = document.getElementById('story-ranking-container');
    if (container && typeof window.createFeedbackSection === 'function') {
        let html = `
            <div class="flex flex-col lg:flex-row gap-4 md:gap-6 h-full w-full">
                <div class="w-full lg:w-1/3 flex flex-col gap-3 md:gap-4 shrink-0 lg:h-full lg:overflow-hidden pb-4 lg:pb-0">
                    <div class="bg-white rounded-3xl p-4 flex flex-col items-center shadow-md border border-gray-100">
                        <span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">Total Words</span>
                        <span class="text-4xl font-black text-gray-900">${totalWords}</span>
                    </div>
                    <div class="bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl p-6 flex flex-col items-center shadow-md text-white">
                        <span class="text-white/80 font-extrabold text-xs tracking-widest mb-1 uppercase">Story Completion</span>
                        <span class="text-6xl font-black">${completionRate}<span class="text-3xl">%</span></span>
                    </div>
                    <div class="bg-white rounded-3xl p-4 flex flex-col items-center shadow-md border border-gray-100">
                        <span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">Story WPM</span>
                        <span class="text-4xl font-black text-gray-900">${wpm}</span>
                    </div>
                    <div class="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col shadow-inner flex-1 lg:overflow-y-auto">
                        <span class="text-gray-400 font-extrabold text-xs tracking-widest mb-2 block uppercase">Full Transcript</span>
                        <div class="text-base font-medium text-gray-700 leading-relaxed">${fullTranscript || "No words recorded."}</div>
                    </div>
                </div>

                <div class="w-full lg:w-2/3 flex flex-col md:flex-row gap-4 lg:h-full lg:overflow-hidden">
                    <div class="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col lg:overflow-hidden lg:h-full">
                        <div class="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0"><h3 class="text-base font-black text-gray-700">💡 MISSED TARGETS</h3></div>
                        <div class="p-4 lg:overflow-y-auto flex-1">
                            ${window.createFeedbackSection('Expressions', missedTargets, 'word', false) || '<p class="text-gray-400 font-bold text-center py-4">全てクリア！</p>'}
                        </div>
                    </div>
                    <div class="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col lg:overflow-hidden lg:h-full">
                        <div class="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between shrink-0"><h3 class="text-base font-black text-blue-800">✨ CLEARED</h3></div>
                        <div class="p-4 lg:overflow-y-auto flex-1">
                            ${window.createFeedbackSection('Expressions', clearedTargets, 'word', true) || '<p class="text-gray-400 font-bold text-center py-4">まだありません</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    showStoryView(viewResultStory);
}

window.addEventListener('DOMContentLoaded', initStoryApp);