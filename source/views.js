/* 农小禾 Agent · 视图层 */
(function () {
  'use strict';
  var V = {};

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(d) { return d ? String(d).slice(5) : '—'; }
  function fld(name, label, opts) {
    opts = opts || {};
    var type = opts.type || 'number';
    var extra = opts.extra || '';
    var val = opts.value == null ? '' : opts.value;
    if (type === 'textarea') return '<label class="fl"><span>' + esc(label) + '</span><textarea name="' + name + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(val) + '</textarea></label>';
    if (type === 'select') {
      var os = (opts.options || []).map(function (o) {
        var value = Array.isArray(o) ? o[0] : o, text = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(value) + '"' + (String(value) === String(val) ? ' selected' : '') + '>' + esc(text) + '</option>';
      }).join('');
      return '<label class="fl"><span>' + esc(label) + '</span><select name="' + name + '"' + extra + '>' + os + '</select></label>';
    }
    return '<label class="fl"><span>' + esc(label) + '</span><input type="' + type + '" name="' + name + '" value="' + esc(val) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.step ? ' step="' + opts.step + '"' : '') + (extra || '') + '></label>';
  }
  function note(t) { return '<p class="note">' + esc(t) + '</p>'; }
  function card(title, body, foot) {
    return '<section class="card"><div class="card-h"><h3>' + title + '</h3></div><div class="card-b">' + body + '</div>' + (foot ? '<div class="card-f">' + foot + '</div>' : '') + '</section>';
  }
  function nav(theme, items, active) {
    return '<nav class="tabbar">' + items.map(function (it) {
      return '<a href="#/' + it.href + '" class="tab' + (it.href === active ? ' on' : '') + '"><span class="ti">' + it.icon + '</span><span>' + esc(it.label) + '</span></a>';
    }).join('') + '</nav>';
  }
  function shell(theme, title, subtitle, items, active, content, topExtra) {
    return '<div class="app-shell ' + theme + '"><header class="topbar"><div class="brand"><span class="logo">禾</span><div><strong>农小禾</strong><small>' + esc(subtitle) + '</small></div></div>' +
      '<div class="top-right">' + (topExtra || '') + '<span class="mode-pill">' + esc(title) + '</span><a class="ghost-btn" href="#/login">退出</a></div></header>' +
      '<main class="main">' + content + '</main>' + nav(theme, items, active) + '</div>';
  }
  function icon(name) {
    var map = {
      profile: '◫', plaza: '◎', shop: '◇', me: '☰', dash: '⌂', users: '☷', cart: '▤',
      heart: '♡', comment: '▢', share: '↗', check: '✓', bell: '◔'
    };
    return map[name] || '•';
  }
  function spark(user, key, label, unit, color) {
    var rows = (user.records || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(-8);
    var vals = rows.map(function (r) { return r[key]; }).filter(function (v) { return typeof v === 'number'; });
    if (vals.length < 2) return '<div class="chart-empty">' + esc(label) + '：至少记录两次后显示趋势</div>';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = max - min || 1;
    var pts = vals.map(function (v, i) {
      return (8 + i * (284 / (vals.length - 1))).toFixed(1) + ',' + (72 - ((v - min) / span) * 56).toFixed(1);
    }).join(' ');
    var area = '8,84 ' + pts + ' 292,84';
    return '<div class="chart"><div class="chart-top"><span>' + esc(label) + '</span><strong>' + vals[vals.length - 1] + esc(unit || '') + '</strong></div>' +
      '<svg viewBox="0 0 300 88" preserveAspectRatio="none"><polygon points="' + area + '" fill="' + color + '" opacity="0.12"/><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
      '<div class="chart-axis"><span>' + fmtDate(rows[0].date) + '</span><span>' + fmtDate(rows[rows.length - 1].date) + '</span></div></div>';
  }

  /* ---------- 登录 / 模式选择 ---------- */
  V.login = function () {
    return '<div class="auth-wrap"><div class="auth-panel">' +
      '<div class="auth-brand"><span class="logo big">禾</span><h1>农小禾健康 Agent</h1><p>记录身体数据 · 生成专属方案 · 连接健康好物</p></div>' +
      '<form class="auth-form" data-form="login">' +
      fld('phone', '手机号', { type: 'tel', ph: '请输入手机号', extra: ' id="loginPhone" autocomplete="off"' }) +
      fld('password', '密码', { type: 'password', ph: '演示密码 123456', extra: ' autocomplete="off"' }) +
      '<button class="btn primary wide" type="submit">普通用户登录</button>' +
      '<button class="btn admin-entry hidden" type="button" data-act="admin-entry" id="adminEntry">管理员登录（内部入口）</button>' +
      '</form>' +
      '<div class="auth-foot"><span>普通登录也需短信验证码（演示码 888888）</span><span class="dot">·</span><span>演示账号：13900000001 / 123456</span></div>' +
      '</div><div class="auth-aside"><div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div>' +
      '<div class="aside-copy"><span class="tag">LOCAL AGENT</span><h2>你的身体<br>值得一套专属方案</h2><p>三大模式 · 十一个功能页面 · 全部数据本地保存</p></div></div></div>';
  };
  V.mode = function (u) {
    return '<div class="mode-wrap"><div class="mode-head"><span class="tag">STEP 01</span><h1>选择你的模式</h1><p>' + esc(u.name) + '，接下来想用哪种方式管理健康？模式可随时切换。</p></div>' +
      '<div class="mode-grid">' +
      '<a class="mode-card fitness" href="#/fitness/profile"><span class="mode-kicker">FITNESS</span><h2>健身模式</h2><p>黑绿能量场，追踪体脂、肌肉、围度与训练表现。</p><ul><li>健康档案 · 趋势与评分</li><li>用户广场 · 打卡积分</li><li>农小禾慧选 · AI推荐</li><li>个人中心 · 方案与购物车</li></ul><span class="mode-cta">进入健身模式 →</span></a>' +
      '<a class="mode-card health" href="#/health/daily"><span class="mode-kicker">WELLNESS</span><h2>健康模式</h2><p>浅绿清新界面，面向中老年的日常指标与专业自测。</p><ul><li>健康管理 · 日常与周测</li><li>用户广场 · 打卡积分</li><li>农小禾慧选 · AI推荐</li><li>个人中心 · 方案与购物车</li></ul><span class="mode-cta">进入健康模式 →</span></a>' +
      '</div></div>';
  };

  /* ---------- 健身：健康档案 ---------- */
  V.fitnessProfile = function (u, state) {
    var p = u.profile || {}, latest = u.records && u.records[0] || {};
    var bmiVal = ENGINE.bmi(latest.weight || p.weight, p.height);
    var ps = ENGINE.progressScore(u);
    var goalWeight = num(p.targetWeight), curWeight = num(DATA.latest(u, 'weight') || p.weight);
    var goalPct = goalWeight && curWeight ? Math.round(ENGINE.clamp((curWeight - goalWeight) / (curWeight || 1) * 100, 0, 100)) : 0;
    var bf = DATA.latest(u, 'bodyFat'), tbf = num(p.targetBodyFat);
    var bfPct = bf && tbf ? Math.round(ENGINE.clamp((bf - tbf) / bf * 100, 0, 100)) : 0;
    var html = '<div class="page-head"><div><span class="kicker">HEALTH PROFILE</span><h1>健康档案</h1><p>一次填写基础信息，之后只记录变化数据。</p></div><div class="score-badge"><small>综合进度分</small><strong>' + ps.score + '</strong><span>/100</span></div></div>';

    html += '<div class="quick-row"><div><span>体重</span><strong>' + (curWeight || '—') + ' kg</strong></div><div><span>BMI</span><strong>' + (bmiVal || '—') + '</strong></div><div><span>体脂率</span><strong>' + (bf || '—') + '%</strong></div><div><span>记录天数</span><strong>' + (u.records || []).length + '</strong></div></div>';

    html += card('1 · 基础档案', '<form data-form="basic" class="form-grid">' +
      fld('gender', '性别', { type: 'select', options: [['female', '女'], ['male', '男']], value: p.gender }) +
      fld('age', '年龄', { value: p.age }) + fld('height', '身高 cm', { value: p.height }) +
      fld('weight', '体重 kg', { value: curWeight, step: '0.1' }) +
      fld('goal', '目标类型', { type: 'select', options: ['减脂', '增肌', '塑形', '维持'], value: p.goal }) +
      fld('targetWeight', '目标体重 kg', { value: p.targetWeight, step: '0.1' }) +
      fld('targetBodyFat', '目标体脂 %', { value: p.targetBodyFat, step: '0.1' }) +
      '<div class="full">' + note('建议固定时间记录体重：晨起空腹、排便后，数据趋势更稳定。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存基础档案</button></div></form>');

    html += card('2 · 体成分指标', '<form data-form="record" data-group="body" class="form-grid">' +
      fld('date', '测量日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('bodyFat', '体脂率 %', { value: latest.bodyFat, step: '0.1' }) +
      fld('muscle', '肌肉量 / 骨骼肌量 kg', { value: latest.muscle, step: '0.1' }) +
      fld('bmr', '基础代谢率 kcal', { value: latest.bmr }) +
      fld('visceralFat', '内脏脂肪等级', { value: latest.visceralFat, step: '0.1' }) +
      fld('water', '体水分率 %', { value: latest.water, step: '0.1' }) +
      fld('bone', '骨量 kg', { value: latest.bone, step: '0.1' }) +
      '<div class="full">' + note('体脂秤数据请固定设备、固定时间测量；重点看长期趋势，不要过度解读单日波动。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存体成分记录</button></div></form>');

    html += card('3 · 围度指标', '<form data-form="record" data-group="girth" class="form-grid">' +
      fld('date', '测量日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('waist', '腰围 cm', { value: latest.waist, step: '0.1' }) +
      fld('hip', '臀围 cm', { value: latest.hip, step: '0.1' }) +
      fld('chest', '胸围 cm', { value: latest.chest, step: '0.1' }) +
      fld('upperArm', '上臂围 cm', { value: latest.upperArm, step: '0.1' }) +
      fld('thigh', '大腿围 cm', { value: latest.thigh, step: '0.1' }) +
      fld('whr', '腰臀比', { value: latest.whr, step: '0.01' }) +
      '<div class="full">' + note('腰围建议肚脐上方约 1–2cm、自然呼气末测量；臀围取臀部最凸处。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存围度记录</button></div></form>');

    html += card('4 · 体能与恢复指标', '<form data-form="record" data-group="recovery" class="form-grid">' +
      fld('date', '记录日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('restingHR', '静息心率 bpm', { value: latest.restingHR }) +
      fld('hrv', '心率变异性 ms', { value: latest.hrv }) +
      fld('sleepHours', '睡眠质量 小时', { value: latest.sleepHours, step: '0.1' }) +
      fld('fatigue', '主观疲劳度 1–10', { value: latest.fatigue }) +
      fld('trainingLoad', '本周训练次数', { value: latest.trainingLoad }) +
      fld('liftNote', '训练重量 / 次数记录', { type: 'text', value: latest.liftNote, ph: '如：深蹲 60kg × 8' }) +
      '<div class="full">' + note('体态照片建议每月一次，上传正面、侧面、背面，固定光线、距离和服装，三个月后对比更明显。') + '</div>' +
      '<div class="full photo-row"><label class="fl"><span>照片部位</span><select name="part"><option>正面</option><option>侧面</option><option>背面</option></select></label>' +
      '<label class="fl"><span>选择照片</span><input type="file" name="photo" accept="image/*"></label>' +
      '<button class="btn" type="button" data-act="upload-photo">上传照片</button></div></form>');

    html += card('5 · 可选健康指标（进阶）', '<form data-form="record" data-group="optional" class="form-grid">' +
      fld('date', '记录日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('bpSys', '收缩压 mmHg', { value: latest.bpSys }) + fld('bpDia', '舒张压 mmHg', { value: latest.bpDia }) +
      fld('glucose', '空腹血糖 mmol/L', { value: latest.glucose, step: '0.1' }) +
      fld('spo2', '血氧 %', { value: latest.spo2 }) + fld('vo2max', '最大摄氧量', { value: latest.vo2max, step: '0.1' }) +
      fld('rr', '静息呼吸频率', { value: latest.rr }) +
      '<div class="full">' + fld('medical', '既往病史 / 运动禁忌', { type: 'textarea', value: p.medical, ph: '如：高血压，不适宜高强度间歇' }) + '</div>' +
      '<div class="full">' + note('此类数据仅做记录、趋势展示与一般性提示，不给出诊断结论。异常请就医。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存健康指标</button></div></form>');

    html += card('6 · 后续看变化',
      '<div class="chart-grid">' + spark(u, 'weight', '体重趋势', ' kg', '#39ff9a') + spark(u, 'bodyFat', '体脂率趋势', ' %', '#7be0ff') +
      spark(u, 'muscle', '肌肉量趋势', ' kg', '#b6ff5c') + spark(u, 'waist', '腰围趋势', ' cm', '#ffd166') + '</div>' +
      '<div class="compare-grid">' + compare(u, 'weight', '体重', ' kg') + compare(u, 'bodyFat', '体脂率', ' %') + compare(u, 'muscle', '肌肉量', ' kg') + compare(u, 'waist', '腰围', ' cm') + '</div>' +
      '<div class="progress-block"><span>目标体重进度：距目标还差 ' + Math.max(0, Math.round((curWeight - goalWeight) * 10) / 10) + ' kg</span><div class="bar"><i style="width:' + goalPct + '%"></i></div>' +
      '<span>目标体脂进度：距目标还差 ' + Math.max(0, Math.round(((bf || 0) - tbf) * 10) / 10) + ' %</span><div class="bar alt"><i style="width:' + bfPct + '%"></i></div></div>' +
      '<div class="score-parts">' + ps.parts.map(function (x) { return '<span>' + esc(x.name) + ' <b>' + x.value + '</b></span>'; }).join('') + '</div>' +
      photoTimeline(u) +
      '<div class="remind-row"><button class="btn ghost" data-act="remind" data-type="waist">每周提醒记录围度</button>' +
      '<button class="btn ghost" data-act="remind" data-type="photo">每月提醒拍照 / 体测</button></div>');

    var items = [
      { href: 'fitness/profile', label: '健康档案', icon: icon('profile') },
      { href: 'fitness/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'fitness/shop', label: '农小禾慧选', icon: icon('shop') },
      { href: 'fitness/me', label: '个人中心', icon: icon('me') }
    ];
    return shell('theme-fitness', '健身模式', 'FITNESS MODE', items, 'fitness/profile', html,
      '<button class="icon-btn" data-act="switch-mode" title="切换模式">⇄</button>');
  };
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function compare(u, key, label, unit) {
    var rs = (u.records || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var vals = rs.filter(function (r) { return typeof r[key] === 'number'; });
    if (vals.length < 2) return '<div class="cmp"><span>' + label + '</span><b>暂无对比</b></div>';
    var a = vals[vals.length - 2][key], b = vals[vals.length - 1][key], d = Math.round((b - a) * 10) / 10;
    return '<div class="cmp"><span>' + label + '</span><b>' + b + unit + '</b><em class="' + (d < 0 ? 'down' : 'up') + '">' + (d > 0 ? '+' : '') + d + unit + '</em></div>';
  }
  function photoTimeline(u) {
    var ps = u.photos || [];
    return '<div class="photo-block"><h4>体型进度 · 体态照片</h4>' + (ps.length ? '<div class="photo-timeline">' + ps.slice().reverse().map(function (p) {
      return '<figure><img src="' + p.src + '" alt="' + esc(p.part) + '"><figcaption>' + fmtDate(p.date) + ' · ' + esc(p.part) + '</figcaption></figure>';
    }).join('') + '</div>' : '<p class="empty">还没有体态照片。按上方提示每月上传一次，效果更直观。</p>') + '</div>';
  }

  /* ---------- 广场 ---------- */
  function plaza(u, state, theme, active) {
    var html = '<div class="page-head"><div><span class="kicker">COMMUNITY</span><h1>用户广场</h1><p>发布专属方案，互相监督打卡，每次监督 +1 积分。</p></div><div class="score-badge"><small>我的积分</small><strong>' + (u.points || 0) + '</strong><span>分</span></div></div>';
    html += card('发布我的方案', '<form data-form="post" class="form-grid">' +
      '<div class="full">' + fld('title', '标题', { type: 'text', ph: '例如：第 5 周执行记录' }) + '</div>' +
      '<div class="full">' + fld('content', '内容', { type: 'textarea', ph: '写下今天的执行情况和身体反馈' }) + '</div>' +
      '<div class="full">' + fld('plan', '专属方案（可选）', { type: 'textarea', ph: '不填则使用个人中心生成的方案' }) + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">发布到广场</button></div></form>');
    var posts = (state.posts || []).slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    html += '<div class="post-list">' + posts.map(function (post) {
      var author = state.users.filter(function (x) { return x.id === post.authorId; })[0] || { name: '未知用户' };
      var liked = (post.likes || []).indexOf(u.id) >= 0;
      var checked = (post.checkins || []).some(function (c) { return c.userId === u.id && c.date === DATA.dateStr(0); });
      var mine = post.authorId === u.id;
      return '<article class="post"><div class="post-head"><div class="avatar">' + esc(author.name.slice(0, 1)) + '</div><div><strong>' + esc(author.name) + '</strong><small>' + fmtDate(post.createdAt) + ' · ' + esc(author.mode === 'health' ? '健康模式' : '健身模式') + '</small></div></div>' +
        '<h3>' + esc(post.title) + '</h3><p>' + esc(post.content) + '</p>' +
        (post.plan ? '<div class="post-plan">专属方案：' + esc(post.plan) + '</div>' : '') +
        '<div class="post-actions">' +
        '<button class="act' + (liked ? ' on' : '') + '" data-act="like" data-id="' + post.id + '">' + icon('heart') + ' ' + ((post.likes || []).length) + '</button>' +
        '<button class="act" data-act="focus-comment" data-id="' + post.id + '">' + icon('comment') + ' ' + ((post.comments || []).length) + '</button>' +
        '<button class="act" data-act="share" data-id="' + post.id + '">' + icon('share') + ' ' + (post.shares || 0) + '</button>' +
        '<button class="act' + (checked ? ' on' : '') + '" data-act="checkin" data-id="' + post.id + '"' + (mine ? ' disabled title="不能监督自己"' : '') + '>' + icon('check') + ' ' + (checked ? '今日已监督' : '监督打卡 +1') + '</button>' +
        '<button class="act" data-act="remind-author" data-id="' + post.id + '">' + icon('bell') + ' 提醒打卡</button></div>' +
        '<div class="comments">' + (post.comments || []).map(function (c) {
          var cu = state.users.filter(function (x) { return x.id === c.userId; })[0] || { name: '用户' };
          return '<p><b>' + esc(cu.name) + '：</b>' + esc(c.text) + '<small> ' + fmtDate(c.date) + '</small></p>';
        }).join('') + '</div>' +
        '<form class="comment-form" data-form="comment" data-id="' + post.id + '"><input name="text" placeholder="写评论…" required><button type="submit">发送</button></form></article>';
    }).join('') + '</div>';
    var items = theme === 'theme-fitness' ? [
      { href: 'fitness/profile', label: '健康档案', icon: icon('profile') }, { href: 'fitness/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'fitness/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'fitness/me', label: '个人中心', icon: icon('me') }] : [
      { href: 'health/daily', label: '健康管理', icon: icon('dash') }, { href: 'health/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'health/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'health/me', label: '个人中心', icon: icon('me') }];
    return shell(theme, theme === 'theme-fitness' ? '健身模式' : '健康模式', 'COMMUNITY', items, active, html,
      '<button class="icon-btn" data-act="switch-mode" title="切换模式">⇄</button>');
  }
  V.fitnessPlaza = function (u, s) { return plaza(u, s, 'theme-fitness', 'fitness/plaza'); };
  V.healthPlaza = function (u, s) { return plaza(u, s, 'theme-health', 'health/plaza'); };

  /* ---------- 农小禾慧选（用户只读） ---------- */
  function shop(u, state, theme, active) {
    var recs = ENGINE.recommend(u, state.products);
    var html = '<div class="page-head"><div><span class="kicker">SMART SELECT</span><h1>农小禾慧选</h1><p>依据你的健康档案智能匹配，普通用户只能浏览与加购，商品增减仅在管理员模式开放。</p></div>' +
      '<button class="btn ghost" data-act="go-cart">查看购物车 →</button></div>';
    if (recs.length) html += '<div class="ai-banner"><div><strong>AI 推荐</strong><p>基于' + esc(u.profile && u.profile.goal || '当前档案') + '目标与记录指标，为你优先展示：' + esc(recs.map(function (r) { return r.product.name; }).join('、')) + '</p></div><a href="#/' + active.split('/')[0] + '/me">查看理由 →</a></div>';
    var groups = {};
    (state.products || []).forEach(function (p) { (groups[p.category] = groups[p.category] || []).push(p); });
    Object.keys(groups).forEach(function (cat) {
      html += '<div class="shop-group"><h2>' + esc(cat) + '</h2><div class="product-grid">' + groups[cat].map(function (p) {
        var nutri = Object.keys(p.nutrition || {}).map(function (k) { return '<span>' + esc(k) + ' ' + esc(p.nutrition[k]) + '</span>'; }).join('');
        var org = (p.organic || []).map(function (x) { return '<i>' + esc(x) + '</i>'; }).join('');
        return '<article class="product"><div class="product-top"><span class="cat">' + esc(p.category) + '</span><strong>¥' + p.price + '</strong></div><h3>' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
          '<div class="nutri">' + nutri + '</div><div class="organic">' + org + '</div>' +
          '<div class="product-foot"><span>' + p.points + ' 积分可兑换</span><button class="btn primary sm" data-act="add-cart" data-id="' + p.id + '">加入购物车</button></div></article>';
      }).join('') + '</div></div>';
    });
    var items = theme === 'theme-fitness' ? [
      { href: 'fitness/profile', label: '健康档案', icon: icon('profile') }, { href: 'fitness/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'fitness/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'fitness/me', label: '个人中心', icon: icon('me') }] : [
      { href: 'health/daily', label: '健康管理', icon: icon('dash') }, { href: 'health/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'health/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'health/me', label: '个人中心', icon: icon('me') }];
    return shell(theme, theme === 'theme-fitness' ? '健身模式' : '健康模式', 'SMART SELECT', items, active, html,
      '<button class="icon-btn" data-act="switch-mode" title="切换模式">⇄</button>');
  }
  V.fitnessShop = function (u, s) { return shop(u, s, 'theme-fitness', 'fitness/shop'); };
  V.healthShop = function (u, s) { return shop(u, s, 'theme-health', 'health/shop'); };

  /* ---------- 个人中心 ---------- */
  function me(u, state, theme, active) {
    var isFit = theme === 'theme-fitness';
    var ps = ENGINE.progressScore(u);
    var recs = ENGINE.recommend(u, state.products);
    var cart = u.cart || [];
    var total = cart.reduce(function (sum, it) {
      var p = state.products.filter(function (x) { return x.id === it.productId; })[0];
      return sum + (p ? p.points * it.qty : 0);
    }, 0);
    var html = '<div class="page-head"><div><span class="kicker">MY CENTER</span><h1>个人中心</h1><p>' + esc(u.name) + ' · ' + (isFit ? '健身成长' : '身体健康') + '记录</p></div><div class="score-badge"><small>可用积分</small><strong>' + (u.points || 0) + '</strong><span>分</span></div></div>';

    html += card('1 · AI 问答', '<div class="qa-log" id="qaLog">' + (u.qaLog || []).slice(-6).map(function (q) {
      return '<div class="qa q"><span>我</span><p>' + esc(q.q) + '</p></div><div class="qa a"><span>AI</span><p>' + esc(q.a) + '</p></div>';
    }).join('') + '</div><form data-form="qa" class="qa-form"><input name="q" placeholder="比如：体脂率怎么看？鱼油适合我吗？" required><button class="btn primary" type="submit">提问</button></form>' +
      '<div class="chips"><button data-act="qa-chip" data-q="体脂率怎么看">体脂率怎么看</button><button data-act="qa-chip" data-q="小腿围低于多少要警惕">小腿围标准</button><button data-act="qa-chip" data-q="鱼油和什么有关">鱼油</button><button data-act="qa-chip" data-q="蛋白质和增肌的关系">蛋白质</button></div>');

    html += card('2 · ' + (isFit ? '健身计划' : '健康计划'), '<div id="planBox">' + planHTML(u, state) + '</div>' +
      '<button class="btn primary" data-act="gen-plan">' + (u.plan ? '重新生成方案' : '生成周期方案') + '</button>' +
      (recs.length ? '<div class="rec-list"><h4>AI 推荐产品</h4>' + recs.map(function (r) {
        return '<div><strong>' + esc(r.product.name) + '</strong><span>' + esc(r.reasons.join(' / ')) + ' · ¥' + r.product.price + '</span></div>';
      }).join('') + '</div>' : ''));

    html += card('3 · 个人积分', '<div class="points-panel"><div><span>当前积分</span><strong>' + (u.points || 0) + '</strong></div><p>在用户广场监督他人打卡，每次 +1 分；积分可兑换农小禾慧选产品。</p></div>');

    html += card('4 · ' + (isFit ? '健身成长' : '身体健康'), '<div class="growth"><div><span>综合进度分</span><strong>' + ps.score + '</strong></div>' +
      spark(u, 'weight', '体重趋势', ' kg', '#39ff9a') + spark(u, 'bodyFat', '体脂趋势', ' %', '#7be0ff') +
      spark(u, 'waist', '腰围趋势', ' cm', '#ffd166') + '</div>' + photoTimeline(u));

    html += card('5 · 购物车', '<div id="cartBox">' + cartHTML(u, state) + '</div>' +
      '<div class="cart-total">合计 <strong>' + total + '</strong> 积分　<button class="btn primary sm" data-act="redeem"' + (total === 0 ? ' disabled' : '') + '>积分兑换</button></div>');

    html += '<div class="setting-row"><button class="btn ghost" data-act="switch-mode">切换健康 / 健身模式</button><button class="btn ghost danger" data-act="reset-demo">重置演示数据</button></div>';
    var items = isFit ? [
      { href: 'fitness/profile', label: '健康档案', icon: icon('profile') }, { href: 'fitness/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'fitness/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'fitness/me', label: '个人中心', icon: icon('me') }] : [
      { href: 'health/daily', label: '健康管理', icon: icon('dash') }, { href: 'health/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'health/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'health/me', label: '个人中心', icon: icon('me') }];
    return shell(theme, isFit ? '健身模式' : '健康模式', 'MY CENTER', items, active, html,
      '<button class="icon-btn" data-act="switch-mode" title="切换模式">⇄</button>');
  }
  function planHTML(u, state) {
    if (!u.plan) return '<p class="empty">还没有生成方案。点击按钮，根据健康档案生成未来 4 周的训练、饮食与产品建议。</p>';
    return '<div class="plan"><h4>' + esc(u.plan.title) + '</h4><h5>训练安排</h5><ul>' + u.plan.train.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h5>饮食建议</h5><ul>' + u.plan.diet.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="note">' + esc(u.plan.note) + '</p></div>';
  }
  function cartHTML(u, state) {
    var cart = u.cart || [];
    if (!cart.length) return '<p class="empty">购物车是空的，去农小禾慧选挑选产品吧。</p>';
    return cart.map(function (it) {
      var p = state.products.filter(function (x) { return x.id === it.productId; })[0];
      if (!p) return '';
      return '<div class="cart-item"><div><strong>' + esc(p.name) + '</strong><small>' + p.points + ' 积分 / 件 · ¥' + p.price + '</small></div>' +
        '<div class="qty"><button data-act="cart-minus" data-id="' + p.id + '">−</button><span>' + it.qty + '</span><button data-act="cart-plus" data-id="' + p.id + '">＋</button></div></div>';
    }).join('');
  }
  V.fitnessMe = function (u, s) { return me(u, s, 'theme-fitness', 'fitness/me'); };
  V.healthMe = function (u, s) { return me(u, s, 'theme-health', 'health/me'); };

  /* ---------- 健康模式：健康管理 ---------- */
  V.healthDaily = function (u, state) {
    var p = u.profile || {}, d = (u.healthDaily || [])[0] || {}, t = (u.healthTests || [])[0] || {};
    var results = ENGINE.scoreAll(t, p);
    var html = '<div class="page-head"><div><span class="kicker">DAILY WELLNESS</span><h1>健康管理</h1><p>日常指标每天记，专业自测每周一次。</p></div><div class="score-badge"><small>自测次数</small><strong>' + (u.healthTests || []).length + '</strong><span>次</span></div></div>';

    html += card('0 · 基础信息（用于评分参考）', '<form data-form="health-profile" class="form-grid">' +
      fld('gender', '性别', { type: 'select', options: [['female', '女'], ['male', '男']], value: p.gender }) +
      fld('age', '年龄', { value: p.age }) + fld('height', '身高 cm', { value: p.height }) +
      fld('weight', '体重 kg', { value: DATA.latest(u, 'weight') || p.weight, step: '0.1' }) +
      '<div class="full">' + fld('medical', '既往病史 / 运动禁忌', { type: 'textarea', value: p.medical, ph: '如：高血压，服用降压药' }) + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存</button></div></form>');

    html += card('1 · 日常记录', '<form data-form="health-daily" class="form-grid">' +
      fld('date', '日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('bpSys', '高压 mmHg', { value: d.bpSys }) + fld('bpDia', '低压 mmHg', { value: d.bpDia }) +
      fld('hr', '心率 bpm', { value: d.hr }) + fld('glucose', '空腹血糖 mmol/L', { value: d.glucose, step: '0.1' }) +
      fld('sleepMinutes', '入睡时长 分钟', { value: d.sleepMinutes }) + fld('wakeups', '醒夜次数', { value: d.wakeups }) +
      '<div class="full">' + note('血压测量前静坐 5 分钟；血糖请空腹测量。记录趋势比单次数值更重要。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存今日记录</button></div></form>');

    html += card('2 · 周期专业自测（每周 1 次）', '<form data-form="health-test" class="form-grid">' +
      fld('date', '自测日期', { type: 'date', value: DATA.dateStr(0) }) +
      fld('balance', '闭眼单脚站立 · 最好成绩 秒', { value: t.balance, step: '0.1' }) +
      fld('calf', '小腿围 cm', { value: t.calf, step: '0.1' }) +
      fld('cognition', '认知自测 答对题数 0–3', { value: t.cognition }) +
      fld('breathHold', '屏气时间 秒', { value: t.breathHold }) +
      fld('reach', '坐位体前屈 指尖相对脚尖 cm（超过为正，够不到为负）', { value: t.reach, step: '0.1' }) +
      fld('sitToStand', '5 次起坐 用时 秒', { value: t.sitToStand, step: '0.1' }) +
      '<div class="full"><details><summary>展开测试方法与评分标准</summary><ol class="standards">' +
      '<li><b>闭眼单脚站立：</b>赤脚站立，双手下垂，闭眼抬脚离地 5–10cm，晃动/落地/睁眼即停，测 2 次取最好。60–69 岁：&lt;10 秒较弱，10–19 秒一般，≥20 秒较好；70–79 岁：&lt;5 秒较弱，5–9 秒一般，≥10 秒较好；80 岁以上：&lt;3 秒较弱，3–5 秒一般，&gt;5 秒较好。</li>' +
      '<li><b>小腿围：</b>坐位屈膝约 90 度，软尺测最粗处。男性 ≥34cm 风险较低、&lt;34cm 可能不足；女性 ≥33cm 风险较低、&lt;33cm 可能不足。指环测试可辅助。</li>' +
      '<li><b>屏气时间：</b>安静坐好，深吸气后屏气，憋不住即停，不要勉强。50 岁：&lt;20 秒偏弱，20–30 秒一般，&gt;30 秒较好；60 岁以上：&lt;20 秒偏弱，20–25 秒一般，25–45 秒较好，&gt;45 秒优秀；&lt;10 秒不建议反复测试并咨询医生。高血压、心脏病、脑血管病史者谨慎，头晕胸闷立即停止。</li>' +
      '<li><b>坐位体前屈：</b>坐床边或垫子，双腿伸直并拢，脚尖回勾，腰背挺直缓慢前伸。40 岁以上男性：够不到脚尖偏弱、刚碰到一般、超过较好；40 岁以上女性：低于脚尖 3cm 内偏弱、碰到一般、超过较好。只能碰膝盖附近说明柔韧性较差，避免猛压猛拉。</li>' +
      '<li><b>5 次起坐：</b>坐 40–46cm 高椅子，双脚平放，双手抱胸，不用手撑，连续起坐 5 次记时。&lt;12 秒较好；≥12 秒下肢力量可能下降。头晕、胸闷、腿软立即停止。</li>' +
      '<li><b>认知自测：</b>如“回忆昨天吃过哪三种菜”或“倒述一组数字”，记录答对题数（0–3），仅作初步筛查。</li>' +
      '</ol></details></div>' +
      '<div class="full">' + note('自测统一输出五档结论：优秀 / 良好 / 一般 / 偏弱 / 较弱。结果仅作健康参考，异常请就医。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存本周自测并评分</button></div></form>');

    html += card('3 · 本周结论', results.length ? '<div class="verdicts">' + results.map(function (r) {
      return '<div class="verdict ' + esc(r.value.level) + '"><span>' + esc(r.key) + '</span><p>' + esc(r.value.text) + '</p></div>';
    }).join('') + '</div>' : '<p class="empty">完成一次专业自测后，这里会显示逐项一句话结论。</p>');

    html += card('4 · 症状与用药（按需填写）', '<form data-form="symptoms" class="form-grid">' +
      '<div class="full"><span class="fl-title">专业症状自查（勾选出现的信号）</span><div class="check-grid">' +
      ['下肢水肿', '运动后气短', '餐后困倦', '夜间憋醒', '胸闷胸痛', '头晕'].map(function (s) {
        return '<label><input type="checkbox" name="symptom" value="' + s + '"' + ((u.symptoms || []).indexOf(s) >= 0 ? ' checked' : '') + '> ' + s + '</label>';
      }).join('') + '</div></div>' +
      fld('onTime', '是否按时服药', { type: 'select', options: ['是', '否', '不适用'], value: (u.meds || {}).onTime }) +
      fld('missed', '有无漏服', { type: 'select', options: ['否', '偶有', '经常'], value: (u.meds || {}).missed }) +
      '<div class="full">' + fld('adverse', '药物不良反应', { type: 'textarea', value: (u.meds || {}).adverse, ph: '无则留空' }) + '</div>' +
      '<div class="full">' + note('下肢水肿、运动后气短、餐后困倦、夜间憋醒等是心衰或代谢异常的预警信号，出现请及时就医。') + '</div>' +
      '<div class="full"><button class="btn primary" type="submit">保存症状与用药</button></div></form>');

    html += card('5 · 日常趋势', '<div class="chart-grid">' + sparkHealth(u, 'bpSys', '收缩压趋势', ' mmHg', '#3fa876') +
      sparkHealth(u, 'glucose', '空腹血糖趋势', ' mmol/L', '#6fc39a') + '</div>');

    var items = [
      { href: 'health/daily', label: '健康管理', icon: icon('dash') }, { href: 'health/plaza', label: '用户广场', icon: icon('plaza') },
      { href: 'health/shop', label: '农小禾慧选', icon: icon('shop') }, { href: 'health/me', label: '个人中心', icon: icon('me') }];
    return shell('theme-health', '健康模式', 'WELLNESS MODE', items, 'health/daily', html,
      '<button class="icon-btn" data-act="switch-mode" title="切换模式">⇄</button>');
  };
  function sparkHealth(u, key, label, unit, color) {
    var rows = (u.healthDaily || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(-8);
    var vals = rows.map(function (r) { return r[key]; }).filter(function (v) { return typeof v === 'number'; });
    if (vals.length < 2) return '<div class="chart-empty">' + esc(label) + '：至少记录两次后显示趋势</div>';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = max - min || 1;
    var pts = vals.map(function (v, i) { return (8 + i * (284 / (vals.length - 1))).toFixed(1) + ',' + (72 - ((v - min) / span) * 56).toFixed(1); }).join(' ');
    return '<div class="chart"><div class="chart-top"><span>' + esc(label) + '</span><strong>' + vals[vals.length - 1] + esc(unit) + '</strong></div>' +
      '<svg viewBox="0 0 300 88" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
      '<div class="chart-axis"><span>' + fmtDate(rows[0].date) + '</span><span>' + fmtDate(rows[rows.length - 1].date) + '</span></div></div>';
  }

  /* ---------- 管理员 ---------- */
  function adminShell(title, active, content) {
    var items = [
      { href: 'admin/products', label: '慧选产品', icon: icon('shop') },
      { href: 'admin/users', label: '用户档案', icon: icon('users') },
      { href: 'admin/carts', label: '购物车汇总', icon: icon('cart') }
    ];
    return '<div class="app-shell theme-admin"><div class="grid-bg"></div><header class="topbar admin-top"><div class="brand"><span class="logo">禾</span><div><strong>ADMIN CONSOLE</strong><small>农小禾 · 管理中枢</small></div></div>' +
      '<div class="top-right"><span class="live"><i></i> SYSTEM ONLINE</span><a class="ghost-btn" href="#/login">退出管理</a></div></header>' +
      '<main class="main admin-main">' + content + '</main>' + nav('theme-admin', items, active) + '</div>';
  }
  V.adminProducts = function (state, filter) {
    var products = state.products || [];
    var list = filter ? products.filter(function (p) { return (p.name + p.category + (p.tags || []).join('')).toLowerCase().indexOf(filter.toLowerCase()) >= 0; }) : products;
    var html = '<div class="page-head admin-head"><div><span class="kicker">PRODUCT CONTROL</span><h1>农小禾慧选产品</h1><p>管理员可增加、编辑、删除产品，并标注营养成分与有机物质。</p></div>' +
      '<button class="btn admin-btn" data-act="product-new">＋ 新增产品</button></div>' +
      '<form data-form="product-search" class="admin-search"><input name="q" placeholder="搜索产品名称 / 品类 / 标签" value="' + esc(filter || '') + '"><button type="submit">搜索</button></form>' +
      '<div class="admin-stats"><div><span>产品总数</span><strong>' + products.length + '</strong></div><div><span>品类数</span><strong>' + Object.keys(products.reduce(function (a, p) { a[p.category] = 1; return a; }, {})).length + '</strong></div><div><span>当前显示</span><strong>' + list.length + '</strong></div></div>' +
      '<div class="admin-table"><div class="tr head"><span>产品</span><span>品类</span><span>价格 / 积分</span><span>营养与有机标注</span><span>操作</span></div>' +
      list.map(function (p) {
        var nutri = Object.keys(p.nutrition || {}).map(function (k) { return k + ' ' + p.nutrition[k]; }).join(' · ');
        return '<div class="tr"><span><b>' + esc(p.name) + '</b><small>' + esc(p.desc) + '</small></span><span>' + esc(p.category) + '</span>' +
          '<span>¥' + p.price + '<small>' + p.points + ' 积分</small></span><span class="mini">' + esc(nutri) + '<small>' + esc((p.organic || []).join(' · ')) + '</small></span>' +
          '<span class="ops"><button data-act="product-edit" data-id="' + p.id + '">编辑</button><button data-act="product-del" data-id="' + p.id + '">删除</button></span></div>';
      }).join('') + '</div>';
    return adminShell('PRODUCTS', 'admin/products', html);
  };
  V.adminUsers = function (state, filter) {
    var users = state.users || [];
    var q = (filter || '').toLowerCase();
    var list = q ? users.filter(function (u) { return (u.name + u.phone).toLowerCase().indexOf(q) >= 0; }) : users;
    var html = '<div class="page-head admin-head"><div><span class="kicker">USER ARCHIVE</span><h1>用户健康档案汇总</h1><p>全量用户档案、身体记录与 AI 生成方案，支持搜索查询。</p></div></div>' +
      '<form data-form="user-search" class="admin-search"><input name="q" placeholder="搜索姓名 / 手机号" value="' + esc(filter || '') + '"><button type="submit">搜索用户</button></form>' +
      '<div class="user-grid">' + list.map(function (u) {
        var p = u.profile || {}, plan = u.plan;
        return '<article class="user-card"><div class="uc-head"><div class="avatar">' + esc(u.name.slice(0, 1)) + '</div><div><strong>' + esc(u.name) + '</strong><small>' + esc(u.phone) + ' · ' + esc(u.mode === 'health' ? '健康模式' : u.mode === 'fitness' ? '健身模式' : '未选择') + '</small></div></div>' +
          '<div class="uc-meta"><span>性别 ' + esc(p.gender === 'male' ? '男' : '女') + '</span><span>年龄 ' + esc(p.age) + '</span><span>目标 ' + esc(p.goal) + '</span><span>积分 ' + (u.points || 0) + '</span></div>' +
          '<div class="uc-kv"><span>身高 ' + esc(p.height) + 'cm</span><span>体重 ' + esc(DATA.latest(u, 'weight') || p.weight) + 'kg</span><span>体脂 ' + esc(DATA.latest(u, 'bodyFat') || '—') + '%</span><span>病史 ' + esc(p.medical || '无') + '</span></div>' +
          '<div class="uc-plan"><b>AI 方案</b><p>' + (plan ? esc(plan.title) + ' · 训练 ' + plan.train.length + ' 条 / 饮食 ' + plan.diet.length + ' 条' : '尚未生成') + '</p></div>' +
          '<div class="uc-foot"><button class="admin-btn sm" data-act="user-detail" data-id="' + u.id + '">查看完整档案</button><button class="admin-btn ghost sm" data-act="user-plan" data-id="' + u.id + '">查看 AI 方案</button></div></article>';
      }).join('') + '</div>';
    return adminShell('USERS', 'admin/users', html);
  };
  V.adminCarts = function (state, filter) {
    var users = state.users || [], q = (filter || '').toLowerCase();
    var list = q ? users.filter(function (u) { return (u.name + u.phone).toLowerCase().indexOf(q) >= 0; }) : users;
    var html = '<div class="page-head admin-head"><div><span class="kicker">CART INTELLIGENCE</span><h1>购物车选品汇总</h1><p>按用户查看购物车中的商品种类、数量与积分合计。</p></div></div>' +
      '<form data-form="cart-search" class="admin-search"><input name="q" placeholder="搜索用户姓名 / 手机号" value="' + esc(filter || '') + '"><button type="submit">搜索用户</button></form>' +
      '<div class="cart-grid">' + list.map(function (u) {
        var cart = u.cart || [], count = cart.reduce(function (a, x) { return a + x.qty; }, 0);
        var points = cart.reduce(function (a, x) {
          var p = state.products.filter(function (y) { return y.id === x.productId; })[0];
          return a + (p ? p.points * x.qty : 0);
        }, 0);
        return '<article class="cart-card"><div class="cc-head"><strong>' + esc(u.name) + '</strong><span>' + esc(u.phone) + '</span></div>' +
          '<div class="cc-stat"><div><span>商品种类</span><b>' + cart.length + '</b></div><div><span>商品数量</span><b>' + count + '</b></div><div><span>积分合计</span><b>' + points + '</b></div></div>' +
          '<ul>' + cart.map(function (x) {
            var p = state.products.filter(function (y) { return y.id === x.productId; })[0];
            return '<li><span>' + esc(p ? p.name : '已下架商品') + '</span><b>× ' + x.qty + '</b></li>';
          }).join('') + '</ul>' +
          (cart.length ? '' : '<p class="empty">购物车为空</p>') + '</article>';
      }).join('') + '</div>';
    return adminShell('CARTS', 'admin/carts', html);
  };

  V.modals = {
    userCode: function (phone) {
      return '<div class="modal-card"><span class="kicker">LOGIN VERIFICATION</span><h2>用户登录验证</h2>' +
        '<p>已核验账号 ' + esc(phone) + ' 的密码。请输入短信验证码继续。</p>' +
        '<form data-form="user-code"><label class="fl"><span>验证码</span><input name="code" type="tel" maxlength="6" placeholder="演示验证码 888888" required></label>' +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">取消</button><button type="submit" class="btn primary">验证并登录</button></div></form>' +
        '<small class="demo-hint">演示验证码：888888（本地模拟，不发送真实短信）</small></div>';
    },
    adminCode: function () {
      return '<div class="modal-card admin-modal"><span class="kicker">RESTRICTED ACCESS</span><h2>管理员身份验证</h2>' +
        '<p>已识别内部号码 ' + DATA.ADMIN_PHONE + '。请输入短信验证码继续。</p>' +
        '<form data-form="admin-code"><label class="fl"><span>验证码</span><input name="code" type="tel" maxlength="6" placeholder="演示验证码 888888" required></label>' +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">取消</button><button type="submit" class="btn admin-btn">验证并进入</button></div></form>' +
        '<small class="demo-hint">演示验证码：888888（本地模拟，不发送真实短信）</small></div>';
    },
    productForm: function (p) {
      p = p || {};
      return '<div class="modal-card"><h2>' + (p.id ? '编辑产品' : '新增产品') + '</h2><form data-form="product-save" data-id="' + esc(p.id || '') + '" class="form-grid">' +
        fld('name', '产品名称', { type: 'text', value: p.name }) + fld('category', '品类', { type: 'text', value: p.category }) +
        fld('price', '价格 ¥', { value: p.price, step: '0.1' }) + fld('points', '兑换积分', { value: p.points }) +
        '<div class="full">' + fld('desc', '产品描述', { type: 'textarea', value: p.desc }) + '</div>' +
        '<div class="full">' + fld('nutritionText', '营养成分（每行 名称:含量）', { type: 'textarea', value: Object.keys(p.nutrition || {}).map(function (k) { return k + ':' + p.nutrition[k]; }).join('\n') }) + '</div>' +
        '<div class="full">' + fld('organicText', '有机物质 / 认证（逗号分隔）', { type: 'text', value: (p.organic || []).join('，') }) + '</div>' +
        '<div class="full">' + fld('tagsText', '标签（逗号分隔，如 减脂,控糖）', { type: 'text', value: (p.tags || []).join('，') }) + '</div>' +
        '<div class="full modal-actions"><button type="button" class="btn ghost" data-act="close-modal">取消</button><button type="submit" class="btn admin-btn">保存产品</button></div></form></div>';
    },
    userDetail: function (u, state) {
      var p = u.profile || {}, rs = (u.records || []).slice(0, 5);
      return '<div class="modal-card wide"><h2>' + esc(u.name) + ' · 完整健康档案</h2>' +
        '<p>手机号 ' + esc(u.phone) + ' · ' + esc(u.mode || '未选择模式') + ' · 注册 ' + esc(u.createdAt) + '</p>' +
        '<h4>基础档案</h4><div class="detail-grid"><span>性别 ' + esc(p.gender) + '</span><span>年龄 ' + esc(p.age) + '</span><span>身高 ' + esc(p.height) + 'cm</span><span>目标 ' + esc(p.goal) + '</span><span>目标体重 ' + esc(p.targetWeight) + 'kg</span><span>目标体脂 ' + esc(p.targetBodyFat) + '%</span><span>病史 ' + esc(p.medical || '无') + '</span></div>' +
        '<h4>最近记录</h4><div class="detail-table">' + (rs.length ? rs.map(function (r) {
          return '<div><span>' + esc(r.date) + '</span><span>体重 ' + esc(r.weight) + '</span><span>体脂 ' + esc(r.bodyFat) + '</span><span>肌肉 ' + esc(r.muscle) + '</span><span>腰围 ' + esc(r.waist) + '</span></div>';
        }).join('') : '<p class="empty">暂无记录</p>') + '</div>' +
        '<h4>健康模式记录</h4><p>日常记录 ' + (u.healthDaily || []).length + ' 条 · 专业自测 ' + (u.healthTests || []).length + ' 条 · 症状 ' + (u.symptoms || []).join('、') + '</p>' +
        '<div class="modal-actions"><button class="btn admin-btn" data-act="close-modal">关闭</button></div></div>';
    },
    userPlan: function (u, state) {
      var plan = u.plan || ENGINE.makePlan(u, state.products);
      return '<div class="modal-card wide"><h2>' + esc(u.name) + ' · AI 方案</h2><div class="plan">' +
        '<h4>' + esc(plan.title) + '</h4><h5>训练安排</h5><ul>' + plan.train.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h5>饮食建议</h5><ul>' + plan.diet.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h5>推荐产品</h5><ul>' + (plan.products || []).map(function (x) { return '<li>' + esc(x.name) + '（' + esc(x.reason) + '）</li>'; }).join('') + '</ul>' +
        '<p class="note">' + esc(plan.note) + '</p></div><div class="modal-actions"><button class="btn admin-btn" data-act="close-modal">关闭</button></div></div>';
    }
  };

  V.esc = esc;
  window.VIEWS = V;
})();
