// js/speech.js

window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

window.myRecognition = null;
window.isForceStopped = false;
window.onResultGlobal = null;
window.onEndGlobal = null;

window.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

window.isIPadChrome = navigator.userAgent.indexOf('CriOS') !== -1 && 
                      (navigator.userAgent.indexOf('iPad') !== -1 || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

window.initSpeechRecognition = function(onResultCallback, onEndCallback) {
    if (!window.SpeechRecognition) {
        alert("お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。");
        return null;
    }
    window.onResultGlobal = onResultCallback;
    window.onEndGlobal = onEndCallback;
};

window.createNewRecognition = function() {
    if (window.myRecognition) {
        try { window.myRecognition.abort(); } catch(e){}
    }
    
    window.myRecognition = new window.SpeechRecognition();
    window.myRecognition.lang = 'en-US'; 
    window.myRecognition.interimResults = true; 
    window.myRecognition.continuous = !window.isIOS; 

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
            if (typeof window.onEndGlobal === 'function') {
                window.onEndGlobal();
            }
        }
    };
};

window.startSpeech = function() {
    if (window.isIPadChrome) {
        alert('【💡 アプリ化のおすすめ】\niPadのChromeではマイク起動時にエラーが発生する場合があります。右上のメニュー（共有アイコン等）から「ホーム画面に追加」をして、ホーム画面のアイコンから起動してください！（またはSafariをご利用ください）');
        return false; 
    }

    window.isForceStopped = false; 
    // ★ 修正箇所：マイク開始時に録音中フラグを確実にONにする（これで自動再起動が正しく動きます）
    window.isRecording = true; 

    window.createNewRecognition();
    
    try {
        window.myRecognition.start();
        return true; 
    } catch (e) {
        console.error("音声認識の開始に失敗しました:", e);
        window.isRecording = false; // 失敗時はOFFに戻す
        return false;
    }
};

window.stopSpeech = function() {
    window.isForceStopped = true; 
    window.isRecording = false; // ★ 修正箇所：停止時に確実にOFFにする
    if (window.myRecognition) {
        try {
            window.myRecognition.stop();
        } catch (e) {
            console.error("音声認識の停止に失敗しました:", e);
        }
    }
};