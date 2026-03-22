// js/speech.js

// ブラウザの再読み込み時などに起こる「再宣言エラー」を完全に防ぐため、
// 変数や関数をすべて window オブジェクトに明示的に紐付けてグローバル化します。

window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// 以前の let 等がエラーの原因になるため window.myRecognition を使用
window.myRecognition = null;
window.isForceStopped = false;
window.onResultGlobal = null;
window.onEndGlobal = null;

// ユーザーエージェントからiOS（iPad/iPhone）かどうかを判定する
window.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// iPadのChrome「だけ」をピンポイントで検知！
window.isIPadChrome = navigator.userAgent.indexOf('CriOS') !== -1 && 
                      (navigator.userAgent.indexOf('iPad') !== -1 || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// 音声認識の初期設定
window.initSpeechRecognition = function(onResultCallback, onEndCallback) {
    if (!window.SpeechRecognition) {
        alert("お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。");
        return null;
    }
    window.onResultGlobal = onResultCallback;
    window.onEndGlobal = onEndCallback;
};

// 毎回STARTを押した瞬間に「新品のマイク」を用意する専用関数
window.createNewRecognition = function() {
    if (window.myRecognition) {
        try { window.myRecognition.abort(); } catch(e){}
    }
    
    window.myRecognition = new window.SpeechRecognition();
    window.myRecognition.lang = 'en-US'; 
    window.myRecognition.interimResults = true; 
    window.myRecognition.continuous = !window.isIOS; // iOSは連続認識をオフにする

    // マイクが【実際にオンになった瞬間】に呼ばれるイベント（タイマーとぼかし解除用）
    window.myRecognition.onstart = function() {
        if (typeof window.handleSpeechStart === 'function') {
            window.handleSpeechStart();
        }
    };

    window.myRecognition.onresult = function(event) {
        var finalTranscript = '';
        var interimTranscript = '';
        for (var i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        if (typeof window.onResultGlobal === 'function') {
            window.onResultGlobal(finalTranscript, interimTranscript);
        }
    };

    window.myRecognition.onend = function() {
        // 無音で勝手に切れた場合、自動で再起動する（iOS対策）
        if (!window.isForceStopped && window.isRecording) {
            setTimeout(function() {
                if (!window.isForceStopped && window.isRecording) {
                    try {
                        if (window.isIOS) {
                            window.createNewRecognition();
                        }
                        window.myRecognition.start();
                    } catch (e) {
                        console.error("音声認識の自動再起動に失敗しました:", e);
                    }
                }
            }, 200);
        } else {
            // 本当に終了させたい時だけ終了処理を呼ぶ
            if (typeof window.onEndGlobal === 'function') {
                window.onEndGlobal();
            }
        }
    };
};

window.startSpeech = function() {
    // iPadのChromeの時だけ、ホーム画面追加（またはSafari）を案内する
    if (window.isIPadChrome) {
        alert('【💡 アプリ化のおすすめ】\niPadのChromeではマイク起動時にエラーが発生する場合があります。右上のメニュー（共有アイコン等）から「ホーム画面に追加」をして、ホーム画面のアイコンから起動してください！（またはSafariをご利用ください）');
        return false; // 起動失敗を通知して中断
    }

    window.isForceStopped = false; 
    window.createNewRecognition();
    
    try {
        window.myRecognition.start();
        return true; // 起動成功
    } catch (e) {
        console.error("音声認識の開始に失敗しました:", e);
        return false;
    }
};

window.stopSpeech = function() {
    window.isForceStopped = true; 
    if (window.myRecognition) {
        try {
            window.myRecognition.stop();
        } catch (e) {
            console.error("音声認識の停止に失敗しました:", e);
        }
    }
};