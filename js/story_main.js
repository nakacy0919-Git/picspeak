// js/story_main.js
// ==========================================
// Story Mode 専用 エントリーポイント（データ取得・初期化）
// ==========================================

// --- グローバル設定・状態管理 ---
window.pssSettings = {
    retellingTime: 20,
    effectsOn: true
};

window.storyState = { 
    selectedLevel: 'junior_high',
    currentStoryId: null,
    currentStory: null,
    currentSceneIndex: 0,
    playMode: null, 
    phase: 'select', 
    readingTranscripts: ["", "", "", ""], 
    retellingTranscripts: ["", "", "", ""]
};

window.micState = 'idle'; 
window.isTTSPlaying = false;
window.currentUtterance = null;
window.retellingTimer = null;
window.timeLeft = 0;
window.storyList = [];
window.perfectedSentences = new Set();
window.levelMap = { 'elementary': '小学生', 'junior_high': '中学生', 'high_school': '高校生' };

// --- アプリ初期化 ---
async function initStoryApp() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("お使いのブラウザは音声認識に非対応です。"); return; }
    
    // 分離したscoringファイルの関数を紐付け（音声認識用）
    if(typeof handleStorySpeechResult === 'function') {
        window.handleSpeechResult = handleStorySpeechResult;
    }
    window.handleSpeechEnd = function() {
        if (window.micState === 'listening') {
            try { startSpeech(); } catch(e) {}
        }
    };
    
    if(typeof initSpeechRecognition === 'function') {
        initSpeechRecognition(window.handleSpeechResult, window.handleSpeechEnd);
    }

    // 保存データの復元
    const savedLevel = localStorage.getItem('picSpeakSelectedLevel');
    if (savedLevel) window.storyState.selectedLevel = savedLevel;
    if(typeof updateStoryLevelUI === 'function') updateStoryLevelUI();
    
    const savedSettings = JSON.parse(localStorage.getItem('pss-settings'));
    if (savedSettings) {
        window.pssSettings = { ...window.pssSettings, ...savedSettings };
    }
    const timeSelect = document.getElementById('setting-time-select');
    const effectToggle = document.getElementById('setting-effect-toggle');
    if (timeSelect) timeSelect.value = window.pssSettings.retellingTime;
    if (effectToggle) effectToggle.checked = window.pssSettings.effectsOn;

    // UI初期化
    if(typeof initResizers === 'function') initResizers();
    if(typeof initFontSliders === 'function') initFontSliders();
    
    // データ取得
    await fetchStoryData();

    // ★修正: データ読み込み完了後に、最初の画面（ストーリー選択）を表示する！
    if(typeof showStoryView === 'function') {
        showStoryView(document.getElementById('view-select'));
    }
}

// レベル保存処理
window.setStoryLevel = function(level) {
    window.storyState.selectedLevel = level;
    localStorage.setItem('picSpeakSelectedLevel', level);
    if(typeof updateStoryLevelUI === 'function') updateStoryLevelUI();
};

// 設定保存処理
window.savePssSettings = function() {
    const timeSelect = document.getElementById('setting-time-select');
    const effectToggle = document.getElementById('setting-effect-toggle');
    if (timeSelect) window.pssSettings.retellingTime = parseInt(timeSelect.value);
    if (effectToggle) window.pssSettings.effectsOn = effectToggle.checked;
    localStorage.setItem('pss-settings', JSON.stringify(window.pssSettings));
    const modal = document.getElementById('pss-settings-modal');
    if (modal) modal.classList.add('hidden');
};

// --- データフェッチと描画 ---
async function fetchStoryData() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 font-bold py-10">Loading Stories...</div>';
    try {
        const response = await fetch('data/story_list.json?t=' + new Date().getTime());
        const storyIds = await response.json();
        const fetchPromises = storyIds.map(id => fetch(`data/stories/${id}.json?t=${new Date().getTime()}`).then(res => res.ok ? res.json() : null).catch(e => null));
        const results = await Promise.all(fetchPromises);
        window.storyList = results.filter(data => data !== null);
        renderStoryGrid();
    } catch (error) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold py-10">Error loading stories</div>';
    }
}

function renderStoryGrid() {
    const grid = document.getElementById('story-grid');
    if (!grid) return;
    let html = '';
    window.storyList.forEach(story => {
        html += `<div class="cursor-pointer rounded-3xl overflow-hidden shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all relative transform hover:-translate-y-1 bg-white flex flex-col" onclick="window.openStoryModeSelect('${story.id}')">
            <div class="relative w-full aspect-video bg-gray-50 shrink-0 p-4">
                <img src="${story.imageSrc}" onerror="this.src='assets/images/icon.png'" class="absolute inset-0 w-full h-full object-contain p-2">
            </div>
            <div class="p-4 text-center text-sm md:text-lg font-black text-gray-700 border-t border-gray-100 bg-white">${story.titleJa}</div>
        </div>`;
    });
    grid.innerHTML = html;
}

// 起動トリガー
window.addEventListener('DOMContentLoaded', initStoryApp);