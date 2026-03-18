// js/story_scoring.js
// ==========================================
// PSS専用 採点・判定・リザルト生成エンジン
// ==========================================

// リアルタイム音声認識時の判定とハイライト処理
function handleStorySpeechResult(finalText, interimText) {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    if(!window.storyState.currentStory) return;
    const levelData = window.storyState.currentStory.scenes[idx].levels[window.storyState.selectedLevel];

    // --- Retelling処理 (リアルタイム色付け) ---
    if (window.storyState.phase === 'retelling') {
        if (finalText.trim().length > 0) window.storyState.retellingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.retellingTranscripts[idx] + interimText;
        
        let allText = "";
        for(let i=0; i<idx; i++){ allText += window.storyState.retellingTranscripts[i] + " "; }
        allText += currentTempText;

        let targetWords = [];
        if(levelData.targets) {
            levelData.targets.forEach(t => {
                const words = t.text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
                targetWords = targetWords.concat(words);
            });
        }
        const targetSet = new Set(targetWords);
        
        const htmlText = allText.split(/\s+/).map(w => {
            const cleanW = w.toLowerCase().replace(/[.,!?]/g, '');
            if(targetSet.has(cleanW)) {
                if(!window.perfectedSentences.has(cleanW)) { 
                    if(typeof playSyntheticSound === 'function') playSyntheticSound('match'); 
                    window.perfectedSentences.add(cleanW);
                }
                return `<span class="text-green-500 font-black">${w}</span>`;
            }
            return w;
        }).join(" ");

        const box = document.getElementById('retelling-transcript-box');
        if(box) { box.innerHTML = htmlText; box.scrollTop = box.scrollHeight; }
        return;
    }

    // --- Reading処理 (Perfect判定とAccuracy計算) ---
    if (window.storyState.phase === 'reading') {
        if (finalText.trim().length > 0) window.storyState.readingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.readingTranscripts[idx] + interimText;
        
        // ★修正: HTMLタグを安全に剥がして純粋なテキストのみを抽出
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = levelData.readingText;
        const targetText = tempDiv.textContent || tempDiv.innerText || "";
        
        const targetSentences = targetText.match(/[^.!?]+[.!?]+/g) || [targetText];
        const spokenRaw = currentTempText.toLowerCase().replace(/[.,!?]/g, '');
        
        // 文単位のPerfect判定
        targetSentences.forEach((sentence, sIdx) => {
            if (window.perfectedSentences.has(sIdx)) return;
            const sClean = sentence.toLowerCase().replace(/[.,!?]/g, '').trim();
            if (sClean.length > 5 && spokenRaw.includes(sClean)) {
                window.perfectedSentences.add(sIdx);
                if(typeof playSyntheticSound === 'function') playSyntheticSound('perfect');
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
        const accEl = document.getElementById('reading-accuracy');
        if(accEl) accEl.textContent = `${acc}%`;

        const tSetForMatch = new Set(tWords);
        const htmlTranscript = sWords.map(w => {
            const cleanW = w.replace(/[.,!?]/g, '').toLowerCase();
            return (cleanW && !tSetForMatch.has(cleanW)) ? `<span class="text-purple-600 font-black underline decoration-purple-300" title="本文にない単語">${w}</span>` : w;
        }).join(" ");
        
        const transBox = document.getElementById('reading-transcript');
        if(transBox) transBox.innerHTML = htmlTranscript || "聞き取っています...";
    }
}

// Retelling完了時の最終リザルト生成
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
    const wpm = Math.round(totalWords / ( (window.pssSettings.retellingTime * 4) / 60) ); 

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

    if(typeof showStoryView === 'function') showStoryView(viewResultStory);
}