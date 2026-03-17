// js/story_ui.js
// ==========================================
// Story Mode 専用の UI制御モジュール
// ==========================================

window.showStoryView = function(viewElement) {
    const views = [
        document.getElementById('view-select'),
        document.getElementById('view-reading'),
        document.getElementById('view-retelling'),
        document.getElementById('view-result-story')
    ];
    views.forEach(v => { if(v) v.classList.add('hidden'); });
    if(viewElement) {
        viewElement.classList.remove('hidden');
        viewElement.classList.add('fade-in');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 練習モーダルの閉じるボタン
    const btnClosePractice = document.getElementById('btn-close-practice');
    const practiceModal = document.getElementById('practice-modal');
    if(btnClosePractice) {
        btnClosePractice.addEventListener('click', () => {
            window.storyState.isPracticeMode = false;
            if(window.isRecording) stopSpeech();
            window.isRecording = false;
            if(practiceModal) practiceModal.classList.add('hidden');
        });
    }

    // トランスクリプト（全文表示）モーダルの閉じる処理
    const btnCloseTranscript = document.getElementById('btn-close-transcript');
    const transcriptModal = document.getElementById('transcript-modal');
    if(btnCloseTranscript) {
        btnCloseTranscript.addEventListener('click', () => {
            if(transcriptModal) transcriptModal.classList.add('hidden');
        });
    }

    // ★NEW: 青文字（ストーリー内の重要語句）をタップした時の処理
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.story-clickable');
        if (target) {
            const word = target.getAttribute('data-word');
            const ja = target.getAttribute('data-ja');
            const synonyms = target.getAttribute('data-synonyms');
            window.openStoryPractice(word, ja, synonyms);
        }
    });
});

// ポップアップを開く関数
window.openStoryPractice = function(text, ja, synonyms) {
    window.storyState.isPracticeMode = true;
    window.storyState.practiceTargetText = text;
    window.storyState.practiceRawTranscript = "";
    
    const practiceTarget = document.getElementById('practice-target');
    const practiceJa = document.getElementById('practice-ja');
    const synonymsBox = document.getElementById('practice-synonyms');
    const synonymsContent = document.getElementById('synonyms-content');
    const practiceTranscriptBox = document.getElementById('practice-transcript');
    const practiceFeedbackBox = document.getElementById('practice-feedback');
    const btnStartPractice = document.getElementById('btn-start-practice');
    const practiceModal = document.getElementById('practice-modal');
    
    if(practiceTarget) practiceTarget.textContent = text;
    if(practiceJa) practiceJa.textContent = ja;
    
    // 類義語があれば表示、なければ非表示
    if (synonyms && synonyms.trim() !== "") {
        synonymsContent.textContent = synonyms;
        synonymsBox.classList.remove('hidden');
    } else {
        synonymsBox.classList.add('hidden');
    }
    
    if(practiceTranscriptBox) {
        practiceTranscriptBox.innerHTML = "Tap START and practice...";
        practiceTranscriptBox.className = "text-2xl md:text-4xl font-medium text-gray-400 italic text-center leading-relaxed";
    }
    if(practiceFeedbackBox) practiceFeedbackBox.classList.add('hidden');
    if(btnStartPractice) {
        btnStartPractice.innerHTML = '<span class="text-4xl md:text-5xl">🎙️</span> START';
        btnStartPractice.classList.replace('bg-gray-800', 'bg-sns-gradient');
    }
    if(practiceModal) practiceModal.classList.remove('hidden');
};