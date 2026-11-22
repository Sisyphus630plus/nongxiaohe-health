/* 农小禾 Agent · 规则引擎：评分、方案、推荐、AI 问答 */
(function () {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function num(v, fallback) { var n = parseFloat(v); return isNaN(n) ? (fallback || 0) : n; }
  var LEVELS = ['优秀', '良好', '一般', '偏弱', '较弱'];

  /* 一句话结论：把各测试映射为用户要求的五档统一话术 */
  function verdict(level, label, detail) {
    var map = {
      '优秀': '优秀：明显高于同龄人平均水平。',
      '良好': '良好：高于同龄人平均水平。',
      '一般': '一般：处于同龄人常见水平。',
      '偏弱': '偏弱：低于同龄人平均水平，建议针对性改善。',
      '较弱': '较弱：明显低于同龄人平均水平，建议加强训练或咨询医生。'
    };
    return { level: level, text: (map[level] || map['一般']) + (detail ? '（' + label + '：' + detail + '）' : '') };
  }

  /* 1. 闭眼单脚站立 */
  function scoreBalance(sec, age) {
    var s = num(sec), a = num(age, 65), lv;
    if (a < 70) lv = s < 10 ? '较弱' : (s < 20 ? '一般' : '良好');
    else if (a < 80) lv = s < 5 ? '较弱' : (s < 10 ? '一般' : '良好');
    else lv = s <= 5 ? '较弱' : (s <= 8 ? '一般' : '良好');
    var r = verdict(lv, '闭眼单脚站立', s + ' 秒');
    if ((a >= 70 && s < 5) || s < 10) r.text += ' 跌倒风险偏高，建议加强平衡训练并注意居家防滑。';
    return r;
  }

  /* 2. 小腿围 */
  function scoreCalf(cm, gender) {
    var v = num(cm), lv = (gender === 'male' ? v >= 34 : v >= 33) ? '良好' : '偏弱';
    var r = verdict(lv, '小腿围', v + ' cm');
    r.text += lv === '偏弱' ? ' 该数值提示肌肉量可能不足，可用指环测试辅助判断。' : ' 肌肉量风险较低。';
    return r;
  }

  /* 3. 屏气时间 */
  function scoreBreath(sec, age, medical) {
    var s = num(sec), a = num(age, 60), lv;
    if (s < 10) return { level: '较弱', text: '屏气时间 ' + s + ' 秒：低于 10 秒，不建议反复测试，建议咨询医生。' };
    if (a < 60) lv = s < 20 ? '偏弱' : (s <= 30 ? '一般' : '良好');
    else lv = s < 20 ? '偏弱' : (s <= 25 ? '一般' : (s <= 45 ? '良好' : '优秀'));
    var r = verdict(lv, '屏气时间', s + ' 秒');
    if (medical && /高血压|心脏病|脑血管/.test(medical)) r.text += ' 有相关病史，屏气测试要谨慎，出现头晕、胸闷立即停止。';
    return r;
  }

  /* 4. 坐位体前屈：Distance 为指尖相对脚尖的位置（cm，负数=够不到） */
  function scoreReach(dist, gender) {
    var v = num(dist), lv;
    if (v >= 0) lv = '良好';
    else if (v >= -3 && gender === 'female') lv = '偏弱';
    else lv = '偏弱';
    var r = verdict(lv, '坐位体前屈', v >= 0 ? '超过脚尖 ' + v + ' cm' : '距脚尖 ' + Math.abs(v) + ' cm');
    if (v < -10) r.text += ' 柔韧性较差，建议每天做温和拉伸，避免猛压、猛拉。';
    return r;
  }

  /* 5. 五次起坐 */
  function scoreSitStand(sec) {
    var s = num(sec), r = verdict(s < 12 ? '良好' : '偏弱', '5 次起坐', s + ' 秒');
    if (s >= 12) r.text += ' 日常起身、上楼可能容易累。';
    return r;
  }

  /* 6. 认知自测 */
  function scoreCognition(score) {
    var s = num(score, 3), lv = s >= 3 ? '优秀' : (s === 2 ? '良好' : (s === 1 ? '一般' : '偏弱'));
    var r = verdict(lv, '认知自测', s + '/3 题正确');
    r.text += ' 仅为初步筛查，不能作为诊断依据，持续异常建议就医评估。';
    return r;
  }

  function scoreAll(test, profile) {
    if (!test) return [];
    var p = profile || {};
    var results = [];
    if (test.balance !== '' && test.balance != null) results.push({ key: '平衡能力', value: scoreBalance(test.balance, p.age) });
    if (test.calf !== '' && test.calf != null) results.push({ key: '小腿围', value: scoreCalf(test.calf, p.gender) });
    if (test.cognition !== '' && test.cognition != null) results.push({ key: '认知功能', value: scoreCognition(test.cognition) });
    if (test.breathHold !== '' && test.breathHold != null) results.push({ key: '屏气时间', value: scoreBreath(test.breathHold, p.age, p.medical) });
    if (test.reach !== '' && test.reach != null) results.push({ key: '柔韧性', value: scoreReach(test.reach, p.gender) });
    if (test.sitToStand !== '' && test.sitToStand != null) results.push({ key: '下肢力量', value: scoreSitStand(test.sitToStand) });
    return results;
  }

  /* 综合进度分：体重/体脂/围度趋势 + 训练频率 */
  function progressScore(user) {
    var rs = (user.records || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!rs.length) return { score: 0, parts: [] };
    var latest = rs[0], first = rs[rs.length - 1], parts = [], total = 0;
    function part(name, value) { parts.push({ name: name, value: Math.round(value) }); total += value; }
    function trend(key, goodDirection, weight, cap) {
      if (typeof latest[key] !== 'number' || typeof first[key] !== 'number') { part(name, 0); return; }
      var delta = (latest[key] - first[key]) * goodDirection;
      part(key, clamp(delta / cap, 0, 1) * weight);
    }
    var goal = user.profile && user.profile.goal;
    var dirW = goal === '增肌' ? 1 : -1;
    trend('weight', dirW, 25, 4);
    trend('bodyFat', -1, 25, 4);
    trend('waist', -1, 20, 5);
    var training = latest.trainingLoad || 0;
    part('训练频率', clamp(training / 4, 0, 1) * 30);
    return { score: Math.round(clamp(total, 0, 100)), parts: parts };
  }

  function bmi(weight, heightCm) {
    var h = num(heightCm) / 100;
    if (!h || !weight) return null;
    return Math.round(num(weight) / (h * h) * 10) / 10;
  }
  function bmr(user) {
    var p = user.profile || {}, w = DATA.latest(user, 'weight') || p.weight;
    var base = 10 * num(w) + 6.25 * num(p.height) - 5 * num(p.age) + (p.gender === 'male' ? 5 : -161);
    return Math.round(base);
  }

  /* AI 产品推荐：按目标 + 指标打分 */
  function recommend(user, products) {
    var p = user.profile || {}, goal = p.goal || '维持';
    var bodyFat = DATA.latest(user, 'bodyFat'), visceral = DATA.latest(user, 'visceralFat');
    var glucose = DATA.latest(user, 'glucose') || 5, sys = DATA.latest(user, 'bpSys') || 120;
    var age = num(p.age, 30);
    var want = {};
    if (goal === '减脂') { want['减脂'] = 3; want['控糖'] = 2; want['高蛋白'] = 2; want['肠道'] = 1; }
    if (goal === '增肌') { want['增肌'] = 4; want['高蛋白'] = 3; want['恢复'] = 2; }
    if (goal === '塑形') { want['高蛋白'] = 2; want['减脂'] = 2; want['恢复'] = 1; }
    if (bodyFat && bodyFat > 28) { want['减脂'] = (want['减脂'] || 0) + 2; want['控糖'] = (want['控糖'] || 0) + 1; }
    if (visceral && visceral > 9) want['心血管'] = (want['心血管'] || 0) + 2;
    if (glucose >= 6 || p.medical && /血糖/.test(p.medical)) want['控糖'] = (want['控糖'] || 0) + 3;
    if (sys >= 135 || p.medical && /高血压/.test(p.medical)) { want['控盐'] = (want['控盐'] || 0) + 3; want['心血管'] = (want['心血管'] || 0) + 2; }
    if (age >= 60) { want['中老年'] = (want['中老年'] || 0) + 3; want['骨量'] = (want['骨量'] || 0) + 2; want['肌肉'] = (want['肌肉'] || 0) + 2; }
    return (products || []).map(function (prod) {
      var score = 0, hits = [];
      (prod.tags || []).forEach(function (t) { if (want[t]) { score += want[t]; hits.push(t); } });
      return { product: prod, score: score, reasons: hits };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
  }

  /* 训练 + 饮食方案（规则模板，非医疗建议） */
  function makePlan(user, products) {
    var p = user.profile || {}, goal = p.goal || '维持';
    var age = num(p.age, 30), mode = user.mode || 'fitness';
    var isOld = age >= 60;
    var recs = recommend(user, products);
    var train, diet;
    if (isOld || mode === 'health') {
      train = [
        '每周 3 次快走或太极，每次 20–30 分钟，以不气喘为宜。',
        '每周 2 次椅子坐立训练：每组 5 次，做 2 组；起身困难时减少幅度。',
        '每周 2 次闭眼单脚站立练习：扶椅背保护，每次 10 秒，做 2 组。',
        '训练中如出现头晕、胸闷、腿软立即停止并休息。'
      ];
      diet = [
        '每餐一拳主食、一掌优质蛋白、两拳蔬菜，细嚼慢咽。',
        '控制盐与腌制食品，每日食盐建议不超过 5g。',
        '固定晨起测血压与心率，每周记录一次小腿围。',
        '有慢性病或用药者，饮食调整前先与医生确认。'
      ];
    } else if (goal === '增肌') {
      train = [
        '每周 4 次力量训练：胸/背/腿/肩各 1 天，每组 8–12 次，做 3–4 组。',
        '每周 2 次 20 分钟中低强度有氧，安排在力量训练之后。',
        '同一动作每周尝试增加 1–2 次或 1kg 负荷，记录训练重量。',
        '每晚保证 7–8 小时睡眠，疲劳度 ≥7 时主动减量。'
      ];
      diet = [
        '每日蛋白质约 1.6g/kg 体重，分 3–4 餐摄入。',
        '训练后 2 小时内补充蛋白质与适量碳水。',
        '每日蔬菜 500g 左右，饮水 2000ml 以上。',
        '体脂偏高时先做 4 周小幅热量缺口再进入增肌期。'
      ];
    } else if (goal === '减脂') {
      train = [
        '每周 3 次力量训练（全身循环），每次 40 分钟。',
        '每周 2 次快走或椭圆机，每次 30 分钟，心率维持中等强度。',
        '每周记录腰围 1 次，晨起空腹称重，重点看趋势。',
        '睡眠不足 6 小时当天降低训练强度。'
      ];
      diet = [
        '每餐按“半盘蔬菜、四分之一蛋白、四分之一主食”搭配。',
        '减少含糖饮料与油炸食品，优先选择全谷物。',
        '每日蛋白质约 1.2–1.5g/kg 体重，避免只吃水果减肥。',
        '每周允许 1 次放松餐，但保持总热量不超标。'
      ];
    } else {
      train = [
        '每周 3 次中等强度有氧，每次 30 分钟。',
        '每周 2 次全身力量训练，维持肌肉量。',
        '每天步行 6000–8000 步，久坐每小时起身活动。'
      ];
      diet = [
        '均衡饮食，主食粗细搭配，保证优质蛋白。',
        '规律三餐，避免夜宵和过量精制糖。',
        '每周固定一天记录体重与围度，观察趋势。'
      ];
    }
    var cycle = { title: '未来 4 周' + (goal === '维持' ? '维持' : goal) + '方案',
      goal: goal, owner: p.name || user.name, train: train, diet: diet,
      products: recs.map(function (r) { return { id: r.product.id, name: r.product.name, reason: r.reasons.join(' / ') }; }),
      note: '本方案由规则模板生成，仅供健康记录参考，不构成医疗或营养诊断。' };
    return cycle;
  }

  /* 关键词 AI 问答：指标含义 + 产品营养与身体状况关联 */
  var KB = [
    { k: ['体脂', '脂肪'], t: '体脂率反映身体脂肪占比，比体重更能说明“减的是不是脂肪”。女性常见参考约 20%–30%，男性约 10%–20%，但应以个人趋势和医生意见为准。建议固定设备、固定时间测量，看长期曲线。' },
    { k: ['肌肉', '骨骼肌'], t: '肌肉量或骨骼肌量用于判断力量训练是否真的带来增肌。体重不变但肌肉上升、体脂下降，是理想的身体重组。中老年小腿围是肌少症的简易预警指标。' },
    { k: ['基础代谢', 'bmr'], t: '基础代谢率是静息状态下维持生命所需的最低热量。肌肉量、年龄、性别都会影响它。它可帮助你制定热量计划，但实际消耗还要加上活动量。' },
    { k: ['内脏脂肪'], t: '内脏脂肪等级反映腹腔深层脂肪，数值偏高与代谢风险相关。腰围和腰臀比是简单补充指标。改善方式以规律运动、控制精制糖和总热量为主。' },
    { k: ['体水分', '水分'], t: '体水分率短期内会随饮水、盐分、出汗和碳水摄入波动，因此单日体重变化常由水分造成。看周均值和趋势更可靠。' },
    { k: ['骨量', '骨质'], t: '骨量变化较慢，属于长期健康参考。负重力量训练、足量钙和维生素D、避免吸烟有助于维持骨量；已确诊骨质疏松需遵医嘱。' },
    { k: ['腰围', '腰臀比'], t: '腰围反映腹部脂肪，腰臀比用于评估中心性肥胖风险。测量时建议肚脐上方约 1–2cm、自然呼气末读数，臀围取臀部最凸处，并始终使用同一位置。' },
    { k: ['静息心率', '心率'], t: '静息心率反映心肺适应与恢复状态，长期规律有氧后常会缓慢下降。若静息心率明显升高并伴胸闷、头晕，应停止训练并就医。' },
    { k: ['心率变异', 'hrv'], t: '心率变异性（HRV）用于观察疲劳与恢复。持续低于个人基线通常提示恢复不足，可降低训练强度、增加睡眠。不同设备数值不可直接横比。' },
    { k: ['睡眠'], t: '睡眠影响增肌、减脂与恢复。建议成年人每晚 7–9 小时，关注入睡时长与夜间醒来次数。长期入睡困难或打鼾憋醒建议就医评估。' },
    { k: ['血压'], t: '血压需要看趋势而不是单次数值。测量前静坐 5 分钟、避免咖啡因和运动后立即测量。已有高血压者请按医嘱服药，不要用 Apps 结果替代诊疗。' },
    { k: ['血糖'], t: '空腹血糖是核心代谢指标。单次偏高可能受前一晚饮食、睡眠影响，建议固定时间记录并带给医生判断。' },
    { k: ['疲劳'], t: '主观疲劳度 1–10 分是调整训练的好工具：持续 7 分以上建议减量或休息，配合 HRV 与睡眠一起判断。' },
    { k: ['平衡', '跌倒', '单脚'], t: '闭眼单脚站立评估平衡与跌倒风险。70 岁以上低于 5 秒提示风险偏高，建议加强平衡练习并改善居家防滑。' },
    { k: ['小腿围', '肌少'], t: '男性小腿围小于 34cm、女性小于 33cm 提示肌肉量可能不足。指环测试可辅助：手能轻松围住并有空隙时风险更高。' },
    { k: ['屏气', '肺活量'], t: '屏气时间粗略反映呼吸系统耐力。低于 10 秒不建议反复测试；有高血压、心脏病、脑血管病史者测试要谨慎，出现头晕胸闷立即停止。' },
    { k: ['柔韧', '体前屈'], t: '坐位体前屈反映关节僵硬与跌倒风险。只能碰到膝盖附近时说明柔韧性较差，建议每天温和拉伸，避免猛压。' },
    { k: ['起坐', '下肢'], t: '5 次起坐用时 12 秒及以上提示下肢力量可能下降，日常起身、上楼容易累。测试中头晕、胸闷、腿软应立即停止。' },
    { k: ['症状', '水肿', '气短', '憋醒'], t: '下肢水肿、运动后气短、餐后困倦、夜间憋醒可能是心衰或代谢异常的预警信号。出现这些情况请尽快就医，不要仅依赖记录。' },
    { k: ['用药', '服药', '漏服'], t: '用药依从性记录包括是否按时服药、是否漏服、是否出现不良反应。任何药物调整都应由医生决定，不要自行停药。' },
    { k: ['积分'], t: '在用户广场监督发布者打卡，每次可获得 1 积分；积分在个人中心汇总，可用于兑换农小禾慧选中的产品。' },
    { k: ['兑换'], t: '积分兑换在个人中心购物车完成。兑换前请确认积分余额，兑换后余额会相应扣减。' },
    { k: ['燕麦'], t: '燕麦富含可溶性膳食纤维（β-葡聚糖），有助于增加饱腹感和平稳餐后血糖；适合替代精制主食，仍需控制总量。' },
    { k: ['鸡胸'], t: '鸡胸肉提供高蛋白低脂肪，适合增肌与减脂期的蛋白质来源。蛋白质摄入应分摊到各餐，并搭配蔬菜与主食。' },
    { k: ['酸奶'], t: '无糖希腊酸奶蛋白质较高、糖较低，可作为加餐；肠道不适者应从少量开始尝试。' },
    { k: ['鱼油'], t: '鱼油中的 EPA/DHA 与心血管和认知健康相关。正在服用抗凝药、手术前或过敏者应先咨询医生。' },
    { k: ['蛋白粉', '乳清'], t: '乳清蛋白粉用于补足日常蛋白质缺口，不能替代均衡饮食。肾功能异常者使用前请咨询医生。' },
    { k: ['南瓜籽', '镁'], t: '南瓜籽富含镁与锌，镁参与神经肌肉放松。坚果种子热量较高，建议每日一小把。' },
    { k: ['钙', '奶粉'], t: '钙与维生素D对骨量维持重要；高钙低脂奶粉可作为补充，但总量需结合日常饮食，肾结石病史者请咨询医生。' },
    { k: ['纤维', '车前子'], t: '洋车前子壳粉是可溶性膳食纤维，需配合足量饮水，否则可能引起腹胀；服药人群建议与药物间隔服用。' },
    { k: ['蓝莓', '花青素'], t: '蓝莓花青素属于抗氧化成分，可作为果蔬摄入的补充，但不能替代均衡饮食或治疗。' },
    { k: ['坚果'], t: '无盐混合坚果提供不饱和脂肪酸，适合控盐人群；但能量密度高，每日一小把即可。' }
  ];

  function ask(question, user, products) {
    var q = (question || '').toLowerCase();
    var hit = null;
    for (var i = 0; i < KB.length; i++) {
      var keys = KB[i].k;
      for (var j = 0; j < keys.length; j++) {
        if (q.indexOf(keys[j].toLowerCase()) >= 0) { hit = KB[i]; break; }
      }
      if (hit) break;
    }
    if (!hit) {
      var rec = recommend(user, products || []);
      var names = rec.map(function (r) { return r.product.name; }).join('、');
      return '我可以回答各项健康指标的含义，以及产品营养成分与身体状况的关联。你可以试着问“体脂率怎么看”“小腿围低于多少要警惕”“鱼油和什么有关”。' +
        (names ? ' 根据你的档案，当前较匹配的产品是：' + names + '。' : '') + ' 所有回答仅供记录参考，不构成医疗诊断。';
    }
    return hit.t + ' 以上为一般性健康知识，不替代医生诊断；如有不适请及时就医。';
  }

  window.ENGINE = {
    LEVELS: LEVELS, clamp: clamp, num: num, verdict: verdict,
    scoreBalance: scoreBalance, scoreCalf: scoreCalf, scoreBreath: scoreBreath,
    scoreReach: scoreReach, scoreSitStand: scoreSitStand, scoreCognition: scoreCognition,
    scoreAll: scoreAll, progressScore: progressScore, bmi: bmi, bmr: bmr,
    recommend: recommend, makePlan: makePlan, ask: ask
  };
})();
