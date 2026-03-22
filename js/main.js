// js/main.js
// ==========================================
// アプリケーションの司令塔
// ==========================================

window.appState = { 
    selectedMode: null,
    selectedLevel: 'elementary', // ★初期値を小学生(elementary)に設定
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
window.practiceSuccess = false; // リアルタイム成功判定フラグ

const viewStart = document.getElementById('view-start');
const viewSelect = document.getElementById('view-select'); 
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');
const viewAbout = document.getElementById('view-about');
const themeGrid = document.getElementById('theme-grid'); 

// ==========================================
// ★ 紙吹雪＆Excellentポップアップ用のCSSを動的に追加
// ==========================================
(function injectSpecialEffectsCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        .confetti-piece {
            position: fixed;
            width: 10px;
            height: 10px;
            top: -10px;
            z-index: 9999;
            opacity: 0.8;
            border-radius: 2px;
            animation: confetti-fall 3s ease-out forwards;
            pointer-events: none;
        }
        @keyframes confetti-fall {
            0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) translateX(var(--x-end)) rotate(var(--rot-end)); opacity: 0; }
        }

        .excellent-prompt {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-family: 'Arial Black', 'Helvetica Bold', sans-serif;
            font-size: 10vw;
            font-weight: 900;
            color: #ffffff;
            text-shadow: 0 0 20px rgba(74, 222, 128, 0.8), 0 0 40px #22c55e;
            background: linear-gradient(to bottom right, #4ade80, #22c55e);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            letter-spacing: -0.05em;
            animation: excellent-pop 1.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes excellent-pop {
            0% { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; }
            15% { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); opacity: 1; }
            25% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
            80% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(0.8) rotate(0deg); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

async function initApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("【重要】お使いのブラウザは音声認識に非対応です。Google Chromeをご利用ください。");
        return; 
    }
    if (typeof window.initSpeechRecognition === 'function') {
        window.initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    }
    try {
        const response = await fetch('data/theme_list.json?t=' + new Date().getTime());
        window.themeList = await response.json();
    } catch (error) { console.error("テーマリスト読み込み失敗:", error); }
}

window.renderThemeGrid = async function() {
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-xl md:text-2xl">Loading Images...</div>';
    try {
        const fetchPromises = window.themeList.map(id => 
            fetch(`data/themes/${id}.json?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => ({ id, data: Array.isArray(data) ? data[0] : data }))
            .catch(e => null)
        );
        const results = await Promise.all(fetchPromises);
        let html = '';
        results.forEach(item => {
            if(!item || !item.data) return;
            let titleText = item.data.description || item.data.titleJa || '名称未設定';
            html += `<div class="theme-card cursor-pointer rounded-2xl md:rounded-3xl overflow-hidden shadow-md border-4 border-transparent hover:border-pink-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" data-id="${item.id}">
                <div class="relative w-full aspect-video bg-gray-100 shrink-0 pointer-events-none">
                    <img src="${item.data.imageSrc}" class="absolute inset-0 w-full h-full object-cover pointer-events-none">
                </div>
                <div class="p-3 md:p-4 text-center text-xs md:text-sm lg:text-base font-black text-gray-700 line-clamp-2 border-t border-gray-100 flex-1 flex items-center justify-center leading-tight bg-white pointer-events-none">${titleText}</div>
            </div>`;
        });
        themeGrid.innerHTML = html;
    } catch(e) { themeGrid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading images</div>'; }
}

window.startGameWithTheme = async function(id) {
    try {
        const res = await fetch(`data/themes/${id}.json?t=` + new Date().getTime());
        const fetchedData = await res.json();
        window.currentTheme = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
    } catch (e) { alert(`データの読み込みに失敗しました。`); return; }
    
    const promptImage = document.getElementById('prompt-image');
    if (window.currentTheme && window.currentTheme.imageSrc && promptImage) {
        promptImage.src = window.currentTheme.imageSrc;
        promptImage.classList.remove('blur-none');
        promptImage.classList.add('blur-md'); 
    }
    
    window.timeLeft = window.appState.customTimeLimit || 30; 
    const timerText = document.getElementById('timer-text');
    if(timerText) timerText.textContent = `${window.timeLeft}s`; 
    
    window.timeElapsed = 0; window.rawTranscriptForCounting = ""; window.accumulatedTranscript = ""; 
    if(typeof resetScore === 'function') resetScore(); 
    
    if(document.getElementById('scoreDisplay')) document.getElementById('scoreDisplay').textContent = "0"; 
    if(document.getElementById('wordCountDisplay')) document.getElementById('wordCountDisplay').textContent = "0";
    if(document.getElementById('liveWpmDisplay')) document.getElementById('liveWpmDisplay').textContent = "0";
    if(document.getElementById('live-completion-bar')) document.getElementById('live-completion-bar').style.width = '0%';
    if(document.getElementById('live-completion-text')) document.getElementById('live-completion-text').textContent = '0%';
    if(document.getElementById('pin-container')) document.getElementById('pin-container').innerHTML = ''; 
    if(document.getElementById('support-text-container')) document.getElementById('support-text-container').innerHTML = '';
    
    const transcriptBox = document.getElementById('transcript-box');
    if(transcriptBox) transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and speak loudly.<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して、大きな声で話しましょう）</span></p>`;
    
    const btnStartTurn = document.getElementById('btn-start-turn');
    if(btnStartTurn) {
        btnStartTurn.classList.remove('hidden');
        btnStartTurn.classList.add('animate-attention');
    }
    
    if (typeof showView === 'function') showView(document.getElementById('view-play'));
}

window.playResultTTS = function(text) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.8; 
    const voices = speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')))
                   || voices.find(v => v.lang === 'en-US' && v.name.includes('Siri'))
                   || voices.find(v => v.lang.startsWith('en'));
    if (bestVoice) u.voice = bestVoice;
    speechSynthesis.speak(u);
};

window.changeTranscriptSize = function(delta) {
    const el = document.getElementById('final-transcript-text');
    if (!el) return;
    let currentSize = parseInt(window.getComputedStyle(el).fontSize);
    let newSize = currentSize + (delta * 4); 
    if (newSize >= 12 && newSize <= 48) { el.style.fontSize = newSize + 'px'; el.style.lineHeight = '1.6'; }
};

window.finishGameAndShowResult = function() {
    try {
        if(typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        
        const btnFinishTurn = document.getElementById('btn-finish-turn');
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        const recIndicator = document.getElementById('recording-indicator');
        if(recIndicator) recIndicator.classList.add('hidden');
        
        window.renderSnapshotResult();
        
        const viewResultEl = document.getElementById('view-result');
        if (typeof showView === 'function') {
            showView(viewResultEl);
        } else {
            document.querySelectorAll('body > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
            if(viewResultEl) viewResultEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Result画面への遷移中にエラーが発生:", error);
        document.querySelectorAll('body > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-result').classList.remove('hidden');
    }
};

// ==========================================
// ★ Result画面のレイアウト (タブレット md: 対応版)
// ==========================================
window.renderSnapshotResult = function() {
    
    let stats = null;
    if(typeof getCompletionStats === 'function') {
        stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel);
    } else {
        console.error("【警告】スコア計算機能(getCompletionStats)が見つかりません。scoring.jsの読み込み等を確認してください。");
    }
    
    const box = document.getElementById('transcript-box');
    const finalTranscript = (box && box.innerText) ? box.innerText.replace("Press START and speak loudly.（STARTを押して、大きな声で話しましょう）", "").trim() : "";

    const container = document.getElementById('ranking-container');
    if (!container) return;

    let categoryHtml = "";
    
    const catDict = {
        "object": { title: "🧍 モノ・人（名詞）", advice: "写真に写っているものを言葉にしてみよう！", style: { light: "bg-green-50", border: "border-green-200", text: "text-green-700", bar: "bg-green-500", btnBg: "bg-green-100" } },
        "attribute": { title: "🎨 ようす・色（形容詞）", advice: "どんな色？どんな状態？をくわしく伝えてみよう！", style: { light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", bar: "bg-orange-500", btnBg: "bg-orange-100" } },
        "detail": { title: "🔍 くわしい背景（前置詞など）", advice: "どこにある？まわりに何がある？を説明しよう！", style: { light: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", bar: "bg-purple-500", btnBg: "bg-purple-100" } },
        "gist": { title: "🎬 メインの動き（動詞）", advice: "一番目立つアクションや出来事を伝えてみよう！", style: { light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", bar: "bg-blue-500", btnBg: "bg-blue-100" } },
        "inference": { title: "💭 ふんいき・推測", advice: "目に見えない「気持ち」や「ふんいき」を想像してみよう！", style: { light: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", bar: "bg-pink-500", btnBg: "bg-pink-100" } },
        "other": { title: "📦 その他", advice: "その他の表現", style: { light: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", bar: "bg-gray-500", btnBg: "bg-gray-200" } }
    };

    if (stats && stats.categories) {
        Object.entries(stats.categories).forEach(([key, cat]) => {
            if (!cat || (cat.cleared.length === 0 && cat.missed.length === 0)) return;
            const dict = catDict[key] || catDict["other"];
            const style = dict.style;
            const totalInCat = cat.cleared.length + cat.missed.length;
            const catMatchRate = cat.matchRate !== undefined ? cat.matchRate : (totalInCat === 0 ? 0 : Math.floor((cat.cleared.length / totalInCat) * 100));
            
            if(cat.missed) cat.missed.sort((a, b) => (b.points || 0) - (a.points || 0));

            let missedItemsHtml = "";
            let clearedItemsHtml = "";
            const previewCount = 3; 

            cat.cleared.forEach(item => {
                const safeText = item.text ? String(item.text) : "";
                const safeJa = item.ja ? String(item.ja) : "";
                const escapedText = safeText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const escapedJa = safeJa.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                clearedItemsHtml += `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 ${style.light} p-4 rounded-xl border ${style.border} shadow-sm">
                        <div class="flex-1 pr-2">
                            <div class="text-base md:text-lg font-black ${style.text} tracking-wide">${safeText} <span class="text-2xl ml-1">✅</span></div>
                            <div class="text-sm md:text-base font-bold ${style.text} opacity-80 mt-1">${safeJa}</div>
                        </div>
                        <div class="flex gap-2 shrink-0 mt-2 sm:mt-0">
                            <button onclick="window.playResultTTS('${escapedText}')" class="px-4 py-2 bg-white/80 hover:bg-white rounded-xl text-sm font-bold ${style.text} transition-colors flex items-center justify-center gap-1 shadow-sm border ${style.border}">🔊 発音</button>
                            <button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-bold text-blue-700 transition-colors flex items-center justify-center gap-1 shadow-sm border border-blue-200">🎤 練習</button>
                        </div>
                    </div>`;
            });

            cat.missed.forEach((item, index) => {
                const isHidden = index >= previewCount ? "hidden missed-item-card" : "missed-item-card";
                const safeText = item.text ? String(item.text) : "";
                const safeJa = item.ja ? String(item.ja) : "";
                const escapedText = safeText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const escapedJa = safeJa.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                missedItemsHtml += `
                    <div class="${isHidden} flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 bg-white p-4 rounded-xl border ${style.border} shadow-sm">
                        <div class="flex items-start gap-3 flex-1">
                            <span class="${style.text} font-black text-2xl shrink-0">💡</span>
                            <div class="flex-1 pr-2">
                                <div class="text-base md:text-lg font-black text-gray-800 tracking-wide">${safeText}</div>
                                <div class="text-sm md:text-base font-bold text-gray-500 mt-1">${safeJa}</div>
                            </div>
                        </div>
                        <div class="flex gap-2 shrink-0 mt-2 sm:mt-0">
                            <button onclick="window.playResultTTS('${escapedText}')" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-colors flex items-center gap-1 shadow-sm border border-gray-200">🔊 発音</button>
                            <button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-bold text-blue-700 transition-colors flex items-center gap-1 shadow-sm border border-blue-200">🎤 練習</button>
                        </div>
                    </div>`;
            });

            let showMoreBtn = "";
            if (cat.missed.length > previewCount) {
                showMoreBtn = `<button onclick="const items = this.parentElement.querySelectorAll('.hidden'); if(items.length > 0) { items.forEach(el => el.classList.remove('hidden')); this.innerHTML = '閉じる ⬆️'; } else { const allItems = this.parentElement.querySelectorAll('.missed-item-card'); allItems.forEach((el, i) => { if (i >= ${previewCount}) el.classList.add('hidden'); }); this.innerHTML = '他の表現も見る ➔'; }" class="w-full mt-2 py-3 text-sm md:text-base font-black ${style.text} ${style.btnBg} border ${style.border} rounded-xl transition-colors shadow-sm hover:opacity-80">他の表現も見る ➔</button>`;
            }

            let adviceTitleHtml = catMatchRate >= 100 
                ? `<span class="bg-gradient-to-r from-yellow-300 to-yellow-500 text-white px-3 py-1.5 rounded-lg shadow-sm font-black flex items-center gap-1 border border-yellow-400">🏆 100%達成！さらに高度な表現に挑戦！</span>`
                : `<span class="bg-white px-3 py-1.5 rounded-lg shadow-sm border ${style.border} ${style.text} flex items-center gap-1">💡 他にもこんな表現を使ってみよう！</span>`;

            categoryHtml += `
                <div class="bg-white rounded-3xl shadow-md border border-gray-200 relative transition-all flex flex-col h-auto">
                    <div class="absolute top-0 left-0 w-2 h-full ${style.bar} rounded-l-3xl"></div>
                    <div class="flex justify-between items-center p-5 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors" onclick="document.getElementById('cat-body-${key}').classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                        <div class="pl-2">
                            <h4 class="font-black text-gray-800 text-xl md:text-2xl">${dict.title}</h4>
                            <p class="text-xs md:text-sm font-bold text-gray-500 mt-1.5">${dict.advice}</p>
                        </div>
                        <div class="flex items-center gap-3 md:gap-4 shrink-0">
                            <span class="font-black ${style.text} text-3xl md:text-4xl">${catMatchRate}%</span>
                            <svg class="chevron w-7 h-7 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                    <div id="cat-body-${key}" class="px-5 md:px-6 pb-6 flex-1 flex flex-col">
                        <div class="flex items-center gap-3 mb-6 pl-2">
                            <div class="w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200 shadow-inner">
                                <div class="${style.bar} h-4 rounded-full transition-all duration-1000" style="width: ${catMatchRate}%"></div>
                            </div>
                        </div>
                        ${cat.cleared.length > 0 ? `<div class="mb-6 flex-1 pl-2"><div class="text-sm font-black text-gray-400 uppercase mb-3 flex items-center gap-2"><span class="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg shadow-sm">✅ 言えた表現</span></div><div class="max-h-80 overflow-y-auto pr-3 custom-scrollbar flex flex-col gap-2">${clearedItemsHtml}</div></div>` : ''}
                        ${cat.missed.length > 0 ? `<div class="bg-gray-50 rounded-2xl p-4 md:p-5 border border-gray-100 mt-4 ml-2"><div class="text-sm font-black mb-4 flex items-center">${adviceTitleHtml}</div><div class="flex flex-col gap-2">${missedItemsHtml}</div>${showMoreBtn}</div>` : `<div class="text-center py-8 bg-white rounded-2xl border ${style.border} shadow-sm mt-4 ml-2"><span class="text-6xl mb-4 block">✨🎉✨</span><span class="text-lg md:text-xl font-black ${style.text}">完璧！この分野の表現はすべてマスターしました！</span></div>`}
                    </div>
                </div>`;
        });
    }

    const totalWords = finalTranscript ? finalTranscript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w).length : 0;
    const wpm = window.appState.customTimeLimit > 0 ? Math.round(totalWords / (window.appState.customTimeLimit / 60)) : 0;

    // 👇 ここが重要！フレックスボックスの設定を lg: から md: に変更しています
    let html = `
        <div class="flex flex-col md:flex-row gap-6 md:gap-8 h-full w-full max-w-[120rem] mx-auto px-4 md:px-8 xl:px-12">
            <div class="w-full md:w-[350px] xl:w-[420px] flex flex-col gap-5 shrink-0 pb-4 md:pb-0 h-full">
                <div class="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-8 flex flex-col items-center shadow-xl text-white relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 opacity-10 text-9xl">📸</div>
                    <span class="text-white/90 font-extrabold text-sm tracking-widest mb-2 uppercase">総合達成度</span>
                    <span class="text-8xl font-black">${stats ? stats.completionRate : 0}<span class="text-4xl">%</span></span>
                    <p class="text-base font-bold text-white/90 mt-5 text-center">写真の情報をどれだけくわしく伝えられたかのスコアです。</p>
                </div>
                <div class="flex gap-5">
                    <div class="bg-white rounded-3xl p-6 flex flex-col items-center shadow-md border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[11px] xl:text-xs tracking-widest mb-2 uppercase">話した単語数</span>
                        <span class="text-4xl xl:text-5xl font-black text-gray-800">${totalWords}</span>
                    </div>
                    <div class="bg-white rounded-3xl p-6 flex flex-col items-center shadow-md border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[11px] xl:text-xs tracking-widest mb-2 uppercase text-center">話すスピード<br>(WPM)</span>
                        <span class="text-4xl xl:text-5xl font-black text-gray-800">${wpm || 0}</span>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-3xl p-6 shadow-inner border border-gray-200 flex-1 overflow-y-auto relative">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-400 font-extrabold text-[11px] xl:text-xs tracking-widest uppercase block">あなたが話した英語</span>
                        <div class="flex gap-2">
                            <button onclick="window.changeTranscriptSize(-1)" class="w-8 h-8 bg-white border border-gray-300 rounded-full text-gray-600 font-black hover:bg-gray-100 shadow-sm flex items-center justify-center transition-colors">－</button>
                            <button onclick="window.changeTranscriptSize(1)" class="w-8 h-8 bg-white border border-gray-300 rounded-full text-gray-600 font-black hover:bg-gray-100 shadow-sm flex items-center justify-center transition-colors">＋</button>
                        </div>
                    </div>
                    <div id="final-transcript-text" class="font-medium text-gray-700 italic transition-all duration-200" style="font-size: 1.125rem; line-height: 1.6;">"${finalTranscript || 'No speech recorded.'}"</div>
                </div>
            </div>
            <div class="w-full flex-1 flex flex-col h-full overflow-hidden">
                <div class="mb-5 pl-2 shrink-0">
                    <h3 class="text-base md:text-lg font-black text-gray-500 uppercase tracking-widest flex items-center gap-3 mb-2">
                        <span class="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                        次へのステップアップ
                    </h3>
                </div>
                <!-- 👇 ここも xl: から lg: に早めに2列になるよう変更 -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 overflow-y-auto pb-20 pr-4 custom-scrollbar content-start">
                    ${categoryHtml}
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
};

// ==========================================
// ★ キラキラ音を鳴らす関数
// ==========================================
window.playSuccessChime = function() {
    try {
        const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        window.audioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc1.frequency.setValueAtTime(987.77, now); // B5
        osc1.frequency.setValueAtTime(1318.51, now + 0.1); // E6
        
        osc2.frequency.setValueAtTime(987.77, now);
        osc2.frequency.setValueAtTime(1318.51, now + 0.1);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
    } catch (e) { console.error("Audio play failed", e); }
};

// ==========================================
// ★ 優しいタップ音（ポッ）を鳴らす関数
// ==========================================
window.playTapSound = function() {
    try {
        const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        window.audioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine'; // 丸みのある優しい音（サイン波）
        osc.frequency.setValueAtTime(600, ctx.currentTime); // 少し高めの音から
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1); // 一瞬で低く落とす（ポッという響き）

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); // 音量を一瞬で上げる
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); // 余韻を残さずすぐ消す

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.error("Tap sound failed", e); }
};

// ==========================================
// ★ 紙吹雪（Confetti）生成関数
// ==========================================
window.createConfetti = function() {
    const colors = ['#4ade80', '#60a5fa', '#facc15', '#f87171', '#a78bfa', '#fb923c'];
    const confettiCount = 100;
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.setProperty('--x-end', (Math.random() - 0.5) * 40 + 'vw'); 
        confetti.style.setProperty('--rot-end', (Math.random() - 0.5) * 720 + 'deg'); 
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        
        document.body.appendChild(confetti);
        confetti.addEventListener('animationend', () => { confetti.remove(); });
    }
};

// ==========================================
// ★ Excellent一瞬表示関数
// ==========================================
window.showExcellentPrompt = function() {
    const prompt = document.createElement('div');
    prompt.className = 'excellent-prompt';
    prompt.innerText = 'Excellent!!';
    document.body.appendChild(prompt);
    prompt.addEventListener('animationend', () => { prompt.remove(); });
};

// ==========================================
// ★ 練習ポップアップ処理
// ==========================================
window.closePracticeModal = function() {
    window.appState.isPracticeMode = false;
    if (window.isPracticeRecording && window.practiceRec) {
        try { window.practiceRec.stop(); } catch(e){}
    }
    window.isPracticeRecording = false;
    const modal = document.getElementById('practice-modal');
    if (modal) modal.classList.add('hidden');
};

window.togglePracticeRecording = function() {
    const btn = document.getElementById('btn-start-practice');
    const transcriptEl = document.getElementById('practice-transcript');
    
    let feedbackEl = document.getElementById('practice-feedback');
    if (!feedbackEl && transcriptEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'practice-feedback';
        transcriptEl.parentNode.parentNode.appendChild(feedbackEl);
    }

    if (!window.practiceRec) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        window.practiceRec = new SpeechRec();
        window.practiceRec.lang = 'en-US';
        window.practiceRec.interimResults = true;
        window.practiceRec.continuous = true; 
        
        window.practiceRec.onresult = (e) => {
            let text = '';
            for(let i=0; i<e.results.length; i++) text += e.results[i][0].transcript;
            
            if(transcriptEl) {
                transcriptEl.innerText = text;
                transcriptEl.style.color = "#ef4444"; 
            }
            window.appState.practiceRawTranscript = text;

            const spoken = text.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>w);
            const targetWords = window.appState.practiceTargetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>!['a','an','the','is','are','in','on','at'].includes(w));
            
            let match = 0;
            targetWords.forEach(w => { 
                if(spoken.includes(w) || spoken.includes(w+'s') || spoken.includes(w+'es') || spoken.includes(w+'ing') || spoken.includes(w+'d') || spoken.includes(w+'ed')) match++; 
            });
            const rate = targetWords.length > 0 ? (match / targetWords.length) : 0;

            if (rate >= 0.8 && window.isPracticeRecording) {
                window.isPracticeRecording = false;
                window.practiceSuccess = true; 
                try { window.practiceRec.stop(); } catch(err){}
                
                window.playSuccessChime(); 
                window.createConfetti();   
                window.showExcellentPrompt(); 

                if(transcriptEl) {
                    transcriptEl.style.color = "#22c55e"; 
                }
                
                if(feedbackEl) {
                    feedbackEl.classList.remove('hidden');
                    feedbackEl.innerHTML = "✨ Excellent! ばっちり言えました！";
                    feedbackEl.style.color = "#16a34a"; 
                }

                if(btn) {
                    btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🔄</span> RETRY';
                }
            }
        };
        
        window.practiceRec.onend = () => {
            if(window.practiceSuccess) return;

            if(!window.isPracticeRecording) {
                const spoken = window.appState.practiceRawTranscript.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>w);
                const targetWords = window.appState.practiceTargetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>!['a','an','the','is','are','in','on','at'].includes(w));
                let match = 0;
                targetWords.forEach(w => { 
                    if(spoken.includes(w) || spoken.includes(w+'s') || spoken.includes(w+'es') || spoken.includes(w+'ing') || spoken.includes(w+'d') || spoken.includes(w+'ed')) match++; 
                });
                const rate = targetWords.length > 0 ? (match / targetWords.length) : (spoken.length > 0 ? 1 : 0);
                
                if(feedbackEl) {
                    feedbackEl.classList.remove('hidden');
                    if (rate >= 0.5) {
                        feedbackEl.innerHTML = "👍 Good! あと少し！もう一度チャレンジ！";
                        feedbackEl.style.color = "#ca8a04"; 
                    } else {
                        feedbackEl.innerHTML = "💪 Keep Trying! お手本を聞いてみよう！";
                        feedbackEl.style.color = "#db2777"; 
                    }
                }
            } else {
                try { window.practiceRec.start(); } catch(e){}
            }
        };
    }

    if (window.isPracticeRecording) {
        window.isPracticeRecording = false;
        try { window.practiceRec.stop(); } catch(e){}
        if(btn) {
            btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🔄</span> RETRY';
        }
    } else {
        window.appState.practiceRawTranscript = "";
        window.practiceSuccess = false; 
        
        if(transcriptEl) {
            transcriptEl.innerHTML = "Listening...";
            transcriptEl.style.color = "#ef4444"; 
        }
        if(feedbackEl) {
            feedbackEl.classList.add('hidden');
            feedbackEl.innerHTML = ""; 
        }
        if(btn) {
            btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🛑</span> STOP';
        }
        window.isPracticeRecording = true;
        try { window.practiceRec.start(); } catch(e){}
    }
};

window.openPractice = function(text, ja) {
    window.appState.isPracticeMode = true;
    window.appState.practiceTargetText = text;
    window.appState.practiceRawTranscript = "";
    window.practiceSuccess = false; 
    
    const modal = document.getElementById('practice-modal');
    if (!modal) return;

    const targetEl = document.getElementById('practice-target');
    const jaEl = document.getElementById('practice-ja');
    const transcriptEl = document.getElementById('practice-transcript');
    const feedbackEl = document.getElementById('practice-feedback');
    const btn = document.getElementById('btn-start-practice');

    if(targetEl) targetEl.textContent = text;
    if(jaEl) jaEl.textContent = ja;
    
    if(transcriptEl) {
        transcriptEl.innerHTML = "Tap START and speak...";
        transcriptEl.style.color = ""; 
    }
    
    if(feedbackEl) {
        feedbackEl.classList.add('hidden');
        feedbackEl.innerHTML = "";
    }
    
    if(btn) {
        btn.innerHTML = 'START'; 
    }
    
    modal.classList.remove('hidden');
};

// ==========================================
// ★ イベントデリゲーション (完全版)
// ==========================================
document.addEventListener('click', (e) => {
    
    // 🎵 優しいタップ音
    if (e.target.closest('.sns-btn') || e.target.closest('.mode-btn') || e.target.closest('.level-btn') || e.target.closest('#rabbit-char') || e.target.closest('.action-btn-back') || e.target.closest('.action-btn-home')) {
        if(typeof window.playTapSound === 'function') window.playTapSound();
    }

    // 🏠 ホームボタン（初期画面へ一気に戻る）
    const btnHome = e.target.closest('.action-btn-home');
    if (btnHome) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        clearInterval(window.gameTimer);
        if(window.supportInterval) clearInterval(window.supportInterval);
        window.closePracticeModal();
        if (typeof showView === 'function') showView(document.getElementById('view-start'));
        return;
    }

    // ◀ 戻るボタン（1つ前の画面に戻る）
    const btnBack = e.target.closest('.action-btn-back');
    if (btnBack) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        clearInterval(window.gameTimer);
        if(window.supportInterval) clearInterval(window.supportInterval);
        
        // 現在表示されている画面を判定して、1つ前に戻す
        const currentView = document.querySelector('.app-container > div:not(.hidden)[id^="view-"]');
        if (currentView) {
            if (currentView.id === 'view-about' || currentView.id === 'view-select') {
                if (typeof showView === 'function') showView(document.getElementById('view-start'));
            } else if (currentView.id === 'view-play' || currentView.id === 'view-result') {
                if (typeof showView === 'function') showView(document.getElementById('view-select'));
                if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
            }
        }
        return;
    }

    // 🎯 SELECT IMAGE / STORY ボタン
    const btnGotoSelect = e.target.closest('#btn-goto-select');
    if (btnGotoSelect && !btnGotoSelect.disabled) {
        if(!window.appState.selectedMode) return; 
        
        if (window.appState.selectedMode === 'story') {
            window.location.href = 'story.html';
            return;
        }
        try {
            const elem = document.documentElement;
            if (!document.fullscreenElement) {
                if (elem.requestFullscreen) elem.requestFullscreen().catch(err=>err);
                else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            }
        } catch (err) {}
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        
        // エラーの原因だった古いボタンの呼び出しを削除済み！
        
        const elementaryBtn = document.querySelector('.level-btn[data-level="elementary"]');
        if (elementaryBtn) {
            document.querySelectorAll('.level-btn').forEach(b => { 
                b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); 
                b.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700'); 
            });
            elementaryBtn.classList.remove('bg-gray-50', 'border-gray-200', 'text-gray-700');
            elementaryBtn.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            window.appState.selectedLevel = 'elementary';
        }
        
        if (typeof showView === 'function') showView(document.getElementById('view-select')); 
        if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        return;
    }

    // 🖼️ 画像選択時の処理
    const themeCard = e.target.closest('.theme-card');
    if (themeCard) {
        const themeId = themeCard.getAttribute('data-id');
        if (themeId) window.startGameWithTheme(themeId);
        return;
    }

    // 🎙️ PLAY画面：STARTボタン
    const btnStartTurn = e.target.closest('#btn-start-turn');
    if (btnStartTurn) {
        if(typeof window.startSpeech === 'function') window.startSpeech(); 
        window.isRecording = true;
        btnStartTurn.classList.remove('animate-attention'); 
        btnStartTurn.classList.add('hidden');
        const recIndicator = document.getElementById('recording-indicator');
        if(recIndicator) recIndicator.classList.remove('hidden');
        const statusText = document.getElementById('status-text');
        if(statusText) statusText.textContent = "Speak Now!";
        const promptImage = document.getElementById('prompt-image');
        // if(promptImage) { promptImage.classList.remove('blur-md'); promptImage.classList.add('blur-none'); }
        // const supportToggle = document.getElementById('support-toggle');
        if (window.timeElapsed === 0 && supportToggle && supportToggle.checked) {
            if(typeof getAggregatedData === 'function') {
                const targetData = getAggregatedData(window.currentTheme, window.appState.selectedLevel);
                if(typeof window.dropPin === 'function') {
                    targetData.words.forEach(w => window.dropPin(w.text, window.currentTheme, true));
                }
            }
            window.supportInterval = setInterval(window.triggerSupportHint, 6000);
        }
        if (window.timeElapsed === 0 && typeof window.startTimer === 'function') window.startTimer();
        return;
    }

    // 🛑 PLAY画面：録音中インジケーター（手動ストップ用）
    const recIndicator = e.target.closest('#recording-indicator');
    if (recIndicator) {
        if(typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        return;
    }

    // 🏁 PLAY画面：FINISHボタン
    const btnFinishTurn = e.target.closest('#btn-finish-turn');
    if (btnFinishTurn) {
        window.finishGameAndShowResult();
        return;
    }

    // 🔄 RESULT画面：PLAY AGAIN
    const btnPlayAgain = e.target.closest('#btn-play-again');
    if (btnPlayAgain) {
        const finishBtn = document.getElementById('btn-finish-turn');
        if(finishBtn) finishBtn.classList.add('hidden');
        const rInd = document.getElementById('recording-indicator');
        if(rInd) rInd.classList.add('hidden');
        const startBtn = document.getElementById('btn-start-turn');
        if(startBtn) { startBtn.classList.remove('hidden'); startBtn.classList.add('animate-attention'); }
        const sText = document.getElementById('status-text');
        if(sText) sText.textContent = "Ready";
        const pImage = document.getElementById('prompt-image');
        if (pImage) { pImage.classList.remove('blur-none'); pImage.classList.add('blur-md'); }
        if (typeof showView === 'function') showView(document.getElementById('view-select')); 
        if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        return;
    }

    // 🎤 発音練習の開始・再試行
    const practiceStartBtn = e.target.closest('#btn-start-practice');
    if (practiceStartBtn) {
        window.togglePracticeRecording();
        return;
    }

    // ❌ 練習モーダルを閉じる
    const practiceCloseBtn = e.target.closest('#btn-close-practice') || e.target.closest('button[onclick*="closePractice"]');
    if (practiceCloseBtn) {
        window.closePracticeModal();
        return;
    }

    // ℹ️ About画面へ行くボタン
    const btnGotoAbout = e.target.closest('#btn-goto-about');
    if (btnGotoAbout) {
        if (typeof showView === 'function') showView(document.getElementById('view-about'));
        return;
    }
});

window.addEventListener('DOMContentLoaded', window.initApp);