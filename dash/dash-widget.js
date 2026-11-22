/* Dash Navigation — lightweight shared voice launcher, based on VocaDash's compact particle orb.
 * Install with <link rel="stylesheet" href="dash/dash-widget.css">
 * and <script src="dash/dash-widget.js" data-dash-app="picspeak" defer></script>.
 * Tap to start one-shot recognition; microphone is never active by default.
 */
(function () {
  'use strict';
  var scriptTag = document.currentScript;
  var currentApp = (scriptTag && scriptTag.getAttribute('data-dash-app')) || '';
  var routes = [
    { id: 'picspeak', label: 'PicSpeak', url: 'https://www.pic-speak-story.com/', aliases: ['picspeak', 'pic speak', 'pic speak story'] },
    { id: 'copeak', label: 'Copeak', url: 'https://copeak.pic-speak-story.com/', aliases: ['copeak', 'co peak', 'copique'] },
    { id: 'poweron', label: 'PowerOn', url: 'https://nakacy0919-git.github.io/poweron/', aliases: ['poweron', 'power on', 'power on 3', 'power on three'] },
    { id: 'similar-photo', label: 'Similar Photo', url: 'https://similar-photo.com/', aliases: ['similar photo', 'similar photo party', 'similar photos'] },
    { id: 'vocadash', label: 'VocaDash', url: 'https://vocadash.pic-speak-story.com/', aliases: ['vocadash', 'voca dash', 'vocabulary dash', 'vocab dash'] }
  ];
  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function parseCommand(spoken) {
    var message = normalize(spoken).replace(/^(?:hey\s+)?dash(?:\s+assistant)?\s*/, '').trim();
    var match = message.match(/^(?:(?:switch|change|go|back|return)\s+(?:over\s+)?to|open|launch)\s+(.+)$/);
    if (!match) return null;
    var name = match[1].replace(/\s+(?:please|now)$/, '').trim();
    return routes.find(function (route) { return route.aliases.indexOf(name) !== -1; }) || null;
  }
  // Expose the parser for inexpensive smoke tests, without altering any other application's APIs.
  window.DashNavigation = { parseCommand: parseCommand, routes: routes.map(function (r) { return { id: r.id, label: r.label, url: r.url }; }) };
  function mount() {
    if (document.getElementById('dash-nav-widget')) return;
    var root = document.createElement('aside');
    root.id = 'dash-nav-widget';
    root.className = 'dash-nav-widget';
    root.setAttribute('aria-label', 'Dash voice navigation');
    root.innerHTML = '<button class="dash-nav-orb" type="button" aria-label="Dashの音声操作を開始" aria-expanded="false" aria-controls="dash-nav-panel" title="Dash · タップして話す">' +
      '<canvas class="dash-nav-canvas" width="64" height="64" aria-hidden="true"></canvas>' +
      '<span class="dash-nav-orb-name">Dash</span></button>' +
      '<section class="dash-nav-panel" id="dash-nav-panel" aria-label="Dash assistant" hidden>' +
      '<div class="dash-nav-header"><strong>Dash Assistant</strong><button class="dash-nav-close" type="button" aria-label="閉じる">×</button></div>' +
      '<p class="dash-nav-status" role="status" aria-live="polite">Switch to Copeak などと話してください。</p>' +
      '<p class="dash-nav-transcript" aria-live="polite" hidden></p>' +
      '<div class="dash-nav-links" aria-label="タップでアプリを開く"></div>' +
      '<button class="dash-nav-retry" type="button">もう一度話す</button></section>';
    document.body.appendChild(root);
    var orb = root.querySelector('.dash-nav-orb');
    var panel = root.querySelector('.dash-nav-panel');
    var status = root.querySelector('.dash-nav-status');
    var transcript = root.querySelector('.dash-nav-transcript');
    var links = root.querySelector('.dash-nav-links');
    var retry = root.querySelector('.dash-nav-retry');
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recognition = null;
    var listening = false;
    var finished = false;
    routes.forEach(function (route) {
      var a = document.createElement('a');
      a.className = 'dash-nav-link';
      a.href = route.url;
      a.textContent = route.label;
      if (route.id === currentApp) {
        a.setAttribute('aria-current', 'page');
      }
      links.appendChild(a);
    });
    function setStatus(message) { status.textContent = message; }
    function clearRecognition() {
      var r = recognition;
      recognition = null;
      listening = false;
      root.classList.remove('dash-nav-listening');
      orb.setAttribute('aria-label', 'Dashの音声操作を開始');
      if (r) { try { r.abort(); } catch (_) {} }
    }
    function closePanel() {
      clearRecognition();
      panel.hidden = true;
      orb.setAttribute('aria-expanded', 'false');
    }
    function navigate(route) {
      clearRecognition();
      if (route.id === currentApp) {
        setStatus('現在 ' + route.label + ' を開いています。');
        return;
      }
      setStatus(route.label + ' を開きます…');
      window.location.assign(route.url);
    }
    function startListening() {
      clearRecognition();
      panel.hidden = false;
      orb.setAttribute('aria-expanded', 'true');
      transcript.hidden = true;
      transcript.textContent = '';
      if (!Recognition) {
        setStatus('このブラウザでは音声認識を利用できません。下のアプリ名をタップしてください。');
        return;
      }
      var r = new Recognition();
      recognition = r;
      finished = false;
      r.lang = 'en-US';
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onstart = function () {
        if (recognition !== r) return;
        listening = true;
        root.classList.add('dash-nav-listening');
        orb.setAttribute('aria-label', 'Dashの音声認識中');
        setStatus('Listening… “Switch to Copeak”');
      };
      r.onresult = function (event) {
        if (recognition !== r) return;
        var spoken = '';
        var final = false;
        for (var i = event.resultIndex; i < event.results.length; i++) {
          spoken += event.results[i][0].transcript + ' ';
          if (event.results[i].isFinal) final = true;
        }
        spoken = spoken.trim();
        transcript.textContent = spoken;
        transcript.hidden = !spoken;
        if (!final || finished) return;
        finished = true;
        var route = parseCommand(spoken);
        if (route) {
          navigate(route);
        } else {
          setStatus('切り替え先が分かりませんでした。例: Switch to PicSpeak');
        }
      };
      r.onerror = function (event) {
        if (recognition !== r || event.error === 'aborted') return;
        finished = true;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setStatus('マイクの使用を許可してください。下のボタンからも移動できます。');
        } else if (event.error === 'no-speech') {
          setStatus('音声を聞き取れませんでした。もう一度お試しください。');
        } else {
          setStatus('音声認識を開始できません。ほかの音読認識を停止して再試行してください。');
        }
      };
      r.onend = function () {
        if (recognition !== r) return;
        recognition = null;
        listening = false;
        root.classList.remove('dash-nav-listening');
        orb.setAttribute('aria-label', 'Dashの音声操作を開始');
        if (!finished) setStatus('音声認識が終了しました。もう一度話すことができます。');
      };
      try { r.start(); } catch (_) {
        recognition = null;
        setStatus('音声認識を開始できません。ほかのマイク利用を停止して再試行してください。');
      }
    }
    orb.addEventListener('click', function () {
      if (listening) { clearRecognition(); setStatus('音声認識を停止しました。'); return; }
      startListening();
    });
    retry.addEventListener('click', startListening);
    root.querySelector('.dash-nav-close').addEventListener('click', closePanel);
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearRecognition(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) closePanel(); });

    // Compact particle sphere: same five-arm / golden-angle particle geometry as VocaDash's VoiceOrb.
    var canvas = root.querySelector('.dash-nav-canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var points = Array.from({ length: 140 }, function (_, i) {
      var index = Math.floor(i * 960 / 140);
      var t = (index + .5) / 960;
      return { arm: index % 5, h: 1 - 2 * t, angle: index * 2.39996323, radius: .76 + .23 * ((index * 73 % 97) / 97), weight: .45 + (index % 7) * .14 };
    });
    var rotation = 0, last = 0, drawn = 0;
    function paint(now) {
      requestAnimationFrame(paint);
      if (document.hidden || (!listening && now - drawn < 60) || (listening && now - drawn < 25)) return;
      drawn = now;
      var size = Math.max(48, canvas.getBoundingClientRect().width || 64);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var pixels = Math.round(size * dpr);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      var cx = size / 2, cy = size / 2, base = size * .40;
      var energy = listening ? .62 + .25 * Math.sin(now * .009) : .10;
      var dt = last ? Math.min(70, now - last) : 16;
      last = now;
      if (!reduce) rotation += dt * .00024 * (1 + energy * 2.8);
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.2);
      glow.addColorStop(0, 'rgba(111,176,255,' + (.18 + energy * .23) + ')');
      glow.addColorStop(.45, 'rgba(76,81,228,.13)');
      glow.addColorStop(1, 'rgba(45,56,170,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < points.length; i++) {
        var p = points[i], a = p.angle + rotation, shell = Math.sqrt(1 - p.h * p.h);
        var wave = reduce ? 0 : Math.sin(a * 3 + now * .005 + i * .08) * energy * .08;
        var radius = base * (p.radius + wave) * (1 + energy * .12);
        var z = Math.sin(a) * shell;
        var yy = p.h * Math.cos(.34) - z * Math.sin(.34);
        var depth = p.h * Math.sin(.34) + z * Math.cos(.34);
        var perspective = 1 / (1 - .17 * depth);
        var x = cx + Math.cos(a) * shell * radius * perspective;
        var y = cy + yy * radius * perspective;
        var hue = [188, 199, 207, 223, 256][p.arm];
        var dotSize = Math.max(.45, .75 * p.weight * perspective * (1 + energy * .7));
        ctx.fillStyle = 'hsla(' + hue + ',95%,' + (63 + energy * 22) + '%,' + (.22 + (depth + 1) * .26 + energy * .18) + ')';
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(paint);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
