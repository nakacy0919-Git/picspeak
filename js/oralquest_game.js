// js/oralquest_game.js
// ==========================================
// ORAL QUEST モード専用ロジック
// ==========================================

window.OralQuestGame = {
    currentStage: 1,
    subStage: "reading", // "reading" | "qa1" | "picture" | "qa2"
    transcript: "",
    interimTranscript: "",
    timerInterval: null,
    timeElapsed: 0,
    
    currentQ2: null,

    init: function() {
        this.currentStage = 1;
        this.subStage = "reading";
        this.transcript = "";
        this.interimTranscript = "";
        this.timeElapsed = 0;

        // JSONデータからStage 1のデータを読み込む
        let passageText = "";
        let q1Text = "";
        if (window.currentTheme && window.currentTheme.stage1) {
            passageText = window.currentTheme.stage1.passage || "";
            q1Text = window.currentTheme.stage1.q1.text || "";
        }

        // HTMLの画面にパッセージと質問をセットする
        const passageEl = document.getElementById('oq-passage-text');
        if (passageEl && passageText) passageEl.textContent = passageText;
        
        const q1TextEl = document.getElementById('oq-q1-text');
        if (q1TextEl && q1Text) q1TextEl.textContent = q1Text;

        this.updateUIForStage(1);
    },

    updateUIForStage: function(stage) {
        this.currentStage = stage;
        
        const progressObj = { 1: '10%', 2: '50%', 3: '90%' };
        document.getElementById('oq-progress-bar').style.width = progressObj[stage];

        [1, 2, 3].forEach(s => {
            const stepEl = document.getElementById(`oq-step-${s}`);
            if (s === stage) {
                stepEl.className = 'w-6 h-6 md:w-8 md:h-8 rounded-full font-black text-xs md:text-sm flex items-center justify-center bg-yellow-400 text-white shadow-md border-2 border-white';
            } else if (s < stage) {
                stepEl.className = 'w-6 h-6 md:w-8 md:h-8 rounded-full font-black text-xs md:text-sm flex items-center justify-center bg-green-500 text-white shadow-md border-2 border-white';
                stepEl.innerHTML = '✓';
            } else {
                stepEl.className = 'w-6 h-6 md:w-8 md:h-8 rounded-full font-black text-xs md:text-sm flex items-center justify-center bg-gray-200 text-gray-500 border-2 border-white transition-colors';
                stepEl.innerHTML = s;
            }
        });

        document.getElementById('oq-stage-1').classList.toggle('hidden', stage !== 1);
        document.getElementById('oq-stage-2').classList.toggle('hidden', stage !== 2);
        document.getElementById('oq-stage-3').classList.toggle('hidden', stage !== 3);
        
        document.getElementById('btn-oq-start').classList.remove('hidden');
        document.getElementById('btn-oq-start').classList.add('animate-attention');
        document.getElementById('oq-recording-indicator').classList.add('hidden');
        document.getElementById('btn-oq-next').classList.add('hidden');
        
        const statusMsgs = { 1: "Tap START to read", 2: "Tap START to describe", 3: "Tap START to answer" };
        document.getElementById('oq-status-text').textContent = statusMsgs[stage];

        if (stage === 2) {
            if (typeof resetScore === 'function') resetScore();
            document.getElementById('oq-s2-live-score').textContent = "0";
            document.getElementById('oq-s2-pin-container').innerHTML = "";
            if (window.currentTheme && window.currentTheme.imageSrc) {
                document.getElementById('oq-s2-image').src = window.currentTheme.imageSrc;
            }
        }
    },

    handleNextButton: function() {
        if (this.currentStage === 1 && this.subStage === "reading") {
            this.subStage = "qa1";
            this.setupQA1();
        } else if (this.currentStage === 1 && this.subStage === "qa1") {
            this.subStage = "picture";
            this.updateUIForStage(2);
        } else if (this.currentStage === 2) {
            this.subStage = "qa2";
            this.updateUIForStage(3);
            this.setupQA2();
        } else if (this.currentStage === 3) {
            this.showFinalResult();
        }
    },

    setupQA1: function() {
        document.getElementById('oq-reading-result').classList.add('hidden');
        const readingTranscriptBox = document.getElementById('oq-stage1-transcript-box');
        if (readingTranscriptBox) readingTranscriptBox.classList.add('hidden');
        
        document.getElementById('oq-stage1-qa').classList.remove('hidden');
        document.getElementById('btn-oq-next').classList.add('hidden');
        document.getElementById('btn-oq-start').classList.remove('hidden');
        document.getElementById('btn-oq-start').classList.add('animate-attention');
        document.getElementById('oq-status-text').textContent = "Tap START to answer Q1";

        this.replayQ1Audio();
    },

    replayQ1Audio: function() {
        let q1Text = document.getElementById('oq-q1-text').textContent || "Please answer the question.";
        if (typeof window.playResultTTS === 'function') {
            window.playResultTTS("Please look at the passage. " + q1Text);
        }
    },

    setupQA2: function() {
        const randomImgNum = Math.floor(Math.random() * 10) + 1;
        const imgEl = document.getElementById('oq-interviewer-img');
        if (imgEl) imgEl.src = `assets/images/oralquest/interviewer_${randomImgNum}.webp`;

        if (window.currentTheme && window.currentTheme.stage3 && window.currentTheme.stage3.questions) {
            const qPool = window.currentTheme.stage3.questions;
            const randomQIndex = Math.floor(Math.random() * qPool.length);
            this.currentQ2 = qPool[randomQIndex];
        } else {
            this.currentQ2 = { text: "No question data found.", keywords: [], modelAnswers: [] };
        }
        
        document.getElementById('oq-q2-text').textContent = this.currentQ2.text;

        document.getElementById('btn-oq-next').classList.add('hidden');
        document.getElementById('btn-oq-start').classList.remove('hidden');
        document.getElementById('btn-oq-start').classList.add('animate-attention');
        document.getElementById('oq-status-text').textContent = "Tap START to answer Q2";

        this.replayQ2Audio();
    },

    replayQ2Audio: function() {
        if (typeof window.playResultTTS === 'function' && this.currentQ2) {
            window.playResultTTS("Please look at the camera. " + this.currentQ2.text);
        }
    },

    dropOqPin: function(wordText, theme) {
        const container = document.getElementById('oq-s2-pin-container');
        if (!container || !theme.pins) return;

        let pinData = null;
        for (const [key, coords] of Object.entries(theme.pins)) {
            if (wordText.toLowerCase().includes(key.toLowerCase())) {
                pinData = coords;
                break;
            }
        }
        if (!pinData) return;

        const pin = document.createElement('div');
        pin.className = 'absolute w-6 h-6 md:w-8 md:h-8 bg-pink-500 rounded-full border-2 border-white shadow-lg animate-pop flex items-center justify-center text-white font-bold text-xs md:text-sm z-50 transform -translate-x-1/2 -translate-y-1/2';
        pin.innerHTML = '📍';
        pin.style.left = `${pinData.x}%`;
        pin.style.top = `${pinData.y}%`;
        container.appendChild(pin);
    },

    startRecording: function() {
        this.transcript = "";
        this.interimTranscript = "";
        this.timeElapsed = 0;
        
        document.getElementById('btn-oq-start').classList.add('hidden');
        document.getElementById('oq-recording-indicator').classList.remove('hidden');
        document.getElementById('oq-status-text').textContent = "Listening... Tap to Stop";
        
        if (this.currentStage === 1 && this.subStage === "reading") {
            document.getElementById('oq-reading-result').classList.add('hidden');
            const readingTranscriptBox = document.getElementById('oq-stage1-transcript-box');
            if (readingTranscriptBox) readingTranscriptBox.classList.remove('hidden');
            document.getElementById('oq-accuracy-arc').style.transform = `rotate(-225deg)`;
            document.getElementById('oq-accuracy-text').textContent = "0";
            document.getElementById('oq-wpm-text').textContent = "0";
            const transcriptEl = document.getElementById('oq-transcript-display');
            if (transcriptEl) transcriptEl.textContent = "(Listening...)";
        } else if (this.currentStage === 1 && this.subStage === "qa1") {
            document.getElementById('oq-q1-result').classList.add('hidden');
            const q1TranscriptEl = document.getElementById('oq-q1-transcript');
            if (q1TranscriptEl) q1TranscriptEl.textContent = "(Listening...)";
        } else if (this.currentStage === 2) {
            document.getElementById('oq-s2-result').classList.add('hidden');
            document.getElementById('oq-s2-transcript').textContent = "(Listening...)";
            document.getElementById('oq-s2-timer-container').classList.remove('hidden');
            document.getElementById('oq-s2-timer-bar').style.width = "100%";
        } else if (this.currentStage === 3) {
            document.getElementById('oq-s3-result').classList.add('hidden');
            const q2TranscriptEl = document.getElementById('oq-s3-transcript');
            if (q2TranscriptEl) q2TranscriptEl.textContent = "(Listening...)";
        }

        if (typeof window.startSpeech === 'function') window.startSpeech();
        
        this.timerInterval = setInterval(() => { 
            this.timeElapsed++; 
            if (this.currentStage === 2) {
                let tLimit = (window.currentTheme && window.currentTheme.timeLimit) ? window.currentTheme.timeLimit : 30;
                let timeLeft = tLimit - this.timeElapsed;
                let percent = (timeLeft / tLimit) * 100;
                
                if (percent < 0) percent = 0;
                document.getElementById('oq-s2-timer-bar').style.width = `${percent}%`;
                
                if (timeLeft <= 10) {
                    document.getElementById('oq-s2-timer-bar').classList.replace('bg-pink-400', 'bg-red-500');
                } else {
                    document.getElementById('oq-s2-timer-bar').classList.replace('bg-red-500', 'bg-pink-400');
                }
                if (timeLeft <= 0) this.stopRecording();
            }
        }, 1000);
    },

    stopRecording: function() {
        clearInterval(this.timerInterval);
        if (typeof window.stopSpeech === 'function') window.stopSpeech();
        window.isRecording = false;

        document.getElementById('oq-recording-indicator').classList.add('hidden');
        document.getElementById('oq-status-text').textContent = "Finished!";
        
        const nextBtn = document.getElementById('btn-oq-next');
        nextBtn.classList.remove('hidden');

        if (this.currentStage === 1 && this.subStage === "reading") {
            this.calculateReadingResult();
        } else if (this.currentStage === 1 && this.subStage === "qa1") {
            this.calculateQ1Result();
        } else if (this.currentStage === 2) {
            this.calculatePictureResult();
        } else if (this.currentStage === 3) {
            nextBtn.innerHTML = 'FINISH TEST <span class="text-2xl">🏁</span>';
            nextBtn.classList.replace('bg-gray-800', 'bg-pink-600');
            this.calculateQ2Result();
        }
    },

    handleSpeech: function(finalText, interimText) {
        if (finalText.trim().length > 0) {
            this.transcript += finalText + " ";
        }
        this.interimTranscript = interimText;

        const fullText = (this.transcript + " " + this.interimTranscript).trim();
        const displayWord = interimText.trim() || finalText.trim();
        
        if (displayWord) {
            const words = displayWord.split(' ');
            const lastWords = words.slice(-4).join(' ');
            document.getElementById('oq-status-text').textContent = `🗣️ "... ${lastWords}"`;
        }

        if (this.currentStage === 1 && this.subStage === "reading") {
            const displayEl = document.getElementById('oq-transcript-display');
            if (displayEl) displayEl.textContent = fullText || "(Listening...)";
        } else if (this.currentStage === 1 && this.subStage === "qa1") {
            const q1DisplayEl = document.getElementById('oq-q1-transcript');
            if (q1DisplayEl) q1DisplayEl.textContent = fullText || "(Listening...)";
        } else if (this.currentStage === 2) {
            const s2DisplayEl = document.getElementById('oq-s2-transcript');
            if (s2DisplayEl) s2DisplayEl.textContent = fullText || "(Listening...)";

            if (window.currentTheme && typeof calculateScore === 'function') {
                const result = calculateScore(fullText, window.currentTheme, window.appState.selectedLevel || 'elementary');
                if (result && result.addedPoints > 0) {
                    document.getElementById('oq-s2-live-score').textContent = result.score;
                    if (result.newWords) result.newWords.forEach(w => this.dropOqPin(w, window.currentTheme));
                    if (typeof playSound === 'function') {
                        if (result.isPerfect) playSound('perfect');
                        else if (parseFloat(result.multiplier) > 1.0) playSound('combo');
                        else playSound('match');
                    }
                }
            }
        } else if (this.currentStage === 3) {
            const q2DisplayEl = document.getElementById('oq-s3-transcript');
            if (q2DisplayEl) q2DisplayEl.textContent = fullText || "(Listening...)";
        }
    },

    calculateReadingResult: function() {
        const fullText = (this.transcript + " " + this.interimTranscript).trim();
        const spokenWords = fullText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
        
        // ★ 修正：画面に表示されている英文を直接取得して採点基準にする（読み込みズレ防止）
        const passageText = document.getElementById('oq-passage-text').textContent || "";
        const targetWords = passageText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
        
        let matchCount = 0;
        targetWords.forEach(targetWord => {
            if (spokenWords.some(spoken => 
                spoken === targetWord || spoken === targetWord + 's' || spoken === targetWord + 'es' || spoken === targetWord + 'ed' || spoken === targetWord + 'ing'
            )) {
                matchCount++;
            }
        });

        let accuracy = targetWords.length > 0 ? Math.floor((matchCount / targetWords.length) * 100) : 0;
        if (accuracy > 100) accuracy = 100;

        let wpm = 0;
        if (this.timeElapsed > 0) wpm = Math.round(spokenWords.length / (this.timeElapsed / 60));

        document.getElementById('oq-accuracy-text').textContent = accuracy;
        document.getElementById('oq-wpm-text').textContent = wpm;
        
        const degree = -225 + (accuracy / 100) * 180;
        const arc = document.getElementById('oq-accuracy-arc');
        
        arc.className = 'absolute top-0 left-0 w-24 h-24 md:w-32 md:h-32 rounded-full border-[12px] border-b-transparent border-l-transparent transition-transform duration-1000 ease-out';
        if (accuracy >= 80) arc.classList.add('border-green-400');
        else if (accuracy >= 50) arc.classList.add('border-orange-400');
        else arc.classList.add('border-red-400');

        document.getElementById('oq-reading-result').classList.remove('hidden');
        setTimeout(() => { arc.style.transform = `rotate(${degree}deg)`; }, 100);

        if (typeof window.playSuccessChime === 'function') window.playSuccessChime();
    },

    calculateQ1Result: function() {
        const fullText = (this.transcript + " " + this.interimTranscript).trim();
        const spokenWords = fullText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
        
        // JSONデータから直接キーワードを取得
        let q1Keywords = [];
        let q1ModelAnswers = [];
        if (window.currentTheme && window.currentTheme.stage1 && window.currentTheme.stage1.q1) {
            q1Keywords = window.currentTheme.stage1.q1.keywords || [];
            q1ModelAnswers = window.currentTheme.stage1.q1.modelAnswers || [];
        }
        
        let matchCount = 0;
        q1Keywords.forEach(kw => {
            if (spokenWords.some(spoken => 
                spoken === kw || spoken === kw + 's' || spoken === kw + 'es' || spoken === kw + 'd' || spoken === kw + 'ed' || spoken === kw + 'ing'
            )) {
                matchCount++;
            }
        });

        let starsHtml = "";
        let feedbackText = "";
        if (matchCount >= 3) {
            starsHtml = "⭐⭐⭐"; feedbackText = "Excellent! 完璧に理由を答えられました！";
        } else if (matchCount >= 1) {
            starsHtml = "⭐⭐☆"; feedbackText = "Good! キーワードが含まれています。";
        } else {
            starsHtml = "⭐☆☆"; feedbackText = "もう少し！模範解答を確認しよう。";
        }

        const modelsHtml = q1ModelAnswers.map(ans => `<div class="mb-1 pl-2 border-l-2 border-indigo-300">${ans}</div>`).join('');

        const resEl = document.getElementById('oq-q1-result');
        resEl.innerHTML = `
            <div class="mt-4 p-4 bg-white rounded-xl border border-indigo-200 text-center shadow-sm">
                <div class="text-3xl md:text-4xl mb-2">${starsHtml}</div>
                <div class="font-black text-indigo-700 text-sm md:text-base">${feedbackText}</div>
                <div class="mt-4 text-xs md:text-sm text-gray-500 font-bold bg-indigo-50 p-3 rounded-lg text-left">
                    <span class="text-indigo-400 uppercase tracking-widest text-[10px] mb-2 block">Model Answers (解答例)</span>
                    <div class="text-indigo-800 font-medium">${modelsHtml}</div>
                </div>
            </div>
        `;
        resEl.classList.remove('hidden');

        if (matchCount >= 3 && typeof window.playSuccessChime === 'function') window.playSuccessChime();
        else if (matchCount >= 1 && typeof window.playTapSound === 'function') window.playTapSound();
    },

    calculatePictureResult: function() {
        document.getElementById('oq-s2-timer-container').classList.add('hidden');
        
        let stats = null;
        if (typeof getCompletionStats === 'function' && window.currentTheme) {
            stats = getCompletionStats(window.currentTheme, window.appState.selectedLevel || 'elementary');
        }
        
        let completionRate = stats ? stats.completionRate : 0;
        let score = document.getElementById('oq-s2-live-score').textContent;
        
        let feedbackText = completionRate >= 80 ? "Excellent! 素晴らしい描写力です！" : 
                           completionRate >= 50 ? "Good! 主要なポイントを押さえられています。" : 
                           "Keep Trying! さらに細かく描写してみよう。";

        const resEl = document.getElementById('oq-s2-result');
        resEl.innerHTML = `
            <div class="p-6 bg-white rounded-2xl border border-pink-200 text-center shadow-sm mt-2">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-pink-50 rounded-xl p-3 border border-pink-100">
                        <div class="text-xs font-black text-pink-400 uppercase mb-1">Score</div>
                        <div class="text-3xl font-black text-pink-600">${score}</div>
                    </div>
                    <div class="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                        <div class="text-xs font-black text-indigo-400 uppercase mb-1">Completion</div>
                        <div class="text-3xl font-black text-indigo-600">${completionRate}%</div>
                    </div>
                </div>
                <div class="text-sm md:text-base font-bold text-gray-700 mb-3">${feedbackText}</div>
                <div class="text-xs text-gray-500 font-medium bg-gray-50 p-3 rounded-lg border border-gray-200">
                    PicSpeakの判定エンジンにより、ターゲット表現の <span class="font-black text-pink-600">${completionRate}%</span> を描写できました。
                </div>
            </div>
        `;
        resEl.classList.remove('hidden');

        if (completionRate >= 50 && typeof window.playSuccessChime === 'function') window.playSuccessChime();
        else if (completionRate > 0 && typeof window.playTapSound === 'function') window.playTapSound();
    },

    calculateQ2Result: function() {
        const fullText = (this.transcript + " " + this.interimTranscript).trim();
        const spokenWords = fullText.toLowerCase().replace(/[.,!?'"-]/g, '').split(/\s+/).filter(w => w);
        
        let matchCount = 0;
        if (this.currentQ2 && this.currentQ2.keywords) {
            this.currentQ2.keywords.forEach(kw => {
                if (spokenWords.some(spoken => spoken.includes(kw))) matchCount++;
            });
        }

        let starsHtml = "";
        let feedbackText = "";
        if (spokenWords.length >= 5 && matchCount >= 1) {
            starsHtml = "⭐⭐⭐"; feedbackText = "Excellent! 自分の言葉でしっかり答えられました！";
        } else if (spokenWords.length >= 3) {
            starsHtml = "⭐⭐☆"; feedbackText = "Good! さらに具体的に（becauseなどで）理由を付け足してみよう。";
        } else {
            starsHtml = "⭐☆☆"; feedbackText = "もう少し！主語と動詞を使って、フルセンテンスで答えよう。";
        }

        const modelsHtml = (this.currentQ2 && this.currentQ2.modelAnswers) 
            ? this.currentQ2.modelAnswers.map(ans => `<div class="mb-1 pl-2 border-l-2 border-purple-300">${ans}</div>`).join('')
            : "";

        const resEl = document.getElementById('oq-s3-result');
        resEl.innerHTML = `
            <div class="mt-4 p-4 bg-white rounded-xl border border-purple-200 text-center shadow-sm">
                <div class="text-3xl md:text-4xl mb-2">${starsHtml}</div>
                <div class="font-black text-purple-700 text-sm md:text-base">${feedbackText}</div>
                <div class="mt-4 text-xs md:text-sm text-gray-500 font-bold bg-purple-50 p-3 rounded-lg text-left">
                    <span class="text-purple-400 uppercase tracking-widest text-[10px] mb-2 block">Model Answers (解答例)</span>
                    <div class="text-purple-800 font-medium">${modelsHtml}</div>
                </div>
            </div>
        `;
        resEl.classList.remove('hidden');

        if (spokenWords.length >= 5 && typeof window.playSuccessChime === 'function') window.playSuccessChime();
        else if (spokenWords.length >= 3 && typeof window.playTapSound === 'function') window.playTapSound();
    },

    showFinalResult: function() {
        const accuracy = parseInt(document.getElementById('oq-accuracy-text')?.textContent || "0");
        const wpm = parseInt(document.getElementById('oq-wpm-text')?.textContent || "0");
        const s2Score = parseInt(document.getElementById('oq-s2-live-score')?.textContent || "0");
        
        const totalScore = accuracy + s2Score;
        let rank = "C";
        let rankColor = "text-gray-500";
        let message = "Keep trying! 音読と描写の基礎を練習しよう。";

        if (totalScore >= 180) {
            rank = "S"; rankColor = "text-yellow-400"; message = "Outstanding! 完璧なスピーキング力です！";
        } else if (totalScore >= 140) {
            rank = "A"; rankColor = "text-pink-500"; message = "Excellent! 非常に高い英語力を持っています。";
        } else if (totalScore >= 100) {
            rank = "B"; rankColor = "text-blue-500"; message = "Good! さらに語彙を増やして表現力を高めよう。";
        }

        // ★修正：FINISHボタンを押すと画像選択画面（view-select）に直接戻るように設定
        document.getElementById('oq-stage-3').innerHTML = `
            <div class="bg-white w-full rounded-3xl shadow-lg border border-gray-200 p-6 md:p-10 text-center fade-in">
                <h2 class="text-2xl md:text-3xl font-black text-gray-800 mb-6 tracking-widest uppercase border-b-2 border-gray-100 pb-4">
                    Report Card
                </h2>
                
                <div class="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
                    <div class="flex flex-col items-center justify-center">
                        <span class="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Total Rank</span>
                        <div class="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-gray-50 shadow-inner flex items-center justify-center bg-white">
                            <span class="text-6xl md:text-7xl font-black ${rankColor} drop-shadow-md">${rank}</span>
                        </div>
                    </div>
                    <div class="text-left max-w-xs">
                        <p class="text-sm md:text-base font-bold text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-200">
                            ${message}
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div class="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Stage 1: Reading</div>
                        <div class="text-3xl font-black text-blue-600">${accuracy}<span class="text-sm">%</span></div>
                        <div class="text-xs font-bold text-blue-500 mt-1">WPM: ${wpm}</div>
                    </div>
                    <div class="bg-pink-50 rounded-2xl p-4 border border-pink-100">
                        <div class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Stage 2: Picture</div>
                        <div class="text-3xl font-black text-pink-600">${s2Score}<span class="text-sm">pt</span></div>
                    </div>
                    <div class="bg-purple-50 rounded-2xl p-4 border border-purple-100 flex flex-col justify-center">
                        <div class="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Stage 3: Q&A</div>
                        <div class="text-sm font-bold text-purple-600">Complete!</div>
                    </div>
                </div>

                <button onclick="document.getElementById('view-oralquest').classList.add('hidden'); document.getElementById('view-select').classList.remove('hidden'); window.scrollTo(0,0);" class="sns-btn bg-gray-900 text-white font-black px-10 py-4 md:py-5 rounded-full shadow-xl hover:scale-105 transition-transform text-lg md:text-xl w-full max-w-sm mx-auto tracking-widest">
                    FINISH
                </button>
            </div>
        `;
        
        document.querySelector('#view-oralquest .p-4.bg-white.border-t').classList.add('hidden');
        if (typeof window.createConfetti === 'function') window.createConfetti();
        if (typeof window.playSuccessChime === 'function') window.playSuccessChime();
    }
};