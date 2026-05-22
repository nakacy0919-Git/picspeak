/**
 * NG WORD SURVIVAL モード
 * 外部APIへの過度なアクセスを防ぐため、静的な辞書(synonyms.json)を使用する完全スケール版
 */

class NgWordGame {
    constructor() {
        this.ngWords = [];
        this.isGameOver = false;
        this.synonymDict = {}; // JSONから読み込んだ辞書データを格納
        this.isDictLoaded = false;
        
        // UI要素の取得
        this.ngPanel = document.getElementById('ng-word-panel');
        this.ngList = document.getElementById('ng-word-list');
        this.alertOverlay = document.getElementById('ng-alert-overlay');

        // ゲームクラス初期化時に辞書を裏で読み込んでおく
        this.loadDictionary();
    }

    // 辞書JSONをロードする
    async loadDictionary() {
        try {
            // キャッシュを防ぐためにタイムスタンプを付与
            const response = await fetch('data/synonyms.json?t=' + new Date().getTime());
            if (response.ok) {
                this.synonymDict = await response.json();
                this.isDictLoaded = true;
                console.log("[PicSpeak] Synonym dictionary loaded successfully.");
            }
        } catch (error) {
            console.error("[PicSpeak] Failed to load synonyms.json:", error);
        }
    }

    // ゲーム開始前の初期化
    init(themeData) {
        this.isGameOver = false;
        this.ngWords = this.extractNgWords(themeData);
        this.renderNgWords();
        
        // パネルを表示
        if (this.ngPanel) this.ngPanel.classList.remove('hidden');
    }

    // JSONからNGワードを自動抽出
    extractNgWords(themeData) {
        if (themeData.ngWords && themeData.ngWords.length > 0) {
            return themeData.ngWords;
        }
        const elemWords = themeData.scoringData.elementary.words;
        const candidates = elemWords.filter(w => w.type === 'object' || w.type === 'gist');
        
        candidates.sort((a, b) => b.points - a.points);
        return candidates.slice(0, 3).map(w => w.text.toLowerCase());
    }

    // 画面にNGワードを表示する
    renderNgWords() {
        if (!this.ngList) return;
        this.ngList.innerHTML = '';
        this.ngWords.forEach(word => {
            const li = document.createElement('li');
            li.textContent = word.toUpperCase();
            this.ngList.appendChild(li);
        });
    }

    // 発話テキストにNGワードが含まれているかチェックする
    checkNgWord(transcript) {
        if (this.isGameOver) return false;

        const lowerTranscript = transcript.toLowerCase();
        
        for (let word of this.ngWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(lowerTranscript)) {
                this.triggerGameOver(word);
                return true; 
            }
        }
        return false;
    }

    // NGワードを言ってしまった時のペナルティ演出 ＆ 辞書産フィードバック
    triggerGameOver(word) {
        this.isGameOver = true;
        
        if (this.alertOverlay) {
            this.alertOverlay.classList.remove('hidden');
            
            // 読み込んでおいたローカル辞書からヒントを取得
            const hints = this.synonymDict[word];
            let hintHtml = "";
            
            if (hints && hints.length > 0) {
                const hintText = hints.join(", ");
                hintHtml = `<div class="mt-8 text-2xl md:text-4xl font-bold text-yellow-300 drop-shadow-md text-center leading-relaxed">
                                <span class="block text-white text-lg md:text-2xl mb-2">💡 Try saying:</span>
                                ${hintText}
                            </div>`;
            } else {
                hintHtml = `<div class="mt-8 text-xl md:text-3xl font-bold text-yellow-300 drop-shadow-md text-center">
                                <span class="block text-white text-lg md:text-2xl mb-2">💡 Hint:</span>
                                Describe its color, shape, or action!
                            </div>`;
            }

            this.alertOverlay.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 bg-black/80 rounded-3xl backdrop-blur-md border-4 border-red-500 shadow-2xl w-11/12 max-w-2xl">
                    <span class="text-6xl md:text-8xl font-black text-red-500 drop-shadow-lg uppercase tracking-tighter mb-2 animate-pulse">NG: ${word.toUpperCase()}!</span>
                    ${hintHtml}
                </div>
            `;
            
            if (typeof window.stopSpeech === 'function') {
                window.stopSpeech();
            }
            window.isRecording = false;

            setTimeout(() => {
                this.alertOverlay.classList.add('hidden');
                if (typeof window.finishGameAndShowResult === 'function') {
                    window.finishGameAndShowResult(); 
                }
            }, 5000);
        }
    }

    cleanup() {
        if (this.ngPanel) this.ngPanel.classList.add('hidden');
        if (this.alertOverlay) this.alertOverlay.classList.add('hidden');
    }
}

const ngWordGame = new NgWordGame();