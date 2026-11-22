/* 农小禾 Agent · 路由与交互 */
(function () {
  'use strict';
  var state = DATA.load();
  var filters = { products: '', users: '', carts: '' };
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  var pendingLogin = null;
  var booting = true;

  DATA.api.onError = function (msg) { toast(msg, true); };
  DATA.api.onTokenExpired = function () { if (!booting) { render(); toast('登录已过期，请重新登录', true); } };

  function save() { DATA.save(state); }
  function esc(s) { return VIEWS.esc(s); }
  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 2600);
  }
  function openModal(html) { modalRoot.innerHTML = '<div class="modal-mask" data-act="close-modal">' + html + '</div>'; }
  function closeModal() { modalRoot.innerHTML = ''; }
  function go(hash) { location.hash = hash; }

  function currentPath() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return h || 'login';
  }

  function render() {
    var path = currentPath();
    var session = state.session;
    var parts = path.split('/');
    var root = parts[0];
    if (path === 'login') { app.innerHTML = VIEWS.login(); return; }
    if (!session) { go('#/login'); return; }
    if (session.type === 'admin') {
      if (root !== 'admin') { go('#/admin/products'); return; }
      if (path === 'admin/products') app.innerHTML = VIEWS.adminProducts(state, filters.products);
      else if (path === 'admin/users') app.innerHTML = VIEWS.adminUsers(state, filters.users);
      else if (path === 'admin/carts') app.innerHTML = VIEWS.adminCarts(state, filters.carts);
      else app.innerHTML = VIEWS.adminProducts(state, filters.products);
      window.scrollTo(0, 0);
      return;
    }
    var u = DATA.getUser(session.userId);
    if (!u) { state.session = null; save(); go('#/login'); return; }
    if (path === 'mode') { app.innerHTML = VIEWS.mode(u); window.scrollTo(0, 0); return; }
    if (!u.mode) {
      if (root === 'fitness' || root === 'health') { u.mode = root; save(); }
      else { go('#/mode'); return; }
    }
    var expected = u.mode;
    if (root !== expected) { go('#/' + expected + '/profile'); return; }
    if (path === 'fitness/profile') app.innerHTML = VIEWS.fitnessProfile(u, state);
    else if (path === 'fitness/plaza') app.innerHTML = VIEWS.fitnessPlaza(u, state);
    else if (path === 'fitness/shop') app.innerHTML = VIEWS.fitnessShop(u, state);
    else if (path === 'fitness/me') app.innerHTML = VIEWS.fitnessMe(u, state);
    else if (path === 'health/daily') app.innerHTML = VIEWS.healthDaily(u, state);
    else if (path === 'health/plaza') app.innerHTML = VIEWS.healthPlaza(u, state);
    else if (path === 'health/shop') app.innerHTML = VIEWS.healthShop(u, state);
    else if (path === 'health/me') app.innerHTML = VIEWS.healthMe(u, state);
    else app.innerHTML = VIEWS.fitnessProfile(u, state);
    window.scrollTo(0, 0);
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');
    if (act === 'admin-entry') {
      var phone = (document.getElementById('loginPhone') || {}).value || '';
      if (phone.trim() === DATA.ADMIN_PHONE) openModal(VIEWS.modals.adminCode());
      else toast('仅内部号码可使用管理员入口', true);
      return;
    }
    if (act === 'close-modal') {
      if (el.classList.contains('modal-mask') && e.target !== el) return;
      if (modalRoot.querySelector('[data-form="user-code"]')) pendingLogin = null;
      closeModal(); return;
    }
    var u = DATA.currentUser();
    var isAdmin = state.session && state.session.type === 'admin';
    if (!u && !isAdmin && act !== 'reset-demo' && act !== 'switch-mode') return;
    if (isAdmin && !u && ['product-new', 'product-edit', 'product-del', 'user-detail', 'user-plan'].indexOf(act) < 0) return;
    switch (act) {
      case 'switch-mode':
        if (!u) { toast('请先登录', true); return; }
        u.mode = u.mode === 'fitness' ? 'health' : 'fitness';
        save(); go('#/' + u.mode + '/' + (u.mode === 'fitness' ? 'profile' : 'daily')); toast('已切换' + (u.mode === 'fitness' ? '健身' : '健康') + '模式');
        break;
      case 'upload-photo': {
        var form = el.closest('form');
        var file = form && form.elements.photo && form.elements.photo.files[0];
        if (!file) { toast('请先选择照片', true); return; }
        if (!/^image\//.test(file.type)) { toast('请选择图片文件', true); return; }
        var reader = new FileReader();
        reader.onload = function (ev) {
          var img = new Image();
          img.onload = function () {
            var scale = Math.min(1, 480 / img.width);
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(img.width * scale)); cv.height = Math.max(1, Math.round(img.height * scale));
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            u.photos = u.photos || [];
            u.photos.push({ date: DATA.dateStr(0), part: form.elements.part.value, src: cv.toDataURL('image/jpeg', 0.65) });
            save(); render(); toast('体态照片已保存');
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        break;
      }
      case 'remind': {
        var type = el.getAttribute('data-type');
        u.reminders = u.reminders || {};
        u.reminders[type] = DATA.dateStr(0);
        save(); toast(type === 'waist' ? '已设置本周围度记录提醒' : '已设置本月拍照 / 体测提醒');
        break;
      }
      case 'like': {
        var post = state.posts.filter(function (p) { return p.id === id; })[0];
        if (!post) return;
        post.likes = post.likes || [];
        var i = post.likes.indexOf(u.id);
        if (i >= 0) post.likes.splice(i, 1); else post.likes.push(u.id);
        save(); render(); break;
      }
      case 'focus-comment': {
        var box = el.closest('article').querySelector('.comment-form input');
        if (box) box.focus();
        break;
      }
      case 'share': {
        var p2 = state.posts.filter(function (p) { return p.id === id; })[0];
        if (!p2) return;
        p2.shares = (p2.shares || 0) + 1; save(); render(); toast('已转发'); break;
      }
      case 'checkin': {
        DATA.checkin(id).then(function () { render(); toast('监督打卡成功，积分 +1'); })
          .catch(function (err) { toast(err.message || '打卡失败', true); });
        break;
      }
      case 'remind-author': {
        var p4 = state.posts.filter(function (p) { return p.id === id; })[0];
        if (!p4) return;
        p4.reminded = p4.reminded || [];
        p4.reminded.push({ by: u.id, date: DATA.dateStr(0) });
        save(); toast('已提醒发布者今日打卡'); break;
      }
      case 'go-cart': go('#/' + u.mode + '/me'); break;
      case 'add-cart': {
        var p5 = state.products.filter(function (p) { return p.id === id; })[0];
        if (!p5) return;
        var found = (u.cart || []).filter(function (c) { return c.productId === id; })[0];
        if (found) found.qty += 1; else (u.cart = u.cart || []).push({ productId: id, qty: 1 });
        save(); toast('已加入购物车：' + p5.name); break;
      }
      case 'cart-plus': case 'cart-minus': {
        var item = (u.cart || []).filter(function (c) { return c.productId === id; })[0];
        if (!item) return;
        item.qty += act === 'cart-plus' ? 1 : -1;
        if (item.qty <= 0) u.cart = u.cart.filter(function (c) { return c.productId !== id; });
        save(); render(); break;
      }
      case 'redeem': {
        var total = (u.cart || []).reduce(function (sum, it) {
          var p = state.products.filter(function (x) { return x.id === it.productId; })[0];
          return sum + (p ? p.points * it.qty : 0);
        }, 0);
        if (total <= 0) { toast('购物车为空', true); return; }
        if ((u.points || 0) < total) { toast('积分不足，还需 ' + (total - u.points) + ' 分', true); return; }
        if (!window.confirm('确认用 ' + total + ' 积分兑换购物车商品？')) return;
        DATA.redeem().then(function () { render(); toast('兑换成功，积分已扣减'); })
          .catch(function (err) { toast(err.message || '兑换失败', true); });
        break;
      }
      case 'gen-plan': {
        u.plan = ENGINE.makePlan(u, state.products);
        u.plan.createdAt = DATA.dateStr(0);
        save(); render(); toast('方案已生成'); break;
      }
      case 'qa-chip': {
        var input = document.querySelector('[data-form="qa"] input');
        if (input) { input.value = el.getAttribute('data-q') || ''; input.focus(); }
        break;
      }
      case 'reset-demo':
        toast('云端数据不支持本地重置', true);
        break;
      case 'product-new': openModal(VIEWS.modals.productForm(null)); break;
      case 'product-edit': {
        var p6 = state.products.filter(function (p) { return p.id === id; })[0];
        if (p6) openModal(VIEWS.modals.productForm(p6));
        break;
      }
      case 'product-del': {
        var p7 = state.products.filter(function (p) { return p.id === id; })[0];
        if (!p7 || !window.confirm('确认删除产品「' + p7.name + '」？')) return;
        state.products = state.products.filter(function (p) { return p.id !== id; });
        save(); render(); toast('产品已删除'); break;
      }
      case 'user-detail': {
        var ud = DATA.getUser(id);
        if (ud) openModal(VIEWS.modals.userDetail(ud, state));
        break;
      }
      case 'user-plan': {
        var up = DATA.getUser(id);
        if (up) openModal(VIEWS.modals.userPlan(up, state));
        break;
      }
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'loginPhone') {
      var btn = document.getElementById('adminEntry');
      if (btn) btn.classList.toggle('hidden', e.target.value.trim() !== DATA.ADMIN_PHONE);
    }
  });

  function values(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.checked) (out[el.name] = out[el.name] || []).push(el.value);
      } else out[el.name] = el.value;
    });
    return out;
  }
  function upsertRecord(u, data) {
    u.records = u.records || [];
    var found = u.records.filter(function (r) { return r.date === data.date; })[0];
    if (found) Object.keys(data).forEach(function (k) { found[k] = data[k]; });
    else u.records.unshift(data);
    u.records.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function upsertDaily(u, data) {
    u.healthDaily = u.healthDaily || [];
    var found = u.healthDaily.filter(function (r) { return r.date === data.date; })[0];
    if (found) Object.keys(data).forEach(function (k) { found[k] = data[k]; }); else u.healthDaily.unshift(data);
    u.healthDaily.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function upsertTest(u, data) {
    u.healthTests = u.healthTests || [];
    var found = u.healthTests.filter(function (r) { return r.date === data.date; })[0];
    if (found) Object.keys(data).forEach(function (k) { found[k] = data[k]; }); else u.healthTests.unshift(data);
    u.healthTests.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    var name = form.getAttribute('data-form');
    var v = values(form);
    var u = DATA.currentUser();

    if (name === 'login') {
      var phone = (v.phone || '').trim(), pwd = v.password || '';
      DATA.verifyPassword(phone, pwd).then(function () {
        pendingLogin = { phone: phone, password: pwd };
        openModal(VIEWS.modals.userCode(phone));
      }).catch(function (err) { toast(err.message || '手机号或密码错误', true); });
      return;
    }
    if (name === 'user-code') {
      if (!pendingLogin) { closeModal(); toast('验证已失效，请重新登录', true); return; }
      if ((v.code || '').trim() !== DATA.LOGIN_CODE) { toast('验证码错误', true); return; }
      var p = pendingLogin;
      DATA.loginUser(p.phone, p.password, v.code.trim()).then(function () {
        pendingLogin = null; closeModal(); go('#/mode'); toast('登录成功，请选择模式');
      }).catch(function (err) { toast(err.message || '登录失败', true); });
      return;
    }
    if (name === 'admin-code') {
      if ((v.code || '').trim() !== DATA.ADMIN_CODE) { toast('验证码错误', true); return; }
      DATA.loginAdmin(DATA.ADMIN_PHONE, v.code.trim()).then(function () {
        closeModal(); go('#/admin/products'); toast('已进入管理员模式');
      }).catch(function (err) { toast(err.message || '管理员验证失败', true); });
      return;
    }
    var adminForms = ['product-search', 'user-search', 'cart-search', 'product-save'];
    if (!u && adminForms.indexOf(name) < 0) { toast('请先登录', true); return; }

    if (name === 'basic') {
      u.profile = u.profile || {};
      ['gender', 'age', 'height', 'targetWeight', 'targetBodyFat', 'goal', 'medical'].forEach(function (k) { if (v[k] != null) u.profile[k] = v[k]; });
      u.profile.weight = parseFloat(v.weight) || u.profile.weight;
      upsertRecord(u, { date: DATA.dateStr(0), weight: u.profile.weight });
      save(); render(); toast('基础档案已保存'); return;
    }
    if (name === 'record') {
      var group = form.getAttribute('data-group') || 'body';
      var payload = { date: v.date || DATA.dateStr(0) };
      var keys = {
        body: ['bodyFat', 'muscle', 'bmr', 'visceralFat', 'water', 'bone'],
        girth: ['waist', 'hip', 'chest', 'upperArm', 'thigh', 'whr'],
        recovery: ['restingHR', 'hrv', 'sleepHours', 'fatigue', 'trainingLoad', 'liftNote'],
        optional: ['bpSys', 'bpDia', 'glucose', 'spo2', 'vo2max', 'rr']
      }[group] || [];
      keys.forEach(function (k) { if (v[k] !== '' && v[k] != null) payload[k] = isNaN(Number(v[k])) ? v[k] : Number(v[k]); });
      if (group === 'girth' && payload.waist && payload.hip && !payload.whr) payload.whr = Math.round(payload.waist / payload.hip * 100) / 100;
      if (group === 'optional' && v.medical != null) u.profile.medical = v.medical;
      upsertRecord(u, payload); save(); render(); toast('记录已保存'); return;
    }
    if (name === 'health-profile') {
      u.profile = u.profile || {};
      ['gender', 'age', 'height', 'medical'].forEach(function (k) { if (v[k] != null) u.profile[k] = v[k]; });
      u.profile.weight = parseFloat(v.weight) || u.profile.weight;
      save(); render(); toast('基础信息已保存'); return;
    }
    if (name === 'health-daily') {
      var daily = { date: v.date || DATA.dateStr(0) };
      ['bpSys', 'bpDia', 'hr', 'glucose', 'sleepMinutes', 'wakeups'].forEach(function (k) {
        if (v[k] !== '') daily[k] = Number(v[k]) || 0;
      });
      upsertDaily(u, daily); save(); render(); toast('今日记录已保存'); return;
    }
    if (name === 'health-test') {
      var test = { date: v.date || DATA.dateStr(0) };
      ['balance', 'calf', 'cognition', 'breathHold', 'reach', 'sitToStand'].forEach(function (k) {
        if (v[k] !== '') test[k] = Number(v[k]) || 0;
      });
      upsertTest(u, test); save(); render(); toast('自测已保存，结论已更新'); return;
    }
    if (name === 'symptoms') {
      u.symptoms = v.symptom || [];
      u.meds = { onTime: v.onTime, missed: v.missed, adverse: v.adverse || '' };
      save(); render(); toast('症状与用药已保存'); return;
    }
    if (name === 'post') {
      var planText = v.plan || (u.plan ? u.plan.title + '：' + u.plan.train[0] : '暂未生成方案');
      state.posts.unshift({ id: DATA.uid('post'), authorId: u.id, title: v.title || '我的健康记录',
        content: v.content || '', plan: planText, createdAt: DATA.dateStr(0), likes: [], comments: [], shares: 0, checkins: [], reminded: [] });
      save(); render(); toast('方案已发布到广场'); return;
    }
    if (name === 'comment') {
      var post = state.posts.filter(function (p) { return p.id === form.getAttribute('data-id'); })[0];
      if (post && (v.text || '').trim()) {
        post.comments = post.comments || [];
        post.comments.push({ userId: u.id, text: v.text.trim(), date: DATA.dateStr(0) });
        save(); render(); toast('评论已发送');
      }
      return;
    }
    if (name === 'qa') {
      var q = (v.q || '').trim();
      if (!q) return;
      var answer = ENGINE.ask(q, u, state.products);
      u.qaLog = u.qaLog || [];
      u.qaLog.push({ q: q, a: answer, date: DATA.dateStr(0) });
      save(); render();
      var log = document.getElementById('qaLog');
      if (log) log.scrollTop = log.scrollHeight;
      return;
    }
    if (name === 'product-search') { filters.products = (v.q || '').trim(); render(); return; }
    if (name === 'user-search') { filters.users = (v.q || '').trim(); render(); return; }
    if (name === 'cart-search') { filters.carts = (v.q || '').trim(); render(); return; }
    if (name === 'product-save') {
      var nutrition = {};
      (v.nutritionText || '').split(/\n+/).forEach(function (line) {
        var idx = line.indexOf(':'); if (idx < 0) idx = line.indexOf('：');
        if (idx > 0) nutrition[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      function splitTags(t) { return (t || '').split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean); }
      var data = {
        name: (v.name || '').trim() || '未命名产品', category: (v.category || '').trim() || '其他',
        price: Number(v.price) || 0, points: Number(v.points) || 0, desc: v.desc || '',
        nutrition: nutrition, organic: splitTags(v.organicText), tags: splitTags(v.tagsText)
      };
      var pid = form.getAttribute('data-id');
      if (pid) {
        var target = state.products.filter(function (p) { return p.id === pid; })[0];
        if (target) Object.keys(data).forEach(function (k) { target[k] = data[k]; });
      } else {
        data.id = DATA.uid('p'); state.products.push(data);
      }
      save(); closeModal(); render(); toast('产品已保存'); return;
    }
  });

  window.addEventListener('hashchange', function () { if (!booting) render(); });
  if (!location.hash) location.hash = '#/login';
  DATA.boot().then(function () { booting = false; render(); });
})();
