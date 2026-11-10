/* Fit pronunciation practice on one visible iPad screen, regardless of entry point.
   Text-only styling: no changes to speech recognition, scoring, TTS or actions. */
(function () {
  'use strict';
  const originalOpen = window.openPractice;
  if (typeof originalOpen !== 'function') return;
  const modal = document.getElementById('practice-modal');
  if (!modal) return;

  function fitPractice() {
    if (modal.classList.contains('hidden')) return;
    const target = document.getElementById('practice-target');
    const transcript = document.getElementById('practice-transcript');
    if (!target) return;
    // The old full-screen modal uses a tall 70px font and large minimum
    // speech box. Always apply our shared compact layout, including in the
    // pre-practice view where Snapshot's previous compact class was not set.
    modal.classList.add('practice-fit-active');
    if (transcript?.parentElement) {
      transcript.parentElement.classList.add('practice-fit-output');
    }
    const h = Math.max(320, Math.min(
      window.innerHeight || 768, window.visualViewport?.height || window.innerHeight || 768));
    const w = window.innerWidth || 1024;
    const length = (target.textContent || '').trim().length;
    let size = Math.min(39, h * 0.052, w * 0.051);
    if (length > 210) size *= 0.60;
    else if (length > 160) size *= 0.70;
    else if (length > 120) size *= 0.77;
    else if (length > 88) size *= 0.87;
    size = Math.max(18, Math.round(size));
    target.style.setProperty('--practice-target-font', size + 'px');

    // An unusually long answer may wrap into more lines than expected.
    // Reduce typography first; only the text region may scroll as a fallback.
    for (let step = 0; step < 12 && target.scrollHeight > target.clientHeight + 2 && size > 18; step++) {
      size = Math.max(18, size - 2);
      target.style.setProperty('--practice-target-font', size + 'px');
    }
  }

  window.openPractice = function () {
    const result = originalOpen.apply(this, arguments);
    fitPractice();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(fitPractice);
    }
    return result;
  };
  function handleViewportChange() {
    if (modal.classList.contains('hidden')) return;
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(fitPractice);
    } else fitPractice();
  }
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  window.visualViewport?.addEventListener('resize', handleViewportChange);
  if (!modal.classList.contains('hidden')) fitPractice();
})();