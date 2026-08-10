// js/storage.js
// ==========================================
// 学習ログ（ローカルストレージ）の保存と描画モジュール
// ==========================================

window.saveLearningLog = function(logData) {
    try {
        let logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
        logs.unshift(logData);
        // 最新50件のみ保存してローカルストレージのパンクを防ぐ
        if (logs.length > 50) {
            logs = logs.slice(0, 50);
        }
        localStorage.setItem('picspeak_logs', JSON.stringify(logs));
    } catch (e) {
        console.error('学習ログの保存に失敗しました:', e);
    }
};

window.renderHistoryLogs = function() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('picspeak_logs')) || [];
    } catch (e) {
        console.error('学習ログの読み込みに失敗しました:', e);
    }

    // ログが空の場合の表示
    if (logs.length === 0) {
        historyList.innerHTML = `<p class="text-center text-gray-400 py-10 font-bold text-xl md:text-2xl leading-relaxed">まだプレイ履歴がありません。<br>遊んでスコアを残そう！</p>`;
        return;
    }
    
    // 日付フォーマッターの準備（例: 8/15 14:30）
    const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // HTMLエスケープ関数（安全な描画のため）
    const escapeHTML = (str) => {
        return String(str).replace(/[&<>"']/g, match => {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    };
    
    let html = '';
    logs.forEach(log => {
        // 日付のフォーマット
        let dateStr = "";
        try {
            dateStr = dateFormatter.format(new Date(log.date));
        } catch (e) {
            dateStr = "不明な日時";
        }
        
        // レベルに応じた文字色を設定
        let levelColor = "text-gray-500";
        if(log.level === 'elementary') levelColor = "text-green-500";
        if(log.level === 'junior_high') levelColor = "text-blue-500";
        if(log.level === 'high_school') levelColor = "text-pink-500";

        html += `
            <div class="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm mb-3 hover:bg-gray-100 transition-colors">
                <div>
                    <div class="text-xs md:text-sm text-gray-400 font-bold">${dateStr} | Image: ${escapeHTML(log.imageId || 'unknown')}</div>
                    <div class="text-base md:text-xl font-black uppercase mt-1 ${levelColor}">${escapeHTML(log.level || '').replace('_', ' ')}</div>
                </div>
                <div class="text-right flex gap-4 md:gap-8">
                    <div class="flex flex-col items-center shrink-0">
                        <span class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">Score</span>
                        <span class="text-xl md:text-3xl font-black text-gray-800">${Number(log.score || 0)}</span>
                    </div>
                    <div class="flex flex-col items-center shrink-0">
                        <span class="text-[10px] md:text-xs font-bold text-pink-400 uppercase tracking-widest">Comp.</span>
                        <span class="text-xl md:text-3xl font-black text-pink-600">${Number(log.completion || 0)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
};

// ==========================================
// 初期化イベント
// ==========================================
// play.htmlの History モーダルが開かれたタイミングでログを描画する
document.addEventListener('DOMContentLoaded', () => {
    const btnOpenHistory = document.getElementById('btn-open-history');
    if (btnOpenHistory) {
        btnOpenHistory.addEventListener('click', () => {
            window.renderHistoryLogs();
            document.getElementById('history-modal').classList.remove('hidden');
        });
    }

    const btnCloseHistory = document.getElementById('btn-close-history');
    if (btnCloseHistory) {
        btnCloseHistory.addEventListener('click', () => {
            document.getElementById('history-modal').classList.add('hidden');
        });
    }
});