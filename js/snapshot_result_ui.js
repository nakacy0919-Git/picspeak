/* PicSpeak Snapshot: review in one iPad screen using current score/recognition data.
 * No rescoring. The learner's practice success is shown separately from the original result. */
(function () {
  'use strict';
  const CATEGORY_INFO = [
    {id:'object',label:'物・人',color:'#10b981',tint:'#ecfdf5'},
    {id:'attribute',label:'様子・色',color:'#f59e0b',tint:'#fffbeb'},
    {id:'detail',label:'位置・背景',color:'#8b5cf6',tint:'#f5f3ff'},
    {id:'gist',label:'動き・要点',color:'#3b82f6',tint:'#eff6ff'},
    {id:'other',label:'その他',color:'#64748b',tint:'#f8fafc'}
  ];
  const originalRender = window.renderSnapshotResult;
  let attempt = null;
  let pendingPractice = null;
  const safe = value => typeof window.picSpeakEscapeHTML === 'function'
    ? window.picSpeakEscapeHTML(String(value == null ? '' : value))
    : String(value == null ? '' : value).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function getPageSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width < 700) return height < 760 ? 1 : 2;
    if (height < 650 && width < 1100) return 2;
    if (width >= 1100 && height >= 780) return 6;
    if (width >= 700 && width <= 900 && height >= 850) return 6;
    return 4;
  }
  function visibleCategories() {
    const cats = attempt?.stats?.categories || {};
    return CATEGORY_INFO.filter(c => c.id !== 'other' ||
      (cats.other && ((cats.other.cleared?.length || 0) + (cats.other.missed?.length || 0) > 0)));
  }
  function getCategory(id) {
    return attempt?.stats?.categories?.[id] || {cleared:[],missed:[],matchRate:0};
  }
  function currentItems() {
    const items = getCategory(attempt.category)[attempt.status] || [];
    return attempt.status === 'missed'
      ? [...items].sort((a,b) => (b.points || 0) - (a.points || 0))
      : items;
  }

  function renderStatusTabs() {
    const host = document.getElementById('snapshot-status-tabs');
    if (!host) return;
    host.innerHTML = [
      {id:'missed',label:'まだ言えなかった',icon:'💡'},
      {id:'cleared',label:'言えた',icon:'✅'}
    ].map(item => {
      const count = new Set(visibleCategories().flatMap(c =>
        (getCategory(c.id)[item.id] || []).map(expression => expression.text))).size;
      return '<button type="button" class="snapshot-status-tab" role="tab" '+
        'aria-selected="'+(item.id === attempt.status)+'" data-status="'+item.id+'">'+
        item.icon+' '+item.label+' <span style="font-size:12px">('+count+')</span></button>';
    }).join('');
  }

  function renderCategoryTabs() {
    const host = document.getElementById('snapshot-category-tabs');
    if (!host) return;
    const cats = visibleCategories();
    host.classList.toggle('with-other',cats.length > 4);
    host.innerHTML = cats.map(c => {
      const stat = getCategory(c.id);
      const count = stat[attempt.status]?.length || 0;
      const rate = Number.isFinite(stat.matchRate) ? stat.matchRate : 0;
      return '<button type="button" class="snapshot-category-tab" role="tab" '+
        'aria-selected="'+(c.id === attempt.category)+'" data-category="'+c.id+'" '+
        'style="--snapshot-accent:'+c.color+';--snapshot-tint:'+c.tint+'">'+
        '<span class="snapshot-category-name">'+safe(c.label)+'</span>'+
        '<span class="snapshot-category-count">'+count+'件 ｜ '+rate+'% 達成</span>'+
        '<span class="snapshot-category-progress" aria-hidden="true"><span style="width:'+
        Math.min(100,Math.max(0,rate))+'%"></span></span></button>';
    }).join('');
  }

  function renderItems() {
    if (!attempt) return;
    const list = currentItems();
    const pageSize = getPageSize();
    const pageCount = Math.max(1,Math.ceil(list.length / pageSize));
    attempt.page = Math.min(Math.max(0,attempt.page),pageCount-1);
    const offset = attempt.page * pageSize;
    const slice = list.slice(offset,offset + pageSize);
    const grid = document.getElementById('snapshot-item-grid');
    const category = visibleCategories().find(c=>c.id === attempt.category);
    const title = document.getElementById('snapshot-list-title');
    const description = document.getElementById('snapshot-list-description');
    if (title) title.textContent = (category?.label || '') + ' ｜ ' +
      (attempt.status === 'missed' ? '次に練習する表現' : '今回言えた表現');
    if (description) description.textContent = list.length + '件';
    const tip = document.getElementById('snapshot-list-tip');
    if (tip) tip.textContent = attempt.status === 'missed'
      ? '音声認識で確認できなかった表現です。お手本を聞いて、練習できます。'
      : '今回の発話から確認できた表現です。';
    if (!grid) return;
    if (!slice.length) {
      grid.innerHTML = '<div class="snapshot-empty">'+
        (attempt.status === 'missed'
          ? 'この要素で言えなかった表現はありません 🎉'
          : 'この要素で言えた表現はありません。')+'</div>';
    } else {
      grid.innerHTML = slice.map((item,index) => {
        const english = String(item.text || '');
        const japanese = String(item.ja || '');
        const practiced = attempt.practiced.has(english);
        const absoluteIndex = offset + index;
        const kind = attempt.kinds?.get(english) || '目標表現';
        const number = String(absoluteIndex + 1).padStart(2,'0');
        return '<article class="snapshot-item-card">'+
          '<div class="snapshot-card-meta"><span class="snapshot-item-kind">'+safe(kind)+
          '</span><span class="snapshot-card-index">'+number+'</span></div>'+
          '<div class="snapshot-item-body">'+
            '<div class="snapshot-item-en" title="'+safe(english)+'">'+safe(english)+
              (attempt.status === 'missed' && practiced
                ? '<span class="snapshot-practiced-tag">✓ 復習で言えた</span>' : '')+
            '</div>'+
            (japanese ? '<div class="snapshot-item-ja" title="'+safe(japanese)+'">'+safe(japanese)+'</div>' : '')+
          '</div>'+
          '<div class="snapshot-item-buttons">'+
            '<button type="button" class="snapshot-item-action sound" data-feedback-action="audio" data-index="'+
              absoluteIndex+'" aria-label="お手本の音声：'+safe(english)+'">🔊 お手本</button>'+
            '<button type="button" class="snapshot-item-action speak" data-feedback-action="practice" data-index="'+
              absoluteIndex+'" aria-label="音読練習：'+safe(english)+'">'+(practiced ? '✅ もう一度' : '🎤 音読練習')+'</button>'+
          '</div></article>';
      }).join('');
    }
    const count = document.getElementById('snapshot-page-count');
    if (count) count.textContent = (attempt.page+1)+' / '+pageCount+' ページ';
    const prev = document.getElementById('snapshot-page-prev');
    const next = document.getElementById('snapshot-page-next');
    if (prev) prev.disabled = attempt.page === 0;
    if (next) next.disabled = attempt.page >= pageCount-1;
  }

  function refresh() {
    if (!attempt) return;
    const workspace = document.querySelector('#view-result.snapshot-result-mode .snapshot-workspace');
    if (workspace) workspace.dataset.status = attempt.status;
    renderStatusTabs();
    renderCategoryTabs();
    renderItems();
  }
  function openTranscript() {
    const overlay = document.getElementById('snapshot-transcript-dialog');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.querySelector('button')?.focus();
    }
  }
  function closeTranscript() {
    document.getElementById('snapshot-transcript-dialog')?.classList.add('hidden');
  }

  function renderNewResult() {
    const stats = typeof window.getCompletionStats === 'function'
      ? window.getCompletionStats(window.currentTheme,window.appState.selectedLevel)
      : null;
    if (!stats?.categories) {
      if (typeof originalRender === 'function') originalRender();
      return;
    }
    // The same final transcript is used for both scoring and feedback.
    // The onscreen speech box may have shown an unconfirmed interim hypothesis.
    const transcript = String(window.snapshotVerifiedTranscript ?? '').trim();
    const words = transcript
      ? transcript.toLowerCase().replace(/[.,!?]/g,'').split(/\s+/).filter(Boolean).length
      : 0;
    const measuredSeconds = Number(window.snapshotVerifiedSeconds) || window.appState.customTimeLimit || 30;
    const wpm = measuredSeconds > 0 ? Math.round(words / (measuredSeconds/60)) : 0;
    const finalScore = Number(document.getElementById('scoreDisplay')?.textContent) || 0;
    const view = document.getElementById('view-result');
    const container = document.getElementById('ranking-container');
    if (!view || !container) return;
    view.classList.add('snapshot-result-mode');
    // Remove styles written by the legacy results renderer in other modes.
    view.style.removeProperty('display');
    view.style.removeProperty('overflow');
    view.style.height='100dvh';
    container.removeAttribute('style');
    container.parentElement?.removeAttribute('style');
    // Tell learners whether each target is a word, phrase, or model sentence.
    // Never alter score or select a different level for the labels.
    const kinds = new Map();
    if (typeof window.getAggregatedData === 'function') {
      const targets = window.getAggregatedData(window.currentTheme,window.appState.selectedLevel);
      for (const [key,label] of [['words','単語'],['chunks','チャンク'],['sentences','基本例文']]) {
        for (const entry of targets[key] || []) kinds.set(String(entry.text || ''),label);
      }
    }
    const levelLabel = ({
      elementary:'小学生',junior_high:'中学生',high_school:'高校生'
    })[window.appState.selectedLevel] || '英語';
    const completion = Math.min(100,Math.max(0,Number(stats.completionRate) || 0));
    attempt = {
      stats,transcript,words,wpm,status:'missed',category:'object',page:0,
      practiced:new Set(),kinds
    };
    const firstUnsaid = visibleCategories().find(c=>getCategory(c.id).missed?.length);
    attempt.category = firstUnsaid?.id || 'object';

    container.innerHTML =
      '<section class="snapshot-feedback" aria-label="Snapshot の学習結果">'+
        '<aside class="snapshot-aside" aria-label="学習結果と表示切り替え">'+
          '<div class="snapshot-side-title"><span class="snapshot-eyebrow">LEARNING REVIEW</span>'+
            '<span class="snapshot-level-pill">'+safe(levelLabel)+'モード</span></div>'+
          '<div class="snapshot-overview">'+
            '<div class="snapshot-score">'+
              '<div class="snapshot-score-row"><div><div class="snapshot-score-caption">4つの要素の達成度</div>'+
                '<div class="snapshot-score-value">'+completion+'<span>%</span></div></div>'+
                '<div class="snapshot-score-symbol" aria-hidden="true">★</div></div>'+
              '<div class="snapshot-score-track" role="progressbar" aria-label="今回の達成度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+completion+'">'+
                '<span style="width:'+completion+'%"></span></div>'+
            '</div>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">SCORE</span>'+
              '<span class="snapshot-stat-value">'+finalScore+'</span></div>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">WORDS</span>'+
              '<span class="snapshot-stat-value">'+words+'</span></div>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">WPM</span>'+
              '<span class="snapshot-stat-value">'+wpm+'</span></div>'+
            '<button type="button" class="snapshot-transcript-button" data-feedback-action="transcript">'+
              '<span class="snapshot-transcript-caption">📝 話した英語を確認 <span aria-hidden="true">↗</span></span>'+
              '<span class="snapshot-transcript-preview">'+safe(transcript || 'No speech recorded.')+'</span></button>'+
          '</div>'+
          '<div class="snapshot-tab-label">言えた？ 言えなかった？</div>'+
          '<div id="snapshot-status-tabs" class="snapshot-status-tabs" role="tablist" aria-label="言えた・言えなかった"></div>'+
          '<div class="snapshot-section-heading"><strong>4つの評価要素</strong><span>タップして切り替え</span></div>'+
          '<div id="snapshot-category-tabs" class="snapshot-categories" role="tablist" aria-label="4つの評価要素"></div>'+
        '</aside>'+
        '<main class="snapshot-workspace" data-status="missed">'+
          '<div class="snapshot-workspace-header">'+
            '<span class="snapshot-workspace-eyebrow">EXPRESSIONS & PRACTICE</span>'+
            '<div class="snapshot-list-head"><strong id="snapshot-list-title"></strong>'+
              '<span id="snapshot-list-description"></span></div>'+
            '<p id="snapshot-list-tip" class="snapshot-list-tip"></p>'+
          '</div>'+
          '<div id="snapshot-item-grid" class="snapshot-item-grid" role="tabpanel" aria-live="polite"></div>'+
          '<div class="snapshot-pagination">'+
            '<button id="snapshot-page-prev" class="snapshot-page-btn" type="button" data-feedback-action="prev">◀ 前へ</button>'+
            '<span id="snapshot-page-count" class="snapshot-page-counter" aria-live="polite"></span>'+
            '<button id="snapshot-page-next" class="snapshot-page-btn" type="button" data-feedback-action="next">次へ ▶</button>'+
          '</div>'+
        '</main>'+
        '<div id="snapshot-transcript-dialog" class="snapshot-transcript-overlay hidden" role="dialog" aria-modal="true" aria-label="話した英語の全文">'+
          '<div class="snapshot-transcript-dialog-head">'+
            '<strong>📝 音声認識で確定した英語</strong>'+
            '<button type="button" data-feedback-action="close-transcript">✕ 閉じる</button></div>'+
          '<div class="snapshot-full-transcript">'+safe(transcript || 'No speech recorded.')+'</div>'+
        '</div>'+
      '</section>';
    refresh();

    // Keep existing Classroom submission and learning history unchanged.
    if (typeof window.setupSubmitButton === 'function') {
      window.setupSubmitButton(stats.completionRate || 0);
    }
    if (!window.__picSpeakHistorySaved &&
        typeof window.saveLearningLog === 'function') {
      window.__picSpeakHistorySaved = true;
      window.saveLearningLog({
        date:new Date().toISOString(),
        imageId:window.currentTheme?.id || window.tempSelectedThemeId || 'unknown',
        mode:window.appState.selectedMode,
        level:window.appState.selectedLevel,
        score:Number(document.getElementById('scoreDisplay')?.textContent) || 0,
        completion:stats.completionRate || 0,
        words,wpm
      });
    }
  }

  function preparePracticeModal() {
    const modal = document.getElementById('practice-modal');
    if (!modal) return;
    modal.classList.add('snapshot-compact-practice');
    document.getElementById('practice-transcript')?.parentElement?.classList.add('snapshot-practice-output');
  }
  function handleClick(event) {
    if (!attempt || window.appState?.selectedMode !== 'snapshot') return;
    const statusTab = event.target.closest('#snapshot-status-tabs [data-status]');
    if (statusTab) {
      attempt.status = statusTab.dataset.status;
      if (!(getCategory(attempt.category)[attempt.status] || []).length) {
        const category = visibleCategories().find(c =>
          (getCategory(c.id)[attempt.status]?.length || 0) > 0);
        if (category) attempt.category=category.id;
      }
      attempt.page=0;
      refresh();
      return;
    }
    const categoryTab = event.target.closest('#snapshot-category-tabs [data-category]');
    if (categoryTab) {
      attempt.category=categoryTab.dataset.category;
      attempt.page=0;
      refresh();
      return;
    }
    const button = event.target.closest('[data-feedback-action]');
    if (!button || !button.closest('#ranking-container')) return;
    const action=button.dataset.feedbackAction;
    if (action==='prev') {
      attempt.page=Math.max(0,attempt.page-1);
      renderItems();
    } else if (action==='next') {
      attempt.page+=1;
      renderItems();
    } else if (action==='transcript') {
      openTranscript();
    } else if (action==='close-transcript') {
      closeTranscript();
    } else if (action==='audio' || action==='practice') {
      const item = currentItems()[Number(button.dataset.index)];
      if (!item?.text) return;
      if (action==='audio') {
        if (typeof window.playResultTTS === 'function') window.playResultTTS(item.text);
      } else {
        pendingPractice={text:item.text};
        preparePracticeModal();
        if (typeof window.openPractice === 'function') {
          window.openPractice(item.text,item.ja || '');
        }
      }
    }
  }

  function init() {
    if (typeof originalRender !== 'function') return;
    window.renderSnapshotResult=function() {
      if (window.appState?.selectedMode !== 'snapshot') {
        attempt=null;
        document.getElementById('view-result')?.classList.remove('snapshot-result-mode');
        return originalRender.apply(this,arguments);
      }
      return renderNewResult();
    };
    document.addEventListener('click',handleClick);
    window.addEventListener('resize',() => {
      if (attempt && window.appState?.selectedMode==='snapshot') renderItems();
    });
    document.addEventListener('keydown',e => {
      if (e.key==='Escape') closeTranscript();
    });
    // This indicates success in remedial practice only; do not recalculate the
    // attempt score, alter cleared/missed sets, or change result-tab counts.
    const previousExcellent=window.showExcellentPrompt;
    if (typeof previousExcellent==='function') {
      window.showExcellentPrompt=function() {
        const result=previousExcellent.apply(this,arguments);
        if (attempt && pendingPractice && window.practiceSuccess) {
          attempt.practiced.add(pendingPractice.text);
          renderItems();
        }
        return result;
      };
    }
    const previousClose=window.closePracticeModal;
    if (typeof previousClose==='function') {
      window.closePracticeModal=function() {
        const result=previousClose.apply(this,arguments);
        pendingPractice=null;
        document.getElementById('practice-modal')?.classList.remove('snapshot-compact-practice');
        return result;
      };
    }
  }
  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',init,{once:true});
  } else init();
})();
