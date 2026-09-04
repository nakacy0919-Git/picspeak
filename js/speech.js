// js/speech.js
// ==========================================
// Speech Recognition
// PC / iPad / iPhone 対応改善版
// ==========================================

window.SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

window.myRecognition = null;

window.isForceStopped = false;
window.onResultGlobal = null;
window.onEndGlobal = null;

window.isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (
        navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints > 1
    );

window.isSpeechStarting = false;
window.lastSpeechError = null;


// ==========================================
// 初期化
// ==========================================

window.initSpeechRecognition = function(
    onResultCallback,
    onEndCallback
) {
    window.onResultGlobal = onResultCallback;
    window.onEndGlobal = onEndCallback;

    if (!window.SpeechRecognition) {
        console.warn(
            'SpeechRecognition API is not available.'
        );
        return false;
    }

    return true;
};


// ==========================================
// 認識オブジェクト生成
// ==========================================

window.createNewRecognition = function() {

    // 古いRecognitionを完全に停止
    if (window.myRecognition) {
        try {
            window.myRecognition.onstart = null;
            window.myRecognition.onresult = null;
            window.myRecognition.onerror = null;
            window.myRecognition.onend = null;
            window.myRecognition.abort();
        } catch (e) {}
    }

    const recognition =
        new window.SpeechRecognition();

    recognition.lang = 'en-US';

    // 途中結果を取得
    recognition.interimResults = true;

    // PCではcontinuous
    // iOSではfalseの方が安定しやすい
    recognition.continuous = !window.isIOS;

    // 複数候補は不要
    recognition.maxAlternatives = 1;

    window.myRecognition = recognition;


    // ======================================
    // START
    // ======================================

    recognition.onstart = function() {

        console.log(
            '[SpeechRecognition] started'
        );

        window.isSpeechStarting = false;
        window.lastSpeechError = null;

        if (
            typeof window.handleSpeechStart ===
            'function'
        ) {
            window.handleSpeechStart();
        }
    };


    // ======================================
    // RESULT
    // ======================================

    recognition.onresult = function(event) {

        let finalTranscript = '';
        let interimTranscript = '';

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const result = event.results[i];

            if (result.isFinal) {
                finalTranscript +=
                    result[0].transcript;
            } else {
                interimTranscript +=
                    result[0].transcript;
            }
        }

        console.log(
            '[SpeechRecognition] result',
            {
                finalTranscript,
                interimTranscript
            }
        );

        if (
            typeof window.onResultGlobal ===
            'function'
        ) {
            window.onResultGlobal(
                finalTranscript,
                interimTranscript
            );
        }
    };


    // ======================================
    // ERROR
    // ======================================

    recognition.onerror = function(event) {

        console.error(
            '[SpeechRecognition] error:',
            event.error,
            event.message || ''
        );

        window.lastSpeechError = event.error;
        window.isSpeechStarting = false;

        /*
         * permission系エラーは
         * 自動再起動しない
         */
        if (
            event.error === 'not-allowed' ||
            event.error ===
                'service-not-allowed' ||
            event.error === 'audio-capture'
        ) {

            window.isForceStopped = true;
            window.isRecording = false;

            let message =
                '音声認識を開始できませんでした。';

            if (
                event.error === 'not-allowed' ||
                event.error ===
                    'service-not-allowed'
            ) {

                message =
                    'マイクまたは音声認識の使用が許可されていません。\n\n' +
                    'iPadの場合はSafariでPicSpeakを開き、' +
                    '「設定」→「Safari」またはサイト設定から' +
                    'マイクの許可を確認してください。';

            } else if (
                event.error ===
                'audio-capture'
            ) {

                message =
                    'マイクを使用できません。\n\n' +
                    '他のアプリがマイクを使用していないか確認し、' +
                    'Safariを再起動してください。';
            }

            alert(message);

            if (
                typeof window.handleSpeechFailure ===
                'function'
            ) {
                window.handleSpeechFailure(
                    event.error
                );
            }
        }
    };


    // ======================================
    // END
    // ======================================

    recognition.onend = function() {

        console.log(
            '[SpeechRecognition] ended',
            {
                isRecording:
                    window.isRecording,
                isForceStopped:
                    window.isForceStopped,
                error:
                    window.lastSpeechError
            }
        );

        window.isSpeechStarting = false;

        /*
         * ユーザーがSTOPした場合
         */
        if (
            window.isForceStopped ||
            !window.isRecording
        ) {

            if (
                typeof window.onEndGlobal ===
                'function'
            ) {
                window.onEndGlobal();
            }

            return;
        }


        /*
         * permission系エラー後は
         * 再起動しない
         */
        if (
            window.lastSpeechError ===
                'not-allowed' ||
            window.lastSpeechError ===
                'service-not-allowed' ||
            window.lastSpeechError ===
                'audio-capture'
        ) {
            return;
        }


        /*
         * iOSは1回の認識が短時間で
         * 終了することがあるため再生成
         */
        setTimeout(function() {

            if (
                window.isForceStopped ||
                !window.isRecording
            ) {
                return;
            }

            try {

                window.createNewRecognition();

                window.isSpeechStarting = true;

                window.myRecognition.start();

                console.log(
                    '[SpeechRecognition] restarted'
                );

            } catch (e) {

                window.isSpeechStarting = false;

                console.error(
                    '音声認識の自動再起動に失敗:',
                    e
                );
            }

        }, window.isIOS ? 500 : 200);
    };


    return recognition;
};


// ==========================================
// START
// ==========================================

window.startSpeech = function() {

    if (!window.SpeechRecognition) {

        alert(
            'このブラウザでは音声認識を利用できません。\n\n' +
            'iPadではSafariをお試しください。'
        );

        return false;
    }


    /*
     * 以前の
     *
     * if (window.isIPadChrome) return false;
     *
     * は削除。
     *
     * ブラウザ名だけで拒否せず、
     * APIが存在するなら実際に試す。
     */


    // 二重START防止
    if (window.isSpeechStarting) {
        console.log(
            '[SpeechRecognition] already starting'
        );
        return true;
    }


    window.isForceStopped = false;
    window.lastSpeechError = null;

    /*
     * onendが発生したときに
     * 再起動判断に必要
     */
    window.isRecording = true;

    window.createNewRecognition();

    try {

        window.isSpeechStarting = true;

        window.myRecognition.start();

        console.log(
            '[SpeechRecognition] start requested',
            {
                isIOS:
                    window.isIOS,
                userAgent:
                    navigator.userAgent
            }
        );

        return true;

    } catch (e) {

        console.error(
            '音声認識の開始に失敗しました:',
            e
        );

        window.isSpeechStarting = false;
        window.isRecording = false;

        return false;
    }
};


// ==========================================
// STOP
// ==========================================

window.stopSpeech = function() {

    window.isForceStopped = true;
    window.isRecording = false;
    window.isSpeechStarting = false;

    if (window.myRecognition) {

        try {

            window.myRecognition.stop();

        } catch (e) {

            console.error(
                '音声認識の停止に失敗:',
                e
            );
        }
    }
};