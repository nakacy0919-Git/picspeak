/* PicSpeak Snapshot: review in one iPad screen using current score/recognition data.
 * No rescoring. The learner's practice success is shown separately from the original result. */
(function () {
  'use strict';
  const CATEGORY_INFO = [
    {id:'object',label:'物・人',icon:'👤',color:'#047857',tint:'#d1fae5'},
    {id:'attribute',label:'様子・色',icon:'🎨',color:'#b45309',tint:'#fef3c7'},
    {id:'detail',label:'位置・背景',icon:'📍',color:'#6d28d9',tint:'#ede9fe'},
    {id:'gist',label:'動き・要点',icon:'🎬',color:'#1d4ed8',tint:'#dbeafe'},
    {id:'other',label:'その他',icon:'💬',color:'#475569',tint:'#f8fafc'}
  ];
  // Inline vector icons are always available on iPad Safari, independent of
  // emoji fonts, third-party icon libraries, and network image requests.
  const CATEGORY_ICON_SVG = {
    object: '<circle cx="16" cy="12" r="6"/><path d="M4 35v-3c0-7 5-11 12-11s12 4 12 11v3"/><rect x="29" y="23" width="14" height="14" rx="2"/><path d="M29 29h14"/>',
    attribute: '<path d="M24 5C13 5 5 13 5 24s9 19 19 19c5 0 8-3 8-7 0-3-2-5-2-7s2-4 5-4h3c5 0 6-4 5-8C40 10 32 5 24 5Z"/><circle cx="15" cy="19" r="2.3"/><circle cx="24" cy="13" r="2.3"/><circle cx="34" cy="19" r="2.3"/><circle cx="15" cy="30" r="2.3"/>',
    detail: '<path d="M24 43s14-14 14-25a14 14 0 0 0-28 0c0 11 14 25 14 25Z"/><circle cx="24" cy="18" r="5"/><path d="M6 43h36"/>',
    gist: '<circle cx="27" cy="9" r="4"/><path d="m23 19 7 3 7 1m-14-4-8 8-8 1m16-9-1 12 9 8m-9-8-12 9"/><path d="m6 16 6-2m-6 10 5-1"/>',
    other: '<path d="M8 10h32v24H19L9 41v-7H8z"/><path d="M16 21h16m-16 7h10"/>'
  };
  const renderCategoryIcon = category => '<span class="snapshot-category-icon" aria-hidden="true">'+
    '<svg class="snapshot-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" '+
    'stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+
    (CATEGORY_ICON_SVG[category.id] || CATEGORY_ICON_SVG.other)+'</svg></span>';

  const originalRender = window.renderSnapshotResult;
  let attempt = null;
  let pendingPractice = null;
  let reviewReturnFocus = null;
  const safe = value => typeof window.picSpeakEscapeHTML === 'function'
    ? window.picSpeakEscapeHTML(String(value == null ? '' : value))
    : String(value == null ? '' : value).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // A category can list a target under several coverage categories.
  // Within one category, show each expression just once.
  function categoryEntries(categoryId) {
    const stat = getCategory(categoryId);
    const byText = new Map();
    for (const status of ['missed','cleared']) {
      for (const item of stat[status] || []) {
        const key=String(item?.text || '').trim().toLowerCase();
        if (!key) continue;
        // A verified match wins if the source accidentally lists an item twice.
        if (!byText.has(key) || status === 'cleared') byText.set(key,{item,status});
      }
    }
    return Array.from(byText.values());
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
    if (!attempt) return [];
    if (attempt.dialogMode==='goal') return getGoalPlan().entries;
    const priority = {'基本例文':0,'チャンク':1,'単語':2};
    return categoryEntries(attempt.category)
      .filter(entry => attempt.status === 'all' || entry.status === attempt.status)
      .sort((a,b) => {
        // Show missing sentences first: teachers can scan × then ○.
        const statusOrder = {'missed':0,'cleared':1};
        const byStatus=statusOrder[a.status]-statusOrder[b.status];
        if (byStatus && attempt.status === 'all') return byStatus;
        const aKind=priority[attempt.kinds?.get(String(a.item.text))] ?? 3;
        const bKind=priority[attempt.kinds?.get(String(b.item.text))] ?? 3;
        return (aKind-bKind) || ((b.item.points||0)-(a.item.points||0)) ||
          String(a.item.text).localeCompare(String(b.item.text));
      });
  }

  function renderStatusTabs() {
    const host = document.getElementById('snapshot-status-tabs');
    if (!host || !attempt) return;
    if (attempt.dialogMode==='goal') {host.innerHTML='';return;}
    const entries=categoryEntries(attempt.category);
    const counts={
      all:entries.length,
      missed:entries.filter(e=>e.status==='missed').length,
      cleared:entries.filter(e=>e.status==='cleared').length
    };
    host.innerHTML = [
      {id:'all',label:'すべて',mark:'☰'},
      {id:'missed',label:'言えなかった',mark:'×'},
      {id:'cleared',label:'言えた',mark:'○'}
    ].map(tab=>'<button type="button" class="snapshot-status-tab" role="tab" '+
       'aria-selected="'+(attempt.status===tab.id)+'" data-status="'+tab.id+'">'+
       '<span class="snapshot-status-mark" aria-hidden="true">'+tab.mark+'</span>'+
       safe(tab.label)+' <span class="snapshot-status-count">'+counts[tab.id]+'</span></button>').join('');
  }

  function renderCategoryTabs() {
    const host = document.getElementById('snapshot-category-tabs');
    if (!host || !attempt) return;
    const cats=visibleCategories();
    host.classList.toggle('with-other',cats.length>4);
    host.innerHTML=cats.map(c=>{
      const entries=categoryEntries(c.id);
      const said=entries.filter(e=>e.status==='cleared').length;
      const missed=entries.filter(e=>e.status==='missed').length;
      const rate=Number.isFinite(getCategory(c.id).matchRate)
        ? Math.min(100,Math.max(0,getCategory(c.id).matchRate)):0;
      return '<button type="button" role="tab" class="snapshot-category-tab" '+
        'data-category="'+c.id+'" aria-selected="'+(c.id===attempt.category)+'" '+
        'aria-label="'+safe(c.label)+'の表現一覧を開く。言えた'+said+'件、言えなかった'+missed+'件" '+
        'style="--snapshot-accent:'+c.color+';--snapshot-tint:'+c.tint+'">'+
          renderCategoryIcon(c)+
          '<span class="snapshot-category-text">'+
            '<strong class="snapshot-category-name">'+safe(c.label)+'</strong>'+


          '</span>'+
          '<span class="snapshot-category-counts"><b class="is-cleared">○ '+said+'</b><b class="is-missed">× '+missed+'</b></span>'+
          '<span class="snapshot-category-progress" aria-hidden="true"><span style="width:'+rate+'%"></span></span>'+
      '</button>';
    }).join('');
  }

  function renderItems() {
    if (!attempt) return;
    const list=currentItems();
    const grid=document.getElementById('snapshot-item-grid');
    const category=visibleCategories().find(c=>c.id===attempt.category);
    const title=document.getElementById('snapshot-list-title');
    const description=document.getElementById('snapshot-list-description');
    const tip=document.getElementById('snapshot-list-tip');
    const isGoal=attempt.dialogMode==='goal';
    const all=categoryEntries(attempt.category);
    const said=all.filter(e=>e.status==='cleared').length;
    const missed=all.filter(e=>e.status==='missed').length;
    const goal=isGoal?getGoalPlan():null;
    if (title) title.textContent=isGoal?'🎯 100％に向けた次の表現':(category?.label||'その他')+'の表現';
    if (description) description.textContent=isGoal
      ? (goal.achievable?'今回 '+attempt.completion+'％ → 100％':'練習する表現 '+list.length+'件')
      : all.length+'件 ｜ ○ '+said+'件・× '+missed+'件';
    if (tip) tip.textContent=isGoal
      ? (goal.achievable
          ? '現在の採点条件で試算した目標表現です。次回の写真描写でこれらを言い、音声認識されれば100％を目指せます。音読練習だけでは今回の点数は変わりません。'
          : (attempt.completion>=100?'今回の達成度は100％です！':
             '100％になる組み合わせを特定できませんでした。未確認の表現をお手本と音読で練習しましょう。'))
      : '○＝今回の発話で確認できた表現　×＝音声認識でまだ確認できなかった表現';
    if (!grid) return;
    // Touching a category or a status filter resets only this list's scroll.
    if (attempt.resetListScroll) {
      grid.scrollTop=0;
      attempt.resetListScroll=false;
    }
    if (!list.length) {
      grid.innerHTML='<div class="snapshot-empty">'+
        (isGoal?'追加の目標表現はありません。':
         attempt.status==='cleared'?'この要素で確認できた表現はまだありません。':
          attempt.status==='missed'?'この要素で言えなかった表現はありません 🎉':
          'この要素の目標表現はありません。')+'</div>';
      return;
    }
    grid.innerHTML=list.map((entry,index)=>{
      const item=entry.item;
      const english=String(item.text || '');
      const japanese=String(item.ja || '');
      const isSaid=entry.status==='cleared';
      const practiced=attempt.practiced.has(english);
      const kind=attempt.kinds?.get(english)||'目標表現';
      const statusLabel=isSaid?'言えた':'まだ言えなかった';
      return '<article class="snapshot-item-row" data-status="'+entry.status+'">'+
        '<span class="snapshot-item-mark" role="img" aria-label="'+statusLabel+'">'+
          (isSaid?'○':'×')+'</span>'+
        '<div class="snapshot-item-copy">'+
          '<div class="snapshot-item-meta"><span class="snapshot-item-kind">'+safe(kind)+'</span>'+
            (practiced&&!isSaid?'<span class="snapshot-practiced-tag">✓ 復習で言えた</span>':'')+
          '</div>'+
          '<div class="snapshot-item-en">'+safe(english)+'</div>'+
          (japanese?'<div class="snapshot-item-ja">'+safe(japanese)+'</div>':'')+
        '</div>'+
        '<div class="snapshot-item-buttons">'+
          '<button type="button" class="snapshot-item-action sound" data-feedback-action="audio" data-index="'+index+
            '" aria-label="お手本の音声：'+safe(english)+'">🔊 <span>お手本</span></button>'+
          '<button type="button" class="snapshot-item-action speak" data-feedback-action="practice" data-index="'+index+
            '" aria-label="音読練習：'+safe(english)+'">🎤 <span>練習</span></button>'+
        '</div>'+
      '</article>';
    }).join('');
  }

  // Simulate the real four-element scoring rules with cloned evidence sets.
  // The previous result and classroom record are never altered by practice.
  function getGoalPlan() {
    if (attempt?.goalPlan) return attempt.goalPlan;
    if (!attempt) return {entries:[],achievable:false};
    const kinds=[
      ['words','missedWords','clearedWords'],
      ['chunks','missedChunks','clearedChunks'],
      ['sentences','missedSentences','clearedSentences']
    ];
    const seeds={words:new Set(),chunks:new Set(),sentences:new Set()};
    const candidates=[];
    for (const [key,missed,cleared] of kinds) {
      const seen=new Set();
      for (const item of attempt.stats[cleared]||[]) if (item?.text) seeds[key].add(item.text);
      for (const item of attempt.stats[missed]||[]) {
        const word=String(item?.text||'').trim(),normalized=word.toLowerCase();
        if (!word||seen.has(normalized)||seeds[key].has(word))continue;
        seen.add(normalized);
        candidates.push({kind:key,item});
      }
    }
    const canSimulate=typeof window.getCompletionStats==='function'&&
      kinds.every(([,missed,cleared])=>Array.isArray(attempt.stats[missed])&&Array.isArray(attempt.stats[cleared]));
    const score=sets=>window.getCompletionStats(window.currentTheme,window.appState.selectedLevel,sets)?.completionRate||0;
    if (canSimulate) {
      let current=score(seeds);
      if (Math.abs(current-attempt.completion)<=1) {
        const currentModels=new Set((window.currentTheme?.scoringData?.[window.appState.selectedLevel]?.sentences||[])
          .map(item=>item.text));
        const priority=c=>c.kind==='sentences'
          ? (currentModels.has(c.item.text)?8:5)
          : c.kind==='chunks'?2:1;
        // Avoid blocking the iPad UI when an image has hundreds of phrases.
        const available=candidates.slice().sort((a,b)=>priority(b)-priority(a)).slice(0,48);
        const chosen=[];
        // Limit work on tablets with very large datasets. Prefer meaningful
        // improvements; sentence goals take precedence for equal gains.
        const maxSteps=Math.min(12,available.length);
        for(let turn=0;turn<maxSteps&&current<100;turn++) {
          let best=-1,bestRate=current,bestPriority=-1;
          for(let i=0;i<available.length;i++) {
            const c=available[i];
            const trial={words:new Set(seeds.words),chunks:new Set(seeds.chunks),sentences:new Set(seeds.sentences)};
            trial[c.kind].add(c.item.text);
            const rate=score(trial);
            const priority=c.kind==='sentences'?3:c.kind==='chunks'?2:1;
            if(rate>bestRate||(rate===bestRate&&rate>current&&priority>bestPriority)) {
              best=i;bestRate=rate;bestPriority=priority;
            }
          }
          if(best<0||bestRate<=current)break;
          const selected=available.splice(best,1)[0];
          seeds[selected.kind].add(selected.item.text);
          chosen.push({item:selected.item,status:'missed'});
          current=bestRate;
        }
        if(current===100) {
          attempt.goalPlan={entries:chosen,achievable:true};
          return attempt.goalPlan;
        }
      }
    }
    // No guarantee when the goal cannot be verified with the actual formula.
    const fallback=candidates.length?candidates.map(c=>({item:c.item,status:'missed'})):
      [...new Map(visibleCategories().flatMap(c=>categoryEntries(c.id)
        .filter(e=>e.status==='missed').map(e=>[String(e.item.text).toLowerCase(),e]))).values()];
    attempt.goalPlan={entries:fallback,achievable:false};
    return attempt.goalPlan;
  }
  function openReview(mode,invoker) {
    if (!attempt) return;
    const dialog=document.getElementById('snapshot-review-dialog');
    if (!dialog)return;
    reviewReturnFocus=invoker||null;
    attempt.dialogMode=mode==='goal'?'goal':'category';
    if (attempt.dialogMode==='category') attempt.status='all';
    attempt.resetListScroll=true;
    dialog.classList.remove('hidden');
    dialog.setAttribute('aria-hidden','false');
    refresh();
    dialog.querySelector('.snapshot-review-close')?.focus();
  }
  function closeReview() {
    const dialog=document.getElementById('snapshot-review-dialog');
    if (!dialog)return;
    dialog.classList.add('hidden');
    dialog.setAttribute('aria-hidden','true');
    // Category tabs are re-rendered on selection, so focus the new live
    // button rather than the detached pre-render DOM element.
    const category=reviewReturnFocus?.dataset?.category;
    const liveButton=category?document.querySelector(
      '#snapshot-category-tabs [data-category="'+category+'"]'):null;
    (liveButton||reviewReturnFocus)?.focus?.();
    reviewReturnFocus=null;
  }

  function refresh() {
    if (!attempt) return;
    const workspace=document.querySelector('#view-result.snapshot-result-mode .snapshot-review-list');
    if (workspace) {workspace.dataset.status=attempt.status;workspace.dataset.mode=attempt.dialogMode;}
    renderCategoryTabs();
    renderStatusTabs();
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
      stats,transcript,words,wpm,completion,status:'all',category:'object',dialogMode:'category',resetListScroll:true,goalPlan:null,
      practiced:new Set(),kinds
    };
    const firstUnsaid = visibleCategories().find(c=>categoryEntries(c.id).some(e=>e.status==='missed'));
    attempt.category = firstUnsaid?.id || 'object';

    container.innerHTML =
      '<section class="snapshot-feedback" aria-label="Snapshot の学習結果">'+
        '<div class="snapshot-top-summary">'+
          '<div class="snapshot-result-identity">'+
            '<span class="snapshot-eyebrow">PICTURE DESCRIPTION • RESULTS</span>'+
            '<span class="snapshot-level-pill">'+safe(levelLabel)+'モード</span>'+
          '</div>'+
          '<div class="snapshot-overview">'+
            '<div class="snapshot-score"><div class="snapshot-score-caption">4要素の達成度</div>'+
              '<div class="snapshot-score-value">'+completion+'<span>%</span></div>'+
              '<span class="snapshot-score-track" role="progressbar" aria-label="今回の達成度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+completion+'"><span style="width:'+completion+'%"></span></span>'+
            '</div>'+
            '<button type="button" class="snapshot-goal-button" data-feedback-action="goal" aria-label="100％に向けた表現を見る">'+
              '<span class="snapshot-goal-icon" aria-hidden="true">🎯</span><span>'+
              (completion>=100?'100％達成':'あと'+(100-completion)+'％')+
              '<small>'+(completion>=100?'今回の目標達成':'100％へのヒント')+'</small></span></button>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">SCORE</span><span class="snapshot-stat-value">'+finalScore+'</span></div>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">WORDS</span><span class="snapshot-stat-value">'+words+'</span></div>'+
            '<div class="snapshot-stat"><span class="snapshot-stat-label">WPM</span><span class="snapshot-stat-value">'+wpm+'</span></div>'+
            '<button type="button" class="snapshot-transcript-button" data-feedback-action="transcript">'+
              '<span>📝 発話を確認</span><small>'+safe(transcript||'タップして全文を見る')+'</small></button>'+
          '</div>'+
        '</div>'+
        '<section class="snapshot-category-panel" aria-label="4つの評価要素">'+
          '<div class="snapshot-category-guide"><strong>4つの評価要素</strong><span>各ボタンから○・×付き表現一覧を開く</span></div>'+
          '<div id="snapshot-category-tabs" class="snapshot-categories" role="group" aria-label="評価要素の詳細を開く"></div>'+
        '</section>'+
        '<div class="snapshot-review-summary"><span>✅ 今回の結果を確認</span>'+
          '<span>4色のボタンで表現を確認。100％へのボタンから復習もできます。</span></div>'+
        '<div id="snapshot-review-dialog" class="snapshot-review-overlay hidden" role="dialog" aria-modal="true" aria-label="評価要素と音読練習" aria-hidden="true">'+
          '<section class="snapshot-review-list" data-status="all" data-mode="category" aria-label="表現の達成状況">'+
            '<div class="snapshot-review-top"><span>表現を確認・音読練習</span>'+
              '<button type="button" class="snapshot-review-close" data-feedback-action="close-review" aria-label="一覧を閉じる">✕ 閉じる</button></div>'+
            '<div class="snapshot-review-heading">'+
              '<div class="snapshot-heading-main"><strong id="snapshot-list-title"></strong>'+
                '<span id="snapshot-list-description"></span></div>'+
              '<div id="snapshot-status-tabs" class="snapshot-status-tabs" role="tablist" aria-label="表現を絞り込む"></div>'+
            '</div>'+
            '<p id="snapshot-list-tip" class="snapshot-list-tip"></p>'+
            '<div id="snapshot-item-grid" class="snapshot-expression-list" role="tabpanel" aria-live="polite"></div>'+
          '</section>'+
        '</div>'+
        '<div id="snapshot-transcript-dialog" class="snapshot-transcript-overlay hidden" role="dialog" aria-modal="true" aria-label="話した英語の全文">'+
          '<div class="snapshot-transcript-dialog-head"><strong>📝 音声認識で確定した英語</strong>'+
            '<button type="button" data-feedback-action="close-transcript">✕ 閉じる</button></div>'+
          '<div class="snapshot-full-transcript">'+safe(transcript||'No speech recorded.')+'</div>'+
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
    if (event.target?.id==='snapshot-review-dialog') {closeReview();return;}
    const statusTab = event.target.closest('#snapshot-status-tabs [data-status]');
    if (statusTab) {
      attempt.status=statusTab.dataset.status;
      attempt.resetListScroll=true;
      refresh();
      return;
    }
    const categoryTab = event.target.closest('#snapshot-category-tabs [data-category]');
    if (categoryTab) {
      attempt.category=categoryTab.dataset.category;
      openReview('category',categoryTab);
      return;
    }
    const button = event.target.closest('[data-feedback-action]');
    if (!button || !button.closest('#ranking-container')) return;
    const action=button.dataset.feedbackAction;
    if (action==='goal') {
      openReview('goal',button);
    } else if (action==='close-review') {
      closeReview();
    } else if (action==='transcript') {
      openTranscript();
    } else if (action==='close-transcript') {
      closeTranscript();
    } else if (action==='audio' || action==='practice') {
      const item = currentItems()[Number(button.dataset.index)]?.item;
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
        reviewReturnFocus=null;
        document.getElementById('view-result')?.classList.remove('snapshot-result-mode');
        return originalRender.apply(this,arguments);
      }
      return renderNewResult();
    };
    document.addEventListener('click',handleClick);
    // CSS handles responsive layout without resetting the scroll position on rotation.
    document.addEventListener('keydown',e => {
      if (e.key==='Escape') {closeReview();closeTranscript();return;}
      const dialog=document.getElementById('snapshot-review-dialog');
      if (e.key==='Tab' && dialog && !dialog.classList.contains('hidden')) {
        const controls=Array.from(dialog.querySelectorAll('button:not([disabled])'));
        if (!controls.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if (e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();}
        else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
      }
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
