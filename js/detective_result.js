// js/detective_result.js
// ==========================================
// DETECTIVEモード専用 リザルト画面 (ヘッダー見切れ修正版)
// ==========================================

window.DetectiveResult = {
    render: function(themeData, foundIds) {
        const container = document.getElementById('ranking-container');
        if (!container) return;

        // コンテナを一旦クリア
        container.innerHTML = '';

        // --- 1. ヘッダー部分（被り・見切れ防止のレイアウト調整） ---
        const isPerfect = foundIds.size >= themeData.totalDifferences;
        const titleText = isPerfect ? 'PERFECT DETECTIVE! 🎉' : 'TIME UP';
        const titleColor = isPerfect ? 'text-pink-500' : 'text-gray-800';
        const finalTime = window.DetectiveGame.finalTime ? window.DetectiveGame.finalTime.toFixed(1) : "---";

        const scoreHeader = document.createElement('div');
        // overflow-hidden を削除し、padding を広めに設定 (p-8 md:p-10)
        scoreHeader.className = 'bg-white rounded-3xl p-8 md:p-10 mb-8 shadow-md border border-gray-100 text-center flex flex-col items-center';
        
        scoreHeader.innerHTML = `
            <h2 class="text-4xl md:text-5xl font-black ${titleColor} tracking-widest leading-normal pt-2 mb-8">${titleText}</h2>
            
            <div class="flex flex-wrap justify-center items-end gap-6 md:gap-10 mt-2 w-full">
                <div class="bg-yellow-50 px-6 py-4 rounded-2xl border border-yellow-200 shadow-sm mb-1">
                    <p class="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Clear Time</p>
                    <p class="text-3xl md:text-4xl font-black text-yellow-700">${finalTime}<span class="text-base md:text-lg ml-1 text-yellow-500">sec</span></p>
                </div>
                
                <div class="bg-pink-50 px-8 py-5 rounded-2xl border border-pink-300 shadow-md transform scale-110">
                    <p class="text-sm font-bold text-pink-600 uppercase tracking-widest mb-1">見つけた間違い</p>
                    <p class="text-6xl md:text-7xl font-black text-pink-600 leading-none">
                        ${foundIds.size}
                        <span class="text-2xl md:text-3xl text-pink-300 ml-1">/ ${themeData.totalDifferences}</span>
                    </p>
                </div>
            </div>
            <p class="text-sm md:text-base font-bold text-gray-400 mt-10">すべての表現をチェックして、言えなかった英文を練習してみよう！</p>
        `;
        container.appendChild(scoreHeader);

        // --- 2. 左右の段組コンテナを作成 ---
        const columnsWrapper = document.createElement('div');
        columnsWrapper.className = 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start w-full';

        const leftCol = document.createElement('div');
        leftCol.className = 'flex flex-col gap-4';
        leftCol.innerHTML = `<h3 class="text-xl md:text-2xl font-black text-pink-500 border-b-4 border-pink-100 pb-2 mb-2 flex items-center gap-2">🎯 見つけた間違い</h3>`;

        const rightCol = document.createElement('div');
        rightCol.className = 'flex flex-col gap-4';
        rightCol.innerHTML = `<h3 class="text-xl md:text-2xl font-black text-gray-400 border-b-4 border-gray-100 pb-2 mb-2 flex items-center gap-2">💡 見逃した間違い</h3>`;

        // --- 3. カード生成処理 ---
        const foundItems = [];
        const missedItems = [];
        themeData.differences.forEach(diff => {
            if (foundIds.has(diff.id)) foundItems.push(diff);
            else missedItems.push(diff);
        });

        const createCardHTML = (diff, isFound) => {
            const cardOpacity = isFound ? 'opacity-100' : 'opacity-80 grayscale-[20%]';
            const borderColor = isFound ? 'border-pink-200' : 'border-gray-200';
            const badge = isFound 
                ? `<span class="bg-pink-100 text-pink-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">🎯 Found</span>`
                : `<span class="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">💡 Missed</span>`;

            const beforeY = diff.coordinates.y - 50; 

            const imageSection = `
                <div class="grid grid-cols-2 gap-3 mb-5 shrink-0">
                    <div class="relative overflow-hidden rounded-xl border-4 ${borderColor} aspect-square shadow-inner bg-gray-100">
                        <img src="${themeData.imageSrc}" class="absolute max-w-none transition-transform duration-500 hover:scale-110"
                             style="width: 400%; left: 50%; top: 50%; transform: translate(-${diff.coordinates.x}%, -${beforeY}%);">
                        <span class="absolute top-2 left-2 bg-gray-900/80 text-white text-[10px] font-bold px-2 py-1 rounded shadow">Before</span>
                    </div>
                    <div class="relative overflow-hidden rounded-xl border-4 ${borderColor} aspect-square shadow-inner bg-gray-100">
                        <img src="${themeData.imageSrc}" class="absolute max-w-none transition-transform duration-500 hover:scale-110"
                             style="width: 400%; left: 50%; top: 50%; transform: translate(-${diff.coordinates.x}%, -${diff.coordinates.y}%);">
                        <span class="absolute top-2 left-2 bg-pink-500/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow">After</span>
                        <div class="absolute border-4 border-red-500 rounded-full bg-red-500/30 z-10 pointer-events-none"
                             style="width: 35%; height: 35%; left: 50%; top: 50%; transform: translate(-50%, -50%);"></div>
                    </div>
                </div>
            `;

            const createExpressionList = (levelObj, levelName, levelColor) => {
                if (!levelObj || levelObj.length === 0) return '';
                let listItems = '';
                levelObj.forEach(exp => {
                    const safeText = exp.text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    const safeJa = exp.ja.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    listItems += `
                        <div class="mb-2 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-${levelColor}-300 transition-colors shadow-sm">
                            <p class="font-bold text-gray-800 text-xs md:text-sm leading-snug">${exp.text}</p>
                            <p class="font-bold text-gray-400 text-[10px] md:text-xs mt-1">${exp.ja}</p>
                            <div class="flex gap-2 mt-3">
                                <button onclick="window.playResultTTS('${safeText}')" class="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-[10px] md:text-xs font-bold text-gray-600 flex items-center justify-center gap-1">🔊 音声</button>
                                <button onclick="window.openPractice('${safeText}', '${safeJa}')" class="flex-1 py-1.5 bg-${levelColor}-50 hover:bg-${levelColor}-100 border border-${levelColor}-200 rounded text-[10px] md:text-xs font-bold text-${levelColor}-700 flex items-center justify-center gap-1">🎤 練習</button>
                            </div>
                        </div>
                    `;
                });
                return `
                    <div class="mb-4 bg-${levelColor}-50/40 p-3 rounded-xl border border-${levelColor}-100">
                        <span class="inline-block text-[10px] bg-${levelColor}-100 text-${levelColor}-700 px-2.5 py-1 rounded-md font-black tracking-wider mb-2">
                            ${levelName}
                        </span>
                        ${listItems}
                    </div>
                `;
            };

            return `
                <div class="bg-white rounded-2xl shadow-sm border ${borderColor} p-5 md:p-6 ${cardOpacity} transition-all h-full flex flex-col">
                    <div class="flex justify-between items-start mb-4 border-b border-gray-50 pb-3">
                        <h4 class="font-black text-gray-800 text-sm md:text-lg pr-2 leading-tight">
                            ${diff.nameJa}
                        </h4>
                        ${badge}
                    </div>
                    ${imageSection}
                    <div class="space-y-1 flex-1">
                        ${createExpressionList(diff.modelExpressions.elementary, '🌱 小学生', 'green')}
                        ${createExpressionList(diff.modelExpressions.junior_high, '🌿 中学生', 'blue')}
                        ${createExpressionList(diff.modelExpressions.high_school, '🌳 高校生', 'pink')}
                    </div>
                </div>
            `;
        };

        // --- 4. カラムへカードを追加 ---
        if (foundItems.length > 0) {
            foundItems.forEach((diff) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = "h-full";
                cardDiv.innerHTML = createCardHTML(diff, true);
                leftCol.appendChild(cardDiv);
            });
        } else {
            leftCol.innerHTML += `<div class="text-center py-10 text-gray-400 font-bold bg-white rounded-2xl border-2 border-dashed border-gray-200">見つけた間違いはありません</div>`;
        }

        if (missedItems.length > 0) {
            missedItems.forEach((diff) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = "h-full";
                cardDiv.innerHTML = createCardHTML(diff, false);
                rightCol.appendChild(cardDiv);
            });
        } else {
            rightCol.innerHTML += `<div class="text-center py-10 text-pink-400 font-bold bg-white rounded-2xl border-2 border-dashed border-pink-200">✨ すべて見つけました！完璧です！</div>`;
        }

        columnsWrapper.appendChild(leftCol);
        columnsWrapper.appendChild(rightCol);
        container.appendChild(columnsWrapper);
    }
};