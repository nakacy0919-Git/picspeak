// js/mosaic_game.js
// ==========================================
// ★ MOSAICモード専用ロジック (プロトタイプ版)
// ==========================================

window.MosaicGame = {
    targetWords: 50, // 100%モザイクが晴れる目標単語数
    maxBlur: 40,     // 初期のモザイク（ぼかし）の強さ(px)
    isActive: false,

    // ゲーム開始時に呼ばれる処理
    start: function() {
        this.isActive = true;
        console.log("MOSAIC mode started! Target words:", this.targetWords);
        
        // 画像に強烈な初期モザイクをかける
        const img = document.getElementById('prompt-image');
        if (img) {
            img.style.filter = `blur(${this.maxBlur}px)`;
            img.style.transition = 'filter 0.5s ease-out'; // 滑らかに晴れるアニメーション
            img.style.transform = 'scale(1.1)'; // 端のぼかしの隙間を隠すために少し拡大
        }
    },

    // ゲーム終了（強制終了）時に呼ばれる処理
    stop: function() {
        this.isActive = false;
    },

    // ユーザーが発話するたびに呼ばれる処理（リアルタイム更新）
    updateProgress: function(currentWordCount) {
        if (!this.isActive) return;

        const img = document.getElementById('prompt-image');
        if (!img) return;

        // 進行度を計算 (0.0 〜 1.0)
        let progress = currentWordCount / this.targetWords;
        if (progress > 1.0) progress = 1.0; // 100%を上限とする

        // 残りのモザイク(ぼかし)値を計算: 進行度が上がるほど0に近づく
        let currentBlur = this.maxBlur * (1 - progress);

        // 画像のモザイクを更新
        img.style.filter = `blur(${currentBlur}px)`;

        // ※UIのパーセンテージバーの更新処理を削除（game.jsに任せるため）

        // 100%達成（クリア）判定
        if (progress >= 1.0) {
            this.onClear();
        }
    },

    // 目標単語数に到達した時の処理
    onClear: function() {
        if (!this.isActive) return;
        this.isActive = false; // クリア済みフラグ

        console.log("MOSAIC CLEARED!");
        
        // ピカッと光って画像が完全にクリアになる演出
        const img = document.getElementById('prompt-image');
        if (img) {
            img.style.filter = 'blur(0px) brightness(1.2)';
            setTimeout(() => {
                img.style.filter = 'blur(0px) brightness(1.0)';
                img.style.boxShadow = '0 0 40px rgba(236,72,153,0.6)'; // ピンクの後光
            }, 300);
        }
    }
};