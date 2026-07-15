
  // 鼠标移动时给 feature 卡片做高光跟随
  document.querySelectorAll('.feature').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });

  // Hero 鼠标视差 — orbs / scene 整体随鼠标偏移，单监听 + transform，零重排
  (function () {
    const hero = document.querySelector('.hero');
    const orbs = document.querySelector('.hero-orbs');
    const scene = document.querySelector('.hero-scene');
    if (!hero || !orbs) return;
    let rafId = null;
    let tx = 0, ty = 0;
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 ~ 0.5
      const y = (e.clientY - r.top) / r.height - 0.5;
      tx = x * 16;
      ty = y * 12;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          orbs.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
          if (scene) scene.style.transform = `translate3d(${tx * 0.35}px, ${ty * 0.35}px, 0)`;
          rafId = null;
        });
      }
    };
    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', () => {
      orbs.style.transform = '';
      if (scene) scene.style.transform = '';
    });

  })();

  // \u9f20\u6807\u661f\u5149\u7279\u6548 \u2014\u2014 \u7ed1\u7ed9 Hero \u548c\u6700\u540e\u7684 CTA\uff0c\u9996\u5c3e\u547c\u5e94"\u6545\u4e8b\u611f"\uff0c\u4e2d\u95f4\u9605\u8bfb\u533a\u4e0d\u6253\u6270
  function attachSparks(container) {
    if (!container) return;
    let lastSpawn = 0;
    container.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - lastSpawn < 48) return; // \u8282\u6d41 ~20fps
      lastSpawn = now;
      const r = container.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.left = (x - 3) + 'px';
      s.style.top = (y - 3) + 'px';
      const ang = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 26;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      const scale = 0.6 + Math.random() * 0.9;
      s.style.width = (6 * scale) + 'px';
      s.style.height = (6 * scale) + 'px';
      container.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    });
  }
  attachSparks(document.querySelector('.hero'));
  attachSparks(document.querySelector('.final-cta'));

  // 自动按平台分发下载链接：data-dl="auto" 的按钮在 Mac/iOS 上跳 /dl/mac，否则 /dl/win
  (function () {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const target = isApple ? '/dl/mac' : '/dl/win';
    document.querySelectorAll('a[data-dl="auto"]').forEach(a => { a.href = target; });
  })();

  // 回到顶部按钮：滚动 > 600px 才显示，点击平滑回顶
  (function () {
    const btn = document.querySelector('.back-to-top');
    if (!btn) return;
    const THRESHOLD = 600;
    let ticking = false;
    const toggle = () => {
      if (window.scrollY > THRESHOLD) btn.classList.add('visible');
      else btn.classList.remove('visible');
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(toggle);
        ticking = true;
      }
    }, { passive: true });
    toggle();
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();
