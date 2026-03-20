// js/ui.js
// ==========================================
// UI制御（画面遷移、モーダル、ボタン操作、リサイズ、STEPアニメーション）
// ==========================================

window.showView = function(viewElement) {
    const views = [
        document.getElementById('view-start'),
        document.getElementById('view-select'),
        document.getElementById('view-play'),
        document.getElementById('view-result'),
        document.getElementById('view-about')
    ];
    views.forEach(v => { if(v) v.classList.add('hidden'); });
    if(viewElement) {
        viewElement.classList.remove('hidden');
        viewElement.classList.add('fade-in');
    }
};

document.addEventListener('DOMContentLoaded', () => {
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

    const btnCloseTranscript = document.getElementById('btn-close-transcript');
    const transcriptModal = document.getElementById('transcript-modal');
    if(btnCloseTranscript) {
        btnCloseTranscript.addEventListener('click', () => {
            if(transcriptModal) transcriptModal.classList.add('hidden');
        });
    }

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

    // ★画像選択画面（STEP2）のTarget Level 選択時の処理（UIの切り替えのみ）
    const levelBtns = document.querySelectorAll('.level-btn');
    const currentLevelBadge = document.getElementById('current-level-badge');
    levelBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // ボタンの見た目切り替え
            levelBtns.forEach(b => { b.classList.remove('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg'); b.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700'); });
            const target = e.currentTarget;
            target.classList.remove('bg-gray-50', 'border-gray-200', 'text-gray-700');
            target.classList.add('selected-level-btn', 'bg-sns-gradient', 'text-white', 'shadow-lg');
            
            // アプリのレベル状態を更新し、バッジの文字を変える
            if (window.appState) {
                window.appState.selectedLevel = target.getAttribute('data-level');
                let levelText = "中学生レベル";
                if (window.appState.selectedLevel === "elementary") levelText = "小学生レベル";
                if (window.appState.selectedLevel === "high_school") levelText = "高校生レベル";
                if(currentLevelBadge) currentLevelBadge.textContent = levelText;
                
                // ※もしレベル切り替え時に画像リストの中身も変えたい場合は、ここで renderThemes() などを呼ぶ仕組みが main.js 側に必要です。
            }
        });
    });

    // ★初期画面（STEP1）の Game Mode 選択時の処理
    const modeBtns = document.querySelectorAll('.mode-btn');
    const btnGotoSelect = document.getElementById('btn-goto-select');
    const modeQuestion = document.getElementById('mode-question'); // 追加

    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // ボタンの見た目切り替え（デザイン案に合わせて、選択時はピンク背景に）
            modeBtns.forEach(b => { 
                b.classList.remove('selected-mode-btn', 'bg-pink-50', 'border-pink-300', 'text-pink-600', 'shadow-md', 'scale-105'); 
                b.classList.add('bg-white', 'border-gray-200', 'text-gray-700'); 
            });
            const target = e.currentTarget;
            target.classList.remove('bg-white', 'border-gray-200', 'text-gray-700');
            target.classList.add('selected-mode-btn', 'bg-pink-50', 'border-pink-300', 'text-pink-600', 'shadow-md', 'scale-105');
            
            if (window.appState) {
                window.appState.selectedMode = target.getAttribute('data-mode');
                if (btnGotoSelect) {
                    btnGotoSelect.innerText = window.appState.selectedMode === 'story' ? 'SELECT STORY' : 'SELECT IMAGE';
                }
            }

            // 「どちらのGameで遊びますか？」のテキストをフェードアウトして消す
            if(modeQuestion) {
                modeQuestion.style.opacity = '0';
                setTimeout(() => modeQuestion.classList.add('hidden'), 300);
            }

            // 次へ進めるようにSELECTボタンのロック解除
            if(btnGotoSelect) {
                btnGotoSelect.classList.remove('opacity-40', 'pointer-events-none');
                btnGotoSelect.classList.add('hover:shadow-sns-gradient/40', 'hover:scale-105');
            }
        });
    });

    // ★ウサギちゃんの吹き出し処理
    const rabbitChar = document.getElementById('rabbit-char');
    const rabbitBubble = document.getElementById('rabbit-bubble');
    const btnCloseBubble = document.getElementById('btn-close-bubble');

    if (rabbitChar && rabbitBubble) {
        rabbitChar.addEventListener('click', () => {
            rabbitBubble.classList.toggle('hidden');
        });
    }
    if (btnCloseBubble && rabbitBubble) {
        btnCloseBubble.addEventListener('click', () => {
            rabbitBubble.classList.add('hidden');
        });
    }

    // トグルボタン等の汎用処理
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-more-btn');
        if (btn) {
            const parent = btn.closest('.feedback-section');
            if(parent) {
                const extraItems = parent.querySelectorAll('.extra-item');
                if(extraItems.length > 0) {
                    const isHidden = extraItems[0].classList.contains('hidden');
                    extraItems.forEach(item => item.classList.toggle('hidden'));
                    btn.innerHTML = isHidden ? '<span class="pointer-events-none">閉じる</span> <span class="text-lg md:text-xl pointer-events-none">▲</span>' : '<span class="pointer-events-none">もっと表現を確認する</span> <span class="text-lg md:text-xl pointer-events-none">▼</span>';
                }
            }
        }
    });

    // パネルリサイズ処理
    const imagePanel = document.getElementById('image-panel');
    const resizerVertical = document.getElementById('resizer-vertical');
    const resizerHorizontal = document.getElementById('resizer-horizontal');
    
    let startY = 0; let startHeight = 0;
    if (resizerVertical && imagePanel) {
        resizerVertical.addEventListener('touchstart', (e) => { 
            startY = e.touches[0].clientY; 
            startHeight = imagePanel.getBoundingClientRect().height; 
            e.preventDefault(); 
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (startY === 0) return;
            let newHeight = startHeight + (e.touches[0].clientY - startY);
            if (newHeight < 100) newHeight = 100;
            if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7;
            imagePanel.style.height = `${newHeight}px`;
        }, { passive: false });
        
        document.addEventListener('touchend', () => { startY = 0; });
    }

    let isResizingH = false;
    if (resizerHorizontal && imagePanel) {
        const startResizeH = (e) => {
            isResizingH = true;
            e.preventDefault();
        };
        const doResizeH = (e) => {
            if (!isResizingH) return;
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            let newWidthPercent = (clientX / window.innerWidth) * 100;
            if (newWidthPercent < 20) newWidthPercent = 20;
            if (newWidthPercent > 80) newWidthPercent = 80;
            imagePanel.style.width = `${newWidthPercent}%`;
        };
        const stopResizeH = () => { isResizingH = false; };

        resizerHorizontal.addEventListener('mousedown', startResizeH);
        document.addEventListener('mousemove', doResizeH);
        document.addEventListener('mouseup', stopResizeH);
        
        resizerHorizontal.addEventListener('touchstart', startResizeH, { passive: false });
        document.addEventListener('touchmove', doResizeH, { passive: false });
        document.addEventListener('touchend', stopResizeH);
    }
    
    window.addEventListener('resize', () => {
        if (!imagePanel) return;
        if (window.innerWidth < 768) {
            imagePanel.style.width = '';
        } else {
            imagePanel.style.height = '';
        }
    });
});