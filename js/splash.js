// js/splash.js
// ==========================================
// ★PicSpeak用: オープニング スプラッシュスクリーン (豪華アニメーション・ロゴ大型化版)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes splashEntrance {
            0% { opacity: 0; transform: translateY(30px) scale(0.95); filter: blur(10px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes warpExit {
            0% { transform: scale(1); opacity: 1; filter: blur(0); }
            20% { transform: scale(0.95); opacity: 1; filter: blur(0); } 
            100% { transform: scale(6); opacity: 0; filter: blur(20px); visibility: hidden; } 
        }
        .animate-splash-entrance {
            animation: splashEntrance 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s forwards;
        }
        .warp-animation {
            animation: warpExit 1.2s cubic-bezier(0.7, 0, 0.2, 1) forwards;
            pointer-events: none;
        }

        .mach-anim-text {
            display: inline-block;
            font-size: clamp(1.2rem, 6vw, 3.5rem); 
            font-weight: 700;
            color: white;
            position: relative;
            font-family: 'Georgia', 'Times New Roman', 'Lora', serif; 
            text-shadow: 0 4px 15px rgba(0,0,0,0.5);
            letter-spacing: 0.02em;
            white-space: nowrap; 
        }
        
        .mach-anim-text span {
            display: inline-block;
            animation: mach-text-fade-up 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
            animation-delay: calc(0.5s + (var(--char-index) * 0.04s));
        }
        @keyframes mach-text-fade-up {
            0% { opacity: 0; transform: translateY(15px); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
    `;
    document.head.appendChild(style);

    const splash = document.createElement('div');
    splash.id = 'dynamicSplashScreen';
    splash.className = 'fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-colors duration-1000';
    splash.style.background = 'radial-gradient(circle at center, #111827 0%, #030712 100%)';
    
    splash.innerHTML = `
        <div class="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none">
            <div class="w-[30rem] h-[30rem] bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div class="absolute w-[20rem] h-[20rem] bg-orange-400/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
        </div>

        <div id="splashContent" class="relative z-10 flex flex-col items-center opacity-0 animate-splash-entrance w-full px-4 text-center">
            <img src="assets/picspeaklogo.png" alt="PicSpeak Logo" class="w-48 md:w-64 lg:w-72 mb-8 drop-shadow-2xl rounded-full shadow-[0_0_30px_rgba(236,72,153,0.5),0_0_60px_rgba(249,115,22,0.3)]">
            
            <p class="text-pink-400 font-bold tracking-[0.25em] md:tracking-[0.3em] uppercase text-[9px] md:text-xs mb-6 opacity-90">English Speaking Platform</p>
            
            <div class="mach-anim-text mb-12" role="text" aria-label="Welcome to PicSpeak!">
                <span style="--char-index: 0;">W</span><span style="--char-index: 1;">e</span><span style="--char-index: 2;">l</span><span style="--char-index: 3;">c</span><span style="--char-index: 4;">o</span><span style="--char-index: 5;">m</span><span style="--char-index: 6;">e</span>
                <span style="--char-index: 7; margin-left: 0.35em;">t</span><span style="--char-index: 8;">o</span>
                <span style="--char-index: 9; margin-left: 0.35em; color: #ec4899;">P</span><span style="--char-index: 10; color: #ec4899;">i</span><span style="--char-index: 11; color: #ec4899;">c</span><span style="--char-index: 12; color: #f43f5e;">S</span><span style="--char-index: 13; color: #f43f5e;">p</span><span style="--char-index: 14; color: #f97316;">e</span><span style="--char-index: 15; color: #f97316;">a</span><span style="--char-index: 16; color: #f97316;">k</span><span style="--char-index: 17; color: #f97316;">!</span>
            </div>
            
            <button id="enterPicSpeakBtn" class="px-6 py-3 md:px-8 md:py-3.5 bg-white/5 hover:bg-white/10 border border-white/30 text-white rounded-full backdrop-blur-sm font-bold text-sm md:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] flex items-center gap-3 group">
                <span class="tracking-widest uppercase">Enter PicSpeak</span>
                <span class="group-hover:translate-x-1 transition-transform">➔</span>
            </button>
        </div>
    `;
    document.body.appendChild(splash);

    document.getElementById('enterPicSpeakBtn').addEventListener('click', () => {
        splash.classList.add('warp-animation');
        setTimeout(() => {
            splash.remove();
        }, 1200);
    });
});