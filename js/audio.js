// js/audio.js
// ==========================================
// 音声合成 (TTS) と 効果音 (SE) の管理モジュール
// ==========================================

window.speakText = function(text) {
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'en-US';
    speechSynthesis.speak(ut);
};

function playSound(type) {
    // audioCtxはmain.jsで宣言されているものを利用します
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    
    if (type === 'match') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); 
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); 
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } 
    else if (type === 'combo' || type === 'practice_perfect') {
        const freqs = [523.25, 659.25, 783.99, 1046.50]; 
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.value = f;
            const startTime = now + (i * 0.08);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            osc.start(startTime);
            osc.stop(startTime + 0.4);
        });
    }
    else if (type === 'perfect') {
        const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.value = f;
            const startTime = now + (i * 0.05); 
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.5);
            osc.start(startTime);
            osc.stop(startTime + 1.5);
        });
    }
}