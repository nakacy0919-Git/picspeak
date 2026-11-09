(function () {
  'use strict';

  // Home page sharing: render the QR locally, never send a page URL to a QR API.
  const style = document.createElement('style');
  style.textContent = `
    .site-qr-trigger {
      display:inline-flex; align-items:center; justify-content:center;
      width:44px; height:44px; min-width:44px; flex:0 0 44px;
      padding:0; border:1px solid #d8e3de; border-radius:14px;
      color:#315c50; background:linear-gradient(145deg,#fff,#edf6f1);
      box-shadow:0 3px 10px rgba(24,54,45,.08); cursor:pointer;
      transition:transform .16s ease, box-shadow .16s ease;
      touch-action:manipulation;
    }
    .site-qr-trigger:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(24,54,45,.14); }
    .site-qr-trigger:focus-visible { outline:3px solid #4e9c7f; outline-offset:3px; }
    .site-qr-trigger svg { width:21px; height:21px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    #site-qr-dialog {
      position:fixed; inset:0; margin:auto; width:min(368px,calc(100vw - 28px));
      max-height:calc(100dvh - 24px); overflow-y:auto;
      border:1px solid #e1e9e5; border-radius:22px; padding:0;
      background:#fff; color:#223a33; box-shadow:0 26px 90px rgba(9,29,22,.28);
      font-family:system-ui,-apple-system,'Noto Sans JP',sans-serif;
      z-index:2147483646;
    }
    #site-qr-dialog::backdrop { background:rgba(12,29,25,.55); backdrop-filter:blur(4px); }
    #site-qr-dialog .sqr-body { padding:24px; text-align:center; }
    #site-qr-dialog .sqr-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:5px; }
    #site-qr-dialog .sqr-title { font-size:19px; font-weight:800; margin:0; letter-spacing:.01em; }
    #site-qr-dialog .sqr-close { width:36px; height:36px; border:0; border-radius:11px; background:#eff4f1; color:#37554a; font-size:24px; line-height:1; cursor:pointer; }
    #site-qr-dialog .sqr-desc { margin:9px 0 18px; color:#66756e; font-size:13px; line-height:1.6; }
    #site-qr-dialog .sqr-qr { display:flex; align-items:center; justify-content:center; width:236px; height:236px; max-width:100%; margin:0 auto 15px; padding:14px; border:1px solid #e7eee9; border-radius:17px; background:white; }
    #site-qr-dialog .sqr-qr img, #site-qr-dialog .sqr-qr canvas { width:208px!important; height:208px!important; max-width:100%; object-fit:contain; image-rendering:pixelated; }
    #site-qr-dialog .sqr-qr .sqr-status { font-size:13px; color:#60736a; line-height:1.5; }
    #site-qr-dialog .sqr-url { display:block; overflow-wrap:anywhere; font-size:11px; color:#557568; margin:0 auto 15px; text-decoration:none; }
    #site-qr-dialog .sqr-copy { width:100%; border:0; border-radius:13px; background:linear-gradient(135deg,#2d6655,#3d8b76); color:white; padding:12px 16px; font-size:14px; font-weight:750; cursor:pointer; }
    #site-qr-dialog button:focus-visible, #site-qr-dialog a:focus-visible { outline:3px solid #65a892; outline-offset:3px; }
    @media (prefers-reduced-motion:reduce) { .site-qr-trigger { transition:none; } }
  `;
  document.head.appendChild(style);

  const libraryUrls = [
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
    'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
  ];
  let libraryPromise;
  function loadLibrary() {
    if (typeof window.QRCode === 'function') return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      let index = 0;
      function next() {
        if (index >= libraryUrls.length) { reject(new Error('QR library unavailable')); return; }
        const tag = document.createElement('script');
        tag.src = libraryUrls[index++];
        tag.async = true;
        tag.onload = () => {
          if (typeof window.QRCode === 'function') resolve();
          else { tag.remove(); next(); }
        };
        tag.onerror = () => { tag.remove(); next(); };
        document.head.appendChild(tag);
      }
      next();
    }).catch(error => { libraryPromise = null; throw error; });
    return libraryPromise;
  }

  let dialog;
  let previousFocus;
  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'site-qr-dialog';
    dialog.setAttribute('aria-labelledby', 'site-qr-title');
    dialog.innerHTML = `
      <div class="sqr-body">
        <div class="sqr-head">
          <h2 class="sqr-title" id="site-qr-title">QRコードで共有</h2>
          <button type="button" class="sqr-close" aria-label="閉じる" title="閉じる">×</button>
        </div>
        <p class="sqr-desc">カメラで読み取ると、このページが開きます。<br>Scan to open this page.</p>
        <div class="sqr-qr" role="img" aria-label="このページへのQRコード"><span class="sqr-status">QRコードを準備しています…</span></div>
        <a class="sqr-url" target="_blank" rel="noopener noreferrer"></a>
        <button type="button" class="sqr-copy">リンクをコピー</button>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.sqr-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    });
    return dialog;
  }

  async function openQR(trigger) {
    const pageUrl = window.location.origin + window.location.pathname;
    if (!/^https?:\/\//.test(pageUrl)) return;
    previousFocus = trigger;
    const panel = getDialog();
    const holder = panel.querySelector('.sqr-qr');
    const url = panel.querySelector('.sqr-url');
    const copy = panel.querySelector('.sqr-copy');
    url.href = pageUrl;
    url.textContent = pageUrl;
    copy.textContent = 'リンクをコピー';
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pageUrl);
        copy.textContent = 'コピーしました ✓';
      } catch (error) {
        copy.textContent = '上のURLを長押ししてコピー';
      }
    };
    holder.innerHTML = '<span class="sqr-status">QRコードを準備しています…</span>';
    if (!panel.open) panel.showModal();
    try {
      await loadLibrary();
      if (!panel.open) return;
      holder.textContent = '';
      new window.QRCode(holder, {
        text: pageUrl, width: 208, height: 208,
        colorDark: '#183d32', colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    } catch (error) {
      holder.innerHTML = '<span class="sqr-status">QRコードを表示できませんでした。<br>下のリンクをご利用ください。</span>';
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest && event.target.closest('[data-share-qr]');
    if (trigger) { event.preventDefault(); openQR(trigger); }
  });
})();