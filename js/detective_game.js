// js/detective_game.js
// ==========================================
// DETECTIVEモード専用ロジック (完全版：UI破壊バグ修正済)
// ==========================================

window.DetectiveGame = {
    themeData: null,
    foundIds: new Set(),
    isActive: false,
    startTime: 0,
    timerInterval: null,
    finalTime: 0,

    init: function(data) {
        this.themeData = data;
        this.foundIds.clear();
        this.isActive = true;
        this.startTime = 0;
        this.finalTime = 0;

        const imgA = document.getElementById('prompt-image');
        const imgB = document.getElementById('prompt-image-b');
        if (imgA) {
            imgA.src = data.imageSrc;
            imgA.style = ''; 
            imgA.className = 'absolute inset-0 w-full h-full object-contain transition-all duration-300 blur-none';
            if (imgB) imgB.classList.add('hidden'); 
        }

        // ★★★ 修正箇所：ターゲットレベルの枠を誤爆しないよう、id="view-play" の中だけを探す ★★★
        const statsGrid = document.querySelector('#view-play .grid.grid-cols-3');
        if (statsGrid) statsGrid.style.display = 'none';
        
        const compBar = document.getElementById('live-completion-text');
        if (compBar) compBar.closest('.bg-white').style.display = 'none';

        let detUi = document.getElementById('detective-ui');
        if (!detUi) {
            detUi = document.createElement('div');
            detUi.id = 'detective-ui';
            detUi.className = 'bg-yellow-50 rounded-2xl p-4 shadow-sm border border-yellow-200 flex flex-col gap-3 mb-3 shrink-0';
            const transcriptBox = document.getElementById('transcript-box');
            if (transcriptBox) transcriptBox.parentNode.insertBefore(detUi, transcriptBox);
        }
        
        detUi.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <div class="text-yellow-700 font-black text-lg md:text-xl flex items-center gap-2">
                    <span class="text-2xl md:text-3xl">🔎</span> 
                    <span>Found: <span id="det-found-count" class="text-3xl md:text-4xl text-pink-500 ml-1">0</span> / ${data.totalDifferences}</span>
                </div>
                <div class="text-yellow-600 font-black text-xl flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-inner border border-yellow-100">
                    ⏱ <span id="det-time">0.0</span>s
                </div>
            </div>
            <div id="det-hint-box" class="w-full bg-white border border-dashed border-yellow-300 rounded-xl px-3 py-2 text-xs md:text-sm text-gray-500 font-bold hidden animate-pulse">
            </div>
        `;
        detUi.style.display = 'flex';

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.isActive && window.isRecording) {
                if (this.startTime === 0) this.startTime = Date.now();
                const elapsed = (Date.now() - this.startTime) / 1000;
                document.getElementById('det-time').textContent = elapsed.toFixed(1);
                this.finalTime = elapsed;
            }
        }, 100);

        const supportToggle = document.getElementById('support-toggle');
        if (supportToggle) {
            supportToggle.removeEventListener('change', window._detSupportToggle);
            window._detSupportToggle = (e) => {
                if (this.isActive) {
                    if (e.target.checked) this.drawAllHintMarks();
                    else this.clearAllHintMarks();
                }
            };
            supportToggle.addEventListener('change', window._detSupportToggle);

            if (supportToggle.checked) {
                const tryDraw = () => {
                    setTimeout(() => {
                        if (this.isActive) this.drawAllHintMarks();
                    }, 300);
                };
                if (imgA.complete && imgA.naturalWidth > 0) tryDraw();
                else imgA.addEventListener('load', tryDraw, { once: true });
            }
        }
    },

    checkSpeech: function(transcript) {
        if (!this.isActive || !this.themeData) return null;

        const lowerText = transcript.toLowerCase();
        const cleanTranscript = lowerText.replace(/[.,!?'"-]/g, ' ').trim();
        
        let newlyFound = [];
        let activeHint = null;

        const requiredWordCounts = {
            'elementary': 2,
            'junior_high': 3,
            'high_school': 4
        };
        // ★★★ 修正箇所：先生のアプリ仕様に合わせて selectedLevel から取得 ★★★
        const currentLevel = window.appState && window.appState.selectedLevel ? window.appState.selectedLevel : 'elementary';
        const requiredCount = requiredWordCounts[currentLevel];

        const stopWords = ['a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'it', 'has', 'have', 'and', 'now'];

        this.themeData.differences.forEach(diff => {
            if (this.foundIds.has(diff.id)) return;

            let targetIndex = -1, stateIndex = -1;
            let foundTargetWord = null, foundStateWord = null;

            diff.keywords.target.forEach(kw => {
                const idx = lowerText.indexOf(kw);
                if (idx !== -1 && (targetIndex === -1 || idx < targetIndex)) {
                    targetIndex = idx; foundTargetWord = kw;
                }
            });
            diff.keywords.state.forEach(kw => {
                const idx = lowerText.lastIndexOf(kw);
                if (idx !== -1 && (stateIndex === -1 || idx > stateIndex)) {
                    stateIndex = idx; foundStateWord = kw;
                }
            });

            const isCorrectOrder = (targetIndex !== -1 && stateIndex !== -1 && targetIndex < stateIndex);

            let isPerfect = false;
            let allModels = [];
            
            ['elementary', 'junior_high', 'high_school'].forEach(level => {
                if (diff.modelExpressions && diff.modelExpressions[level]) {
                    diff.modelExpressions[level].forEach(exp => {
                        allModels.push(exp.text.toLowerCase().replace(/[.,!?'"-]/g, ' ').trim());
                    });
                }
            });

            for (let model of allModels) {
                if (cleanTranscript.includes(model)) {
                    isPerfect = true;
                    break;
                }
            }

            let isLevelCleared = false;
            let maxMatchedWordsCount = 0;

            if (diff.modelExpressions && diff.modelExpressions[currentLevel]) {
                for (let exp of diff.modelExpressions[currentLevel]) {
                    const cleanModel = exp.text.toLowerCase().replace(/[.,!?'"-]/g, ' ').trim();
                    const modelWords = cleanModel.split(/\s+/).filter(w => w.length > 0 && !stopWords.includes(w));
                    
                    let currentMatchCount = 0;

                    modelWords.forEach(mw => {
                        const regex = new RegExp(`\\b${mw}\\b`, 'i');
                        if (regex.test(cleanTranscript)) {
                            currentMatchCount++;
                        }
                    });

                    if (currentMatchCount > maxMatchedWordsCount) {
                        maxMatchedWordsCount = currentMatchCount;
                    }

                    if (currentMatchCount >= requiredCount) {
                        isLevelCleared = true;
                        break; 
                    }
                }
            }

            if (isPerfect || (isLevelCleared && isCorrectOrder)) {
                this.foundIds.add(diff.id);
                newlyFound.push(diff);
                
                document.getElementById('det-found-count').textContent = this.foundIds.size;
                
                const hintMark = document.getElementById(`hint-mark-${diff.id}`);
                if (hintMark) hintMark.remove();

                this.markOnImage(diff);
                
                if (isPerfect) {
                    this.showPerfectEffect();
                    try {
                        if (typeof playSound === 'function') playSound('perfect');
                        else if (typeof window.playSuccessChime === 'function') window.playSuccessChime();
                    } catch(e) {}
                } else {
                    this.showFoundEffect();
                    try { 
                        if (typeof playSound === 'function') playSound('match');
                        else if (typeof window.playSuccessChime === 'function') window.playSuccessChime(); 
                    } catch(e) {}
                }
            } 
            else {
                if (targetIndex !== -1 && (stateIndex === -1 || targetIndex >= stateIndex) && !activeHint) {
                    activeHint = `💡 What about the <strong>"${foundTargetWord}"</strong>? <span class="text-pink-500">(Try adding/reordering: ${diff.keywords.state[0]})</span>`;
                } 
                else if (targetIndex === -1 && stateIndex !== -1 && !activeHint) {
                    activeHint = `💡 What is <strong>"${foundStateWord}"</strong>? <span class="text-blue-500">(Try starting with: ${diff.keywords.target[0]})</span>`;
                }
                else if (maxMatchedWordsCount > 0 && isCorrectOrder && !activeHint) {
                    const remaining = requiredCount - maxMatchedWordsCount;
                    activeHint = `💡 Good start! Add <strong>${remaining} more word(s)</strong> to complete the sentence!`;
                }
            }
        });

        const hintBox = document.getElementById('det-hint-box');
        if (hintBox) {
            if (activeHint && newlyFound.length === 0) {
                hintBox.innerHTML = activeHint;
                hintBox.classList.remove('hidden');
            } else {
                hintBox.classList.add('hidden');
            }
        }

        if (newlyFound.length > 0) {
            if (this.foundIds.size >= this.themeData.totalDifferences) {
                clearInterval(this.timerInterval);
                setTimeout(() => this.onClear(), 1500); 
            }
            return newlyFound;
        }
        return null;
    },

    getHighlightedText: function(transcript) {
        if (!this.themeData) return transcript;
        let result = transcript;
        
        let allKeywords = [];
        this.themeData.differences.forEach(diff => {
            allKeywords.push(...diff.keywords.target);
            allKeywords.push(...diff.keywords.state);
        });
        
        allKeywords.sort((a, b) => b.length - a.length);
        
        allKeywords.forEach(kw => {
            const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
            result = result.replace(regex, `<span class="text-pink-500 font-black">$1</span>`);
        });
        return result;
    },

    markOnImage: function(diff) {
        const container = document.getElementById('pin-container');
        const img = document.getElementById('prompt-image');
        if (!container || !img) return;

        const rect = img.getBoundingClientRect();
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (nw === 0 || nh === 0) return;

        const containerRatio = rect.width / rect.height;
        const imgRatio = nw / nh;

        let renderW, renderH, offsetX = 0, offsetY = 0;

        if (containerRatio > imgRatio) {
            renderH = rect.height;
            renderW = renderH * imgRatio;
            offsetX = (rect.width - renderW) / 2;
        } else {
            renderW = rect.width;
            renderH = renderW / imgRatio;
            offsetY = (rect.height - renderH) / 2;
        }

        const absoluteX = offsetX + (renderW * (diff.coordinates.x / 100));
        const absoluteY = offsetY + (renderH * (diff.coordinates.y / 100));
        const absoluteW = renderW * (diff.coordinates.width / 100);
        const absoluteH = renderH * (diff.coordinates.height / 100);

        const mark = document.createElement('div');
        mark.className = 'absolute border-[5px] border-red-500 bg-red-500/30 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.9)] z-50 animate-pop pointer-events-none';
        
        mark.style.width = `${absoluteW}px`;
        mark.style.height = `${absoluteH}px`;
        mark.style.left = `${absoluteX - absoluteW / 2}px`;
        mark.style.top = `${absoluteY - absoluteH / 2}px`;
        
        container.appendChild(mark);
    },

    drawAllHintMarks: function() {
        if (!this.themeData || !this.isActive) return;
        this.clearAllHintMarks(); 
        this.themeData.differences.forEach(diff => {
            if (!this.foundIds.has(diff.id)) {
                this.drawHintMark(diff);
            }
        });
    },

    drawHintMark: function(diff) {
        const container = document.getElementById('pin-container');
        const img = document.getElementById('prompt-image');
        if (!container || !img) return;

        const rect = img.getBoundingClientRect();
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (nw === 0 || nh === 0 || rect.width === 0) return;

        const containerRatio = rect.width / rect.height;
        const imgRatio = nw / nh;

        let renderW, renderH, offsetX = 0, offsetY = 0;

        if (containerRatio > imgRatio) {
            renderH = rect.height;
            renderW = renderH * imgRatio;
            offsetX = (rect.width - renderW) / 2;
        } else {
            renderW = rect.width;
            renderH = renderW / imgRatio;
            offsetY = (rect.height - renderH) / 2;
        }

        const absoluteX = offsetX + (renderW * (diff.coordinates.x / 100));
        const absoluteY = offsetY + (renderH * (diff.coordinates.y / 100));
        const absoluteW = renderW * (diff.coordinates.width / 100);
        const absoluteH = renderH * (diff.coordinates.height / 100);

        const mark = document.createElement('div');
        mark.id = `hint-mark-${diff.id}`; 
        mark.className = 'absolute border-[3px] border-dashed border-red-400 bg-red-400/10 rounded-full z-40 pointer-events-none';
        
        mark.style.width = `${absoluteW}px`;
        mark.style.height = `${absoluteH}px`;
        mark.style.left = `${absoluteX - absoluteW / 2}px`;
        mark.style.top = `${absoluteY - absoluteH / 2}px`;
        
        container.appendChild(mark);
    },

    clearAllHintMarks: function() {
        if (!this.themeData) return;
        this.themeData.differences.forEach(diff => {
            const hintMark = document.getElementById(`hint-mark-${diff.id}`);
            if (hintMark) hintMark.remove();
        });
    },

    showPerfectEffect: function() {
        const container = document.getElementById('image-panel');
        if (!container) return;
        
        if (typeof window.createConfetti === 'function') window.createConfetti();

        const popup = document.createElement('div');
        popup.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-[70] pointer-events-none w-full';
        
        popup.innerHTML = `
            <div class="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 animate-pulse" style="text-shadow: 0 0 30px rgba(250,204,21,0.8), 0 0 60px #facc15;">
                🌟 PERFECT! 🌟
            </div>
            <div class="mt-2 text-xl md:text-3xl font-black text-white" style="text-shadow: 0 0 10px rgba(0,0,0,0.5);">
                Flawless English!
            </div>
        `;
        
        popup.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        popup.style.opacity = '0';
        popup.style.scale = '0.3';
        popup.style.rotate = '-10deg';
        
        container.appendChild(popup);
        
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.scale = '1.2';
            popup.style.rotate = '0deg';
            
            setTimeout(() => { 
                popup.style.opacity = '0'; 
                popup.style.scale = '1.5'; 
                popup.style.translate = '0 -50px'; 
                setTimeout(() => popup.remove(), 600); 
            }, 1200); 
        });
    },

    showFoundEffect: function() {
        const container = document.getElementById('image-panel');
        if (!container) return;
        const popup = document.createElement('div');
        popup.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl font-black text-white z-[60] pointer-events-none flex items-center justify-center';
        popup.style.textShadow = '0 0 20px rgba(236,72,153,0.8), 0 0 40px #ec4899';
        popup.innerHTML = '🎯 FOUND!';
        popup.style.transition = 'all 0.5s ease-out';
        popup.style.opacity = '0';
        popup.style.scale = '0.5';
        container.appendChild(popup);
        
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.scale = '1.2';
            setTimeout(() => { popup.style.opacity = '0'; popup.style.scale = '1.5'; setTimeout(() => popup.remove(), 500); }, 800);
        });
    },

    cleanup: function() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Detective専用のUIを隠す
        const detUi = document.getElementById('detective-ui');
        if (detUi) detUi.style.display = 'none';
        
        // WPM・スコアの枠（3つの箱）の非表示設定を解除し、元の表示に戻す
        const statsGrid = document.querySelector('#view-play .grid.grid-cols-3');
        if (statsGrid) statsGrid.style.display = ''; 
        
        // Completion Rate のバーの非表示設定を解除し、元の表示に戻す
        const compBar = document.getElementById('live-completion-text');
        if (compBar) {
            const compBarContainer = compBar.closest('.bg-white');
            if (compBarContainer) compBarContainer.style.display = '';
        }
    },

    onClear: function() {
        this.isActive = false;
        if (typeof window.showExcellentPrompt === 'function') window.showExcellentPrompt();
        if (typeof window.createConfetti === 'function') window.createConfetti();
        
        setTimeout(() => {
            if (typeof window.stopSpeech === 'function') window.stopSpeech();
            if (typeof window.finishGameAndShowResult === 'function') window.finishGameAndShowResult();
        }, 2500);
    }
};