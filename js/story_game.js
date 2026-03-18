// js/story_game.js
// ==========================================
// PSS専用 ゲーム進行・タイマー・状態遷移コントローラー
// ==========================================

window.isSupportMode = false; 

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

window.renderReadingText = function() {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    if(!window.storyState.currentStory) return;
    const levelData = window.storyState.currentStory.scenes[idx].levels[level];
    
    if (levelData.vocabulary) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = levelData.readingText || "";
        let html = tempDiv.textContent || tempDiv.innerText || "";

        if (window.isSupportMode) {
            const vocabList = [...levelData.vocabulary].sort((a, b) => b.word.length - a.word.length);
            const replacements = [];
            
            vocabList.forEach((item) => {
                const safeWord = item.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`\\b(${safeWord})\\b`, 'gi');
                
                html = html.replace(regex, (match) => {
                    replacements.push({ match: match, word: item.word, meaning: item.meaning });
                    return `###VOCAB_${replacements.length - 1}###`;
                });
            });

            replacements.forEach((rep, index) => {
                const placeholder = `###VOCAB_${index}###`;
                const spanHtml = `<span class="story-clickable text-blue-600 font-bold border-b-2 border-blue-300 cursor-pointer hover:bg-blue-50 px-1 rounded transition-colors" data-word="${rep.word}" data-meaning="${rep.meaning}">${rep.match}</span>`;
                html = html.replace(new RegExp(placeholder, 'g'), spanHtml);
            });
        }
        const content = document.getElementById('reading-text-content');
        if (content) content.innerHTML = html;

    } else {
        let html = levelData.readingText || "";
        if (!window.isSupportMode) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const spans = tempDiv.querySelectorAll('.story-clickable');
            spans.forEach(span => {
                const text = document.createTextNode(span.textContent);
                span.parentNode.replaceChild(text, span);
            });
            html = tempDiv.innerHTML;
        }
        const content = document.getElementById('reading-text-content');
        if (content) content.innerHTML = html;
    }
};

document.addEventListener('click', (e) => {
    
    const btnJa = e.target.closest('#btn-toggle-ja');
    if (btnJa) {
        const jaArea = document.getElementById('ja-container');
        if (jaArea) {
            if (jaArea.classList.contains('hidden')) {
                jaArea.classList.remove('hidden');
                btnJa.innerHTML = '🇯🇵 訳を隠す';
                btnJa.classList.replace('bg-white', 'bg-gray-100');
            } else {
                jaArea.classList.add('hidden');
                btnJa.innerHTML = '🇯🇵 訳を表示';
                btnJa.classList.replace('bg-gray-100', 'bg-white');
            }
        }
        return;
    }

    const btnSupport = e.target.closest('#btn-toggle-support');
    if (btnSupport) {
        window.isSupportMode = !window.isSupportMode;
        if (window.isSupportMode) {
            btnSupport.innerHTML = '💡 サポートをOFFにする';
            btnSupport.classList.remove('bg-gray-50', 'text-gray-700', 'border-gray-300');
            btnSupport.classList.add('bg-yellow-400', 'text-yellow-900', 'border-yellow-400', 'shadow-inner');
        } else {
            btnSupport.innerHTML = '💡 サポートをONにする';
            btnSupport.classList.remove('bg-yellow-400', 'text-yellow-900', 'border-yellow-400', 'shadow-inner');
            btnSupport.classList.add('bg-gray-50', 'text-gray-700', 'border-gray-300');
            document.getElementById('word-support-popup')?.classList.add('hidden');
        }
        window.renderReadingText();
        return;
    }

    const targetWord = e.target.closest('.story-clickable');
    if (targetWord && window.isSupportMode) {
        const meaning = targetWord.getAttribute('data-meaning') || targetWord.getAttribute('data-ja') || "意味が登録されていません";
        const popup = document.getElementById('word-support-popup');
        
        document.getElementById('support-word-text').textContent = targetWord.textContent;
        document.getElementById('support-word-meaning').textContent = meaning;

        // ★修正: 画面(Viewport)を基準にした絶対座標で配置（はみ出さない）
        const rect = targetWord.getBoundingClientRect();
        const top = rect.top - 10; // 単語の少し上に配置
        const left = rect.left + (rect.width / 2);
        
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.classList.remove('hidden');
        popup.classList.add('flex');

        const pronounceBtn = document.getElementById('btn-support-pronounce');
        if (pronounceBtn) {
            pronounceBtn.onclick = (event) => {
                event.stopPropagation(); // 発音ボタンを押してもポップアップが閉じないようにする
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(targetWord.textContent);
                u.lang = 'en-US';
                u.rate = 0.75;
                if (window.bestEnglishVoice) u.voice = window.bestEnglishVoice;
                speechSynthesis.speak(u);
            };
        }
        return;
    }

    if (window.isSupportMode && !e.target.closest('#word-support-popup')) {
        document.getElementById('word-support-popup')?.classList.add('hidden');
        document.getElementById('word-support-popup')?.classList.remove('flex');
    }
});

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
    
    window.isSupportMode = false;
    const btnSupport = document.getElementById('btn-toggle-support');
    if (btnSupport) {
        btnSupport.innerHTML = '💡 サポートをONにする';
        btnSupport.classList.remove('bg-yellow-400', 'text-yellow-900', 'shadow-inner');
        btnSupport.classList.add('bg-gray-50', 'text-gray-700', 'border-gray-300');
    }
    document.getElementById('word-support-popup')?.classList.add('hidden');
    window.renderReadingText();
    
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
    } else { 
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
    if (imgEl) {
        imgEl.src = scene.imageSrc;
        
        // ★追加: アニメーションのリセットと再発動
        const imgContainer = imgEl.parentElement;
        imgContainer.classList.remove('animate-scene-change');
        void imgContainer.offsetWidth; // 強制リフロー（アニメーションを再起動する魔法のコード）
        imgContainer.classList.add('animate-scene-change');
        
        // ★追加: 効果音を鳴らす
        if(typeof playSyntheticSound === 'function') playSyntheticSound('transition');
    }

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