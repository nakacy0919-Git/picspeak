// js/speech.js

// ブラウザごとの差異を吸収
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

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
        if (onEndCallback) onEndCallback();
    };

    return recognition;
}

function startSpeech() {
    if (recognition) recognition.start();
}

function stopSpeech() {
    if (recognition) recognition.stop();
}