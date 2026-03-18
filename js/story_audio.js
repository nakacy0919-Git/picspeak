// js/story_audio.js
// ==========================================
// PSS専用 音声合成(TTS)・効果音生成(Web Audio API)
// ==========================================

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
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'match') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch(e) { console.warn("Sound play failed", e); }
}

function updateTTSButtonUI() {
    const icon = document.getElementById('tts-icon');
    const btn = document.getElementById('btn-read-aloud');
    if (icon && btn) {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            icon.textContent = '⏸'; btn.classList.add('bg-indigo-100');
        } else {
            icon.textContent = '▶'; btn.classList.remove('bg-indigo-100');
        }
    }
}

function playCurrentTTS() {
    if (!window.storyState || !window.storyState.currentStory) return;
    const idx = window.storyState.currentSceneIndex;
    const levelData = window.storyState.currentStory.scenes[idx].levels[window.storyState.selectedLevel];
    window.currentUtterance = new SpeechSynthesisUtterance(levelData.readingText.replace(/<[^>]*>?/gm, ''));
    window.currentUtterance.lang = 'en-US';
    window.currentUtterance.onend = updateTTSButtonUI;
    speechSynthesis.speak(window.currentUtterance);
    updateTTSButtonUI();
}