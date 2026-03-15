// js/game.js
// ==========================================
// ゲームコアエンジン
// ==========================================

window.processPracticeDiff = function(spoken, target) {
    if (!spoken.trim()) return { html: "", isPerfect: false };
    const targetWords = target.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
    const spokenWordsRaw = spoken.trim().split(/\s+/);
    let html = '';
    spokenWordsRaw.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?]/g, '');
        if (cleanWord && !targetWords.includes(cleanWord)) {
            html += `<span class="text-purple-600 font-black border-b-[6px] border-purple-300 bg-purple-50 px-2 mx-1 rounded-lg">${word}</span>`;
        } else { html += `${word} `; }
    });
    const normalizedSpoken = spoken.toLowerCase().replace(/[.,!?]/g, '');
    const normalizedTarget = target.toLowerCase().replace(/[.,!?]/g, '');
    const isPerfect = normalizedSpoken.includes(normalizedTarget) && normalizedTarget.length > 0;
    return { html: html.trim(), isPerfect };
};

window.triggerSupportHint = function() {
    const supportToggle = document.getElementById('support-toggle');
    const supportTextContainer = document.getElementById('support-text-container');
    if (!supportToggle || !supportToggle.checked || !window.currentTheme || window.timeLeft <= 0 || !window.isRecording) return;
    
    const targetData = getAggregatedData(window.currentTheme, window.appState.selectedLevel);
    const availableHints = [];
    targetData.chunks.forEach(c => { if(!foundChunksSet.has(c.text)) availableHints.push(c); });
    targetData.sentences.forEach(s => { if(!foundSentencesSet.has(s.text)) availableHints.push(s); });
    
    if (availableHints.length > 0) {
        const hint = availableHints[Math.floor(Math.random() * availableHints.length)];
        const hintEl = document.createElement('div');
        hintEl.className = 'absolute top-[50%] left-[50%] flex flex-col items-center justify-center support-text-float w-[90%] pointer-events-none z-[30]';
        hintEl.innerHTML = `<div class="bg-black/70 backdrop-blur-md text-white px-6 md:px-8 py-4 md:py-6 rounded-3xl shadow-2xl border border-white/20 text-center"><div class="text-2xl md:text-5xl lg:text-6xl font-black tracking-wide drop-shadow-md mb-2">${hint.text}</div><div class="text-sm md:text-2xl font-bold text-gray-300">${hint.ja}</div></div>`;
        supportTextContainer.appendChild(hintEl);
        setTimeout(() => { if(supportTextContainer.contains(hintEl)) supportTextContainer.removeChild(hintEl); }, 5000);
    }
};

window.startTimer = function() {
    const timerText = document.getElementById('timer-text');
    const timerBar = document.getElementById('timer-bar');
    const wordCountDisplay = document.getElementById('wordCountDisplay');
    const liveWpmDisplay = document.getElementById('liveWpmDisplay');
    const statusText = document.getElementById('status-text');

    timerText.textContent = `${window.timeLeft}s`;
    timerBar.style.width = '100%'; timerBar.style.transition = 'none';
    setTimeout(() => {
        timerBar.style.transition = `width ${window.timeLeft}s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    window.gameTimer = setInterval(() => {
        window.timeLeft--; window.timeElapsed++;
        timerText.textContent = `${window.timeLeft}s`;
        const currentWords = parseInt(wordCountDisplay.textContent) || 0;
        const currentWpm = Math.round(currentWords / (window.timeElapsed / 60));
        if(liveWpmDisplay) liveWpmDisplay.textContent = currentWpm;

        if (window.timeLeft <= 0) {
            clearInterval(window.gameTimer);
            window.stopRecording();
            if(statusText) statusText.textContent = "Time's Up!";
        }
    }, 1000);
};

window.dropPin = function(word, theme, isHint = false) {
    if (!theme || !theme.pins || !theme.pins[word.toLowerCase()]) return;
    const pinContainer = document.getElementById('pin-container');
    const pinData = theme.pins[word.toLowerCase()];
    const pin = document.createElement('div');
    pin.className = 'absolute flex flex-col items-center justify-center pin-drop z-20';
    pin.style.left = `${pinData.x}%`; pin.style.top = `${pinData.y}%`; pin.style.transform = 'translate(-50%, -100%)';
    const opacityClass = isHint ? 'opacity-80 bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-white text-gray-900 drop-shadow-md';
    const heart = isHint ? '📍' : '❤️';
    pin.innerHTML = `<div class="${opacityClass} text-[10px] md:text-sm lg:text-base font-black px-2 md:px-3 py-1 md:py-1.5 rounded-full shadow-lg border-2 mb-1 md:mb-1.5 tracking-wider uppercase">${heart} ${word}</div><div class="w-1.5 md:w-2 h-3.5 md:h-5 bg-gray-300 shadow-sm rounded-b-full"></div>`;
    if(!isHint) {
        const popEffect = document.createElement('div'); popEffect.className = 'pin-pop-effect'; pin.appendChild(popEffect);
    }
    if(pinContainer) pinContainer.appendChild(pin);
};

window.highlightGlobalText = function(text) {
    if (!text) return "";
    let html = text;
    const phrases = [...Array.from(foundChunksSet), ...Array.from(foundSentencesSet)].sort((a, b) => b.length - a.length);
    phrases.forEach(phrase => {
        const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(regex, `<span class="hl-phrase">$1</span>`);
    });
    const words = Array.from(foundWordsSet).sort((a, b) => b.length - a.length);
    words.forEach(word => {
        const regex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?![^<]*>|[^<>]*<\/span>)`, 'gi');
        html = html.replace(regex, `<span class="hl-mandatory">$1</span>`);
    });
    return html;
};

window.handleSpeechResult = function(finalText, interimText) {
    if (window.appState.isPracticeMode) {
        if (finalText.trim().length > 0) window.appState.practiceRawTranscript += finalText + " ";
        const currentTempText = window.appState.practiceRawTranscript + interimText;
        const diffResult = window.processPracticeDiff(currentTempText, window.appState.practiceTargetText);
        
        const practiceTranscriptBox = document.getElementById('practice-transcript');
        const practiceFeedbackBox = document.getElementById('practice-feedback');
        const btnStartPractice = document.getElementById('btn-start-practice');
        
        if(practiceTranscriptBox) practiceTranscriptBox.innerHTML = diffResult.html || "Listening...";
        
        if (diffResult.isPerfect) {
            if(practiceFeedbackBox) {
                practiceFeedbackBox.innerHTML = '<span class="text-transparent bg-clip-text bg-sns-gradient text-4xl md:text-6xl font-black drop-shadow-md animate-perfect">Great Job! ✨</span>';
                practiceFeedbackBox.classList.remove('hidden');
            }
            if (typeof playSound === 'function') playSound('practice_perfect');
            if(typeof stopSpeech === 'function') stopSpeech(); 
            window.isRecording = false;
            if(btnStartPractice) {
                btnStartPractice.innerHTML = '<span class="text-3xl md:text-5xl">✅</span> NEXT';
                btnStartPractice.classList.replace('bg-gray-800', 'bg-gray-300');
            }
        }
        return;
    }

    if (finalText.trim().length > 0) window.rawTranscriptForCounting += finalText + " ";
    const currentTempText = window.rawTranscriptForCounting + interimText;
    const wordsArray = currentTempText.trim().split(/[\s,.?!]+/).filter(w => w.length > 0);
    
    const wordCountDisplay = document.getElementById('wordCountDisplay');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const liveCompletionBar = document.getElementById('live-completion-bar');
    const liveCompletionText = document.getElementById('live-completion-text');
    const transcriptBox = document.getElementById('transcript-box');
    
    if(wordCountDisplay) wordCountDisplay.textContent = wordsArray.length;
    
    if (currentTempText.trim().length > 0 && window.currentTheme) {
        const result = calculateScore(currentTempText, window.currentTheme, window.appState.selectedLevel);
        if (result && result.addedPoints > 0) {
            if(scoreDisplay) scoreDisplay.textContent = result.score;
            const stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel);
            if(liveCompletionBar && liveCompletionText) {
                liveCompletionBar.style.width = `${stats.completionRate}%`; liveCompletionText.textContent = `${stats.completionRate}%`;
            }
            if (result.newWords && result.newWords.length > 0) result.newWords.forEach(word => { window.dropPin(word, window.currentTheme); });
            
            if (typeof playSound === 'function') {
                if (result.isPerfect) { playSound('perfect'); window.showPerfectAnimation(result.addedPoints); }
                else if (parseFloat(result.multiplier) > 1.0) { playSound('combo'); window.showComboAnimation(result.multiplier, result.addedPoints); }
                else { playSound('match'); }
            }
        }
    }
    
    let highlightedHTML = window.highlightGlobalText(currentTempText);
    if(transcriptBox) {
        if (currentTempText.trim().length > 0) {
            transcriptBox.innerHTML = `<p class="mb-2 leading-relaxed font-medium text-gray-900">${highlightedHTML}</p>`;
        } else {
            transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and speak loudly.<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して、大きな声で話しましょう）</span></p>`;
        }
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }
};

window.handleSpeechEnd = function() {
    window.isRecording = false;
    const btnStartPractice = document.getElementById('btn-start-practice');
    const recordingIndicator = document.getElementById('recording-indicator');
    const btnStartTurn = document.getElementById('btn-start-turn');
    const btnFinishTurn = document.getElementById('btn-finish-turn');
    const statusText = document.getElementById('status-text');

    if (window.appState.isPracticeMode) {
        if(btnStartPractice) {
            btnStartPractice.innerHTML = '<span class="text-3xl md:text-5xl">🔄</span> RETRY';
            btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
        }
        return;
    }
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if (window.timeLeft > 0) {
        if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden'); 
        if(statusText) statusText.textContent = "Paused";
    } else {
        if(btnStartTurn) btnStartTurn.classList.add('hidden');
        if(btnFinishTurn) btnFinishTurn.classList.remove('hidden');
        if(statusText) statusText.textContent = "Time's Up!";
    }
};

window.stopRecording = function() {
    if(typeof stopSpeech === 'function') stopSpeech();
    const recordingIndicator = document.getElementById('recording-indicator');
    const btnStartTurn = document.getElementById('btn-start-turn');
    const btnFinishTurn = document.getElementById('btn-finish-turn');
    const statusText = document.getElementById('status-text');
    const timerBar = document.getElementById('timer-bar');

    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if(window.supportInterval) clearInterval(window.supportInterval);

    if (window.timeLeft <= 0) {
        if(btnStartTurn) btnStartTurn.classList.add('hidden');
        if(btnFinishTurn) btnFinishTurn.classList.remove('hidden'); 
        if(statusText) statusText.textContent = "Time's Up!";
    } else {
        if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        if(statusText) statusText.textContent = "Paused";
    }
    if(timerBar) timerBar.style.transition = 'none';
};

window.showComboAnimation = function(multiplier, points) {
    const comboOverlay = document.getElementById('combo-overlay');
    const comboContent = document.getElementById('combo-content');
    if(!comboOverlay || !comboContent) return;
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `<div class="text-6xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-sns-gradient drop-shadow-xl animate-combo tracking-tighter">x${multiplier} COMBO!</div><div class="text-2xl md:text-4xl font-bold text-gray-800 mt-2 animate-phrase">+${points} pts</div>`;
    setTimeout(() => { comboOverlay.classList.add('hidden'); }, 1500);
};

window.showPerfectAnimation = function(points) {
    const perfectOverlay = document.getElementById('perfect-overlay');
    const perfectContent = document.getElementById('perfect-content');
    if(!perfectOverlay || !perfectContent) return;
    perfectOverlay.classList.remove('hidden');
    perfectContent.innerHTML = `<div class="text-7xl md:text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(252,175,69,1)] animate-perfect tracking-tighter uppercase">PERFECT!!</div><div class="text-3xl md:text-5xl font-black text-white mt-4 drop-shadow-lg animate-phrase">+${points} pts 🔥</div>`;
    setTimeout(() => { perfectOverlay.classList.add('hidden'); }, 2000);
};

// ★修正: Result画面のアコーディオンをスリム化し、パネル内スクロールに最適化
window.createFeedbackSection = function(title, items, type, isCleared) {
    if(items.length === 0) return '';
    const limit = type === 'sentence' ? 2 : 6;
    let bgColor = isCleared ? 'bg-blue-50' : 'bg-gray-50';
    let borderColor = isCleared ? 'border-blue-100' : 'border-gray-200';
    let textColor = isCleared ? 'text-blue-800' : 'text-gray-700';
    let subTextColor = isCleared ? 'text-blue-500' : 'text-gray-400';
    
    let html = `<div class="mb-6"><p class="text-sm md:text-base font-black text-gray-400 mb-3 uppercase tracking-widest border-b pb-1 flex items-center justify-between"><span>${title} <span class="text-xs md:text-sm bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-2">${items.length}</span></span></p><div class="${type === 'sentence' ? 'space-y-3' : 'flex flex-wrap gap-2'}">`;
    items.forEach((item, index) => {
        const hiddenClass = index >= limit ? 'hidden extra-item' : '';
        const escapedText = item.text.replace(/'/g, "\\'");
        const btnHTML = `<div class="flex items-center gap-1 shrink-0 bg-white/60 rounded-full px-1 py-0.5 border border-black/10"><button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-lg shadow-sm" onclick="speakText('${escapedText}')" title="Read Aloud">🔊</button><button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-lg shadow-sm" onclick="window.openPractice('${escapedText}', '${item.ja}')" title="Practice Pronunciation">🎤</button></div>`;
        if (type === 'sentence') {
            html += `<div class="${bgColor} p-4 md:p-5 rounded-xl border ${borderColor} shadow-sm ${hiddenClass} transition-all"><div class="flex justify-between items-start gap-4"><div class="font-bold ${textColor} text-base md:text-lg leading-snug">${item.text}</div>${btnHTML}</div><div class="text-sm md:text-base ${subTextColor} font-medium mt-2">${item.ja}</div></div>`;
        } else {
            html += `<div class="${bgColor} pl-3 pr-1 py-1 rounded-full border ${borderColor} shadow-sm flex items-center justify-between gap-3 ${hiddenClass}"><div><span class="font-bold ${textColor} text-sm md:text-base">${item.text}</span><span class="text-xs md:text-sm font-medium ${subTextColor} ml-2">${item.ja}</span></div>${btnHTML}</div>`;
        }
    });
    html += `</div>`;
    if(items.length > limit) html += `<button class="mt-3 text-sm md:text-base font-black text-pink-500 hover:text-pink-600 transition-colors toggle-more-btn flex items-center gap-1"><span class="pointer-events-none">もっと表現を確認する</span> <span class="text-lg pointer-events-none">▼</span></button>`;
    html += `</div>`;
    return html;
};

// ★修正: PC/iPad向けに「画面内に収まるダッシュボード（1枚フィードバックシート）」化
window.finishGameAndShowResult = function() {
    clearInterval(window.gameTimer);
    if(window.supportInterval) clearInterval(window.supportInterval);
    const scoreDisplay = document.getElementById('scoreDisplay');
    const wordCountDisplay = document.getElementById('wordCountDisplay');
    const finalScore = scoreDisplay ? scoreDisplay.textContent : "0";
    const finalWordCount = wordCountDisplay ? parseInt(wordCountDisplay.textContent) || 0 : 0;
    let wpm = window.timeElapsed > 0 ? Math.round(finalWordCount / (window.timeElapsed / 60)) : 0;
    const stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel);

    if (typeof window.saveLearningLog === 'function') {
        window.saveLearningLog({ date: new Date().toISOString(), imageId: window.currentTheme.id || 'unknown', level: window.appState.selectedLevel, score: finalScore, completion: stats.completionRate, wpm: wpm });
    }

    const rankingContainer = document.getElementById('ranking-container');
    if(rankingContainer) {
        let html = `
            <div class="flex flex-col xl:flex-row gap-6 h-full w-full">
                <div class="xl:w-1/3 flex flex-col gap-4 h-full shrink-0">
                    <div class="bg-white rounded-3xl p-3 shadow-md border border-gray-100 flex items-center justify-center shrink-0 h-48 xl:h-64">
                        <img src="${window.currentTheme.imageSrc}" class="w-full h-full object-cover rounded-2xl">
                    </div>
                    <div class="grid grid-cols-2 gap-3 shrink-0">
                        <div class="bg-white rounded-2xl p-4 flex flex-col items-center shadow-md border border-gray-100"><span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">Score</span><span class="text-3xl font-black text-gray-900">${finalScore}</span></div>
                        <div class="bg-sns-gradient rounded-2xl p-4 flex flex-col items-center shadow-md text-white"><span class="text-white/80 font-extrabold text-xs tracking-widest mb-1 uppercase">Completion</span><span class="text-3xl font-black">${stats.completionRate}<span class="text-xl">%</span></span></div>
                        <div class="bg-white rounded-2xl p-4 flex flex-col items-center shadow-md border border-gray-100"><span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">Words</span><span class="text-3xl font-black text-gray-900">${finalWordCount}</span></div>
                        <div class="bg-white rounded-2xl p-4 flex flex-col items-center shadow-md border border-gray-100"><span class="text-gray-400 font-extrabold text-xs tracking-widest mb-1 uppercase">WPM</span><span class="text-3xl font-black text-gray-900">${wpm}</span></div>
                    </div>
                    <div class="bg-gray-50 rounded-3xl p-5 border border-gray-200 flex-1 overflow-y-auto shadow-inner min-h-[150px]">
                        <span class="text-gray-400 font-extrabold text-xs tracking-widest mb-2 block uppercase">Your Transcript</span>
                        <div class="text-lg md:text-xl font-medium text-gray-700 leading-relaxed">${window.highlightGlobalText(window.rawTranscriptForCounting) || "No words recorded."}</div>
                    </div>
                </div>

                <div class="xl:w-2/3 flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                    <div class="flex-1 bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col overflow-hidden h-[50vh] xl:h-full">
                        <div class="bg-gray-100 px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0"><h3 class="text-lg md:text-xl font-black text-gray-700 tracking-wider">💡 NEXT TARGETS</h3><span class="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">言えなかった表現</span></div>
                        <div class="p-5 overflow-y-auto flex-1">
                            ${window.createFeedbackSection('Words', stats.missedWords, 'word', false) || '<p class="text-gray-400 font-bold text-center py-4">全てクリア！</p>'}
                            ${window.createFeedbackSection('Chunks', stats.missedChunks, 'chunk', false) || '<p class="text-gray-400 font-bold text-center py-4">全てクリア！</p>'}
                            ${window.createFeedbackSection('Sentences', stats.missedSentences, 'sentence', false) || '<p class="text-gray-400 font-bold text-center py-4">全てクリア！</p>'}
                        </div>
                    </div>
                    <div class="flex-1 bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col overflow-hidden h-[50vh] xl:h-full">
                        <div class="bg-blue-50 px-5 py-4 border-b border-blue-100 flex items-center justify-between shrink-0"><h3 class="text-lg md:text-xl font-black text-blue-800 tracking-wider">✨ CLEARED</h3><span class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">言えた表現</span></div>
                        <div class="p-5 overflow-y-auto flex-1">
                            ${window.createFeedbackSection('Words', stats.clearedWords, 'word', true) || '<p class="text-gray-400 font-bold text-center py-4">まだありません</p>'}
                            ${window.createFeedbackSection('Chunks', stats.clearedChunks, 'chunk', true) || '<p class="text-gray-400 font-bold text-center py-4">まだありません</p>'}
                            ${window.createFeedbackSection('Sentences', stats.clearedSentences, 'sentence', true) || '<p class="text-gray-400 font-bold text-center py-4">まだありません</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        rankingContainer.innerHTML = html;
    }
    if (typeof showView === 'function') showView(document.getElementById('view-result'));
};