// js/story_main.js
// ==========================================
// Story Mode 専用の メインシステム（Reading & Retelling制御）
// ==========================================

window.storyState = { 
    selectedLevel: 'junior_high', // 初期値
    currentStoryId: null,
    currentStory: null,
    currentSceneIndex: 0,
    playMode: null, // 'reading' or 'retelling'
    phase: 'select', 
    isPracticeMode: false,
    practiceTargetText: "",
    practiceRawTranscript: "",
    readingTranscripts: ["", "", "", ""], 
    retellingTranscripts: ["", "", "", ""]
};

// レベル表示用の日本語マッピング
const levelMap = {
    'elementary': '小学生',
    'junior_high': '中学生',
    'high_school': '高校生'
};

window.isRecording = false;
window.storyList = [];
window.retellingTimer = null;
window.timeLeft = 20;

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

    // index.htmlから渡されたレベル情報を読み込む
    const savedLevel = localStorage.getItem('picSpeakSelectedLevel');
    if (savedLevel) {
        window.storyState.selectedLevel = savedLevel;
    }

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
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10">ストーリーがありません。JSONデータを確認してください。</div>';
            return;
        }

        renderStoryGrid();
    } catch (error) {
        console.error("ストーリーデータの読み込み失敗:", error);
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading stories<br><span class="text-sm font-medium text-gray-500">dataフォルダ内のJSON設定を確認してください</span></div>';
    }
}

function renderStoryGrid() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    let html = '';
    window.storyList.forEach(story => {
        html += `<div class="theme-card cursor-pointer rounded-2xl md:rounded-3xl overflow-hidden shadow-md border-4 border-transparent hover:border-blue-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" onclick="openStoryModeSelect('${story.id}')">
            <div class="relative w-full aspect-video bg-gray-100 shrink-0">
                <img src="${story.imageSrc}" onerror="this.src='assets/images/icon.png'" class="absolute inset-0 w-full h-full object-cover">
            </div>
            <div class="p-4 text-center text-sm md:text-lg font-black text-gray-700 border-t border-gray-100">${story.titleJa}</div>
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
// Reading Practice (絵本モード)
// ==========================================
function loadReadingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    const levelData = scene.levels ? scene.levels[level] : scene; 
    
    // ★UIアップデート: 現在のレベルを画面に明記する
    const sceneBadge = document.getElementById('reading-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `${index + 1} / 4 <span class="text-xs md:text-sm ml-2 px-2 py-0.5 bg-blue-100 rounded-lg text-blue-600 align-middle">${levelMap[level]}</span>`;
    }

    document.getElementById('reading-text-content').innerHTML = levelData.readingText;
    document.getElementById('reading-text-ja').textContent = levelData.readingJa || "日本語訳はありません。";
    document.getElementById('reading-accuracy').textContent = "0%";
    document.getElementById('reading-transcript').textContent = "Tap START and read the text.";
    document.getElementById('reading-transcript').classList.remove('text-green-600', 'text-gray-800');
    document.getElementById('reading-transcript').classList.add('text-blue-800', 'italic');
    
    document.getElementById('reading-text-ja').classList.add('hidden');
    const btnToggleJa = document.getElementById('btn-toggle-ja');
    if(btnToggleJa) {
        btnToggleJa.innerHTML = '🇯🇵 訳を表示';
        btnToggleJa.classList.remove('bg-gray-200');
        btnToggleJa.classList.add('bg-white');
    }

    const imgEl = document.getElementById('reading-image');
    if(imgEl) {
        imgEl.src = scene.imageSrc;
        imgEl.onerror = () => { imgEl.src = 'assets/images/icon.png'; };
    }

    const btnNext = document.getElementById('btn-next-scene');
    if (index === 3) {
        btnNext.innerHTML = 'DONE';
        btnNext.classList.replace('bg-gray-800', 'bg-pink-500');
    } else {
        btnNext.innerHTML = '▶';
        btnNext.classList.replace('bg-pink-500', 'bg-gray-800');
    }
}

document.getElementById('btn-toggle-ja')?.addEventListener('click', (e) => {
    const jaArea = document.getElementById('reading-text-ja');
    const btn = e.currentTarget;
    if (jaArea.classList.contains('hidden')) {
        jaArea.classList.remove('hidden');
        btn.innerHTML = '🇯🇵 訳を隠す';
        btn.classList.remove('bg-white');
        btn.classList.add('bg-gray-200');
    } else {
        jaArea.classList.add('hidden');
        btn.innerHTML = '🇯🇵 訳を表示';
        btn.classList.remove('bg-gray-200');
        btn.classList.add('bg-white');
    }
});

document.getElementById('btn-read-aloud')?.addEventListener('click', () => {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    const scene = window.storyState.currentStory.scenes[idx];
    const levelData = scene.levels ? scene.levels[level] : scene;
    
    const targetHTML = levelData.readingText;
    const targetText = targetHTML.replace(/<[^>]*>?/gm, '');
    
    if (typeof window.playTTS === 'function') {
        window.playTTS(targetText);
    } else {
        const ut = new SpeechSynthesisUtterance(targetText);
        ut.lang = 'en-US';
        speechSynthesis.speak(ut);
    }
});

document.getElementById('btn-next-scene')?.addEventListener('click', () => {
    window.isRecording = false;
    if (typeof stopSpeech === 'function') stopSpeech();

    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        loadReadingScene(window.storyState.currentSceneIndex);
    } else {
        alert("Reading Practice 完了！次は「Retelling」に挑戦してみましょう！");
        showStoryView(viewSelect);
    }
});

document.getElementById('btn-start-reading')?.addEventListener('click', () => {
    if (typeof startSpeech === 'function') {
        startSpeech();
        window.isRecording = true;
        document.getElementById('reading-transcript').textContent = "Listening...";
        document.getElementById('reading-transcript').classList.remove('italic', 'text-blue-800');
        document.getElementById('reading-transcript').classList.add('text-gray-800');
    }
});

// ==========================================
// Retelling Practice (20秒×4枚 リテリングモード)
// ==========================================
function loadRetellingScene(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    
    // ★UIアップデート: 現在のレベルを画面に明記する
    const sceneBadge = document.getElementById('retelling-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `${index + 1} / 4 <span class="text-xs md:text-sm ml-2 px-2 py-0.5 bg-pink-100 rounded-lg text-pink-600 align-middle">${levelMap[level]}</span>`;
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

    if (window.storyState.phase === 'reading') {
        if (finalText.trim().length > 0) window.storyState.readingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.readingTranscripts[idx] + interimText;
        
        document.getElementById('reading-transcript').textContent = currentTempText;

        const level = window.storyState.selectedLevel;
        const scene = window.storyState.currentStory.scenes[idx];
        const levelData = scene.levels ? scene.levels[level] : scene;
        
        const targetHTML = levelData.readingText;
        const targetText = targetHTML.replace(/<[^>]*>?/gm, '');
        
        const targetWords = targetText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w);
        const spokenWords = currentTempText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w);
        
        let matchCount = 0;
        const spokenSet = new Set(spokenWords);
        targetWords.forEach(w => { if(spokenSet.has(w)) matchCount++; });
        
        let accuracy = Math.floor((matchCount / targetWords.length) * 100);
        if (accuracy > 100) accuracy = 100;
        
        const accuracyEl = document.getElementById('reading-accuracy');
        accuracyEl.textContent = `${accuracy}%`;

        if (accuracy === 100 && !accuracyEl.classList.contains('text-pink-500')) {
            accuracyEl.classList.remove('text-green-500');
            accuracyEl.classList.add('text-pink-500', 'animate-pulse');
            if (typeof playSound === 'function') playSound('perfect');
        }
    }
}

function handleStorySpeechEnd() {
    if (window.isRecording && typeof startSpeech === 'function') {
        try { startSpeech(); } catch(e) { console.error("Mic restart failed:", e); }
    } else {
        window.isRecording = false;
    }
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