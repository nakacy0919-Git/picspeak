// js/story_scoring.js
// ==========================================
// PSS専用 採点・判定・リザルト生成エンジン (アカデミック 5W1H/Story Grammar 評価版)
// ==========================================

function handleStorySpeechResult(finalText, interimText) {
    const idx = window.storyState.currentSceneIndex;
    const level = window.storyState.selectedLevel;
    if(!window.storyState.currentStory) return;
    const levelData = window.storyState.currentStory.scenes[idx].levels[level];

    // --- Retelling処理 (リアルタイム色付け) ---
    if (window.storyState.phase === 'retelling') {
        if (finalText.trim().length > 0) window.storyState.retellingTranscripts[idx] += finalText + " ";
        const currentTempText = window.storyState.retellingTranscripts[idx] + interimText;
        
        let allText = "";
        for(let i=0; i<=idx; i++){ 
            if(window.storyState.retellingTranscripts[i]) allText += window.storyState.retellingTranscripts[i] + " "; 
        }
        allText += interimText;

        // ★新しいターゲット構造（keywords配列）からマッチ用リストを抽出
        let targetWords = [];
        if(levelData.targets) {
            levelData.targets.forEach(t => {
                if(t.keywords) {
                    t.keywords.forEach(kw => {
                        const words = kw.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
                        targetWords = targetWords.concat(words);
                    });
                }
            });
        }
        const targetSet = new Set(targetWords);
        
        const htmlText = allText.split(/\s+/).map(w => {
            const cleanW = w.toLowerCase().replace(/[.,!?]/g, '');
            if(cleanW && targetSet.has(cleanW)) {
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
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = levelData.readingText;
        const targetText = tempDiv.textContent || tempDiv.innerText || "";
        
        const targetSentences = targetText.match(/[^.!?]+[.!?]+/g) || [targetText];
        const spokenRaw = currentTempText.toLowerCase().replace(/[.,!?]/g, '');
        
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

// ==========================================
// ★ Retelling完了時の アカデミック・シーン別リザルト生成
// ==========================================
function finishStoryRetelling() {
    window.isRecording = false; window.micState = 'idle'; if (typeof stopSpeech === 'function') stopSpeech();
    
    const level = window.storyState.selectedLevel;
    let totalTargetCount = 0;
    let totalClearedCount = 0;
    let totalWordsSpoken = 0;
    
    let scenesHtml = "";

    // シーンごとのループ処理
    window.storyState.currentStory.scenes.forEach((scene, i) => {
        const levelData = scene.levels ? scene.levels[level] : scene;
        const transcript = window.storyState.retellingTranscripts[i] ? window.storyState.retellingTranscripts[i].trim() : "";
        const spokenWordsRaw = transcript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
        const spokenSet = new Set(spokenWordsRaw); // ユーザーが喋った単語セット
        
        totalWordsSpoken += spokenWordsRaw.filter(w=>w).length;
        
        let sceneTargets = 0;
        let sceneCleared = 0;
        let targetHtmlList = "";

        if(levelData.targets) {
            levelData.targets.forEach(t => {
                sceneTargets++;
                totalTargetCount++;
                
                // ★新しい判定ロジック：keywordsの中に1つでもマッチするものがあれば「意図が伝わった」とみなす
                let isMatch = false;
                if(t.keywords) {
                    isMatch = t.keywords.some(kw => spokenSet.has(kw.toLowerCase()));
                }
                
                // カテゴリーラベルの装飾
                let catColor = "bg-gray-100 text-gray-600";
                if(t.category.includes("Who") || t.category.includes("Subject")) catColor = "bg-blue-100 text-blue-700";
                if(t.category.includes("What") || t.category.includes("Action")) catColor = "bg-orange-100 text-orange-700";
                if(t.category.includes("Where") || t.category.includes("Context")) catColor = "bg-purple-100 text-purple-700";
                if(t.category.includes("Result")) catColor = "bg-pink-100 text-pink-700";

                if (isMatch) {
                    sceneCleared++;
                    totalClearedCount++;
                    targetHtmlList += `
                        <div class="flex items-start gap-2 mb-2 bg-green-50 p-2 rounded-lg border border-green-100">
                            <span class="text-[10px] font-black ${catColor} px-2 py-0.5 rounded shadow-sm shrink-0 mt-0.5">${t.category}</span>
                            <span class="text-sm font-bold text-gray-800 flex-1">${t.text}</span>
                            <span class="text-green-500 font-black text-lg shrink-0">✅</span>
                        </div>
                    `;
                } else {
                    targetHtmlList += `
                        <div class="flex items-start gap-2 mb-2 bg-red-50 p-2 rounded-lg border border-red-100 opacity-80">
                            <span class="text-[10px] font-black ${catColor} px-2 py-0.5 rounded shadow-sm shrink-0 mt-0.5">${t.category}</span>
                            <span class="text-sm font-bold text-gray-500 flex-1 line-through decoration-gray-400">${t.text}</span>
                            <span class="text-red-400 font-black text-lg shrink-0">❌</span>
                        </div>
                    `;
                }
            });
        }
        
        const sceneMatchRate = sceneTargets === 0 ? 0 : Math.floor((sceneCleared / sceneTargets) * 100);

        // シーンごとの結果カード
        scenesHtml += `
            <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-200 mb-5 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1.5 h-full ${sceneMatchRate >= 80 ? 'bg-green-400' : sceneMatchRate >= 50 ? 'bg-yellow-400' : 'bg-pink-400'}"></div>
                
                <div class="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
                    <h4 class="font-black text-gray-800 text-xl pl-2">Scene ${i + 1}</h4>
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Story Grammar</span>
                        <span class="font-black ${sceneMatchRate >= 80 ? 'text-green-500' : sceneMatchRate >= 50 ? 'text-yellow-500' : 'text-pink-500'} text-2xl leading-none">${sceneMatchRate}%</span>
                    </div>
                </div>
                
                <div class="mb-4">
                    <span class="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Your Speech</span>
                    <div class="text-base text-gray-600 font-medium leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 italic">"${transcript || 'No speech recorded.'}"</div>
                </div>
                
                <div>
                    <span class="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Information Transfer (情報伝達)</span>
                    <div class="flex flex-col">${targetHtmlList || '<span class="text-sm text-gray-400 font-bold">No structural targets defined.</span>'}</div>
                </div>
            </div>
        `;
    });

    const completionRate = totalTargetCount === 0 ? 0 : Math.floor((totalClearedCount / totalTargetCount) * 100);
    const wpm = Math.round(totalWordsSpoken / ( (window.pssSettings.retellingTime * 4) / 60) ); 

    const container = document.getElementById('story-ranking-container');
    if (container) {
        let html = `
            <div class="flex flex-col lg:flex-row gap-4 md:gap-6 h-full w-full max-w-6xl mx-auto">
                <div class="w-full lg:w-1/3 flex flex-col gap-4 shrink-0 pb-4 lg:pb-0">
                    <div class="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 flex flex-col items-center shadow-lg text-white relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 opacity-10 text-9xl">📊</div>
                        <span class="text-white/80 font-extrabold text-xs tracking-widest mb-2 uppercase">Story Grammar Score</span>
                        <span class="text-7xl font-black">${completionRate}<span class="text-3xl">%</span></span>
                        <p class="text-sm font-medium text-white/90 mt-4 text-center">物語の構造（誰が・何を・どうした）をどれだけ論理的に伝えられたかの評価です。</p>
                    </div>
                    <div class="flex gap-4">
                        <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-sm border border-gray-200 flex-1">
                            <span class="text-gray-400 font-extrabold text-[10px] tracking-widest mb-1 uppercase">Total Words</span>
                            <span class="text-4xl font-black text-gray-800">${totalWordsSpoken}</span>
                        </div>
                        <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-sm border border-gray-200 flex-1">
                            <span class="text-gray-400 font-extrabold text-[10px] tracking-widest mb-1 uppercase">WPM (Speed)</span>
                            <span class="text-4xl font-black text-gray-800">${wpm}</span>
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-2/3 flex flex-col lg:h-full lg:overflow-y-auto pb-20">
                    <h3 class="text-sm font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                        Scene-by-Scene Analysis
                    </h3>
                    ${scenesHtml}
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    if(typeof showStoryView === 'function') {
        showStoryView(document.getElementById('view-result-story'));
    }
}