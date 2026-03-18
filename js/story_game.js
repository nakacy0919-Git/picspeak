// js/story_game.js
// ==========================================
// PSS専用 ゲーム進行・タイマー・状態遷移コントローラー
// ==========================================

// --- モード選択 ---
window.openStoryModeSelect = function(storyId) {
    window.storyState.currentStoryId = storyId;
    const modal = document.getElementById('story-mode-modal');
    if(modal) modal.classList.remove('hidden');
};

document.getElementById('btn-close-story-mode')?.addEventListener('click', () => {
    const modal = document.getElementById('story-mode-modal');
    if(modal) modal.classList.add('hidden');
});

window.selectStoryMode = function(mode) {
    const modal = document.getElementById('story-mode-modal');
    if(modal) modal.classList.add('hidden');
    window.storyState.playMode = mode;
    window.storyState.currentStory = window.storyList.find(s => s.id === window.storyState.currentStoryId);
    window.storyState.currentSceneIndex = 0;
    
    const nextBtn = document.getElementById('btn-next-retelling');
    if(nextBtn) nextBtn.classList.add('hidden');

    if (mode === 'reading') {
        window.storyState.phase = 'reading';
        window.storyState.readingTranscripts = ["", "", "", ""];
        window.loadReadingScene(0);
        if(typeof showStoryView === 'function') showStoryView(document.getElementById('view-reading'));
    } else if (mode === 'retelling') {
        window.storyState.phase = 'retelling';
        window.storyState.retellingTranscripts = ["", "", "", ""];
        const finishOverlay = document.getElementById('retelling-finish-overlay');
        const startOverlay = document.getElementById('retelling-start-overlay');
        if(finishOverlay) finishOverlay.classList.add('hidden');
        if(startOverlay) startOverlay.classList.remove('hidden');
        window.loadRetellingScene(0); 
        if(typeof showStoryView === 'function') showStoryView(document.getElementById('view-retelling'));
    }
};

// --- Reading Practice モード進行 ---
window.loadReadingScene = function(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    const levelData = scene.levels ? scene.levels[level] : scene; 
    
    window.setMicState('idle');
    speechSynthesis.cancel();
    if(typeof updateTTSButtonUI === 'function') updateTTSButtonUI();
    window.perfectedSentences.clear();
    
    const sceneBadge = document.getElementById('reading-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-blue-600 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-blue-100 rounded-lg text-blue-600 align-middle shadow-sm border border-blue-200">${window.levelMap[level]}</span>`;
    }
    
    const content = document.getElementById('reading-text-content');
    if(content) content.innerHTML = levelData.readingText || "Text not found.";
    
    const jaText = document.getElementById('reading-text-ja');
    if(jaText) jaText.textContent = levelData.readingJa || "日本語訳はありません。";
    
    const acc = document.getElementById('reading-accuracy');
    if(acc) acc.textContent = "0%";
    
    const transcriptBox = document.getElementById('reading-transcript');
    if(transcriptBox) {
        transcriptBox.textContent = "下の「START」ボタンを押して、英語を読んでみましょう！";
        transcriptBox.className = "flex-1 overflow-y-auto text-gray-400 font-bold italic leading-relaxed pt-1 transition-all";
    }
    
    const jaContainer = document.getElementById('ja-container');
    if(jaContainer) jaContainer.classList.add('hidden');
    
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
    if (btnNext) {
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
};

document.getElementById('btn-next-scene')?.addEventListener('click', () => {
    window.setMicState('idle');
    speechSynthesis.cancel();
    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        window.loadReadingScene(window.storyState.currentSceneIndex);
    } else {
        if(typeof showStoryView === 'function') showStoryView(document.getElementById('view-select'));
    }
});

// --- マイク状態(State Machine)制御 ---
window.setMicState = function(state) {
    window.micState = state;
    const btn = document.getElementById('btn-start-reading');
    const transcriptBox = document.getElementById('reading-transcript');
    if (!btn || !transcriptBox) return;
    
    if (state === 'listening') {
        window.isRecording = true;
        if(typeof startSpeech === 'function') startSpeech();
        btn.innerHTML = '<span class="animate-pulse">🔴</span> Listening...';
        btn.className = "flex-1 px-4 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 bg-red-50 text-red-600 border-2 border-red-200 shadow-inner";
        transcriptBox.className = "flex-1 overflow-y-auto text-gray-800 font-bold leading-relaxed pt-1 transition-all";
        if(transcriptBox.textContent.includes("START")) transcriptBox.textContent = "聞き取っています...";
    } else if (state === 'paused') {
        window.isRecording = false;
        if(typeof stopSpeech === 'function') stopSpeech();
        btn.innerHTML = '⏸️ PAUSE (再開)';
        btn.className = "flex-1 px-4 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 bg-gray-500 text-white shadow-md";
    } else { // idle
        window.isRecording = false;
        if(typeof stopSpeech === 'function') stopSpeech();
        btn.innerHTML = '🎤 START';
        btn.className = "flex-1 px-4 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all active:scale-95 flex justify-center items-center gap-2 bg-red-500 hover:bg-red-400 text-white shadow-md";
    }
};

document.getElementById('btn-start-reading')?.addEventListener('click', () => {
    speechSynthesis.cancel(); 
    if(typeof updateTTSButtonUI === 'function') updateTTSButtonUI();
    if (window.micState === 'idle' || window.micState === 'paused') window.setMicState('listening');
    else window.setMicState('paused');
});

// --- Retelling Practice モード進行 ---
window.loadRetellingScene = function(index) {
    const scene = window.storyState.currentStory.scenes[index];
    const level = window.storyState.selectedLevel;
    const sceneBadge = document.getElementById('retelling-scene-badge');
    if (sceneBadge) {
        sceneBadge.innerHTML = `Scene <span class="text-2xl text-pink-400 mx-1">${index + 1}</span> / 4 <span class="text-xs md:text-sm ml-3 px-3 py-1 bg-pink-100 rounded-lg text-pink-600 align-middle shadow-sm">${window.levelMap[level]}</span>`;
    }
    
    const imgEl = document.getElementById('retelling-image');
    if (imgEl) imgEl.src = scene.imageSrc;

    const overlay = document.getElementById('retelling-start-overlay');
    if (index === 0 && overlay) {
        const sn = document.getElementById('retelling-start-scene-num');
        if(sn) sn.textContent = `Scene 1`;
        const tn = document.getElementById('retelling-start-time-num');
        if(tn) tn.textContent = window.pssSettings.retellingTime;
        overlay.classList.remove('hidden');
        const box = document.getElementById('retelling-transcript-box');
        if(box) box.textContent = "Press START to begin...";
        window.perfectedSentences.clear(); 
    }
};

document.getElementById('btn-start-retelling')?.addEventListener('click', () => {
    const overlay = document.getElementById('retelling-start-overlay');
    if(overlay) overlay.classList.add('hidden');
    const ind = document.getElementById('retelling-recording-indicator');
    if(ind) ind.classList.remove('hidden');
    const nextBtn = document.getElementById('btn-next-retelling');
    if(nextBtn) nextBtn.classList.remove('hidden');
    const box = document.getElementById('retelling-transcript-box');
    if(box) box.textContent = "";
    
    if (typeof startSpeech === 'function') { startSpeech(); window.isRecording = true; window.micState = 'listening'; }
    window.startRetellingTimer();
});

document.getElementById('btn-next-retelling')?.addEventListener('click', () => {
    window.advanceRetellingScene();
});

document.getElementById('btn-finish-retelling')?.addEventListener('click', () => {
    if(typeof finishStoryRetelling === 'function') finishStoryRetelling();
});

window.advanceRetellingScene = function() {
    clearInterval(window.retellingTimer);
    if (window.storyState.currentSceneIndex < 3) {
        window.storyState.currentSceneIndex++;
        window.loadRetellingScene(window.storyState.currentSceneIndex);
        window.startRetellingTimer();
    } else {
        window.isRecording = false; window.micState = 'idle';
        if (typeof stopSpeech === 'function') stopSpeech();
        const ind = document.getElementById('retelling-recording-indicator');
        if(ind) ind.classList.add('hidden');
        const nextBtn = document.getElementById('btn-next-retelling');
        if(nextBtn) nextBtn.classList.add('hidden');
        const finOverlay = document.getElementById('retelling-finish-overlay');
        if(finOverlay) {
            finOverlay.classList.remove('hidden');
            finOverlay.classList.add('flex');
        }
    }
};

window.startRetellingTimer = function() {
    window.timeLeft = window.pssSettings.retellingTime; 
    const timerText = document.getElementById('retelling-timer-text');
    const timerBar = document.getElementById('retelling-timer-bar');

    if(timerText) timerText.textContent = `${window.timeLeft}s`;
    if(timerBar) {
        timerBar.style.width = '100%'; 
        timerBar.style.transition = 'none';
        setTimeout(() => {
            timerBar.style.transition = `width ${window.pssSettings.retellingTime}s linear, background-color 0.5s ease`;
            timerBar.style.width = '0%';
        }, 50);
    }

    window.retellingTimer = setInterval(() => {
        window.timeLeft--; 
        if(timerText) timerText.textContent = `${window.timeLeft}s`;
        if (window.timeLeft <= 0) window.advanceRetellingScene();
    }, 1000);
};