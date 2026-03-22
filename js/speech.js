// js/speech.js

// ブラウザごとの差異を吸収
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

// ★プログラムから意図的に止めたかどうかを判定する「証拠」フラグ
let isForceStopped = false;

// ★ユーザーエージェントからiOS（iPad/iPhone）かどうかを判定する
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 音声認識の初期設定
function initSpeechRecognition(onResultCallback, onEndCallback) {
    if (!SpeechRecognition) {
        alert("お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。");
        return null;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // 英語に設定
    recognition.interimResults = true; // 話している途中の結果も取得する
    
    // 👇ここが修正ポイント！iPad/iOSでは必ず false にする！
    recognition.continuous = !isIOS; 

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
        if (typeof onResultCallback === 'function') {
            onResultCallback(finalTranscript, interimTranscript);
        }
    };

    // 音声認識が終了（停止）した時の処理
    recognition.onend = () => {
        // ★無音で勝手に切れた場合（意図的に止めておらず、かつ録音モード中なら）自動で再起動する！
        if (!isForceStopped && window.isRecording) {
            try {
                // 少しだけ時間（50ミリ秒）を空けて再起動することで、ブラウザの負荷（クラッシュ）を防ぐ
                setTimeout(() => {
                    if (!isForceStopped && window.isRecording) {
                        recognition.start();
                    }
                }, 50);
            } catch (e) {
                console.error("音声認識の自動再起動に失敗しました:", e);
            }
        } else {
            // 本当に終了させたい時（FINISHを押した等）だけ、終了処理を呼ぶ
            if (typeof onEndCallback === 'function') {
                onEndCallback();
            }
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
}// js/speech.js

// ブラウザごとの差異を吸収
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isForceStopped = false;

// コールバックを保持しておくための変数
let onResultGlobal = null;
let onEndGlobal = null;

// ユーザーエージェントからiOS（iPad/iPhone）かどうかを判定する
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ★iPadのChrome「だけ」をピンポイントで検知！
// (userAgentに'CriOS'が含まれ、かつiPadまたはデスクトップモードのiPadである場合)
const isIPadChrome = navigator.userAgent.includes('CriOS') && 
                     (navigator.userAgent.includes('iPad') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// 音声認識の初期設定
function initSpeechRecognition(onResultCallback, onEndCallback) {
    if (!SpeechRecognition) {
        alert("お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。");
        return null;
    }
    onResultGlobal = onResultCallback;
    onEndGlobal = onEndCallback;
}

// 毎回STARTを押した瞬間に「新品のマイク」を用意する専用関数
function createNewRecognition() {
    if (recognition) {
        try { recognition.abort(); } catch(e){}
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; 
    recognition.interimResults = true; 
    recognition.continuous = !isIOS; // iOSは連続認識をオフにする

    // マイクが【実際にオンになった瞬間】に呼ばれるイベント（タイマーとぼかし解除用）
    recognition.onstart = () => {
        if (typeof window.handleSpeechStart === 'function') {
            window.handleSpeechStart();
        }
    };

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
        if (typeof onResultGlobal === 'function') {
            onResultGlobal(finalTranscript, interimTranscript);
        }
    };

    recognition.onend = () => {
        // 無音で勝手に切れた場合、自動で再起動する（iOSのcontinuous対策）
        if (!isForceStopped && window.isRecording) {
            setTimeout(() => {
                if (!isForceStopped && window.isRecording) {
                    try {
                        if (isIOS) createNewRecognition();
                        recognition.start();
                    } catch (e) {
                        console.error("音声認識の自動再起動に失敗しました:", e);
                    }
                }
            }, 200);
        } else {
            // 本当に終了させたい時だけ終了処理を呼ぶ
            if (typeof onEndGlobal === 'function') onEndGlobal();
        }
    };
}

function startSpeech() {
    // iPadのChromeの時だけ、ホーム画面追加（またはSafari）を案内する
    if (isIPadChrome) {
        alert('【💡 アプリ化のおすすめ】\niPadのChromeではマイク起動時にエラーが発生する場合があります。右上のメニュー（共有アイコン等）から「ホーム画面に追加」をして、ホーム画面のアイコンから起動してください！（またはSafariをご利用ください）');
        return false; // 起動失敗を通知して中断
    }

    isForceStopped = false; 
    createNewRecognition();
    
    try {
        recognition.start();
        return true; // 起動成功
    } catch (e) {
        console.error("音声認識の開始に失敗しました:", e);
        return false;
    }
}

function stopSpeech() {
    isForceStopped = true; 
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error("音声認識の停止に失敗しました:", e);
        }
    }
}