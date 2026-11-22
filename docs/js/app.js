/* 农小禾健康 · 主应用（用户端 + 管理端）
 * 说明：演示版数据保存在浏览器 localStorage，并同步到本地服务端 data/store.json
 */
(function () {
  const D = window.NXH_DATA;
  const E = window.NXH_ENGINE;
  const CH = window.NXH_CHAT;

  const VIRTUAL_PHONE = '59684721315';
  const ADMIN_CODE = 'NXH101';
  const LS_KEY = 'nxh_store_v1';
  const LS_SESSION = 'nxh_session';
  const SS_ADMIN = 'nxh_admin';
  const WELCOME = '你好呀，我是小禾。我记得你喜欢实在、健康的东西。想吃好一点、想说说话、想挑份礼——都找我。今天想聊点什么？';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayKey = () => new Date().toLocaleDateString('sv-SE');
  const fmtTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  let store = { users: [], posts: [], products: [], reports: [], feedbacks: [] };
  let me = null;
  let tab = 'home';
  let saveTimer = null;
  let quiz = { step: 1, draft: null, loading: false };
  let ui = { planDay: 0, marketCat: '全部', chatBusy: false, adminPanel: 'products', adminSearch: '', sharePost: null };
  let modalStack = [];

  /* ============================================================
     数据层
     ============================================================ */
  function seedDemoUsers() {
    const defs = [
      { phone: '13800000001', name: '林小满', avatar: '🌿', points: 1260, gender: 'female', age: 27, height: 163, weight: 58, goal: 'fatloss', target: 53, chronic: [], avoid: [], wish: ['p2', 'p8'] },
      { phone: '13800000002', name: '陈建国', avatar: '🌾', points: 2100, gender: 'male', age: 56, height: 172, weight: 78, goal: 'chronic', target: 72, chronic: ['高血压', '糖尿病'], avoid: ['pork'], wish: ['p2', 'p9', 'p3'] },
      { phone: '13800000003', name: '苏禾', avatar: '🍃', points: 540, gender: 'female', age: 31, height: 168, weight: 61, goal: 'keep', target: 60, chronic: [], avoid: ['seafood'], wish: ['p1', 'p5'] },
    ];
    return defs.map((d, i) => {
      const profile = {
        gender: d.gender, age: d.age, height: d.height, weight: d.weight, goal: d.goal,
        targetWeight: d.target, periodWeeks: 12, rate: 0.5, waist: 78, trainDays: 3, sessionMin: 40,
        equip: ['home'], activity: 'light', chronic: d.chronic, avoid: d.avoid, dietModes: ['均衡'],
        mealsPerDay: 3, cookTime: '30min', source: ['自炊'], cityTier: 't2', mealBudget: 30,
        sleep: '7h', stress: '中', elder: d.goal === 'elder', trainBase: 'some', injury: ['无'],
      };
      const plan = E.buildPlan(profile);
      const uid = 'demo_u' + (i + 1);
      return {
        id: uid, phone: d.phone, name: d.name, avatar: d.avatar, joinedAt: Date.now() - (i + 2) * 86400000,
        profile, plan, planText: CH.fallbackNarrative(profile, plan),
        chat: [{ role: 'assistant', content: WELCOME, time: fmtTime() }], chatRounds: 3 + i * 2,
        checkins: {}, streak: 6 + i * 3, lastCheck: todayKey(), points: d.points,
        records: { weight: [{ v: d.weight, date: todayKey() }], meal: [], exercise: [] },
        wishlist: d.wish, redemptions: [], supervise: { date: '', count: 0, targets: [] },
        treehole: [], warnings: [], settings: { elder: false }, demo: true,
      };
    });
  }

  function seedStore() {
    const products = D.PRODUCTS.map((p) => ({ ...p, points: p.price * 20 }));
    return {
      users: seedDemoUsers(),
      posts: JSON.parse(JSON.stringify(D.SEED_POSTS)),
      products,
      reports: [],
      feedbacks: [],
      orders: [],
    };
  }

  function normalizeStore(s) {
    const out = s && typeof s === 'object' ? s : {};
    out.users = Array.isArray(out.users) ? out.users : [];
    out.posts = Array.isArray(out.posts) ? out.posts : [];
    out.products = Array.isArray(out.products) ? out.products : [];
    out.reports = Array.isArray(out.reports) ? out.reports : [];
    out.feedbacks = Array.isArray(out.feedbacks) ? out.feedbacks : [];
    out.orders = Array.isArray(out.orders) ? out.orders : [];
    if (!out.products.length) out.products = D.PRODUCTS.map((p) => ({ ...p, points: p.price * 20 }));
    // 自愈：早期同步可能只写入了个别商品，这里把缺失的种子商品补回来
    if (out.products.length < 3) {
      const have = new Set(out.products.map((p) => p.id));
      D.PRODUCTS.forEach((p) => {
        if (!have.has(p.id)) out.products.push({ ...p, points: p.price * 20 });
      });
    }
    out.products.forEach((p) => { p.points = Math.round((p.price || 0) * 20); });
    if (!out.users.length) out.users = seedDemoUsers();
    if (!out.posts.length) out.posts = JSON.parse(JSON.stringify(D.SEED_POSTS));
    out.users.forEach((u) => {
      u.checkins = u.checkins || {};
      u.records = u.records || { weight: [], meal: [], exercise: [] };
      u.records.weight = u.records.weight || [];
      u.records.meal = u.records.meal || [];
      u.records.exercise = u.records.exercise || [];
      u.wishlist = u.wishlist || [];
      u.redemptions = u.redemptions || [];
      u.chat = u.chat || [{ role: 'assistant', content: WELCOME, time: fmtTime() }];
      u.supervise = u.supervise || { date: '', count: 0, targets: [] };
      u.treehole = u.treehole || [];
      u.warnings = u.warnings || [];
      u.settings = u.settings || { elder: false };
      u.points = typeof u.points === 'number' ? u.points : 0;
      u.streak = u.streak || 1;
    });
    return out;
  }

  /* ---------------- 数据层：云端为主，本地缓存兜底 ---------------- */
  let snap = {};            // coll:id -> JSON 快照，用于逐行 diff
  let syncing = false;
  let dirtyAgain = false;
  let syncTimer2 = null;
  let lastPull = 0;
  let bootSynced = false;
  let pendingSave = false;
  let cloudState = 'unknown'; // unknown | ok | fail

  const COLL_LOCAL = ['users', 'posts', 'products', 'reports', 'feedbacks', 'orders'];

  function collectionsMap() {
    return {
      users: store.users,
      posts: store.posts,
      products: store.products,
      reports: store.reports || [],
      feedbacks: store.feedbacks || [],
      orders: store.orders || [],
    };
  }

  function rowIdOf(coll, item) {
    if (coll === 'users') return item.phone;
    return item.id;
  }

  function snapshot() {
    snap = {};
    const map = collectionsMap();
    COLL_LOCAL.forEach((coll) => {
      (map[coll] || []).forEach((item) => {
        const id = rowIdOf(coll, item);
        if (id) snap[coll + ':' + id] = JSON.stringify(item);
      });
    });
  }

  async function loadStore() {
    let base = null;
    let fromCloud = false;
    let cloudEmpty = false;

    // 1) 云端
    if (window.NXH_CLOUD) {
      try {
        const c = await window.NXH_CLOUD.pullAll();
        cloudState = 'ok';
        if (c.users && c.users.length) { base = c; fromCloud = true; }
        else {
          // 只有「全空」才当作首次上云；云端已有商品/帖子时不能拿本地种子覆盖
          cloudEmpty = !(c.products.length || c.posts.length || c.orders.length || (c.reports || []).length);
        }
      } catch (e) {
        cloudState = 'fail';
      }
    }

    // 2) 旧服务端存档（迁移用）
    if (!base) {
      try {
        const r = await fetch('/api/store', { cache: 'no-store' });
        if (r.ok) {
          const remote = await r.json();
          if (remote && remote.users && remote.users.length) base = remote;
        }
      } catch (e) { /* ignore */ }
    }

    // 3) 本地缓存
    if (!base) {
      try {
        const local = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (local && local.users && local.users.length) base = local;
      } catch (e) { /* ignore */ }
    }

    if (!base || !base.users || !base.users.length) base = seedStore();
    base.orders = Array.isArray(base.orders) ? base.orders : [];
    store = normalizeStore(base);
    localStorage.setItem(LS_KEY, JSON.stringify(store));
    snapshot();

    // 云端是空的（首次上云）：把种子/旧数据推上去，等推完再允许刷新
    if (cloudEmpty) {
      cloudState = 'ok';
      snap = {}; // 云端为空：本地全量视为待上传
      await syncNow();
      bootSynced = true;
    } else if (fromCloud) {
      bootSynced = true;
      // 云端已是最新，不再回写
    } else if (cloudState === 'fail') {
      pushRemote(true);
    }
  }

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
    pendingSave = true;
    if (window.NXH_CLOUD && cloudState !== 'fail') {
      clearTimeout(syncTimer2);
      syncTimer2 = setTimeout(syncNow, 600);
    } else {
      pushRemote(false);
    }
  }

  // 关键动作（支付、兑换、打卡）立即写云端，不等防抖
  function saveNow() {
    save();
    if (window.NXH_CLOUD && cloudState !== 'fail') {
      clearTimeout(syncTimer2);
      syncNow();
    }
  }

  function pushRemote(immediate) {
    clearTimeout(saveTimer);
    const run = () => {
      fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {});
    };
    if (immediate) return run();
    saveTimer = setTimeout(run, 500);
  }

  async function syncNow() {
    if (!window.NXH_CLOUD) return;
    if (syncing) { dirtyAgain = true; return; }
    syncing = true;
    try {
      const map = collectionsMap();
      const upserts = [];
      const current = {};
      COLL_LOCAL.forEach((coll) => {
        (map[coll] || []).forEach((item) => {
          const id = rowIdOf(coll, item);
          if (!id) return;
          const key = coll + ':' + id;
          current[key] = 1;
          const json = JSON.stringify(item);
          if (snap[key] !== json) {
            upserts.push({ collection: window.NXH_CLOUD.collectionOf(coll), id: String(id), data: item });
          }
        });
      });

      const deletes = {};
      Object.keys(snap).forEach((key) => {
        if (current[key]) return;
        const idx = key.indexOf(':');
        const coll = key.slice(0, idx);
        const id = key.slice(idx + 1);
        const cloudColl = window.NXH_CLOUD.collectionOf(coll);
        if (!cloudColl) return;
        (deletes[cloudColl] = deletes[cloudColl] || []).push(id);
      });

      if (upserts.length || Object.keys(deletes).length) {
        await window.NXH_CLOUD.push({ upserts, deletes });
      }
      snapshot();
      cloudState = 'ok';
      pendingSave = false;
      bootSynced = true;
      updateCloudBadge();
    } catch (e) {
      cloudState = 'fail';
      updateCloudBadge();
      pushRemote(false);
    } finally {
      syncing = false;
      if (dirtyAgain) { dirtyAgain = false; save(); }
    }
  }

  // 跨设备 / 管理员改动的刷新（节流）
  function mergeRows(local, remote, key) {
    const map = new Map();
    (local || []).forEach((x) => { const k = key(x); if (k) map.set(k, x); });
    (remote || []).forEach((x) => { const k = key(x); if (k) map.set(k, x); });
    return Array.from(map.values());
  }

  async function refreshFromCloud(force) {
    if (!window.NXH_CLOUD || syncing || pendingSave || !bootSynced) return false;
    if (cloudState === 'fail') return false;
    const now = Date.now();
    if (!force && now - lastPull < 60000) return false;
    if (document.visibilityState === 'hidden') return false;
    lastPull = now;
    try {
      const c = await window.NXH_CLOUD.pullAll();
      if (!c.users || !c.users.length) return false;
      // 合并而不是覆盖：避免把本地刚改、还没推上去的行冲掉
      store.users = mergeRows(store.users, c.users, (x) => x.phone);
      store.posts = mergeRows(store.posts, c.posts, (x) => x.id);
      store.products = mergeRows(store.products, c.products, (x) => x.id);
      store.reports = mergeRows(store.reports, c.reports, (x) => x.id);
      store.feedbacks = mergeRows(store.feedbacks, c.feedbacks, (x) => x.id);
      store.orders = mergeRows(store.orders, c.orders, (x) => x.id);
      store = normalizeStore(store);
      localStorage.setItem(LS_KEY, JSON.stringify(store));
      snapshot();
      cloudState = 'ok';
      if (me) me = findByPhone(me.phone) || me;
      updateCloudBadge();
      return true;
    } catch (e) {
      return false;
    }
  }

  function updateCloudBadge() {
    const el = document.getElementById('cloud-state');
    if (!el) return;
    const ok = cloudState === 'ok' && window.NXH_CLOUD && window.NXH_CLOUD.available();
    el.textContent = ok ? '云端已同步' : (cloudState === 'fail' ? '离线缓存 · 待重新连接' : '正在连接云端');
    el.className = 'cloud-state ' + (ok ? 'ok' : (cloudState === 'fail' ? 'bad' : 'wait'));
  }

  const findByPhone = (phone) => store.users.find((u) => u.phone === phone);
  const userById = (id) => store.users.find((u) => u.id === id);

  function newUser(phone) {
    return {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      phone, name: '禾友' + phone.slice(-4), avatar: '🌿', joinedAt: Date.now(),
      profile: null, plan: null, planText: null,
      chat: [{ role: 'assistant', content: WELCOME, time: fmtTime() }], chatRounds: 0,
      checkins: {}, streak: 1, lastCheck: null, points: 20,
      records: { weight: [], meal: [], exercise: [] },
      wishlist: [], redemptions: [], supervise: { date: '', count: 0, targets: [] },
      treehole: [], warnings: [], settings: { elder: false },
    };
  }

  /* ============================================================
     通用 UI
     ============================================================ */
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = 'toast'; }, 2400);
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function openModal(inner, opts) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask' + (opts && opts.center ? ' center' : '');
    mask.innerHTML = `<div class="modal">${inner}</div>`;
    mask.addEventListener('click', (e) => { if (e.target === mask && !(opts && opts.locked)) closeModal(mask); });
    $('#modal-root').appendChild(mask);
    modalStack.push(mask);
    document.body.classList.add('has-modal');
    return mask;
  }
  function closeModal(mask) {
    const m = mask || modalStack[modalStack.length - 1];
    if (m && m.parentNode) m.parentNode.removeChild(m);
    modalStack = modalStack.filter((x) => x !== m);
    if (!modalStack.length) document.body.classList.remove('has-modal');
  }
  function closeAllModals() {
    modalStack.forEach((m) => m.remove());
    modalStack = [];
    document.body.classList.remove('has-modal');
  }

  /* ============================================================
     登录
     ============================================================ */
  let pendingCode = '';
  let codeExpire = 0;
  let consent = false;

  function bindLogin() {
    const phoneEl = $('#login-phone');
    const codeEl = $('#login-code');
    const consentBox = $('#login-consent-box');
    const loginBtn = $('#btn-login');

    const syncBtn = () => {
      const phoneOK = /^\d{11}$/.test(phoneEl.value.trim());
      loginBtn.disabled = !(phoneOK && consent && codeEl.value.trim().length >= 4);
    };

    phoneEl.addEventListener('input', () => {
      phoneEl.value = phoneEl.value.replace(/\D/g, '').slice(0, 11);
      const isVirtual = phoneEl.value.trim() === VIRTUAL_PHONE;
      const adminTab = $('#tab-admin');
      if (adminTab) adminTab.classList.toggle('hide', !isVirtual);
      syncBtn();
    });
    codeEl.addEventListener('input', () => {
      codeEl.value = codeEl.value.replace(/\D/g, '').slice(0, 6);
      syncBtn();
    });
    consentBox.addEventListener('click', () => {
      consent = !consent;
      consentBox.classList.toggle('on', consent);
      syncBtn();
    });

    $('#btn-send-code').addEventListener('click', () => {
      const phone = phoneEl.value.trim();
      if (!/^\d{11}$/.test(phone)) { toast('请输入 11 位手机号', true); return; }
      pendingCode = String(Math.floor(100000 + Math.random() * 900000));
      codeExpire = Date.now() + 60000;
      const tip = $('#code-tip');
      tip.innerHTML = `演示环境验证码：<code>${pendingCode}</code>（60 秒内有效，正式环境由短信下发）`;
      tip.classList.add('show');
      const btn = $('#btn-send-code');
      btn.disabled = true;
      let left = 60;
      btn.textContent = left + 's 后重发';
      const timer = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = '获取验证码';
        } else btn.textContent = left + 's 后重发';
      }, 1000);
    });

    loginBtn.addEventListener('click', () => {
      const phone = phoneEl.value.trim();
      const code = codeEl.value.trim();
      if (!consent) { toast('请先勾选同意，再进入应用', true); return; }
      if (!pendingCode) { toast('请先获取验证码', true); return; }
      if (Date.now() > codeExpire) { toast('验证码已过期，请重新获取', true); return; }
      if (code !== pendingCode) { toast('验证码不正确', true); return; }

      if (phone === VIRTUAL_PHONE) {
        $('#tab-admin').classList.remove('hide');
        toast('已识别管理通道，请点击「管理员登录」');
        return;
      }
      enterApp(phone);
    });

    const adminEntry = $('#btn-admin-entry');
    if (adminEntry) adminEntry.addEventListener('click', () => App.roleTab('admin'));
    $('#aa-back').addEventListener('click', () => showScreen('login'));
    $('#btn-admin-verify').addEventListener('click', tryAdminLogin);
    $('#admin-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryAdminLogin(); });

    $('#btn-admin-exit').addEventListener('click', () => {
      sessionStorage.removeItem(SS_ADMIN);
      document.body.classList.remove('admin-mode');
      showScreen('login');
      toast('已退出管理后台');
    });
  }

  function roleTab(role) {
    if (role === 'admin') {
      showScreen('admin-auth');
      setTimeout(() => { const el = $('#admin-code'); if (el) el.focus(); }, 200);
      return;
    }
    showScreen('login');
    setTimeout(() => { const el = $('#login-phone'); if (el) el.focus(); }, 150);
  }

  function tryAdminLogin() {
    const code = $('#admin-code').value.trim().toUpperCase();
    if (code !== ADMIN_CODE) {
      $('#admin-err').textContent = 'ACCESS DENIED · 身份验证未通过';
      $('#admin-code').value = '';
      return;
    }
    $('#admin-err').textContent = '';
    sessionStorage.setItem(SS_ADMIN, '1');
    showAdmin();
    toast('管理员身份验证通过');
  }

  function enterApp(phone) {
    let user = findByPhone(phone);
    if (!user) {
      user = newUser(phone);
      store.users.push(user);
      save();
      setTimeout(() => toast('欢迎加入农小禾，已送上 20 新人积分'), 600);
    }
    me = user;
    localStorage.setItem(LS_SESSION, phone);
    document.body.classList.remove('admin-mode');
    document.documentElement.classList.toggle('elder', !!(me.settings && me.settings.elder));
    showScreen('main');
    switchTab('home');
    ensureChat();
    if (!me.plan) {
      setTimeout(showOnboarding, 260);
    } else {
      setTimeout(checkLapseWarn, 800);
    }
  }

  function logout() {
    localStorage.removeItem(LS_SESSION);
    me = null;
    closeAllModals();
    document.documentElement.classList.remove('elder');
    showScreen('login');
    toast('已退出登录');
  }

  /* ============================================================
     首屏弹窗
     ============================================================ */
  function showOnboarding() {
    const sample = {
      b: '鸡蛋 + 燕麦 + 牛奶', l: '鸡胸 + 糙米饭 + 西兰花', d: '清蒸鲈鱼 + 杂粮饭 + 时蔬',
    };
    const html = `
      <div class="ob-hero">
        <div class="eyebrow">FARM TO TABLE · 顺时而食</div>
        <h2>不用再纠结吃什么，<br/>6 个问题，给你一周的答案。</h2>
        <p>按你的身体数据、预算和忌口，把三餐与运动一次配好。不饿肚子，也不为难钱包。</p>
        <div class="ob-points">
          <span>✓ 6 题出方案</span><span>✓ 每餐算到元</span><span>✓ 忌口硬过滤</span><span>✓ 每周可调整</span>
        </div>
      </div>
      <div class="example-card">
        <div class="ex-head"><b>示例 · 减脂 ¥30/餐方案</b><span class="badge">1500 千卡</span></div>
        <div class="ex-meal"><span>早餐</span><span>${sample.b}</span></div>
        <div class="ex-meal"><span>午餐</span><span>${sample.l}</span></div>
        <div class="ex-meal"><span>晚餐</span><span>${sample.d}</span></div>
        <div class="ex-meal"><span>日均花费</span><span>约 ¥86 · 参考价</span></div>
      </div>
      <div class="mt-14">
        <button class="btn btn-primary btn-block btn-lg" onclick="App.startQuiz()">开始定制</button>
      </div>
      <div class="center tiny muted" style="margin-top:10px">约 90 秒 · 数据仅用于生成本次方案</div>
      <div class="center" style="margin-top:6px"><button class="tiny muted" onclick="App.closeOnboarding()">先随便看看</button></div>
    `;
    ui.onboarding = openModal(html);
  }

  /* ============================================================
     问卷
     ============================================================ */
  const GOAL_CARDS = [
    { v: 'fatloss', t: '减脂', d: '热量缺口 + 高蛋白，稳住肌肉' },
    { v: 'muscle', t: '增肌', d: '小盈余 + 力量训练，练出线条' },
    { v: 'keep', t: '健康保持', d: '维持体重，吃得均衡有精神' },
    { v: 'elder', t: '长辈养生', d: '控三高、保肌肉、低强度' },
    { v: 'chronic', t: '控三高', d: '慢病管理，饮食硬约束' },
  ];

  function defaultDraft() {
    const p = me && me.profile;
    if (p) return JSON.parse(JSON.stringify(p));
    return {
      gender: 'female', age: 28, height: 165, weight: 60, goal: 'fatloss',
      targetWeight: 55, periodWeeks: 12, rate: 0.5, waist: 76, dietHistory: [],
      trainYears: 'beginner', trainDays: 3, preferParts: [],
      metrics: { bp: '', glucose: '', lipid: '' }, sleep: '7h', stress: '中',
      chronic: [], mobility: 'normal', liveAlone: 'no', medication: '无',
      chronicTags: [], taboo: [], equip: ['home'], sessionMin: 40,
      trainBase: 'some', injury: ['无'], dietModes: ['均衡'], avoid: [],
      mealsPerDay: 3, cookTime: '30min', source: ['自炊'], cityTier: 't2', mealBudget: 30,
      elder: false,
    };
  }

  function startQuiz(elderMode) {
    quiz = { step: 1, draft: defaultDraft(), loading: false };
    if (elderMode) {
      quiz.draft.elder = true;
      quiz.draft.goal = 'elder';
    }
    closeAllModals();
    showScreen('quiz');
    renderQuiz();
  }

  const STEPS = [
    { key: 'base', title: '先认识一下你', sub: '这几项决定了你的热量基线，只算一次。' },
    { key: 'goal', title: '你想往哪儿走？', sub: '目标不同，吃和练的算法完全不同。' },
    { key: 'sport', title: '你能怎么动？', sub: '按真实条件来，别选一个坚持不了的计划。' },
    { key: 'diet', title: '你平时怎么吃？', sub: '忌口和过敏原会被硬性过滤，不会出现在方案里。' },
    { key: 'budget', title: '最后，聊聊预算', sub: '预算决定吃什么：钱花在蛋白质上最值。' },
  ];

  function renderQuiz() {
    if (!quiz.draft) quiz.draft = defaultDraft();
    const total = quiz.draft.elder ? 2 : 5;
    const step = quiz.step;
    const meta = STEPS[step - 1] || STEPS[0];
    const d = quiz.draft;

    if (quiz.loading) {
      $('#quiz-body').innerHTML = `
        <div class="loading-box" style="padding-top:70px">
          <div class="spinner"></div>
          <div class="lt" style="font-size:1rem">AI 正在为你搭配…</div>
          <div class="ls" id="loading-sub">先算热量目标，再按预算配食材</div>
          <div class="privacy-note" style="margin-top:26px;max-width:280px">🔒 我们极其注重您的隐私安全，数据仅用于生成本次方案</div>
        </div>`;
      $('#quiz-foot').innerHTML = '';
      $('#quiz-progress').style.width = '100%';
      return;
    }

    $('#quiz-top-step').textContent = step + ' / ' + total;
    $('#quiz-progress').style.width = Math.round((step / total) * 100) + '%';
    $('#quiz-top-label').textContent = d.elder ? '长辈模式 · 极简定制' : '定制我的方案';

    let html = `<div class="privacy-note">🔒 我们极其注重您的隐私安全，数据仅用于生成本次方案</div>
      <h2 class="quiz-title">${meta.title}</h2>
      <p class="quiz-sub">${meta.sub}</p>`;

    if (d.elder && step === 2) html += elderGoalStep(d);
    else if (step === 1) html += baseStep(d);
    else if (step === 2) html += goalStep(d);
    else if (step === 3) html += sportStep(d);
    else if (step === 4) html += dietStep(d);
    else html += budgetStep(d);

    $('#quiz-body').innerHTML = html;
    renderQuizFoot();
    bindRangePct();
  }

  function bindRangePct() {
    document.querySelectorAll('.quiz-body input[type=range]').forEach((r) => {
      const min = +r.min, max = +r.max, v = +r.value;
      r.style.setProperty('--pct', ((v - min) / (max - min)) * 100 + '%');
    });
  }

  function chip(key, value, label, sub, multi) {
    const d = quiz.draft;
    const on = multi ? (d[key] || []).includes(value) : d[key] === value;
    return `<button class="opt ${on ? 'on' : ''}" data-group="${key}" data-val="${esc(value)}" onclick="App.pick('${key}','${esc(value)}',${!!multi},this)">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  }

  function cardOpt(key, value, title, desc) {
    const on = quiz.draft[key] === value;
    return `<button class="opt opt-card ${on ? 'on' : ''}" data-group="${key}" data-val="${esc(value)}" onclick="App.pick('${key}','${esc(value)}',false,this)"><span class="t">${esc(title)}</span><span class="d">${esc(desc)}</span></button>`;
  }

  function slider(key, label, min, max, step, unit, hint) {
    const d = quiz.draft;
    const v = d[key] == null ? min : d[key];
    const pct = ((v - min) / (max - min)) * 100;
    return `<div class="q-block"><div class="q-label"><span>${label}</span>${hint ? `<em>${hint}</em>` : ''}</div>
      <div class="slider-box">
        <div class="row between" style="align-items:baseline">
          <span class="val"><span id="v-${key}">${v}</span><small>${unit}</small></span>
          <span class="tiny dim">可左右拖动</span>
        </div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" style="--pct:${pct}%" oninput="App.onSlide('${key}',this)" />
      </div></div>`;
  }

  function baseStep(d) {
    const bmiV = (d.weight / Math.pow(d.height / 100, 2));
    return `
      <div class="q-block"><div class="q-label"><span>性别</span><em>用于 BMR 公式</em></div>
        <div class="seg">
          <button class="${d.gender === 'male' ? 'on' : ''}" onclick="App.pick('gender','male',false,this)" data-group="gender" data-val="male">男</button>
          <button class="${d.gender === 'female' ? 'on' : ''}" onclick="App.pick('gender','female',false,this)" data-group="gender" data-val="female">女</button>
        </div>
      </div>
      ${slider('age', '年龄', 16, 80, 1, '岁')}
      ${slider('height', '身高', 140, 200, 1, 'cm')}
      ${slider('weight', '体重', 35, 150, 0.5, 'kg')}
      <div class="hint">当前 BMI <b class="num" id="bmi-live" style="color:var(--g700)">${bmiV.toFixed(1)}</b> · ${E.bmi(d.weight, d.height).label}。BMI 只是参考，腰围和体感更重要。</div>
    `;
  }

  function goalStep(d) {
    let html = `<div class="q-block"><div class="q-label"><span>健康目标</span><em>单选，决定后续算法</em></div>
      <div class="opts">${GOAL_CARDS.map((g) => cardOpt('goal', g.v, g.t, g.d)).join('')}</div></div>`;

    if (d.goal === 'fatloss') {
      html += `<div class="divider"></div>
        ${slider('targetWeight', '目标体重', 35, Math.max(40, d.weight), 0.5, 'kg', '不追求过快')}
        <div class="q-block"><div class="q-label"><span>期望周期</span></div>
          <div class="opts">${[8, 12, 16, 24].map((w) => chip('periodWeeks', w, w + ' 周')).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>可接受的每周减重速度</span></div>
          <div class="opts">${[{ v: 0.25, l: '0.25kg · 温和' }, { v: 0.5, l: '0.5kg · 标准' }, { v: 0.75, l: '0.75kg · 偏快' }].map((o) => chip('rate', o.v, o.l)).join('')}</div>
          <div class="hint">建议每周不超过体重的 1%，掉得太快容易掉肌肉。</div></div>
        <div class="q-block"><div class="q-label"><span>当前腰围</span><em>可选</em></div>
          <input class="input-mini" type="number" inputmode="numeric" placeholder="例如 76（cm）" value="${d.waist || ''}" oninput="App.setNum('waist',this.value)" /></div>
        <div class="q-block"><div class="q-label"><span>既往减肥经历</span><em>可跳过</em></div>
          <div class="opts">${['第一次尝试', '节食反弹过', '运动坚持不下来', '产后恢复', '平台期很久'].map((x) => chip('dietHistory', x, x, null, true)).join('')}</div></div>`;
    } else if (d.goal === 'muscle') {
      html += `<div class="divider"></div>
        ${slider('targetWeight', '目标体重', d.weight, d.weight + 20, 0.5, 'kg')}
        <div class="q-block"><div class="q-label"><span>训练年限</span></div>
          <div class="opts">${[{ v: 'beginner', l: '不到 1 年' }, { v: 'mid', l: '1–3 年' }, { v: 'advanced', l: '3 年以上' }].map((o) => chip('trainYears', o.v, o.l)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>每周可练天数</span></div>
          <div class="opts">${[2, 3, 4, 5, 6].map((n) => chip('trainDays', n, n + ' 天')).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>偏好训练部位</span><em>可多选</em></div>
          <div class="opts">${['胸肩', '背部', '臀腿', '手臂', '核心'].map((x) => chip('preferParts', x, x, null, true)).join('')}</div></div>`;
    } else if (d.goal === 'keep') {
      html += `<div class="divider"></div>
        <div class="q-block"><div class="q-label"><span>最近体检指标</span><em>可跳过</em></div>
          <div class="row" style="gap:8px">
            <input class="input-mini" type="number" placeholder="血压 收缩压" oninput="App.setMetric('bp',this.value)" value="${d.metrics.bp || ''}" />
            <input class="input-mini" type="number" placeholder="空腹血糖" oninput="App.setMetric('glucose',this.value)" value="${d.metrics.glucose || ''}" />
          </div>
          <input class="input-mini" style="margin-top:8px" type="text" placeholder="血脂（如 LDL 3.2）" oninput="App.setMetric('lipid',this.value)" value="${d.metrics.lipid || ''}" />
        </div>
        <div class="q-block"><div class="q-label"><span>平均睡眠时长</span></div>
          <div class="opts">${['<6h', '6h', '7h', '8h', '>8h'].map((x) => chip('sleep', x, x)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>压力水平</span></div>
          <div class="opts">${['低', '中', '高'].map((x) => chip('stress', x, x)).join('')}</div></div>`;
    } else if (d.goal === 'elder') {
      html += `<div class="divider"></div>
        <div class="q-block"><div class="q-label"><span>慢病类型</span><em>可多选</em></div>
          <div class="opts">${['高血压', '糖尿病', '高血脂', '痛风/高尿酸', '无'].map((x) => chip('chronic', x, x, null, true)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>行动能力</span></div>
          <div class="opts">${[{ v: 'good', l: '行动自如' }, { v: 'slow', l: '走久了累' }, { v: 'limited', l: '需要辅助' }].map((o) => chip('mobility', o.v, o.l)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>是否独居</span></div>
          <div class="opts">${[{ v: 'no', l: '与家人同住' }, { v: 'yes', l: '独居' }].map((o) => chip('liveAlone', o.v, o.l)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>服药情况</span><em>可选</em></div>
          <div class="opts">${['降压药', '降糖药', '降脂药', '无'].map((x) => chip('medication', x, x)).join('')}</div></div>
        <div class="hint">长辈模式会改为低强度运动（散步 / 太极 / 弹力带），并把方案换成控三高、易咀嚼的搭配。</div>`;
    } else {
      html += `<div class="divider"></div>
        <div class="q-block"><div class="q-label"><span>具体指标</span><em>可多选</em></div>
          <div class="opts">${['血压偏高', '血糖偏高', '血脂偏高', '尿酸偏高'].map((x) => chip('chronicTags', x, x, null, true)).join('')}</div></div>
        <div class="q-block"><div class="q-label"><span>饮食硬约束</span><em>会被严格执行</em></div>
          <div class="opts">${['高钠', '高糖', '高嘌呤'].map((x) => chip('taboo', x, x, null, true)).join('')}</div></div>
        <div class="hint">例如选「高嘌呤」，方案里不会出现沙丁鱼、虾蟹、浓肉汤等食材。</div>`;
    }
    return html;
  }

  function elderGoalStep(d) {
    return `
      <div class="q-block"><div class="q-label"><span>慢病类型</span><em>可多选</em></div>
        <div class="opts">${['高血压', '糖尿病', '高血脂', '痛风/高尿酸', '无'].map((x) => chip('chronic', x, x, null, true)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>行动能力</span></div>
        <div class="opts">${[{ v: 'good', l: '行动自如' }, { v: 'slow', l: '走久了累' }, { v: 'limited', l: '需要辅助' }].map((o) => chip('mobility', o.v, o.l)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>希望方案更偏向</span></div>
        <div class="opts">${[{ v: 'elder', t: '养生调养', d: '保肌肉、易咀嚼、低强度运动' }, { v: 'chronic', t: '控三高', d: '严格控盐控糖控嘌呤' }].map((o) => cardOpt('goal', o.v, o.t, o.d)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>是否独居</span></div>
        <div class="opts">${[{ v: 'no', l: '与家人同住' }, { v: 'yes', l: '独居' }].map((o) => chip('liveAlone', o.v, o.l)).join('')}</div></div>
      <div class="privacy-note">长辈模式只问最必要的几项，其余用安全默认值：每餐 30 元、居家徒手、每周 3 次、每次 30 分钟。</div>
    `;
  }

  function sportStep(d) {
    return `
      <div class="q-block"><div class="q-label"><span>常用器材 / 场地</span><em>可多选</em></div>
        <div class="opts">${[{ v: 'home', l: '居家徒手', s: '不需要器材' }, { v: 'small', l: '居家小器械', s: '哑铃/弹力带' }, { v: 'gym', l: '健身房', s: '器械齐全' }, { v: 'outdoor', l: '户外', s: '走路/跑步' }].map((o) => chip('equip', o.v, o.l, o.s, true)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>每周可运动天数</span></div>
        <div class="opts">${[1, 2, 3, 4, 5, 6].map((n) => chip('trainDays', n, n + ' 天')).join('')}</div></div>
      ${slider('sessionMin', '单次可运动时长', 15, 90, 5, '分钟')}
      <div class="q-block"><div class="q-label"><span>运动基础</span></div>
        <div class="opts">${[{ v: 'none', l: '几乎不动' }, { v: 'some', l: '偶尔动动' }, { v: 'regular', l: '规律半年' }, { v: 'athlete', l: '长期训练' }].map((o) => chip('trainBase', o.v, o.l)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>有无伤病</span><em>可多选</em></div>
        <div class="opts">${['无', '膝盖', '腰', '肩颈', '其他'].map((x) => chip('injury', x, x, null, true)).join('')}</div></div>
      <div class="hint">有伤病时，我们会避开跳跃与深蹲类动作，用替代动作顶上。</div>
    `;
  }

  function dietStep(d) {
    return `
      <div class="q-block"><div class="q-label"><span>饮食模式偏好</span><em>可多选</em></div>
        <div class="opts">${D.DIET_MODES.map((x) => chip('dietModes', x, x, null, true)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>忌口与过敏原</span><em>硬性过滤</em></div>
        <div class="opts">${D.AVOID_OPTIONS.map((o) => chip('avoid', o.id, o.name, null, true)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>一天几餐</span></div>
        <div class="opts">${[2, 3, 4, 5].map((n) => chip('mealsPerDay', n, n + ' 餐')).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>可做饭时间</span></div>
        <div class="opts">${[{ v: 'none', l: '没有厨房' }, { v: '10min', l: '10 分钟' }, { v: '30min', l: '30 分钟' }, { v: 'full', l: '时间充足' }].map((o) => chip('cookTime', o.v, o.l)).join('')}</div></div>
      <div class="q-block"><div class="q-label"><span>餐饮来源</span><em>可多选</em></div>
        <div class="opts">${['自炊', '食堂', '外卖', '应酬'].map((x) => chip('source', x, x, null, true)).join('')}</div></div>
    `;
  }

  function budgetStep(d) {
    const perMeal = d.mealBudget || 30;
    return `
      <div class="q-block"><div class="q-label"><span>城市线级</span><em>用档位，不取定位</em></div>
        <div class="opts">${D.CITY_TIERS.map((t) => cardOpt('cityTier', t.id, t.name, t.desc + ' · 价格系数 ' + t.factor)).join('')}</div></div>
      ${slider('mealBudget', '每餐预算', 8, 80, 2, '元', '这是配餐最关键的一项')}
      <div class="card card-flat" style="margin-top:12px;padding:14px">
        <div class="row between"><span class="tiny muted">每日餐费预估</span><span class="num fw-6" style="color:var(--g700)">¥ <span id="budget-daily">${perMeal * 3}</span> / 天</span></div>
        <div class="tiny dim" style="margin-top:6px">预算越高，蛋白质来源会从「鸡蛋+豆腐」升级到「鸡胸/鱼 + 时蔬 + 杂粮」。价格均为参考价·仅供估算。</div>
      </div>
      <div class="hint">方案会按 ${D.CITY_TIERS.find((x) => x.id === d.cityTier)?.name || '二线城市'} 的食材参考价估算每餐花费。</div>
    `;
  }

  function renderQuizFoot() {
    const d = quiz.draft;
    const total = d.elder ? 2 : 5;
    const isLast = quiz.step >= total;
    let html = '';
    if (quiz.step > 1) html += `<button class="btn btn-ghost" style="flex:0 0 96px" onclick="App.quizPrev()">上一步</button>`;
    if (!isLast) {
      html += `<button class="btn btn-primary" onclick="App.quizNext()">下一步</button>`;
      if (quiz.step >= 2) html += `<button class="btn btn-soft skip" onclick="App.generatePlan()">先出方案</button>`;
    } else {
      html += `<button class="btn btn-primary" onclick="App.generatePlan()">生成我的方案</button>`;
    }
    $('#quiz-foot').innerHTML = html;
  }

  function quizPrev() {
    if (quiz.step > 1) { quiz.step--; renderQuiz(); }
  }
  function quizNext() {
    const d = quiz.draft;
    const total = d.elder ? 2 : 5;
    if (quiz.step === 1) {
      if (!d.height || !d.weight) { toast('请把身高体重填完整', true); return; }
    }
    if (quiz.step >= total) { generatePlan(); return; }
    quiz.step++;
    renderQuiz();
  }

  function pick(key, value, multi, btn) {
    const d = quiz.draft;
    if (multi) {
      const arr = Array.isArray(d[key]) ? d[key] : [];
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1); else arr.push(value);
      d[key] = arr;
      if (btn) btn.classList.toggle('on', arr.includes(value));
      if (key === 'injury' && value === '无' && arr.includes('无')) {
        d.injury = ['无'];
        renderQuiz();
      }
      if (key === 'chronic' && value === '无' && arr.includes('无')) {
        d.chronic = ['无'];
        renderQuiz();
      }
      return;
    }
    d[key] = value;
    document.querySelectorAll(`[data-group="${key}"]`).forEach((b) => b.classList.toggle('on', b.dataset.val === String(value)));
    if (key === 'goal' || key === 'periodWeeks' || key === 'trainDays' || key === 'mealsPerDay' || key === 'cookTime' || key === 'cityTier') {
      renderQuiz();
      if (key === 'goal') quiz.step = quiz.step;
    }
  }

  function onSlide(key, input) {
    const v = Number(input.value);
    quiz.draft[key] = v;
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--pct', ((v - min) / (max - min)) * 100 + '%');
    const label = document.getElementById('v-' + key);
    if (label) label.textContent = v;
    if (key === 'mealBudget') {
      const daily = document.getElementById('budget-daily');
      if (daily) daily.textContent = v * 3;
    }
    if (key === 'height' || key === 'weight') {
      const live = document.getElementById('bmi-live');
      if (live) {
        const d = quiz.draft;
        const b = E.bmi(d.weight, d.height);
        live.textContent = b.value.toFixed(1);
        live.nextSibling && (live.nextSibling.textContent = ' · ' + b.label + '。BMI 只是参考，腰围和体感更重要。');
      }
    }
  }

  function setNum(key, v) { quiz.draft[key] = v === '' ? '' : Number(v); }
  function setMetric(k, v) { quiz.draft.metrics = quiz.draft.metrics || {}; quiz.draft.metrics[k] = v; }

  function draftToProfile(d) {
    const activityMap = { none: 'sedentary', some: 'light', regular: 'moderate', athlete: 'high' };
    let chronic = (d.chronic || []).filter((x) => x !== '无');
    if (d.goal === 'chronic') {
      const map = { 血压偏高: '高血压', 血糖偏高: '糖尿病', 血脂偏高: '高血脂', 尿酸偏高: '痛风/高尿酸' };
      (d.chronicTags || []).forEach((t) => { if (map[t] && !chronic.includes(map[t])) chronic.push(map[t]); });
      if ((d.taboo || []).includes('高嘌呤') && !chronic.includes('痛风/高尿酸')) chronic.push('痛风/高尿酸');
      if ((d.taboo || []).includes('高钠') && !chronic.includes('高血压')) chronic.push('高血压');
      if ((d.taboo || []).includes('高糖') && !chronic.includes('糖尿病')) chronic.push('糖尿病');
    }
    if (d.goal === 'elder' && chronic.length === 0) chronic = [];
    return {
      gender: d.gender, age: d.age, height: d.height, weight: d.weight,
      goal: d.goal === 'elder' ? 'elder' : d.goal,
      targetWeight: d.targetWeight || d.weight,
      periodWeeks: d.periodWeeks || 12, rate: d.rate || 0.5, waist: d.waist || '',
      trainYears: d.trainYears || 'beginner', trainDays: d.trainDays || 3,
      preferParts: d.preferParts || [], metrics: d.metrics || {},
      sleep: d.sleep || '7h', stress: d.stress || '中',
      chronic, mobility: d.mobility || 'good', liveAlone: d.liveAlone || 'no',
      medication: d.medication || '无', chronicTags: d.chronicTags || [], taboo: d.taboo || [],
      equip: (d.equip && d.equip.length ? d.equip : ['home']),
      sessionMin: d.sessionMin || 40, activity: activityMap[d.trainBase] || 'light',
      trainBase: d.trainBase || 'some', injury: d.injury || ['无'],
      dietModes: (d.dietModes && d.dietModes.length ? d.dietModes : ['均衡']),
      avoid: d.avoid || [], mealsPerDay: d.mealsPerDay || 3,
      cookTime: d.cookTime || '30min', source: d.source || ['自炊'],
      cityTier: d.cityTier || 't2', mealBudget: d.mealBudget || 30,
      elder: !!d.elder || d.goal === 'elder',
      updatedAt: Date.now(),
    };
  }

  const LOADING_TEXTS = ['先算你的热量目标…', '按预算筛食材…', '避开你勾选的忌口…', 'AI 正在为你搭配…'];
  let loadingTimer = null;

  async function generatePlan() {
    if (quiz.loading) return;
    const profile = draftToProfile(quiz.draft || defaultDraft());
    quiz.loading = true;
    renderQuiz();
    let i = 0;
    const sub = document.getElementById('loading-sub');
    loadingTimer = setInterval(() => {
      i = (i + 1) % LOADING_TEXTS.length;
      const el = document.getElementById('loading-sub');
      if (el) el.textContent = LOADING_TEXTS[i];
    }, 1200);

    try {
      const plan = E.buildPlan(profile);
      let narrative;
      try {
        narrative = await Promise.race([
          CH.planNarrative(profile, plan),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000)),
        ]);
      } catch (e) {
        narrative = CH.fallbackNarrative(profile, plan);
      }
      me.profile = profile;
      me.plan = plan;
      me.planText = narrative;
      if (!me.records.weight.length) me.records.weight.push({ v: profile.weight, date: todayKey() });
      me.settings = me.settings || {};
      me.settings.elder = !!profile.elder;
      document.documentElement.classList.toggle('elder', !!profile.elder);
      save();
      clearInterval(loadingTimer);
      quiz.loading = false;
      ui.planDay = 0;
      renderPlan();
      showScreen('plan');
      toast('方案已生成，可以开始第一天了');
    } catch (e) {
      clearInterval(loadingTimer);
      quiz.loading = false;
      renderQuiz();
      toast('生成失败，请检查网络后重试', true);
    }
  }

  /* ============================================================
     方案页
     ============================================================ */
  const GOAL_NAME = { fatloss: '减脂', muscle: '增肌', keep: '健康保持', elder: '长辈养生', chronic: '控三高' };

  function renderPlan() {
    if (!me || !me.plan) return;
    const p = me.plan;
    const t = me.planText || CH.fallbackNarrative(me.profile, p);
    const day = p.week[ui.planDay] || p.week[0];
    const w = p.workout[ui.planDay] || p.workout[0];
    const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

    let html = `
      <div class="appbar" style="padding-left:0;padding-right:0">
        <button class="icon-btn" onclick="App.backFromPlan()">←</button>
        <div class="grow center"><div style="font-size:.92rem;font-weight:650">我的健康计划</div><div class="tiny muted">每 7 天可重新生成</div></div>
        <button class="icon-btn" onclick="App.regenerate()">↻</button>
      </div>
      <div class="plan-hero">
        <div class="mini">YOUR PLAN · ${GOAL_NAME[me.profile.goal] || '健康'}</div>
        <h2>${t.reading ? '先把今天过好，剩下的交给时间。' : ''}</h2>
        <p>${esc(t.reading || '')}</p>
        <div class="plan-nums">
          <div class="pn"><b>${p.target}</b><span>目标千卡</span></div>
          <div class="pn"><b>${p.macros.protein}g</b><span>蛋白质</span></div>
          <div class="pn"><b>${p.macros.carb}g</b><span>碳水</span></div>
          <div class="pn"><b>¥${p.avgCost}</b><span>日均餐费</span></div>
        </div>
        <div class="tiny" style="margin-top:10px;color:#6C8069">BMR ${p.bmr} · TDEE ${p.tdee} · 预算 ¥${p.dailyBudget}/天 · 参考价·仅供估算</div>
      </div>

      <div class="section-title"><h3>7 天饮食</h3><span class="more">点日期切换</span></div>
      <div class="day-tabs">
        ${p.week.map((d, i) => `<button class="${i === ui.planDay ? 'on' : ''}" onclick="App.setPlanDay(${i})"><span class="d1">周${dayLabels[i]}</span><span class="d2">${d.total.kcal}</span></button>`).join('')}
      </div>

      <div id="plan-meals">
        ${day.meals.map((m) => `
          <div class="meal">
            <div class="meal-head">
              <div class="l"><span class="e">${m.label.charAt(0)}</span>${m.label}</div>
              <div class="r">${m.kcal} 千卡 · ¥${m.cost}</div>
            </div>
            ${m.items.map((it) => `<div class="food-line"><span>${it.emoji}</span><span class="fn">${esc(it.name)}</span><span class="fg">${it.grams}g</span><span class="fk">${it.kcal} 千卡</span><span class="fc">¥${it.cost}</span></div>`).join('')}
            <div class="meal-foot"><span>蛋白质 ${m.protein}g · 预算 ¥${m.budget}</span><span>${m.cost <= m.budget ? '✓ 在预算内' : '略超预算'}</span></div>
          </div>`).join('')}
      </div>

      <div class="section-title"><h3>这天怎么动</h3><span class="more">${w.rest ? '休息日' : w.duration + ' 分钟'}</span></div>
      <div class="card">
        <div class="row between" style="margin-bottom:6px"><b style="font-size:.9rem">${esc(w.title)}</b><span class="badge">${esc(w.focus)}</span></div>
        ${w.blocks && w.blocks.length ? w.blocks.map((b) => `<div class="workout-item"><div class="wi-day"><b>${esc(b.sets || '—')}</b></div><div class="wi-body"><div class="wt">${esc(b.name)}</div><div class="wb">${esc(b.tip || '')}${b.note ? ' · ' + esc(b.note) : ''}</div></div></div>`).join('') : '<div class="tiny muted" style="padding:10px 0">今天休息，散步 20 分钟就很好。</div>'}
      </div>

      <div class="section-title"><h3>小禾的 3 条提醒</h3></div>
      <div class="card">
        ${(t.tips || []).map((tip, i) => `<div class="row" style="align-items:flex-start;padding:7px 0;border-bottom:${i < 2 ? '1px dashed var(--line-soft)' : 'none'}"><span style="width:20px;height:20px;border-radius:50%;background:var(--g100);color:var(--g700);display:grid;place-items:center;font-size:.66rem;flex:0 0 20px">${i + 1}</span><span class="fs-12">${esc(tip)}</span></div>`).join('')}
      </div>

      <div class="mt-14">
        <button class="btn btn-primary btn-block" onclick="App.enterHomeFromPlan()">开始第一天</button>
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.refineInfo()">完善信息，让方案更准</button>
      <div class="disclaimer">本方案为健康参考，不替代医疗建议；慢病、孕期、服药人群请遵医嘱。<br/>食材价格标注为参考价·仅供估算，按城市档位换算。</div>
    `;
    $('#view-plan').innerHTML = html;
  }

  function setPlanDay(i) { ui.planDay = i; renderPlan(); window.scrollTo({ top: 260, behavior: 'smooth' }); }
  function enterHomeFromPlan() { showScreen('main'); switchTab('home'); }
  function backFromPlan() { showScreen('main'); switchTab('home'); }
  function refineInfo() { startQuiz(false); }
  function regenerate() {
    if (!me.plan) return startQuiz();
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 6px">重新生成方案</h3>
      <p class="tiny muted" style="margin:0 0 14px">可以改身体数据、预算或忌口，AI 会重新配一份。旧方案会被覆盖。</p>
      <button class="btn btn-primary btn-block" onclick="App.startQuiz()">按新条件重新定制</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal()">取消</button>
    `);
  }
  function closeOnboarding() {
    closeAllModals();
    if (ui.onboarding) ui.onboarding = null;
  }

  /* ============================================================
     App 导出（供内联事件调用）
     ============================================================ */
  window.App = {
    startQuiz, closeOnboarding, quizPrev, quizNext, pick, onSlide, setNum, setMetric,
    generatePlan, setPlanDay, enterHomeFromPlan, backFromPlan, refineInfo, regenerate,
    closeModal: () => closeModal(),
    // 后续填充
  };

  /* ============================================================
     启动
     ============================================================ */
  async function boot() {
    bindLogin();
    document.querySelectorAll('#tabbar button').forEach((b) => {
      b.onclick = () => switchTab(b.dataset.tab);
    });
    ['home', 'records', 'market', 'profile'].forEach((k) => {
      const el = document.getElementById('view-' + k);
      if (el) el.style.display = 'none';
    });

    await loadStore();
    if (window.NXH_CLOUD && cloudState === 'fail' && !window.NXH_CLOUD.local) {
      setTimeout(() => toast('云端暂时连不上，先使用本地缓存'), 900);
    }
    const adminSession = sessionStorage.getItem(SS_ADMIN) === '1';
    const sess = localStorage.getItem(LS_SESSION);
    if (sess) {
      const u = findByPhone(sess);
      if (u) { me = u; enterApp(sess); }
    }
    if (adminSession) showAdmin();
    if (!sess && !adminSession) showScreen('login');
    if (me) setTimeout(handleHash, 600);
  }

  /* ============================================================
     Tab 切换
     ============================================================ */
  function switchTab(t) {
    tab = t;
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    ['home', 'records', 'market', 'profile'].forEach((k) => {
      const el = document.getElementById('view-' + k);
      if (el) el.style.display = k === t ? 'block' : 'none';
    });
    if (t === 'home') renderHome();
    if (t === 'records') renderRecords();
    if (t === 'market') renderMarket();
    if (t === 'profile') renderProfile();
    window.scrollTo({ top: 0 });

    // 跨设备同步：切到共享内容页时拉一次云端
    if (t === 'market' || t === 'records' || t === 'profile') {
      refreshFromCloud(false).then((changed) => {
        if (!changed) return;
        if (tab === 'market') renderMarket();
        if (tab === 'records') renderRecords();
        if (tab === 'profile') renderProfile();
      });
    }
  }

  /* ============================================================
     今日数据
     ============================================================ */
  function dayIndex() { return (new Date().getDay() + 6) % 7; }

  function todayCtx() {
    if (!me.plan) return null;
    const di = dayIndex();
    const day = me.plan.week[di] || me.plan.week[0];
    const workout = me.plan.workout[di] || me.plan.workout[0];
    const key = todayKey();
    const ck = me.checkins[key] || { items: [] };
    const items = [
      { id: 'm0', name: '早餐', kcal: day.meals[0].kcal, mark: '早', sub: day.meals[0].items.map((i) => i.name).join(' + ') },
      { id: 'm1', name: '午餐', kcal: day.meals[1].kcal, mark: '午', sub: day.meals[1].items.map((i) => i.name).join(' + ') },
      { id: 'm2', name: '晚餐', kcal: day.meals[2].kcal, mark: '晚', sub: day.meals[2].items.map((i) => i.name).join(' + ') },
      { id: 'm3', name: '加餐', kcal: day.meals[3].kcal, mark: '加', sub: day.meals[3].items.map((i) => i.name).join(' + ') },
      { id: 'w', name: workout.rest ? '轻活动 / 休息' : workout.title, kcal: workout.rest ? 0 : Math.round(workout.duration * 6), mark: '动', sub: workout.rest ? '散步 20 分钟' : workout.blocks.map((b) => b.name).join(' · ') },
    ];
    const consumed = items.filter((i) => i.id.startsWith('m') && ck.items.includes(i.id)).reduce((a, b) => a + b.kcal, 0);
    const burned = ck.items.includes('w') ? items[4].kcal : 0;
    const cost = [0, 1, 2, 3].reduce((a, i) => a + (ck.items.includes('m' + i) ? day.meals[i].cost : 0), 0);
    const protein = [0, 1, 2, 3].reduce((a, i) => a + (ck.items.includes('m' + i) ? day.meals[i].protein : 0), 0);
    return { day, workout, items, ck, consumed, burned, cost, protein, done: ck.items.length, total: 5 };
  }

  function stats() {
    const ctx = todayCtx();
    return {
      streak: me.streak || 1,
      rounds: me.chatRounds || 0,
      favorites: (me.wishlist || []).length,
      points: me.points || 0,
      done: ctx ? ctx.done : 0,
      total: 5,
      checkedToday: !!(me.lastCheck && me.lastCheck === todayKey()),
    };
  }

  function markChecked() {
    const t = todayKey();
    if (me.lastCheck === t) return false;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yk = y.toLocaleDateString('sv-SE');
    me.streak = me.lastCheck === yk ? (me.streak || 1) + 1 : 1;
    me.lastCheck = t;
    return true;
  }

  function checkLapseWarn() {
    if (!me.lastCheck) return 0;
    const t = new Date(todayKey());
    const l = new Date(me.lastCheck);
    const gap = Math.round((t - l) / 86400000);
    if (gap >= 3) {
      setTimeout(() => {
        toast('有 ' + gap + ' 天没见到你了，今天从一杯水开始就好');
      }, 500);
    }
    return gap;
  }

  /* ============================================================
     首页
     ============================================================ */
  function renderHome() {
    if (!me) return;
    const el = $('#view-home');
    if (!me.plan) {
      el.innerHTML = renderAppbar() + `
        <div class="home-hero">
          <div class="kicker">一 日 三 餐 · 顺 时 而 食</div>
          <div class="motto">食饮有节，起居有常 —— 把饭吃好，是最朴素的养生。</div>
        </div>
        <div class="card" style="text-align:center;padding:26px 20px">
          <div style="font-size:40px">🌱</div>
          <h3 style="margin:10px 0 6px">还没有你的专属方案</h3>
          <p class="tiny muted" style="margin:0 0 16px">6 个问题，按你的身体、预算和口味配好一周三餐。</p>
          <button class="btn btn-primary btn-block" onclick="App.startQuiz()">开始定制</button>
        </div>
        ${disclaimerCard()}
      `;
      return;
    }
    if (me.settings && me.settings.elder) { el.innerHTML = renderElderHome(); return; }

    const ctx = todayCtx();
    const target = me.plan.target;
    const pct = Math.min(1, ctx.consumed / target);
    const remain = Math.max(0, target - ctx.consumed);
    const macro = me.plan.macros;
    const ratio = Math.min(1, ctx.consumed / target);
    const gap = me.lastCheck ? Math.round((new Date(todayKey()) - new Date(me.lastCheck)) / 86400000) : 0;
    const d = new Date();
    const dateLabel = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${'日一二三四五六'[d.getDay()]}`;

    el.innerHTML = `
      ${renderAppbar()}
      <div class="home-hero">
        <div class="kicker">一 日 三 餐 · 顺 时 而 食</div>
        <div class="motto">食饮有节，起居有常 —— 今天也要好好吃饭。</div>
      </div>

      ${gap >= 3 ? `<div class="card card-flat" style="background:#FBF6E8;border-color:#F0E3C4;margin-top:10px">
        <div class="row" style="align-items:flex-start"><span style="font-size:18px">🍃</span>
          <div class="grow"><div class="fs-12 fw-6" style="color:#8A6A22">好久没见到你了</div>
          <div class="tiny" style="color:#9A7C36">${gap} 天没打卡，不用补，回来就好。今天先勾一项？</div></div></div>
      </div>` : ''}

      <div class="card today-card" style="margin-top:10px">
        <div class="today-head">
          <div><div class="fs-12 fw-6">今日概览</div><div class="date">${dateLabel}</div></div>
          <button class="badge" onclick="App.viewPlan()">查看方案 ›</button>
        </div>
        <div class="ring-wrap">
          <svg viewBox="0 0 160 160" width="152" height="152">
            <defs><linearGradient id="ringG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#C9A96A"/><stop offset="1" stop-color="#1B3A2F"/></linearGradient></defs>
            <circle cx="80" cy="80" r="66" fill="none" stroke="#EDE5D3" stroke-width="8"/>
            <circle cx="80" cy="80" r="66" fill="none" stroke="url(#ringG)" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="414.7" stroke-dashoffset="${(414.7 * (1 - pct)).toFixed(1)}"
              transform="rotate(-90 80 80)" style="transition:stroke-dashoffset .6s ease"/>
          </svg>
          <div class="ring-center">
            <div class="big">${remain}</div>
            <div class="lbl">还可吃 · 千卡</div>
          </div>
        </div>
        <div class="macro-row">
          <div class="macro"><div class="m-top"><span>碳水</span><span>${macro.carb}g</span></div><div class="m-bar"><i style="width:${ratio * 100}%"></i></div><div class="m-val">${Math.round(macro.carb * ratio)}<span class="dim"> / ${macro.carb}</span></div></div>
          <div class="macro"><div class="m-top"><span>蛋白</span><span>${macro.protein}g</span></div><div class="m-bar"><i style="width:${Math.min(100, (ctx.protein / macro.protein) * 100)}%"></i></div><div class="m-val">${Math.round(ctx.protein)}<span class="dim"> / ${macro.protein}</span></div></div>
          <div class="macro"><div class="m-top"><span>脂肪</span><span>${macro.fat}g</span></div><div class="m-bar"><i style="width:${ratio * 100}%"></i></div><div class="m-val">${Math.round(macro.fat * ratio)}<span class="dim"> / ${macro.fat}</span></div></div>
        </div>
        <div class="today-metrics">
          <div class="metric"><div class="m-num">${ctx.consumed}</div><div class="m-lbl">已摄入 千卡</div></div>
          <div class="metric"><div class="m-num">${ctx.burned}</div><div class="m-lbl">运动消耗</div></div>
          <div class="metric"><div class="m-num">¥${ctx.cost}</div><div class="m-lbl">今日餐费</div></div>
        </div>
      </div>

      <div class="section-title"><h3>今日清单</h3><span class="more">${ctx.done} / ${ctx.total} 完成</span></div>
      <div class="card">
        <div class="check-list">
          ${ctx.items.map((it) => `
            <div class="check-item ${ctx.ck.items.includes(it.id) ? 'done' : ''}" onclick="App.toggleCheck('${it.id}')">
              <div class="ci-box"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.6 8.8 10 3.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <div class="ci-emoji">${it.mark || '·'}</div>
              <div class="ci-name">${esc(it.name)}<div class="tiny dim ellipsis" style="max-width:190px">${esc(it.sub)}</div></div>
              <div class="ci-kcal">${it.kcal ? it.kcal + ' 千卡' : ''}</div>
            </div>`).join('')}
        </div>
        <div class="divider"></div>
        <button class="btn ${ctx.done >= ctx.total ? 'btn-soft' : 'btn-primary'} btn-block" onclick="App.doCheckin()">
          ${ctx.done >= ctx.total ? '今天全部完成 ✓' : '一键打卡'}
        </button>
      </div>

      ${chatCardHTML()}

      ${disclaimerCard()}
    `;
    fillChat();
  }

  function renderAppbar() {
    return `<div class="appbar">
      <div class="avatar-mark">禾</div>
      <div><div class="who">${esc(me.name)}</div><div class="streak"><span class="streak-dot"></span>连续陪伴 ${me.streak || 1} 天</div></div>
      <div class="spacer"></div>
      <button class="icon-btn" onclick="App.showTreehole()"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 4.5C20 13 14.2 18.5 5 19c0-8.8 5.8-14.5 15-14.5Z"/><path d="M4 20.5c2.4-5.4 6-9 11-11.4"/></svg></button>
      <button class="icon-btn" onclick="App.openNotices()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 9.2a6 6 0 1 1 12 0c0 3.4 1 4.9 1.8 5.9H4.2C5 14.1 6 12.6 6 9.2Z"/><path d="M9.6 18.2a2.4 2.4 0 0 0 4.8 0"/></svg>${(me.warnings || []).length ? '<span class="dot-badge"></span>' : ''}</button>
    </div>`;
  }

  function disclaimerCard() {
    return `<div class="disclaimer" style="margin-top:16px">本方案为健康参考，不替代医疗建议；慢病、孕期、服药人群请遵医嘱。<br/>食材价格标注为参考价·仅供估算。</div>`;
  }

  function renderElderHome() {
    const ctx = todayCtx();
    return `
      <div class="appbar">
        <div class="avatar-mark">禾</div>
        <div><div class="who">${esc(me.name)}</div><div class="streak"><span class="streak-dot"></span>连续陪伴 ${me.streak || 1} 天</div></div>
        <div class="spacer"></div>
        <button class="icon-btn" onclick="App.openNotices()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 9.2a6 6 0 1 1 12 0c0 3.4 1 4.9 1.8 5.9H4.2C5 14.1 6 12.6 6 9.2Z"/><path d="M9.6 18.2a2.4 2.4 0 0 0 4.8 0"/></svg></button>
      </div>
      <div class="home-hero">
        <div class="kicker">长 辈 模 式</div>
        <div class="motto">吃饭香、走得动、睡得着，就是好日子。</div>
      </div>
      <div class="elder-home-grid" style="margin-top:14px">
        <button class="elder-big-btn" onclick="App.elderWhat()"><span class="eb-ico">🍚</span><span><span class="eb-t">今天吃什么</span><br/><span class="eb-s">三餐已按您的口味配好</span></span><span class="eb-a">›</span></button>
        <button class="elder-big-btn" onclick="App.elderMove()"><span class="eb-ico">🚶</span><span><span class="eb-t">今天怎么动</span><br/><span class="eb-s">散步、太极，慢一点</span></span><span class="eb-a">›</span></button>
        <button class="elder-big-btn" onclick="App.doCheckin()"><span class="eb-ico">✅</span><span><span class="eb-t">今天打卡</span><br/><span class="eb-s">已完成 ${ctx ? ctx.done : 0} / ${ctx ? ctx.total : 5} 项</span></span><span class="eb-a">›</span></button>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="row between"><span class="fs-12 fw-6">今天的饭</span><span class="tiny muted">${me.plan ? me.plan.target : '—'} 千卡</span></div>
        <div class="divider"></div>
        ${ctx ? ctx.items.slice(0, 4).map((it) => `<div class="check-item ${ctx.ck.items.includes(it.id) ? 'done' : ''}" onclick="App.toggleCheck('${it.id}')">
            <div class="ci-box"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.6 8.8 10 3.2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div class="ci-name">${esc(it.sub || it.name)}</div><div class="ci-kcal">${it.kcal}</div></div>`).join('') : ''}
      </div>
      ${disclaimerCard()}
    `;
  }

  function elderWhat() {
    const ctx = todayCtx();
    if (!ctx) return;
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">今天吃什么</h3>
      <p class="tiny muted" style="margin:0 0 12px">照着买、照着做就行，少盐少油。</p>
      ${ctx.day.meals.map((m) => `<div class="meal"><div class="meal-head"><div class="l"><span class="e">${m.label.charAt(0)}</span>${m.label}</div><div class="r">${m.kcal} 千卡</div></div>
        ${m.items.map((i) => `<div class="food-line"><span>${i.emoji}</span><span class="fn">${esc(i.name)}</span><span class="fg">${i.grams}g</span></div>`).join('')}</div>`).join('')}
      <div class="disclaimer">本方案为健康参考，不替代医疗建议；慢病、服药人群请遵医嘱。</div>
    `);
  }

  function elderMove() {
    const di = dayIndex();
    const w = me.plan.workout[di];
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">今天怎么动</h3>
      <p class="tiny muted" style="margin:0 0 12px">${esc(w.title)} · ${w.duration} 分钟</p>
      ${w.blocks.map((b) => `<div class="workout-item"><div class="wi-day"><b>${esc(b.sets || '')}</b></div><div class="wi-body"><div class="wt">${esc(b.name)}</div><div class="wb">${esc(b.tip || '')}</div></div></div>`).join('')}
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.toggleCheck('w');App.closeModal()">我今天做到了</button>
    `);
  }

  /* ============================================================
     打卡
     ============================================================ */
  async function toggleCheck(id) {
    if (!me.plan) return;
    const key = todayKey();
    const ck = me.checkins[key] || { items: [] };
    const i = ck.items.indexOf(id);
    const first = ck.items.length === 0;
    if (i >= 0) ck.items.splice(i, 1); else ck.items.push(id);
    me.checkins[key] = ck;
    let gained = 0;
    if (ck.items.length > 0) {
      if (markChecked()) gained += 3;
    }
    if (gained) me.points = (me.points || 0) + gained;
    save();
    renderHome();
    if (id === 'w' && i < 0) toast('运动完成，记得拉伸一下');
    if (ck.items.length > 0 && (first || id === 'w')) aiEncourage();
  }

  async function doCheckin() {
    if (!me.plan) { startQuiz(); return; }
    const ctx = todayCtx();
    const key = todayKey();
    const ck = me.checkins[key] || { items: [] };
    const wasEmpty = ck.items.length === 0;
    if (!wasEmpty && ck.items.length >= ctx.total) { toast('今天已经全部完成啦，明天见'); return; }
    ck.items = ctx.items.map((i) => i.id);
    me.checkins[key] = ck;
    let gained = 0;
    if (markChecked()) gained += 3;
    me.points = (me.points || 0) + gained;
    saveNow();
    renderHome();
    aiEncourage();
  }

  async function aiEncourage() {
    const s = stats();
    const text = await CH.encourage({ stats: s, profile: me.profile });
    me.chat.push({ role: 'assistant', content: text, time: fmtTime() });
    save();
    const ctx = document.getElementById('chat-scroll');
    if (ctx) appendMsg(me.chat[me.chat.length - 1], true);
    openModal(`
      <div style="text-align:center;padding:4px 2px 0">
        <div class="emoji-soft" style="font-size:36px">🌿</div>
        <h3 style="margin:8px 0 6px">今天又照顾到自己了</h3>
        <p class="fs-12" style="color:var(--text-2);line-height:1.75;margin:0 0 12px">${esc(text)}</p>
        <div class="row" style="justify-content:center;gap:8px;margin-bottom:14px"><span class="badge gold">+3 积分</span><span class="badge">连续 ${me.streak} 天</span></div>
        <button class="btn btn-primary btn-block" onclick="App.closeModal()">好，继续</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal();App.sharePlan()">把今天的方案发到广场</button>
      </div>`, { center: true });
  }

  /* ============================================================
     对话
     ============================================================ */
  const CHIPS = ['今天吃什么？', '推荐健康好物', '我想聊聊', '蜂王浆怎么选', '费南雪多少钱', '帮我搭配礼盒', 'BMI是什么', '怎样快速减脂'];

  function ensureChat() {
    if (!me) return;
    me.chat = me.chat || [];
    if (!me.chat.length) me.chat.push({ role: 'assistant', content: WELCOME, time: fmtTime() });
  }

  function chatCardHTML() {
    return `<div class="card chat-card">
      <div class="chat-status">
        <img src="img/logo.jpg" alt="小禾" />
        <div class="grow"><div class="nm">小禾 AI</div><div class="st"><i></i>在线 · 记得你的喜好</div></div>
        <button class="badge" onclick="App.showTreehole()">树洞</button>
      </div>
      <div class="chat-scroll" id="chat-scroll"></div>
      <div class="chat-dock">
        <div class="chips-row">${CHIPS.map((c) => `<button class="chip" onclick="App.sendChip('${c}')">${c}</button>`).join('')}</div>
        <div class="chat-input-bar">
          <button class="cam" onclick="App.cameraTip()">📷</button>
          <textarea id="chat-input" rows="1" placeholder="和小禾说点什么…" oninput="App.chatInput(this)" onkeydown="App.chatKey(event)"></textarea>
          <button class="send-btn" id="chat-send" onclick="App.sendChat()"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12 20 4l-7 16-2.2-6.4L4 12Z" fill="#fff"/></svg></button>
        </div>
      </div>
    </div>`;
  }

  function fillChat() {
    const box = document.getElementById('chat-scroll');
    if (!box) return;
    box.innerHTML = '';
    const list = (me.chat || []).slice(-40);
    list.forEach((m) => box.appendChild(msgNode(m, false)));
    if (list.length <= 2) {
      const ctx = todayCtx();
      const hint = document.createElement('div');
      hint.className = 'chat-hint';
      hint.innerHTML = `<div class="ch-t">今天我帮你算好了</div>
        <div class="ch-row"><span>目标 <b>${me.plan.target}</b> 千卡</span><span>蛋白 <b>${me.plan.macros.protein}g</b></span><span>待完成 <b>${ctx ? ctx.total - ctx.done : 5}</b> 项</span></div>
        <div class="ch-s">可以让我换一道菜、算算零食热量，或者只是聊两句。点下面的问题就能开始。</div>`;
      box.appendChild(hint);
    }
    box.scrollTop = box.scrollHeight;
  }

  function msgNode(m, animate) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'me' : 'ai');
    if (!animate) wrap.style.animation = 'none';
    const cards = (m.cards || []).map((id) => productMiniCard(id)).join('');
    if (m.role === 'user') {
      wrap.innerHTML = `<div class="bubble">${esc(m.content).replace(/\n/g, '<br/>')}</div>`;
    } else {
      wrap.innerHTML = `<div class="av"><img src="img/logo.jpg" alt="" /></div>
        <div class="bubble">${esc(m.content).replace(/\n/g, '<br/>')}${cards ? `<div style="margin-top:8px">${cards}</div>` : ''}</div>`;
    }
    return wrap;
  }

  function productMiniCard(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return '';
    const img = p.img ? `<img src="${esc(p.img)}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover" />` : `<div class="mini-ph">${monoOf(p.name)}</div>`;
    return `<div class="chat-prod" onclick="App.openProduct('${p.id}')">
      ${img}
      <div style="flex:1;min-width:0"><div class="fs-12 fw-6 ellipsis">${esc(p.name)}</div><div class="tiny muted">¥${p.price} · ${p.points} 积分</div></div>
      <span style="color:#C6D3C4;font-size:16px">›</span>
    </div>`;
  }

  function appendMsg(m, animate) {
    const box = document.getElementById('chat-scroll');
    if (!box) return;
    box.appendChild(msgNode(m, animate));
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }

  function addTyping() {
    const box = document.getElementById('chat-scroll');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.id = 'typing-node';
    el.innerHTML = `<div class="av"><img src="img/logo.jpg" alt="" /></div><div class="bubble" style="padding:12px 16px"><span class="typing"><i></i><i></i><i></i></span></div>`;
    box.appendChild(el);
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }
  function removeTyping() {
    const el = document.getElementById('typing-node');
    if (el) el.remove();
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sendChat(preset) {
    if (!me || ui.chatBusy) return;
    const input = document.getElementById('chat-input');
    const text = (preset != null ? preset : (input ? input.value : '')).trim();
    if (!text) return;
    ui.chatBusy = true;
    if (input && preset == null) { input.value = ''; input.style.height = 'auto'; }
    me.chat.push({ role: 'user', content: text, time: fmtTime() });
    me.chatRounds = (me.chatRounds || 0) + 1;
    appendMsg(me.chat[me.chat.length - 1], true);
    addTyping();

    const t0 = Date.now();
    let res;
    try {
      res = await CH.reply(text, {
        user: me, profile: me.profile, plan: me.plan, products: store.products,
        stats: stats(), history: me.chat.slice(-9, -1).map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (e) {
      res = { segs: ['我这边有点走神，你再说一次好吗？'], cards: [] };
    }
    const wait = Math.max(0, 650 - (Date.now() - t0));
    if (wait) await sleep(wait);
    removeTyping();
    for (let i = 0; i < res.segs.length; i++) {
      if (i > 0) await sleep(260);
      const msg = { role: 'assistant', content: res.segs[i], time: fmtTime(), cards: i === res.segs.length - 1 ? res.cards : [] };
      me.chat.push(msg);
      appendMsg(msg, true);
    }
    save();
    ui.chatBusy = false;
  }

  function chatInput(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(96, ta.scrollHeight) + 'px';
  }
  function chatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  }
  function sendChip(text) { sendChat(text); }
  function cameraTip() { toast('拍照识别即将上线，演示版不上传照片'); }

  /* ============================================================
     记录页
     ============================================================ */
  function weekStats() {
    const days = [];
    let active = 0;
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const k = dt.toLocaleDateString('sv-SE');
      const ck = me.checkins[k];
      const done = ck ? ck.items.length : 0;
      if (done > 0) active++;
      days.push({ k, label: '日一二三四五六'[dt.getDay()], done, pct: Math.min(100, (done / 5) * 100) });
    }
    return { days, rate: Math.round((active / 7) * 100) };
  }

  function renderRecords() {
    if (!me) return;
    const ws = weekStats();
    const ctx = todayCtx();
    const weights = (me.records.weight || []).slice(-7);
    const posts = store.posts.filter((p) => !p.removed);
    const ratePct = ws.rate;

    $('#view-records').innerHTML = `
      <div class="appbar" style="padding-left:0;padding-right:0">
        <div class="grow"><div class="who" style="font-size:1.06rem">记录</div><div class="tiny muted">慢慢来，但别停</div></div>
        <span class="points-pill"><i></i>${me.points || 0} 积分</span>
      </div>

      <div class="card week-card">
        <div class="row between">
          <div>
            <div class="fs-12 fw-6">本周完成率</div>
            <div class="tiny muted" style="margin-top:2px">打卡 ${ws.days.filter((d) => d.done > 0).length} / 7 天 · 连续 ${me.streak || 1} 天</div>
          </div>
          <div class="ring-mini">
            <svg viewBox="0 0 74 74" width="74" height="74">
              <circle cx="37" cy="37" r="30" fill="none" stroke="#EDF3E9" stroke-width="7"/>
              <circle cx="37" cy="37" r="30" fill="none" stroke="#3E9459" stroke-width="7" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="${(188.5 * (1 - ratePct / 100)).toFixed(1)}" transform="rotate(-90 37 37)"/>
            </svg>
            <div class="c">${ratePct}%<div class="l">完成率</div></div>
          </div>
        </div>
        <div class="wd-row">
          ${ws.days.map((d) => `<div class="wd ${d.done >= 4 ? '' : d.done > 0 ? 'partial' : 'none'}">
            <div class="bar"><i style="height:${Math.max(6, d.pct * 0.62)}px"></i></div>
            <div class="d">${d.label}</div></div>`).join('')}
        </div>
        ${ratePct === 0 ? '<div class="tiny center" style="color:var(--muted-2);margin-top:8px;letter-spacing:.04em">本周还没有打卡，今天开始也不晚</div>' : ''}
        <div class="divider"></div>
        <button class="btn ${ctx && ctx.done >= ctx.total ? 'btn-soft' : 'btn-primary'} btn-block" onclick="App.doCheckin()">
          ${ctx && ctx.done >= ctx.total ? '今天已完成 ✓ 再记一笔' : '今天打卡'}
        </button>
      </div>

      <div class="section-title"><h3>记录一下</h3><span class="more">三项都可随时补</span></div>
      <div class="rec-grid">
        <button class="rec-tile" onclick="App.addWeight()">
          <div class="ico">重</div><div class="t">体重</div>
          <div class="v">${me.profile ? me.profile.weight + ' kg' : '—'}</div><div class="plus">+ 记录</div>
        </button>
        <button class="rec-tile" onclick="App.addMeal()">
          <div class="ico">食</div><div class="t">饮食</div>
          <div class="v">${ctx ? ctx.consumed + ' 千卡' : '—'}</div><div class="plus">+ 记录</div>
        </button>
        <button class="rec-tile" onclick="App.addExercise()">
          <div class="ico">动</div><div class="t">运动</div>
          <div class="v">${ctx ? ctx.burned + ' 千卡' : '—'}</div><div class="plus">+ 记录</div>
        </button>
      </div>

      <div class="section-title"><h3>体重变化</h3><span class="more">近 ${weights.length} 次</span></div>
      <div class="card">
        ${weights.length ? `<div class="chart-box">
          ${weights.map((w) => {
            const max = Math.max(...weights.map((x) => x.v)) + 1;
            const min = Math.min(...weights.map((x) => x.v)) - 1;
            const h = 10 + ((w.v - min) / Math.max(0.5, max - min)) * 90;
            return `<div class="col"><div class="vl">${w.v}</div><div class="b" style="height:${h}px"></div><div class="lb">${w.date.slice(5)}</div></div>`;
          }).join('')}
        </div>` : `<div class="empty"><div class="e">⚖️</div>还没有体重记录，今天称一次？</div>`}
        <div class="tiny muted">BMI ${me.plan ? me.plan.bmi.value + ' · ' + me.plan.bmi.label : '—'} · 体重只是参考，看趋势就好</div>
      </div>

      <div class="section-title"><h3>用户广场</h3><span class="more" onclick="App.sharePlan()">发布我的方案 +</span></div>
      <div class="card card-flat" style="padding:12px 14px;background:#F6FBF3;border-color:#E5F0DF">
        <div class="tiny" style="color:#5C7561">看看别人怎么吃、怎么坚持。看到好的方案，可以点赞、评论，也可以监督他每天打卡。</div>
      </div>
      <div style="margin-top:12px" id="post-list">
        ${posts.map((p) => postHTML(p)).join('') || '<div class="empty"><div class="e">🌾</div>还没有动态，发布你的第一份方案吧</div>'}
      </div>
      ${disclaimerCard()}
    `;
  }

  function postHTML(p) {
    const liked = (p.likedBy || []).includes(me.id);
    const mine = p.authorId === me.id;
    const sup = me.supervise || { date: '', count: 0, targets: [] };
    const supervised = sup.date === todayKey() && (sup.targets || []).includes(p.id);
    return `<div class="post" id="post-${p.id}">
      <div class="post-head">
        <div class="av">${esc(p.avatar || '🌿')}</div>
        <div class="grow"><div class="nm">${esc(p.authorName)}</div><div class="tm">${esc(p.time || '')}${p.seed ? ' · 精选' : ''}</div></div>
        <span class="badge">${esc(p.goal || '健康')}</span>
      </div>
      <h4>${esc(p.title)}</h4>
      <p>${esc(p.summary)}</p>
      <div class="post-tags">
        <span class="badge gray">${p.kcal || 1500} 千卡 / 天</span>
        ${(p.tags || []).map((t) => `<span class="badge gray">${esc(t)}</span>`).join('')}
      </div>
      ${mine ? '' : `<div class="supervise-bar">
        <span style="font-size:14px">👀</span>
        <span class="grow">监督 TA 每天打卡，你能 +1 积分</span>
        <button class="btn btn-sm ${supervised ? 'btn-soft' : 'btn-primary'}" onclick="App.supervise('${p.id}')">${supervised ? '已监督' : '去监督'}</button>
      </div>`}
      <div class="post-foot">
        <button class="${liked ? 'on' : ''}" onclick="App.like('${p.id}')">${liked ? '❤️' : '🤍'} ${p.likes || 0}</button>
        <button onclick="App.comment('${p.id}')">💬 ${(p.comments || []).length}</button>
        <button onclick="App.sharePost('${p.id}')">↗ 转发</button>
        ${mine ? `<button class="del" onclick="App.deletePost('${p.id}')">删除</button>` : `<button class="del" onclick="App.report('${p.id}')">举报</button>`}
      </div>
      ${(p.comments || []).slice(-2).map((c) => `<div class="cmt"><b>${esc(c.name)}</b>：${esc(c.text)}</div>`).join('')}
    </div>`;
  }

  function refreshPosts() {
    const list = document.getElementById('post-list');
    if (list) list.innerHTML = store.posts.filter((p) => !p.removed).map((p) => postHTML(p)).join('') || '<div class="empty"><div class="e">🌾</div>还没有动态</div>';
  }

  function like(id) {
    const p = store.posts.find((x) => x.id === id);
    if (!p) return;
    p.likedBy = p.likedBy || [];
    const i = p.likedBy.indexOf(me.id);
    if (i >= 0) { p.likedBy.splice(i, 1); p.likes = Math.max(0, (p.likes || 1) - 1); }
    else { p.likedBy.push(me.id); p.likes = (p.likes || 0) + 1; }
    save(); refreshPosts();
  }

  function comment(id) {
    const p = store.posts.find((x) => x.id === id);
    if (!p) return;
    const mask = openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 10px">写句评论</h3>
      <textarea id="cmt-text" class="input-mini" style="height:90px;padding:10px;resize:none" placeholder="说点实在的，别客气"></textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.sendComment('${id}')">发送</button>
    `);
    p._mask = mask;
  }

  function sendComment(id) {
    const p = store.posts.find((x) => x.id === id);
    const el = document.getElementById('cmt-text');
    const text = (el && el.value || '').trim();
    if (!text) { toast('写点什么再发送', true); return; }
    p.comments = p.comments || [];
    p.comments.push({ id: 'c' + Date.now(), userId: me.id, name: me.name, text, time: '刚刚' });
    save();
    closeAllModals();
    refreshPosts();
    toast('评论已发布');
  }

  function sharePost(id) {
    const p = store.posts.find((x) => x.id === id);
    if (!p) return;
    const link = location.origin + location.pathname + '#post=' + id;
    ui.sharePost = id;
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">转发给微信好友</h3>
      <p class="tiny muted" style="margin:0 0 12px">复制链接发给好友，或用微信「扫一扫」打开</p>
      <div class="card card-flat" style="padding:12px;background:#F7FAF4">
        <div class="fs-12 fw-6 ellipsis">${esc(p.title)}</div>
        <div class="tiny muted ellipsis" style="margin-top:4px">${esc(link)}</div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="App.copyShare()">复制链接</button>
      <div class="tiny muted center" style="margin-top:10px">演示版不直接调起微信，正式版可接入微信 JS-SDK</div>
    `);
  }

  function copyShare() {
    const id = ui.sharePost;
    const link = location.origin + location.pathname + '#post=' + id;
    const done = () => toast('链接已复制，去微信粘贴给好友吧');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => { fallbackCopy(link); done(); });
    } else { fallbackCopy(link); done(); }
  }
  function copyText(text) {
    return new Promise((resolve) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(() => { fallbackCopy(text); resolve(); });
      } else { fallbackCopy(text); resolve(); }
    });
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  function deletePost(id) {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 8px">删除这条动态？</h3>
      <p class="tiny muted" style="margin:0 0 16px">删除后其他人就看不到了，无法恢复。</p>
      <button class="btn btn-primary btn-block" style="background:#C6553F;box-shadow:none" onclick="App.doDeletePost('${id}')">确认删除</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal()">再想想</button>
    `);
  }
  function doDeletePost(id) {
    const i = store.posts.findIndex((p) => p.id === id);
    if (i >= 0) store.posts.splice(i, 1);
    save(); closeAllModals(); refreshPosts(); toast('已删除');
  }

  function report(id) {
    const p = store.posts.find((x) => x.id === id);
    if (!p) return;
    const reasons = ['虚假健康信息', '广告推销', '饮食方案明显有害', '人身攻击 / 不友善', '侵犯隐私', '其他'];
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">举报这条动态</h3>
      <p class="tiny muted" style="margin:0 0 12px">${esc(p.title)}</p>
      <div class="opts" id="report-reasons">
        ${reasons.map((r, i) => `<button class="opt" data-r="${esc(r)}" onclick="App.pickReason(this)">${esc(r)}</button>`).join('')}
      </div>
      <textarea id="report-text" class="input-mini" style="height:80px;margin-top:10px;padding:10px;resize:none" placeholder="补充说明（可选）"></textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.sendReport('${id}')">提交举报</button>
      <div class="tiny muted center" style="margin-top:8px">举报会汇总到管理员后台，我们会在 24 小时内处理</div>
    `);
  }
  function pickReason(btn) {
    document.querySelectorAll('#report-reasons .opt').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
  }
  function sendReport(id) {
    const p = store.posts.find((x) => x.id === id);
    if (!p) return;
    const picked = document.querySelector('#report-reasons .opt.on');
    if (!picked) { toast('请选择举报原因', true); return; }
    const extra = (document.getElementById('report-text').value || '').trim();
    store.reports = store.reports || [];
    store.reports.push({
      id: 'r' + Date.now(), postId: id, postTitle: p.title, postAuthor: p.authorName,
      reporter: me.name, reporterPhone: me.phone,
      reason: picked.dataset.r + (extra ? '：' + extra : ''), time: new Date().toLocaleString('zh-CN'), status: 'pending',
    });
    save(); closeAllModals(); toast('举报已提交，感谢你的认真');
  }

  function supervise(id) {
    const sup = me.supervise || { date: '', count: 0, targets: [] };
    if (sup.date !== todayKey()) { sup.date = todayKey(); sup.count = 0; sup.targets = []; }
    if ((sup.targets || []).includes(id)) { toast('今天已经监督过这一条了'); return; }
    if (sup.count >= 10) { toast('今天的 10 次监督额度用完了，明天再来', true); return; }
    const p = store.posts.find((x) => x.id === id);
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">给 ${esc(p.authorName)} 写一句激励</h3>
      <p class="tiny muted" style="margin:0 0 10px">写一句真心话，才算一次有效监督（+1 积分）</p>
      <div class="opts" id="encourage-quick">
        ${['今天也别放弃呀', '你的方案我跟着吃了两天', '慢慢来，我盯着你呢', '明天记得打卡'].map((t) => `<button class="opt" onclick="App.quickEncourage(this)">${t}</button>`).join('')}
      </div>
      <textarea id="sup-text" class="input-mini" style="height:80px;margin-top:10px;padding:10px;resize:none" placeholder="写点你的话…"></textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.sendSupervise('${id}')">送出监督（+1 积分）</button>
      <div class="tiny muted center" style="margin-top:8px">今天已监督 ${sup.count} / 10 位</div>
    `);
  }
  function quickEncourage(btn) {
    const ta = document.getElementById('sup-text');
    if (ta) ta.value = btn.textContent;
    document.querySelectorAll('#encourage-quick .opt').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
  }
  function sendSupervise(id) {
    const ta = document.getElementById('sup-text');
    const text = (ta && ta.value || '').trim();
    if (text.length < 4) { toast('至少写 4 个字，才算真心监督', true); return; }
    const sup = me.supervise;
    if (sup.date !== todayKey()) { sup.date = todayKey(); sup.count = 0; sup.targets = []; }
    if (sup.count >= 10) { toast('今天额度用完了', true); return; }
    sup.count++; sup.targets.push(id);
    me.points = (me.points || 0) + 1;
    const p = store.posts.find((x) => x.id === id);
    if (p) {
      p.comments = p.comments || [];
      p.comments.push({ id: 'sc' + Date.now(), userId: me.id, name: me.name + '（监督）', text, time: '刚刚' });
    }
    save(); closeAllModals(); refreshPosts();
    toast('监督已送出，+1 积分');
  }

  function sharePlan() {
    if (!me.plan) { toast('先生成方案，再发布到广场', true); startQuiz(); return; }
    const day = me.plan.week[0];
    const title = `我的${GOAL_NAME[me.profile.goal]}方案 · ${me.plan.target} 千卡/天`;
    const summary = `早餐 ${day.meals[0].items.map((i) => i.name).join(' + ')}；午餐 ${day.meals[1].items.map((i) => i.name).join(' + ')}；晚餐 ${day.meals[2].items.map((i) => i.name).join(' + ')}。日均餐费约 ¥${me.plan.avgCost}。`;
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 10px">发布到用户广场</h3>
      <div class="field"><label>标题</label><input class="input-mini" id="post-title" value="${esc(title)}" /></div>
      <div class="field"><label>方案描述</label><textarea class="input-mini" id="post-sum" style="height:110px;padding:10px;resize:none">${esc(summary)}</textarea></div>
      <button class="btn btn-primary btn-block" onclick="App.doSharePlan()">发布</button>
      <div class="tiny muted center" style="margin-top:8px">发布后其他人可以点赞、评论、监督你打卡</div>
    `);
  }
  function doSharePlan() {
    const title = (document.getElementById('post-title').value || '').trim();
    const summary = (document.getElementById('post-sum').value || '').trim();
    if (!title || !summary) { toast('标题和描述都要写', true); return; }
    store.posts.unshift({
      id: 'p' + Date.now(), authorId: me.id, authorName: me.name, avatar: me.avatar || '🌿',
      title, summary, goal: GOAL_NAME[me.profile.goal] || '健康', kcal: me.plan.target,
      tags: ['我的方案', me.profile.cityTier === 't1' ? '一线' : me.profile.cityTier === 't3' ? '三四线' : '二线'],
      likes: 0, likedBy: [], comments: [], time: '刚刚',
    });
    save(); closeAllModals();
    if (tab === 'records') refreshPosts();
    toast('已发布到广场');
  }

  /* ============================================================
     记录弹窗
     ============================================================ */
  function addWeight() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">记录体重</h3>
      <p class="tiny muted" style="margin:0 0 12px">建议固定在早上空腹、同一台秤上称</p>
      <div class="row" style="gap:10px">
        <input class="input-mini" id="w-input" type="number" step="0.1" placeholder="例如 60.5" value="${me.profile ? me.profile.weight : ''}" />
        <span class="tiny muted">kg</span>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="App.saveWeight()">保存</button>
    `);
  }
  function saveWeight() {
    const v = parseFloat(document.getElementById('w-input').value);
    if (!v || v < 20 || v > 300) { toast('请输入合理的体重', true); return; }
    me.records.weight.push({ v, date: todayKey() });
    if (me.profile) me.profile.weight = v;
    save(); closeAllModals();
    renderRecords();
    toast('体重已记录');
  }

  function addMeal() {
    const ctx = todayCtx();
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">记录饮食</h3>
      <p class="tiny muted" style="margin:0 0 12px">吃的是方案里的，还是自己另外吃的？</p>
      ${ctx ? ctx.day.meals.map((m) => `<button class="list-item" style="border-radius:12px;background:#F8FBF6;margin-bottom:8px" onclick="App.quickMeal('${m.label}',${m.kcal})">
        <span class="li-ico">${m.label.charAt(0)}</span>
        <span class="li-t">${m.label} · 按方案吃</span><span class="li-v">${m.kcal} 千卡</span></button>`).join('') : ''}
      <div class="divider"></div>
      <div class="field"><label>或者自己记一笔</label>
        <input class="input-mini" id="meal-name" placeholder="吃了什么，例如 牛肉面" /></div>
      <div class="field"><label>估算热量（千卡）</label>
        <input class="input-mini" id="meal-kcal" type="number" placeholder="例如 550" /></div>
      <button class="btn btn-primary btn-block" onclick="App.saveMeal()">保存</button>
    `);
  }
  function quickMeal(label, kcal) {
    me.records.meal.push({ name: label + '（按方案）', kcal, date: todayKey() });
    save(); closeAllModals(); renderRecords(); toast('已记录 ' + label);
  }
  function saveMeal() {
    const name = (document.getElementById('meal-name').value || '').trim();
    const kcal = parseInt(document.getElementById('meal-kcal').value, 10);
    if (!name || !kcal) { toast('名称和热量都填一下', true); return; }
    me.records.meal.push({ name, kcal, date: todayKey() });
    save(); closeAllModals(); renderRecords(); toast('饮食已记录');
  }

  function addExercise() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 12px">记录运动</h3>
      <div class="field"><label>做了什么</label><input class="input-mini" id="ex-name" placeholder="例如 快走 / 力量训练" /></div>
      <div class="field"><label>时长（分钟）</label><input class="input-mini" id="ex-min" type="number" placeholder="30" /></div>
      <button class="btn btn-primary btn-block" onclick="App.saveExercise()">保存</button>
    `);
  }
  function saveExercise() {
    const name = (document.getElementById('ex-name').value || '').trim();
    const min = parseInt(document.getElementById('ex-min').value, 10);
    if (!name || !min) { toast('填完整再保存', true); return; }
    me.records.exercise.push({ name, min, kcal: Math.round(min * 6), date: todayKey() });
    if (me.plan) {
      const key = todayKey();
      const ck = me.checkins[key] || { items: [] };
      if (!ck.items.includes('w')) { ck.items.push('w'); me.checkins[key] = ck; if (markChecked()) me.points = (me.points || 0) + 3; }
    }
    save(); closeAllModals(); renderHome(); renderRecords(); toast('运动已记录，+3 积分');
  }

  /* ============================================================
     树洞
     ============================================================ */
  let thMood = '平静';
  function showTreehole() {
    renderTreehole();
    showScreen('treehole');
  }
  function renderTreehole() {
    const list = (me.treehole || []).slice().reverse();
    $('#view-treehole').innerHTML = `
      <div class="appbar" style="padding-left:0;padding-right:0">
        <button class="icon-btn" onclick="App.backFromSub()">←</button>
        <div class="grow center"><div class="who">树洞</div><div class="tiny muted">只存在你这台手机里</div></div>
        <div style="width:36px"></div>
      </div>
      <div class="treehole-hero">
        <h3>说给树听就好</h3>
        <p>这里不评判、不建议、不追问。写下来的那一刻，情绪就轻了一点。</p>
        <div class="mood-pick">
          ${['平静', '累', '烦', '孤单', '想哭', '有点开心'].map((m) => `<button class="${thMood === m ? 'on' : ''}" onclick="App.setMood('${m}')">${m}</button>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <textarea id="th-text" class="input-mini" style="height:120px;padding:12px;resize:none;border:1px solid #EFE8D8;border-radius:4px;background:#FBF8F1" placeholder="今天发生了什么？"></textarea>
        <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="App.saveTreehole()">放进树洞</button>
        <div class="tiny dim center" style="margin-top:8px">内容仅保存在本机浏览器，不上传云端</div>
      </div>
      <div class="section-title"><h3>我说过的</h3><span class="more">${list.length} 条</span></div>
      <div class="card">
        ${list.length ? `<div class="th-list">${list.map((t) => `<div class="th-item"><div>${esc(t.text)}</div><div class="time">${esc(t.time)} · ${esc(t.mood || '')}</div></div>`).join('')}</div>` : '<div class="empty"><div class="e">🍃</div>还没有说过什么，慢慢来</div>'}
      </div>
      <div class="disclaimer">如果你正经历持续的低落或伤害自己的想法，请务必联系信任的人，或拨打心理援助热线 12356。</div>
    `;
  }
  function setMood(m) { thMood = m; renderTreehole(); }
  function saveTreehole() {
    const ta = document.getElementById('th-text');
    const text = (ta && ta.value || '').trim();
    if (!text) { toast('写一句也好', true); return; }
    me.treehole = me.treehole || [];
    me.treehole.push({ text, mood: thMood, time: new Date().toLocaleString('zh-CN') });
    save(); renderTreehole(); toast('已放进树洞，只有你能看到');
  }
  function backFromSub() { showScreen('main'); switchTab(tab === 'treehole' ? 'home' : tab); }

  /* ============================================================
     项目提示 / 通知
     ============================================================ */
  function openNotices() {
    const warns = (me.warnings || []);
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 10px">消息</h3>
      ${warns.length ? warns.map((w) => `<div class="card card-flat" style="padding:12px;margin-bottom:8px;background:#FBF6E8;border-color:#F0E3C4"><div class="fs-12 fw-6" style="color:#8A6A22">管理员提醒</div><div class="tiny" style="color:#8C7442;margin-top:2px">${esc(w.text)}</div><div class="tiny dim" style="margin-top:4px">${esc(w.time)}</div></div>`).join('') : '<div class="empty"><div class="e">🔔</div>暂时没有新消息</div>'}
      <div class="divider"></div>
      <div class="tiny muted">连续陪伴 ${me.streak} 天 · 对话 ${me.chatRounds || 0} 轮 · 积分 ${me.points || 0}</div>
    `);
  }

  function viewPlan() {
    if (!me.plan) { startQuiz(); return; }
    renderPlan();
    showScreen('plan');
  }

  /* ============================================================
     商城 / 心愿单 / 兑换
     ============================================================ */
  function renderMarket() {
    if (!me) return;
    const all = store.products.filter((p) => p.status !== 0);
    const baseCats = Array.from(new Set(all.map((p) => p.cat)));
    const tagCats = Array.from(new Set(all.flatMap((p) => p.tags || []))).filter((t) => t && t.length <= 4 && !baseCats.includes(t)).slice(0, 6);
    const cats = ['全部', ...baseCats, ...tagCats];
    if (!cats.includes(ui.marketCat)) ui.marketCat = '全部';
    const list = ui.marketCat === '全部' ? all : all.filter((p) => p.cat === ui.marketCat || (p.tags || []).includes(ui.marketCat));
    const recs = me.profile ? E.recommendProducts(me.profile, all, 3) : all.slice(0, 3);

    $('#view-market').innerHTML = `
      <div class="appbar" style="padding-left:0;padding-right:0">
        <div class="grow"><div class="who" style="font-size:1.06rem">农小禾慧选</div><div class="tiny muted">产地直采 · 当季优先</div></div>
        <span class="points-pill">🌾 ${me.points || 0}</span>
      </div>

      <div class="market-hero" style="margin-top:6px">
        <h2>从田间到餐桌，少一点加工</h2>
        <p>积分价 = 人民币价格 × 20，打卡、监督都能攒积分。</p>
      </div>

      <div class="section-title"><h3>为你推荐</h3><span class="more">按你的健康档案</span></div>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px">
        ${recs.map((p) => `<div style="flex:0 0 68%">${productCard(p, true)}</div>`).join('')}
      </div>

      <div class="cat-row">
        ${cats.map((c) => `<button class="chip ${ui.marketCat === c ? 'on' : ''}" style="${ui.marketCat === c ? 'background:#1B3A2F;color:#F7F3EA;border-color:#1B3A2F' : ''}" onclick="App.setCat('${esc(c)}')">${esc(c)}</button>`).join('')}
      </div>

      <div class="prod-grid">
        ${list.map((p) => productCard(p, false)).join('')}
      </div>

      <div class="disclaimer">商品图片与价格为演示素材，标注为参考价·仅供估算。支持在线下单购买；演示环境中的支付为模拟流程，不产生真实扣款。</div>
    `;
  }

  function monoOf(name) {
    const cn = String(name || '').replace(/[^\u4e00-\u9fa5]/g, '');
    return cn.charAt(0) || '禾';
  }

  function productCard(p, wide) {
    const inWish = (me.wishlist || []).includes(p.id);
    const showPhoto = p.img && !p.poster;
    const img = showPhoto
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" />`
      : `<span class="prod-mono">${monoOf(p.name)}</span><span class="prod-cap">${esc(p.cat || '农小禾')}</span>`;
    return `<div class="prod-card ${wide ? 'wide' : ''}" ${wide ? '' : `id="prod-${p.id}"`} style="${wide ? 'box-shadow:0 6px 20px rgba(24,73,43,.07)' : ''}">
      <div class="prod-img" onclick="App.showProduct('${p.id}')">${img}${p.tags && p.tags[0] ? `<span class="tag-float">${esc(p.tags[0])}</span>` : ''}${p.videoUrl ? '<span class="video-flag">▶ 视频</span>' : ''}</div>
      <div class="prod-body">
        <div class="nm" onclick="App.showProduct('${p.id}')">${esc(p.name)}</div>
        <div class="tiny dim">${esc(p.spec || '')}</div>
        <div class="ds">${esc(p.desc || '')}</div>
        <div class="prod-pts">${p.points} <small>积分 · ¥${p.price}</small></div>
        <div class="prod-actions">
          <button class="b exchange" onclick="App.exchange('${p.id}')">积分兑换</button>
          <button class="b wish ${inWish ? 'on' : ''}" onclick="App.toggleWish('${p.id}')">${inWish ? '已收藏' : '心愿单'}</button>
        </div>
      </div>
    </div>`;
  }

  function setCat(c) { ui.marketCat = c; renderMarket(); }

  function toggleWish(id) {
    me.wishlist = me.wishlist || [];
    const i = me.wishlist.indexOf(id);
    if (i >= 0) { me.wishlist.splice(i, 1); toast('已移出心愿单'); }
    else { me.wishlist.push(id); toast('已加入心愿单'); }
    save(); renderMarket();
  }

  function exchange(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return;
    if ((me.points || 0) < p.points) {
      openModal(`
        <div class="modal-close" onclick="App.closeModal()">✕</div>
        <div style="text-align:center;padding:6px 0">
          <div class="emoji-soft" style="font-size:34px">🌾</div>
          <h3 style="margin:8px 0 4px">积分还差一点</h3>
          <p class="tiny muted" style="margin:0 0 14px">还差 ${p.points - (me.points || 0)} 积分。打卡 +3/次，监督别人 +1/次（每天最多 10 次）。</p>
          <button class="btn btn-primary btn-block" onclick="App.closeModal();App.goCheckin()">去打卡赚积分</button>
        </div>`, { center: true });
      return;
    }
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">确认兑换</h3>
      <p class="tiny muted" style="margin:0 0 12px">${esc(p.name)} · ${p.spec || ''}</p>
      <div class="card card-flat" style="padding:12px">
        <div class="row between"><span class="tiny muted">消耗积分</span><span class="num fw-6">${p.points}</span></div>
        <div class="row between" style="margin-top:6px"><span class="tiny muted">兑换后余额</span><span class="num">${(me.points || 0) - p.points}</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="App.doExchange('${p.id}')">确认兑换</button>
      <div class="tiny dim center" style="margin-top:8px">演示机制：不涉及真实支付，不发放实物</div>
    `);
  }

  function doExchange(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return;
    if ((me.points || 0) < p.points) { toast('积分不足', true); return; }
    me.points -= p.points;
    me.redemptions = me.redemptions || [];
    me.redemptions.unshift({ id: 'rd' + Date.now(), productId: p.id, name: p.name, points: p.points, time: new Date().toLocaleString('zh-CN') });
    if (p.stock > 0) p.stock--;
    saveNow(); closeAllModals(); renderMarket();
    toast('兑换成功，可在「我的 → 积分」查看记录');
  }

  /* ============================================================
     商品详情 / 购买
     ============================================================ */
  let currentProduct = null;

  function showProduct(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) { toast('商品不存在或已下架', true); return; }
    currentProduct = p;
    renderProduct(p);
    showScreen('product');
  }

  // 兼容旧入口：对话里的产品小卡也进详情页
  function openProduct(id) { showProduct(id); }

  function backFromProduct() {
    showScreen('main');
    renderMarket();
  }

  function renderProduct(p) {
    const inWish = (me.wishlist || []).includes(p.id);
    const usePhoto = p.img && !p.poster;
    const pic = usePhoto
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" />`
      : `<div class="pd-seal"><span>${monoOf(p.name)}</span><em>${esc(p.cat || '农小禾')}</em></div>`;
    const sold = p.sold || 0;
    const video = p.videoUrl
      ? `<a class="pd-video" href="${esc(p.videoUrl)}" target="_blank" rel="noopener">
           <span class="pv-ico">▶</span>
           <span class="pv-txt"><b>观看产品视频</b><em>在浏览器中打开介绍视频</em></span>
           <span class="pv-arr">↗</span>
         </a>`
      : '';
    const detail = (p.detail || p.desc || '')
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => `<p>${esc(line)}</p>`)
      .join('');

    $('#view-product').innerHTML = `
      <div class="pd-top">
        <button class="pd-back" onclick="App.backFromProduct()" aria-label="返回">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5 8 12l6.5 7"/></svg>
        </button>
        <span class="pd-top-t">慧选详情</span>
        <button class="pd-share" onclick="App.shareProduct('${p.id}')">分享</button>
      </div>

      <div class="pd-hero">${pic}</div>

      <div class="pd-main">
        <div class="pd-cat">${esc(p.cat || '农小禾')}</div>
        <h2 class="pd-name">${esc(p.name)}</h2>
        <div class="pd-desc-line">${esc(p.desc || '')}</div>

        <div class="pd-price-row">
          <div class="pd-price"><small>¥</small>${p.price}<span>· ${p.points} 积分可兑换</span></div>
          <div class="pd-sold">已售 ${sold} · 库存 ${p.stock > 0 ? p.stock : 0}</div>
        </div>

        <div class="pd-tags">${(p.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>

        <div class="pd-meta">
          <div><span>规格</span><b>${esc(p.spec || '—')}</b></div>
          <div><span>产地</span><b>${esc(p.origin || '农小禾合作农场')}</b></div>
          <div><span>发货</span><b>${esc(p.ship || '48 小时内发出')}</b></div>
        </div>

        ${video}

        <div class="pd-sec">
          <div class="pd-sec-t">产品介绍</div>
          <div class="pd-detail">${detail || '<p>暂无详细介绍。</p>'}</div>
        </div>

        <div class="disclaimer">商品图片与价格为演示素材；积分兑换与在线支付在演示环境中不产生真实交易。</div>
      </div>

      <div class="pd-bar">
        <button class="pd-ico-btn ${inWish ? 'on' : ''}" onclick="App.toggleWishFromDetail('${p.id}')">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M12 20s-7-4.3-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.7 12 20 12 20Z"/></svg>
          <span>${inWish ? '已收藏' : '心愿单'}</span>
        </button>
        <button class="pd-ghost-btn" onclick="App.exchange('${p.id}')">积分兑换</button>
        <button class="pd-buy-btn" onclick="App.buyProduct('${p.id}')">立即购买</button>
      </div>
    `;
  }

  function toggleWishFromDetail(id) {
    toggleWish(id);
    const p = store.products.find((x) => x.id === id);
    if (p) renderProduct(p);
  }

  function shareProduct(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return;
    const url = location.origin + location.pathname + '?sharecode=' + (new URLSearchParams(location.search).get('sharecode') || '') + '#product=' + id;
    copyText(url).then(() => toast('商品链接已复制，可发给朋友'));
  }

  function buyProduct(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return;
    if (p.stock !== undefined && p.stock <= 0 && p.status !== 0) {
      toast('这件商品暂时没货了', true);
      return;
    }
    ui.buyQty = 1;
    ui.buyPay = 'wechat';
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">确认订单</h3>
      <p class="tiny muted" style="margin:0 0 14px">填写收货信息，提交后完成支付</p>

      <div class="buy-prod">
        <div class="buy-pic">${p.img ? `<img src="${esc(p.img)}" alt="" />` : `<span>${monoOf(p.name)}</span>`}</div>
        <div class="grow">
          <div class="fs-12 fw-6">${esc(p.name)}</div>
          <div class="tiny muted">${esc(p.spec || '')}</div>
          <div class="buy-price">¥ ${p.price}</div>
        </div>
        <div class="qty-step">
          <button onclick="App.buyQty(-1)">−</button>
          <span id="buy-qty">1</span>
          <button onclick="App.buyQty(1)">+</button>
        </div>
      </div>

      <div class="buy-form">
        <label>收货人</label>
        <input class="input-mini" id="buy-name" maxlength="20" value="${esc(me.name || '')}" placeholder="请填写收货人姓名" />
        <label style="margin-top:10px">手机号</label>
        <input class="input-mini num" id="buy-phone" maxlength="11" value="${esc(me.phone || '')}" placeholder="11 位手机号" />
        <label style="margin-top:10px">收货地址</label>
        <textarea class="input-mini" id="buy-addr" style="height:64px;padding:9px;resize:none" placeholder="省 / 市 / 区，详细地址">${esc(me.address || '')}</textarea>
        <label style="margin-top:10px">支付方式</label>
        <div class="pay-pick" id="pay-pick">
          <button class="on" data-pay="wechat" onclick="App.pickPay('wechat')">微信支付</button>
          <button data-pay="alipay" onclick="App.pickPay('alipay')">支付宝</button>
        </div>
      </div>

      <div class="buy-total"><span>合计</span><b>¥ <em id="buy-total">${p.price}</em></b></div>
      <button class="btn btn-primary btn-block btn-lg" onclick="App.submitOrder('${p.id}')">提交订单</button>
      <div class="tiny dim center" style="margin-top:8px;line-height:1.7">演示环境：支付为模拟流程，不会真实扣款<br/>接入微信支付商户号后即可真实收款</div>
    `);
  }

  function buyQty(delta) {
    const p = currentProduct || (store.products[0]);
    const max = Math.max(1, Math.min(p.stock || 99, 99));
    ui.buyQty = Math.min(max, Math.max(1, (ui.buyQty || 1) + delta));
    const el = document.getElementById('buy-qty');
    if (el) el.textContent = ui.buyQty;
    updateBuyTotal();
  }

  function updateBuyTotal() {
    const p = currentProduct;
    const el = document.getElementById('buy-total');
    if (!p || !el) return;
    el.textContent = (p.price * (ui.buyQty || 1)).toFixed(2).replace(/\.00$/, '');
  }

  function pickPay(m) {
    ui.buyPay = m;
    document.querySelectorAll('#pay-pick button').forEach((b) => b.classList.toggle('on', b.dataset.pay === m));
  }

  function submitOrder(id) {
    const p = store.products.find((x) => x.id === id);
    if (!p) return;
    const name = (document.getElementById('buy-name').value || '').trim();
    const phone = (document.getElementById('buy-phone').value || '').trim();
    const addr = (document.getElementById('buy-addr').value || '').trim();
    if (!name) { toast('请填写收货人', true); return; }
    if (!/^1\d{10}$/.test(phone)) { toast('请填写正确的 11 位手机号', true); return; }
    if (addr.length < 6) { toast('请填写详细收货地址', true); return; }

    const qty = ui.buyQty || 1;
    const amount = Number((p.price * qty).toFixed(2));
    const order = {
      id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      createdAt: new Date().toLocaleString('zh-CN'),
      userPhone: me.phone,
      userName: me.name,
      productId: p.id,
      productName: p.name,
      productImg: p.img || '',
      price: p.price,
      qty,
      amount,
      payMethod: ui.buyPay === 'alipay' ? 'alipay' : 'wechat',
      status: 'pending',
      receiver: name,
      phone,
      address: addr,
    };
    me.address = addr;
    store.orders = store.orders || [];
    store.orders.unshift(order);
    saveNow();
    closeAllModals();
    showPay(order.id);
  }

  function showPay(orderId) {
    const o = (store.orders || []).find((x) => x.id === orderId);
    if (!o) return;
    const payName = o.payMethod === 'alipay' ? '支付宝' : '微信支付';
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <div class="pay-head">
        <div class="pay-amt">¥ ${o.amount.toFixed(2)}</div>
        <div class="tiny muted">订单 ${o.id.toUpperCase()} · ${payName}</div>
      </div>
      <div class="pay-qr"><div class="pqq">禾</div><div class="tiny muted" style="margin-top:8px">演示支付二维码</div></div>
      <button class="btn btn-primary btn-block btn-lg" onclick="App.payOrder('${o.id}')">完成支付（演示）</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal();App.openMyOrders()">稍后再付</button>
      <div class="tiny dim center" style="margin-top:10px;line-height:1.7">当前为演示支付，不会真实扣款<br/>正式收款需配置微信支付商户号与回调域名</div>
    `, { center: true });
  }

  function payOrder(id) {
    const o = (store.orders || []).find((x) => x.id === id);
    if (!o || o.status !== 'pending') return;
    o.status = 'paid';
    o.paidAt = new Date().toLocaleString('zh-CN');
    const p = store.products.find((x) => x.id === o.productId);
    if (p) {
      p.stock = Math.max(0, (p.stock || 0) - o.qty);
      p.sold = (p.sold || 0) + o.qty;
    }
    saveNow();
    closeAllModals();
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <div style="text-align:center;padding:8px 0 4px">
        <div class="pay-ok">✓</div>
        <h3 style="margin:10px 0 4px">支付成功</h3>
        <p class="tiny muted" style="margin:0 0 6px">${esc(o.productName)} × ${o.qty}</p>
        <p class="tiny dim" style="margin:0 0 16px">我们会在 48 小时内发出，可在「我的 → 我的订单」查看</p>
        <button class="btn btn-primary btn-block" onclick="App.closeModal();App.openMyOrders()">查看订单</button>
      </div>
    `, { center: true });
    if (currentProduct && currentProduct.id === o.productId) renderProduct(currentProduct);
  }

  const ORDER_STATUS = {
    pending: { t: '待支付', c: 'warn' },
    paid: { t: '已支付', c: 'ok' },
    shipped: { t: '已发货', c: 'ship' },
    done: { t: '已完成', c: 'done' },
  };

  function orderStatusOf(s) {
    return ORDER_STATUS[s] || { t: s, c: '' };
  }

  function openMyOrders() {
    const list = (store.orders || []).filter((o) => o.userPhone === me.phone);
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">我的订单</h3>
      <p class="tiny muted" style="margin:0 0 12px">${list.length} 笔 · 演示支付不产生真实交易</p>
      ${list.length ? list.map((o) => {
        const st = orderStatusOf(o.status);
        return `<div class="order-row">
          <div class="order-pic">${o.productImg ? `<img src="${esc(o.productImg)}" alt="" />` : `<span>${monoOf(o.productName)}</span>`}</div>
          <div class="grow">
            <div class="fs-12 fw-6">${esc(o.productName)} <span class="tiny dim">× ${o.qty}</span></div>
            <div class="tiny muted">${esc(o.createdAt)}</div>
            <div class="order-bot"><b>¥ ${o.amount.toFixed(2)}</b><span class="ost ${st.c}">${st.t}</span></div>
          </div>
          ${o.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="App.closeModal();App.showPay('${o.id}')">去支付</button>` : ''}
        </div>`;
      }).join('') : '<div class="empty"><div class="e">🧾</div>还没有订单</div>'}
    `);
  }

  function goCheckin() { switchTab('records'); }

  /* ============================================================
     个人中心
     ============================================================ */
  function renderProfile() {
    if (!me) return;
    const level = E.levelOf(me.points || 0);
    const bmiV = me.profile ? E.bmi(me.profile.weight, me.profile.height) : null;
    const wish = (me.wishlist || []).map((id) => store.products.find((p) => p.id === id)).filter(Boolean);
    const elder = !!(me.settings && me.settings.elder);

    $('#view-profile').innerHTML = `
      <div class="appbar" style="padding-left:0;padding-right:0">
        <div class="grow"><div class="who" style="font-size:1.06rem">我的</div><div class="tiny muted">农小禾健康 · 陪你慢慢变好</div></div>
        <button class="icon-btn" onclick="App.openNotices()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 9.2a6 6 0 1 1 12 0c0 3.4 1 4.9 1.8 5.9H4.2C5 14.1 6 12.6 6 9.2Z"/><path d="M9.6 18.2a2.4 2.4 0 0 0 4.8 0"/></svg></button>
      </div>

      <div class="profile-head">
        <div class="avatar-lg" onclick="App.editAvatar()">${esc(me.avatar || '🌿')}<span class="edit">✎</span></div>
        <div class="grow">
          <div class="nm">${esc(me.name)} <button class="name-edit" onclick="App.editName()">编辑</button></div>
          <div class="ph">${me.phone.slice(0, 3)} **** ${me.phone.slice(-4)} · 连续 ${me.streak || 1} 天</div>
          <div class="row" style="margin-top:5px"><span class="badge">${level.icon}${level.name}</span><span class="badge gray">${me.profile ? GOAL_NAME[me.profile.goal] : '未定制'}</span></div>
        </div>
      </div>

      <div class="kv-grid">
        <div class="kv"><div class="k">当前体重</div><div class="v">${me.profile ? me.profile.weight : '—'}<small>kg</small></div></div>
        <div class="kv"><div class="k">目标体重</div><div class="v">${me.profile ? me.profile.targetWeight : '—'}<small>kg</small></div></div>
        <div class="kv"><div class="k">BMI</div><div class="v">${bmiV ? bmiV.value : '—'}<small>${bmiV ? bmiV.label : ''}</small></div></div>
      </div>

      <div class="points-card" style="margin-top:12px">
        <div class="row between" style="align-items:flex-start">
          <div><div class="pc-lbl">我的积分</div><div class="pc-num">${me.points || 0}</div></div>
          <span class="pc-lv">${level.name}</span>
        </div>
        <div class="pc-bar"><i style="width:${level.pct}%"></i></div>
        <div class="row between" style="margin-top:6px;font-size:.66rem;opacity:.8">
          <span>打卡 +3 / 监督 +1</span><span>${level.next ? '再 ' + (level.next - (me.points || 0)) + ' 分升级' : '已满级'}</span>
        </div>
      </div>

      <div class="section-title"><h3>我的内容</h3></div>
      <div class="list">
        <button class="list-item" onclick="App.viewPlan()"><span class="li-ico">案</span><span class="li-t">我的方案<span class="tiny dim" style="display:block">${me.plan ? me.plan.target + ' 千卡 · 日均 ¥' + me.plan.avgCost : '还没定制'}</span></span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.goRecords()"><span class="li-ico">记</span><span class="li-t">我的记录<span class="tiny dim" style="display:block">体重 / 饮食 / 运动</span></span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.openWishlist()"><span class="li-ico">愿</span><span class="li-t">我的心愿单<span class="tiny dim" style="display:block">${wish.length} 件商品</span></span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.openMyOrders()"><span class="li-ico">单</span><span class="li-t">我的订单<span class="tiny dim" style="display:block">${(store.orders || []).filter((o) => o.userPhone === me.phone).length} 笔 · 查看物流状态</span></span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.openPoints()"><span class="li-ico">分</span><span class="li-t">积分与等级<span class="tiny dim" style="display:block">${(me.redemptions || []).length} 条兑换记录</span></span><span class="arrow">›</span></button>
      </div>

      <div class="section-title"><h3>设置</h3></div>
      <div class="list">
        <div class="list-item"><span class="li-ico">长</span><span class="li-t">长辈模式<span class="tiny dim" style="display:block">大字体 · 大按钮 · 只留三件事</span></span><span class="switch ${elder ? 'on' : ''}" onclick="App.toggleElder()"></span></div>
        <button class="list-item" onclick="App.refineInfo()"><span class="li-ico">补</span><span class="li-t">完善信息<span class="tiny dim" style="display:block">补填运动、饮食与经济条件</span></span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.feedback()"><span class="li-ico">馈</span><span class="li-t">建议与反馈</span><span class="arrow">›</span></button>
        <button class="list-item" onclick="App.privacy()"><span class="li-ico">隐</span><span class="li-t">隐私与免责说明</span><span class="arrow">›</span></button>
        <button class="list-item danger" onclick="App.logoutConfirm()"><span class="li-ico">退</span><span class="li-t">退出登录</span><span class="arrow">›</span></button>
      </div>
      ${disclaimerCard()}
      <div class="center" style="margin-top:12px"><span id="cloud-state" class="cloud-state wait">正在连接云端</span></div>
      <div class="center tiny dim" style="margin-top:6px">农小禾健康 v2.0 · 数据云端同步</div>
    `;
    updateCloudBadge();
  }

  function editName() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 10px">修改用户名</h3>
      <input class="input-mini" id="name-input" maxlength="12" value="${esc(me.name)}" />
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.saveName()">保存</button>
    `);
  }
  function saveName() {
    const v = (document.getElementById('name-input').value || '').trim();
    if (!v) { toast('名字不能为空', true); return; }
    me.name = v.slice(0, 12);
    save(); closeAllModals(); renderProfile(); toast('已更新');
  }

  function editAvatar() {
    const list = ['🌿', '🌾', '🍃', '🥑', '🐣', '🍊', '🌻', '🍵', '🌱', '🐰', '☀️', '🌙'];
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 10px">选一个头像</h3>
      <div class="opts" style="gap:10px">
        ${list.map((e) => `<button class="opt" style="font-size:24px;padding:10px 14px" onclick="App.setAvatar('${e}')">${e}</button>`).join('')}
      </div>
    `);
  }
  function setAvatar(e) { me.avatar = e; save(); closeAllModals(); renderProfile(); toast('头像已更新'); }

  function openWishlist() {
    const wish = (me.wishlist || []).map((id) => store.products.find((p) => p.id === id)).filter(Boolean);
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">我的心愿单</h3>
      <p class="tiny muted" style="margin:0 0 12px">${wish.length} 件 · 积分够了就能换</p>
      ${wish.length ? wish.map((p) => `<div class="row" style="gap:10px;padding:10px 0;border-bottom:1px dashed var(--line-soft)">
        <div style="width:46px;height:46px;border-radius:12px;background:#F2F8EE;display:grid;place-items:center;overflow:hidden;font-size:22px">${p.img ? `<img src="${esc(p.img)}" style="width:100%;height:100%;object-fit:cover" />` : p.emoji}</div>
        <div class="grow"><div class="fs-12 fw-6">${esc(p.name)}</div><div class="tiny muted">${p.points} 积分 · ¥${p.price}</div></div>
        <button class="btn btn-sm btn-primary" onclick="App.exchange('${p.id}')">兑换</button>
      </div>`).join('') : '<div class="empty"><div class="e">🧺</div>心愿单还是空的</div>'}
      <button class="btn btn-ghost btn-block" style="margin-top:12px" onclick="App.closeModal();App.goMarket()">去慧选逛逛</button>
    `);
  }

  function openPoints() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">积分与等级</h3>
      <p class="tiny muted" style="margin:0 0 12px">当前 ${me.points || 0} 分 · ${E.levelOf(me.points || 0).name}</p>
      <div class="card card-flat" style="padding:12px;margin-bottom:10px">
        <div class="tiny muted">获取方式</div>
        <div class="tiny" style="margin-top:4px">打卡 +3 · 监督他人打卡 +1（每天最多 10 次）· 新人礼 20</div>
      </div>
      ${(me.redemptions || []).length ? (me.redemptions || []).map((r) => `<div class="row between" style="padding:9px 0;border-bottom:1px dashed var(--line-soft)"><div><div class="fs-12">${esc(r.name)}</div><div class="tiny dim">${esc(r.time)}</div></div><span class="num" style="color:var(--gold)">-${r.points}</span></div>`).join('') : '<div class="empty"><div class="e">🌾</div>还没有兑换记录</div>'}
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.closeModal();App.goMarket()">去兑换</button>
    `);
  }

  function toggleElder() {
    me.settings = me.settings || {};
    me.settings.elder = !me.settings.elder;
    document.documentElement.classList.toggle('elder', me.settings.elder);

    if (me.settings.elder && me.plan) {
      // 备份原方案，并换成养生向方案（低强度、控三高、易咀嚼）
      me.planBackup = { plan: me.plan, text: me.planText, profile: me.profile };
      const p = Object.assign({}, me.profile, {
        elder: true,
        goal: me.profile.goal === 'chronic' ? 'chronic' : 'elder',
        equip: ['home'],
        trainDays: Math.min(3, me.profile.trainDays || 3),
        sessionMin: Math.min(30, me.profile.sessionMin || 30),
      });
      const plan = E.buildPlan(p);
      me.profile = p;
      me.plan = plan;
      me.planText = CH.fallbackNarrative(p, plan);
    } else if (!me.settings.elder && me.planBackup) {
      me.profile = me.planBackup.profile || me.profile;
      me.plan = me.planBackup.plan || me.plan;
      me.planText = me.planBackup.text || me.planText;
      me.planBackup = null;
    }

    save(); renderProfile();
    if (tab === 'home') renderHome();
    toast(me.settings.elder ? '已开启长辈模式：字更大、方案改为养生向' : '已关闭长辈模式，已恢复原方案');
  }

  function feedback() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">建议与反馈</h3>
      <p class="tiny muted" style="margin:0 0 10px">也可以在这里提出查询、更正、删除个人信息的请求</p>
      <textarea id="fb-text" class="input-mini" style="height:110px;padding:10px;resize:none" placeholder="哪里不好用？希望我们加什么？"></textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.sendFeedback()">提交</button>
      <div class="tiny dim center" style="margin-top:8px">我们会在合理期限内处理</div>
    `);
  }
  function sendFeedback() {
    const v = (document.getElementById('fb-text').value || '').trim();
    if (!v) { toast('写点什么再提交', true); return; }
    store.feedbacks = store.feedbacks || [];
    store.feedbacks.push({ id: 'f' + Date.now(), name: me.name, phone: me.phone, text: v, time: new Date().toLocaleString('zh-CN') });
    save(); closeAllModals(); toast('已收到，谢谢你');
  }

  function privacy() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 8px">隐私政策与免责声明</h3>
      <div class="tiny" style="color:var(--text-2);line-height:1.85;white-space:pre-wrap;max-height:62vh;overflow:auto">${esc(D.PRIVACY)}</div>
      <button class="btn btn-soft btn-block" style="margin-top:14px" onclick="App.closeModal()">我知道了</button>
    `);
  }

  function logoutConfirm() {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 8px">退出登录？</h3>
      <p class="tiny muted" style="margin:0 0 16px">退出后本机将停止会话，数据仍保存在你的账号下。</p>
      <button class="btn btn-primary btn-block" onclick="App.logout()">退出登录</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal()">取消</button>
    `);
  }

  function goRecords() { switchTab('records'); }
  function goMarket() { switchTab('market'); }

  /* ============================================================
     管理端
     ============================================================ */
  function showAdmin() {
    document.body.classList.add('admin-mode');
    document.documentElement.classList.remove('elder');
    showScreen('admin');
    document.querySelectorAll('#adm-nav button').forEach((b) => {
      b.onclick = () => { ui.adminPanel = b.dataset.ap; renderAdmin(); };
    });
    if (!$('#btn-admin-exit')._bound) { $('#btn-admin-exit')._bound = true; }
    renderAdmin();
  }

  function renderAdmin() {
    document.querySelectorAll('#adm-nav button').forEach((b) => b.classList.toggle('on', b.dataset.ap === ui.adminPanel));
    document.querySelectorAll('.adm-panel').forEach((p) => p.classList.remove('on'));
    const panel = document.getElementById('adm-panel-' + ui.adminPanel);
    if (panel) panel.classList.add('on');
    if (ui.adminPanel === 'products') renderAdmProducts();
    if (ui.adminPanel === 'users') renderAdmUsers();
    if (ui.adminPanel === 'wishes') renderAdmWishes();
    if (ui.adminPanel === 'orders') renderAdmOrders();
    if (ui.adminPanel === 'square') renderAdmSquare();
  }

  function admStats() {
    const users = store.users;
    const today = todayKey();
    return {
      products: store.products.length,
      online: store.products.filter((p) => p.status !== 0).length,
      users: users.length,
      plans: users.filter((u) => u.plan).length,
      chronic: users.filter((u) => (u.profile && (u.profile.chronic || []).filter((c) => c !== '无').length)).length,
      checkedToday: users.filter((u) => u.lastCheck === today).length,
      wishes: users.reduce((a, u) => a + (u.wishlist || []).length, 0),
      reports: (store.reports || []).filter((r) => r.status === 'pending').length,
      posts: store.posts.filter((p) => !p.removed).length,
    };
  }

  function admStatCard(k, v) {
    return `<div class="adm-stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  }

  function renderAdmProducts() {
    const s = admStats();
    const cats = Array.from(new Set(store.products.map((p) => p.cat)));
    $('#adm-panel-products').innerHTML = `
      <div class="adm-h">
        <h2>慧选产品库<small>/ PRODUCTS</small></h2>
        <div class="row" style="gap:8px">
          <div class="adm-search"><span style="opacity:.5">⌕</span><input placeholder="搜索产品名 / 标签" value="${esc(ui.adminSearch)}" oninput="App.admSearch(this.value)" /></div>
          <button class="adm-btn" onclick="App.admEditProduct()">+ 新增产品</button>
        </div>
      </div>
      <div class="adm-stats">
        ${admStatCard('TOTAL_SKU', s.products)}
        ${admStatCard('ONLINE', s.online)}
        ${admStatCard('CATEGORY', cats.length)}
        ${admStatCard('TOTAL_STOCK', store.products.reduce((a, p) => a + (p.stock || 0), 0))}
      </div>
      <div class="adm-prod-grid">
        ${store.products.filter((p) => {
          const q = (ui.adminSearch || '').trim();
          if (!q) return true;
          return (p.name + p.cat + (p.tags || []).join('')).includes(q);
        }).map((p) => `<div class="adm-prod">
          <div class="im">${p.img ? `<img src="${esc(p.img)}" alt="" />` : `<span class="adm-mono">${monoOf(p.name)}</span>`}</div>
          <div class="nm">${esc(p.name)}</div>
          <div class="pr">¥${p.price} · ${p.points} 积分 · 库存 ${p.stock || 0}</div>
          <div class="tg">${(p.tags || []).map((t) => `<span>#${esc(t)}</span>`).join('')}</div>
          <div class="tg" style="margin-top:5px;color:rgba(160,220,185,.5);font-size:.6rem">品类：${esc(p.cat)} · ${p.status !== 0 ? '在售' : '已下架'}${p.videoUrl ? ' · 含视频' : ''}</div>
          <div class="ops">
            <button onclick="App.admEditProduct('${p.id}')">编辑</button>
            <button class="del" onclick="App.admDelProduct('${p.id}')">删除</button>
          </div>
        </div>`).join('') || '<div class="adm-empty">NO DATA · 暂无匹配产品</div>'}
      </div>
    `;
  }

  function renderAdmUsers() {
    const s = admStats();
    const q = (ui.adminSearch || '').trim();
    const list = store.users.filter((u) => !q || (u.name + u.phone).includes(q));
    $('#adm-panel-users').innerHTML = `
      <div class="adm-h">
        <h2>用户健康档案<small>/ USERS</small></h2>
        <div class="adm-search"><span style="opacity:.5">⌕</span><input placeholder="搜索姓名 / 手机号" value="${esc(q)}" oninput="App.admSearch(this.value)" /></div>
      </div>
      <div class="adm-stats">
        ${admStatCard('USERS', s.users)}
        ${admStatCard('HAS_PLAN', s.plans)}
        ${admStatCard('CHRONIC', s.chronic)}
        ${admStatCard('CHECKED_TODAY', s.checkedToday)}
      </div>
      ${list.map((u) => {
        const p = u.profile;
        const goalName = p ? GOAL_NAME[p.goal] : '未定制';
        const open = ui.admOpenUser === u.id;
        return `<div class="adm-user-card">
          <div class="adm-user-head">
            <div class="av">${esc(u.avatar || '🌿')}</div>
            <div class="grow"><div class="u-nm">${esc(u.name)} <span style="color:rgba(160,220,185,.4);font-size:.64rem">${u.demo ? '· DEMO' : ''}</span></div>
              <div class="u-ph">${u.phone.slice(0, 3)}****${u.phone.slice(-4)} · 注册 ${new Date(u.joinedAt || Date.now()).toLocaleDateString('zh-CN')}</div></div>
            <span class="adm-tags" style="margin:0"><span>${goalName}</span><span>${u.streak || 1}D STREAK</span></span>
            <button class="adm-btn ghost" onclick="App.admToggleUser('${u.id}')">${open ? '收起' : '查看档案'}</button>
          </div>
          ${p ? `<div class="adm-tags">
            <span>${p.gender === 'male' ? '男' : '女'} / ${p.age}Y</span><span>${p.height}cm</span><span>${p.weight}kg</span>
            ${(p.chronic || []).filter((c) => c !== '无').map((c) => `<span style="color:#FFB4A6">! ${esc(c)}</span>`).join('')}
            ${(p.avoid || []).map((a) => `<span>忌 ${esc((D.AVOID_OPTIONS.find((x) => x.id === a) || {}).name || a)}</span>`).join('')}
            <span>预算 ¥${p.mealBudget}/餐</span><span>${p.trainDays}天/周</span>
          </div>` : '<div class="adm-tags"><span>尚未完成问卷</span></div>'}
          ${u.plan ? `<div class="adm-mini">
            <div><div class="k">BMR</div><div class="v">${u.plan.bmr}</div></div>
            <div><div class="k">TDEE</div><div class="v">${u.plan.tdee}</div></div>
            <div><div class="k">TARGET</div><div class="v">${u.plan.target}</div></div>
            <div><div class="k">PROTEIN</div><div class="v">${u.plan.macros.protein}g</div></div>
          </div>` : ''}
          ${open ? `<div style="margin-top:12px;border-top:1px solid rgba(53,255,158,.12);padding-top:12px">
            ${u.plan ? `
              <div class="adm-h" style="margin-bottom:8px"><h2 style="font-size:.8rem">AI 方案摘要<small>7 DAY PLAN</small></h2>
                <span style="font-family:ui-monospace;font-size:.64rem;color:rgba(160,220,185,.5)">日均餐费 ¥${u.plan.avgCost} / 预算 ¥${u.plan.dailyBudget}</span></div>
              <div style="font-size:.74rem;line-height:1.8;color:rgba(210,245,225,.8);margin-bottom:10px">${esc((u.planText && u.planText.reading) || '')}</div>
              ${u.plan.week.slice(0, 3).map((d) => `<div style="font-size:.7rem;color:rgba(190,235,210,.75);line-height:1.8">
                <b style="color:#7DFFC0">DAY ${d.dayIdx + 1}</b> · ${d.total.kcal} kcal / ¥${d.total.cost} · ${d.meals.map((m) => m.label + ':' + m.items.map((i) => i.name).join('+')).join(' | ')}
              </div>`).join('')}
              <div style="font-size:.64rem;color:rgba(160,220,185,.45);margin-top:6px">仅展示前 3 天，完整方案存于用户档案</div>
            ` : '<div class="adm-empty" style="padding:14px">NO PLAN</div>'}
            <div class="row" style="gap:8px;margin-top:10px">
              <button class="adm-btn danger" onclick="App.admWarn('${u.id}')">发送警告</button>
              <span style="font-family:ui-monospace;font-size:.62rem;color:rgba(160,220,185,.4)">已收警告 ${(u.warnings || []).length} 次</span>
            </div>
          </div>` : ''}
        </div>`;
      }).join('') || '<div class="adm-empty">NO USER MATCHED</div>'}
    `;
  }

  function renderAdmWishes() {
    const q = (ui.adminSearch || '').trim();
    const users = store.users.filter((u) => (u.wishlist || []).length > 0 && (!q || (u.name + u.phone).includes(q)));
    const totalItems = store.users.reduce((a, u) => a + (u.wishlist || []).length, 0);
    const counter = {};
    store.users.forEach((u) => (u.wishlist || []).forEach((id) => { counter[id] = (counter[id] || 0) + 1; }));
    const hot = Object.entries(counter).sort((a, b) => b[1] - a[1])[0];
    const hotName = hot ? (store.products.find((p) => p.id === hot[0]) || {}).name || hot[0] : '—';
    $('#adm-panel-wishes').innerHTML = `
      <div class="adm-h">
        <h2>购物车 / 心愿单汇总<small>/ WISHLIST</small></h2>
        <div class="adm-search"><span style="opacity:.5">⌕</span><input placeholder="搜索用户" value="${esc(q)}" oninput="App.admSearch(this.value)" /></div>
      </div>
      <div class="adm-stats">
        ${admStatCard('TOTAL_ITEMS', totalItems)}
        ${admStatCard('USERS_WITH_WISH', store.users.filter((u) => (u.wishlist || []).length).length)}
        ${admStatCard('HOT_ITEM', hotName)}
        ${admStatCard('REDEMPTIONS', store.users.reduce((a, u) => a + (u.redemptions || []).length, 0))}
      </div>
      <div class="adm-card">
        <table class="adm-table">
          <thead><tr><th>用户</th><th>手机号</th><th>商品</th><th>品类</th><th>积分价</th><th>库存</th></tr></thead>
          <tbody>
            ${users.length ? users.map((u) => (u.wishlist || []).map((id, i) => {
              const p = store.products.find((x) => x.id === id);
              if (!p) return '';
              return `<tr>
                <td class="nm">${i === 0 ? esc(u.name) + ' <span style="color:rgba(160,220,185,.45);font-size:.62rem">' + (u.wishlist || []).length + ' 件</span>' : ''}</td>
                <td style="font-family:ui-monospace;font-size:.66rem;color:rgba(160,220,185,.55)">${i === 0 ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''}</td>
                <td>${esc(p.name)}</td><td>${esc(p.cat)}</td>
                <td style="color:#35FF9E;font-family:var(--num)">${p.points}</td>
                <td>${p.stock || 0}</td>
              </tr>`;
            }).join('')).join('') : '<tr><td colspan="6" class="adm-empty">NO WISHLIST DATA</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px" class="adm-card">
        <div style="font-family:ui-monospace;font-size:.64rem;letter-spacing:1px;color:rgba(160,220,185,.5);margin-bottom:8px">兑换记录 / REDEMPTIONS</div>
        ${store.users.flatMap((u) => (u.redemptions || []).map((r) => ({ ...r, user: u.name }))).slice(0, 12).map((r) => `<div class="row between" style="font-size:.74rem;padding:7px 0;border-bottom:1px solid rgba(53,255,158,.07)">
          <span style="color:#D7F5E4">${esc(r.user)} · ${esc(r.name)}</span><span style="color:rgba(160,220,185,.5);font-family:ui-monospace;font-size:.64rem">${esc(r.time)}</span><span style="color:#35FF9E">-${r.points}</span>
        </div>`).join('') || '<div class="adm-empty" style="padding:14px">NO REDEMPTION</div>'}
      </div>
    `;
  }

  function renderAdmOrders() {
    const q = (ui.adminSearch || '').trim();
    const all = (store.orders || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const list = all.filter((o) => !q || (o.userName + o.userPhone + o.productName).includes(q));
    const paid = all.filter((o) => o.status !== 'pending');
    const revenue = paid.reduce((a, o) => a + (o.amount || 0), 0);
    const toShip = all.filter((o) => o.status === 'paid').length;
    const avg = paid.length ? revenue / paid.length : 0;

    $('#adm-panel-orders').innerHTML = `
      <div class="adm-h">
        <h2>订单管理<small>/ ORDERS</small></h2>
        <div class="adm-search"><span style="opacity:.5">⌕</span><input placeholder="搜索用户 / 商品" value="${esc(q)}" oninput="App.admSearch(this.value)" /></div>
      </div>
      <div class="adm-stats">
        ${admStatCard('ORDERS', all.length)}
        ${admStatCard('REVENUE', '¥' + revenue.toFixed(2))}
        ${admStatCard('TO_SHIP', toShip)}
        ${admStatCard('AVG_ORDER', '¥' + avg.toFixed(2))}
      </div>
      <div class="adm-card">
        <table class="adm-table">
          <thead><tr><th>时间</th><th>用户</th><th>商品</th><th>数量</th><th>金额</th><th>支付</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${list.length ? list.map((o) => {
              const st = orderStatusOf(o.status);
              return `<tr>
                <td style="font-family:ui-monospace;font-size:.64rem;color:rgba(160,220,185,.55)">${esc(o.createdAt || '')}</td>
                <td class="nm">${esc(o.userName || '')}<div style="font-size:.6rem;color:rgba(160,220,185,.45)">${(o.userPhone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</div></td>
                <td>${esc(o.productName || '')}</td>
                <td>${o.qty || 1}</td>
                <td style="color:#35FF9E;font-family:var(--num)">¥${(o.amount || 0).toFixed(2)}</td>
                <td style="font-size:.66rem">${o.payMethod === 'alipay' ? '支付宝' : '微信'}</td>
                <td><span class="adm-ost ${o.status}">${st.t}</span></td>
                <td>${o.status === 'pending' ? '<span class="adm-dim">—</span>' : `<button class="adm-mini" onclick="App.admShipOrder('${o.id}')">${o.status === 'paid' ? '发货' : o.status === 'shipped' ? '完成' : '已归档'}</button>`}</td>
              </tr>`;
            }).join('') : '<tr><td colspan="8" class="adm-empty">NO ORDER DATA · 暂无订单</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="tiny" style="margin-top:12px;color:rgba(160,220,185,.45);letter-spacing:.6px">支付为演示流程；接入微信支付商户号后，订单状态可由支付回调自动更新。</div>
    `;
  }

  function admShipOrder(id) {
    const o = (store.orders || []).find((x) => x.id === id);
    if (!o) return;
    if (o.status === 'pending') { toast('该订单还未支付', true); return; }
    o.status = o.status === 'paid' ? 'shipped' : 'done';
    o.shippedAt = new Date().toLocaleString('zh-CN');
    save();
    renderAdmOrders();
    toast(o.status === 'shipped' ? '已标记发货' : '订单已完成');
  }

  function renderAdmSquare() {
    const posts = store.posts.filter((p) => !p.removed);
    const reports = store.reports || [];
    const s = admStats();
    $('#adm-panel-square').innerHTML = `
      <div class="adm-h"><h2>用户广场管理<small>/ COMMUNITY</small></h2></div>
      <div class="adm-stats">
        ${admStatCard('POSTS', posts.length)}
        ${admStatCard('PENDING_REPORTS', s.reports)}
        ${admStatCard('COMMENTS', posts.reduce((a, p) => a + (p.comments || []).length, 0))}
        ${admStatCard('LIKES', posts.reduce((a, p) => a + (p.likes || 0), 0))}
      </div>
      <div class="adm-card" style="margin-bottom:14px">
        <div class="adm-tabs-sub">
          <button class="${ui.admSquareTab !== 'reports' ? 'on' : ''}" onclick="App.admSquareTab('posts')">帖子列表</button>
          <button class="${ui.admSquareTab === 'reports' ? 'on' : ''}" onclick="App.admSquareTab('reports')">举报汇总 ${reports.filter((r) => r.status === 'pending').length ? '(' + reports.filter((r) => r.status === 'pending').length + ')' : ''}</button>
        </div>
        ${ui.admSquareTab === 'reports' ? `
          ${reports.length ? reports.map((r) => `<div class="adm-report">
            <div class="rm">${esc(r.time)} · 举报人 ${esc(r.reporter)}</div>
            <div style="margin:3px 0;color:#FFD2CA">被举报帖子：<b>${esc(r.postTitle)}</b>（${esc(r.postAuthor)}）</div>
            <div style="color:#FFB4A6;font-size:.72rem">原因：${esc(r.reason)}</div>
            <div class="row" style="gap:8px;margin-top:8px">
              <button class="adm-btn danger" onclick="App.admDeletePost('${r.postId}')">删除该帖</button>
              <button class="adm-btn ghost" onclick="App.admResolveReport('${r.id}')">标记已处理</button>
              <span style="font-family:ui-monospace;font-size:.6rem;color:rgba(255,190,180,.5)">${r.status === 'pending' ? 'PENDING' : 'RESOLVED'}</span>
            </div>
          </div>`).join('') : '<div class="adm-empty">NO REPORT</div>'}
        ` : `
          <table class="adm-table">
            <thead><tr><th>作者</th><th>标题</th><th>互动</th><th>时间</th><th>操作</th></tr></thead>
            <tbody>
              ${posts.length ? posts.map((p) => `<tr>
                <td class="nm">${esc(p.authorName)}</td>
                <td>${esc(p.title)}</td>
                <td style="font-family:var(--num);color:rgba(160,220,185,.7)">赞 ${p.likes || 0} · 评 ${(p.comments || []).length}</td>
                <td style="font-size:.68rem;color:rgba(160,220,185,.5)">${esc(p.time || '')}</td>
                <td><div class="row" style="gap:6px">
                  <button class="adm-btn danger" style="height:28px;padding:0 10px;font-size:.66rem" onclick="App.admDeletePost('${p.id}')">删除</button>
                  <button class="adm-btn ghost" style="height:28px;padding:0 10px;font-size:.66rem" onclick="App.admWarn('${p.authorId}','${esc(p.authorName || '')}')">警告</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="5" class="adm-empty">NO POST</td></tr>'}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /* 管理端操作 */
  function admSearch(v) {
    ui.adminSearch = v;
    if (ui.adminPanel === 'products') renderAdmProducts();
    else if (ui.adminPanel === 'users') renderAdmUsers();
    else if (ui.adminPanel === 'wishes') renderAdmWishes();
    else if (ui.adminPanel === 'orders') renderAdmOrders();
  }
  function admToggleUser(id) {
    ui.admOpenUser = ui.admOpenUser === id ? null : id;
    renderAdmUsers();
  }
  function admSquareTab(t) { ui.admSquareTab = t; renderAdmSquare(); }

  function admEditProduct(id) {
    const p = id ? store.products.find((x) => x.id === id) : null;
    const cats = Array.from(new Set(store.products.map((x) => x.cat)));
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">${p ? '编辑产品' : '新增产品'}</h3>
      <p class="tiny muted" style="margin:0 0 14px">标签会同步到用户端，用作分类与 AI 推荐依据</p>
      <div class="adm-form" style="color:var(--text)">
        <div class="full"><label>产品名称</label><input id="pf-name" value="${p ? esc(p.name) : ''}" placeholder="例如 当季有机时蔬箱" /></div>
        <div><label>售价（元）</label><input id="pf-price" type="number" value="${p ? p.price : 50}" /></div>
        <div><label>库存</label><input id="pf-stock" type="number" value="${p ? p.stock || 0 : 100}" /></div>
        <div><label>品类</label><input id="pf-cat" value="${p ? esc(p.cat) : ''}" list="catlist" placeholder="时令果蔬" />
          <datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist></div>
        <div><label>规格</label><input id="pf-spec" value="${p ? esc(p.spec || '') : ''}" placeholder="1kg / 袋" /></div>
        <div><label>产地</label><input id="pf-origin" value="${p ? esc(p.origin || '') : ''}" placeholder="云南曲靖 · 合作社直采" /></div>
        <div><label>发货时效</label><input id="pf-ship" value="${p ? esc(p.ship || '') : ''}" placeholder="48 小时内发出" /></div>

        <div class="full"><label>产品图片</label>
          <div class="pf-upload">
            <div class="pf-preview" id="pf-img-preview">${p && p.img ? `<img src="${esc(p.img)}" alt="" />` : '<span>未选择</span>'}</div>
            <div class="grow">
              <input type="file" id="pf-img-file" accept="image/*" onchange="App.pickProductImage(this)" style="display:none" />
              <button class="adm-btn ghost" type="button" onclick="document.getElementById('pf-img-file').click()">选择本地图片</button>
              <button class="adm-btn ghost" type="button" onclick="App.clearProductImage()" style="margin-top:6px">清除图片</button>
              <div class="tiny" style="margin-top:6px;color:rgba(160,220,185,.55)">自动压缩到 900px 内，随商品一起存云端</div>
            </div>
          </div>
          <input type="hidden" id="pf-img" value="${p ? esc(p.img || '') : ''}" />
          <input id="pf-img-url" value="${p && p.img && !p.img.startsWith('data:') ? esc(p.img) : ''}" placeholder="或填图片地址 img/xxx.jpg" style="margin-top:8px" />
        </div>

        <div class="full"><label>视频链接</label><input id="pf-video" value="${p ? esc(p.videoUrl || '') : ''}" placeholder="https://…（用户点「观看产品视频」直接跳转）" /></div>

        <div class="full"><label>标签（逗号分隔）</label><input id="pf-tags" value="${p ? esc((p.tags || []).join('，')) : ''}" placeholder="时令，高纤维，低GI" /></div>
        <div class="full"><label>一句话简介</label><textarea id="pf-desc" style="height:60px">${p ? esc(p.desc || '') : ''}</textarea></div>
        <div class="full"><label>详细介绍（详情页展示，可换行）</label><textarea id="pf-detail" style="height:110px">${p ? esc(p.detail || '') : ''}</textarea></div>
        <div class="full"><label>状态</label>
          <div class="row" style="gap:8px;margin-top:2px">
            <button class="adm-btn ${!p || p.status !== 0 ? '' : 'ghost'}" onclick="App.admSetStatus(1)">在售</button>
            <button class="adm-btn ${p && p.status === 0 ? '' : 'ghost'}" onclick="App.admSetStatus(0)">下架</button>
          </div>
        </div>
      </div>
      <button class="adm-btn" style="width:100%;height:44px;margin-top:14px" onclick="App.admSaveProduct('${id || ''}')">保存产品</button>
    `);
    ui.admStatus = p ? (p.status === 0 ? 0 : 1) : 1;
  }
  function pickProductImage(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('请选择图片文件', true); return; }
    if (f.size > 12 * 1024 * 1024) { toast('图片过大，请小于 12MB', true); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const data = cv.toDataURL('image/jpeg', 0.75);
        document.getElementById('pf-img').value = data;
        const pv = document.getElementById('pf-img-preview');
        if (pv) pv.innerHTML = `<img src="${data}" alt="" />`;
        toast('图片已就绪，保存后生效');
      };
      img.onerror = () => toast('图片解析失败，请换一张', true);
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  }

  function clearProductImage() {
    const hidden = document.getElementById('pf-img');
    if (hidden) hidden.value = '';
    const url = document.getElementById('pf-img-url');
    if (url) url.value = '';
    const pv = document.getElementById('pf-img-preview');
    if (pv) pv.innerHTML = '<span>未选择</span>';
  }

  function admSetStatus(v) { ui.admStatus = v; toast(v ? '将保存为在售' : '将保存为下架'); }
  function admSaveProduct(id) {
    const name = (document.getElementById('pf-name').value || '').trim();
    const price = Number(document.getElementById('pf-price').value);
    if (!name || !price) { toast('名称和价格必填', true); return; }
    const videoRaw = (document.getElementById('pf-video').value || '').trim();
    if (videoRaw && !/^https?:\/\//i.test(videoRaw)) { toast('视频链接需以 http(s):// 开头', true); return; }
    const imgManual = (document.getElementById('pf-img-url').value || '').trim();
    const imgData = (document.getElementById('pf-img').value || '').trim();
    const data = {
      name, price,
      stock: Number(document.getElementById('pf-stock').value) || 0,
      cat: (document.getElementById('pf-cat').value || '其他').trim(),
      spec: (document.getElementById('pf-spec').value || '').trim(),
      origin: (document.getElementById('pf-origin').value || '').trim(),
      ship: (document.getElementById('pf-ship').value || '').trim(),
      img: imgManual || imgData,
      videoUrl: videoRaw,
      tags: (document.getElementById('pf-tags').value || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      desc: (document.getElementById('pf-desc').value || '').trim(),
      detail: (document.getElementById('pf-detail').value || '').trim(),
      status: ui.admStatus == null ? 1 : ui.admStatus,
      points: Math.round(price * 20),
    };
    if (id) {
      const p = store.products.find((x) => x.id === id);
      Object.assign(p, data);
    } else {
      store.products.unshift({ id: 'p' + Date.now(), ...data });
    }
    save(); closeAllModals(); renderAdmProducts(); toast('产品已保存');
  }
  function admDelProduct(id) {
    const p = store.products.find((x) => x.id === id);
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 8px">删除「${esc(p.name)}」？</h3>
      <p class="tiny muted" style="margin:0 0 16px">用户心愿单里的该商品也会失效。</p>
      <button class="btn btn-primary btn-block" style="background:#C6553F;box-shadow:none" onclick="App.admDoDelProduct('${id}')">确认删除</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal()">取消</button>
    `);
  }
  function admDoDelProduct(id) {
    const i = store.products.findIndex((x) => x.id === id);
    if (i >= 0) store.products.splice(i, 1);
    store.users.forEach((u) => { u.wishlist = (u.wishlist || []).filter((x) => x !== id); });
    save(); closeAllModals(); renderAdmProducts(); toast('产品已删除');
  }

  function admDeletePost(id) {
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 8px">删除该帖子？</h3>
      <p class="tiny muted" style="margin:0 0 16px">删除后用户端将不再展示，举报记录会保留。</p>
      <button class="btn btn-primary btn-block" style="background:#C6553F;box-shadow:none" onclick="App.admDoDeletePost('${id}')">确认删除</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeModal()">取消</button>
    `);
  }
  function admDoDeletePost(id) {
    const i = store.posts.findIndex((p) => p.id === id);
    if (i >= 0) store.posts.splice(i, 1);
    (store.reports || []).forEach((r) => { if (r.postId === id) r.status = 'resolved'; });
    save(); closeAllModals(); renderAdmSquare(); toast('帖子已删除');
  }

  function admWarn(userId, name) {
    // 云端历史帖子的作者 id 可能是旧的示例 id，按昵称兜底匹配
    const u = userById(userId) || (name ? store.users.find((x) => x.name === name) : null);
    if (!u) { toast('该用户已不存在，无法发送警告', true); return; }
    openModal(`
      <div class="modal-close" onclick="App.closeModal()">✕</div>
      <h3 style="margin:0 0 4px">向 ${esc(u.name)} 发送警告</h3>
      <p class="tiny muted" style="margin:0 0 12px">警告会出现在用户的「消息」里</p>
      <textarea id="warn-text" class="input-mini" style="height:90px;padding:10px;resize:none" placeholder="例如：请勿发布未经证实的健康信息，谢谢配合。"></textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.admDoWarn('${u.id}')">发送</button>
    `);
  }
  function admDoWarn(userId) {
    const u = userById(userId);
    const text = (document.getElementById('warn-text').value || '').trim() || '请注意发布内容规范，遵守社区规则。';
    u.warnings = u.warnings || [];
    u.warnings.push({ text, time: new Date().toLocaleString('zh-CN') });
    save(); closeAllModals(); renderAdmUsers(); toast('警告已发送');
  }

  function admResolveReport(id) {
    const r = (store.reports || []).find((x) => x.id === id);
    if (r) r.status = 'resolved';
    save(); renderAdmSquare(); toast('已标记为处理完成');
  }

  /* ============================================================
     分享链接定位
     ============================================================ */
  function handleHash() {
    const pm = /#product=([\w-]+)/.exec(location.hash || '');
    if (pm) {
      if (!me) return;
      const prod = store.products.find((x) => x.id === pm[1]);
      if (prod) { showProduct(prod.id); return; }
    }
    const m = /#post=([\w-]+)/.exec(location.hash || '');
    if (!m || !me) return;
    switchTab('records');
    setTimeout(() => {
      const el = document.getElementById('post-' + m[1]);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 0 2px #3E9459';
        setTimeout(() => { el.style.boxShadow = ''; }, 1800);
      }
    }, 400);
  }

  /* ============================================================
     注册事件
     ============================================================ */
  Object.assign(window.App, {
    switchTab, logout, roleTab, showTreehole, backFromSub, setMood, saveTreehole,
    toggleCheck, doCheckin, viewPlan, openNotices,
    sendChat, sendChip, chatInput, chatKey, cameraTip,
    addWeight, saveWeight, addMeal, saveMeal, quickMeal, addExercise, saveExercise,
    like, comment, sendComment, sharePost, copyShare, deletePost, doDeletePost, report, pickReason, sendReport,
    supervise, quickEncourage, sendSupervise, sharePlan, doSharePlan,
    setCat, toggleWish, exchange, doExchange, openProduct, goCheckin, goMarket, goRecords,
    showProduct, backFromProduct, toggleWishFromDetail, shareProduct, buyProduct, buyQty, pickPay,
    submitOrder, showPay, payOrder, openMyOrders, admShipOrder,
    editName, saveName, editAvatar, setAvatar, openWishlist, openPoints, toggleElder, feedback, sendFeedback, privacy, logoutConfirm,
    elderWhat, elderMove,
    admSearch, admToggleUser, admSquareTab, admEditProduct, admSaveProduct, admDelProduct, admDoDelProduct,
    pickProductImage, clearProductImage,
    admSetStatus, admDeletePost, admDoDeletePost, admWarn, admDoWarn, admResolveReport,
  });

  /* 启动补丁：tabbar 绑定、hash */

  window.addEventListener('hashchange', () => setTimeout(handleHash, 300));
  window.addEventListener('focus', () => {
    if (!me) return;
    refreshFromCloud(false).then((changed) => {
      if (!changed) return;
      if (tab === 'market') renderMarket();
      if (tab === 'profile') renderProfile();
    });
  });
  document.addEventListener('DOMContentLoaded', boot);
})();
