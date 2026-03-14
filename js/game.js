// js/game.js
// ==========================================
// ゲームコアエンジン（タイマー・判定・アニメーション・結果描画）
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
        } else {
            html += `${word} `;
        }
    });
    const normalizedSpoken = spoken.toLowerCase().replace(/[.,!?]/g, '');
    const normalizedTarget = target.toLowerCase().replace(/[.,!?]/g, '');
    const isPerfect = normalizedSpoken.includes(normalizedTarget) && normalizedTarget.length > 0;
    return { html: html.trim(), isPerfect };
};

window.triggerSupportHint = function() {
    if (!supportToggle.checked || !currentTheme || timeLeft <= 0 || !isRecording) return;
    const targetData = getAggregatedData(currentTheme, window.appState.selectedLevel);
    const availableHints = [];
    targetData.chunks.forEach(c => { if(!foundChunksSet.has(c.text)) availableHints.push(c); });
    targetData.sentences.forEach(s => { if(!foundSentencesSet.has(s.text)) availableHints.push(s); });
    
    if (availableHints.length > 0) {
        const hint = availableHints[Math.floor(Math.random() * availableHints.length)];
        const hintEl = document.createElement('div');
        hintEl.className = 'absolute top-[50%] left-[50%] flex flex-col items-center justify-center support-text-float w-[90%] pointer-events-none z-[30]';
        hintEl.innerHTML = `<div class="bg-black/70 backdrop-blur-md text-white px-8 py-6 rounded-3xl shadow-2xl border border-white/20 text-center"><div class="text-3xl md:text-5xl lg:text-6xl font-black tracking-wide drop-shadow-md mb-2">${hint.text}</div><div class="text-lg md:text-2xl font-bold text-gray-300">${hint.ja}</div></div>`;
        supportTextContainer.appendChild(hintEl);
        setTimeout(() => { if(supportTextContainer.contains(hintEl)) supportTextContainer.removeChild(hintEl); }, 5000);
    }
};

window.startTimer = function() {
    timerText.textContent = `${timeLeft}s`;
    timerBar.style.width = '100%'; timerBar.style.transition = 'none';
    setTimeout(() => {
        timerBar.style.transition = `width ${timeLeft}s linear, background-color 0.5s ease`;
        timerBar.style.width = '0%';
    }, 50);

    gameTimer = setInterval(() => {
        timeLeft--; timeElapsed++;
        timerText.textContent = `${timeLeft}s`;
        const currentWords = parseInt(wordCountDisplay.textContent) || 0;
        const currentWpm = Math.round(currentWords / (timeElapsed / 60));
        if(liveWpmDisplay) liveWpmDisplay.textContent = currentWpm;

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            window.stopRecording();
            statusText.textContent = "Time's Up!";
        }
    }, 1000);
};

window.dropPin = function(word, theme, isHint = false) {
    if (!theme || !theme.pins || !theme.pins[word.toLowerCase()]) return;
    const pinData = theme.pins[word.toLowerCase()];
    const pin = document.createElement('div');
    pin.className = 'absolute flex flex-col items-center justify-center pin-drop z-20';
    pin.style.left = `${pinData.x}%`; pin.style.top = `${pinData.y}%`; pin.style.transform = 'translate(-50%, -100%)';
    const opacityClass = isHint ? 'opacity-80 bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-white text-gray-900 drop-shadow-md';
    const heart = isHint ? '📍' : '❤️';
    pin.innerHTML = `<div class="${opacityClass} text-xs md:text-lg lg:text-xl font-black px-3 md:px-4 py-1 md:py-2 rounded-full shadow-lg border-2 mb-1.5 md:mb-2 tracking-wider uppercase">${heart} ${word}</div><div class="w-1.5 md:w-2 h-4 md:h-6 bg-gray-300 shadow-sm rounded-b-full"></div>`;
    if(!isHint) {
        const popEffect = document.createElement('div'); popEffect.className = 'pin-pop-effect'; pin.appendChild(popEffect);
    }
    pinContainer.appendChild(pin);
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
    if (isPracticeMode) {
        if (finalText.trim().length > 0) practiceRawTranscript += finalText + " ";
        const currentTempText = practiceRawTranscript + interimText;
        const diffResult = window.processPracticeDiff(currentTempText, practiceTargetText);
        practiceTranscriptBox.innerHTML = diffResult.html || "Listening...";
        
        if (diffResult.isPerfect) {
            practiceFeedbackBox.innerHTML = '<span class="text-transparent bg-clip-text bg-sns-gradient text-5xl md:text-7xl font-black drop-shadow-md animate-perfect">Great Job! ✨</span>';
            practiceFeedbackBox.classList.remove('hidden');
            if (typeof playSound === 'function') playSound('practice_perfect');
            stopSpeech(); isRecording = false;
            btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">✅</span> NEXT';
            btnStartPractice.classList.replace('bg-gray-800', 'bg-gray-300');
        }
        return;
    }

    if (finalText.trim().length > 0) rawTranscriptForCounting += finalText + " ";
    const currentTempText = rawTranscriptForCounting + interimText;
    const wordsArray = currentTempText.trim().split(/[\s,.?!]+/).filter(w => w.length > 0);
    wordCountDisplay.textContent = wordsArray.length;
    
    if (currentTempText.trim().length > 0 && currentTheme) {
        const result = calculateScore(currentTempText, currentTheme, window.appState.selectedLevel);
        if (result && result.addedPoints > 0) {
            scoreDisplay.textContent = result.score;
            const stats = getCompletionStats(currentTheme, window.appState.selectedLevel);
            if(liveCompletionBar && liveCompletionText) {
                liveCompletionBar.style.width = `${stats.completionRate}%`; liveCompletionText.textContent = `${stats.completionRate}%`;
            }
            if (result.newWords && result.newWords.length > 0) result.newWords.forEach(word => { window.dropPin(word, currentTheme); });
            
            if (typeof playSound === 'function') {
                if (result.isPerfect) { playSound('perfect'); window.showPerfectAnimation(result.addedPoints); }
                else if (parseFloat(result.multiplier) > 1.0) { playSound('combo'); window.showComboAnimation(result.multiplier, result.addedPoints); }
                else { playSound('match'); }
            }
        }
    }
    
    let highlightedHTML = window.highlightGlobalText(currentTempText);
    if (currentTempText.trim().length > 0) {
        transcriptBox.innerHTML = `<p class="mb-2 leading-relaxed font-medium text-gray-900">${highlightedHTML}</p>`;
    } else {
        transcriptBox.innerHTML = `<p class="text-gray-400 italic font-medium uppercase tracking-wide">Press START and speak loudly. ❤️📍🏙️✨</p>`;
    }
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
};

window.handleSpeechEnd = function() {
    isRecording = false;
    if (isPracticeMode) {
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-6xl">🔄</span> RETRY';
        btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
        return;
    }
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if (timeLeft > 0) {
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
    stopSpeech();
    if(recordingIndicator) recordingIndicator.classList.add('hidden');
    if(supportInterval) clearInterval(supportInterval);

    if (timeLeft <= 0) {
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
    if(!comboOverlay) return;
    comboOverlay.classList.remove('hidden');
    comboContent.innerHTML = `<div class="text-6xl md:text-8xl lg:text-9xl font-black text-transparent bg-clip-text bg-sns-gradient drop-shadow-2xl animate-combo tracking-tighter">x${multiplier} COMBO!</div><div class="text-3xl md:text-5xl font-bold text-gray-800 mt-4 animate-phrase">+${points} pts</div>`;
    setTimeout(() => { comboOverlay.classList.add('hidden'); }, 1500);
};

window.showPerfectAnimation = function(points) {
    if(!perfectOverlay) return;
    perfectOverlay.classList.remove('hidden');
    perfectContent.innerHTML = `<div class="text-7xl md:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(252,175,69,1)] animate-perfect tracking-tighter uppercase">PERFECT!!</div><div class="text-4xl md:text-6xl font-black text-white mt-6 drop-shadow-xl animate-phrase">+${points} pts 🔥</div>`;
    setTimeout(() => { perfectOverlay.classList.add('hidden'); }, 2000);
};

window.createFeedbackSection = function(title, items, type, isCleared) {
    if(items.length === 0) return '';
    const limit = type === 'sentence' ? 2 : 6;
    let bgColor = isCleared ? 'bg-blue-50' : 'bg-gray-50';
    let borderColor = isCleared ? 'border-blue-100' : 'border-gray-200';
    let textColor = isCleared ? 'text-blue-800' : 'text-gray-700';
    let subTextColor = isCleared ? 'text-blue-500' : 'text-gray-400';
    
    let html = `<div class="mb-10"><p class="text-lg md:text-2xl font-black text-gray-400 mb-6 uppercase tracking-widest border-b-2 pb-2 flex items-center justify-between"><span>${title} <span class="text-base md:text-lg bg-gray-200 text-gray-600 px-3 py-1 rounded-full ml-3">${items.length}</span></span></p><div class="${type === 'sentence' ? 'space-y-4' : 'flex flex-wrap gap-3'}">`;
    items.forEach((item, index) => {
        const hiddenClass = index >= limit ? 'hidden extra-item' : '';
        const escapedText = item.text.replace(/'/g, "\\'");
        const btnHTML = `<div class="flex items-center gap-2 shrink-0 bg-white/60 rounded-full px-2 py-1 border border-black/10"><button class="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full hover:bg-white transition-colors text-xl md:text-2xl shadow-sm" onclick="speakText('${escapedText}')" title="Read Aloud">🔊</button><button class="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full hover:bg-white transition-colors text-xl md:text-2xl shadow-sm" onclick="openPractice('${escapedText}', '${item.ja}')" title="Practice Pronunciation">🎤</button></div>`;
        if (type === 'sentence') {
            html += `<div class="${bgColor} p-6 md:p-8 rounded-3xl border-2 ${borderColor} shadow-sm ${hiddenClass} transition-all"><div class="flex justify-between items-start gap-6"><div class="font-bold ${textColor} text-xl md:text-3xl leading-snug">${item.text}</div>${btnHTML}</div><div class="text-base md:text-xl ${subTextColor} font-medium mt-3">${item.ja}</div></div>`;
        } else {
            html += `<div class="${bgColor} pl-5 pr-2 py-2 rounded-full border-2 ${borderColor} shadow-sm flex items-center justify-between gap-4 ${hiddenClass}"><div><span class="font-bold ${textColor} text-lg md:text-2xl">${item.text}</span><span class="text-sm md:text-lg font-medium ${subTextColor} ml-3">${item.ja}</span></div>${btnHTML}</div>`;
        }
    });
    html += `</div>`;
    if(items.length > limit) html += `<button class="mt-6 text-lg md:text-xl font-black text-pink-500 hover:text-pink-600 transition-colors toggle-more-btn flex items-center gap-2"><span class="pointer-events-none">もっと表現を確認する</span> <span class="text-2xl pointer-events-none">▼</span></button>`;
    html += `</div>`;
    return html;
};

// 終了処理とリザルト画面の生成
window.finishGameAndShowResult = function() {
    clearInterval(gameTimer);
    if(supportInterval) clearInterval(supportInterval);
    const finalScore = scoreDisplay.textContent;
    const finalWordCount = parseInt(wordCountDisplay.textContent) || 0;
    let wpm = timeElapsed > 0 ? Math.round(finalWordCount / (timeElapsed / 60)) : 0;
    const stats = getCompletionStats(currentTheme, window.appState.selectedLevel);

    if (typeof window.saveLearningLog === 'function') {
        window.saveLearningLog({ date: new Date().toISOString(), imageId: currentTheme.id || 'unknown', level: window.appState.selectedLevel, score: finalScore, completion: stats.completionRate, wpm: wpm });
    }

    const rankingContainer = document.getElementById('ranking-container');
    let html = `
        <div class="flex flex-col xl:flex-row gap-8 mb-10">
            <div class="xl:w-2/5 shrink-0 bg-white rounded-3xl p-4 shadow-lg border border-gray-100 flex items-center justify-center"><img src="${currentTheme.imageSrc}" class="w-full h-64 xl:h-full object-cover rounded-2xl"></div>
            <div class="xl:w-3/5 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 content-start">
                <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Score</span><span class="text-5xl md:text-7xl font-black text-gray-900">${finalScore}</span></div>
                <div class="bg-sns-gradient rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-xl text-white transform hover:scale-[1.02] transition-transform"><span class="text-white/80 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Completion</span><span class="text-5xl md:text-7xl font-black">${stats.completionRate}<span class="text-3xl">%</span></span></div>
                <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">Words</span><span class="text-5xl md:text-7xl font-black text-gray-900">${finalWordCount}</span></div>
                <div class="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center shadow-lg border border-gray-100"><span class="text-gray-400 font-extrabold text-sm md:text-lg tracking-widest mb-2 uppercase">WPM</span><span class="text-5xl md:text-7xl font-black text-gray-900">${wpm}</span></div>
                <div class="col-span-2 md:col-span-4 bg-gray-50 rounded-3xl p-6 md:p-10 border border-gray-200 mt-4 h-64 overflow-y-auto shadow-inner"><span class="text-gray-400 font-extrabold text-sm md:text-xl tracking-widest mb-4 block uppercase">Your Transcript</span><div class="text-2xl md:text-4xl font-medium text-gray-700 leading-relaxed">${window.highlightGlobalText(rawTranscriptForCounting) || "No words recorded."}</div></div>
            </div>
        </div>
        <div class="flex flex-col gap-10">
            <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                <div class="bg-gray-100 px-8 py-6 border-b border-gray-200 flex items-center justify-between"><h3 class="text-2xl md:text-4xl font-black text-gray-700 tracking-wider">💡 NEXT TARGETS <span class="text-lg md:text-2xl font-bold text-gray-500 ml-4">言えなかった表現</span></h3></div>
                <div class="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
                    <div>${window.createFeedbackSection('Words', stats.missedWords, 'word', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                    <div>${window.createFeedbackSection('Chunks', stats.missedChunks, 'chunk', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                    <div>${window.createFeedbackSection('Sentences', stats.missedSentences, 'sentence', false) || '<p class="text-gray-400 font-bold text-xl">全てクリア！</p>'}</div>
                </div>
            </div>
            <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                <div class="bg-blue-100 px-8 py-6 border-b border-blue-200 flex items-center justify-between"><h3 class="text-2xl md:text-4xl font-black text-blue-800 tracking-wider">✨ CLEARED <span class="text-lg md:text-2xl font-bold text-blue-600 ml-4">言えた表現</span></h3></div>
                <div class="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
                    <div>${window.createFeedbackSection('Words', stats.clearedWords, 'word', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                    <div>${window.createFeedbackSection('Chunks', stats.clearedChunks, 'chunk', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                    <div>${window.createFeedbackSection('Sentences', stats.clearedSentences, 'sentence', true) || '<p class="text-gray-400 font-bold text-xl">まだありません</p>'}</div>
                </div>
            </div>
        </div>
    `;
    rankingContainer.innerHTML = html;
    if (typeof showView === 'function') showView(document.getElementById('view-result'));
};