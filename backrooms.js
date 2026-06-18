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
    if (error) {
      err.textContent = traducirError(error.message);
    } else {
      closeModal();
      propagarSesionA('https://ecolinces.pages.dev');
    }
  }

  /* ── SSO: propaga la sesión activa al otro sitio con un iframe invisible ── */
  async function propagarSesionA(otroOrigen) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const params = new URLSearchParams({
        access_token:  session.access_token,
        refresh_token: session.refresh_token,
        return_to:     otroOrigen + '/index.html'
      });
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
      iframe.src = otroOrigen + '/auth-bridge.html?' + params;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 4000);
    } catch (_) { /* SSO es best-effort, fallo silencioso */ }
  }

  /* ── SSO: cierra sesión en ambos sitios ── */
  async function cerrarSesionEnAmbos() {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
      iframe.src = 'https://ecolinces.pages.dev/auth-bridge.html?signout=1';
      document.body.appendChild(iframe);
      await new Promise(r => setTimeout(r, 1200));
      iframe.remove();
    } catch (_) {}
    await sb.auth.signOut();
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
  btnLogout?.addEventListener('click', async () => {
    userDropdown?.classList.remove('open');
    await cerrarSesionEnAmbos();
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
  document.getElementById('drawerSignout')?.addEventListener('click', async () => { await cerrarSesionEnAmbos(); closeDrawer(); });
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

// ⚠️ PENDIENTE: estas imágenes son placeholders genéricos por categoría, NO fotos
// reales del producto. Las URLs de Unsplash anteriores mostraban contenido que no
// correspondía (audífonos, cócteles, etc.) — se reemplazaron por placeholders
// honestos hasta tener fotografía real de cada producto. Reemplazar cada `img`
// por la foto real en cuanto esté disponible.
const PH = {
  utiles:   'placeholder-utiles.svg',
  plumas:   'placeholder-plumas.svg',
  stickers: 'placeholder-stickers.svg',
  backsies: 'placeholder-backsies.svg',
};

const PRODUCTS = [
  // ── Útiles ──
  { id:1,  name:'Lápiz',                cat:'utiles',   price:7,  img:PH.utiles, badge:null, badgeType:'' },
  { id:2,  name:'Pluma',                cat:'plumas',   price:7,  img:PH.plumas, badge:null, badgeType:'' },
  { id:3,  name:'Marcatexto',           cat:'utiles',   price:12, img:PH.utiles, badge:null, badgeType:'' },
  { id:4,  name:'Sacapuntas tigre',     cat:'utiles',   price:70, img:PH.utiles, badge:null, badgeType:'' },
  { id:5,  name:'Sacapuntas',           cat:'utiles',   price:3,  img:PH.utiles, badge:null, badgeType:'' },
  { id:6,  name:'Gis',                  cat:'utiles',   price:35, img:PH.utiles, badge:null, badgeType:'' },
  { id:7,  name:'Regla doble',          cat:'utiles',   price:15, img:PH.utiles, badge:null, badgeType:'' },
  { id:8,  name:'Regla normal',         cat:'utiles',   price:10, img:PH.utiles, badge:null, badgeType:'' },
  { id:9,  name:'Goma',                 cat:'utiles',   price:16, img:PH.utiles, badge:null, badgeType:'' },
  // ── Stickers ──
  { id:10, name:'Sticker carita (com)',    cat:'stickers', price:21, img:PH.stickers, badge:null, badgeType:'' },
  { id:11, name:'Sticker carita (med)',    cat:'stickers', price:16, img:PH.stickers, badge:null, badgeType:'' },
  { id:12, name:'Sticker carita (quarter)',cat:'stickers', price:14, img:PH.stickers, badge:'oferta', badgeType:'sale', oldPrice:21 },
  { id:13, name:'Sticker carita (6-5)',    cat:'stickers', price:5,  img:PH.stickers, badge:'oferta', badgeType:'sale', oldPrice:21 },
  { id:14, name:'Sticker estrella (com)',  cat:'stickers', price:7,  img:PH.stickers, badge:null, badgeType:'' },
  { id:15, name:'Sticker estrella (med)',  cat:'stickers', price:5,  img:PH.stickers, badge:null, badgeType:'' },
  { id:16, name:'Sticker círculo (com)',   cat:'stickers', price:12, img:PH.stickers, badge:null, badgeType:'' },
  { id:17, name:'Sticker círculo (med)',   cat:'stickers', price:6,  img:PH.stickers, badge:null, badgeType:'' },
  // ── Stickers kuai / journal ──
  { id:18, name:'Sticker kuai G.mm (5pz)', cat:'stickers', price:10, img:PH.stickers, badge:null, badgeType:'' },
  { id:19, name:'Sticker kuai R.g (10pz)', cat:'stickers', price:10, img:PH.stickers, badge:null, badgeType:'' },
  { id:20, name:'Sticker kuai R.c (10pz)', cat:'stickers', price:10, img:PH.stickers, badge:null, badgeType:'' },
  { id:21, name:'Sticker kuai G.j (3pz)',  cat:'stickers', price:12, img:PH.stickers, badge:null, badgeType:'' },
  { id:22, name:'Sticker kuai 4p (10pz)',  cat:'stickers', price:15, img:PH.stickers, badge:null, badgeType:'' },
  // ── Backsies ──
  { id:23, name:'Backsie', cat:'backsies', price:30,
    img:PH.backsies,
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

/* ══════════════════════════════════════════════
   EASTER EGG — Debug Menu
   Activar: WASD x2 (desktop) | logo ×5 | footer 30s (móvil)
══════════════════════════════════════════════ */
(function() {
  const SEQUENCE = ['w','a','s','d','w','a','s','d'];
  let seqIdx = 0;
  let logoClicks = 0;
  let logoTimer = null;
  let footerTimer = null;
  let eggUnlocked = false;

  function ts() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    return `[${hh}:${mm}:${ss}]`;
  }

  function launchEasterEgg() {
    if (eggUnlocked) return;
    eggUnlocked = true;

    // ── Audio ──
    const audio = new Audio('easter.flac');
    audio.volume = 0.7;
    audio.loop   = true;
    audio.play().catch(() => {});

    // ── Overlay ──
    const overlay = document.createElement('div');
    overlay.id = 'debugOverlay';
    overlay.innerHTML = `
      <div class="debug-panel">
        <div class="debug-titlebar">
          <span class="debug-title">[ BACKROOMS_DEBUG v0.0.1 ] — acceso no autorizado</span>
          <span class="debug-title-esc">ESC para cerrar</span>
        </div>
        <div class="debug-body">
          <div class="debug-log" id="debugLog"></div>
          <div class="debug-input-row">
            <span class="debug-prompt" id="debugPrompt">guest@backrooms:~$&nbsp;</span>
            <input class="debug-input" id="debugInput" placeholder="" autocomplete="off" spellcheck="false" />
          </div>
          <div class="debug-commands">
            <span class="debug-cmd-label">sugerencias:</span>
            <div class="debug-cmd-list">
              <button class="debug-cmd" data-cmd="whoami">whoami</button>
              <button class="debug-cmd" data-cmd="ls -la">ls -la</button>
              <button class="debug-cmd" data-cmd="cat README">cat README</button>
              <button class="debug-cmd" data-cmd="ps aux">ps aux</button>
              <button class="debug-cmd" data-cmd="status">status</button>
              <button class="debug-cmd" data-cmd="help">help</button>
              <button class="debug-cmd debug-cmd-danger" data-cmd="destroy">destroy</button>
              <button class="debug-cmd" data-cmd="exit">exit</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const log   = overlay.querySelector('#debugLog');
    const input = overlay.querySelector('#debugInput');
    const cmdHistory = [];
    let histIdx = -1;
    let destroyActive = false;

    const RESPONSES = {
      'whoami': [
        { t: 'guest', cls: 'debug-line-ok' },
      ],
      'whoami --verbose': [
        { t: 'uid=1337(guest) gid=1337(visitors) grupos=1337(visitors),0(root)', cls: 'debug-line-ok' },
        { t: 'shell: /bin/bash  |  home: /var/backrooms/guest', cls: 'debug-line-ok' },
        { t: 'ultima sesion: hace mucho. demasiado.', cls: 'debug-line-ok' },
      ],
      'ls': [
        { t: 'papeleria/   stickers/   backsies/   [REDACTED]/   .hidden/', cls: 'debug-line-ok' },
      ],
      'ls -la': [
        { t: 'total 48', cls: 'debug-line-ok' },
        { t: 'drwxr-xr-x  6 guest visitors  4096 ' + new Date().toLocaleDateString('es-MX') + ' .', cls: 'debug-line-ok' },
        { t: 'drwxr-xr-x  3 root  root       4096 ene 01  2023 ..', cls: 'debug-line-ok' },
        { t: '-rw-------  1 guest visitors   220  ene 01  2023 .bash_history', cls: 'debug-line-ok' },
        { t: 'drwxr-xr-x  2 guest visitors  4096 ' + new Date().toLocaleDateString('es-MX') + ' papeleria/', cls: 'debug-line-ok' },
        { t: 'drwxr-xr-x  2 guest visitors  4096 ' + new Date().toLocaleDateString('es-MX') + ' stickers/', cls: 'debug-line-ok' },
        { t: 'drwx------  2 guest visitors  4096 ' + new Date().toLocaleDateString('es-MX') + ' backsies/', cls: 'debug-line-ok' },
        { t: 'd---------  2 root  root       4096 ene 01  2023 [REDACTED]/', cls: 'debug-line-err' },
        { t: 'drwx------  2 guest visitors  4096 mar 15  2024 .hidden/', cls: 'debug-line-ok' },
      ],
      'ls .hidden': [
        { t: 'pasaporte_v1.bak   formula.enc   notas.txt   lf_stereo.conf', cls: 'debug-line-ok' },
      ],
      'cat README': [
        { t: '╔══════════════════════════════════════╗', cls: 'debug-line-ok' },
        { t: '║   BACKROOMS OS  v2.4.1-unstable      ║', cls: 'debug-line-ok' },
        { t: '║   build: ' + Math.floor(Math.random()*9000+1000) + '-nightly               ║', cls: 'debug-line-ok' },
        { t: '╚══════════════════════════════════════╝', cls: 'debug-line-ok' },
        { t: '', cls: '' },
        { t: 'Si encontraste esto, bien hecho.', cls: 'debug-line-ok' },
        { t: 'Este panel no existe de manera oficial.', cls: 'debug-line-ok' },
        { t: 'No lo menciones.', cls: 'debug-line-ok' },
        { t: '', cls: '' },
        { t: '  — admin', cls: 'debug-line-ok' },
      ],
      'cat notas.txt': [
        { t: 'cat: notas.txt: No such file or directory', cls: 'debug-line-err' },
      ],
      'cat .hidden/notas.txt': [
        { t: 'TODO:', cls: 'debug-line-ok' },
        { t: '  [x] lanzar tienda', cls: 'debug-line-ok' },
        { t: '  [x] esconder este panel', cls: 'debug-line-ok' },
        { t: '  [ ] que nadie lo encuentre', cls: 'debug-line-err' },
        { t: '  [ ] mas backsies', cls: 'debug-line-ok' },
        { t: '  [?] ████████████████ (clasificado)', cls: 'debug-line-ok' },
      ],
      'ps aux': [
        { t: 'USER       PID %CPU %MEM    VSZ   RSS COMMAND', cls: 'debug-line-ok' },
        { t: 'guest        1  0.0  0.1   1024   512 /sbin/init', cls: 'debug-line-ok' },
        { t: 'guest       42  0.0  0.2   2048  1024 /usr/bin/tienda --prod', cls: 'debug-line-ok' },
        { t: 'guest      133  2.1  0.8   8192  4096 sticker_tracker --live', cls: 'debug-line-ok' },
        { t: 'guest      420  0.7  0.4   4096  2048 backsies_daemon -q', cls: 'debug-line-ok' },
        { t: 'root       666  ???  ???  ?????  ???? [REDACTED]', cls: 'debug-line-err' },
        { t: 'guest      999  0.0  0.1   1024   256 bash', cls: 'debug-line-ok' },
        { t: 'guest     1000  0.0  0.0    512   128 ps aux', cls: 'debug-line-ok' },
      ],
      'uname -a': [
        { t: 'BackroomsOS 2.4.1-unstable #1 SMP ' + new Date().toUTCString() + ' x86_64 GNU/Linux', cls: 'debug-line-ok' },
      ],
      'uptime': [
        { t: ' ' + ts() + ' up 420 days, 13:37,  1 user,  load average: 0.42, 0.13, 0.07', cls: 'debug-line-ok' },
      ],
      'pwd': [
        { t: '/var/backrooms/guest', cls: 'debug-line-ok' },
      ],
      'date': [
        { t: new Date().toString(), cls: 'debug-line-ok' },
      ],
      'echo hola': [
        { t: 'hola', cls: 'debug-line-ok' },
      ],
      'sudo su': [
        { t: '[sudo] contrasena para guest:', cls: 'debug-line-ok' },
        { t: 'guest no esta en el archivo sudoers. Este incidente ha sido reportado.', cls: 'debug-line-err' },
      ],
      'rm -rf /': [
        { t: 'rm: no se puede borrar «/»: Dispositivo o recurso ocupado', cls: 'debug-line-err' },
        { t: '...de nada.', cls: 'debug-line-ok' },
      ],
      'status': [
        { t: '● backrooms.service — sitio personal', cls: 'debug-line-ok' },
        { t: '   Loaded: loaded (/etc/systemd/system/backrooms.service; enabled)', cls: 'debug-line-ok' },
        { t: '   Active: active (running) since hace un rato', cls: 'debug-line-ok' },
        { t: '', cls: '' },
        { t: '   sistema:    OK operativo', cls: 'debug-line-ok' },
        { t: '   cafe:       suficiente (nivel: 73%)', cls: 'debug-line-ok' },
        { t: '   stickers:   en transito — ETA desconocido', cls: 'debug-line-ok' },
        { t: '   backsies:   disponibles', cls: 'debug-line-ok' },
        { t: '   misterio:   ████████████░░ 87%', cls: 'debug-line-ok' },
        { t: '   [REDACTED]: ????????????? ERROR', cls: 'debug-line-err' },
      ],
      'help': [
        { t: 'Comandos documentados:', cls: 'debug-line-ok' },
        { t: '  whoami / whoami --verbose', cls: 'debug-line-ok' },
        { t: '  ls / ls -la / ls .hidden', cls: 'debug-line-ok' },
        { t: '  cat README / cat .hidden/notas.txt', cls: 'debug-line-ok' },
        { t: '  ps aux / uname -a / uptime / pwd / date', cls: 'debug-line-ok' },
        { t: '  status', cls: 'debug-line-ok' },
        { t: '  sudo su / rm -rf /', cls: 'debug-line-ok' },
        { t: '  destroy', cls: 'debug-line-err' },
        { t: '  exit / logout', cls: 'debug-line-ok' },
        { t: '', cls: '' },
        { t: 'Puede haber otros comandos. Puede que no.', cls: 'debug-line-boot' },
        { t: 'tip: usa ↑↓ para navegar el historial.', cls: 'debug-line-boot' },
      ],
    };

    function addLine(text, cls = '') {
      const line = document.createElement('div');
      line.className = 'debug-line ' + cls;
      line.textContent = text;
      // aplicar color del tema activo si existe
      if (overlay._theme) {
        if (cls === 'debug-line-ok')    line.style.color = overlay._theme.fg;
        if (cls === 'debug-line-boot')  line.style.color = overlay._theme.boot;
        if (cls === 'debug-line-input') line.style.color = overlay._theme.prompt;
      }
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    function runCmd(rawCmd) {
      const cmd = rawCmd.trim();
      if (!cmd) return;
      cmdHistory.unshift(cmd);
      histIdx = -1;

      addLine('squid@backrooms:~$ ' + cmd, 'debug-line-input');

      const key = cmd.toLowerCase();
      if (key === 'exit' || key === 'logout') {
        addLine('logout', 'debug-line-ok');
        addLine('', '');
        addLine('Session closed.', 'debug-line-ok');
        setTimeout(closeEgg, 900);
        return;
      }
      if (key === 'clear') {
        log.innerHTML = '';
        return;
      }

      // ── Comandos secretos (no aparecen en help ni sugerencias) ──

      if (key === 'tuch') {
        addLine('[INFO] abriendo recurso externo...', 'debug-line-boot');
        setTimeout(() => window.open('https://c.tenor.com/ABeVmJ3y2WQAAAAd/tenor.gif', '_blank'), 400);
        return;
      }

      if (key === 'random') {
        const pool = [
          { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1', w: 35 },
          { url: 'https://www.ebay.com/sch/i.html?_nkw=splatune+ost&_sacat=0&_from=R40&_trksid=p2332490.m570.l1313', w: 30 },
          { url: 'https://es.aliexpress.com/item/1005008683635570.html', w: 20 },
          { url: 'https://thisisnotawebsitedotcom.com/', w: 15 },
        ];
        const total = pool.reduce((s, x) => s + x.w, 0);
        let r = Math.random() * total;
        let chosen = pool[pool.length - 1].url;
        for (const x of pool) { r -= x.w; if (r <= 0) { chosen = x.url; break; } }
        addLine('[INFO] seleccionando destino...', 'debug-line-boot');
        addLine('[INFO] ' + chosen, 'debug-line-ok');
        setTimeout(() => window.open(chosen, '_blank'), 600);
        return;
      }

      if (key === 'beatle') {
        addLine('[INFO] abriendo...', 'debug-line-boot');
        setTimeout(() => window.open('https://www.youtube.com/watch?v=ODIvONHPqpk&list=RDODIvONHPqpk&start_radio=1', '_blank'), 400);
        return;
      }

      if (key === 'lumon') {
        addLine('[INFO] bienvenido a Lumon Industries.', 'debug-line-boot');
        setTimeout(() => window.open('https://lumon-industries.com/', '_blank'), 500);
        return;
      }

      if (key === 'lf_stereo') {
        showStereoPlayer(audio, overlay);
        return;
      }

      if (key === 'poema' || key === 'poem') {
        addLine('[INFO] redireccionando...', 'debug-line-boot');
        setTimeout(() => window.open('https://www.instagram.com/tarukii.chr/', '_blank'), 400);
        return;
      }

      if (key === 'backrooms') {
        const dest = Math.random() < 0.75
          ? 'https://www.youtube.com/watch?v=0HjdiohVOik'
          : 'https://www.roblox.com/es/games/18619783618/Dancing-Pug-Meme-Backrooms';
        addLine('[INFO] cargando nivel...', 'debug-line-boot');
        addLine('[INFO] ' + dest, 'debug-line-ok');
        setTimeout(() => window.open(dest, '_blank'), 500);
        return;
      }

      if (key === 'doki') {
        // Obtener nombre del usuario desde el DOM
        const profileName = document.getElementById('userDisplay')?.textContent?.trim() || 'tú';

        // "just monika." spam — llena el log
        let count = 0;
        const spam = setInterval(() => {
          addLine('just monika.', 'debug-line-ok');
          count++;
          if (count >= 80) clearInterval(spam);
        }, 60);

        // Solicitar mic + cámara
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            // ACCESO CONCEDIDO
            window.open('https://doki-doki-literature-club.fandom.com/wiki/Monika_(DDLC)/Gallery?file=10.png', '_blank');

            // Diálogos de Monika — dos bloques con pausa entre ellos
            const block1 = [
              { t: `${profileName}, ¿duermes bien?`,                                                      d: 1000  },
              { t: `Puede ser realmente difícil dormir lo suficiente hoy en día.`,                        d: 5000  },
              { t: `Especialmente en la preparatoria, cuando te ves obligado a levantarte tan temprano...`,d: 11000 },
              { t: `Estoy segura de que la universidad es un poco mejor, ya que probablemente tengas un horario más flexible.`, d: 18000 },
              { t: `De nuevo, escuché que mucha gente en la universidad se queda despierta toda la noche de todos modos, sin una razón real.`, d: 25000 },
              { t: `¿Es eso cierto?`,                                                                     d: 31000 },
              { t: `De todos modos, vi algunos estudios que hablaban sobre los efectos horribles a corto y largo plazo causados por la falta de sueño.`, d: 36000 },
              { t: `Parece que las funciones mentales, la salud e incluso la duración de la vida pueden verse impactadas dramáticamente.`, d: 43000 },
              { t: `Creo que eres realmente grandioso y quería asegurarme de que no te estás destruyendo accidentalmente.`, d: 49000 },
              { t: `Así que trata de mantener tu sueño en la pista, ¿de acuerdo?`,                       d: 54000 },
              { t: `Siempre te esperaré por la mañana, así que asegúrate de poner tu propio bienestar antes que nada.`, d: 58000 },
            ];
            const block2 = [
              { t: `Vaya, ojalá hubiera un piano por aquí...`,                   d: 0    },
              { t: `Nunca pude terminar esa canción en la que estaba trabajando.`,d: 4000 },
              { t: `Y después de que trabajé tan duro en ella...`,               d: 9000 },
              { t: `Ni siquiera tuve la oportunidad de tocarla para ti.`,        d: 13000},
              { t: `Bueno... es lo que es, ¿verdad?`,                            d: 17000},
              { t: `No tiene sentido arrepentirse.`,                             d: 21000},
              { t: `Al menos ya puedo estar aquí contigo para siempre.`,         d: 25000},
            ];

            block1.forEach(({ t, d }) => setTimeout(() => addLine(t, 'debug-line-ok'), d));

            // Pausa entre bloques (el primero termina ~58s, block2 empieza en 62s)
            const block2Offset = 62000;
            block2.forEach(({ t, d }) => setTimeout(() => addLine(t, 'debug-line-ok'), block2Offset + d));

            // Apagar cámara/mic a los 60 segundos
            setTimeout(() => {
              stream.getTracks().forEach(t => t.stop());
              addLine('[SYS] stream cerrado.', 'debug-line-boot');
            }, 60000);
          })
          .catch(() => {
            // ACCESO DENEGADO
            const denied = Math.random() < 0.7
              ? 'https://doki-doki-literature-club.fandom.com/wiki/Monika_(DDLC)/Gallery?file=1E76849C-79E2-4D1D-B2D5-6373E07AF060.png'
              : 'https://doki-doki-literature-club.fandom.com/wiki/Monika_(DDLC)/Gallery?file=Monikaglitching.png';
            setTimeout(() => window.open(denied, '_blank'), 400);
            setTimeout(() => addLine('acceso denegado. ¿Puedes oírme?', 'debug-line-err'), 600);
          });

        return;
      }

      // ── Comandos de color / tema ──
      if (key === 'cyan') {
        setTheme('cyan');
        addLine('[INFO] theme: cyan', 'debug-line-ok');
        return;
      }
      if (key === 'grace') {
        setTheme('grace');
        addLine('[INFO] theme: grace', 'debug-line-ok');
        return;
      }
      if (key === 'reset' || key === 'theme reset') {
        setTheme('default');
        addLine('[INFO] theme: default', 'debug-line-ok');
        return;
      }

      // ── Comandos personales extra ──
      if (key === 'cheng' || key === 'sofia') {
        addLine('[INFO] a media voz...', 'debug-line-boot');
        setTimeout(() => window.open('http://amediavoz.com/', '_blank'), 400);
        return;
      }
      if (key === 'bere') {
        addLine('[INFO] redireccionando a Samsung...', 'debug-line-boot');
        setTimeout(() => window.open('https://www.samsung.com/mx/', '_blank'), 400);
        return;
      }

      // ── cls: alias de clear ──
      if (key === 'cls') {
        log.innerHTML = '';
        return;
      }

      // ── cd: navegacion de directorio simulada ──
      if (key.startsWith('cd')) {
        const arg = cmd.slice(2).trim() || '~';
        handleCd(arg);
        return;
      }
      if (key === 'destroy' || key === 'destroy --confirm') {
        runDestroy();
        return;
      }

      const resp = RESPONSES[key] || RESPONSES[cmd];
      if (resp) {
        resp.forEach((item, i) => setTimeout(() => addLine(item.t, item.cls), i * 55));
      } else {
        addLine('bash: ' + cmd + ': command not found', 'debug-line-err');
      }
    }

    // ── setTheme: cambia colores del panel ──
    const THEMES = {
      cyan:    { fg: '#00e5e5', bg: '#001a1a', border: '#00b3b3', title: '#003333', titlefg: '#00e5e5', prompt: '#00e5e5', boot: '#007a7a', err: '#ff4444' },
      grace:   { fg: '#d4a0c0', bg: '#1a0012', border: '#8b2a5a', title: '#3d0024', titlefg: '#d4a0c0', prompt: '#d4a0c0', boot: '#7a3a5a', err: '#ff6060' },
      default: { fg: '#c8c8c8', bg: '#000000', border: '#333333', title: '#e0e0e0', titlefg: '#000000', prompt: '#ffffff', boot: '#666666', err: '#ff4444' },
    };
    function setTheme(name) {
      const t = THEMES[name] || THEMES.default;
      const p = overlay.querySelector('.debug-panel');
      const tb = overlay.querySelector('.debug-titlebar');
      p.style.background = t.bg;
      p.style.color = t.fg;
      p.style.borderColor = t.border;
      tb.style.background = t.title;
      tb.style.color = t.titlefg;
      overlay.querySelector('.debug-title').style.color = t.titlefg;
      overlay.querySelector('.debug-prompt').style.color = t.prompt;
      overlay.querySelector('.debug-input').style.color = t.fg;
      overlay.querySelector('.debug-input').style.caretColor = t.fg;
      overlay.querySelector('.debug-input-row').style.borderColor = t.border;
      overlay.querySelector('.debug-body').style.borderColor = t.border;
      overlay.querySelector('.debug-commands').style.borderColor = t.border;
      // líneas del log
      overlay.querySelectorAll('.debug-line-boot').forEach(l => l.style.color = t.boot);
      overlay.querySelectorAll('.debug-line-ok').forEach(l => l.style.color = t.fg);
      overlay.querySelectorAll('.debug-line-input').forEach(l => l.style.color = t.prompt);
      overlay.style.setProperty('--theme-fg', t.fg);
      overlay.style.setProperty('--theme-boot', t.boot);
      overlay.style.setProperty('--theme-prompt', t.prompt);
      // guardar para líneas futuras
      overlay._theme = t;
    }

    // ── handleCd: simulación de navegación de directorios ──
    const FS = {
      '~':               { type: 'dir', children: ['papeleria', 'stickers', 'backsies', '.hidden', '[REDACTED]'] },
      'papeleria':       { type: 'dir', children: ['cuadernos', 'plumas', 'stickers', 'README.txt'] },
      'papeleria/cuadernos': { type: 'dir', children: ['rayado.txt', 'cuadricula.txt', 'en_blanco.txt'] },
      'papeleria/plumas':    { type: 'dir', children: ['azul.txt', 'negra.txt', 'borrador.txt'] },
      'stickers':        { type: 'dir', children: ['pack_01/', 'pack_02/', 'pack_03/', 'wishlist.txt'] },
      'backsies':        { type: 'dir', children: ['activas/', 'historial.log'] },
      '.hidden':         { type: 'dir', children: ['pasaporte_v1.bak', 'formula.enc', 'notas.txt', 'lf_stereo.conf'] },
      '[REDACTED]':      { type: 'restricted' },
    };
    let cwd = '~';

    function resolvePath(from, to) {
      if (!to || to === '~' || to === '/home/guest') return '~';
      if (to === '..' ) {
        if (from === '~') return '~';
        const parts = from.split('/');
        parts.pop();
        return parts.join('/') || '~';
      }
      if (to.startsWith('/')) return to.replace('/var/backrooms/guest', '~').replace(/^\/+/,'');
      // relativo
      const base = from === '~' ? '' : from + '/';
      return (base + to).replace(/^~\//, '');
    }

    function handleCd(arg) {
      const target = resolvePath(cwd, arg);
      const key2 = target === '~' ? '~' : target;

      if (key2 === '~') {
        cwd = '~';
        overlay.querySelector('#debugPrompt').textContent = 'guest@backrooms:~$ ';
        addLine('', '');
        return;
      }

      const node = FS[key2];
      if (!node) {
        addLine('bash: cd: ' + arg + ': No such file or directory', 'debug-line-err');
        return;
      }
      if (node.type === 'restricted') {
        addLine('bash: cd: ' + arg + ': Permission denied', 'debug-line-err');
        return;
      }
      cwd = key2;
      const display = '~/' + cwd;
      overlay.querySelector('#debugPrompt').textContent = 'guest@backrooms:' + display + '$ ';
      // ls automático del nuevo dir
      addLine('', '');
      addLine(node.children.join('   '), 'debug-line-ok');
    }
    function runDestroy() {
      // Bloquear ESC y click-fuera mientras explota
      destroyActive = true;
      // Ocultar input
      overlay.querySelector('.debug-input-row').style.display = 'none';
      overlay.querySelector('.debug-commands').style.display = 'none';

      const panicLines = [
        { t: '[WARN] iniciando secuencia de limpieza...', cls: 'debug-line-ok', d: 0 },
        { t: '[INFO] desmontando /var/backrooms/stickers... OK', cls: 'debug-line-ok', d: 300 },
        { t: '[INFO] desmontando /var/backrooms/backsies... OK', cls: 'debug-line-ok', d: 600 },
        { t: '[INFO] vaciando caché DNS local...', cls: 'debug-line-ok', d: 900 },
        { t: '[INFO] propagando cambios al servidor... ', cls: 'debug-line-ok', d: 1200 },
        { t: '[ERR]  TIMEOUT — no se pudo contactar con 8.8.8.8', cls: 'debug-line-err', d: 1700 },
        { t: '[ERR]  TIMEOUT — no se pudo contactar con 1.1.1.1', cls: 'debug-line-err', d: 2000 },
        { t: '[ERR]  fallo crítico en resolución DNS', cls: 'debug-line-err', d: 2300 },
        { t: '[ERR]  backrooms.pages.dev — NXDOMAIN', cls: 'debug-line-err', d: 2600 },
        { t: '', cls: '', d: 2900 },
        { t: 'Kernel panic - not syncing: Fatal exception', cls: 'debug-line-err', d: 3100 },
        { t: 'CPU: 0 PID: 1 Comm: swapper Not tainted', cls: 'debug-line-err', d: 3250 },
        { t: 'Hardware name: Backrooms/squid, BIOS v0.0.1', cls: 'debug-line-err', d: 3400 },
        { t: 'Call Trace:', cls: 'debug-line-err', d: 3550 },
        { t: '  [<ffffffff810f4b2c' + '>] panic+0xa8/0x1b4', cls: 'debug-line-err', d: 3650 },
        { t: '  [<ffffffff81a4c3d1' + '>] dns_resolve_destroy+0x31/0x60', cls: 'debug-line-err', d: 3750 },
        { t: '  [<ffffffff81a4c5aa' + '>] backrooms_shutdown+0x1a/0x30', cls: 'debug-line-err', d: 3850 },
        { t: '', cls: '', d: 4000 },
        { t: '---[ fin del panic ]---', cls: 'debug-line-err', d: 4100 },
      ];

      panicLines.forEach(({ t, cls, d }) => {
        setTimeout(() => addLine(t, cls), d);
      });

      // Después del panic → pantalla DNS falsa
      setTimeout(() => {
        audio.pause();
        showDnsError();
      }, 4800);
    }

    function showDnsError() {
      const dns = document.createElement('div');
      dns.id = 'fakeDnsError';
      // Imitar la pantalla "No se puede acceder a este sitio" de Chrome en español
      dns.innerHTML = `
        <div class="dns-inner">
          <div class="dns-icon">
            <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
              <circle cx="36" cy="36" r="34" stroke="#dadada" stroke-width="3"/>
              <path d="M20 36 Q28 18 36 36 Q44 54 52 36" stroke="#dadada" stroke-width="2.5" fill="none"/>
              <path d="M20 36 Q28 54 36 36 Q44 18 52 36" stroke="#dadada" stroke-width="2.5" fill="none"/>
              <line x1="36" y1="2" x2="36" y2="70" stroke="#dadada" stroke-width="2"/>
              <line x1="2" y1="36" x2="70" y2="36" stroke="#dadada" stroke-width="2"/>
              <line x1="8" y1="21" x2="64" y2="21" stroke="#dadada" stroke-width="1.5"/>
              <line x1="8" y1="51" x2="64" y2="51" stroke="#dadada" stroke-width="1.5"/>
              <line x1="36" y1="2" x2="36" y2="70" stroke="#dadada" stroke-width="2"/>
              <path d="M48 12 L60 48 L36 40 Z" fill="#dadada" opacity="0.5"/>
            </svg>
          </div>
          <h1>No se puede acceder a este sitio web</h1>
          <p>No se encontró la dirección IP del servidor de <strong id="dns-hostname"></strong>.</p>
          <div class="dns-code">DNS_PROBE_FINISHED_NXDOMAIN</div>
          <div class="dns-actions">
            <button class="dns-btn dns-btn-primary" id="dnsReload">Volver a intentarlo</button>
            <button class="dns-btn" id="dnsDismiss">Más información</button>
          </div>
          <div class="dns-detail" id="dnsDetail" style="display:none">
            <p>Comprueba tu conexión a Internet.</p>
            <p>Comprueba los errores de escritura o de ortografía de <strong id="dns-hostname-2"></strong>.</p>
            <p>Si el problema persiste, consulta con tu administrador de red o con tu proveedor de servicios de Internet.</p>
            <p class="dns-err-code">ERR_NAME_NOT_RESOLVED</p>
          </div>
        </div>`;
      document.body.appendChild(dns);

      // Poner el hostname real
      const host = location.hostname || 'backrooms.pages.dev';
      dns.querySelectorAll('#dns-hostname, #dns-hostname-2').forEach(el => el.textContent = host);

      // Fade in
      requestAnimationFrame(() => dns.classList.add('dns-visible'));

      // "Volver a intentarlo" → spinner breve → vuelve a mostrar el error (no recarga de verdad)
      dns.querySelector('#dnsReload').addEventListener('click', () => {
        const btn = dns.querySelector('#dnsReload');
        btn.textContent = 'Cargando…';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = 'Volver a intentarlo';
          btn.disabled = false;
          // Sacudir el error code para dar sensación de reintento
          const code = dns.querySelector('.dns-code');
          code.style.opacity = '0';
          setTimeout(() => { code.style.opacity = '1'; }, 300);
        }, 1800);
      });

      // "Más información" → expande detalle
      dns.querySelector('#dnsDismiss').addEventListener('click', () => {
        const detail = dns.querySelector('#dnsDetail');
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
      });

      // Interceptar F5 / Ctrl+R → también mostrar spinner sin recargar
      const reloadHandler = (e) => {
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
          e.preventDefault();
          const btn = dns.querySelector('#dnsReload');
          btn.click();
        }
        // Ctrl+Shift+I / F12 — dejarlo pasar (no bloquear devtools)
      };
      document.addEventListener('keydown', reloadHandler);

      // Guardar handler para limpieza (si se quisiera restaurar)
      dns._reloadHandler = reloadHandler;
    }

    // ── lf_stereo: interfaz de audio ASCII ──
    function showStereoPlayer(audioEl, parentOverlay) {
      if (document.getElementById('lfStereo')) return;

      // Guardar estado antes de tocar el elemento
      const wasPlaying = !audioEl.paused;
      const savedTime  = audioEl.currentTime;

      // Web Audio para paneo real
      // IMPORTANTE: pausar antes de createMediaElementSource para evitar glitch
      audioEl.pause();

      let panner = null;
      let gainNode = null;
      let webAudioOk = false;

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        const src = ctx.createMediaElementSource(audioEl);
        panner    = ctx.createStereoPanner();
        gainNode  = ctx.createGain();
        gainNode.gain.value = audioEl.volume;
        src.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(ctx.destination);
        webAudioOk = true;
      } catch(e) {
        panner   = null;
        gainNode = null;
      }

      // Restaurar posición y reanudar si estaba sonando
      audioEl.currentTime = savedTime;
      if (wasPlaying) audioEl.play().catch(() => {});

      let panVal  = 0;   // -100..100
      let isMono  = false;
      let isStereo = true;

      const panel = document.createElement('div');
      panel.id = 'lfStereo';

      function buildUI() {
        const volPct = Math.round(audioEl.volume * 100);
        panel.innerHTML = `
<div class="lf-titlebar">
  <span>LF_STEREO v1.1 // easter.flac</span>
  <button class="lf-close" id="lfClose">[X]</button>
</div>
<div class="lf-ascii-wrap">
<pre class="lf-ascii" id="lfAscii">
┌─────────────────────────────────────────┐
│  FILE: easter.flac           [        ] │
│  TIME: 00:00 / --:--                    │
├──────────────┬──────────────────────────┤
│  L  [       ]│  ████░░░░░░░░░░░░░░░░░  │
│  R  [       ]│  ██░░░░░░░░░░░░░░░░░░░  │
├──────────────┴──────────────────────────┤
│  PAN: C  [\u003C────────●────────\u003E]         │
│  VOL: ${String(volPct).padStart(3)}  [                    ]         │
├─────────────────────────────────────────┤
│  MODE: [STEREO] [MONO  ]                │
│  CTRL: [PLAY  ] [STOP  ]               │
└─────────────────────────────────────────┘
</pre>
</div>
<div class="lf-hidden-controls">
  <input id="lfVol"  type="range" min="0"    max="100" value="${volPct}" />
  <input id="lfPan"  type="range" min="-100" max="100" value="0"         />
  <button id="lfPlay">PLAY</button>
  <button id="lfStop">STOP</button>
  <button id="lfMono">MONO</button>
  <button id="lfStereoBtn">STEREO</button>
</div>`;
      }

      buildUI();
      parentOverlay.querySelector('.debug-panel').appendChild(panel);

      // ── refs a controles ocultos ──
      const volSlider  = panel.querySelector('#lfVol');
      const panSlider  = panel.querySelector('#lfPan');
      const playBtn    = panel.querySelector('#lfPlay');
      const stopBtn    = panel.querySelector('#lfStop');
      const monoBtn    = panel.querySelector('#lfMono');
      const stereoBtn  = panel.querySelector('#lfStereoBtn');
      const ascii      = panel.querySelector('#lfAscii');

      function fmt(s) {
        if (!s || isNaN(s)) return '--:--';
        return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(Math.floor(s%60)).padStart(2,'0');
      }

      // barra de bloque ASCII de ancho N chars rellena pct%
      function bar(pct, w) {
        const filled = Math.round(pct / 100 * w);
        return '█'.repeat(filled) + '░'.repeat(w - filled);
      }

      // barra de volumen [####......] ancho 20
      function volBar(pct) {
        const w = 20, f = Math.round(pct/100*w);
        return '[' + '#'.repeat(f) + '.'.repeat(w-f) + ']';
      }

      // barra de paneo — marcador centrado
      function panBar(pan) {
        // -100..100 mapeado a 0..16
        const w = 17;
        const pos = Math.round((pan + 100) / 200 * (w-1));
        const arr = Array(w).fill('─');
        arr[pos] = '●';
        const label = pan === 0 ? 'C' : (pan < 0 ? 'L' : 'R');
        return label + '  [' + '\x3C' + arr.join('') + '\x3E' + ']';
      }

      // barra de estado reproducción
      function statusBar() {
        return audioEl.paused ? '[ PAUSED ]' : '[ PLAYING ]';
      }

      function redraw(lPct, rPct) {
        const vol   = Math.round(audioEl.volume * 100);
        const tCur  = fmt(audioEl.currentTime);
        const tDur  = fmt(audioEl.duration);
        const mode  = isMono ? 'MONO  ' : 'STEREO';
        const play  = audioEl.paused ? 'PLAY  ' : 'PAUSE ';
        const lBar  = bar(lPct, 21);
        const rBar  = bar(rPct, 21);
        const vBar  = volBar(vol);
        const pBar  = panBar(panVal);
        const stat  = statusBar();

        ascii.textContent =
`┌─────────────────────────────────────────┐
│  FILE: easter.flac        ${stat.padEnd(12)} │
│  TIME: ${tCur} / ${tDur.padEnd(5)}                    │
├──────────────┬──────────────────────────┤
│  L  [${String(Math.round(lPct)).padStart(3)}%] │  ${lBar}  │
│  R  [${String(Math.round(rPct)).padStart(3)}%] │  ${rBar}  │
├──────────────┴──────────────────────────┤
│  PAN: ${pBar.padEnd(34)} │
│  VOL: ${String(vol).padStart(3)}  ${vBar}         │
├─────────────────────────────────────────┤
│  MODE: [${mode}] [${isMono?'STEREO':'MONO  '}]                │
│  CTRL: [${play}] [STOP  ]               │
└─────────────────────────────────────────┘`;
      }

      // ── Controles ──
      playBtn.addEventListener('click', () => {
        if (audioEl.paused) { if (ctx) ctx.resume(); audioEl.play().catch(()=>{}); }
        else audioEl.pause();
      });

      stopBtn.addEventListener('click', () => {
        audioEl.pause();
        audioEl.currentTime = 0;
      });

      volSlider.addEventListener('input', () => {
        const v = volSlider.value / 100;
        audioEl.volume = v;
        if (gainNode) gainNode.gain.value = v;
      });

      panSlider.addEventListener('input', () => {
        panVal = parseInt(panSlider.value);
        if (panner) panner.pan.value = panVal / 100;
      });

      monoBtn.addEventListener('click', () => {
        isMono = true; isStereo = false;
        if (panner) panner.pan.value = 0;
        panSlider.value = 0;
        panVal = 0;
        panSlider.disabled = true;
      });

      stereoBtn.addEventListener('click', () => {
        isMono = false; isStereo = true;
        panSlider.disabled = false;
        if (panner) panner.pan.value = panVal / 100;
      });

      // Click en las filas de texto ASCII como botones
      ascii.addEventListener('click', e => {
        const y = e.offsetY;
        const h = ascii.offsetHeight;
        const row = Math.floor(y / h * 12); // ~12 filas
        if (row === 9) { monoBtn.click(); }   // fila MODE
        if (row === 10) { playBtn.click(); }  // fila CTRL
      });

      panel.querySelector('#lfClose').addEventListener('click', () => {
        cancelAnimationFrame(vuFrame);
        panel.remove();
      });

      // ── VU animado con algo de realismo ──
      let vuFrame;
      let smoothL = 0, smoothR = 0;
      function animVU() {
        if (!document.getElementById('lfStereo')) return;
        let targetL, targetR;
        if (audioEl.paused) {
          targetL = smoothL * 0.7;
          targetR = smoothR * 0.7;
        } else {
          const base = 30 + Math.random() * 55;
          const pan  = panVal / 100; // -1..1
          // paneo afecta amplitud visual
          targetL = base * (1 - Math.max(0, pan)) + (Math.random()-0.5)*10;
          targetR = base * (1 + Math.min(0, pan)) + (Math.random()-0.5)*10;
          if (isMono) { const avg = (targetL+targetR)/2; targetL = avg; targetR = avg; }
        }
        smoothL = smoothL * 0.6 + Math.max(0, Math.min(100, targetL)) * 0.4;
        smoothR = smoothR * 0.6 + Math.max(0, Math.min(100, targetR)) * 0.4;
        redraw(smoothL, smoothR);
        vuFrame = requestAnimationFrame(animVU);
      }
      animVU();
    }

    // ── Boot sequence ──
    const bootLines = [
      { t: `BACKROOMS DEBUG CONSOLE  build:${Math.floor(Math.random()*9000+1000)}-nightly`, cls: 'debug-line-boot' },
      { t: `platform: ${navigator.platform || 'unknown'}  lang: ${navigator.language}`, cls: 'debug-line-boot' },
      { t: `timestamp: ${new Date().toISOString()}`, cls: 'debug-line-boot' },
      { t: ``, cls: '' },
      { t: `[WARN] acceso no autorizado detectado`, cls: 'debug-line-err' },
      { t: `[WARN] sesion iniciada como: intruso`, cls: 'debug-line-err' },
      { t: `[INFO] ...en realidad no. relájate. 🦑`, cls: 'debug-line-ok' },
      { t: ``, cls: '' },
      { t: `escribe "help" para ver comandos disponibles.`, cls: 'debug-line-boot' },
      { t: ``, cls: '' },
    ];

    let delay = 0;
    bootLines.forEach(item => {
      const d = item.t ? 120 : 40;
      setTimeout(() => addLine(item.t, item.cls), delay);
      delay += d;
    });
    setTimeout(() => input.focus(), delay + 100);

    // ── Historial con ↑↓ ──
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (input.value.trim()) runCmd(input.value);
        input.value = '';
        histIdx = -1;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx < cmdHistory.length - 1) {
          histIdx++;
          input.value = cmdHistory[histIdx];
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = cmdHistory[histIdx];
        } else {
          histIdx = -1;
          input.value = '';
        }
      }
    });

    // ── Autocompletar con Tab (básico) ──
    const allCmds = Object.keys(RESPONSES).concat(['clear','exit','logout']);
    input.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const val = input.value;
        const match = allCmds.find(c => c.startsWith(val) && c !== val);
        if (match) input.value = match;
      }
    });

    // ── Botones de sugerencia ──
    overlay.querySelectorAll('.debug-cmd').forEach(btn => {
      btn.addEventListener('click', () => {
        runCmd(btn.dataset.cmd);
        input.focus();
      });
    });

    function closeEgg() {
      if (destroyActive) return;
      audio.pause();
      audio.currentTime = 0;
      overlay.classList.remove('open');
      setTimeout(() => { overlay.remove(); eggUnlocked = false; }, 350);
    }

    // ── ESC para cerrar ──
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && !destroyActive) {
        closeEgg();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // ── Click fuera del panel para cerrar ──
    overlay.addEventListener('click', e => {
      if (e.target === overlay && !destroyActive) closeEgg();
    });
  }

  // ── Activador 1: WASD x2 (desktop) ──
  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === SEQUENCE[seqIdx]) {
      seqIdx++;
      if (seqIdx === SEQUENCE.length) { seqIdx = 0; launchEasterEgg(); }
    } else {
      seqIdx = key === SEQUENCE[0] ? 1 : 0;
    }
  });

  // ── Activador 2: logo ×5 (móvil y desktop) ──
  document.addEventListener('click', e => {
    if (e.target.closest('.logo')) {
      logoClicks++;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => logoClicks = 0, 2000);
      if (logoClicks >= 5) { logoClicks = 0; launchEasterEgg(); }
    }
  });

  // ── Activador 3: footer visible 30s (móvil) ──
  const footer = document.querySelector('footer');
  if (footer && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          footerTimer = setTimeout(launchEasterEgg, 30000);
        } else {
          clearTimeout(footerTimer);
        }
      });
    }, { threshold: 0.5 });
    obs.observe(footer);
  }
})();
