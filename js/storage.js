// js/storage.js
// ==========================================
// 学習ログ（ローカルストレージ）の保存と描画モジュール
// ==========================================

function saveLearningLog(logData) {
    let logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
    logs.unshift(logData);
    if(logs.length > 50) logs = logs.slice(0, 50); // 最新50件のみ保存
    localStorage.setItem('picspeak_logs', JSON.stringify(logs));
}

function renderHistoryLogs() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    let logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
    if(logs.length === 0) {
        historyList.innerHTML = `<p class="text-center text-gray-400 py-10 font-bold text-xl">まだプレイ履歴がありません。<br>遊んでスコアを残そう！</p>`;
        return;
    }
    
    let html = '';
    logs.forEach(log => {
        const dateObj = new Date(log.date);
        const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        let levelColor = "text-gray-500";
        if(log.level === 'elementary') levelColor = "text-green-500";
        if(log.level === 'junior_high') levelColor = "text-blue-500";
        if(log.level === 'high_school') levelColor = "text-pink-500";

        html += `
            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                <div>
                    <div class="text-sm md:text-base text-gray-400 font-bold">${dateStr} | Image: ${log.imageId}</div>
                    <div class="text-lg md:text-xl font-black uppercase mt-1 ${levelColor}">${log.level.replace('_', ' ')}</div>
                </div>
                <div class="text-right flex gap-6 md:gap-10">
                    <div class="flex flex-col items-center">
                        <span class="text-xs md:text-sm font-bold text-gray-400 uppercase">Score</span>
                        <span class="text-2xl md:text-3xl font-black text-gray-800">${log.score}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <span class="text-xs md:text-sm font-bold text-pink-400 uppercase">Comp.</span>
                        <span class="text-2xl md:text-3xl font-black text-pink-600">${log.completion}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    historyList.innerHTML = html;
}