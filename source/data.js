/* 农小禾 Agent · 云端数据层（WorkBuddy Cloud Service） */
(function () {
  'use strict';

  var TOKEN_KEY = 'nongxiaohe.cloud.token';
  var ADMIN_PHONE = '18890013415';
  var ADMIN_CODE = '888888';
  var LOGIN_CODE = '888888';

  var cfg = window.CLOUD_PUBLIC_CONFIG || {};
  if (!window.WorkBuddyCloud || !cfg.endpoint || !cfg.publishableKey) {
    throw new Error('云端 SDK 或配置未加载');
  }

  var cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
    endpoint: cfg.endpoint,
    oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
    publishableKey: cfg.publishableKey
  });

  var state = { users: [], products: [], posts: [], session: null };
  var writeQueue = Promise.resolve();
  var api = {
    onError: null,
    onTokenExpired: null
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() - (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function unwrap(res, action) {
    if (res && res.error) throw new Error(res.error.message || (action + ' 失败'));
    return res && res.data;
  }
  function normalizeRpcValue(v) {
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return { ok: true, value: v }; } }
    return v || {};
  }
  function rpc(name, params) {
    return cloud.database.rpc(name, params || {}).then(function (res) {
      return normalizeRpcValue(unwrap(res, name));
    }).catch(function (err) {
      if (/401|unauthenticated|会话/.test(String(err && err.message))) {
        setToken('');
        state.session = null;
        if (api.onTokenExpired) api.onTokenExpired();
      }
      throw err;
    });
  }

  function applyBootstrap(s) {
    state.users = s.users || [];
    state.products = s.products || [];
    state.posts = s.posts || [];
    state.session = s.session || null;
    return state;
  }
  function refresh() {
    var t = token();
    if (!t) { state.users = []; state.products = []; state.posts = []; state.session = null; return Promise.resolve(state); }
    return rpc('app_bootstrap', { p_token: t }).then(function (s) {
      if (!s || s.ok !== true) throw new Error((s && s.error) || '会话已失效');
      return applyBootstrap(s);
    });
  }
  function boot() {
    return refresh().catch(function (err) {
      setToken('');
      state.session = null;
      if (api.onError) api.onError(err.message || '云端连接失败');
      return state;
    });
  }

  function persist() {
    var t = token();
    if (!t || !state.session) return Promise.resolve();
    if (state.session.type === 'admin') {
      return rpc('app_save_products', { p_token: t, p_products: state.products || [] });
    }
    var u = (state.users || []).filter(function (x) { return x.id === state.session.userId; })[0];
    if (!u) return Promise.resolve();
    return rpc('app_save_user', { p_token: t, p_data: u }).then(function (r) {
      if (r && r.ok === false) throw new Error(r.error || '云端保存失败');
      return rpc('app_save_posts', { p_token: t, p_posts: state.posts || [] });
    }).then(function (r) {
      if (r && r.ok === false) throw new Error(r.error || '广场保存失败');
    });
  }
  function save() {
    writeQueue = writeQueue.then(persist).catch(function (err) {
      if (api.onError) api.onError(err.message || '云端保存失败');
    });
    return writeQueue;
  }

  function loginUser(phone, password, code) {
    return rpc('app_login', { p_phone: phone, p_password: password, p_code: code }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '登录失败');
      setToken(r.token);
      return refresh();
    });
  }
  function verifyPassword(phone, password) {
    return rpc('app_verify_password', { p_phone: phone, p_password: password }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '账号或密码错误');
      return true;
    });
  }
  function loginAdmin(phone, code) {
    return rpc('app_admin_login', { p_phone: phone, p_code: code }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '管理员验证失败');
      setToken(r.token);
      return refresh();
    });
  }
  function logout() {
    var t = token();
    var done = t ? rpc('app_logout', { p_token: t }).catch(function () {}) : Promise.resolve();
    return done.then(function () {
      setToken('');
      state.users = []; state.products = []; state.posts = []; state.session = null;
      return state;
    });
  }
  function checkin(postId) {
    return rpc('app_checkin', { p_token: token(), p_post_id: postId }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '打卡失败');
      return refresh();
    });
  }
  function redeem() {
    return rpc('app_redeem', { p_token: token() }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '兑换失败');
      return refresh();
    });
  }
  function seedFromBundle() {
    var bundle = window.NXH_INITIAL_DATA;
    if (!bundle) return Promise.reject(new Error('初始数据未加载'));
    var users = (bundle.users || []).map(function (u) { return { phone: u.phone, role: u.role, data: u }; });
    return rpc('app_reseed', {
      p_token: token(),
      p_users: users,
      p_products: bundle.products || [],
      p_posts: bundle.posts || []
    }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || '数据初始化失败');
      return refresh();
    });
  }

  window.DATA = {
    KEY: TOKEN_KEY, ADMIN_PHONE: ADMIN_PHONE, ADMIN_CODE: ADMIN_CODE, LOGIN_CODE: LOGIN_CODE,
    cloud: cloud, api: api,
    load: function () { return state; },
    save: save, refresh: refresh, boot: boot, token: token,
    loginUser: loginUser, verifyPassword: verifyPassword, loginAdmin: loginAdmin, logout: logout,
    checkin: checkin, redeem: redeem, seedFromBundle: seedFromBundle,
    uid: uid, dateStr: dateStr, deepCopy: deepCopy,
    getUser: function (id) { return state.users.filter(function (u) { return u.id === id; })[0] || null; },
    currentUser: function () {
      if (!state.session || state.session.type !== 'user') return null;
      return state.users.filter(function (u) { return u.id === state.session.userId; })[0] || null;
    },
    latest: function (u, field) {
      if (!u || !u.records || !u.records.length) return null;
      var rs = u.records.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      for (var i = 0; i < rs.length; i++) if (typeof rs[i][field] === 'number') return rs[i][field];
      return null;
    }
  };
})();
