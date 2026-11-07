/* Original Eiken oral-picture content matcher. Not an official exam/CEFR score.
   Deterministic local matching against teacher-reviewed image facts. */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.EikenPictureScoring=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  function normalize(raw){
    return String(raw||"").toLowerCase()
      .replace(/\b(she|he|it|there|that)'s\b/g,"$1 is")
      .replace(/\bthey're\b/g,"they are")
      .replace(/\b(can't|cannot)\b/g,"can not")
      .replace(/\b(isn't|aren't|don't|doesn't|didn't|wasn't|weren't)\b/g,"not")
      .replace(/\bthree\b/g,"3")
      .replace(/[’]/g,"'")
      .replace(/[^a-z0-9\s'-]/g," ")
      .replace(/[-]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }
  function clauses(raw){
    var s=String(raw||"")
      .replace(/\s+\b(?:and|while|whereas|but)\b\s+(?=(?:a|an|the|he|she|they|it|there|one|another)\b)/gi,". ")
      .replace(/,\s*(?=(?:and\s+)?(?:a|an|the|he|she|they|it|there|one|another)\b)/gi,". ")
      .split(/[.!?;]+/);
    return s.map(normalize).filter(Boolean);
  }
  function containsPhrase(segment,phrase){
    var normalized=normalize(phrase);
    return !!normalized && (" "+segment+" ").includes(" "+normalized+" ");
  }
  function includesAny(segment,aliases){
    return Array.isArray(aliases)&&aliases.some(function(a){return containsPhrase(segment,a);});
  }
  function safeSegment(segment, rejects){
    if(/\b(?:not|never|isnt|no longer|without)\b/.test(segment))return false;
    return !includesAny(segment,rejects||[]);
  }
  function matchesGroups(segment,rule){
    if(!rule||!Array.isArray(rule.all)||!rule.all.length)return false;
    if(!safeSegment(segment,rule.rejectExpressions))return false;
    return rule.all.every(function(aliases){return includesAny(segment,aliases);});
  }
  function ruleHit(text,rules,validator){
    var pieces=clauses(text);
    return (rules||[]).some(function(rule){return pieces.some(function(segment){
      return matchesGroups(segment,rule)&&(!validator||validator(segment));
    });});
  }
  function roundPoints(n){return Math.max(0,Math.min(100,Math.round(n)));}
  function scoreFree(rubric,text){
    if(!rubric||!rubric.freeDescription||!rubric.imageChecked)return null;
    var facts=rubric.freeDescription.facts||[];
    var matched=[],missed=[],points=0;
    facts.forEach(function(fact){
      if(ruleHit(text,fact.checks)){points+=fact.points;matched.push({id:fact.id,labelJa:fact.labelJa,points:fact.points});}
      else missed.push({id:fact.id,labelJa:fact.labelJa,points:fact.points});
    });
    var hasAnswer=normalize(text).length>0;
    return {score:hasAnswer?roundPoints(points):0,maxScore:100,matched:matched,missing:missed,
      kind:"free_description",practiceOnly:true,status:!hasAnswer?"unanswered":matched.length?"evaluated":"needs_review",
      example:rubric.freeDescription.example,disclaimer:"画像内容の単語・言い換え表現の一致目安。文法・発音・実際の英検採点ではありません。"};
  }
  function scoreQuestion(rubric,number,text){
    var data=rubric&&rubric.questions&&rubric.questions[String(number)];
    if(!rubric||!rubric.imageChecked||!data)return null;
    if(!normalize(text))return {score:0,maxScore:100,kind:"picture_question",practiceOnly:true,status:"unanswered",labelJa:data.labelJa,examples:data.examples||[]};
    var wrongRole=data.rejectIfOnlyWrongRole||[];
    var rightRole=data.rightRole||[];
    var validate=function(segment){
      if(!safeSegment(segment,data.rejectExpressions))return false;
      if(wrongRole.length&&includesAny(segment,wrongRole)&&(!rightRole.length||!includesAny(segment,rightRole)))return false;
      return true;
    };
    var full=ruleHit(text,data.full,validate);
    var partial=!full&&ruleHit(text,data.partial,validate);
    var score=full?100:partial?55:0;
    return {score,maxScore:100,kind:"picture_question",practiceOnly:true,status:full?"matched":partial?"partial":"needs_review",
      labelJa:data.labelJa,examples:data.examples||[],matched:full,partial:partial,
      disclaimer:"画像内容に対応する語句・言い換えの一致度。公式採点・意味理解の保証ではありません。"};
  }
  return {normalize,clauses,scoreFree,scoreQuestion};
});
