// js/ui.js
// ==========================================
// UI制御（画面遷移、モーダル、ボタン操作）モジュール
// ==========================================

window.showView = function(viewElement) {
    const views = [
        document.getElementById('view-start'),
        document.getElementById('view-select'),
        document.getElementById('view-play'),
        document.getElementById('view-result')
    ];
    views.forEach(v => { if(v) v.classList.add('hidden'); });
    if(viewElement) {
        viewElement.classList.remove('hidden');
        viewElement.classList.add('fade-in');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- モーダルの開閉処理 ---
    const btnOpenTutorial = document.getElementById('btn-open-tutorial');
    const btnCloseTutorial = document.getElementById('btn-close-tutorial');
    const tutorialModal = document.getElementById('tutorial-modal');
    if(btnOpenTutorial) btnOpenTutorial.addEventListener('click', () => tutorialModal.classList.remove('hidden'));
    if(btnCloseTutorial) btnCloseTutorial.addEventListener('click', () => tutorialModal.classList.add('hidden'));

    const btnOpenHistory = document.getElementById('btn-open-history');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const historyModal = document.getElementById('history-modal');
    if(btnOpenHistory) { 
        btnOpenHistory.addEventListener('click', () => { 
            if (typeof renderHistoryLogs === 'function') renderHistoryLogs(); 
            historyModal.classList.remove('hidden'); 
        }); 
    }
    if(btnCloseHistory) btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));

    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsModal = document.getElementById('settings-modal');
    if(btnOpenSettings) btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    if(btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    // --- 各種設定ボタンの処理 ---
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            timeBtns.forEach(b => { b.classList.remove('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200'); });
            const target = e.currentTarget;
            target.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200');
            target.classList.add('selected-time-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            if (window.appState) window.appState.customTimeLimit = parseInt(target.getAttribute('data-time'));
        });
    });

    const playerBtns = document.querySelectorAll('.player-btn');
    playerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            playerBtns.forEach(b => { b.classList.remove('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-white', 'border-gray-200', 'text-gray-700'); });
            const target = e.currentTarget; 
            target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
            target.classList.add('selected-player-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            if (window.appState) window.appState.selectedPlayers = parseInt(target.getAttribute('data-players'));
        });
    });

    const levelBtns = document.querySelectorAll('.level-btn');
    const currentLevelBadge = document.getElementById('current-level-badge');
    levelBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            levelBtns.forEach(b => { b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-white', 'border-gray-200', 'text-gray-700'); });
            const target = e.currentTarget;
            target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
            target.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            if (window.appState) {
                window.appState.selectedLevel = target.getAttribute('data-level');
                let levelText = "中学生レベル";
                if (window.appState.selectedLevel === "elementary") levelText = "小学生レベル";
                if (window.appState.selectedLevel === "high_school") levelText = "高校生レベル";
                if(currentLevelBadge) currentLevelBadge.textContent = levelText;
            }
        });
    });

    // --- アコーディオンの開閉処理 ---
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-more-btn')) {
            const parent = e.target.closest('div.mb-10');
            const extraItems = parent.querySelectorAll('.extra-item');
            const isHidden = extraItems[0].classList.contains('hidden');
            extraItems.forEach(item => item.classList.toggle('hidden'));
            e.target.innerHTML = isHidden ? '<span class="pointer-events-none">閉じる</span> <span class="text-2xl pointer-events-none">▲</span>' : '<span class="pointer-events-none">もっと表現を確認する</span> <span class="text-2xl pointer-events-none">▼</span>';
        }
    });

    // --- スマホ用の画面リサイズバー処理 ---
    const resizer = document.getElementById('resizer');
    const imagePanel = document.getElementById('image-panel');
    let startY = 0; let startHeight = 0;
    if (resizer && imagePanel) {
        resizer.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; startHeight = imagePanel.getBoundingClientRect().height; e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove', (e) => {
            if (startY === 0) return;
            let newHeight = startHeight + (e.touches[0].clientY - startY);
            if (newHeight < 100) newHeight = 100;
            if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
            imagePanel.style.height = `${newHeight}px`;
        }, { passive: false });
        document.addEventListener('touchend', () => { startY = 0; });
    }
});