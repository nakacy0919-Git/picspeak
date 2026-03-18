// js/story_audio.js
// ==========================================
// PSS専用 音声合成(TTS)・効果音生成(Web Audio API)
// ==========================================

window.bestEnglishVoice = null;

function loadBestVoice() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;
    window.bestEnglishVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')))
                           || voices.find(v => v.lang === 'en-US' && v.name.includes('Siri'))
                           || voices.find(v => v.lang.startsWith('en'));
}
speechSynthesis.onvoiceschanged = loadBestVoice;

function playSyntheticSound(type) {
    if (!window.pssSettings || !window.pssSettings.effectsOn) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'perfect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'match') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'transition') {
            // ★追加: シーン切り替え時の「シュッ」というスワイプ音
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        }
    } catch(e) { console.warn("Sound play failed", e); }
}

window.updateTTSButtonUI = function() {
    const icon = document.getElementById('tts-icon');
    const text = document.getElementById('tts-text');
    const btn = document.getElementById('btn-read-aloud');
    
    if (icon && btn && text) {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            icon.textContent = '⏸'; 
            text.textContent = '一時停止';
            btn.classList.add('bg-indigo-200');
            btn.classList.remove('bg-indigo-50');
        } else {
            icon.textContent = '▶'; 
            text.textContent = '本文を読み上げる';
            btn.classList.remove('bg-indigo-200');
            btn.classList.add('bg-indigo-50');
        }
    }
};

window.playCurrentTTS = function() {
    if (!window.storyState || !window.storyState.currentStory) return;
    const idx = window.storyState.currentSceneIndex;
    const levelData = window.storyState.currentStory.scenes[idx].levels[window.storyState.selectedLevel];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = levelData.readingText;
    const cleanText = tempDiv.textContent || tempDiv.innerText || "";

    window.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    window.currentUtterance.lang = 'en-US';
    window.currentUtterance.rate = 0.75;
    
    if (!window.bestEnglishVoice) loadBestVoice();
    if (window.bestEnglishVoice) {
        window.currentUtterance.voice = window.bestEnglishVoice;
    }

    window.currentUtterance.onend = window.updateTTSButtonUI;
    speechSynthesis.speak(window.currentUtterance);
    window.updateTTSButtonUI();
};

document.addEventListener('DOMContentLoaded', () => {
    loadBestVoice();
    document.getElementById('btn-read-aloud')?.addEventListener('click', () => {
        if (speechSynthesis.speaking) {
            speechSynthesis.paused ? speechSynthesis.resume() : speechSynthesis.pause();
        } else {
            window.playCurrentTTS();
        }
        setTimeout(window.updateTTSButtonUI, 50);
    });
});