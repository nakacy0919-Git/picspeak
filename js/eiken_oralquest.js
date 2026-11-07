/* PicSpeak Oral Quest — grade-first original Eiken speaking practice.
   Isolated from the existing legacy OralQuestGame, theme grid and LMS scoring.
   Cards remain usable as textual rehearsal until the illustrated panels are ready. */
(function () {
  "use strict";
  var DATA_ROOT = "data/eiken_oralquest/";
  var SAVE_KEY = "picspeak-eiken-oralquest-progress-v1";
  var PICTURE_SCORE_KEY = "picspeak-eiken-oralquest-picture-scores-v1";
  var GRADE_COLOR = { "3":"#4d8b86", "pre2":"#4c83a5", "2":"#a278bd", "pre1":"#c47b4e" };
  var state = {
    manifest: null, grade: null, cards: null, card: null, step: 0,
    responses: [], revealed: {}, attempted: {}, screen:"grades",
    recording:false, recognition:null, interval:null, seconds:0, listening:false,
    rubric:null, scoringManifest:null, freeOpen:false, freeText:""
  };
  var cached = {};
  function el(id){return document.getElementById(id);}
  function escapeHtml(value){return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
  function saveRead(){
    try {
      var saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch(_e){return {};}
  }
  function saveWrite(progress){try{localStorage.setItem(SAVE_KEY,JSON.stringify(progress));}catch(_e){}}
  function completed(grade){
    var values = saveRead()[grade] || [];
    return Array.isArray(values) ? values.filter(function(n){return Number.isInteger(n)&&n>=1&&n<=30;}) : [];
  }
  function markCompleted(grade,stage){
    var progress=saveRead();
    var old=completed(grade);
    if(!old.includes(stage)) old.push(stage);
    progress[grade]=old.sort(function(a,b){return a-b;});
    saveWrite(progress);
  }
  function show(screen){
    state.screen=screen;
    ["grades","stages","practice","finished"].forEach(function(x){el("oq-"+x).classList.toggle("hidden",x!==screen);});
    el("oq-load-error").classList.add("hidden");
    el("oq-back").classList.toggle("hidden",screen==="grades");
    window.scrollTo(0,0);
  }
  function fail(message){
    el("oq-load-error").textContent=message;
    el("oq-load-error").classList.remove("hidden");
  }
  function labelFor(grade){
    var g=state.manifest && state.manifest.grades.find(function(x){return x.key===grade;});
    return g ? g.label : grade;
  }
  function gradeMeta(grade){
    return state.manifest.grades.find(function(x){return x.key===grade;});
  }
  async function getJSON(path){
    var response=await fetch(DATA_ROOT+path);
    if(!response.ok) throw new Error("HTTP "+response.status+" "+path);
    return response.json();
  }
  async function init(){
    try {
      state.manifest=await getJSON("manifest.json");
      if(state.manifest.totalCards!==120) throw new Error("教材データの構成が一致しません。");
      try {state.scoringManifest=await getJSON("image_scoring_manifest.json");}
      catch(e) {console.warn("Scoring index not available",e);state.scoringManifest=null;}
      renderGrades();
      show("grades");
    } catch(err) {
      console.error("Eiken Oral Quest",err);
      fail("教材一覧を読み込めませんでした。ページを再読み込みしてください。");
    }
  }
  function renderGrades(){
    el("oq-grade-grid").innerHTML=state.manifest.grades.map(function(g){
      var done=completed(g.key).length, color=GRADE_COLOR[g.key]||"#c47b4e";
      return '<button type="button" class="grade-card" data-grade="'+escapeHtml(g.key)+'" style="--grade:'+color+'">'
        +'<div class="grade-name">'+escapeHtml(g.label)+'</div>'
        +'<div class="grade-sub">'+escapeHtml(g.questionsPerCard)+' questions / '+escapeHtml(g.approxInterviewDuration)+'</div>'
        +'<div class="grade-foot"><span>'+done+' / 30 完了</span><span class="grade-arrow" aria-hidden="true">›</span></div>'
        +'<div class="grade-progress" aria-hidden="true"><div style="width:'+(done/30*100)+'%"></div></div>'
        +'</button>';
    }).join("");
  }
  async function openGrade(grade){
    if(!state.manifest || !gradeMeta(grade)) return;
    haltAudio();
    try{
      var g=gradeMeta(grade);
      if(!cached[grade]){
        cached[grade]=await getJSON(g.file);
        if(!Array.isArray(cached[grade])||cached[grade].length!==30)throw new Error("Incomplete cards");
      }
      state.grade=grade;state.cards=cached[grade];state.card=null;
      renderStages();show("stages");
    }catch(err){console.error(err);fail("この級の教材を読み込めませんでした。再度お試しください。");}
  }
  function renderStages(){
    var grade=state.grade, done=completed(grade);
    el("oq-level-kicker").textContent="EIKEN / "+gradeMeta(grade).approxInterviewDuration;
    el("oq-level-title").textContent=labelFor(grade);
    el("oq-level-stat").textContent=done.length+" / 30 完了";
    var groups=[
      {from:1,to:10,title:"01–10  基礎",sub:"GUIDED"},
      {from:11,to:20,title:"11–20  実践",sub:"PRACTICE"},
      {from:21,to:30,title:"21–30  模擬",sub:"MOCK"}
    ];
    el("oq-stage-groups").innerHTML=groups.map(function(group){
      return '<h2 class="band-title">'+escapeHtml(group.title)+' <span>'+group.sub+'</span></h2>'
        +'<div class="stage-grid">'+state.cards.slice(group.from-1,group.to).map(function(c){
          var doneFlag=done.includes(c.stage);
          return '<button type="button" class="stage-card" data-stage="'+c.stage+'" aria-label="Stage '+c.stage+' '+escapeHtml(c.title)+(doneFlag?" 完了済":"")+'">'
           +'<div class="stage-top"><span class="stage-num">'+String(c.stage).padStart(2,"0")+'</span>'
           +(doneFlag?'<span class="stage-done" aria-hidden="true">✓</span>':'')+'</div>'
           +'<span class="stage-title">'+escapeHtml(c.title)+'</span></button>';
        }).join("")+'</div>';
    }).join("");
  }
  function taskList(card){
    var parts=[];
    if(card.passage)parts.push({kind:"reading",title:"Reading Aloud",tag:"音読",text:card.passage.text});
    if(card.narration)parts.push({kind:"narration",title:"Picture Narration",tag:"4コマの説明",text:card.narration.prompt,models:card.narration.modelAnswers});
    card.questions.forEach(function(q){
      parts.push({kind:"question",title:"No. "+q.number,tag:"Question",text:q.prompt,models:q.modelAnswers,question:q});
    });
    return parts;
  }
  async function openStage(number){
    var card=state.cards && state.cards.find(function(c){return c.stage===number;});
    if(!card)return;
    haltAudio();
    state.card=card;state.step=0;state.responses=[];state.revealed={};state.attempted={};
    state.rubric=null;state.freeOpen=false;state.freeText="";
    show("practice");renderTask();
    var entry=state.scoringManifest&&state.scoringManifest.cards&&state.scoringManifest.cards.find(function(x){return x.cardId===card.id;});
    if(entry&&entry.rubricFile){
      try {
        var rubric=await getJSON(entry.rubricFile);
        if(state.card!==card||state.screen!=="practice")return;
        if(rubric.cardId===card.id&&rubric.imageChecked){
          state.rubric=rubric;
          if(!state.recording){if(el("oq-response"))state.responses[state.step]=el("oq-response").value;renderTask();}
        }
      }catch(error){console.warn("Image rubric unavailable",card.id,error);}
    }
  }
  function currentTask(){return taskList(state.card)[state.step];}
  function renderVisual(){
    var v=state.card.visual||{},image=v.imageSrc;
    if(image){
      return '<img class="picture-preview" src="'+escapeHtml(image)+'" alt="'+escapeHtml(state.card.title)+' の面接イラスト"'
        +' onerror="this.hidden=true;this.nextElementSibling.hidden=false">'
        +'<p class="picture-info" hidden>イラストを読み込めませんでした。画像ファイルを確認してください。</p>';
    }
    var html='<div class="picture-info">イラスト準備中 — 場面説明を使った練習です（本番の視覚条件とは異なります）。</div>';
    if(Array.isArray(v.panels)&&v.panels.length){
      html+='<div class="panel-grid'+(v.panels.length===3?" three":"")+'">';
      v.panels.forEach(function(panel){
        html+='<div class="panel"><b>Panel '+panel.number+'</b><p>'+escapeHtml(panel.description)+'</p></div>';
      });
      return html+'</div>';
    }
    return html+'<div class="placeholder-single"><b>SCENE</b><p>'+escapeHtml(v.artDirection||"Illustration pending")+'</p></div>';
  }
  function renderTask(){
    var task=currentTask(),c=state.card,steps=taskList(c),n=state.step+1,answers=state.responses;
    if(!task){finish();return;}
    el("oq-practice-kicker").textContent=labelFor(state.grade)+" / "+(c.band==="guided"?"GUIDED":c.band==="practice"?"PRACTICE":"MOCK");
    el("oq-practice-title").textContent="Stage "+String(c.stage).padStart(2,"0")+" · "+c.title;
    el("oq-step-counter").textContent=n+" / "+steps.length;
    el("oq-step-progress").style.width=(n/steps.length*100)+"%";
    var content='<div class="task-tag">'+escapeHtml(task.tag)+'</div><h2 class="task-title">'+escapeHtml(task.title)+'</h2>';
    if(task.kind==="reading"){
      content+='<p class="hint" style="margin:0 0 14px">Please read the passage aloud.</p>';
      content+='<div class="reading-text">'+escapeHtml(task.text)+'</div>';
    } else if(task.kind==="narration"){
      content+='<p class="question-text">'+escapeHtml(task.text)+'</p>';
      content+='<p class="hint">Opening: '+escapeHtml(c.storyLeadIn)+'</p>'+renderVisual();
    } else {
      if(task.question.type==="passage"){
        content+='<details style="margin-bottom:14px"><summary class="hint" style="cursor:pointer">本文を確認</summary>'
          +'<div class="reading-text" style="font-size:15px;padding:14px;margin-top:8px">'+escapeHtml(c.passage.text)+'</div></details>';
      }
      if(task.question.type.indexOf("picture")>=0 || task.question.type==="three_picture_narration"){
        if(c.storyLeadIn&&task.question.type==="three_picture_narration")content+='<p class="hint">Opening: '+escapeHtml(c.storyLeadIn)+'</p>';
        content+=renderVisual();
      }
      content+='<p class="question-text">'+escapeHtml(task.text)+'</p>';
    }
    var isRead=task.kind==="reading";
    var isNarration=task.kind==="narration";
    var prep=isRead?20:(isNarration?60:0);
    var showModel=!!state.revealed[state.step] && !isRead && task.models;
    content+='<div class="voice-box"><div class="action-row">';
    if(prep)content+='<button type="button" class="btn" data-action="prep">⏱ 準備 '+prep+'秒</button>';
    if(isRead)content+='<button type="button" class="btn" data-action="listen">▶ お手本を聞く</button>';
    if(!isRead)content+='<button type="button" class="btn" data-action="listen">▶ 質問を聞く</button>';
    content+='<button type="button" class="btn btn-record" id="oq-rec-btn" data-action="record">🎙 話す</button>';
    content+='<button type="button" class="btn btn-stop hidden" id="oq-stop-btn" data-action="stop">■ 終了</button>';
    content+='<span class="counter" id="oq-timer" aria-live="off"></span></div>';
    content+='<textarea id="oq-response" class="transcript" lang="en" spellcheck="false" aria-label="話した英語または入力した英文" placeholder="話した英語がここに表示されます。直接入力もできます。">'+escapeHtml(answers[state.step]||"")+'</textarea>';
    content+='<div class="hint" id="oq-audio-status">音声認識が使えない場合は英文を入力できます。</div>';
    var pictureQuestion=task.kind==="question" && (task.question.type.indexOf("picture")>=0 || task.question.type==="three_picture_narration");
    if(pictureQuestion && state.rubric && state.rubric.questions[String(task.question.number)]){
      content+='<div class="action-row" style="margin-top:13px"><button type="button" class="btn btn-primary" data-action="score-picture">画像内容を採点する</button></div>';
      content+='<div id="oq-image-score" aria-live="polite"></div>';
    }
    if(pictureQuestion && task.question.number===2 && state.rubric && state.rubric.freeDescription){
      content+='<div class="action-row" style="margin-top:12px"><button type="button" class="btn" data-action="free-toggle">画像全体を自由描写'+(state.freeOpen?" ▲":" ▼")+'</button></div>';
      if(state.freeOpen){
        content+='<div class="free-panel"><h3>写真の様子を自由に説明しよう</h3>';
        content+='<textarea id="oq-free-response" class="transcript" lang="en" spellcheck="false" placeholder="Describe the whole picture in English.">'+escapeHtml(state.freeText)+'</textarea>';
        content+='<div class="action-row" style="margin-top:10px"><button type="button" class="btn btn-primary" data-action="score-free">描写を採点する</button></div>';
        content+='<div id="oq-free-score" aria-live="polite"></div></div>';
      }
    }
    if(!isRead){
      content+='<div class="action-row" style="margin-top:14px"><button type="button" class="btn" data-action="model">模範解答'+(showModel?"を隠す":"を見る")+'</button></div>';
      if(showModel) content+='<div class="model"><span class="model-label">SAMPLE ANSWER</span><p>'+task.models.map(escapeHtml).join("\n\n")+'</p></div>';
    }
    content+='</div>';
    el("oq-task").innerHTML=content;
    var last=n===steps.length;
    el("oq-practice-footer").innerHTML='<button type="button" class="btn" data-action="previous" '+(state.step===0?'disabled':'')+'>‹ 前へ</button>'
      +'<button type="button" class="btn btn-primary" data-action="next">'+(last?"練習を終了":"次へ ›")+'</button>';
    window.scrollTo(0,0);
  }
  function scoreStorage(){
    try{var d=JSON.parse(localStorage.getItem(PICTURE_SCORE_KEY)||"{}");return d&&typeof d==="object"?d:{};}
    catch(_e){return {};}
  }
  function rememberPictureScore(kind,number,result){
    if(!result||result.status==="unanswered")return;
    var data=scoreStorage(),key=state.card.id+"_"+kind+(number||"");
    var old=data[key];
    if(!old||result.score>=old.score)data[key]={score:result.score,maxScore:100,kind,question:number||null};
    try{localStorage.setItem(PICTURE_SCORE_KEY,JSON.stringify(data));}catch(_e){}
  }
  function formatPictureScore(result){
    if(!result)return '';
    var facts=(result.matched||[]).map(function(f){return '<span class="score-fact">✓ '+escapeHtml(f.labelJa)+' +'+f.points+'</span>';}).join("");
    facts+=(result.missing||[]).map(function(f){return '<span class="score-fact missing">△ '+escapeHtml(f.labelJa)+'</span>';}).join("");
    var note=result.kind==="free_description"?"描写内容の一致度です。":(result.status==="matched"?"質問の目標内容を確認しました。":"伝えたい内容をもう少し具体的にしてみましょう。");
    var example=result.example||(result.examples&&result.examples[0])||"";
    return '<div class="score-box"><div class="score-head"><strong>内容一致 '+result.score+' / 100</strong><span>練習スコア</span></div>'
      +'<div class="score-facts">'+facts+'</div>'
      +'<p class="score-note">'+escapeHtml(note)+' '+escapeHtml(result.disclaimer||"公式の合否判定ではありません。")+'</p>'
      +(example?'<details style="margin-top:8px"><summary class="hint" style="cursor:pointer">模範表現を確認</summary><p class="hint">'+escapeHtml(example)+'</p></details>':'')
      +'</div>';
  }
  function runPictureScore(isFree){
    if(!state.rubric||!window.EikenPictureScoring)return;
    var task=currentTask(),engine=window.EikenPictureScoring;
    var response=isFree?(el("oq-free-response")?el("oq-free-response").value:""):(el("oq-response")?el("oq-response").value:"");
    if(!response.trim()){status("英文を話すか入力してから採点してください。",true);return;}
    var result=isFree?engine.scoreFree(state.rubric,response):engine.scoreQuestion(state.rubric,task.question.number,response);
    if(!result)return;
    rememberPictureScore(isFree?"free":"q",isFree?null:task.question.number,result);
    var target=el(isFree?"oq-free-score":"oq-image-score");
    if(target)target.innerHTML=formatPictureScore(result);
  }
  function status(message,isError){
    var node=el("oq-audio-status");
    if(node){node.textContent=message;node.style.color=isError?"#ac4330":"";}
  }
  function clearIntervalSafe(){if(state.interval!==null){clearInterval(state.interval);state.interval=null;}}
  function haltAudio(){
    clearIntervalSafe();
    if(state.recognition){
      var r=state.recognition;state.recognition=null;
      r.onend=null;r.onerror=null;r.onresult=null;
      try{r.abort();}catch(_e){}
    }
    state.recording=false;
    try{if("speechSynthesis" in window)window.speechSynthesis.cancel();}catch(_e){}
  }
  function stopRecord(){
    clearIntervalSafe();
    if(state.recognition){
      var r=state.recognition;
      state.recognition=null;
      r.onend=null;r.onerror=null;
      try{r.stop();}catch(_e){}
    }
    state.recording=false;state.attempted[state.step]=true;
    var start=el("oq-rec-btn"),stop=el("oq-stop-btn");
    if(start){start.disabled=false;start.classList.remove("hidden");}
    if(stop)stop.classList.add("hidden");
    status("回答を確認して次へ進んでください。",false);
  }
  function startRecord(){
    if(state.recording)return;
    var Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){
      status("このブラウザは音声認識に対応していません。英文を直接入力してください。",true);
      el("oq-response").focus();
      return;
    }
    try{if("speechSynthesis" in window)window.speechSynthesis.cancel();}catch(_e){}
    clearIntervalSafe();
    var recognition=new Recognition();
    recognition.lang="en-US";recognition.interimResults=true;recognition.continuous=true;recognition.maxAlternatives=1;
    state.recognition=recognition;state.recording=true;
    var step=state.step,base=(state.responses[step]||"").trim(),finalPart="";
    recognition.onresult=function(event){
      if(state.step!==step)return;
      var interim="";
      for(var i=event.resultIndex;i<event.results.length;i++){
        var text=event.results[i][0].transcript;
        if(event.results[i].isFinal)finalPart+=text+" ";else interim+=text;
      }
      var combined=[base,finalPart.trim(),interim.trim()].filter(Boolean).join(" ").trim();
      if(el("oq-response"))el("oq-response").value=combined;
      state.responses[step]=combined;state.attempted[step]=true;
    };
    recognition.onerror=function(event){
      state.recording=false;clearIntervalSafe();
      if(el("oq-rec-btn")){el("oq-rec-btn").classList.remove("hidden");el("oq-rec-btn").disabled=false;}
      if(el("oq-stop-btn"))el("oq-stop-btn").classList.add("hidden");
      status("マイクを利用できませんでした（"+(event.error||"error")+"）。直接入力できます。",true);
    };
    recognition.onend=function(){
      state.recording=false;clearIntervalSafe();state.attempted[step]=true;
      if(el("oq-rec-btn")){el("oq-rec-btn").classList.remove("hidden");el("oq-rec-btn").disabled=false;}
      if(el("oq-stop-btn"))el("oq-stop-btn").classList.add("hidden");
    };
    try {
      recognition.start();
    }catch(err){
      state.recording=false;state.recognition=null;status("音声認識を開始できません。英文を直接入力してください。",true);
      return;
    }
    el("oq-rec-btn").classList.add("hidden");el("oq-stop-btn").classList.remove("hidden");
    status("録音中 · 終わったら「終了」を押してください。",false);
    var task=currentTask(),max=task.kind==="narration" ? 120 : 0;
    if(max){
      state.seconds=0;
      el("oq-timer").textContent="0:00 / 2:00";
      state.interval=setInterval(function(){
        state.seconds++;
        var s=state.seconds;el("oq-timer").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0")+" / 2:00";
        if(s>=max)stopRecord();
      },1000);
    } else {
      state.seconds=0;el("oq-timer").textContent="";
    }
  }
  function startPrep(){
    clearIntervalSafe();
    var task=currentTask(),left=task.kind==="narration"?60:20;
    var timer=el("oq-timer");timer.textContent="準備 "+left+"秒";
    state.interval=setInterval(function(){
      left--;
      if(timer)timer.textContent=left>0?"準備 "+left+"秒":"準備終了";
      if(left<=0)clearIntervalSafe();
    },1000);
  }
  function speak(text){
    if(!("speechSynthesis" in window)){status("このブラウザでは読み上げを利用できません。",true);return;}
    try{
      window.speechSynthesis.cancel();
      var phrase=new SpeechSynthesisUtterance(text);
      phrase.lang="en-US";phrase.rate=.88;phrase.pitch=1;
      var voices=window.speechSynthesis.getVoices();
      var voice=voices.find(function(v){return /^en-US/i.test(v.lang);})||voices.find(function(v){return /^en/i.test(v.lang);});
      if(voice)phrase.voice=voice;
      window.speechSynthesis.speak(phrase);
    }catch(err){status("読み上げを開始できません。",true);}
  }
  function goStep(direction){
    if(state.recording)stopRecord();
    haltAudio();
    if(el("oq-response"))state.responses[state.step]=el("oq-response").value.trim();
    var next=state.step+direction,items=taskList(state.card);
    if(next<0)return;
    if(next>=items.length){finish();return;}
    state.step=next;renderTask();
  }
  function finish(){
    haltAudio();
    markCompleted(state.grade,state.card.stage);
    var c=state.card;
    show("finished");el("oq-back").classList.remove("hidden");
    var scores=scoreStorage(),keys=Object.keys(scores).filter(function(k){return k.indexOf(c.id+"_")===0;});
    var top=keys.length?Math.max.apply(null,keys.map(function(k){return scores[k].score;})):null;
    var resultLine=top===null?"":'<p class="practice-points">今回の画像内容一致スコア（最高）：'+top+' / 100</p>';
    el("oq-finished").innerHTML='<div class="finish-card"><div class="finish-icon" aria-hidden="true">✓</div>'
      +'<p class="eyebrow">'+escapeHtml(labelFor(state.grade))+' / STAGE '+String(c.stage).padStart(2,"0")+'</p>'
      +'<h2>練習完了</h2>'+resultLine
      +'<p>最後まで練習しました。回答内容を振り返り、もう一度話してみましょう。<br>ここでの完了は英検の合否判定ではありません。</p>'
      +'<div class="action-row" style="justify-content:center">'
      +'<button type="button" class="btn" data-action="retry">もう一度</button>'
      +'<button type="button" class="btn btn-primary" data-action="return">30ステージへ</button>'
      +(c.stage<30?'<button type="button" class="btn" data-action="next-stage">次のステージ ›</button>':'')
      +'</div></div>';
  }
  function back(){
    haltAudio();
    if(state.screen==="practice"||state.screen==="finished"){renderStages();show("stages");}
    else if(state.screen==="stages"){renderGrades();show("grades");}
    else window.location.href="play.html";
  }
  document.addEventListener("click",function(event){
    var gradeButton=event.target.closest("[data-grade]");
    if(gradeButton){openGrade(gradeButton.getAttribute("data-grade"));return;}
    var stageButton=event.target.closest("[data-stage]");
    if(stageButton){openStage(Number(stageButton.getAttribute("data-stage")));return;}
    var actionButton=event.target.closest("[data-action]");
    if(!actionButton)return;
    var action=actionButton.getAttribute("data-action");
    if(action==="back"){back();return;}
    if(action==="return"){renderStages();show("stages");return;}
    if(action==="retry"){openStage(state.card.stage);return;}
    if(action==="next-stage"){openStage(state.card.stage+1);return;}
    if(state.screen!=="practice")return;
    if(action==="record"){startRecord();return;}
    if(action==="stop"){stopRecord();return;}
    if(action==="prep"){startPrep();return;}
    if(action==="listen"){var task=currentTask();speak(task.kind==="reading"?task.text:task.text);return;}
    if(action==="previous"){goStep(-1);return;}
    if(action==="next"){goStep(1);return;}
    if(action==="score-picture"){runPictureScore(false);return;}
    if(action==="score-free"){state.freeText=el("oq-free-response")?el("oq-free-response").value:state.freeText;runPictureScore(true);return;}
    if(action==="free-toggle"){
      if(el("oq-response"))state.responses[state.step]=el("oq-response").value;
      if(el("oq-free-response"))state.freeText=el("oq-free-response").value;
      state.freeOpen=!state.freeOpen;renderTask();return;
    }
    if(action==="model"){
      var t=currentTask(),band=state.card.band;
      if((band==="practice"||band==="mock") && !(state.attempted[state.step]||(state.responses[state.step]||"").trim())){
        status("先に自分の英語で答えてから確認しましょう。",true);
        el("oq-response").focus();return;
      }
      state.revealed[state.step]=!state.revealed[state.step];
      renderTask();return;
    }
  });
  el("oq-back").addEventListener("click",back);
  document.addEventListener("input",function(event){
    if(event.target && event.target.id==="oq-free-response" && state.screen==="practice"){
      state.freeText=event.target.value;
    }
    if(event.target && event.target.id==="oq-response" && state.screen==="practice"){
      state.responses[state.step]=event.target.value;
      if(event.target.value.trim())state.attempted[state.step]=true;
    }
  });
  window.addEventListener("pagehide",haltAudio);
  document.addEventListener("visibilitychange",function(){if(document.hidden){if(state.recording)stopRecord();else haltAudio();}});
  init();
})();
