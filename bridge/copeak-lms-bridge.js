/* PicSpeak <-> Copeak Classroom bridge. Only activated with an issued launch token.
   No existing PicSpeak game logic is modified. Scores are browser-generated and unverified. */
(() => {
  const hash=new URLSearchParams(location.hash.slice(1));
  const assignment=hash.get('copeak_assignment');
  if(!assignment)return;
  const parentOrigin=hash.get('copeak_origin');
  let token=null;
  const mode=hash.get('copeak_mode'),content=hash.get('copeak_content'),level=hash.get('copeak_level');
  const seconds=Number(hash.get('copeak_time'));
  const expected={snapshot:'play.html',mosaic:'play.html',detective:'play.html',oralquest:'play.html',story:'story.html',picflash:'picflash.html'};
  // Remove the nonsecret launch hint from browser history at startup.
  history.replaceState(history.state,'',location.pathname+location.search);
  const ENDPOINT='https://sxcbudhcxiblpdzpgfep.supabase.co/rest/v1/rpc/picspeak_finish_attempt_v3';
  const API_KEY='sb_publishable_X01jWRkXutwwxhFAud3VwA_UGAYw05l'; // public, NOT service_role
  const cacheKey='copeak-picspeak-pending-v1';
  const VALID_ID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  let runCount=0, lastFinished=0, banner;
  const num=(v,max=100)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):null;};
  const round=n=>n==null?null:Math.round(n*100)/100;
  function notice(message,error=false){
    if(!banner){banner=document.createElement('aside');banner.setAttribute('role','status');banner.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483646;padding:11px 13px;border-radius:11px;color:white;font:700 13px/1.6 system-ui;box-shadow:0 4px 18px #0003;text-align:center';document.body.append(banner);}
    banner.style.background=error?'#a51e38':'#1c4d98';banner.replaceChildren(document.createTextNode('Copeak Classroom · '+message));
  }
  if(!VALID_ID.test(assignment)||!parentOrigin||!/^https?:\/\/[^/]+$/.test(parentOrigin)||!expected[mode]||!(mode==='picflash'?[3,5,10,30,45,60]:[30,45,60]).includes(seconds)||!location.pathname.endsWith(expected[mode])){
    notice('課題リンクが無効です。Classroomから起動し直してください。',true);return;
  }
  const uuid=()=>crypto.randomUUID();
  const wait=async(pred,tries=75)=>{for(let i=0;i<tries;i++){if(pred())return true;await new Promise(r=>setTimeout(r,200));}return false;};
  async function request(payload){
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':API_KEY},body:JSON.stringify(payload),cache:'no-store',referrerPolicy:'no-referrer'});
    if(!res.ok){const err=await res.text();throw Error('送信エラー HTTP '+res.status+' '+err.slice(0,160));}
    return res.json();
  }
  function pending(){try{const x=JSON.parse(sessionStorage.getItem(cacheKey)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
  function setPending(x){try{sessionStorage.setItem(cacheKey,JSON.stringify(x.slice(-10)));}catch{}}
  async function retry(){const keep=[];for(const item of pending()){
      if(item.p_token!==token){keep.push(item);continue;}
      try{await request(item);}catch{keep.push(item);}
    }setPending(keep);
    if(keep.some(x=>x.p_token===token))notice('未送信の記録があります。通信環境を確認して再度この課題を開いてください。',true);
  }
  async function save(result){
    const now=Date.now();if(now-lastFinished<1300)return;lastFinished=now;
    const payload={p_token:token,p_run_id:uuid(),p_score_raw:result.score_raw??null,p_score_percent:result.score_percent??null,
      p_completion_percent:result.completion_percent??null,p_wpm:result.wpm??null,
      p_word_count:result.word_count??null,p_duration_seconds:result.duration_seconds??null,p_metrics:result.metrics??{}};
    runCount++;
    try{await request(payload);notice('結果を保存しました（'+runCount+'回）。Classroomに戻ると成績を確認できます。');}
    catch(e){const x=pending();x.push(payload);setPending(x);notice('送信に失敗したため、このタブに結果を一時保存しました。再送が必要です。',true);console.warn('PicSpeak attempt sync failed',e);}
  }
  function pictureResult(){
    const words=num(document.getElementById('wordCountDisplay')?.textContent,10000)||0;
    const sec=num(window.timeElapsed,36000);
    const wpm=sec&&sec>0?round(Math.min(1000,words*60/sec)):null;
    let completion=null;
    try{completion=num(window.getCompletionStats?.(window.currentTheme,level)?.completionRate);}catch{}
    if(mode==='detective'){
      const found=window.DetectiveGame?.foundIds?.size||0;
      const total=Number(window.currentTheme?.totalDifferences)||0;
      const score=total>0?round(num(100*found/total)):0;
      return {score_raw:found,score_percent:score,completion_percent:score,word_count:words,wpm,duration_seconds:sec,metrics:{found,total}};
    }
    if(mode==='mosaic'){
      const target=Number(window.MosaicGame?.targetWords)||50;
      const score=round(num(words/target*100));
      return {score_raw:num(document.getElementById('scoreDisplay')?.textContent,1000000),score_percent:round(completion??score),completion_percent:round(completion??score),word_count:words,wpm,duration_seconds:sec};
    }
    if(mode==='oralquest'){
      const q=window.OralQuestGame;
      const reading=num(q?.lmsReadingAccuracy),picture=num(q?.lmsPictureCompletion);
      const qa1=num(q?.lmsQA1Rating,2),qa2=num(q?.lmsQA2Rating,2);
      if(!q?.lmsFinished || reading==null || picture==null || qa1==null || qa2==null){
        notice('ORAL QUESTの段階別成績を取得できませんでした。',true);return null;
      }
      const mean=round((reading+picture)/2);
      const oralWpm=num(q?.lmsReadingWpm,1000);
      return {score_raw:null,score_percent:mean,completion_percent:picture,
        wpm:oralWpm,word_count:num(q?.lmsTotalWords,10000),duration_seconds:null,
        metrics:{reading_accuracy:reading,picture_completion:picture,qa1_rating:qa1,qa2_rating:qa2,stages_completed:3}};
    }
    const completionPct=round(completion??0);
    // PicSpeak Score is a raw game-point value, NOT an accuracy/percentage.
    const displayScore=num(document.getElementById('scoreDisplay')?.textContent,1000000);
    return {score_raw:displayScore,score_percent:completionPct,completion_percent:completionPct,word_count:words,wpm,duration_seconds:sec};
  }
  function storyResult(){
    const state=window.storyState;const scenes=state?.currentStory?.scenes||[];
    let hits=0,targets=0,words=0;
    scenes.forEach((scene,i)=>{
      const lev=scene.levels?.[level]||scene;
      const transcript=String(state?.retellingTranscripts?.[i]||'').toLowerCase().replace(/[.,!?]/g,' ');
      const spoken=new Set(transcript.split(/\s+/).filter(Boolean));words+=transcript.split(/\s+/).filter(Boolean).length;
      for(const target of lev.targets||[]){targets++;
        const keys=target.keywords?.length?target.keywords:String(target.text||'').toLowerCase().replace(/[.,!?]/g,' ').split(/\s+/).filter(w=>w.length>2);
        if(keys.some(k=>spoken.has(String(k).toLowerCase())))hits++;
      }
    });
    const score=targets?round(num(hits/targets*100)):0;
    const sec=Number(window.pssSettings?.retellingTime||20)*scenes.length;
    return {score_raw:null,score_percent:score,completion_percent:score,word_count:words,wpm:sec?round(num(words*60/sec,1000)):null,duration_seconds:sec,metrics:{targets_found:hits,targets_total:targets,scenes_completed:scenes.length}};
  }
  function flashResult(){
    const stats=window.PicFlashLmsStats;
    if(!stats || stats.category!==content || stats.mode!=='trial' ||
       stats.total!==10 || stats.languages?.length!==1 || stats.languages[0]!=='en-US' ||
       !Number.isInteger(stats.correct) || !Number.isInteger(stats.skipped) ||
       stats.correct<0 || stats.skipped<0 || stats.correct+stats.skipped!==10){
      notice('PIC FLASHの10問・英語チャレンジ結果を検証できません。',true);return null;
    }
    const sec=num(stats.time,36000);
    if(sec==null || sec<=0)return null;
    const rate=stats.correct*10;
    return {score_percent:rate,completion_percent:rate,word_count:null,wpm:null,
      duration_seconds:round(sec),metrics:{correct:stats.correct,skipped:stats.skipped,
        total:10,language:'en-US',trial:true}};
  }
  function wrap(name,toResult){const original=window[name];if(typeof original!=='function')throw Error(name+' が見つかりません。');
    window[name]=function(...args){const out=original.apply(this,args);try{const result=toResult();if(result)void save(result);}catch(e){notice('結果の計測に失敗しました。',true);console.error(e);}return out;};
  }
  async function boot(){
    await retry();notice('課題と連携中です。終了後、成績を自動で送信します。');
    if(mode==='story'){
      if(!await wait(()=>window.storyList?.some(x=>String(x.id)===content)))throw Error('ストーリー教材がありません。');
      wrap('finishStoryRetelling',storyResult);
      window.setStoryLevel?.(level);window.pssSettings.retellingTime=seconds;window.storyState.currentStoryId=content;
      window.selectStoryMode?.('retelling');
    }else if(mode==='picflash'){
      if(!await wait(()=>window.CATEGORIES_DATA?.length&&document.querySelectorAll('#pf-category-grid button').length))throw Error('カテゴリがありません。');
      wrap('endPfGame',flashResult);
      const en=document.querySelector('.pf-lang-cb[value="en-US"]');
      if(en){document.querySelectorAll('.pf-lang-cb:checked').forEach(e=>{e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});en.checked=true;en.dispatchEvent(new Event('change',{bubbles:true}));}
      document.querySelector('.pf-mode-btn[data-mode="trial"]')?.click();
      document.querySelector('.pf-count-btn[data-count="10"]')?.click();
      const perCard=({30:3,45:5,60:10})[seconds]||seconds;
      const timerButton=document.querySelector('.pf-time-btn[data-time="'+perCard+'"]');
      if(!timerButton)throw Error('PIC FLASH timer option missing');
      timerButton.click();
      const index=window.CATEGORIES_DATA.findIndex(x=>x.id===content);
      if(index<0)throw Error('カテゴリIDがありません。');
      document.querySelectorAll('#pf-category-grid button')[index]?.click();
    }else{
      if(!await wait(()=>typeof window.finishGameAndShowResult==='function'&&typeof window.startGameWithTheme==='function'&&window.appState))throw Error('PicSpeakの初期化が終わりません。');
      // ORAL QUEST uses its own final-result method; the normal picture
      // game finish callback is not fired for this mode.
      if(mode==='oralquest'){
        const quest=window.OralQuestGame;
        if(!quest||typeof quest.showFinalResult!=='function') throw Error('ORAL QUESTの終了処理が見つかりません。');
        const originalFinish=quest.showFinalResult;
        quest.showFinalResult=function(...args){
          const response=originalFinish.apply(this,args);
          try{const result=pictureResult();if(result)void save(result);}
          catch(e){notice('ORAL QUESTの結果取得に失敗しました。',true);console.error(e);}
          return response;
        };
      }else{
        wrap('finishGameAndShowResult',pictureResult);
      }
      window.appState.selectedMode=mode;window.appState.selectedLevel=level;
      window.appState.customTimeLimit=seconds;
      window.tempSelectedThemeId=content;
      if(mode==='oralquest')await new Promise(r=>setTimeout(r,650));
      await window.startGameWithTheme(content);
    }
  }
  // The launch token is never included in the URL. Request it from the exact
  // Classroom tab that opened us, and validate the sender origin and window.
  let started=false, readyTimer;
  function askParent(){
    if(!window.opener){notice('Classroomとの接続がありません。Classroomから再度起動してください。',true);return;}
    window.opener.postMessage({type:'copeak-picspeak-ready',assignment_id:assignment},parentOrigin);
  }
  window.addEventListener('message',event=>{
    if(started||event.origin!==parentOrigin||event.source!==window.opener)return;
    const value=event.data;
    if(value?.type!=='copeak-picspeak-launch'||value.assignment_id!==assignment||!(/^[a-f0-9]{64}$/.test(value.token||'')))return;
    started=true;token=value.token;window.clearInterval(readyTimer);
    window.opener.postMessage({type:'copeak-picspeak-ack',assignment_id:assignment},parentOrigin);
    void boot().catch(e=>{notice('課題の開始に失敗しました: '+(e.message||String(e)),true);console.error(e);});
  });
  askParent();
  readyTimer=window.setInterval(()=>{if(!started)askParent();},1300);
  window.setTimeout(()=>{if(!started){window.clearInterval(readyTimer);notice('Classroomの認証がタイムアウトしました。',true);}},30000);
})();
