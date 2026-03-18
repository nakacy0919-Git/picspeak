// js/story_ui.js
// ==========================================
// PSS専用 UI（画面切り替え・リサイズ・フォント調整）制御
// ==========================================

function showStoryView(viewElement) {
    ['view-select', 'view-reading', 'view-retelling', 'view-result-story'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    });
    if(viewElement) {
        viewElement.classList.remove('hidden');
        viewElement.classList.add('flex');
    }
}

function updateStoryLevelUI() {
    const levels = ['elementary', 'junior_high', 'high_school'];
    levels.forEach(lvl => {
        const btn = document.getElementById(`btn-lvl-${lvl}`);
        if (!btn) return;
        if (window.storyState && lvl === window.storyState.selectedLevel) {
            btn.classList.add('bg-blue-500', 'text-white', 'border-blue-500', 'shadow-md');
            btn.classList.remove('bg-white', 'text-gray-500', 'border-gray-200', 'hover:bg-gray-50');
        } else {
            btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500', 'shadow-md');
            btn.classList.add('bg-white', 'text-gray-500', 'border-gray-200', 'hover:bg-gray-50');
        }
    });
}

function initFontSliders() {
    const setupSlider = (sliderId, targetId, storageKey) => {
        const slider = document.getElementById(sliderId);
        const target = document.getElementById(targetId);
        if (!slider || !target) return;
        const saved = localStorage.getItem(storageKey);
        if (saved) { slider.value = saved; target.style.fontSize = `${saved}px`; }
        slider.addEventListener('input', (e) => {
            target.style.fontSize = `${e.target.value}px`;
            localStorage.setItem(storageKey, e.target.value);
        });
    };
    setupSlider('font-slider-en', 'reading-text-content', 'pss-font-en');
    setupSlider('font-slider-ja', 'reading-text-ja', 'pss-font-ja');
    setupSlider('font-slider-transcript', 'reading-transcript', 'pss-font-tr');
}

function initResizers() {
    const container = document.getElementById('reading-panes-container');
    const rightContainer = document.getElementById('right-container');
    const paneImage = document.getElementById('pane-image');
    const paneText = document.getElementById('pane-text');
    const resizer1 = document.getElementById('resizer-1');
    const resizer2 = document.getElementById('resizer-2');
    if (!container || !rightContainer || !paneImage || !paneText || !resizer1 || !resizer2) return;

    const savedSizes = JSON.parse(localStorage.getItem('pss-pane-sizes-v4')) || { imgP: 35, textP: 45 };
    paneImage.style.flexBasis = `${savedSizes.imgP}%`;
    paneText.style.flexBasis = `${savedSizes.textP}%`;

    let isResizing = false; let currentResizer = null; let startPos = 0; let startBasisPrev = 0;

    const onStart = (e, resizer) => {
        isResizing = true; currentResizer = resizer;
        const isTouch = e.type.includes('touch');
        const isPC = window.innerWidth >= 768; 
        
        if (resizer.id === 'resizer-1') {
            if (isPC) {
                startPos = isTouch ? e.touches[0].clientX : e.clientX;
                startBasisPrev = (paneImage.getBoundingClientRect().width / container.getBoundingClientRect().width) * 100;
                document.body.style.cursor = 'col-resize';
            } else {
                startPos = isTouch ? e.touches[0].clientY : e.clientY;
                startBasisPrev = (paneImage.getBoundingClientRect().height / container.getBoundingClientRect().height) * 100;
                document.body.style.cursor = 'row-resize';
            }
        } else {
            startPos = isTouch ? e.touches[0].clientY : e.clientY;
            startBasisPrev = (paneText.getBoundingClientRect().height / rightContainer.getBoundingClientRect().height) * 100;
            document.body.style.cursor = 'row-resize';
        }
        e.preventDefault(); 
    };

    resizer1.addEventListener('mousedown', (e) => onStart(e, resizer1));
    resizer1.addEventListener('touchstart', (e) => onStart(e, resizer1), { passive: false });
    resizer2.addEventListener('mousedown', (e) => onStart(e, resizer2));
    resizer2.addEventListener('touchstart', (e) => onStart(e, resizer2), { passive: false });

    const onMove = (e) => {
        if (!isResizing || !currentResizer) return;
        const isPC = window.innerWidth >= 768; const isTouch = e.type.includes('touch');
        if (currentResizer.id === 'resizer-1') {
            const currentPos = isPC ? (isTouch ? e.touches[0].clientX : e.clientX) : (isTouch ? e.touches[0].clientY : e.clientY);
            const delta = currentPos - startPos;
            const containerSize = isPC ? container.getBoundingClientRect().width : container.getBoundingClientRect().height;
            const newBasis = startBasisPrev + (delta / containerSize) * 100;
            if (newBasis > 10 && newBasis < 85) paneImage.style.flexBasis = `${newBasis}%`;
        } else {
            const currentY = isTouch ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startPos;
            const newBasis = startBasisPrev + (deltaY / rightContainer.getBoundingClientRect().height) * 100;
            if (newBasis > 15 && newBasis < 85) paneText.style.flexBasis = `${newBasis}%`;
        }
    };

    const onEnd = () => {
        if (isResizing) {
            isResizing = false; document.body.style.cursor = 'default';
            const isPC = window.innerWidth >= 768;
            const imgP = isPC ? (paneImage.getBoundingClientRect().width / container.getBoundingClientRect().width) * 100 : (paneImage.getBoundingClientRect().height / container.getBoundingClientRect().height) * 100;
            const textP = (paneText.getBoundingClientRect().height / rightContainer.getBoundingClientRect().height) * 100;
            localStorage.setItem('pss-pane-sizes-v4', JSON.stringify({ imgP, textP }));
        }
    };

    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);
}