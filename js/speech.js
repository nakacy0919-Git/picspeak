// js/speech.js

// ブラウザごとの差異を吸収
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

// ★プログラムから意図的に止めたかどうかを判定する「証拠」フラグ
let isForceStopped = false;

// 音声認識の初期設定
function initSpeechRecognition(onResultCallback, onEndCallback) {
    if (!SpeechRecognition) {
        alert("お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。");
        return null;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // 英語に設定
    recognition.interimResults = true; // 話している途中の結果も取得する
    recognition.continuous = true; // 認識を継続する

    // 音声が認識された時の処理
    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        // メイン処理にテキストを渡す
        onResultCallback(finalTranscript, interimTranscript);
    };

    // 音声認識が終了（停止）した時の処理
    recognition.onend = () => {
        // ★無音で勝手に切れた場合（意図的に止めておらず、かつ録音モード中なら）自動で再起動する！
        if (!isForceStopped && window.isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.error("音声認識の自動再起動に失敗しました:", e);
            }
        } else {
            // 本当に終了させたい時（FINISHを押した等）だけ、終了処理を呼ぶ
            if (onEndCallback) onEndCallback();
        }
    };

    return recognition;
}

function startSpeech() {
    isForceStopped = false; // スタート時はフラグをリセット
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.error("音声認識の開始に失敗しました:", e);
        }
    }
}

function stopSpeech() {
    isForceStopped = true; // プログラムが「意図的に止めた」という証拠を残す
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error("音声認識の停止に失敗しました:", e);
        }
    }
}