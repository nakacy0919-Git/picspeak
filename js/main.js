// js/main.js
// ==========================================
// アプリケーションの司令塔 (完全クリーン版)
// ==========================================

window.appState = { 
    selectedMode: null,
    selectedLevel: 'elementary',
    customTimeLimit: 30,
    isPracticeMode: false,
    practiceTargetText: "",
    practiceRawTranscript: ""
};

window.isRecording = false;
window.currentTheme = null;
window.gameTimer = null;
window.supportInterval = null; 
window.timeLeft = 30; 
window.timeElapsed = 0; 
window.themeList = [];
window.accumulatedTranscript = ""; 
window.rawTranscriptForCounting = ""; 
window.audioCtx = null;

// 練習モーダル用変数
window.isPracticeRecording = false;
window.practiceRec = null;
window.practiceSuccess = false; 

// ==========================================
// ★ 紙吹雪＆Excellentポップアップ用のCSSを動的に追加
// ==========================================
(function injectSpecialEffectsCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        .confetti-piece { position: fixed; width: 10px; height: 10px; top: -10px; z-index: 9999; opacity: 0.8; border-radius: 2px; animation: confetti-fall 3s ease-out forwards; pointer-events: none; }
        @keyframes confetti-fall { 0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) translateX(var(--x-end)) rotate(var(--rot-end)); opacity: 0; } }
        .excellent-prompt { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); font-family: 'Arial Black', sans-serif; font-size: 10vw; font-weight: 900; color: #ffffff; text-shadow: 0 0 20px rgba(74, 222, 128, 0.8), 0 0 40px #22c55e; background: linear-gradient(to bottom right, #4ade80, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; z-index: 10000; opacity: 0; pointer-events: none; animation: excellent-pop 1.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes excellent-pop { 0% { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; } 15% { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); opacity: 1; } 25% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(0.8) rotate(0deg); opacity: 0; } }
    `;
    document.head.appendChild(style);
})();

async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("【重要】お使いのブラウザは音声認識に非対応です。Google Chromeをご利用ください。"); return; }
    if (typeof window.initSpeechRecognition === 'function') window.initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    try {
        const response = await fetch('data/theme_list.json?t=' + new Date().getTime());
        window.themeList = await response.json();
    } catch (error) { console.error("テーマリスト読み込み失敗:", error); }
}

window.renderThemeGrid = async function() {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-xl md:text-2xl">Loading Images...</div>';

    try {
        let results = [];
        let isDetective = (window.appState && window.appState.selectedMode === 'detective');
        
        if (window.appState.selectedMode === 'oralquest') {
            const res = await fetch('data/oralquest_list.json?t=' + new Date().getTime());
            results = await res.json();
            results = results.map(item => ({ id: item.id, data: item }));
        } else if (window.appState.selectedMode === 'mosaic') {
            const res = await fetch('data/mosaic_list.json?t=' + new Date().getTime());
            results = await res.json();
        } else if (isDetective) {
            const res = await fetch('data/detective_list.json?t=' + new Date().getTime());
            results = await res.json();
        } else {
            const fetchPromises = window.themeList.map(id => fetch(`data/themes/${id}.json?t=${new Date().getTime()}`).then(res => res.json()).then(data => ({ id, data: Array.isArray(data) ? data[0] : data })).catch(e => null));
            results = await Promise.all(fetchPromises);
        }

        let html = '';
        if (isDetective) {
            html += `<div class="col-span-full bg-yellow-50/80 rounded-3xl p-5 md:p-8 shadow-sm border border-yellow-200 mb-6 relative overflow-hidden"><h3 class="text-xl md:text-2xl font-black text-yellow-700 mb-2 flex items-center gap-2"><span>🕵️‍♂️</span> 遊び方（タップして体験！）</h3><p class="text-sm md:text-base text-yellow-800 font-bold mb-4 leading-relaxed">下の絵(B)を上の絵(A)と見比べて、違うところを英語で声に出してみよう！</p><div class="relative w-full rounded-2xl overflow-hidden border-4 border-yellow-300 bg-white shadow-inner cursor-pointer" onclick="handleTutorialClick(event)"><img src="assets/images/detective/sample.webp" class="w-full h-auto object-contain pointer-events-none"><div id="tutorial-overlay" class="absolute inset-0 pointer-events-none"></div></div></div>`;
        }

        results.forEach(item => {
            if(!item || !item.data) return;
            let imageFilterClass = ""; let category = item.data.category || 'other'; 
            let titleEn = item.data.titleEn || 'Select Image'; let titleJa = item.data.titleJa || item.data.description || '名称未設定';
            
            if (window.appState.selectedMode === 'mosaic') { imageFilterClass = "blur-2xl scale-110"; titleEn = "Secret Image"; titleJa = "秘密の画像"; }
            else if (isDetective) { imageFilterClass = "!h-[200%] object-top"; }
            
            let badgeHtml = isDetective ? `<div class="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse z-20">NEW!</div>` : '';
            html += `<div class="theme-card cursor-pointer rounded-2xl md:rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:border-pink-300 hover:shadow-md transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" data-id="${item.id}" data-category="${category}">${badgeHtml}<div class="relative w-full aspect-video bg-gray-50 shrink-0 pointer-events-none overflow-hidden"><img src="${item.data.imageSrc}" class="absolute inset-0 w-full h-full object-cover transition-all duration-500 ${imageFilterClass}"></div><div class="p-3 md:p-4 text-center border-t border-gray-50 flex-1 flex flex-col items-center justify-center leading-tight bg-white pointer-events-none"><span class="text-sm md:text-base font-black text-gray-800 line-clamp-1 mb-0.5">${titleEn}</span><span class="text-[10px] md:text-xs font-bold text-gray-400 line-clamp-1">${titleJa}</span></div></div>`;
        });
        themeGrid.innerHTML = html;

        const filters = document.getElementById('theme-filters');
        if (filters) {
            if (window.appState.selectedMode === 'mosaic' || isDetective || window.appState.selectedMode === 'oralquest') filters.classList.add('hidden');
            else {
                filters.classList.remove('hidden');
                document.querySelectorAll('.theme-filter-btn').forEach(b => {
                    if (b.getAttribute('data-filter') === 'all') { b.classList.remove('bg-white', 'text-gray-500'); b.classList.add('bg-gray-800', 'text-white', 'shadow-md'); }
                    else { b.classList.remove('bg-gray-800', 'text-white', 'shadow-md'); b.classList.add('bg-white', 'text-gray-500'); }
                });
                document.querySelectorAll('.theme-card').forEach(card => {
                    const cardCat = card.getAttribute('data-category');
                    if (cardCat === 'other') card.style.display = 'none';
                    else card.style.display = '';
                });
            }
        }
    } catch(e) { themeGrid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading images</div>'; }
}

window.handleTutorialClick = async function(e) {
    if (!window.tutorialData) {
        try {
            const res = await fetch('data/detective/detective_sample.json?t=' + new Date().getTime());
            window.tutorialData = await res.json();
        } catch (err) { return; }
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    let hitDiff = null;
    for (let diff of window.tutorialData.differences) {
        if (Math.abs(xPercent - diff.coordinates.x) <= (diff.coordinates.width / 2) + 5 && Math.abs(yPercent - diff.coordinates.y) <= (diff.coordinates.height / 2) + 5) {
            hitDiff = diff; break;
        }
    }
    if (hitDiff) window.showTutorialPopup(hitDiff);
}

window.showTutorialPopup = function(diff) {
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;
    overlay.innerHTML = ''; overlay.classList.remove('pointer-events-none'); 

    const mark = document.createElement('div');
    mark.className = 'absolute border-[4px] border-red-500 bg-red-500/30 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pop pointer-events-none z-10';
    mark.style.width = `${diff.coordinates.width}%`; mark.style.height = `${diff.coordinates.height}%`; mark.style.left = `${diff.coordinates.x - diff.coordinates.width / 2}%`; mark.style.top = `${diff.coordinates.y - diff.coordinates.height / 2}%`;
    overlay.appendChild(mark);

    let expressionsHtml = '';
    const createLevelHtml = (levelObj, levelName, color) => {
        if (!levelObj || levelObj.length === 0) return '';
        return `<div class="mb-2 p-2 bg-white rounded border border-gray-100"><span class="text-[10px] font-bold bg-${color}-100 text-${color}-700 px-2 py-0.5 rounded">${levelName}</span><p class="font-bold text-gray-800 text-sm mt-1">${levelObj[0].text}</p><p class="text-[10px] text-gray-500">${levelObj[0].ja}</p></div>`;
    };
    expressionsHtml += createLevelHtml(diff.modelExpressions.elementary, '小学生', 'green') + createLevelHtml(diff.modelExpressions.junior_high, '中学生', 'blue') + createLevelHtml(diff.modelExpressions.high_school, '高校生', 'pink');

    const popup = document.createElement('div');
    popup.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 border-pink-300 p-5 md:p-6 z-[100] w-[90%] max-w-sm animate-fade-in-up flex flex-col';
    popup.innerHTML = `<button class="absolute top-3 right-4 text-gray-300 hover:text-gray-600 font-black text-2xl transition-colors" onclick="document.getElementById('tutorial-overlay').innerHTML=''; document.getElementById('tutorial-overlay').classList.add('pointer-events-none');">×</button><h4 class="font-black text-pink-500 border-b-2 border-pink-50 pb-2 mb-3 pr-6 text-lg">🎯 ${diff.nameJa}</h4><div class="space-y-1 mb-4">${expressionsHtml}</div><p class="text-xs text-gray-400 font-bold text-center bg-gray-50 p-2 rounded-lg">本番では、マイクに向かってこのように英語で発話します！🎙️</p>`;

    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/10 z-[99] transition-opacity';
    backdrop.onclick = () => { overlay.innerHTML = ''; overlay.classList.add('pointer-events-none'); };
    overlay.appendChild(backdrop); overlay.appendChild(popup);
    try { if (typeof playSound === 'function') playSound('match'); } catch(e) {}
}

window.startGameWithTheme = async function(id) {
    const detUi = document.getElementById('detective-ui'); if (detUi) detUi.remove(); 
    if (typeof window.DetectiveGame !== 'undefined') { window.DetectiveGame.isActive = false; if (window.DetectiveGame.timerInterval) clearInterval(window.DetectiveGame.timerInterval); }
    const statsGrid = document.querySelector('#view-play .grid.grid-cols-3'); if (statsGrid) { statsGrid.style.display = ''; statsGrid.classList.remove('hidden'); }
    const compBar = document.getElementById('live-completion-text'); if (compBar) { const c = compBar.closest('.bg-white'); if (c) { c.style.display = ''; c.classList.remove('hidden'); } }

    try {
        let folderPath = 'data/themes';
        if (window.appState.selectedMode === 'mosaic') folderPath = 'data/mosaic';
        if (window.appState.selectedMode === 'detective') folderPath = 'data/detective';
        if (window.appState.selectedMode === 'oralquest') folderPath = 'data/oralquest'; 

        const res = await fetch(`${folderPath}/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        window.currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) { alert(`データの読み込みに失敗しました。`); return; }
    
    const promptImage = document.getElementById('prompt-image');
    if (window.currentTheme && window.currentTheme.imageSrc && promptImage) {
        promptImage.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;
        if (window.appState.selectedMode === 'mosaic') {
            promptImage.classList.remove('blur-none', 'blur-md'); promptImage.style.filter = `blur(${window.MosaicGame ? window.MosaicGame.maxBlur : 40}px)`; promptImage.style.transform = 'scale(1.1)';
        } else if (window.appState.selectedMode === 'detective') {
            if (typeof window.DetectiveGame !== 'undefined') window.DetectiveGame.init(window.currentTheme);
        } else {
            promptImage.style.filter = ''; promptImage.style.transform = ''; promptImage.style.height = ''; promptImage.style.objectFit = ''; promptImage.style.objectPosition = ''; promptImage.style.top = ''; promptImage.style.bottom = '';
            promptImage.classList.remove('w-1/2'); promptImage.classList.add('w-full');
            const promptImageB = document.getElementById('prompt-image-b'); if (promptImageB) { promptImageB.classList.add('hidden'); promptImageB.style.height = ''; promptImageB.style.objectFit = ''; promptImageB.style.objectPosition = ''; promptImageB.style.bottom = ''; }
            promptImage.classList.remove('blur-none'); promptImage.classList.add('blur-md'); 
        }
    }
    
    window.timeLeft = window.appState.customTimeLimit || 30; 
    const timerText = document.getElementById('timer-text'); if(timerText) timerText.textContent = `${window.timeLeft}s`; 
    window.timeElapsed = 0; window.rawTranscriptForCounting = ""; window.accumulatedTranscript = ""; 
    
    if(typeof window.resetScore === 'function') window.resetScore(); 
    if(document.getElementById('scoreDisplay')) document.getElementById('scoreDisplay').textContent = "0"; 
    if(document.getElementById('wordCountDisplay')) document.getElementById('wordCountDisplay').textContent = "0";
    if(document.getElementById('liveWpmDisplay')) document.getElementById('liveWpmDisplay').textContent = "0";
    if(document.getElementById('live-completion-bar')) document.getElementById('live-completion-bar').style.width = '0%';
    if(document.getElementById('live-completion-text')) document.getElementById('live-completion-text').textContent = '0%';
    if(document.getElementById('pin-container')) document.getElementById('pin-container').innerHTML = ''; 
    if(document.getElementById('support-text-container')) document.getElementById('support-text-container').innerHTML = '';
    
    if (window.appState.selectedMode === 'ngword' && typeof ngWordGame !== 'undefined') ngWordGame.init(window.currentTheme);
    else if (typeof ngWordGame !== 'undefined') ngWordGame.cleanup();

    const transcriptBox = document.getElementById('transcript-box');
    const existingHint = document.getElementById('mosaic-hint-panel'); if (existingHint) existingHint.remove();

    if(transcriptBox) {
        if (window.appState.selectedMode === 'mosaic') {
            const hintPanel = document.createElement('div'); hintPanel.id = 'mosaic-hint-panel'; hintPanel.className = 'mb-2 md:mb-3 bg-pink-50 border border-pink-100 rounded-xl p-2 md:p-3 shadow-sm shrink-0 z-10';
            hintPanel.innerHTML = `<span class="text-pink-500 font-black mb-2 block tracking-wider text-xs md:text-sm">💡 言葉に詰まったら使ってみよう！</span><div class="space-y-2"><div class="flex flex-wrap gap-1.5 items-center"><span class="text-[10px] md:text-xs font-black text-pink-400 border border-pink-200 bg-white px-1.5 py-0.5 rounded uppercase tracking-wider">推測</span><span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">It looks like ~</span> <span class="text-gray-500">(〜に見える)</span></span><span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">Maybe it's ~</span> <span class="text-gray-500">(たぶん〜)</span></span></div></div>`;
            transcriptBox.parentNode.insertBefore(hintPanel, transcriptBox);
            transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and guess the picture!<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して推測してみよう）</span></p>`;
        } else {
            transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and speak loudly.<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して、大きな声で話しましょう）</span></p>`;
        }
    }

    const btnStartTurn = document.getElementById('btn-start-turn');
    const btnFinishTurn = document.getElementById('btn-finish-turn');
    const recIndicator = document.getElementById('recording-indicator');
    
    if(btnStartTurn) { btnStartTurn.classList.remove('hidden'); btnStartTurn.classList.add('animate-attention'); }
    if(btnFinishTurn) btnFinishTurn.classList.add('hidden'); 
    if(recIndicator) recIndicator.classList.add('hidden'); 
    
    if (window.appState.selectedMode === 'oralquest') {
        if (typeof showView === 'function') showView(document.getElementById('view-oralquest'));
        if (typeof window.OralQuestGame !== 'undefined') window.OralQuestGame.init();
    } else {
        if (typeof showView === 'function') showView(document.getElementById('view-play'));
    }
};

window.playResultTTS = function(text) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.8; 
    const voices = speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) || voices.find(v => v.lang === 'en-US' && v.name.includes('Siri')) || voices.find(v => v.lang.startsWith('en'));
    if (bestVoice) u.voice = bestVoice;
    speechSynthesis.speak(u);
};

window.changeTranscriptSize = function(delta) {
    const el = document.getElementById('final-transcript-text'); if (!el) return;
    let currentSize = parseInt(window.getComputedStyle(el).fontSize);
    let newSize = currentSize + (delta * 4); 
    if (newSize >= 12 && newSize <= 48) { el.style.fontSize = newSize + 'px'; el.style.lineHeight = '1.6'; }
};

window.finishGameAndShowResult = function() {
    try {
        if(typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        if (typeof ngWordGame !== 'undefined') ngWordGame.cleanup();

        const btnFinishTurn = document.getElementById('btn-finish-turn'); if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        const recIndicator = document.getElementById('recording-indicator'); if(recIndicator) recIndicator.classList.add('hidden');
        
        if (window.appState.selectedMode === 'detective') {
            if (typeof window.DetectiveResult !== 'undefined') window.DetectiveResult.render(window.currentTheme, window.DetectiveGame.foundIds);
        } else window.renderSnapshotResult();
        
        const viewResultEl = document.getElementById('view-result');
        if (typeof showView === 'function') showView(viewResultEl);
        else {
            document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
            if(viewResultEl) viewResultEl.classList.remove('hidden');
        }
    } catch (error) {
        document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-result').classList.remove('hidden');
    }
};

window.renderSnapshotResult = function() {
    let stats = null;
    if(typeof window.getCompletionStats === 'function') stats = window.getCompletionStats(window.currentTheme, window.appState.selectedLevel);
    
    const box = document.getElementById('transcript-box');
    const finalTranscript = (box && box.innerText) ? box.innerText.replace("Press START and speak loudly.（STARTを押して、大きな声で話しましょう）", "").replace("Press START and guess the picture!（STARTを押して推測してみよう）", "").trim() : "";
    const container = document.getElementById('ranking-container'); if (!container) return;

    const totalWords = finalTranscript ? finalTranscript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w).length : 0;
    const wpm = window.appState.customTimeLimit > 0 ? Math.round(totalWords / (window.appState.customTimeLimit / 60)) : 0;

    let html = `<div class="flex flex-col lg:flex-row gap-4 sm:gap-6 h-full w-full max-w-[120rem] mx-auto px-3 sm:px-5 xl:px-8"><div class="w-full lg:w-[280px] xl:w-[360px] flex flex-col gap-3 sm:gap-4 shrink-0 pb-4 lg:pb-0 h-full"><div class="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center shadow-xl text-white relative overflow-hidden"><span class="text-6xl sm:text-7xl font-black">${stats ? stats.completionRate : 0}<span class="text-3xl">%</span></span><p class="text-xs sm:text-sm font-bold text-white/90 mt-3 text-center">写真の情報をどれだけくわしく伝えられたかのスコアです。</p></div><div class="bg-gray-50 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-inner border border-gray-200 flex-1 overflow-y-auto relative min-h-[120px]"><div class="flex justify-between items-center mb-2"><span class="text-gray-400 font-extrabold text-[9px] sm:text-[10px] tracking-widest uppercase block">あなたが話した英語</span><div class="flex gap-1.5"><button onclick="window.changeTranscriptSize(-1)" class="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center">－</button><button onclick="window.changeTranscriptSize(1)" class="w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center">＋</button></div></div><div id="final-transcript-text" class="font-medium text-gray-700 italic">"${finalTranscript || 'No speech recorded.'}"</div></div></div><div class="w-full flex-1 flex flex-col h-full overflow-hidden"><h3 class="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-widest">次へのステップアップ (詳細は省略)</h3></div></div>`;
    container.innerHTML = html;
};

// ==========================================
// ★ 音声・エフェクト関連
// ==========================================
window.playSuccessChime = function() { try { const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)(); window.audioCtx = ctx; if (ctx.state === 'suspended') ctx.resume(); const osc1 = ctx.createOscillator(); const gainNode = ctx.createGain(); osc1.connect(gainNode); gainNode.connect(ctx.destination); const now = ctx.currentTime; gainNode.gain.setValueAtTime(0, now); gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6); osc1.frequency.setValueAtTime(987.77, now); osc1.start(now); osc1.stop(now + 0.6); } catch (e) {} };
window.playTapSound = function() { try { const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)(); window.audioCtx = ctx; if (ctx.state === 'suspended') ctx.resume(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.frequency.setValueAtTime(600, ctx.currentTime); gainNode.gain.setValueAtTime(0, ctx.currentTime); gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); } catch (e) {} };
window.createConfetti = function() { const colors = ['#4ade80', '#60a5fa', '#facc15', '#f87171', '#a78bfa', '#fb923c']; for (let i = 0; i < 100; i++) { const confetti = document.createElement('div'); confetti.className = 'confetti-piece'; confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; confetti.style.left = Math.random() * 100 + 'vw'; confetti.style.setProperty('--x-end', (Math.random() - 0.5) * 40 + 'vw'); confetti.style.setProperty('--rot-end', (Math.random() - 0.5) * 720 + 'deg'); confetti.style.animationDelay = Math.random() * 0.5 + 's'; document.body.appendChild(confetti); confetti.addEventListener('animationend', () => confetti.remove()); } };
window.showExcellentPrompt = function() { const prompt = document.createElement('div'); prompt.className = 'excellent-prompt'; prompt.innerText = 'Excellent!!'; document.body.appendChild(prompt); prompt.addEventListener('animationend', () => prompt.remove()); };

// ==========================================
// ★ 練習ポップアップ処理
// ==========================================
window.closePracticeModal = function() { window.appState.isPracticeMode = false; if (window.isPracticeRecording && window.practiceRec) { try { window.practiceRec.stop(); } catch(e){} } window.isPracticeRecording = false; const modal = document.getElementById('practice-modal'); if (modal) modal.classList.add('hidden'); };
window.togglePracticeRecording = function() { /* 省略（通常コード）*/ };
window.openPractice = function(text, ja) {
    window.appState.isPracticeMode = true; window.appState.practiceTargetText = text; window.appState.practiceRawTranscript = ""; window.practiceSuccess = false; 
    const modal = document.getElementById('practice-modal'); if (!modal) return;
    const targetEl = document.getElementById('practice-target'); const jaEl = document.getElementById('practice-ja'); const transcriptEl = document.getElementById('practice-transcript'); const feedbackEl = document.getElementById('practice-feedback'); const btn = document.getElementById('btn-start-practice');
    if(targetEl) targetEl.textContent = text; if(jaEl) jaEl.textContent = ja;
    if(transcriptEl) { transcriptEl.innerHTML = "Tap START and speak..."; transcriptEl.style.color = ""; }
    if(feedbackEl) { feedbackEl.classList.add('hidden'); feedbackEl.innerHTML = ""; }
    if(btn) { btn.innerHTML = 'START'; }
    modal.classList.remove('hidden');
};

// ==========================================
// ★ 事前練習モード (Pre-Practice) ロジック
// ==========================================
window.tempSelectedThemeId = null;
window.prePracticeCurrentType = 'words';

window.startPrePracticeWithTheme = async function(id) {
    try {
        let folderPath = 'data/themes';
        if (window.appState.selectedMode === 'mosaic') folderPath = 'data/mosaic';
        if (window.appState.selectedMode === 'detective') folderPath = 'data/detective';
        const res = await fetch(`${folderPath}/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        window.currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) { alert(`データの読み込みに失敗しました。`); return; }

    const preImg = document.getElementById('pre-practice-image');
    if(preImg) preImg.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;

    window.prePracticeCurrentType = 'words';
    window.renderPrePracticeList();

    document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-pre-practice').classList.remove('hidden');
};

window.renderPrePracticeList = function() {
    if (!window.currentTheme) return;
    document.querySelectorAll('.pre-level-btn').forEach(b => {
        if (b.getAttribute('data-level') === window.appState.selectedLevel) { b.classList.add('bg-pink-500', 'text-white'); b.classList.remove('text-gray-500'); }
        else { b.classList.add('text-gray-500'); b.classList.remove('bg-pink-500', 'text-white'); }
    });
    document.querySelectorAll('.pre-type-btn').forEach(b => {
        if (b.getAttribute('data-type') === window.prePracticeCurrentType) { b.classList.add('text-blue-600', 'border-blue-500'); b.classList.remove('text-gray-400'); }
        else { b.classList.add('text-gray-400'); b.classList.remove('text-blue-600', 'border-blue-500'); }
    });

    const targetData = window.getAggregatedData(window.currentTheme, window.appState.selectedLevel);
    document.getElementById('count-words').innerText = targetData.words ? targetData.words.length : 0;
    document.getElementById('count-chunks').innerText = targetData.chunks ? targetData.chunks.length : 0;
    document.getElementById('count-sentences').innerText = targetData.sentences ? targetData.sentences.length : 0;

    const listContainer = document.getElementById('pre-practice-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    let items = [];
    if (window.prePracticeCurrentType === 'words') items = targetData.words;
    else if (window.prePracticeCurrentType === 'chunks') items = targetData.chunks;
    else if (window.prePracticeCurrentType === 'sentences') items = targetData.sentences;

    if (!items || items.length === 0) { listContainer.innerHTML = '<p class="text-center text-gray-400 font-bold py-10 mt-10">このレベルのデータはありません。</p>'; return; }

    items.forEach(item => {
        const escapedText = item.text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const escapedJa = (item.ja || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
        listContainer.innerHTML += `<div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-3"><div class="flex-1 pr-2"><div class="font-black text-gray-800 text-base md:text-lg leading-tight">${item.text}</div><div class="text-xs md:text-sm font-bold text-gray-500 mt-1">${item.ja || ""}</div></div><div class="flex items-center gap-2 shrink-0"><button onclick="window.playResultTTS('${escapedText}')" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs md:text-sm font-bold text-gray-700 shadow-sm">🔊 聞く</button><button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs md:text-sm font-bold shadow-sm">🎤 練習</button></div></div>`;
    });
};

// ==========================================
// ★ 授業モード（Classroom Mode）ロジック
// ==========================================
window.currentClassroomAudio = null;

window.openClassroomMode = function() {
    // 現在の画面（事前練習画面など）をすべて隠す
    document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
    
    // 授業モード画面を表示する
    const classroomView = document.getElementById('view-classroom');
    if (classroomView) {
        classroomView.classList.remove('hidden');
    }
    
    if (window.currentTheme) {
        const imgEl = document.getElementById('classroom-image');
        if(imgEl) imgEl.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;
        window.renderClassroomList();
    }
};

window.renderClassroomList = function() {
    document.querySelectorAll('.class-level-btn').forEach(b => {
        if (b.getAttribute('data-level') === window.appState.selectedLevel) { b.classList.add('bg-pink-500', 'text-white'); b.classList.remove('text-gray-400'); }
        else { b.classList.remove('bg-pink-500', 'text-white'); b.classList.add('text-gray-400'); }
    });

    const targetData = window.getAggregatedData(window.currentTheme, window.appState.selectedLevel);
    const listContainer = document.getElementById('classroom-sentence-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!targetData.sentences || targetData.sentences.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-center mt-10">データがありません。</p>';
        return;
    }

    targetData.sentences.forEach((sentence, index) => {
        const escapedText = sentence.text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const escapedJa = (sentence.ja || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const audioSrc = sentence.audioSrc || ''; 

        listContainer.innerHTML += `
            <div class="bg-gray-700/50 rounded-2xl p-4 border border-gray-600 hover:border-gray-500 transition-colors mb-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-gray-400 font-bold text-sm">Sentence ${index + 1}</span>
                    <button onclick="window.playClassroomAudio('${audioSrc}', '${escapedText}')" class="bg-pink-500 hover:bg-pink-400 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-transform hover:scale-110"><svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg></button>
                </div>
                <div class="classroom-text-reveal cursor-pointer group" onclick="this.classList.toggle('revealed')">
                    <div class="text-gray-500 text-sm font-bold border-2 border-dashed border-gray-600 rounded-xl p-3 text-center group-[.revealed]:hidden hover:bg-gray-600/30">👀 クリックして英文を表示</div>
                    <div class="hidden group-[.revealed]:block">
                        <p class="text-white font-black text-lg md:text-xl leading-tight mb-2">${sentence.text}</p>
                        <p class="text-gray-400 text-sm font-bold">${sentence.ja}</p>
                    </div>
                </div>
            </div>
        `;
    });
};

window.playClassroomAudio = function(audioSrc, fallbackText) {
    if (window.currentClassroomAudio) { window.currentClassroomAudio.pause(); window.currentClassroomAudio.currentTime = 0; }
    if (audioSrc) {
        window.currentClassroomAudio = new Audio(audioSrc);
        window.currentClassroomAudio.play().catch(e => { window.playResultTTS(fallbackText); });
    } else window.playResultTTS(fallbackText);
};

// ==========================================
// ★ 1つにまとめた完全版・クリックイベントリスナー ★
// ==========================================
document.addEventListener('click', (e) => {
    
    if (e.target.closest('.sns-btn') || e.target.closest('.mode-btn') || e.target.closest('.level-btn') || e.target.closest('#rabbit-char') || e.target.closest('.action-btn-back') || e.target.closest('.action-btn-home') || e.target.closest('.theme-filter-btn') || e.target.closest('.pre-type-btn') || e.target.closest('.pre-level-btn')) {
        if(typeof window.playTapSound === 'function') window.playTapSound();
    }

    // --- フィルター ---
    const filterBtn = e.target.closest('.theme-filter-btn');
    if (filterBtn) {
        document.querySelectorAll('.theme-filter-btn').forEach(b => { b.classList.remove('bg-gray-800', 'text-white', 'shadow-md'); b.classList.add('bg-white', 'text-gray-500'); });
        filterBtn.classList.remove('bg-white', 'text-gray-500'); filterBtn.classList.add('bg-gray-800', 'text-white', 'shadow-md');
        const selectedFilter = filterBtn.getAttribute('data-filter');
        document.querySelectorAll('.theme-card').forEach(card => {
            const cardCat = card.getAttribute('data-category');
            if (selectedFilter === 'all') card.style.display = (cardCat === 'other') ? 'none' : '';
            else if (selectedFilter === 'level1') card.style.display = (cardCat === 'other') ? '' : 'none';
            else card.style.display = (cardCat === selectedFilter) ? '' : 'none';
        });
        return;
    }

    // --- 事前練習（Pre-Practice）のタブ ---
    const preLevelBtn = e.target.closest('.pre-level-btn');
    if (preLevelBtn) {
        window.appState.selectedLevel = preLevelBtn.getAttribute('data-level'); window.renderPrePracticeList();
        document.querySelectorAll('.level-btn').forEach(b => { 
            if (b.getAttribute('data-level') === window.appState.selectedLevel) { b.classList.remove('bg-gray-50', 'border-gray-200', 'text-gray-700'); b.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); } 
            else { b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700'); }
        });
        return;
    }
    const preTypeBtn = e.target.closest('.pre-type-btn');
    if (preTypeBtn) { window.prePracticeCurrentType = preTypeBtn.getAttribute('data-type'); window.renderPrePracticeList(); return; }

    // --- モード選択ボタン ---
    const modeBtn = e.target.closest('.mode-btn');
    if (modeBtn) {
        const selectedMode = modeBtn.getAttribute('data-mode'); if (!selectedMode) return; 
        window.appState.selectedMode = selectedMode;
        if (selectedMode === 'story') { window.location.href = 'story.html'; return; }
        
        const elementaryBtn = document.querySelector('.level-btn[data-level="elementary"]');
        if (elementaryBtn) {
            document.querySelectorAll('.level-btn').forEach(b => { b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700'); });
            elementaryBtn.classList.remove('bg-gray-50', 'border-gray-200', 'text-gray-700'); elementaryBtn.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            window.appState.selectedLevel = 'elementary';
        }
        if (typeof showView === 'function') showView(document.getElementById('view-select')); 
        if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        return;
    }

    // --- ホーム / 戻るボタン ---
    const btnHome = e.target.closest('.action-btn-home');
    if (btnHome) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech(); window.isRecording = false; clearInterval(window.gameTimer); if(window.supportInterval) clearInterval(window.supportInterval);
        window.closePracticeModal();
        if (typeof showView === 'function') showView(document.getElementById('view-start'));
        return;
    }
    const btnBack = e.target.closest('.action-btn-back');
    if (btnBack) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech(); window.isRecording = false; clearInterval(window.gameTimer); if(window.supportInterval) clearInterval(window.supportInterval);
        if (typeof showView === 'function') showView(document.getElementById('view-select'));
        if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        return;
    }

    // --- 画像選択 -> モードポップアップ ---
    const themeCard = e.target.closest('.theme-card');
    if (themeCard) {
        const themeId = themeCard.getAttribute('data-id');
        if (themeId) { window.tempSelectedThemeId = themeId; document.getElementById('mode-select-modal').classList.remove('hidden'); }
        return;
    }

    // --- ポップアップ：「事前練習モード」へ ---
    const btnChoosePractice = e.target.closest('#btn-choose-practice');
    if (btnChoosePractice) {
        document.getElementById('mode-select-modal').classList.add('hidden');
        if (window.tempSelectedThemeId) window.startPrePracticeWithTheme(window.tempSelectedThemeId);
        return;
    }

    // --- ポップアップ：「本番モード」へ ---
    const btnChooseChallenge = e.target.closest('#btn-choose-challenge');
    if (btnChooseChallenge) {
        document.getElementById('mode-select-modal').classList.add('hidden');
        if (window.tempSelectedThemeId) window.startGameWithTheme(window.tempSelectedThemeId);
        return;
    }

    // --- 事前練習画面からの遷移 ---
    const btnStartFromPractice = e.target.closest('#btn-start-from-practice');
    if (btnStartFromPractice) {
        document.getElementById('view-pre-practice').classList.add('hidden');
        if (window.tempSelectedThemeId) window.startGameWithTheme(window.tempSelectedThemeId);
        return;
    }

    // ★★★ 授業モードへ入るボタン ★★★
    const btnEnterClassroom = e.target.closest('#btn-enter-classroom');
    if (btnEnterClassroom) {
        window.openClassroomMode();
        return;
    }

    // ★★★ 授業モードを閉じるボタン ★★★
    const btnExitClassroom = e.target.closest('#btn-exit-classroom');
    if (btnExitClassroom) {
        if (window.currentClassroomAudio) window.currentClassroomAudio.pause();
        document.getElementById('view-classroom').classList.add('hidden');
        document.getElementById('view-pre-practice').classList.remove('hidden');
        return;
    }

    // 授業モード内のレベル切り替え
    const classLevelBtn = e.target.closest('.class-level-btn');
    if (classLevelBtn) {
        window.appState.selectedLevel = classLevelBtn.getAttribute('data-level');
        window.renderClassroomList();
        return;
    }

    // --- ゲームプレイ ---
    const btnStartTurn = e.target.closest('#btn-start-turn');
    if (btnStartTurn) {
        if(typeof window.startSpeech === 'function') window.startSpeech(); window.isRecording = true;
        btnStartTurn.classList.remove('animate-attention'); btnStartTurn.classList.add('hidden');
        const recIndicator = document.getElementById('recording-indicator'); if(recIndicator) recIndicator.classList.remove('hidden');
        const statusText = document.getElementById('status-text'); if(statusText) statusText.textContent = "Speak Now!";
        const promptImage = document.getElementById('prompt-image'); if(promptImage) { promptImage.classList.remove('blur-md'); promptImage.classList.add('blur-none'); }
        const supportToggle = document.getElementById('support-toggle');
        if (window.timeElapsed === 0 && supportToggle && supportToggle.checked) {
            if(typeof window.getAggregatedData === 'function') { const targetData = window.getAggregatedData(window.currentTheme, window.appState.selectedLevel); if(typeof window.dropPin === 'function') { targetData.words.forEach(w => window.dropPin(w.text, window.currentTheme, true)); } }
            window.supportInterval = setInterval(window.triggerSupportHint, 6000);
        }
        if (window.timeElapsed === 0 && typeof window.startTimer === 'function') window.startTimer();
        return;
    }
    const recIndicator = e.target.closest('#recording-indicator');
    if (recIndicator) { if(typeof window.stopSpeech === 'function') window.stopSpeech(); window.isRecording = false; return; }
    const btnFinishTurn = e.target.closest('#btn-finish-turn');
    if (btnFinishTurn) { window.finishGameAndShowResult(); return; }
    
    const btnPlayAgain = e.target.closest('#btn-play-again');
    if (btnPlayAgain) {
        const finishBtn = document.getElementById('btn-finish-turn'); if(finishBtn) finishBtn.classList.add('hidden');
        const rInd = document.getElementById('recording-indicator'); if(rInd) rInd.classList.add('hidden');
        const startBtn = document.getElementById('btn-start-turn'); if(startBtn) { startBtn.classList.remove('hidden'); startBtn.classList.add('animate-attention'); }
        const sText = document.getElementById('status-text'); if(sText) sText.textContent = "Ready";
        const pImage = document.getElementById('prompt-image');
        if (pImage) { if (window.appState.selectedMode === 'mosaic') { pImage.classList.remove('blur-none', 'blur-md'); pImage.style.filter = `blur(${window.MosaicGame ? window.MosaicGame.maxBlur : 40}px)`; pImage.style.transform = 'scale(1.1)'; } else { pImage.style.filter = ''; pImage.style.transform = ''; pImage.classList.remove('blur-none'); pImage.classList.add('blur-md'); } }
        if (typeof showView === 'function') showView(document.getElementById('view-select')); if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        return;
    }

    // --- ORAL QUEST ---
    const btnOqStart = e.target.closest('#btn-oq-start');
    if (btnOqStart) { if (typeof window.OralQuestGame !== 'undefined') { window.OralQuestGame.startRecording(); window.isRecording = true; } return; }
    const oqIndicator = e.target.closest('#oq-recording-indicator');
    if (oqIndicator) { if (typeof window.OralQuestGame !== 'undefined') window.OralQuestGame.stopRecording(); return; }
    const btnOqNext = e.target.closest('#btn-oq-next');
    if (btnOqNext) { if (typeof window.OralQuestGame !== 'undefined') window.OralQuestGame.handleNextButton(); return; }
});

function setupOqPasswordLock() {
    const oqBtn = document.querySelector('.mode-btn[data-mode="oralquest"]');
    if (oqBtn) {
        oqBtn.addEventListener('click', (e) => {
            const pass = prompt("ORAL QUESTは現在開発中です。テスト用パスワードを入力してください:");
            if (pass !== "9999") { e.stopImmediatePropagation(); e.preventDefault(); alert("パスワードが違います。"); }
        }, true); 
    }
}
window.addEventListener('DOMContentLoaded', window.initApp);
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupOqPasswordLock); } else { setupOqPasswordLock(); }