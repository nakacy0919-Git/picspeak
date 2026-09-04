// js/main.js
// ==========================================
// アプリケーションの司令塔 (全機能・全モード完全統合＆Oral Quest即スタート対応版)
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
window.themeCatalog = [];
window.accumulatedTranscript = ""; 
window.rawTranscriptForCounting = ""; 
window.audioCtx = null;

// ==========================================
// ★ Vercel Edge Requests削減用キャッシュ
// ==========================================
// 同一ページ内では同じJSONを二度取得しない。
window.picSpeakJsonCache = new Map();
window.picSpeakThemeCache = new Map();
window.picSpeakGridCache = new Map();

window.fetchJsonCached = async function(url, cacheKey = url) {
    if (window.picSpeakJsonCache.has(cacheKey)) {
        return window.picSpeakJsonCache.get(cacheKey);
    }

    const requestPromise = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.json();
        })
        .catch(error => {
            window.picSpeakJsonCache.delete(cacheKey);
            throw error;
        });

    window.picSpeakJsonCache.set(cacheKey, requestPromise);
    return requestPromise;
};

window.getThemeDataCached = async function(id, folderPath = 'data/themes') {
    const cacheKey = `${folderPath}/${id}`;

    if (window.picSpeakThemeCache.has(cacheKey)) {
        return window.picSpeakThemeCache.get(cacheKey);
    }

    const fetchedData = await window.fetchJsonCached(`${folderPath}/${id}.json`, cacheKey);
    const themeData = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;

    window.picSpeakThemeCache.set(cacheKey, themeData);
    return themeData;
};

// 練習モーダル用変数
window.isPracticeRecording = false;
window.practiceRec = null;
window.practiceSuccess = false; 

const viewStart = document.getElementById('view-start');
const viewSelect = document.getElementById('view-select'); 
const viewPlay = document.getElementById('view-play');
const viewResult = document.getElementById('view-result');
const viewAbout = document.getElementById('view-about');
const themeGrid = document.getElementById('theme-grid'); 

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
        window.themeCatalog = await window.fetchJsonCached('data/theme_catalog.json', 'theme_catalog');
        if (!Array.isArray(window.themeCatalog)) {
            throw new Error('theme_catalog.json が配列ではありません。');
        }
    } catch (error) {
        console.error("テーマカタログ読み込み失敗:", error);
        window.themeCatalog = [];
    }
}

// ==========================================
// ★ テーマグリッド描画（画像選択画面）
// ==========================================
window.renderThemeGrid = async function() {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;
    themeGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10 text-xl md:text-2xl">Loading Images...</div>';

    try {
        let results = [];
        let isDetective = (window.appState && window.appState.selectedMode === 'detective');
        
        const gridCacheKey = window.appState.selectedMode || 'snapshot';

        if (window.picSpeakGridCache.has(gridCacheKey)) {
            results = window.picSpeakGridCache.get(gridCacheKey);
        } else if (window.appState.selectedMode === 'oralquest') {
            const list = await window.fetchJsonCached('data/oralquest_list.json', 'oralquest_list');
            results = list.map(item => ({ id: item.id, data: item }));
            window.picSpeakGridCache.set(gridCacheKey, results);
        } else if (window.appState.selectedMode === 'mosaic') {
            results = await window.fetchJsonCached('data/mosaic_list.json', 'mosaic_list');
            window.picSpeakGridCache.set(gridCacheKey, results);
        } else if (isDetective) {
            results = await window.fetchJsonCached('data/detective_list.json', 'detective_list');
            window.picSpeakGridCache.set(gridCacheKey, results);
        } else {
            // 通常テーマは一覧用の軽量カタログだけを使う。
            // ここでは147個の個別テーマJSONを取得しない。
            results = window.themeCatalog
                .filter(item => item && item.id)
                .map(item => ({ id: item.id, data: item }));
            window.picSpeakGridCache.set(gridCacheKey, results);
        }

        let html = '';

        if (isDetective) {
            html += `
            <div class="col-span-full bg-yellow-50/80 rounded-3xl p-5 md:p-8 shadow-sm border border-yellow-200 mb-6 relative overflow-hidden">
                <h3 class="text-xl md:text-2xl font-black text-yellow-700 mb-2 flex items-center gap-2">
                    <span>🕵️‍♂️</span> 遊び方（タップして体験！）
                </h3>
                <p class="text-sm md:text-base text-yellow-800 font-bold mb-4 leading-relaxed">
                    下の絵(B)を上の絵(A)と見比べて、違うところを英語で声に出してみよう！<br>
                    試しに、下のサンプルの<span class="text-pink-500 underline decoration-pink-300 decoration-2 underline-offset-4">「B」の絵（下半分）の中にある間違っている部分</span>を直接クリック（タップ）してみてね。
                </p>
                <div class="relative w-full rounded-2xl overflow-hidden border-4 border-yellow-300 bg-white shadow-inner cursor-pointer" onclick="handleTutorialClick(event)">
                    <img src="assets/images/detective/sample.webp" loading="lazy" decoding="async" class="w-full h-auto object-contain pointer-events-none">
                    <div id="tutorial-overlay" class="absolute inset-0 pointer-events-none"></div>
                </div>
            </div>`;
        }

        results.forEach(item => {
            if(!item || !item.data) return;
            
            let imageFilterClass = "";
            let category = item.data.category || 'other'; 
            let titleEn = item.data.titleEn || 'No Title';
            let titleJa = item.data.titleJa || '名称未設定';
            
            if (window.appState.selectedMode === 'mosaic') {
                imageFilterClass = "blur-2xl scale-110"; 
                titleEn = "Secret Image";
                titleJa = "???";
            } else if (isDetective) {
                imageFilterClass = "!h-[200%] object-top"; 
            }
            
            let badgeHtml = '';
            if (isDetective) {
                badgeHtml = `<div class="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse z-20">NEW!</div>`;
            }
            
            html += `
            <div class="theme-card cursor-pointer rounded-2xl md:rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:border-pink-300 hover:shadow-md transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" data-id="${item.id}" data-category="${category}">
                ${badgeHtml}
                <div class="relative w-full aspect-video bg-gray-50 shrink-0 pointer-events-none overflow-hidden">
                    <img src="${item.data.imageSrc}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover transition-all duration-500 ${imageFilterClass}">
                </div>
                <div class="p-3 md:p-4 text-center border-t border-gray-50 flex-1 flex flex-col items-center justify-center leading-tight bg-white pointer-events-none">
                    <span class="text-sm md:text-base font-black text-gray-800 line-clamp-1 mb-0.5">${titleEn}</span>
                    <span class="text-[10px] md:text-xs font-bold text-gray-400 line-clamp-1">${titleJa}</span>
                </div>
            </div>`;
        });
        themeGrid.innerHTML = html;

        // フィルター表示の制御
        const filters = document.getElementById('theme-filters');
        if (filters) {
            if (window.appState.selectedMode === 'mosaic' || isDetective || window.appState.selectedMode === 'oralquest') {
                filters.classList.add('hidden');
            } else {
                filters.classList.remove('hidden');
                document.querySelectorAll('.theme-filter-btn').forEach(b => {
                    if (b.getAttribute('data-filter') === 'all') { 
                        b.classList.remove('bg-white', 'text-gray-500'); 
                        b.classList.add('bg-gray-800', 'text-white', 'shadow-md'); 
                    } else { 
                        b.classList.remove('bg-gray-800', 'text-white', 'shadow-md'); 
                        b.classList.add('bg-white', 'text-gray-500'); 
                    }
                });
                document.querySelectorAll('.theme-card').forEach(card => {
                    const cardCat = card.getAttribute('data-category');
                    if (cardCat === 'other') card.style.display = 'none'; 
                    else card.style.display = '';
                });
            }
        }
    } catch(e) { 
        themeGrid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading images</div>'; 
    }
}

// ==========================================
// ★ チュートリアルポップアップ処理
// ==========================================
window.handleTutorialClick = async function(e) {
    if (!window.tutorialData) {
        try {
            window.tutorialData = await window.fetchJsonCached('data/detective/detective_sample.json', 'detective_sample');
        } catch (err) {
            return;
        }
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    let hitDiff = null;
    for (let diff of window.tutorialData.differences) {
        const dx = Math.abs(xPercent - diff.coordinates.x);
        const dy = Math.abs(yPercent - diff.coordinates.y);
        
        if (dx <= (diff.coordinates.width / 2) + 5 && dy <= (diff.coordinates.height / 2) + 5) {
            hitDiff = diff;
            break;
        }
    }

    if (hitDiff) {
        showTutorialPopup(hitDiff);
    }
}

window.showTutorialPopup = function(diff) {
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;

    overlay.innerHTML = '';
    overlay.classList.remove('pointer-events-none'); 

    const mark = document.createElement('div');
    mark.className = 'absolute border-[4px] border-red-500 bg-red-500/30 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pop pointer-events-none z-10';
    mark.style.width = `${diff.coordinates.width}%`;
    mark.style.height = `${diff.coordinates.height}%`;
    mark.style.left = `${diff.coordinates.x - diff.coordinates.width / 2}%`;
    mark.style.top = `${diff.coordinates.y - diff.coordinates.height / 2}%`;
    overlay.appendChild(mark);

    let expressionsHtml = '';
    const createLevelHtml = (levelObj, levelName, color) => {
        if (!levelObj || levelObj.length === 0) return '';
        return `
            <div class="mb-2 p-2 bg-white rounded border border-gray-100">
                <span class="text-[10px] font-bold bg-${color}-100 text-${color}-700 px-2 py-0.5 rounded">${levelName}</span>
                <p class="font-bold text-gray-800 text-sm mt-1">${levelObj[0].text}</p>
                <p class="text-[10px] text-gray-500">${levelObj[0].ja}</p>
            </div>
        `;
    };
    expressionsHtml += createLevelHtml(diff.modelExpressions.elementary, '小学生', 'green');
    expressionsHtml += createLevelHtml(diff.modelExpressions.junior_high, '中学生', 'blue');
    expressionsHtml += createLevelHtml(diff.modelExpressions.high_school, '高校生', 'pink');

    const popup = document.createElement('div');
    popup.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 border-pink-300 p-5 md:p-6 z-[100] w-[90%] max-w-sm animate-fade-in-up flex flex-col';
    
    popup.innerHTML = `
        <button class="absolute top-3 right-4 text-gray-300 hover:text-gray-600 font-black text-2xl transition-colors" onclick="document.getElementById('tutorial-overlay').innerHTML=''; document.getElementById('tutorial-overlay').classList.add('pointer-events-none');">×</button>
        <h4 class="font-black text-pink-500 border-b-2 border-pink-50 pb-2 mb-3 pr-6 text-lg">🎯 ${diff.nameJa}</h4>
        <div class="space-y-1 mb-4">
            ${expressionsHtml}
        </div>
        <p class="text-xs text-gray-400 font-bold text-center bg-gray-50 p-2 rounded-lg">本番では、マイクに向かってこのように英語で発話します！🎙️</p>
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/10 z-[99] transition-opacity';
    backdrop.onclick = () => { overlay.innerHTML = ''; overlay.classList.add('pointer-events-none'); };
    
    overlay.appendChild(backdrop);
    overlay.appendChild(popup);
    
    try { if (typeof playSound === 'function') playSound('match'); } catch(e) {}
}

// ==========================================
// ★ 事前練習モード (Pre-Practice) ロジック ★
// ==========================================
window.tempSelectedThemeId = null;
window.prePracticeCurrentType = 'words';

window.startPrePracticeWithTheme = async function(id) {
    try {
        let folderPath = 'data/themes';
        if (window.appState.selectedMode === 'mosaic') folderPath = 'data/mosaic';
        if (window.appState.selectedMode === 'detective') folderPath = 'data/detective';
        window.currentTheme = await window.getThemeDataCached(id, folderPath);
    } catch (e) {
        alert(`データの読み込みに失敗しました。`);
        return;
    }

    const preImg = document.getElementById('pre-practice-image');
    if(preImg) {
        preImg.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;
    }

    window.prePracticeCurrentType = 'words';
    if(typeof window.renderPrePracticeList === 'function') {
        window.renderPrePracticeList();
    }

    document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const preView = document.getElementById('view-pre-practice');
    if(preView) {
        preView.classList.remove('hidden');
    }
};

window.renderPrePracticeList = function() {
    if (!window.currentTheme) return;
    
    document.querySelectorAll('.pre-level-btn').forEach(b => {
        if (b.getAttribute('data-level') === window.appState.selectedLevel) {
            b.classList.add('bg-pink-500', 'text-white');
            b.classList.remove('text-gray-500');
        } else {
            b.classList.add('text-gray-500');
            b.classList.remove('bg-pink-500', 'text-white');
        }
    });

    document.querySelectorAll('.pre-type-btn').forEach(b => {
        if (b.getAttribute('data-type') === window.prePracticeCurrentType) {
            b.classList.add('text-blue-600', 'border-blue-500');
            b.classList.remove('text-gray-400');
        } else {
            b.classList.add('text-gray-400');
            b.classList.remove('text-blue-600', 'border-blue-500');
        }
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

    if (!items || items.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-400 font-bold py-10 mt-10">このレベルのデータはありません。</p>';
        return;
    }

    items.forEach(item => {
        const escapedText = item.text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const escapedJa = (item.ja || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
        listContainer.innerHTML += `
            <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-3">
                <div class="flex-1 pr-2">
                    <div class="font-black text-gray-800 text-base md:text-lg leading-tight">${item.text}</div>
                    <div class="text-xs md:text-sm font-bold text-gray-500 mt-1">${item.ja || ""}</div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="window.playResultTTS('${escapedText}')" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs md:text-sm font-bold text-gray-700 shadow-sm">🔊 聞く</button>
                    <button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs md:text-sm font-bold shadow-sm">🎤 練習</button>
                </div>
            </div>`;
    });
};

// ==========================================
// ★ 授業モード（Classroom Mode）ロジック ★
// ==========================================
window.currentClassroomAudio = null;

window.openClassroomMode = function() {
    document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
    
    const classroomView = document.getElementById('view-classroom');
    if (classroomView) {
        classroomView.classList.remove('hidden');
    }
    
    if (window.currentTheme) {
        const imgEl = document.getElementById('classroom-image');
        if(imgEl) {
            imgEl.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;
        }
        if(typeof window.renderClassroomList === 'function') {
            window.renderClassroomList();
        }
    }
};

window.renderClassroomList = function() {
    document.querySelectorAll('.class-level-btn').forEach(b => {
        if (b.getAttribute('data-level') === window.appState.selectedLevel) {
            b.classList.add('bg-pink-500', 'text-white');
            b.classList.remove('text-gray-400');
        } else {
            b.classList.remove('bg-pink-500', 'text-white');
            b.classList.add('text-gray-400');
        }
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
                    <button onclick="window.playClassroomAudio('${audioSrc}', '${escapedText}')" class="bg-pink-500 hover:bg-pink-400 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                        <svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                    </button>
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
    if (window.currentClassroomAudio) {
        window.currentClassroomAudio.pause();
        window.currentClassroomAudio.currentTime = 0;
    }
    
    if (audioSrc) {
        window.currentClassroomAudio = new Audio(audioSrc);
        window.currentClassroomAudio.play().catch(e => {
            window.playResultTTS(fallbackText);
        });
    } else {
        window.playResultTTS(fallbackText);
    }
};

// ==========================================
// ★ メインゲーム起動ロジック
// ==========================================
window.startGameWithTheme = async function(id) {
    const detUi = document.getElementById('detective-ui');
    if (detUi) detUi.remove(); 
    
    if (typeof window.DetectiveGame !== 'undefined') {
        window.DetectiveGame.isActive = false;
        if (window.DetectiveGame.timerInterval) clearInterval(window.DetectiveGame.timerInterval);
    }
    
    const statsGrid = document.querySelector('#view-play .grid.grid-cols-3');
    if (statsGrid) {
        statsGrid.style.display = '';
        statsGrid.classList.remove('hidden');
    }
    
    const compBar = document.getElementById('live-completion-text');
    if (compBar) {
        const compBarContainer = compBar.closest('.bg-white');
        if (compBarContainer) {
            compBarContainer.style.display = '';
            compBarContainer.classList.remove('hidden');
        }
    }

    try {
        let folderPath = 'data/themes';
        if (window.appState.selectedMode === 'mosaic') folderPath = 'data/mosaic';
        if (window.appState.selectedMode === 'detective') folderPath = 'data/detective';
        
        if (window.appState.selectedMode === 'oralquest') {
            try {
                window.currentTheme = await window.getThemeDataCached(id, 'data/oralquest');
            } catch (oralQuestError) {
                window.currentTheme = await window.getThemeDataCached(id, 'data/themes');
            }
        } else {
            window.currentTheme = await window.getThemeDataCached(id, folderPath);
        }
    } catch (e) {
        alert(`データの読み込みに失敗しました。`);
        return;
    }
    
    const promptImage = document.getElementById('prompt-image');
    if (window.currentTheme && window.currentTheme.imageSrc && promptImage) {
        promptImage.src = window.currentTheme.imageSrcA || window.currentTheme.imageSrc;
        
        if (window.appState.selectedMode === 'mosaic') {
            promptImage.classList.remove('blur-none', 'blur-md');
            promptImage.style.filter = `blur(${window.MosaicGame ? window.MosaicGame.maxBlur : 40}px)`;
            promptImage.style.transform = 'scale(1.1)';
        } else if (window.appState.selectedMode === 'detective') {
            if (typeof window.DetectiveGame !== 'undefined') window.DetectiveGame.init(window.currentTheme);
        } else {
            promptImage.style.filter = '';
            promptImage.style.transform = '';
            promptImage.style.height = '';
            promptImage.style.objectFit = '';
            promptImage.style.objectPosition = '';
            promptImage.style.top = '';
            promptImage.style.bottom = '';
            promptImage.classList.remove('w-1/2');
            promptImage.classList.add('w-full');
            const promptImageB = document.getElementById('prompt-image-b');
            if (promptImageB) {
                promptImageB.classList.add('hidden');
                promptImageB.style.height = '';
                promptImageB.style.objectFit = '';
                promptImageB.style.objectPosition = '';
                promptImageB.style.bottom = '';
            }
            promptImage.classList.remove('blur-none');
            promptImage.classList.add('blur-md'); 
        }
    }
    
    window.timeLeft = window.appState.customTimeLimit || 30; 
    const timerText = document.getElementById('timer-text');
    if(timerText) timerText.textContent = `${window.timeLeft}s`; 
    
    window.timeElapsed = 0;
    window.rawTranscriptForCounting = "";
    window.accumulatedTranscript = ""; 
    if(typeof resetScore === 'function') resetScore(); 
    
    if(document.getElementById('scoreDisplay')) document.getElementById('scoreDisplay').textContent = "0"; 
    if(document.getElementById('wordCountDisplay')) document.getElementById('wordCountDisplay').textContent = "0";
    if(document.getElementById('liveWpmDisplay')) document.getElementById('liveWpmDisplay').textContent = "0";
    if(document.getElementById('live-completion-bar')) document.getElementById('live-completion-bar').style.width = '0%';
    if(document.getElementById('live-completion-text')) document.getElementById('live-completion-text').textContent = '0%';
    if(document.getElementById('pin-container')) document.getElementById('pin-container').innerHTML = ''; 
    if(document.getElementById('support-text-container')) document.getElementById('support-text-container').innerHTML = '';
    
    if (window.appState.selectedMode === 'ngword' && typeof ngWordGame !== 'undefined') {
        ngWordGame.init(window.currentTheme);
    } else if (typeof ngWordGame !== 'undefined') {
        ngWordGame.cleanup();
    }

    const transcriptBox = document.getElementById('transcript-box');
    const existingHint = document.getElementById('mosaic-hint-panel');
    if (existingHint) existingHint.remove();

    if(transcriptBox) {
        if (window.appState.selectedMode === 'mosaic') {
            const hintPanel = document.createElement('div');
            hintPanel.id = 'mosaic-hint-panel';
            hintPanel.className = 'mb-2 md:mb-3 bg-pink-50 border border-pink-100 rounded-xl p-2 md:p-3 shadow-sm shrink-0 z-10';
            hintPanel.innerHTML = `
                <span class="text-pink-500 font-black mb-2 block tracking-wider text-xs md:text-sm">💡 言葉に詰まったら使ってみよう！</span>
                <div class="space-y-2">
                    <div class="flex flex-wrap gap-1.5 items-center">
                        <span class="text-[10px] md:text-xs font-black text-pink-400 border border-pink-200 bg-white px-1.5 py-0.5 rounded uppercase tracking-wider">推測</span>
                        <span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">It looks like ~</span> <span class="text-gray-500">(〜に見える)</span></span>
                        <span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">Maybe it's ~</span> <span class="text-gray-500">(たぶん〜)</span></span>
                        <span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">I think this is ~</span> <span class="text-gray-500">(〜だと思う)</span></span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 items-center">
                        <span class="text-[10px] md:text-xs font-black text-blue-400 border border-blue-200 bg-white px-1.5 py-0.5 rounded uppercase tracking-wider">描写</span>
                        <span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">I can see ~</span> <span class="text-gray-500">(〜が見える)</span></span>
                        <span class="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm text-[10px] md:text-xs"><span class="font-bold text-gray-800">There is / are ~</span> <span class="text-gray-500">(〜がある)</span></span>
                    </div>
                </div>`;
            transcriptBox.parentNode.insertBefore(hintPanel, transcriptBox);
            transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and guess the picture!<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して推測してみよう）</span></p>`;
        } else {
            transcriptBox.innerHTML = `<p class="text-gray-400 font-bold">Press START and speak loudly.<br><span class="text-sm md:text-lg font-medium text-gray-400">（STARTを押して、大きな声で話しましょう）</span></p>`;
        }
    }

    const btnStartTurn = document.getElementById('btn-start-turn');
    if(btnStartTurn) {
        btnStartTurn.classList.remove('hidden');
        btnStartTurn.classList.add('animate-attention');
    }
    
    if (window.appState.selectedMode === 'oralquest') {
        if (typeof showView === 'function') showView(document.getElementById('view-oralquest'));
        
        if (typeof window.OralQuestGame !== 'undefined') {
            window.OralQuestGame.init();
        }
    } else {
        if (typeof showView === 'function') showView(document.getElementById('view-play'));
    }
};

window.playResultTTS = function(text) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.8; 
    const voices = speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) || voices.find(v => v.lang === 'en-US' && v.name.includes('Siri')) || voices.find(v => v.lang.startsWith('en'));
    if (bestVoice) u.voice = bestVoice;
    speechSynthesis.speak(u);
};

window.changeTranscriptSize = function(delta) {
    const el = document.getElementById('final-transcript-text');
    if (!el) return;
    let currentSize = parseInt(window.getComputedStyle(el).fontSize);
    let newSize = currentSize + (delta * 4); 
    if (newSize >= 12 && newSize <= 48) {
        el.style.fontSize = newSize + 'px';
        el.style.lineHeight = '1.6';
    }
};

window.finishGameAndShowResult = function() {
    try {
        if(typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        
        if (typeof ngWordGame !== 'undefined') {
            ngWordGame.cleanup();
        }

        const btnFinishTurn = document.getElementById('btn-finish-turn');
        if(btnFinishTurn) btnFinishTurn.classList.add('hidden');
        
        const recIndicator = document.getElementById('recording-indicator');
        if(recIndicator) recIndicator.classList.add('hidden');
        
        if (window.appState.selectedMode === 'detective') {
            if (typeof window.DetectiveResult !== 'undefined') {
                window.DetectiveResult.render(window.currentTheme, window.DetectiveGame.foundIds);
            }
        } else {
            window.renderSnapshotResult();
        }
        
        const viewResultEl = document.getElementById('view-result');
        if (typeof showView === 'function') {
            showView(viewResultEl);
        } else {
            document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
            if(viewResultEl) viewResultEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Result画面への遷移中にエラーが発生:", error);
        document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));
        const fallback = document.getElementById('view-result');
        if (fallback) fallback.classList.remove('hidden');
    }
};

window.renderSnapshotResult = function() {
    let stats = null;
    if(typeof getCompletionStats === 'function') {
        stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel);
    }
    
    const box = document.getElementById('transcript-box');
    const finalTranscript = (box && box.innerText) ? box.innerText.replace("Press START and speak loudly.（STARTを押して、大きな声で話しましょう）", "").replace("Press START and guess the picture!（STARTを押して推測してみよう）", "").trim() : "";

    const container = document.getElementById('ranking-container');
    if (!container) return;

    let currentEl = container.parentElement;
    while (currentEl && currentEl.tagName !== 'BODY') {
        if (currentEl.id === 'view-result') {
            currentEl.style.removeProperty('display'); 
            currentEl.style.setProperty('flex-direction', 'column', 'important');
            currentEl.style.setProperty('height', '100dvh', 'important');
            currentEl.style.setProperty('overflow', 'hidden', 'important');
            currentEl.classList.remove('flex-row', 'lg:flex-row', 'md:flex-row', 'sm:flex-row', 'items-center', 'justify-center');
            break;
        }
        currentEl = currentEl.parentElement;
    }

    if (container.parentElement) {
        Array.from(container.parentElement.children).forEach(sibling => {
            if (sibling !== container) {
                sibling.style.setProperty('width', '100%', 'important');
                sibling.style.setProperty('flex-shrink', '0', 'important');
                sibling.style.setProperty('display', 'flex', 'important');
                sibling.style.setProperty('flex-direction', 'row', 'important');
                sibling.style.setProperty('justify-content', 'space-between', 'important');
                sibling.style.setProperty('align-items', 'center', 'important');
                sibling.style.setProperty('padding', '15px 30px', 'important');
                sibling.style.setProperty('background', '#ffffff', 'important');
                sibling.style.setProperty('z-index', '50', 'important');
                sibling.style.setProperty('border-bottom', '1px solid #f3f4f6', 'important');
                sibling.classList.remove('flex-col', 'w-1/2', 'w-1/3', 'h-full', 'justify-center');
            }
        });
    }

    container.style.setProperty('flex', '1', 'important');
    container.style.setProperty('min-height', '0', 'important');
    container.style.setProperty('width', '100%', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'column', 'important');
    container.style.setProperty('overflow', 'hidden', 'important');

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

            let missedItemsHtml = ""; let clearedItemsHtml = ""; const previewCount = 3; 

            cat.cleared.forEach(item => {
                const safeText = item.text ? String(item.text) : "";
                const safeJa = item.ja ? String(item.ja) : "";
                const escapedText = safeText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const escapedJa = safeJa.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                
                clearedItemsHtml += `
                    <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-2 ${style.light} p-3 rounded-xl border ${style.border} shadow-sm">
                        <div class="flex-1 pr-1">
                            <div class="text-sm sm:text-base font-black ${style.text} tracking-wide leading-tight">${safeText} <span class="text-lg ml-1">✅</span></div>
                            <div class="text-xs sm:text-sm font-bold ${style.text} opacity-80 mt-1">${safeJa}</div>
                        </div>
                        <div class="flex flex-wrap gap-2 shrink-0 mt-2 xl:mt-0 justify-end">
                            <button onclick="window.playResultTTS('${escapedText}')" class="px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg text-xs sm:text-sm font-bold ${style.text} transition-colors shadow-sm border ${style.border}">🔊 発音</button>
                            <button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs sm:text-sm font-bold text-blue-700 transition-colors shadow-sm border border-blue-200">🎤 練習</button>
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
                    <div class="${isHidden} flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-2 bg-white p-3 rounded-xl border ${style.border} shadow-sm">
                        <div class="flex items-start gap-2 flex-1">
                            <span class="${style.text} font-black text-lg sm:text-xl shrink-0 mt-0.5">💡</span>
                            <div class="flex-1 pr-1">
                                <div class="text-sm sm:text-base font-black text-gray-800 tracking-wide leading-tight">${safeText}</div>
                                <div class="text-xs font-bold text-gray-500 mt-1">${safeJa}</div>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 shrink-0 mt-2 xl:mt-0 justify-end">
                            <button onclick="window.playResultTTS('${escapedText}')" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-bold text-gray-700 transition-colors shadow-sm border border-gray-200">🔊 発音</button>
                            <button onclick="window.openPractice('${escapedText}', '${escapedJa}')" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs sm:text-sm font-bold text-blue-700 transition-colors shadow-sm border border-blue-200">🎤 練習</button>
                        </div>
                    </div>`;
            });

            let showMoreBtn = "";
            if (cat.missed.length > previewCount) {
                showMoreBtn = `<button onclick="const items = this.parentElement.querySelectorAll('.hidden'); if(items.length > 0) { items.forEach(el => el.classList.remove('hidden')); this.innerHTML = '閉じる ⬆️'; } else { const allItems = this.parentElement.querySelectorAll('.missed-item-card'); allItems.forEach((el, i) => { if (i >= ${previewCount}) el.classList.add('hidden'); }); this.innerHTML = '他の表現も見る ➔'; }" class="w-full mt-1 py-2 text-xs sm:text-sm font-black ${style.text} ${style.btnBg} border ${style.border} rounded-xl transition-colors shadow-sm hover:opacity-80">他の表現も見る ➔</button>`;
            }

            let adviceTitleHtml = catMatchRate >= 100 
                ? `<span class="bg-gradient-to-r from-yellow-300 to-yellow-500 text-white px-2.5 py-1 rounded-lg shadow-sm font-black flex items-center gap-1 border border-yellow-400">🏆 100%達成！</span>`
                : `<span class="bg-white px-2.5 py-1 rounded-lg shadow-sm border ${style.border} ${style.text} flex items-center gap-1">💡 他の表現を使おう！</span>`;

            categoryHtml += `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-200 relative transition-all flex flex-col h-auto">
                    <div class="absolute top-0 left-0 w-1.5 h-full ${style.bar} rounded-l-2xl"></div>
                    <div class="flex justify-between items-center p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors" onclick="document.getElementById('cat-body-${key}').classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                        <div class="pl-2">
                            <h4 class="font-black text-gray-800 text-base sm:text-lg">${dict.title}</h4>
                            <p class="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">${dict.advice}</p>
                        </div>
                        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                            <span class="font-black ${style.text} text-xl sm:text-2xl">${catMatchRate}%</span>
                            <svg class="chevron w-5 h-5 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                    <div id="cat-body-${key}" class="px-3 sm:px-4 pb-4 flex-1 flex flex-col">
                        <div class="flex items-center gap-2 mb-3 pl-2">
                            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200 shadow-inner">
                                <div class="${style.bar} h-2 rounded-full transition-all duration-1000" style="width: ${catMatchRate}%"></div>
                            </div>
                        </div>
                        ${cat.cleared.length > 0 ? `<div class="mb-3 flex-1 pl-1"><div class="text-[10px] sm:text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1"><span class="bg-green-100 text-green-700 px-2 py-0.5 rounded shadow-sm">✅ 言えた表現</span></div><div class="max-h-48 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-1">${clearedItemsHtml}</div></div>` : ''}
                        ${cat.missed.length > 0 ? `<div class="bg-gray-50 rounded-xl p-3 border border-gray-100 mt-2 ml-1"><div class="text-[10px] sm:text-xs font-black mb-2 flex items-center">${adviceTitleHtml}</div><div class="flex flex-col gap-1">${missedItemsHtml}</div>${showMoreBtn}</div>` : `<div class="text-center py-4 bg-white rounded-xl border ${style.border} shadow-sm mt-2 ml-1"><span class="text-4xl mb-2 block">✨🎉✨</span><span class="text-sm font-black ${style.text}">完璧！すべてマスターしました！</span></div>`}
                    </div>
                </div>`;
        });
    }

    const totalWords = finalTranscript ? finalTranscript.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w=>w).length : 0;
    const wpm = window.appState.customTimeLimit > 0 ? Math.round(totalWords / (window.appState.customTimeLimit / 60)) : 0;

    let html = `
        <div class="flex flex-col lg:flex-row gap-4 sm:gap-6 h-full w-full max-w-[120rem] mx-auto px-3 sm:px-5 xl:px-8 pb-4 pt-2 overflow-hidden">
            
            <div class="w-full lg:w-[280px] xl:w-[360px] flex flex-col gap-3 sm:gap-4 shrink-0 h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
                <div class="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center shadow-xl text-white relative overflow-hidden shrink-0">
                    <div class="absolute -right-4 -top-4 opacity-10 text-8xl sm:text-9xl">📸</div>
                    <span class="text-white/90 font-extrabold text-xs tracking-widest mb-1 uppercase">総合達成度</span>
                    <span class="text-6xl sm:text-7xl font-black">${stats ? stats.completionRate : 0}<span class="text-3xl">%</span></span>
                    <p class="text-xs sm:text-sm font-bold text-white/90 mt-3 text-center">写真の情報をどれだけくわしく伝えられたかのスコアです。</p>
                </div>
                <div class="flex gap-3 sm:gap-4 shrink-0">
                    <div class="bg-white rounded-2xl sm:rounded-3xl p-4 flex flex-col items-center shadow-md border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[9px] sm:text-[10px] tracking-widest mb-1 uppercase">話した単語数</span>
                        <span class="text-3xl sm:text-4xl font-black text-gray-800">${totalWords}</span>
                    </div>
                    <div class="bg-white rounded-2xl sm:rounded-3xl p-4 flex flex-col items-center shadow-md border border-gray-200 flex-1">
                        <span class="text-gray-400 font-extrabold text-[9px] sm:text-[10px] tracking-widest mb-1 uppercase text-center">スピード<br>(WPM)</span>
                        <span class="text-3xl sm:text-4xl font-black text-gray-800">${wpm || 0}</span>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-inner border border-gray-200 flex flex-col flex-1 min-h-[180px]">
                    <div class="flex justify-between items-center mb-3 shrink-0">
                        <span class="text-gray-400 font-extrabold text-[9px] sm:text-[10px] tracking-widest uppercase block">あなたが話した英語</span>
                        <div class="flex gap-1.5">
                            <button onclick="window.changeTranscriptSize(-1)" class="w-6 h-6 bg-white border border-gray-300 rounded-full text-gray-600 font-black hover:bg-gray-100 shadow-sm flex items-center justify-center transition-colors">－</button>
                            <button onclick="window.changeTranscriptSize(1)" class="w-6 h-6 bg-white border border-gray-300 rounded-full text-gray-600 font-black hover:bg-gray-100 shadow-sm flex items-center justify-center transition-colors">＋</button>
                        </div>
                    </div>
                    <div id="final-transcript-text" class="font-medium text-gray-700 italic flex-1 overflow-y-auto pr-2 custom-scrollbar" style="font-size: 0.95rem; line-height: 1.5;">"${finalTranscript || 'No speech recorded.'}"</div>
                </div>
            </div>

            <div class="w-full flex-1 flex flex-col h-full overflow-hidden">
                <div class="mb-2 sm:mb-3 pl-1 shrink-0">
                    <h3 class="text-xs sm:text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                        次へのステップアップ
                    </h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto h-full pb-20 pr-2 custom-scrollbar content-start">
                    ${categoryHtml}
                </div>
            </div>

        </div>
    `;
    container.innerHTML = html;

    if (typeof window.setupSubmitButton === 'function') {
        const finalScoreToSubmit = stats ? stats.completionRate : 0;
        window.setupSubmitButton(finalScoreToSubmit);
    }
};

// ==========================================
// ★ 音声・エフェクト関連
// ==========================================
window.playSuccessChime = function() {
    try {
        const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        window.audioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine'; osc2.type = 'triangle';
        osc1.connect(gainNode); osc2.connect(gainNode); gainNode.connect(ctx.destination);

        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc1.frequency.setValueAtTime(987.77, now);
        osc1.frequency.setValueAtTime(1318.51, now + 0.1);
        osc2.frequency.setValueAtTime(987.77, now);
        osc2.frequency.setValueAtTime(1318.51, now + 0.1);

        osc1.start(now); osc2.start(now);
        osc1.stop(now + 0.6); osc2.stop(now + 0.6);
    } catch (e) { console.error("Audio play failed", e); }
};

window.playTapSound = function() {
    try {
        const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        window.audioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(600, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1); 

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); 
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); 

        osc.connect(gainNode); gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.error("Tap sound failed", e); }
};

window.createConfetti = function() {
    const colors = ['#4ade80', '#60a5fa', '#facc15', '#f87171', '#a78bfa', '#fb923c'];
    for (let i = 0; i < 100; i++) {
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

window.showExcellentPrompt = function() {
    const prompt = document.createElement('div');
    prompt.className = 'excellent-prompt';
    prompt.innerText = 'Excellent!!';
    document.body.appendChild(prompt);
    prompt.addEventListener('animationend', () => { prompt.remove(); });
};

window.closePracticeModal = function() {
    window.appState.isPracticeMode = false;
    if (window.isPracticeRecording && window.practiceRec) { try { window.practiceRec.stop(); } catch(e){} }
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
        window.practiceRec.lang = 'en-US'; window.practiceRec.interimResults = true; window.practiceRec.continuous = true; 
        
        window.practiceRec.onresult = (e) => {
            let text = '';
            for(let i=0; i<e.results.length; i++) text += e.results[i][0].transcript;
            
            if(transcriptEl) { transcriptEl.innerText = text; transcriptEl.style.color = "#ef4444"; }
            window.appState.practiceRawTranscript = text;

            const spoken = text.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>w);
            const targetWords = window.appState.practiceTargetText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w=>!['a','an','the','is','are','in','on','at'].includes(w));
            
            let match = 0;
            targetWords.forEach(w => { 
                if(spoken.includes(w) || spoken.includes(w+'s') || spoken.includes(w+'es') || spoken.includes(w+'ing') || spoken.includes(w+'d') || spoken.includes(w+'ed')) match++; 
            });
            const rate = targetWords.length > 0 ? (match / targetWords.length) : 0;

            if (rate >= 0.8 && window.isPracticeRecording) {
                window.isPracticeRecording = false; window.practiceSuccess = true; 
                try { window.practiceRec.stop(); } catch(err){}
                window.playSuccessChime(); window.createConfetti(); window.showExcellentPrompt(); 
                if(transcriptEl) transcriptEl.style.color = "#22c55e"; 
                if(feedbackEl) { feedbackEl.classList.remove('hidden'); feedbackEl.innerHTML = "✨ Excellent! ばっちり言えました！"; feedbackEl.style.color = "#16a34a"; }
                if(btn) btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🔄</span> RETRY';
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
                    if (rate >= 0.5) { feedbackEl.innerHTML = "👍 Good! あと少し！もう一度チャレンジ！"; feedbackEl.style.color = "#ca8a04"; } 
                    else { feedbackEl.innerHTML = "💪 Keep Trying! お手本を聞いてみよう！"; feedbackEl.style.color = "#db2777"; }
                }
            } else { try { window.practiceRec.start(); } catch(e){} }
        };
    }

    if (window.isPracticeRecording) {
        window.isPracticeRecording = false;
        try { window.practiceRec.stop(); } catch(e){}
        if(btn) btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🔄</span> RETRY';
    } else {
        window.appState.practiceRawTranscript = ""; window.practiceSuccess = false; 
        if(transcriptEl) { transcriptEl.innerHTML = "Listening..."; transcriptEl.style.color = "#ef4444"; }
        if(feedbackEl) { feedbackEl.classList.add('hidden'); feedbackEl.innerHTML = ""; }
        if(btn) btn.innerHTML = '<span style="font-size: 1.5em; vertical-align: middle;">🛑</span> STOP';
        window.isPracticeRecording = true;
        try { window.practiceRec.start(); } catch(e){}
    }
};

window.openPractice = function(text, ja) {
    window.appState.isPracticeMode = true; window.appState.practiceTargetText = text; window.appState.practiceRawTranscript = ""; window.practiceSuccess = false; 
    const modal = document.getElementById('practice-modal'); if (!modal) return;
    const targetEl = document.getElementById('practice-target'); const jaEl = document.getElementById('practice-ja');
    const transcriptEl = document.getElementById('practice-transcript'); const feedbackEl = document.getElementById('practice-feedback');
    const btn = document.getElementById('btn-start-practice');

    if(targetEl) targetEl.textContent = text; if(jaEl) jaEl.textContent = ja;
    if(transcriptEl) { transcriptEl.innerHTML = "Tap START and speak..."; transcriptEl.style.color = ""; }
    if(feedbackEl) { feedbackEl.classList.add('hidden'); feedbackEl.innerHTML = ""; }
    if(btn) btn.innerHTML = 'START'; 
    modal.classList.remove('hidden');
};

// ==========================================
// ★ イベントデリゲーション (完全版)
// ==========================================
document.addEventListener('click', (e) => {
    
    const filterBtn = e.target.closest('.theme-filter-btn');
    if (filterBtn) {
        document.querySelectorAll('.theme-filter-btn').forEach(b => { 
            b.classList.remove('bg-gray-800', 'text-white', 'shadow-md'); 
            b.classList.add('bg-white', 'text-gray-500'); 
        });
        filterBtn.classList.remove('bg-white', 'text-gray-500'); 
        filterBtn.classList.add('bg-gray-800', 'text-white', 'shadow-md');
        
        const selectedFilter = filterBtn.getAttribute('data-filter');
        document.querySelectorAll('.theme-card').forEach(card => {
            const cardCat = card.getAttribute('data-category');
            if (selectedFilter === 'all') {
                card.style.display = (cardCat === 'other') ? 'none' : '';
            } else if (selectedFilter === 'level1') {
                card.style.display = (cardCat === 'other') ? '' : 'none';
            } else {
                card.style.display = (cardCat === selectedFilter) ? '' : 'none';
            }
        });
        return;
    }

    if (e.target.closest('.sns-btn') || e.target.closest('.mode-btn') || e.target.closest('.level-btn') || e.target.closest('#rabbit-char') || e.target.closest('.action-btn-back') || e.target.closest('.action-btn-home')) {
        if(typeof window.playTapSound === 'function') window.playTapSound();
    }

    const modeBtn = e.target.closest('.mode-btn');
    if (modeBtn) {
        document.querySelectorAll('.mode-btn').forEach(b => { 
            b.classList.remove('ring-4', 'ring-pink-400', 'scale-105', 'shadow-xl', 'opacity-100'); 
            b.classList.add('opacity-80', 'scale-100'); 
        });
        modeBtn.classList.remove('opacity-80', 'scale-100'); 
        modeBtn.classList.add('ring-4', 'ring-pink-400', 'scale-105', 'shadow-xl', 'opacity-100');
        window.appState.selectedMode = modeBtn.getAttribute('data-mode');
        
        if (window.appState.selectedMode === 'story') {
            window.location.href = 'story.html';
            return;
        }
        
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

    const btnHome = e.target.closest('.action-btn-home');
    if (btnHome) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        clearInterval(window.gameTimer);
        if(window.supportInterval) clearInterval(window.supportInterval);
        window.closePracticeModal();
        
        const vr = document.getElementById('view-result');
        if (vr) { vr.style.removeProperty('display'); vr.classList.add('hidden'); }
        
        if (typeof showView === 'function') showView(document.getElementById('view-start'));
        return;
    }

    const btnBack = e.target.closest('.action-btn-back');
    if (btnBack) {
        if(window.isRecording && typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        clearInterval(window.gameTimer);
        if(window.supportInterval) clearInterval(window.supportInterval);
        
        const vr = document.getElementById('view-result');
        if (vr) { vr.style.removeProperty('display'); vr.classList.add('hidden'); }

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

    // ★修正箇所：画像クリック時のイベント
    const themeCard = e.target.closest('.theme-card');
    if (themeCard) {
        const themeId = themeCard.getAttribute('data-id');
        if (themeId) { 
            window.tempSelectedThemeId = themeId; 
            
            // Oral Questモードの時は、事前練習ポップアップを出さずに即座に本番をスタートする
            if (window.appState.selectedMode === 'oralquest') {
                window.startGameWithTheme(themeId);
            } else {
                document.getElementById('mode-select-modal').classList.remove('hidden'); 
            }
        }
        return;
    }

    const btnChoosePractice = e.target.closest('#btn-choose-practice');
    if (btnChoosePractice) {
        document.getElementById('mode-select-modal').classList.add('hidden');
        if (window.tempSelectedThemeId && typeof window.startPrePracticeWithTheme === 'function') {
            window.startPrePracticeWithTheme(window.tempSelectedThemeId);
        }
        return;
    }

    const btnChooseChallenge = e.target.closest('#btn-choose-challenge');
    if (btnChooseChallenge) {
        document.getElementById('mode-select-modal').classList.add('hidden');
        if (window.tempSelectedThemeId) {
            window.startGameWithTheme(window.tempSelectedThemeId);
        }
        return;
    }

    const btnStartFromPractice = e.target.closest('#btn-start-from-practice');
    if (btnStartFromPractice) {
        const preView = document.getElementById('view-pre-practice');
        if(preView) preView.classList.add('hidden');
        if (window.tempSelectedThemeId) {
            window.startGameWithTheme(window.tempSelectedThemeId);
        }
        return;
    }

    const btnEnterClassroom = e.target.closest('#btn-enter-classroom');
    if (btnEnterClassroom) { 
        if(typeof window.openClassroomMode === 'function') window.openClassroomMode(); 
        return; 
    }

    const btnExitClassroom = e.target.closest('#btn-exit-classroom');
    if (btnExitClassroom) {
        if (window.currentClassroomAudio) window.currentClassroomAudio.pause();
        const classView = document.getElementById('view-classroom');
        const preView = document.getElementById('view-pre-practice');
        if(classView) classView.classList.add('hidden');
        if(preView) preView.classList.remove('hidden');
        return;
    }

    const classLevelBtn = e.target.closest('.class-level-btn');
    if (classLevelBtn) {
        window.appState.selectedLevel = classLevelBtn.getAttribute('data-level');
        if(typeof window.renderClassroomList === 'function') window.renderClassroomList();
        return;
    }

    const preLevelBtn = e.target.closest('.pre-level-btn');
    if (preLevelBtn) {
        window.appState.selectedLevel = preLevelBtn.getAttribute('data-level'); 
        if(typeof window.renderPrePracticeList === 'function') window.renderPrePracticeList();
        document.querySelectorAll('.level-btn').forEach(b => { 
            if (b.getAttribute('data-level') === window.appState.selectedLevel) {
                b.classList.remove('bg-gray-50', 'border-gray-200', 'text-gray-700');
                b.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            } else {
                b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
                b.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700');
            }
        });
        return;
    }
    
    const preTypeBtn = e.target.closest('.pre-type-btn');
    if (preTypeBtn) { 
        window.prePracticeCurrentType = preTypeBtn.getAttribute('data-type'); 
        if(typeof window.renderPrePracticeList === 'function') window.renderPrePracticeList(); 
        return; 
    }

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
        if(promptImage) {
            promptImage.classList.remove('blur-md');
            promptImage.classList.add('blur-none');
        }
        
        const supportToggle = document.getElementById('support-toggle');
        if (window.timeElapsed === 0 && supportToggle && supportToggle.checked) {
            if(typeof getAggregatedData === 'function') {
                const targetData = getAggregatedData(window.currentTheme, window.appState.selectedLevel);
                if(typeof window.dropPin === 'function') {
                    targetData.words.forEach(w => window.dropPin(w.text, window.currentTheme, true));
                }
            }
            window.supportInterval = setInterval(window.triggerSupportHint, 6000);
        }
        if (window.timeElapsed === 0 && typeof window.startTimer === 'function') {
            window.startTimer();
        }
        return;
    }

    const recIndicator = e.target.closest('#recording-indicator');
    if (recIndicator) {
        if(typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;
        return;
    }

    const btnFinishTurn = e.target.closest('#btn-finish-turn');
    if (btnFinishTurn) {
        window.finishGameAndShowResult();
        return;
    }

    const btnPlayAgain = e.target.closest('#btn-play-again');
    if (btnPlayAgain) {
        const finishBtn = document.getElementById('btn-finish-turn'); if(finishBtn) finishBtn.classList.add('hidden');
        const rInd = document.getElementById('recording-indicator'); if(rInd) rInd.classList.add('hidden');
        const startBtn = document.getElementById('btn-start-turn'); if(startBtn) { startBtn.classList.remove('hidden'); startBtn.classList.add('animate-attention'); }
        const sText = document.getElementById('status-text'); if(sText) sText.textContent = "Ready";
        const pImage = document.getElementById('prompt-image');
        if (pImage) {
            if (window.appState.selectedMode === 'mosaic') {
                pImage.classList.remove('blur-none', 'blur-md');
                pImage.style.filter = `blur(${window.MosaicGame ? window.MosaicGame.maxBlur : 40}px)`;
                pImage.style.transform = 'scale(1.1)';
            } else { pImage.style.filter = ''; pImage.style.transform = ''; pImage.classList.remove('blur-none'); pImage.classList.add('blur-md'); }
        }

        const vr = document.getElementById('view-result');
        if (vr) { vr.style.removeProperty('display'); vr.classList.add('hidden'); }

        if (window.tempSelectedThemeId) {
            window.startGameWithTheme(window.tempSelectedThemeId);
        } else {
            if (typeof showView === 'function') showView(document.getElementById('view-select'));
            if (typeof window.renderThemeGrid === 'function') window.renderThemeGrid();
        }
        return;
    }

    const practiceStartBtn = e.target.closest('#btn-start-practice');
    if (practiceStartBtn) {
        window.togglePracticeRecording();
        return;
    }

    const practiceCloseBtn = e.target.closest('#btn-close-practice') || e.target.closest('button[onclick*="closePractice"]');
    if (practiceCloseBtn) {
        window.closePracticeModal();
        return;
    }

    const btnGotoAbout = e.target.closest('#btn-goto-about');
    if (btnGotoAbout) {
        if (typeof showView === 'function') showView(document.getElementById('view-about'));
        return;
    }
});

document.addEventListener('click', (e) => {
    const btnOqStart = e.target.closest('#btn-oq-start');
    if (btnOqStart) {
        if (typeof window.OralQuestGame !== 'undefined') {
            window.OralQuestGame.startRecording();
            window.isRecording = true;
        }
    }

    const oqIndicator = e.target.closest('#oq-recording-indicator');
    if (oqIndicator) {
        if (typeof window.OralQuestGame !== 'undefined') {
            window.OralQuestGame.stopRecording();
        }
    }

    const btnOqNext = e.target.closest('#btn-oq-next');
    if (btnOqNext) {
        if (typeof window.OralQuestGame !== 'undefined') {
            window.OralQuestGame.handleNextButton();
        }
    }
});

window.addEventListener('DOMContentLoaded', window.initApp);

function setupOqPasswordLock() {
    const oqBtn = document.querySelector('.mode-btn[data-mode="oralquest"]');
    if (oqBtn) {
        oqBtn.addEventListener('click', (e) => {
            const pass = prompt("ORAL QUESTは現在開発中です。テスト用パスワードを入力してください:");
            if (pass !== "9999") {
                e.stopImmediatePropagation();
                e.preventDefault();
                alert("パスワードが違います。");
            }
        }, true); 
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOqPasswordLock);
} else {
    setupOqPasswordLock();
}

window.checkUrlParameters = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeId = urlParams.get('theme');
    const levelId = urlParams.get('level');
    const formId = urlParams.get('formId');

    if (themeId && formId) {
        window.appState.selectedMode = 'snapshot';
        window.appState.selectedLevel = levelId || 'elementary';
        window.appState.formId = formId; 

        document.querySelectorAll('body > div[id^="view-"], .app-container > div[id^="view-"]').forEach(v => v.classList.add('hidden'));

        const modal = document.getElementById('student-auth-modal');
        if (modal) {
            document.getElementById('input-student-class').value = localStorage.getItem('picSpeakStudentClass') || '';
            document.getElementById('input-student-number').value = localStorage.getItem('picSpeakStudentNumber') || '';
            document.getElementById('input-student-name').value = localStorage.getItem('picSpeakStudentName') || '';
            modal.classList.remove('hidden');

            document.getElementById('btn-start-assignment').onclick = () => {
                const sClass = document.getElementById('input-student-class').value.trim();
                const sNumber = document.getElementById('input-student-number').value.trim();
                const sName = document.getElementById('input-student-name').value.trim();
                
                if (!sClass || !sNumber || !sName) {
                    alert("クラス、出席番号、名前をすべて入力してください！");
                    return;
                }
                
                localStorage.setItem('picSpeakStudentClass', sClass);
                localStorage.setItem('picSpeakStudentNumber', sNumber);
                localStorage.setItem('picSpeakStudentName', sName);
                modal.classList.add('hidden');
                
                const playKey = `playCount_${themeId}`;
                let playCount = parseInt(localStorage.getItem(playKey) || '0');
                localStorage.setItem(playKey, playCount);

                window.tempSelectedThemeId = themeId;
                window.startGameWithTheme(themeId);
            };
        }
    }
};

window.setupSubmitButton = function(score) {
    const formId = window.appState.formId;
    const submitBtn = document.getElementById('btn-submit-score');
    
    if (formId && submitBtn) {
        submitBtn.classList.remove('hidden');
        submitBtn.onclick = null;
        
        submitBtn.onclick = () => {
            submitBtn.innerHTML = '送信中... ⏳';
            submitBtn.disabled = true;

            const sClass = localStorage.getItem('picSpeakStudentClass') || '不明';
            const sNumber = localStorage.getItem('picSpeakStudentNumber') || '不明';
            const sName = localStorage.getItem('picSpeakStudentName') || '不明';
            const themeTitle = window.currentTheme ? window.currentTheme.titleJa : '不明なテーマ';
            
            const playKey = `playCount_${window.currentTheme.id}`;
            let playCount = parseInt(localStorage.getItem(playKey) || '1');

            const formData = new FormData();
            formData.append('entry.60653978', sClass);       
            formData.append('entry.669728669', sNumber);      
            formData.append('entry.1569338538', sName);        
            formData.append('entry.1929409314', themeTitle);   
            formData.append('entry.987986025', score + '%');  
            formData.append('entry.1854591044', playCount + '回目'); 

            const url = `https://docs.google.com/forms/d/e/${formId}/formResponse`;

            fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            }).then(() => {
                submitBtn.innerHTML = '✅ 提出完了！';
                submitBtn.classList.replace('from-green-400', 'from-gray-300');
                submitBtn.classList.replace('to-emerald-500', 'to-gray-400');
                localStorage.setItem(playKey, playCount + 1); 
                alert('先生にスコアが送信されました！よくがんばりましたね！');
            }).catch(err => {
                submitBtn.innerHTML = '❌ 送信失敗（もう一度押す）';
                submitBtn.disabled = false;
                alert('送信に失敗しました。電波の良いところで再度お試しください。');
            });
        };
    }
};

window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof window.checkUrlParameters === 'function') {
            window.checkUrlParameters();
        }
    }, 500);
});

document.addEventListener('click', (e) => {
    const toIndexBtn = e.target.closest('[onclick*="index.html"]');
    
    if (toIndexBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        if (typeof pfState !== 'undefined' && pfState.isPlaying) {
            pfState.isPlaying = false;
            if (pfState.timerId) clearInterval(pfState.timerId);
            try { if (typeof pfRec !== 'undefined' && pfRec) pfRec.abort(); } catch(err){}
        }
        if (window.isRecording && typeof window.stopSpeech === 'function') {
            window.stopSpeech();
        }
        
        window.location.href = 'play.html';
    }
}, true);