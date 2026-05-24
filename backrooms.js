/* ══════════════════════════════════════════════
   CONFIG — Mismas credenciales que EcoLinces
   (el sistema de cuentas es compartido)
══════════════════════════════════════════════ */
const CONFIG = {
  SUPABASE_URL:  'https://sxoauxhtjadeouezbcot.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4b2F1eGh0amFkZW91ZXpiY290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjE4NTQsImV4cCI6MjA5Mjk5Nzg1NH0.wLnmF-oXv73SyYFHmYyoi3hAVPZdVRkkDJdS5hA7QIo'
};

/* ══════════════════════════════════════════════
   SB.JS — Instancia Supabase (mismo patrón)
══════════════════════════════════════════════ */
let sb = null;
if (typeof supabase !== 'undefined') {
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  sb.auth.getSession();
}

/* ══════════════════════════════════════════════
   AUTH.JS — Portado de EcoLinces, adaptado a Backrooms
   ─ Headings rotatorios
   ─ Login / Registro / Medidor de contraseña
   ─ setNavLoggedIn / setNavLoggedOut / fillDrawerProfile
   ─ Dropdown de usuario
══════════════════════════════════════════════ */
const LOGIN_HEADINGS = [
  '¡Bienvenido de vuelta!',
  'Qué bueno verte de nuevo.',
  'Tu espacio creativo te espera.',
  'Nos alegra que estés aquí.',
  'Sigue creando.'
];
const REGISTER_HEADINGS = [
  '¿Primera vez por aquí?',
  'Únete a la comunidad.',
  'Empieza a crear.',
  'Backrooms te da la bienvenida.',
  '¡Un nuevo creativo! ¡Bienvenido!'
];

function getRotatingHeading(arr, key) {
  let i = parseInt(sessionStorage.getItem(key) ?? Math.floor(Math.random() * arr.length));
  i = i % arr.length;
  sessionStorage.setItem(key, (i + 1) % arr.length);
  return arr[i];
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function traducirError(msg) {
  if (msg.includes('Invalid login'))       return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (msg.includes('already registered')) return 'Este correo ya está registrado.';
  if (msg.includes('Password should'))    return 'La contraseña debe tener al menos 6 caracteres.';
  return msg;
}

function initAuthModal() {
  if (!sb) return;
  const backdrop   = document.getElementById('modalBackdrop');
  const modalClose = document.getElementById('modalClose');
  const heading    = document.getElementById('modalHeading');
  const tabs       = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  window.openModal  = () => {
    const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'login';
    setTab(activeTab);
    backdrop.classList.add('open');
  };
  window.closeModal = () => backdrop?.classList.remove('open');

  modalClose?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  function setTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabContents.forEach(c => c.classList.toggle('active', c.id === 'tab' + capitalize(tabName)));
    if (heading) {
      heading.textContent = tabName === 'login'
        ? getRotatingHeading(LOGIN_HEADINGS, 'br_login_h')
        : getRotatingHeading(REGISTER_HEADINGS, 'br_register_h');
    }
  }
  tabs.forEach(tab => tab.addEventListener('click', () => setTab(tab.dataset.tab)));

  // Login
  async function doLogin() {
    const err = document.getElementById('loginError');
    err.textContent = '';
    const { error } = await sb.auth.signInWithPassword({
      email:    document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    if (error) err.textContent = traducirError(error.message);
    else closeModal();
  }
  document.getElementById('btnDoLogin')?.addEventListener('click', doLogin);
  ['loginEmail', 'loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });

  // Registro
  async function doRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const err      = document.getElementById('registerError');
    err.style.color = '#b91c1c';
    err.textContent = '';

    if (!username) { err.textContent = 'El nombre de usuario es obligatorio.'; return; }
    if (password.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }

    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) { err.textContent = traducirError(error.message); return; }

    if (data?.user) {
      await sb.from('profiles').upsert({
        id: data.user.id, username, avatar_url: null
      }, { onConflict: 'id' });
    }

    err.style.color = '#5c3d1e';
    err.textContent = '¡Cuenta creada! Ya puedes iniciar sesión.';
  }
  document.getElementById('btnDoRegister')?.addEventListener('click', doRegister);
  ['regUsername', 'regEmail', 'regPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  });

  // Medidor de contraseña
  const passInput     = document.getElementById('regPassword');
  const strengthFill  = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');
  const levels = [
    { label: 'Muy débil',  color: '#ef4444', pct: 15 },
    { label: 'Débil',      color: '#f97316', pct: 35 },
    { label: 'Regular',    color: '#eab308', pct: 55 },
    { label: 'Buena',      color: '#84cc16', pct: 75 },
    { label: 'Muy fuerte', color: '#5c3d1e', pct: 100 }
  ];
  function measureStrength(pw) {
    let score = 0;
    if (pw.length >= 6)  score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, levels.length - 1);
  }
  passInput?.addEventListener('input', () => {
    const pw = passInput.value;
    if (!pw) {
      if (strengthFill) strengthFill.style.width = '0%';
      if (strengthLabel) strengthLabel.textContent = '';
      return;
    }
    const lvl = levels[measureStrength(pw)];
    if (strengthFill)  { strengthFill.style.width = lvl.pct + '%'; strengthFill.style.background = lvl.color; }
    if (strengthLabel) { strengthLabel.style.color = lvl.color; strengthLabel.textContent = lvl.label; }
  });

  // Auth state
  sb.auth.onAuthStateChange((_e, session) => {
    if (session) setNavLoggedIn(session.user);
    else setNavLoggedOut();
  });

  // Dropdown — registrado aquí dentro porque sb ya está disponible
  initUserDropdown();
}

/* ── Dropdown de usuario ── */
function initUserDropdown() {
  const btnUserMenu  = document.getElementById('btnUserMenu');
  const userDropdown = document.getElementById('userDropdown');
  const btnLogout    = document.getElementById('btnLogout');
  const btnMyProfile = document.getElementById('btnMyProfile');

  // Abrir / cerrar dropdown
  btnUserMenu?.addEventListener('click', e => {
    e.stopPropagation();
    userDropdown?.classList.toggle('open');
  });

  // "Mi perfil" → abre el drawer lateral
  btnMyProfile?.addEventListener('click', () => {
    userDropdown?.classList.remove('open');
    document.getElementById('fullMenu')?.classList.add('open');
    document.getElementById('fullMenuOverlay')?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  });

  // Cerrar sesión
  btnLogout?.addEventListener('click', () => {
    if (sb) sb.auth.signOut();
    userDropdown?.classList.remove('open');
  });

  // Cerrar dropdown al clicar fuera
  document.addEventListener('click', e => {
    if (
      userDropdown &&
      !userDropdown.contains(e.target) &&
      !btnUserMenu?.contains(e.target)
    ) {
      userDropdown.classList.remove('open');
    }
  });
}

/* ── setNavLoggedIn — mismo patrón de EcoLinces ── */
async function setNavLoggedIn(user) {
  const btnLogin      = document.getElementById('btnLogin');
  const userMenuWrap  = document.getElementById('userMenuWrap');
  const userAvatar    = document.getElementById('userAvatar');
  const userDisplay   = document.getElementById('userDisplayName');
  const dropdownName  = document.getElementById('dropdownName');
  const dropdownEmail = document.getElementById('dropdownEmail');
  const hamAvatar     = document.getElementById('hamAvatar');
  const hamLines      = document.querySelectorAll('.ham-line');

  const username    = user.user_metadata?.username || user.email.split('@')[0];
  const emailPrefix = user.email.split('@')[0];

  if (btnLogin)     btnLogin.style.display    = 'none';
  if (userMenuWrap) userMenuWrap.style.display = 'flex';
  if (userDisplay)  userDisplay.textContent   = username;
  if (dropdownName) dropdownName.textContent  = username;
  if (dropdownEmail) dropdownEmail.textContent = emailPrefix;

  fillDrawerProfile({ username, emailPrefix, avatarUrl: null });

  /* El color de fondo del avatar usa el beige de Backrooms */
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=d4b896&color=2a1a0e&size=64`;
  if (userAvatar) userAvatar.src = fallback;

  // Ocultar banner de estudiantes cuando hay sesión
  const bannerSection = document.getElementById('bannerSection');
  if (bannerSection) bannerSection.style.display = 'none';

  // Avatar en hamburger (desktop no lo usa ya que hamburger está oculto)
  if (hamAvatar) {
    hamAvatar.src = fallback;
    hamAvatar.style.display = 'block';
    hamLines.forEach(l => l.style.display = 'none');
  }

  // Avatar móvil: aparece a la izquierda y abre el drawer
  const mobileAvatarBtn = document.getElementById('mobileAvatarBtn');
  const mobileAvatarImg = document.getElementById('mobileAvatarImg');
  if (mobileAvatarBtn && mobileAvatarImg) {
    mobileAvatarImg.src = fallback;
    mobileAvatarBtn.classList.add('show');
  }

  try {
    if (sb) {
      const { data: profile } = await sb.from('profiles').select('avatar_url').eq('id', user.id).single();
      const avatarUrl = profile?.avatar_url || fallback;
      if (profile?.avatar_url && userAvatar) userAvatar.src = avatarUrl;
      if (hamAvatar && profile?.avatar_url) hamAvatar.src = avatarUrl;
      const mobImg = document.getElementById('mobileAvatarImg');
      if (mobImg && profile?.avatar_url) mobImg.src = avatarUrl;
      fillDrawerProfile({ username, emailPrefix, avatarUrl });
    }
  } catch (_) {
    fillDrawerProfile({ username, emailPrefix, avatarUrl: fallback });
  }
}

function setNavLoggedOut() {
  const btnLogin     = document.getElementById('btnLogin');
  const userMenuWrap = document.getElementById('userMenuWrap');
  const hamAvatar    = document.getElementById('hamAvatar');
  const hamLines     = document.querySelectorAll('.ham-line');

  if (btnLogin)     btnLogin.style.display    = 'inline-block';
  if (userMenuWrap) userMenuWrap.style.display = 'none';
  if (hamAvatar)    hamAvatar.style.display    = 'none';
  hamLines.forEach(l => l.style.display = 'block');

  // Ocultar avatar móvil
  const mobileAvatarBtn = document.getElementById('mobileAvatarBtn');
  mobileAvatarBtn?.classList.remove('show');

  fillDrawerProfile(null);
  const bannerSection2 = document.getElementById('bannerSection');
  if (bannerSection2) bannerSection2.style.display = '';
}

function fillDrawerProfile(data) {
  const drawerAvatar       = document.getElementById('drawerAvatar');
  const drawerUsername     = document.getElementById('drawerUsername');
  const drawerEmail        = document.getElementById('drawerEmail');
  const drawerProfile      = document.getElementById('drawerProfile');
  const drawerAccountLinks = document.getElementById('drawerAccountLinks');
  const drawerSignout      = document.getElementById('drawerSignout');
  const drawerLogin        = document.getElementById('drawerLogin');

  if (!data) {
    if (drawerProfile)      drawerProfile.style.display      = 'none';
    if (drawerAccountLinks) drawerAccountLinks.style.display = 'none';
    if (drawerSignout)      drawerSignout.style.display      = 'none';
    if (drawerLogin)        drawerLogin.style.display        = 'flex';
    return;
  }
  if (drawerProfile)      drawerProfile.style.display      = 'flex';
  if (drawerAccountLinks) drawerAccountLinks.style.display = 'flex';
  if (drawerSignout)      drawerSignout.style.display      = 'flex';
  if (drawerLogin)        drawerLogin.style.display        = 'none';
  if (drawerUsername) drawerUsername.textContent = data.username;
  if (drawerEmail)    drawerEmail.textContent    = data.emailPrefix;
  if (drawerAvatar && data.avatarUrl) drawerAvatar.src = data.avatarUrl;
}

/* ══════════════════════════════════════════════
   SCRIPT.JS — Nav, drawer, splash, scroll, productos
══════════════════════════════════════════════ */

// Splash
(function() {
  var saved = localStorage.getItem('backrooms_theme');
  // Sin modo oscuro por ahora (solo modo claro)
})();

document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  const navbar = document.getElementById('navbar');

  // Mostrar splash solo la primera vez
  if (!localStorage.getItem('backrooms_splash_shown')) {
    localStorage.setItem('backrooms_splash_shown', '1');
    splash.classList.add('animate-logo');
    setTimeout(() => {
      splash.classList.add('animate-slide');
      setTimeout(() => {
        splash.classList.add('done');
        setTimeout(() => splash.remove(), 350);
      }, 600);
    }, 1100);
  } else {
    splash.remove();
  }

  // Nav visible
  setTimeout(() => navbar?.classList.add('visible'), 200);

  // Countdown — apertura 17 junio 2026 10:30am (Ciudad de México, UTC-6)
  const openingDate = new Date('2026-06-17T10:30:00-06:00');
  // Valores previos para detectar cambio y hacer flip
  const _cdPrev = { days: '', hours: '', mins: '', secs: '' };

  function flipDigit(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== val) {
      el.textContent = val;
      el.classList.remove('flip');
      void el.offsetWidth; // reflow para reiniciar la animación
      el.classList.add('flip');
    }
  }

  function updateCountdown() {
    const diff = openingDate - new Date();
    const cd = document.getElementById('heroCountdown');
    if (!cd) return;
    if (diff <= 0) {
      cd.innerHTML = '<span class="hcd-label" style="font-size:1.1rem">🎉 ¡Ya abrimos!</span>';
      return;
    }
    const pad = n => String(Math.floor(n)).padStart(2, '0');
    flipDigit('cdDays',  pad(diff / 86400000));
    flipDigit('cdHours', pad((diff % 86400000) / 3600000));
    flipDigit('cdMins',  pad((diff % 3600000) / 60000));
    flipDigit('cdSecs',  pad((diff % 60000) / 1000));
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Scroll → nav scrolled
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Hamburger / drawer
  const hamburger   = document.getElementById('hamburger');
  const fullMenu    = document.getElementById('fullMenu');
  const fullMenuClose = document.getElementById('fullMenuClose');
  const overlay     = document.getElementById('fullMenuOverlay');

  function openDrawer()  { fullMenu.classList.add('open'); overlay.classList.add('visible'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { fullMenu.classList.remove('open'); overlay.classList.remove('visible'); document.body.style.overflow = ''; }

  hamburger?.addEventListener('click', openDrawer);
  fullMenuClose?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Drawer signout / login
  document.getElementById('drawerSignout')?.addEventListener('click', () => { if (sb) sb.auth.signOut(); closeDrawer(); });
  document.getElementById('drawerLogin')?.addEventListener('click', () => { closeDrawer(); setTimeout(openModal, 150); });

  // Botón de login en nav → abrir modal
  document.getElementById('btnLogin')?.addEventListener('click', () => openModal?.());
  document.getElementById('bannerCta')?.addEventListener('click', e => { e.preventDefault(); openModal?.(); });

  // Inicializar auth
  initAuthModal();

  // Fade-in on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // Filtros de catálogo
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadProducts(btn.dataset.filter);
    });
  });

  // Cargar productos (demo con datos locales)
  loadProducts('all');
});

/* ── Productos demo ── */

/* ══════════════════════════════════════════════
   CATEGORÍAS — calculadas desde PRODUCTS
══════════════════════════════════════════════ */
const CAT_META = {
  utiles:   { icon: '✏️',  label: 'Útiles' },
  plumas:   { icon: '🖊️',  label: 'Plumas & Bolígrafos' },
  stickers: { icon: '⭐',  label: 'Stickers' },
  backsies: { icon: '📦',  label: 'Backsies' },
};

function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  // Contar productos por categoría (excluir backsies del grid de categorías)
  const counts = {};
  PRODUCTS.forEach(p => {
    if (p.cat === 'backsies') return;
    counts[p.cat] = (counts[p.cat] || 0) + 1;
  });

  const entries = Object.entries(counts);
  if (!entries.length) { grid.style.display = 'none'; return; }

  grid.innerHTML = entries.map(([cat, count]) => {
    const meta = CAT_META[cat] || { icon: '📦', label: cat.charAt(0).toUpperCase() + cat.slice(1) };
    return `
      <a class="cat-card" href="#catalogo" onclick="
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter=${cat}]')?.classList.add('active');
        loadProducts('${cat}');
      ">
        <div class="cat-icon">${meta.icon}</div>
        <div class="cat-name">${meta.label}</div>
        <div class="cat-count">${count} producto${count !== 1 ? 's' : ''}</div>
        <div class="cat-arrow">↗</div>
      </a>`;
  }).join('');
}

const PRODUCTS = [
  // ── Útiles ──
  { id:1,  name:'Lápiz',                cat:'utiles',   price:7,  img:'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=400&q=80', badge:null, badgeType:'' },
  { id:2,  name:'Pluma',                cat:'plumas',   price:7,  img:'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400&q=80', badge:null, badgeType:'' },
  { id:3,  name:'Marcatexto',           cat:'utiles',   price:12, img:'https://images.unsplash.com/photo-1597075687490-8f673c6c17f6?w=400&q=80', badge:null, badgeType:'' },
  { id:4,  name:'Sacapuntas tigre',     cat:'utiles',   price:70, img:'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80', badge:null, badgeType:'' },
  { id:5,  name:'Sacapuntas',           cat:'utiles',   price:3,  img:'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?w=400&q=80', badge:null, badgeType:'' },
  { id:6,  name:'Gis',                  cat:'utiles',   price:35, img:'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80', badge:null, badgeType:'' },
  { id:7,  name:'Regla doble',          cat:'utiles',   price:15, img:'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80', badge:null, badgeType:'' },
  { id:8,  name:'Regla normal',         cat:'utiles',   price:10, img:'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80', badge:null, badgeType:'' },
  { id:9,  name:'Goma',                 cat:'utiles',   price:16, img:'https://images.unsplash.com/photo-1583484963886-cfe2bff2945f?w=400&q=80', badge:null, badgeType:'' },
  // ── Stickers ──
  { id:10, name:'Sticker carita (com)',    cat:'stickers', price:21, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:11, name:'Sticker carita (med)',    cat:'stickers', price:16, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:12, name:'Sticker carita (quarter)',cat:'stickers', price:14, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:'oferta', badgeType:'sale', oldPrice:21 },
  { id:13, name:'Sticker carita (6-5)',    cat:'stickers', price:5,  img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:'oferta', badgeType:'sale', oldPrice:21 },
  { id:14, name:'Sticker estrella (com)',  cat:'stickers', price:7,  img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:15, name:'Sticker estrella (med)',  cat:'stickers', price:5,  img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:16, name:'Sticker círculo (com)',   cat:'stickers', price:12, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:17, name:'Sticker círculo (med)',   cat:'stickers', price:6,  img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  // ── Stickers kuai / journal ──
  { id:18, name:'Sticker kuai G.mm (5pz)', cat:'stickers', price:10, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:19, name:'Sticker kuai R.g (10pz)', cat:'stickers', price:10, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:20, name:'Sticker kuai R.c (10pz)', cat:'stickers', price:10, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:21, name:'Sticker kuai G.j (3pz)',  cat:'stickers', price:12, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  { id:22, name:'Sticker kuai 4p (10pz)',  cat:'stickers', price:15, img:'https://images.unsplash.com/photo-1589380790036-9c7dc2087411?w=400&q=80', badge:null, badgeType:'' },
  // ── Backsies ──
  { id:23, name:'Backsie', cat:'backsies', price:30,
    img:'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80',
    badge:'estrella', badgeType:'new',
    desc:'Sobre sorpresa con lápiz, stickers, sacapuntas y plumón. Incluye cupón con oportunidad de elegir algo gratis o un descuento.' },
];

function loadProducts(filter) {
  const grid = document.getElementById('productsGrid');

  grid.innerHTML = Array(4).fill(`
    <div class="product-skel">
      <div class="skel-img"></div>
      <div class="skel-line"></div>
      <div class="skel-line short"></div>
    </div>`).join('');

  (async () => {
    await new Promise(r => setTimeout(r, 500));
    const filtered = filter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === filter);

    if (!filtered.length) {
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-light);padding:40px 0;">Sin productos en esta categoría por ahora.</p>`;
      return;
    }

    // Cargar guardados del usuario si hay sesión
    let savedIds = new Set();
    if (sb) {
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData?.session?.user) {
        const { data } = await sb.from('guardados').select('producto_id').eq('user_id', sessionData.session.user.id);
        if (data) savedIds = new Set(data.map(r => r.producto_id));
      }
    }

    grid.innerHTML = filtered.map(p => `
      <div class="product-card ${p.cat === 'backsies' ? 'product-card--backsie' : ''}" onclick="openProductModal(${p.id})" style="cursor:pointer">
        <div class="product-img">
          ${p.badge ? `<span class="product-badge ${p.badgeType}">${p.badge}</span>` : ''}
          <img class="product-photo" src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 80' shape-rendering='crispEdges'%3E%3Crect width='64' height='80' fill='%23888'/%3E%3C!-- cuerpo mac --%3E%3Crect x='8' y='4' width='48' height='56' fill='%23000'/%3E%3Crect x='6' y='6' width='52' height='52' fill='%23000'/%3E%3Crect x='4' y='8' width='56' height='48' fill='%23000'/%3E%3C!-- borde blanco --%3E%3Crect x='8' y='4' width='48' height='2' fill='%23fff'/%3E%3Crect x='4' y='8' width='2' height='48' fill='%23fff'/%3E%3Crect x='58' y='8' width='2' height='48' fill='%23fff'/%3E%3Crect x='8' y='56' width='48' height='2' fill='%23fff'/%3E%3Crect x='6' y='6' width='2' height='2' fill='%23fff'/%3E%3Crect x='56' y='6' width='2' height='2' fill='%23fff'/%3E%3C!-- pantalla --%3E%3Crect x='10' y='8' width='44' height='32' fill='%23000'/%3E%3Crect x='12' y='10' width='40' height='28' fill='%23111'/%3E%3C!-- ojos X X --%3E%3Crect x='16' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='20' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='20' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='16' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='36' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='40' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='40' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='36' y='20' width='4' height='4' fill='%23fff'/%3E%3C!-- boca triste --%3E%3Crect x='20' y='30' width='4' height='4' fill='%23fff'/%3E%3Crect x='24' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='28' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='32' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='36' y='30' width='4' height='4' fill='%23fff'/%3E%3C!-- botón y ranura --%3E%3Crect x='28' y='46' width='8' height='4' fill='%23fff'/%3E%3Crect x='12' y='46' width='6' height='4' fill='%23fff'/%3E%3C!-- base --%3E%3Crect x='16' y='60' width='32' height='8' fill='%23000'/%3E%3Crect x='14' y='58' width='36' height='2' fill='%23fff'/%3E%3C/svg%3E';this.classList.add('img-error')">
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          ${p.desc ? `<div class="product-desc">${p.desc}</div>` : `<div class="product-meta">${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}</div>`}
          <div class="product-footer">
            <div class="product-price">
              $${p.price}
              ${p.oldPrice ? `<span class="old">$${p.oldPrice}</span>` : ''}
            </div>
            <button class="btn-save ${savedIds.has(p.id) ? 'saved' : ''}" data-id="${p.id}" title="${savedIds.has(p.id) ? 'Quitar de guardados' : 'Guardar'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${savedIds.has(p.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Listeners de guardar
    grid.querySelectorAll('.btn-save').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.stopPropagation();
        if (!sb) { openModal?.(); return; }
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData?.session?.user) { openModal?.(); return; }
        const userId = sessionData.session.user.id;
        const productId = parseInt(btn.dataset.id);
        const isSaved = btn.classList.contains('saved');
        if (isSaved) {
          await sb.from('guardados').delete().eq('user_id', userId).eq('producto_id', productId);
          btn.classList.remove('saved');
          btn.title = 'Guardar';
          btn.querySelector('svg').setAttribute('fill', 'none');
        } else {
          const product = PRODUCTS.find(p => p.id === productId);
          const { error: saveErr } = await sb.from('guardados').insert({
            user_id: userId,
            producto_id: productId
          });
          if (saveErr) { console.error('Error al guardar:', saveErr.message); return; }
          btn.classList.add('saved');
          btn.title = 'Quitar de guardados';
          btn.querySelector('svg').setAttribute('fill', 'currentColor');
        }
      });
    });
  })();
}

function openProductModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const existing = document.getElementById('productModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'productModal';
  modal.className = 'product-modal-backdrop';
  modal.innerHTML = `
    <div class="product-modal" role="dialog" aria-modal="true">
      <button class="product-modal-close" id="pmClose" aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="product-modal-img">
        ${p.badge ? `<span class="product-badge ${p.badgeType}">${p.badge}</span>` : ''}
        <img src="${p.img}" alt="${p.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 80' shape-rendering='crispEdges'%3E%3Crect width='64' height='80' fill='%23888'/%3E%3C!-- cuerpo mac --%3E%3Crect x='8' y='4' width='48' height='56' fill='%23000'/%3E%3Crect x='6' y='6' width='52' height='52' fill='%23000'/%3E%3Crect x='4' y='8' width='56' height='48' fill='%23000'/%3E%3C!-- borde blanco --%3E%3Crect x='8' y='4' width='48' height='2' fill='%23fff'/%3E%3Crect x='4' y='8' width='2' height='48' fill='%23fff'/%3E%3Crect x='58' y='8' width='2' height='48' fill='%23fff'/%3E%3Crect x='8' y='56' width='48' height='2' fill='%23fff'/%3E%3Crect x='6' y='6' width='2' height='2' fill='%23fff'/%3E%3Crect x='56' y='6' width='2' height='2' fill='%23fff'/%3E%3C!-- pantalla --%3E%3Crect x='10' y='8' width='44' height='32' fill='%23000'/%3E%3Crect x='12' y='10' width='40' height='28' fill='%23111'/%3E%3C!-- ojos X X --%3E%3Crect x='16' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='20' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='20' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='16' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='36' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='40' y='20' width='4' height='4' fill='%23fff'/%3E%3Crect x='40' y='16' width='4' height='4' fill='%23fff'/%3E%3Crect x='36' y='20' width='4' height='4' fill='%23fff'/%3E%3C!-- boca triste --%3E%3Crect x='20' y='30' width='4' height='4' fill='%23fff'/%3E%3Crect x='24' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='28' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='32' y='28' width='4' height='2' fill='%23fff'/%3E%3Crect x='36' y='30' width='4' height='4' fill='%23fff'/%3E%3C!-- botón y ranura --%3E%3Crect x='28' y='46' width='8' height='4' fill='%23fff'/%3E%3Crect x='12' y='46' width='6' height='4' fill='%23fff'/%3E%3C!-- base --%3E%3Crect x='16' y='60' width='32' height='8' fill='%23000'/%3E%3Crect x='14' y='58' width='36' height='2' fill='%23fff'/%3E%3C/svg%3E';this.classList.add('img-error')">
      </div>
      <div class="product-modal-body">
        <div class="product-modal-cat">${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}</div>
        <h2 class="product-modal-name">${p.name}</h2>
        ${p.desc ? `<p class="product-modal-desc">${p.desc}</p>` : ''}
        <div class="product-modal-price">$${p.price}${p.oldPrice ? `<span class="product-modal-old">$${p.oldPrice}</span>` : ''}</div>
        <div class="product-modal-actions">
          <div class="qty-control">
            <button class="qty-btn" id="pmMinus">−</button>
            <span class="qty-val" id="pmQty">1</span>
            <button class="qty-btn" id="pmPlus">+</button>
          </div>
          <div class="product-modal-total" id="pmTotal">Total: $${p.price}</div>
        </div>
        <button class="product-modal-cta" id="pmAdd">Agregar al carrito</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('open'));
  let qty = 1;
  const qtyEl = modal.querySelector('#pmQty');
  const total = modal.querySelector('#pmTotal');
  const update = () => { qtyEl.textContent = qty; total.textContent = `Total: $${p.price * qty}`; };
  modal.querySelector('#pmMinus').addEventListener('click', () => { if (qty > 1) { qty--; update(); } });
  modal.querySelector('#pmPlus').addEventListener('click',  () => { qty++; update(); });
  modal.querySelector('#pmAdd').addEventListener('click',   () => { addToCart(p.id, qty); closeProductModal(); });
  modal.querySelector('#pmClose').addEventListener('click', closeProductModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeProductModal(); });
}
function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.remove(); document.body.style.overflow = ''; }, 250);
}
function addToCart(id) {
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;
  // Puedes conectar esto a tu lógica de carrito aquí
  const btn = event.currentTarget;
  btn.textContent = '✓';
  btn.style.background = '#5c3d1e';
  setTimeout(() => { btn.textContent = '+'; btn.style.background = ''; }, 1500);
}
