// js/story_main.js
// ==========================================
// Story Mode 専用の メインシステム（Reading & Retelling制御）
// ==========================================

window.storyState = { 
    selectedLevel: 'junior_high',
    currentStoryId: null,
    currentStory: null,
    currentSceneIndex: 0,
    playMode: null, 
    phase: 'select', 
    isPracticeMode: false,
    practiceTargetText: "",
    practiceRawTranscript: "",
    readingTranscripts: ["", "", "", ""], 
    retellingTranscripts: ["", "", "", ""]
};

const levelMap = {
    'elementary': '小学生',
    'junior_high': '中学生',
    'high_school': '高校生'
};

window.isRecording = false;
window.storyList = [];
window.retellingTimer = null;
window.timeLeft = 20;
window.isTTSPlaying = false;
window.currentUtterance = null;

const viewSelect = document.getElementById('view-select');
const viewReading = document.getElementById('view-reading');
const viewRetelling = document.getElementById('view-retelling');
const viewResultStory = document.getElementById('view-result-story');
const storyModeModal = document.getElementById('story-mode-modal');

async function initStoryApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("お使いのブラウザは音声認識に非対応です。"); return; 
    }
    
    window.handleSpeechResult = handleStorySpeechResult;
    window.handleSpeechEnd = handleStorySpeechEnd;

    if(typeof initSpeechRecognition === 'function') {
        initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    }

    const savedLevel = localStorage.getItem('picSpeakSelectedLevel');
    if (savedLevel) window.storyState.selectedLevel = savedLevel;

    initResizers();
    initFontSizeSlider();

    await fetchStoryData();
}

async function fetchStoryData() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-xl md:text-2xl">Loading Stories...</div>';

    try {
        const response = await fetch('data/story_list.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("story_list.jsonが見つかりません");
        const storyIds = await response.json();

        const fetchPromises = storyIds.map(id => 
            fetch(`data/stories/${id}.json?t=${new Date().getTime()}`)
            .then(res => res.ok ? res.json() : null)
            .catch(e => null)
        );
        
        const results = await Promise.all(fetchPromises);
        window.storyList = results.filter(data => data !== null);
        
        if (window.storyList.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10">ストーリーがありません。</div>';
            return;
        }
        renderStoryGrid();
    } catch (error) {
        console.error("ストーリーデータの読み込み失敗:", error);
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading stories</div>';
    }
}

function renderStoryGrid() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    let html = '';
    window.storyList.forEach(story => {
        html += `<div class="theme-card cursor-pointer rounded-3xl overflow-hidden shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" onclick="openStoryModeSelect('${story.id}')">
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
    
    try {
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
    } catch (e) {}

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
        document.getElementById('retelling-finish-overlay')?.classList.remove('flex');
        document.getElementById('retelling-start-overlay')?.classList.remove('hidden');
        loadRetellingScene(0); 
        showStoryView(viewRetelling);
    }
};

// ==========================================
// UI機能 (リサイズ ＆ フォントサイズ)
// ==========================================
function initFontSizeSlider() {
    const slider = document.getElementById('font-size-slider');
    const textContent = document.getElementById('reading-text-content');
    if (!slider || !textContent) return;

    const savedSize = localStorage.getItem('pss-font-size');
    if (savedSize) {
        slider.value = savedSize;
        textContent.style.fontSize = `${savedSize}px`;
    }

    slider.addEventListener('input', (e) => {
        const size = e.target.value;
        textContent.style.fontSize = `${size}px`;
        localStorage.setItem('pss-font-size', size);
    });
}

function initResizers() {
    const container = document.getElementById('reading-panes-container');
    const rightContainer = document.getElementById('right-container');
    const paneImage = document.getElementById('pane-image');
    const paneText = document.getElementById('pane-text');
    const resizer1 = document.getElementById('resizer-1');
    const resizer2 = document.getElementById('resizer-2');
    if (!container || !rightContainer || !paneImage || !paneText || !resizer1 || !resizer2) return;

    const savedSizes = JSON.parse(localStorage.getItem('pss-pane-sizes-v3')) || { imgP: 40, textP: 50 };
    paneImage.style.flexBasis = `${savedSizes.imgP}%`;
    paneText.style.flexBasis = `${savedSizes.textP}%`;

    let isResizing = false;
    let currentResizer = null;
    let startPos = 0;
    let startBasisPrev = 0;

    const onStart = (e, resizer) => {
        isResizing = true;
        currentResizer = resizer;
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
        } else if (resizer.id === 'resizer-2') {
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
        const isPC = window.innerWidth >= 768;
        const isTouch = e.type.includes('touch');

        if (currentResizer.id === 'resizer-1') {
            if (isPC) {
                const currentX = isTouch ? e.touches[0].clientX : e.clientX;
                const deltaX = currentX - startPos;
                const deltaPercent = (deltaX / container.getBoundingClientRect().width) * 100;
                let newBasis = startBasisPrev + deltaPercent;
                if (newBasis > 10 && newBasis < 80) paneImage.style.flexBasis = `${newBasis}%`;
            } else {
                const currentY = isTouch ? e.touches[0].clientY : e.clientY;
                const deltaY = currentY - startPos;
                const deltaPercent = (deltaY / container.getBoundingClientRect().height) * 100;
                let newBasis = startBasisPrev + deltaPercent;
                if (newBasis > 10 && newBasis < 80) paneImage.style.flexBasis = `${newBasis}%`;
            }
        } else if (currentResizer.id === 'resizer-2') {
            const currentY = isTouch ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startPos;
            const deltaPercent = (deltaY / rightContainer.getBoundingClientRect().height) * 100;
            let newBasis = startBasisPrev + deltaPercent;
            if (newBasis > 10 && newBasis < 80) paneText.style.flexBasis = `${newBasis}%`;
        }
    };

    const onEnd = () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            
            const isPC = window.innerWidth >= 768;
            let imgP;
            if (isPC) {
                imgP = (paneImage.getBoundingClientRect().width / container.getBoundingClientRect().width) * 100;
            } else {
                imgP = (paneImage.getBoundingClientRect().height / container.getBoundingClientRect().height) * 100;
            }
            const textP = (paneText.getBoundingClientRect().height / rightContainer.getBoundingClientRect().height) * 100;
            
            localStorage.setItem('pss-pane-sizes-v3', JSON.stringify({ imgP, textP }));
        }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

// ==========================================
// ★ マイクボタンのUI更新
// ==========================================
function updateMicButtonUI(isRecording) {
    const btn = document.getElementById('btn-start-reading');
    if (!btn) return;
    if (isRecording) {
        btn.innerHTML = '<span class="animate-pulse">🔴</span> Listening...';
        btn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-400', 'shadow-md');
        btn.classList.add('bg-red-50', 'text-red-600', 'border-2', 'border-red-200', 'shadow-inner');
    } else {
        btn.innerHTML = '🎤 START';
        btn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-400', 'shadow-md');
        btn.classList.remove('bg-red-50', 'text-red-600', 'border-2', 'border-red-200', 'shadow-inner');
    }
}

// ==========================================
// Reading Practice (絵本モード)
// ==========================================
function loadReadingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    const levelData = scene.levels ? scene.levels[level] : scene; 
    
    // リセット処理
    updateMicButtonUI(false);
    speechSynthesis.cancel();
    window.isTTSPlaying = false;
    updateTTSButtonUI();
    
    // シーンバッジ
    const sceneBadge = document.getElementById('reading-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-blue-600 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-blue-100 rounded-lg text-blue-600 align-middle shadow-sm border border-blue-200">${levelMap[level]}</span>`;
    }

    // テキスト・画像セット
    document.getElementById('reading-text-content').innerHTML = levelData.readingText || "Text not found.";
    document.getElementById('reading-text-ja').textContent = levelData.readingJa || "日本語訳はありません。";
    document.getElementById('reading-accuracy').textContent = "0%";
    
    const transcriptBox = document.getElementById('reading-transcript');
    transcriptBox.textContent = "下の「START」ボタンを押して、英語を読んでみましょう！";
    transcriptBox.classList.remove('text-green-600', 'text-gray-800');
    transcriptBox.classList.add('text-gray-400', 'italic');
    
    document.getElementById('reading-text-ja').classList.add('hidden');
    const btnToggleJa = document.getElementById('btn-toggle-ja');
    if(btnToggleJa) {
        btnToggleJa.innerHTML = '🇯🇵 訳を表示';
        btnToggleJa.classList.remove('bg-gray-100');
        btnToggleJa.classList.add('bg-white');
    }

    const imgEl = document.getElementById('reading-image');
    if(imgEl) {
        imgEl.src = scene.imageSrc;
        imgEl.onerror = () => { imgEl.src = 'assets/images/icon.png'; };
    }

    // NextボタンのUI
    const btnNext = document.getElementById('btn-next-scene');
    if (index === 3) {
        btnNext.innerHTML = '✨ DONE (リテリングへ)';
        btnNext.classList.replace('bg-blue-600', 'bg-pink-500');
        btnNext.classList.replace('hover:bg-blue-500', 'hover:bg-pink-400');
        btnNext.classList.replace('shadow-blue-200', 'shadow-pink-200');
    } else {
        btnNext.innerHTML = '次のシーンへ ➔';
        btnNext.classList.replace('bg-pink-500', 'bg-blue-600');
        btnNext.classList.replace('hover:bg-pink-400', 'hover:bg-blue-500');
        btnNext.classList.replace('shadow-pink-200', 'shadow-blue-200');
    }
}

document.getElementById('btn-toggle-ja')?.addEventListener('click', (e) => {
    const jaArea = document.getElementById('reading-text-ja');
    const btn = e.currentTarget;
    if (jaArea.classList.contains('hidden')) {
        jaArea.classList.remove('hidden');
        btn.innerHTML = '🇯🇵 訳を隠す';
        btn.classList.remove('bg-white');
        btn.classList.add('bg-gray-100');
    } else {
        jaArea.classList.add('hidden');
        btn.innerHTML = '🇯🇵 訳を表示';
        btn.classList.remove('bg-gray-100');
        btn.classList.add('bg-white');
    }
});

// TTS（読み上げ）機能
function updateTTSButtonUI() {
    const icon = document.getElementById('tts-icon');
    const text = document.getElementById('tts-text');
    if(icon && text) {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            icon.textContent = '⏸';
            text.textContent = '一時停止';
        } else {
            icon.textContent = '▶';
            text.textContent = 'お手本';
        }
    }
}

function playCurrentTTS() {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    const scene = window.storyState.currentStory.scenes[idx];
    const levelData = scene.levels ? scene.levels[level] : scene;
    const targetText = levelData.readingText.replace(/<[^>]*>?/gm, '');

    window.currentUtterance = new SpeechSynthesisUtterance(targetText);
    window.currentUtterance.lang = 'en-US';
    window.currentUtterance.onend = () => { updateTTSButtonUI(); };
    speechSynthesis.speak(window.currentUtterance);
    updateTTSButtonUI();
}

document.getElementById('btn-read-aloud')?.addEventListener('click', () => {
    if (speechSynthesis.speaking) {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        } else {
            speechSynthesis.pause();
        }
    } else {
        playCurrentTTS();
    }
    setTimeout(updateTTSButtonUI, 50); 
});

document.getElementById('btn-tts-rewind')?.addEventListener('click', () => {
    speechSynthesis.cancel();
    setTimeout(() => { playCurrentTTS(); }, 100);
});

document.getElementById('btn-next-scene')?.addEventListener('click', () => {
    window.isRecording = false;
    updateMicButtonUI(false);
    speechSynthesis.cancel();
    if (typeof stopSpeech === 'function') stopSpeech();

    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        loadReadingScene(window.storyState.currentSceneIndex);
    } else {
        showStoryView(viewSelect);
    }
});

document.getElementById('btn-start-reading')?.addEventListener('click', () => {
    if (typeof startSpeech === 'function') {
        speechSynthesis.cancel(); 
        updateTTSButtonUI();
        startSpeech();
        window.isRecording = true;
        updateMicButtonUI(true); // 録音中UIに変更
        
        const transcriptBox = document.getElementById('reading-transcript');
        transcriptBox.innerHTML = "聞き取っています...";
        transcriptBox.classList.remove('italic', 'text-gray-400');
        transcriptBox.classList.add('text-gray-800');
    }
});

// ==========================================
// 音声認識ハンドラ
// ==========================================
function handleStorySpeechResult(finalText, interimText) {
    if (window.storyState.isPracticeMode) {
        if (finalText.trim().length > 0) window.storyState.practiceRawTranscript += finalText + " ";
        const currentTempText = window.storyState.practiceRawTranscript + interimText;
        
        if(typeof window.processPracticeDiff === 'function') {
            const diffResult = window.processPracticeDiff(currentTempText, window.storyState.practiceTargetText); 
            document.getElementById('practice-transcript').innerHTML = diffResult.html || "Listening...";
            if (diffResult.isPerfect) {
                document.getElementById('practice-feedback').innerHTML = '<span class="text-green-500 text-4xl font-black">Perfect! ✨</span>';
                document.getElementById('practice-feedback').classList.remove('hidden');
                if (typeof playSound === 'function') playSound('practice_perfect');
                window.isRecording = false;
                if (typeof stopSpeech === 'function') stopSpeech();
            }
        }
        return;
    }

    const idx = window.storyState.currentSceneIndex;

    // Retelling処理
    if (window.storyState.phase === 'retelling') {
        if (finalText.trim().length > 0) window.storyState.retellingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.retellingTranscripts[idx] + interimText;
        
        let allText = "";
        for(let i=0; i<idx; i++){ allText += window.storyState.retellingTranscripts[i] + " "; }
        allText += currentTempText;
        
        const box = document.getElementById('retelling-transcript-box');
        if(box) {
            box.textContent = allText;
            box.scrollTop = box.scrollHeight;
        }
        return;
    }

    // Reading処理 (紫色ハイライト)
    if (window.storyState.phase === 'reading') {
        if (finalText.trim().length > 0) window.storyState.readingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.readingTranscripts[idx] + interimText;
        
        const level = window.storyState.selectedLevel;
        const scene = window.storyState.currentStory.scenes[idx];
        const levelData = scene.levels ? scene.levels[level] : scene;
        
        const targetHTML = levelData.readingText;
        const targetText = targetHTML.replace(/<[^>]*>?/gm, '');
        
        const targetWords = targetText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w);
        const spokenWords = currentTempText.split(/\s+/);
        
        let matchCount = 0;
        const spokenSetLower = new Set(spokenWords.map(w => w.replace(/[.,!?]/g, '').toLowerCase()).filter(w=>w));
        
        targetWords.forEach(w => { if(spokenSetLower.has(w)) matchCount++; });
        
        let accuracy = Math.floor((matchCount / targetWords.length) * 100);
        if (accuracy > 100) accuracy = 100;
        
        const accuracyEl = document.getElementById('reading-accuracy');
        accuracyEl.textContent = `${accuracy}%`;

        if (accuracy === 100 && !accuracyEl.classList.contains('text-pink-500')) {
            accuracyEl.classList.remove('text-green-500');
            accuracyEl.classList.add('text-pink-500', 'animate-pulse');
            if (typeof playSound === 'function') playSound('perfect');
        }

        const targetWordsForMatch = new Set(targetWords);
        const htmlTranscript = spokenWords.map(w => {
            const cleanW = w.replace(/[.,!?]/g, '').toLowerCase();
            if (cleanW && !targetWordsForMatch.has(cleanW)) {
                return `<span class="text-purple-600 font-bold underline decoration-purple-300" title="本文にない単語">${w}</span>`;
            }
            return w;
        }).join(" ");
        
        document.getElementById('reading-transcript').innerHTML = htmlTranscript || "聞き取っています...";
    }
}

function handleStorySpeechEnd() {
    if (window.isRecording && typeof startSpeech === 'function') {
        try { startSpeech(); } catch(e) { console.error("Mic restart failed:", e); }
    } else {
        window.isRecording = false;
        updateMicButtonUI(false); // UIを元に戻す
    }
}

// ==========================================
// Retelling Practice (20秒×4枚 リテリングモード)
// ==========================================
function loadRetellingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    
    const sceneBadge = document.getElementById('retelling-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-pink-400 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-pink-100 rounded-lg text-pink-600 align-middle shadow-sm">${levelMap[level]}</span>`;
    }
    
    const imgEl = document.getElementById('retelling-image');
    if(imgEl) {
        imgEl.src = scene.imageSrc;
        imgEl.onerror = () => { imgEl.src = 'assets/images/icon.png'; };
    }

    const overlay = document.getElementById('retelling-start-overlay');
    if (index === 0 && overlay) {
        overlay.classList.remove('hidden');
        document.getElementById('retelling-transcript-box').textContent = "Press START to begin...";
    }
}

document.getElementById('btn-start-retelling')?.addEventListener('click', () => {
    const overlay = document.getElementById('retelling-start-overlay');
    if(overlay) overlay.classList.add('hidden');
    
    document.getElementById('retelling-recording-indicator').classList.remove('hidden');
    document.getElementById('btn-next-retelling').classList.remove('hidden');
    document.getElementById('retelling-transcript-box').textContent = "";
    
    if (typeof startSpeech === 'function') {
        startSpeech();
        window.isRecording = true;
    }
    startRetellingTimer();
});

document.getElementById('btn-next-retelling')?.addEventListener('click', () => {
    advanceRetellingScene();
});

document.getElementById('btn-finish-retelling')?.addEventListener('click', () => {
    finishStoryRetelling();
});

function advanceRetellingScene() {
    clearInterval(window.retellingTimer);
    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        loadRetellingScene(window.storyState.currentSceneIndex);
        startRetellingTimer();
    } else {
        window.isRecording = false;
        if (typeof stopSpeech === 'function') stopSpeech();
        document.getElementById('retelling-recording-indicator').classList.add('hidden');
        document.getElementById('btn-next-retelling').classList.add('hidden');
        
        const finishOverlay = document.getElementById('retelling-finish-overlay');
        if (finishOverlay) {
            finishOverlay.classList.remove('hidden');
            finishOverlay.classList.add('flex');
        }
    }
}

function startRetellingTimer() {
    window.timeLeft = 20; 
    const timerText = document.getElementById('retelling-timer-text');
    const timerBar = document.getElementById('retelling-timer-bar');

    timerText.textContent = `${window.timeLeft}s`;
    timerBar.style.width = '100%'; 
    timerBar.style.transition = 'none';
    
    setTimeout(() => {
        timerBar.style.transition = `width 20s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    window.retellingTimer = setInterval(() => {
        window.timeLeft--;
        timerText.textContent = `${window.timeLeft}s`;

        if (window.timeLeft <= 0) {
            advanceRetellingScene();
        }
    }, 1000);
}

// ==========================================
// リザルト生成 (Retelling完了時)
// ==========================================
function finishStoryRetelling() {
    window.isRecording = false;
    if (typeof stopSpeech === 'function') stopSpeech();
    
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
    const wpm = Math.round(totalWords / (80 / 60));

    const container = document.getElementById('story-ranking-container');
    if (container && typeof window.createFeedbackSection === 'function') {
        let html = `
            <div class="flex flex-col lg:flex-row gap-4 md:gap-6 h-full w-full">
                <div class="w-full lg:w-1/3 flex flex-col gap-3 md:gap-4 shrink-0 lg:h-full lg:overflow-hidden pb-4 lg:pb-0">
                    <div class="bg-white rounded-3xl p-4 flex flex-col items-center shadow-md border border-gray-100">
                        <span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">Total Words</span>
                        <span class="text-4xl font-black text-gray-900">${totalWords}</span>
                    </div>
                    <div class="bg-sns-gradient rounded-3xl p-6 flex flex-col items-center shadow-md text-white">
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