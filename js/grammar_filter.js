/* PicSpeak SNAPSHOT grammar search (teacher-friendly, no scoring changes).
   Examples are practice suggestions; they do not alter answer matching or scoring. */
(function () {
  'use strict';
  const grammarTypes = [
    ['progressive', '現在進行形', 'be + -ing'],
    ['participle', '現在分詞', '名詞を後ろから説明'],
    ['gerund', '動名詞', '～すること'],
    ['preposition', '前置詞', '場所・位置・方向'],
    ['relative', '関係代名詞', 'who / which / that']
  ];
  const aliases = {
    progressive: ['現在進行形','進行形','present progressive','present continuous','be doing'],
    participle: ['現在分詞','分詞','後置修飾','present participle','participle','-ing'],
    gerund: ['動名詞','gerund','ing形'],
    preposition: ['前置詞','場所','位置','preposition','in','on','under','behind','between','next to'],
    relative: ['関係代名詞','関係詞','relative pronoun','who','which','that']
  };

  // Carefully selected scenes, grounded in the existing image catalog and/or
  // scoringData. Values are practical model examples, not "model answers".
  const guides = {
    '301': {
      progressive:'She is reading a book by the window.',
      participle:'The woman reading a book looks happy.',
      gerund:'She enjoys reading in a quiet cafe.',
      preposition:'She is sitting by the window.',
      relative:'The woman who is wearing a green sweater is reading a book.'
    },
    '302': {
      progressive:'A woman is sitting in a cafe.',
      participle:'The woman sitting by the window is reading.',
      gerund:'Reading at a cafe can be relaxing.',
      preposition:'The woman is sitting by the window.',
      relative:'The woman who is sitting by the window is reading a book.'
    },
    '303': {
      progressive:'Two adults are watching the children play soccer.',
      participle:'The adults watching the soccer game are sitting on chairs.',
      preposition:'The adults are sitting on chairs in the park.',
      relative:'The adults who are sitting in the park are watching a game.'
    },
    '304': {
      progressive:'A woman is taking a picture with her phone.',
      gerund:'Taking pictures is a popular activity.',
      preposition:'She is taking a picture in the park.',
      relative:'The woman who is holding a phone is taking a picture.'
    },
    '306': {
      progressive:'A boy is using a laptop in the classroom.',
      participle:'The boy using a laptop is studying.',
      gerund:'Using a laptop can help with studying.',
      preposition:'A boy in a blue hoodie is using a laptop.',
      relative:'The boy who is wearing a blue hoodie is using a laptop.'
    },
    '308': {
      progressive:'The children are playing soccer in the park.',
      participle:'The children playing soccer look happy.',
      gerund:'The children enjoy playing soccer together.',
      preposition:'The children are playing in the park.',
      relative:'The children who are playing soccer look excited.'
    },
    '309': {
      progressive:'Two men are playing tennis outside.',
      participle:'The men playing tennis are on a court.',
      gerund:'Playing tennis is good exercise.',
      preposition:'They are playing tennis on the court.',
      relative:'The men who are playing tennis are practicing together.'
    },
    '313': {
      progressive:'A man is cooking in the kitchen.',
      participle:'The man cooking in the kitchen is wearing an apron.',
      gerund:'He enjoys cooking breakfast.',
      preposition:'The vegetables are on the cutting board.',
      relative:'The man who is wearing an apron is making breakfast.'
    },
    '316': {
      progressive:'The family is watching TV on the sofa.',
      participle:'The family sitting on the sofa looks happy.',
      gerund:'Watching TV together is relaxing.',
      preposition:'The family is sitting on the sofa.',
      relative:'The people who are sitting on the sofa are smiling.'
    },
    '317': {
      progressive:'The students are cleaning the classroom.',
      participle:'The boy cleaning the blackboard is standing at the front.',
      gerund:'Cleaning the classroom is part of their routine.',
      preposition:'The boy is standing in front of the blackboard.',
      relative:'The student who is erasing the board is helping clean.'
    },
    '320': {
      progressive:'The boy is painting a picture in the art room.',
      participle:'The boy painting a mountain is holding a brush.',
      gerund:'Painting pictures is a creative activity.',
      preposition:'The girl is sitting on a chair.',
      relative:'The student who is painting a mountain is concentrating.'
    },
    '322': {
      progressive:'Four students are working in a group.',
      participle:'The students working together are making a graph.',
      gerund:'Working in groups helps students share ideas.',
      preposition:'The students are sitting around the desk.',
      relative:'The students who are working in a group are discussing a problem.'
    },
    '328': {
      progressive:'Two children are looking at a tablet.',
      participle:'The children looking at the tablet are studying.',
      gerund:'Using a tablet can make learning interactive.',
      preposition:'The tablet is between the two children.',
      relative:'The children who are looking at a tablet are learning together.'
    },
    '332': {
      progressive:'A man is preparing food in the kitchen.',
      participle:'The man preparing dinner is arranging food.',
      gerund:'Cooking dinner takes time and care.',
      preposition:'The man is working in the kitchen.',
      relative:'The man who is preparing dinner is putting food on a plate.'
    },
    '334': {
      progressive:'The children are playing basketball in the gym.',
      participle:'The boy wearing red is dribbling the ball.',
      gerund:'Playing basketball takes teamwork.',
      preposition:'The scoreboard is on the wall.',
      relative:'The boy who is wearing red is dribbling the ball.'
    },
    '339': {
      progressive:'The children are playing soccer on the school field.',
      participle:'The children playing soccer are running.',
      gerund:'Playing soccer after school is fun.',
      preposition:'The children are on the school field.',
      relative:'The children who are playing soccer are moving quickly.'
    },
    '349': {
      progressive:'A girl is wiping the desk with a cloth.',
      participle:'The girl wiping the desk is cleaning the classroom.',
      gerund:'Cleaning desks is part of classroom cleaning.',
      preposition:'The girl is wiping the desk with a cloth.',
      relative:'The girl who is holding a cloth is cleaning the desk.'
    },
    '352': {
      progressive:'The children are cutting vegetables.',
      participle:'The woman watching the children is smiling.',
      gerund:'Cooking together helps children learn.',
      preposition:'There are vegetables on the table.',
      relative:'The woman who is watching the children is smiling.'
    },
    '356': {
      progressive:'A boy is borrowing a book at the library.',
      participle:'The boy borrowing a book is at the counter.',
      gerund:'Borrowing books is free at many libraries.',
      preposition:'The boy is standing at the library counter.',
      relative:'The boy who is borrowing a book is at the counter.'
    },
    '362': {
      progressive:'A boy is planting seeds in the soil.',
      participle:'The girl watering the tomatoes is helping in the garden.',
      gerund:'Growing vegetables takes patience.',
      preposition:'The seeds are in the soil.',
      relative:'The girl who is watering the tomatoes is using a watering can.'
    },
    '365': {
      progressive:'Two children are building a robot car.',
      participle:'The boy holding a screwdriver is building a robot.',
      gerund:'Building a robot requires teamwork.',
      preposition:'The gears are on the desk.',
      relative:'The children who are building a robot are working together.'
    },
    '369': {
      progressive:'Four swimmers are swimming in the pool.',
      participle:'The boys swimming in the pool are practicing.',
      gerund:'Swimming is good exercise.',
      preposition:'The swimmers are in the pool.',
      relative:'The boys who are swimming are practicing their strokes.'
    },
    '373': {
      progressive:'The group is sitting around a campfire.',
      participle:'The children sitting around the campfire are listening.',
      gerund:'Listening to stories by a campfire is fun.',
      preposition:'There is a large tent behind the group.',
      relative:'The man who is telling a story is sitting by the campfire.'
    },
    '380': {
      progressive:'A boy is looking through a telescope.',
      participle:'The boy looking through the telescope is watching birds.',
      gerund:'Watching birds is an outdoor activity.',
      preposition:'There is a bird in the water.',
      relative:'The boy who is using a telescope is observing birds.'
    },
    '383': {
      progressive:'A girl is running with her dog.',
      participle:'The girl running with her dog is in a field.',
      gerund:'Running with a dog can be fun.',
      preposition:'The girl and her dog are in the field.',
      relative:'The girl who is running is practicing with her dog.'
    },
    'theme_l2_011': {
      progressive:'The students are presenting projects at a science fair.',
      participle:'The girl demonstrating a robot is talking to visitors.',
      gerund:'Presenting a science project requires practice.',
      preposition:'The students are presenting in the school gym.',
      relative:'The student who is demonstrating a robot is explaining her project.'
    },
    'theme_l2_012': {
      progressive:'The family is preparing dinner together.',
      participle:'The mother chopping vegetables is standing at the counter.',
      gerund:'Cooking together brings families closer.',
      preposition:'The mother is chopping vegetables on a cutting board.',
      relative:'The boy who is putting vegetables in a bowl is helping his family.'
    },
    'theme_l2_014': {
      progressive:'The students are making a large poster.',
      participle:'The girl painting the picture is working after school.',
      gerund:'Painting together can be a creative activity.',
      preposition:'The students are working in the art room.',
      relative:'The teacher who is pointing at a sketch is giving advice.'
    },
    'theme_l2_015': {
      progressive:'A family is taking care of plants on the balcony.',
      participle:'The girl watering the tomatoes is checking the leaves.',
      gerund:'Growing plants on a balcony takes care.',
      preposition:'The family is working on their balcony.',
      relative:'The mother who is planting herbs is working on the balcony.'
    },
    'theme_l2_020': {
      progressive:'The students are doing research in the library.',
      participle:'The boy searching online is taking notes.',
      gerund:'Doing research is useful for school presentations.',
      preposition:'One student is looking for a book on the shelf.',
      relative:'The girl who is organizing notes is working with classmates.'
    },
    'theme_l2_021': {
      progressive:'The students are exploring an aquarium.',
      participle:'The stingray swimming past the glass is being photographed.',
      gerund:'Watching marine animals can be educational.',
      preposition:'A sea turtle is swimming behind the visitors.',
      relative:'The girl who is taking a photo is watching a stingray.'
    },
    'theme_l2_023': {
      progressive:'The students are practicing music after school.',
      participle:'The girl singing into a microphone is rehearsing.',
      gerund:'Playing music together requires listening.',
      preposition:'The keyboard player is sitting next to the guitarist.',
      relative:'The student who is playing the keyboard is following the melody.'
    },
    'theme_l2_027': {
      progressive:'The players are practicing basketball.',
      participle:'The students practicing basketball are on the court.',
      gerund:'Practicing basketball helps improve teamwork.',
      preposition:'The basketball players are in the gym.',
      relative:'The students who are practicing basketball are working as a team.'
    },
    'theme_l2_031': {
      progressive:'Two students are visiting a zoo.',
      participle:'The zebras grazing in the background are eating grass.',
      gerund:'Watching wild animals helps students learn.',
      preposition:'An elephant is standing beside a pond.',
      relative:'The girl who is photographing the giraffe is visiting the zoo.'
    },
    'theme_l2_038': {
      progressive:'Two students are waiting to cross the street.',
      participle:'The students waiting near the corner are looking ahead.',
      gerund:'Crossing the street safely requires attention.',
      preposition:'The students are standing near the corner.',
      relative:'The students who are waiting at the corner will cross the road.'
    },
    'theme_l2_044': {
      progressive:'Two people are eating in a restaurant.',
      participle:'The man holding a spoon is eating a meal.',
      gerund:'Eating together gives people time to talk.',
      preposition:'The woman is sitting across from the man.',
      relative:'The man who is holding a spoon is sitting at the table.'
    },
    'theme_l2_046': {
      progressive:'Many passengers are using their phones on the train.',
      participle:'The passengers standing in the aisle are holding straps.',
      gerund:'Using a phone on the train is common.',
      preposition:'The passengers are sitting on the train.',
      relative:'The passengers who are standing are holding the straps.'
    },
    'theme_l2_052': {
      progressive:'A bee is flying close to the gardener.',
      participle:'The woman holding pruning shears is working in the garden.',
      gerund:'Gardening requires care around insects.',
      preposition:'The bee is flying near her hand.',
      relative:'The woman who is wearing gardening gloves has been stung by a bee.'
    },
    'theme_l2_055': {
      progressive:'Tourists are watching a shark from a boat.',
      participle:'The shark swimming beside the boat is very large.',
      gerund:'Watching sharks from a boat can be exciting.',
      preposition:'The shark is swimming beside the boat.',
      relative:'The tourists who are standing on the boat are looking at a shark.'
    },
    'theme_l2_066': {
      progressive:'Two farmers are working beside a river.',
      participle:'The woman harvesting vegetables is filling a basket.',
      gerund:'Growing vegetables requires water.',
      preposition:'The farmland is beside a river.',
      relative:'The woman who is harvesting vegetables is working with another farmer.'
    },
    'theme_l2_067': {
      progressive:'The students are discussing the meaning of success.',
      participle:'The students looking at the board are thinking.',
      gerund:'Thinking about success can lead to discussion.',
      preposition:'The question is written on the board.',
      relative:'The teacher who is leading the discussion is standing near the board.'
    },
    'theme_l2_070': {
      progressive:'A doctor is explaining results to a patient.',
      participle:'The doctor speaking to the patient is smiling.',
      gerund:'Explaining results clearly is important for doctors.',
      preposition:'The doctor is sitting across from the patient.',
      relative:'The patient who is talking to the doctor looks reassured.'
    }
  };

  const state = { grammar: '', keyword: '', category: 'all' };
  const guideFor = id => guides[String(id)] || null;
  const normalized = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addUI() {
    if (document.getElementById('snapshot-grammar-filters')) return;
    const categoryFilters = document.getElementById('theme-filters');
    if (!categoryFilters || !categoryFilters.parentNode) return;
    const panel = document.createElement('section');
    panel.id = 'snapshot-grammar-filters';
    panel.className = 'w-full max-w-7xl rounded-2xl bg-white border border-slate-200 shadow-sm p-4 md:p-5 mb-4';
    panel.setAttribute('aria-label', '文法項目で写真を探す');
    panel.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
        '<div><h3 class="text-base md:text-lg font-black text-slate-800">🔎 文法から写真を探す <span class="text-xs text-pink-500">Grammar Search</span></h3>' +
        '<p class="text-xs font-medium text-slate-500 mt-1">練習したい文法を選ぶと、授業に使える写真とモデル文が見つかります。</p></div>' +
        '<button type="button" id="grammar-clear" class="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2">検索をクリア</button>' +
      '</div>' +
      '<div class="flex flex-wrap gap-2 mb-3" id="grammar-pills">' +
        '<button type="button" class="grammar-pill rounded-full px-3 py-2 text-xs md:text-sm font-bold bg-pink-500 text-white shadow-sm" data-grammar="" aria-pressed="true">すべて</button>' +
        grammarTypes.map(t => '<button type="button" class="grammar-pill rounded-full px-3 py-2 text-xs md:text-sm font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-pink-50" data-grammar="' + t[0] + '" aria-pressed="false">' + t[1] + '</button>').join('') +
      '</div>' +
      '<label class="block"><span class="sr-only">写真や文法のキーワードを検索</span>' +
      '<input id="grammar-search-input" type="search" autocomplete="off" placeholder="例：動名詞 / who / 体育館 / cooking" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm md:text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300"></label>' +
      '<p id="grammar-result-count" role="status" aria-live="polite" class="mt-3 text-xs font-bold text-slate-600"></p>' +
      '<p class="text-[11px] text-slate-400 mt-1">例文は表現練習の提案です。文法項目ごとの自動採点を意味するものではありません。</p>';
    categoryFilters.parentNode.insertBefore(panel, categoryFilters);
    panel.addEventListener('click', event => {
      const button = event.target.closest('.grammar-pill');
      if (button) {
        state.grammar = button.dataset.grammar || '';
        refreshPills();
        applyFilters();
      }
      if (event.target.closest('#grammar-clear')) {
        state.grammar = '';
        state.keyword = '';
        const input = document.getElementById('grammar-search-input');
        if (input) input.value = '';
        refreshPills();
        applyFilters();
      }
    });
    panel.querySelector('#grammar-search-input').addEventListener('input', event => {
      state.keyword = event.target.value || '';
      applyFilters();
    });
  }

  function refreshPills() {
    document.querySelectorAll('.grammar-pill').forEach(button => {
      const selected = (button.dataset.grammar || '') === state.grammar;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('bg-pink-500', selected);
      button.classList.toggle('text-white', selected);
      button.classList.toggle('shadow-sm', selected);
      button.classList.toggle('bg-slate-50', !selected);
      button.classList.toggle('text-slate-700', !selected);
      button.classList.toggle('border', !selected);
      button.classList.toggle('border-slate-200', !selected);
    });
  }

  function matchesKeyword(item, example, guide) {
    const query = normalized(state.keyword);
    if (!query) return true;
    const names = grammarTypes.filter(t => guide && guide[t[0]])
      .flatMap(t => [t[1], t[2]].concat(aliases[t[0]] || []));
    const combined = [item.id, item.titleJa, item.titleEn, item.category, example]
      .concat(names).concat(guide ? Object.values(guide) : []).join(' ');
    return normalized(combined).includes(query);
  }

  function applyFilters() {
    if (!window.appState || window.appState.selectedMode !== 'snapshot') return;
    const allItems = Array.isArray(window.themeCatalog) ? window.themeCatalog : [];
    const lookup = new Map(allItems.map(item => [String(item.id), item]));
    const selected = state.grammar;
    const hasSearch = Boolean(selected || normalized(state.keyword));
    const cards = document.querySelectorAll('#theme-grid .theme-card');
    let total = 0;
    cards.forEach(card => {
      const item = lookup.get(card.dataset.id);
      if (!item) return;
      const guide = guideFor(item.id);
      const sample = guide && selected ? guide[selected] : '';
      const category = item.category || 'other';
      const categoryMatch = state.category === 'level1'
        ? category === 'other'
        : (state.category === 'all' ? (hasSearch || category !== 'other') : category === state.category);
      const grammarMatch = !selected || Boolean(sample);
      const visible = categoryMatch && grammarMatch && matchesKeyword(item, sample, guide);
      card.style.display = visible ? '' : 'none';
      const oldHint = card.querySelector('.grammar-example');
      if (oldHint) oldHint.remove();
      if (visible) {
        total++;
        if (selected && sample) {
          const hint = document.createElement('div');
          hint.className = 'grammar-example pointer-events-none border-t border-pink-100 px-3 py-2.5 bg-pink-50 text-left';
          hint.innerHTML = '<span class="block text-[10px] font-black text-pink-600 mb-1">' +
            escapeHTML(grammarTypes.find(t => t[0] === selected)?.[1] || '') +
            ' の練習例</span><span class="block text-xs md:text-sm leading-snug font-semibold text-slate-800">' +
            escapeHTML(sample) + '</span>';
          card.appendChild(hint);
        }
      }
    });
    let noResults = document.getElementById('grammar-empty-result');
    if (noResults) noResults.remove();
    if (!total && hasSearch) {
      noResults = document.createElement('div');
      noResults.id = 'grammar-empty-result';
      noResults.className = 'col-span-full rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600 text-center';
      noResults.textContent = '該当する写真がありません。別の文法項目やキーワードをお試しください。';
      document.getElementById('theme-grid')?.appendChild(noResults);
    }
    const counter = document.getElementById('grammar-result-count');
    if (counter) counter.textContent = total + ' 枚の写真が見つかりました' + (selected ? '（' + grammarTypes.find(t => t[0] === selected)?.[1] + '）' : '');
  }

  function syncMode() {
    const panel = document.getElementById('snapshot-grammar-filters');
    if (panel) panel.classList.toggle('hidden', !window.appState || window.appState.selectedMode !== 'snapshot');
  }

  function init() {
    addUI();
    if (typeof window.renderThemeGrid !== 'function') return;
    const originalRenderThemeGrid = window.renderThemeGrid;
    window.renderThemeGrid = async function () {
      const result = await originalRenderThemeGrid.apply(this, arguments);
      // The existing category controls reset to All whenever the grid is rebuilt.
      state.category = 'all';
      syncMode();
      applyFilters();
      return result;
    };
    document.addEventListener('click', event => {
      const categoryButton = event.target.closest('.theme-filter-btn');
      if (!categoryButton) return;
      state.category = categoryButton.dataset.filter || 'all';
      applyFilters();
    });
    syncMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
