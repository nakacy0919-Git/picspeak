/* PicSpeak Snapshot – original model-answer based grammar filter
   This UI reads data/snapshot_grammar_index.json, generated from the actual
   data/themes/*.json scoringData sentences. It never invents answer text. */
(function () {
  'use strict';

  const GRAMMARS = [
    {id:'progressive',ja:'現在進行形',en:'Present Continuous',aliases:['現在進行形','進行形','present continuous','present progressive']},
    {id:'participle',ja:'現在分詞（名詞修飾）',en:'Present Participle',aliases:['現在分詞','分詞の後置修飾','present participle']},
    {id:'gerund',ja:'動名詞',en:'Gerund',aliases:['動名詞','gerund']},
    {id:'preposition',ja:'前置詞',en:'Prepositions',aliases:['前置詞','preposition','prepositions']},
    {id:'relative',ja:'関係代名詞',en:'Relative Pronouns',aliases:['関係代名詞','relative pronouns','relative pronoun','who','which','that']},
    {id:'infinitive',ja:'to不定詞',en:'Infinitive',aliases:['to不定詞','不定詞','infinitive']},
    {id:'passive',ja:'受動態',en:'Passive Voice',aliases:['受動態','passive','passive voice']},
    {id:'pastparticiple',ja:'過去分詞（名詞修飾）',en:'Past Participle',aliases:['過去分詞','past participle']},
    {id:'comparison',ja:'比較級・最上級',en:'Comparatives',aliases:['比較級','最上級','比較表現','comparative','superlative']},
    {id:'conjunction',ja:'接続詞',en:'Conjunctions',aliases:['接続詞','conjunction','conjunctions','while','because']},
    {id:'modal',ja:'助動詞',en:'Modal Verbs',aliases:['助動詞','modal','modal verbs']},
    {id:'there',ja:'There is / are',en:'There is / are',aliases:['there is','there are','there is/are']},
    {id:'perfect',ja:'現在完了形',en:'Present Perfect',aliases:['現在完了形','現在完了','present perfect']}
  ];
  const LEVELS = [
    {id:'elementary',label:'小学生'},
    {id:'junior_high',label:'中学生'},
    {id:'high_school',label:'高校生'}
  ];
  const state = {grammar:'',keyword:'',category:'all'};
  let indexPromise = null;
  let indexed = new Map();
  let loaded = false;
  const normalize = s => String(s == null ? '' : s).normalize('NFKC').toLocaleLowerCase().trim();
  const escapeHTML = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const grammarById = id => GRAMMARS.find(g => g.id === id);
  const currentLevel = () => window.appState?.selectedLevel || 'elementary';

  async function ensureIndex() {
    if (loaded) return;
    if (!indexPromise) {
      indexPromise = fetch('data/snapshot_grammar_index.json?v=20261110-grounded-1')
        .then(response => {
          if (!response.ok) throw new Error('Grammar index HTTP ' + response.status);
          return response.json();
        })
        .then(data => {
          if (!data || data.source !== 'data/themes/{id}.json:scoringData.{level}.sentences' || !Array.isArray(data.items)) {
            throw new Error('Unexpected grammar index format');
          }
          indexed = new Map(data.items.map(item => [String(item.id), item.examples || {}]));
          loaded = true;
        })
        .catch(err => {
          indexPromise = null;
          console.error('Could not load original model-answer grammar index:', err);
          const status = document.getElementById('grammar-result-count');
          if (status) status.textContent = 'モデルアンサーデータを読み込めませんでした。再度お試しください。';
        });
    }
    await indexPromise;
  }

  function effectiveGrammar() {
    if (state.grammar) return state.grammar;
    const search = normalize(state.keyword);
    if (!search) return '';
    const found = GRAMMARS.find(item => item.aliases.some(alias => normalize(alias) === search));
    return found ? found.id : '';
  }

  function chooseExample(examples, grammarId) {
    const levels = examples?.[grammarId] || null;
    if (!levels) return null;
    const order = [currentLevel(), 'junior_high','high_school','elementary'];
    for (const level of [...new Set(order)]) {
      const record = levels[level];
      if (record && typeof record.text === 'string' && record.text.trim()) {
        return {text:record.text,grammar:record.grammar || '',level,ja:record.ja || ''};
      }
    }
    return null;
  }

  function addUI() {
    if (document.getElementById('snapshot-grammar-filters')) return;
    const categories = document.getElementById('theme-filters');
    if (!categories?.parentNode) return;
    const panel = document.createElement('section');
    panel.id = 'snapshot-grammar-filters';
    panel.className = 'w-full max-w-7xl bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4 hidden';
    panel.setAttribute('aria-label','文法から写真を探す');
    panel.innerHTML =
      '<div class="flex flex-wrap justify-between items-start gap-2 mb-3">' +
      '<div><h3 class="font-black text-base md:text-lg text-slate-800">🔎 文法別・写真検索 <span class="text-pink-500 text-xs">Grammar Search</span></h3>' +
      '<p class="text-xs text-slate-500 mt-1">実際のモデルアンサーに登録された文法・英文だけから検索します。</p></div>' +
      '<button type="button" id="grammar-clear" class="rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 px-3 py-2">クリア</button></div>' +
      '<div id="grammar-pills" class="flex flex-wrap gap-2 mb-3">' +
        '<button type="button" class="grammar-pill rounded-full px-3 py-2 text-xs md:text-sm font-bold" data-grammar="">すべて</button>' +
        GRAMMARS.map(g => '<button type="button" class="grammar-pill rounded-full px-3 py-2 text-xs md:text-sm font-bold" data-grammar="'+escapeHTML(g.id)+'">'+escapeHTML(g.ja)+'</button>').join('') +
      '</div>' +
      '<label class="block"><span class="sr-only">文法・英文・写真名で検索</span><input id="grammar-search-input" type="search" autocomplete="off" placeholder="文法・写真名・英文を検索（例：関係代名詞 / cooking）" class="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm md:text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300"></label>' +
      '<p id="grammar-result-count" role="status" aria-live="polite" class="text-xs font-bold text-slate-600 mt-3">モデルアンサーを読み込み中...</p>' +
      '<p class="text-[11px] text-slate-400 mt-1">文法で検索した写真を選ぶと、そのモデルアンサーの登録レベルに自動で合わせます。採点内容は既存のままです。</p>';
    categories.parentNode.insertBefore(panel,categories);
    panel.addEventListener('click', e => {
      const choice = e.target.closest('.grammar-pill');
      if (choice) {
        state.grammar = choice.dataset.grammar || '';
        paintPills();
        applyFilters();
      }
      if (e.target.closest('#grammar-clear')) {
        state.grammar = '';
        state.keyword = '';
        const input = panel.querySelector('#grammar-search-input');
        if (input) input.value = '';
        paintPills();
        applyFilters();
      }
    });
    panel.querySelector('#grammar-search-input').addEventListener('input', e => {
      state.keyword = String(e.target.value || '');
      applyFilters();
    });
    paintPills();
  }

  function paintPills() {
    document.querySelectorAll('.grammar-pill').forEach(button => {
      const active = (button.dataset.grammar || '') === state.grammar;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('bg-pink-500',active);
      button.classList.toggle('text-white',active);
      button.classList.toggle('shadow-sm',active);
      button.classList.toggle('bg-slate-50',!active);
      button.classList.toggle('border',!active);
      button.classList.toggle('border-slate-200',!active);
      button.classList.toggle('text-slate-700',!active);
    });
  }

  function keywordMatches(item, examples, selectedType) {
    const query = normalize(state.keyword);
    if (!query) return true;
    const typeFromKeyword = GRAMMARS.find(g => g.aliases.some(a=>normalize(a)===query));
    // A direct grammar search should match by the grammar tag, not by
    // accidental occurrences of "who", "which", etc. in other text.
    if (typeFromKeyword && !state.grammar) return Boolean(chooseExample(examples,typeFromKeyword.id));
    const pool = [item.id,item.titleEn,item.titleJa,item.category];
    if (selectedType) {
      const source = examples?.[selectedType] || {};
      for (const val of Object.values(source)) pool.push(val.text,val.grammar,val.ja);
    } else {
      for (const byLevel of Object.values(examples || {}))
        for (const source of Object.values(byLevel || {})) pool.push(source.text,source.grammar,source.ja);
    }
    return normalize(pool.filter(Boolean).join(' ')).includes(query);
  }

  function categoryMatches(item, hasSearch) {
    const category = item.category || 'other';
    if (state.category === 'level1') return category === 'other';
    if (state.category === 'all') return hasSearch || category !== 'other';
    return category === state.category;
  }

  function applyFilters() {
    if (window.appState?.selectedMode !== 'snapshot') return;
    const status = document.getElementById('grammar-result-count');
    if (!loaded) {
      if (status) status.textContent = '登録済みモデルアンサーを読み込み中...';
      return;
    }
    const catalog = Array.isArray(window.themeCatalog) ? window.themeCatalog : [];
    const catalogById = new Map(catalog.map(item=>[String(item.id),item]));
    const selected = effectiveGrammar();
    const searched = Boolean(selected || normalize(state.keyword));
    let count = 0;
    document.querySelectorAll('#theme-grid .theme-card').forEach(card => {
      const id = String(card.dataset.id || '');
      const item = catalogById.get(id);
      if (!item) return;
      const examples = indexed.get(id) || {};
      const original = selected ? chooseExample(examples,selected) : null;
      const show = categoryMatches(item,searched) && (!selected || Boolean(original)) &&
        keywordMatches(item,examples,selected);
      card.style.display = show ? '' : 'none';
      card.querySelector('.grammar-example')?.remove();
      if (!show) return;
      count++;
      if (original) {
        const hint = document.createElement('div');
        hint.className = 'grammar-example pointer-events-none px-3 py-3 border-t border-pink-100 bg-pink-50 text-left';
        const grammarName = grammarById(selected)?.ja || '';
        const levelName = LEVELS.find(l=>l.id===original.level)?.label || original.level;
        hint.innerHTML = '<div class="flex flex-wrap gap-1 mb-1">' +
          '<span class="text-[10px] font-black text-pink-600">'+escapeHTML(grammarName)+'</span>' +
          '<span class="text-[10px] font-black text-slate-500">・'+escapeHTML(levelName)+'のモデルアンサー</span></div>' +
          '<p class="text-xs md:text-sm text-slate-800 font-semibold leading-snug">'+escapeHTML(original.text)+'</p>' +
          (original.grammar ? '<p class="text-[10px] text-slate-500 mt-1">登録文法：'+escapeHTML(original.grammar)+'</p>':'');
        card.appendChild(hint);
      }
    });
    document.getElementById('grammar-empty-result')?.remove();
    if (!count && searched) {
      const empty = document.createElement('div');
      empty.id = 'grammar-empty-result';
      empty.className = 'col-span-full text-center bg-slate-50 border border-slate-200 text-sm text-slate-600 rounded-2xl p-5';
      empty.textContent = '登録済みモデルアンサーに該当する写真がありません。文法・レベル・カテゴリーを変えてお試しください。';
      document.getElementById('theme-grid')?.appendChild(empty);
    }
    if (status) {
      status.textContent = count+'枚の写真が見つかりました'+
        (selected ? '｜'+grammarById(selected).ja+'｜登録済みモデルアンサーのみ' : '');
    }
  }

  function syncMode() {
    document.getElementById('snapshot-grammar-filters')?.classList.toggle(
      'hidden', window.appState?.selectedMode !== 'snapshot');
  }

  function init() {
    addUI();
    if (typeof window.renderThemeGrid !== 'function') return;
    const baseRender = window.renderThemeGrid;
    window.renderThemeGrid = async function () {
      const result = await baseRender.apply(this,arguments);
      state.category = 'all'; // baseRender resets the category buttons on every entry.
      syncMode();
      if (window.appState?.selectedMode === 'snapshot') {
        await ensureIndex();
        applyFilters();
      }
      return result;
    };
    // Capture runs before main.js opens the photo's mode dialog.
    // A grammar search result must launch at the SAME level as the actual
    // model answer displayed underneath the photo.
    document.addEventListener('click', e => {
      if (window.appState?.selectedMode !== 'snapshot') return;
      const selected = effectiveGrammar();
      const card = e.target.closest('.theme-card');
      if (!selected || !card) return;
      const original = chooseExample(indexed.get(String(card.dataset.id || '')) || {},selected);
      if (!original) return;
      window.appState.selectedLevel = original.level;
      document.querySelectorAll('.level-btn').forEach(button => {
        const active = button.dataset.level === original.level;
        button.classList.toggle('selected-level-btn',active);
        button.classList.toggle('bg-sns-gradient',active);
        button.classList.toggle('text-white',active);
        button.classList.toggle('shadow-lg',active);
        button.classList.toggle('bg-gray-50',!active);
        button.classList.toggle('border-gray-200',!active);
        button.classList.toggle('text-gray-700',!active);
      });
    },true);
    document.addEventListener('click', e => {
      const button = e.target.closest('.theme-filter-btn');
      if (button) {
        state.category = button.dataset.filter || 'all';
        applyFilters();
      }
      if (e.target.closest('.level-btn')) applyFilters();
    });
    syncMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',init,{once:true});
  } else {
    init();
  }
})();
