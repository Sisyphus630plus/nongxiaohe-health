/* 农小禾健康 · 计算引擎
 * BMR / TDEE / 目标热量 / 宏量营养素 / 预算配餐 / 一周训练安排 / 商品推荐
 * 全部为纯函数，便于前端直接调用与自检。
 */
window.NXH_ENGINE = (function () {
  const D = window.NXH_DATA;
  const NO_PICK = ['ham', 'honey', 'pickle', 'congee', 'cheese']; // 不参与自动配餐（加工肉/纯糖/腌制品/高GI/高脂奶酪）
  const r1 = (n) => Math.round(n * 10) / 10;
  const r0 = (n) => Math.round(n);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function tierFactor(tierId) {
    const t = D.CITY_TIERS.find((x) => x.id === tierId);
    return t ? t.factor : 1;
  }

  /* ---------------- 基础代谢 ---------------- */
  function bmr(profile) {
    const { gender, age, height, weight } = profile;
    const base = 10 * weight + 6.25 * height - 5 * age;
    return Math.round(gender === 'male' ? base + 5 : base - 161);
  }

  function activityFactor(profile) {
    const days = profile.trainDays || 3;
    const level = profile.activity;
    if (level === 'sedentary') return 1.2;
    if (level === 'light') return 1.375;
    if (level === 'moderate') return 1.55;
    if (level === 'high') return 1.725;
    // 未填活动量时用每周运动天数估算
    if (days <= 1) return 1.2;
    if (days <= 3) return 1.375;
    if (days <= 5) return 1.55;
    return 1.725;
  }

  function tdee(profile) {
    return Math.round(bmr(profile) * activityFactor(profile));
  }

  function targetCalories(profile) {
    const t = tdee(profile);
    const floor = profile.gender === 'male' ? 1500 : 1200;
    const g = profile.goal;
    let target = t;
    if (g === 'fatloss') target = t - 400;
    else if (g === 'muscle') target = t + 250;
    else if (g === 'elder') target = t - 100;
    else if (g === 'chronic') target = t - 150;
    return { value: Math.max(floor, Math.round(target / 10) * 10), tdee: t, floor, deficit: t - Math.max(floor, Math.round(target / 10) * 10) };
  }

  function macros(profile, kcal) {
    const g = profile.goal;
    const perKg = g === 'fatloss' ? 1.6 : g === 'muscle' ? 1.8 : g === 'elder' ? 1.2 : g === 'chronic' ? 1.2 : 1.3;
    let protein = Math.round(profile.weight * perKg);
    let fat = Math.round((kcal * 0.27) / 9);
    let carb = Math.round((kcal - protein * 4 - fat * 9) / 4);
    if (carb < 60) { carb = 60; fat = Math.max(30, Math.round((kcal - protein * 4 - carb * 4) / 9)); }
    return { protein, fat, carb };
  }

  function bmi(weight, height) {
    const h = height / 100;
    const v = weight / (h * h);
    let label = '正常';
    if (v < 18.5) label = '偏瘦';
    else if (v < 24) label = '正常';
    else if (v < 28) label = '超重';
    else label = '肥胖';
    return { value: Math.round(v * 10) / 10, label };
  }

  /* ---------------- 硬性过滤 ---------------- */
  function buildFilters(profile) {
    const avoid = new Set(profile.avoid || []);
    const chronic = new Set(profile.chronic || []);
    const diet = new Set(profile.dietModes || []);
    return function allow(food) {
      const f = food.f_ || {};
      for (const a of avoid) if (f[a]) return false;
      if (diet.has('素食') && (f.meat || f.fish || f.seafood)) return false;
      if (diet.has('清真') && f.pork) return false;
      if (chronic.has('痛风/高尿酸') && f.purine) return false;
      if (chronic.has('高血压') && f.sodium) return false;
      if (chronic.has('糖尿病') && f.sugar) return false;
      return true;
    };
  }

  function allowedFoods(profile) {
    const allow = buildFilters(profile);
    return D.FOODS.filter(allow);
  }

  /* ---------------- 预算配餐 ---------------- */
  const STAPLE_BY_GOAL = {
    fatloss: ['sweet_potato', 'brown_rice', 'corn', 'oats', 'potato'],
    muscle: ['rice', 'brown_rice', 'whole_bun', 'buckwheat', 'oats'],
    keep: ['brown_rice', 'rice', 'sweet_potato', 'buckwheat', 'millet'],
    elder: ['millet', 'sweet_potato', 'rice', 'oats', 'potato'],
    chronic: ['brown_rice', 'buckwheat', 'oats', 'millet', 'sweet_potato'],
  };
  const VEG_POOL = ['broccoli', 'spinach', 'lettuce', 'tomato', 'cucumber', 'carrot', 'mushroom', 'radish', 'pepper', 'bean'];
  const FRUIT_POOL = ['apple', 'banana', 'blueberry', 'orange', 'kiwi'];

  function pickProtein(pool, budgetForProtein, tier, offset) {
    const cands = pool
      .filter((f) => f.group === 'protein' && !NO_PICK.includes(f.id))
      .sort((a, b) => b.price - a.price);
    // 只在该预算买得起的蛋白里挑，且优先贵的（营养密度更高）；同档内按日期轮换
    const affordable = cands.filter((f) => 1.2 * f.price * tier <= budgetForProtein);
    if (!affordable.length) return cands[cands.length - 1] || pool[0];
    const top = affordable.slice(0, 3);
    return top[offset % top.length];
  }

  function pickStaple(pool, profile) {
    const list = (STAPLE_BY_GOAL[profile.goal] || STAPLE_BY_GOAL.keep);
    for (const id of list) {
      const f = pool.find((x) => x.id === id);
      if (f) return f;
    }
    return pool.find((x) => x.group === 'staple') || pool[0];
  }

  function costOf(food, grams, tier) {
    return (grams / 100) * food.price * tier;
  }

  /**
   * 生成一餐
   * @param {object} ctx {profile, pool, tier, mealKcal, mealBudget, dayIdx, mealType}
   */
  function composeMeal(ctx) {
    const { profile, pool, tier, mealKcal, mealBudget, dayIdx, mealType } = ctx;
    const proteinNeed = (ctx.dailyProtein || 90) * (mealType === 'breakfast' ? 0.24 : mealType === 'lunch' ? 0.34 : mealType === 'dinner' ? 0.3 : 0.12);
    const offset = dayIdx + (mealType === 'lunch' ? 1 : mealType === 'dinner' ? 2 : 0);
    // 早餐优先蛋奶豆，避免一早吃鱼吃肉
    const breakfastIds = ['egg', 'milk', 'yogurt', 'soymilk', 'cheese', 'tofu'];
    const bPool = pool.filter((f) => breakfastIds.includes(f.id));
    const proteinPool = mealType === 'breakfast' && bPool.length ? bPool : pool;
    let protein = pickProtein(proteinPool, mealBudget * 0.48, tier, offset);
    let pGrams = clamp(Math.round((proteinNeed / (protein.p / 100)) / 5) * 5, 50, 220);

    const staple = (function () {
      if (mealType === 'breakfast') {
        for (const id of ['oats', 'whole_toast', 'whole_bun', 'corn', 'sweet_potato']) {
          const f = pool.find((x) => x.id === id);
          if (f) return f;
        }
      }
      return pickStaple(pool, profile);
    })();
    const vegs = VEG_POOL.filter((id) => pool.some((f) => f.id === id));
    const veg1 = pool.find((f) => f.id === vegs[offset % Math.max(1, vegs.length)]) || null;
    const veg2 = mealType === 'lunch' || mealType === 'dinner' ? pool.find((f) => f.id === vegs[(offset + 3) % Math.max(1, vegs.length)]) : null;
    const oil = pool.find((f) => f.id === 'olive_oil');

    let veg1G = mealType === 'breakfast' ? 0 : 150;
    let veg2G = mealType === 'breakfast' ? 0 : 100;
    let oilG = 5;

    const items = [];
    const pushItem = (food, grams, label) => {
      if (!food || grams <= 0) return;
      items.push({
        id: food.id,
        name: food.name,
        emoji: food.emoji,
        grams: Math.round(grams),
        kcal: Math.round((food.kcal * grams) / 100),
        protein: r1(((food.p || 0) * grams) / 100),
        cost: r1(costOf(food, grams, tier)),
        label,
      });
    };

    const kcalFixed = protein.kcal * (pGrams / 100) + (veg1 ? veg1.kcal * (veg1G / 100) : 0) + (veg2 ? veg2.kcal * (veg2G / 100) : 0) + (oil ? oil.kcal * (oilG / 100) : 0);
    let sGrams = Math.round(clamp((mealKcal - kcalFixed) / (staple.kcal / 100), 25, 260) / 5) * 5;

    const computeCost = () => {
      let c = costOf(protein, pGrams, tier);
      c += costOf(staple, sGrams, tier);
      if (veg1) c += costOf(veg1, veg1G, tier);
      if (veg2) c += costOf(veg2, veg2G, tier);
      if (oil) c += costOf(oil, oilG, tier);
      return c;
    };

    let cost = computeCost();
    // 超预算：先降蛋白质克重，再压缩主食/蔬菜，最后去掉次要食材
    let guard = 0;
    while (cost > mealBudget && guard < 22) {
      guard++;
      if (pGrams > 70) pGrams -= 10;
      else if (sGrams > 40) sGrams -= 10;
      else if (veg1G > 90) veg1G -= 20;
      else if (veg2G > 0) veg2G = 0;
      else if (oilG > 0) oilG = 0;
      else break;
      cost = computeCost();
    }
    if (cost > mealBudget) {
      const cheaper = proteinPool
        .filter((f) => f.group === 'protein' && !NO_PICK.includes(f.id) && f.price < protein.price)
        .sort((a, b) => a.price - b.price)[0];
      if (cheaper) {
        protein = cheaper;
        pGrams = clamp(Math.round((proteinNeed / (protein.p / 100)) / 5) * 5, 60, 200);
        sGrams = Math.round(clamp((mealKcal - protein.kcal * (pGrams / 100) - (veg1 ? veg1.kcal * veg1G / 100 : 0)) / (staple.kcal / 100), 25, 260) / 5) * 5;
        cost = computeCost();
      }
    }
    // 仍然超预算时整体缩量（保证最低份量）
    if (cost > mealBudget) {
      const factor = Math.max(0.55, (mealBudget / cost) * 0.97);
      pGrams = Math.max(50, Math.round((pGrams * factor) / 5) * 5);
      sGrams = Math.max(20, Math.round((sGrams * factor) / 5) * 5);
      if (veg1G) veg1G = Math.max(80, Math.round((veg1G * factor) / 10) * 10);
      if (veg2G) veg2G = Math.max(60, Math.round((veg2G * factor) / 10) * 10);
      cost = computeCost();
    }

    pushItem(protein, pGrams, '蛋白质');
    pushItem(staple, sGrams, '主食');
    pushItem(veg1, veg1G, '蔬菜');
    pushItem(veg2, veg2G, '蔬菜');
    pushItem(oil, oilG, '油脂');

    return {
      items,
      kcal: items.reduce((a, b) => a + b.kcal, 0),
      protein: r1(items.reduce((a, b) => a + b.protein, 0)),
      cost: r1(cost),
      budget: mealBudget,
      label: { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[mealType],
    };
  }

  function composeSnack(ctx) {
    const { pool, tier, mealKcal, mealBudget, dayIdx } = ctx;
    const fruits = FRUIT_POOL.filter((id) => pool.some((f) => f.id === id));
    const fruit = pool.find((f) => f.id === fruits[dayIdx % Math.max(1, fruits.length)]) || pool.find((f) => f.group === 'fruit');
    const dairy = pool.find((f) => f.id === 'yogurt') || pool.find((f) => f.id === 'milk') || pool.find((f) => f.id === 'soymilk');
    const nut = pool.find((f) => f.id === 'walnut') || pool.find((f) => f.id === 'peanut');
    const items = [];
    if (fruit) {
      const byKcal = mealKcal / (fruit.kcal / 100);
      const byBudget = (mealBudget * 0.7) / (fruit.price * tier) * 100;
      const grams = Math.max(50, Math.round(Math.min(220, byKcal, byBudget) / 10) * 10);
      items.push({ id: fruit.id, name: fruit.name, emoji: fruit.emoji, grams, kcal: Math.round(fruit.kcal * grams / 100), protein: r1(fruit.p * grams / 100), cost: r1(costOf(fruit, grams, tier)), label: '水果' });
    }
    if (dairy) {
      const g = dairy.id === 'soymilk' || dairy.id === 'milk' ? 200 : 100;
      const c = costOf(dairy, g, tier);
      if (c <= mealBudget * 0.45) items.push({ id: dairy.id, name: dairy.name, emoji: dairy.emoji, grams: g, kcal: Math.round(dairy.kcal * g / 100), protein: r1(dairy.p * g / 100), cost: r1(c), label: '奶类' });
    }
    if (nut && costOf(nut, 15, tier) <= mealBudget * 0.3) {
      items.push({ id: nut.id, name: nut.name, emoji: nut.emoji, grams: 15, kcal: Math.round(nut.kcal * 15 / 100), protein: r1(nut.p * 15 / 100), cost: r1(costOf(nut, 15, tier)), label: '坚果' });
    }
    // 加餐热量控制在目标附近：先减坚果，再减奶，最后缩水果
    let kcalSum = items.reduce((a, b) => a + b.kcal, 0);
    while (kcalSum > mealKcal * 1.18 && items.length > 1) {
      const removed = items.pop();
      kcalSum -= removed.kcal;
    }
    if (kcalSum > mealKcal * 1.18 && items.length === 1) {
      const it = items[0];
      const oldG = it.grams || 1;
      const target = Math.max(60, Math.round((oldG * (mealKcal / kcalSum) * 0.95) / 10) * 10);
      it.kcal = Math.round((it.kcal / oldG) * target);
      it.cost = r1((it.cost / oldG) * target);
      it.protein = r1((it.protein / oldG) * target);
      it.grams = target;
      kcalSum = it.kcal;
    }
    // 兜底：加餐花费不超过加餐预算
    let total = items.reduce((a, b) => a + b.cost, 0);
    while (total > mealBudget && items.length > 1) {
      items.pop();
      total = items.reduce((a, b) => a + b.cost, 0);
    }
    if (total > mealBudget && items.length === 1) {
      const it = items[0];
      const oldGrams = it.grams || 1;
      const kcalPer = it.kcal / oldGrams;
      const costPer = it.cost / oldGrams;
      const scale = Math.max(40, Math.round((oldGrams * (mealBudget / total) * 0.95) / 10) * 10);
      it.grams = scale;
      it.kcal = Math.round(kcalPer * scale);
      it.cost = r1(costPer * scale);
      total = items.reduce((a, b) => a + b.cost, 0);
    }
    return { items, kcal: items.reduce((a, b) => a + b.kcal, 0), protein: r1(items.reduce((a, b) => a + b.protein, 0)), cost: r1(total), budget: mealBudget, label: '加餐' };
  }

  function buildDay(profile, dayIdx) {
    const tier = tierFactor(profile.cityTier || 't2');
    const pool = allowedFoods(profile);
    const cal = targetCalories(profile).value;
    const macro = macros(profile, cal);
    const perMeal = profile.mealBudget || 25;
    const dailyBudget = Math.round(perMeal * 3);
    const split = [['breakfast', 0.26, 0.22], ['lunch', 0.35, 0.36], ['dinner', 0.30, 0.32], ['snack', 0.09, 0.10]];
    const meals = split.map(([type, kr, br]) => {
      const ctx = { profile, pool, tier, mealKcal: cal * kr, mealBudget: dailyBudget * br, dayIdx, mealType: type, dailyProtein: macro.protein };
      return type === 'snack' ? composeSnack(ctx) : composeMeal(ctx);
    });
    const total = {
      kcal: meals.reduce((a, m) => a + m.kcal, 0),
      protein: r1(meals.reduce((a, m) => a + m.protein, 0)),
      cost: r1(meals.reduce((a, m) => a + m.cost, 0)),
      carb: macro.carb,
      fat: macro.fat,
      budget: dailyBudget,
    };
    return { dayIdx, meals, total, tier, pool: pool.map((f) => f.name) };
  }

  function buildWeek(profile, days) {
    const n = days || 7;
    return Array.from({ length: n }, (_, i) => buildDay(profile, i));
  }

  /* ---------------- 运动计划 ---------------- */
  function equipmentKey(profile) {
    const eq = profile.equip || [];
    if (eq.includes('gym')) return 'gym';
    if (eq.includes('small')) return 'small';
    if (eq.includes('outdoor')) return 'outdoor';
    return 'home';
  }

  function buildWorkout(profile) {
    const E = D.EXERCISES;
    const days = clamp(profile.trainDays || 3, 1, 6);
    const minutes = profile.sessionMin || 40;
    const elder = !!profile.elder || profile.goal === 'elder';
    const key = elder ? 'elder' : equipmentKey(profile);
    const lib = E[key] || E.home;
    const strength = lib.filter((x) => x.type === 'strength');
    const cardio = lib.filter((x) => x.type === 'cardio');
    const mobility = lib.filter((x) => x.type === 'mobility');
    const goal = profile.goal || 'keep';

    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const idxMap = days === 1 ? [2] : days === 2 ? [1, 4] : days === 3 ? [0, 2, 4] : days === 4 ? [0, 1, 3, 5] : days === 5 ? [0, 1, 2, 4, 5] : [0, 1, 2, 3, 4, 5];

    const plan = dayNames.map((d, i) => ({ day: d, rest: true, title: '休息 / 轻活动', blocks: [], duration: 0, focus: '恢复' }));

    idxMap.forEach((di, n) => {
      const focusPool = elder
        ? ['平衡与柔韧', '下肢力量', '上肢舒展'][n % 3]
        : goal === 'muscle'
          ? ['下肢', '上肢推', '上肢拉', '核心 + 有氧'][n % 4]
          : ['全身循环', '核心 + 有氧', '下肢与臀', '上肢与背'][n % 4];
      const blocks = [];
      const s = strength.length ? strength : lib;
      const c = cardio.length ? cardio : lib;
      const m = mobility.length ? mobility : [{ name: '训练后拉伸', tip: '大腿前侧、臀部、肩背各拉伸 30 秒', type: 'mobility', sets: '8 分钟' }];

      if (elder) {
        blocks.push({ ...c[n % c.length], note: '心率以能正常说话为准' });
        blocks.push({ ...s[n % s.length] });
        blocks.push({ ...m[n % m.length] });
      } else if (goal === 'muscle') {
        blocks.push({ ...s[(n * 2) % s.length] });
        blocks.push({ ...s[(n * 2 + 1) % s.length] });
        blocks.push({ ...s[(n * 2 + 2) % s.length] });
        blocks.push({ ...c[n % c.length], note: '训练后 10 分钟轻松有氧收尾' });
      } else if (goal === 'fatloss') {
        blocks.push({ ...s[n % s.length] });
        blocks.push({ ...s[(n + 3) % s.length] });
        blocks.push({ ...c[n % c.length], note: minutes >= 45 ? '保持能说短句的强度' : '强度略高，间歇 30 秒' });
        blocks.push({ ...m[n % m.length] });
      } else if (goal === 'chronic') {
        blocks.push({ ...c[n % c.length], note: '饭后 30 分钟开始更稳' });
        blocks.push({ ...s[n % s.length], sets: (s[n % s.length].sets || '').replace(/\d+ 组/, '2 组') });
        blocks.push({ ...m[n % m.length] });
      } else {
        blocks.push({ ...s[n % s.length] });
        blocks.push({ ...c[n % c.length] });
        blocks.push({ ...m[n % m.length] });
      }

      const duration = elder ? Math.min(30, Math.max(15, minutes)) : minutes;
      const seen = new Set();
      let uniq = blocks.filter((b) => {
        if (!b || !b.name || seen.has(b.name)) return false;
        seen.add(b.name);
        return true;
      });
      if (uniq.length < 3) uniq = uniq.concat([{ name: '训练后拉伸', tip: '大腿前侧、臀部、肩背各拉伸 30 秒', type: 'mobility', sets: '8 分钟' }]);
      plan[di] = {
        day: dayNames[di],
        rest: false,
        title: elder ? '低强度养生训练' : goal === 'muscle' ? '力量训练日' : goal === 'fatloss' ? '燃脂循环日' : '全身活力日',
        blocks: uniq.slice(0, elder ? 3 : 4),
        duration,
        focus: focusPool,
      };
    });
    return plan;
  }

  /* ---------------- 方案整合 ---------------- */
  function buildPlan(profile) {
    const cal = targetCalories(profile);
    const macro = macros(profile, cal.value);
    const week = buildWeek(profile, 7);
    const workout = buildWorkout(profile);
    const b = bmr(profile);
    const t = tdee(profile);
    return {
      createdAt: Date.now(),
      profile: JSON.parse(JSON.stringify(profile)),
      bmr: b,
      tdee: t,
      target: cal.value,
      floor: cal.floor,
      macros: macro,
      week,
      workout,
      bmi: bmi(profile.weight, profile.height),
      avgCost: r1(week.reduce((a, d) => a + d.total.cost, 0) / week.length),
      dailyBudget: Math.round((profile.mealBudget || 25) * 3),
    };
  }

  /* ---------------- 商品推荐 ---------------- */
  function recommendProducts(profile, products, limit) {
    const tags = new Set();
    const goal = profile.goal;
    if (goal === 'fatloss') ['低脂', '低GI', '蛋白', '高纤维'].forEach((t) => tags.add(t));
    if (goal === 'muscle') ['蛋白', '健身', '主食'].forEach((t) => tags.add(t));
    if (goal === 'elder') ['杂粮', '蜂蜜', '坚果', '长辈'].forEach((t) => tags.add(t));
    if (goal === 'chronic') ['低GI', '控糖', '高纤维', '心血管'].forEach((t) => tags.add(t));
    if ((profile.chronic || []).includes('高血压')) tags.add('低盐');
    if ((profile.dietModes || []).includes('素食')) tags.add('蔬菜');
    const list = (products || []).filter((p) => p.status !== 0).map((p) => {
      let score = 0;
      (p.tags || []).forEach((t) => { if (tags.has(t)) score += 2; });
      if (goal === 'elder' && (p.tags || []).includes('礼盒')) score += 1;
      if ((profile.avoid || []).includes('nut') && (p.tags || []).includes('坚果')) score -= 5;
      if ((profile.avoid || []).includes('egg') && (p.tags || []).includes('蛋类')) score -= 5;
      return { ...p, score };
    });
    return list.sort((a, b) => b.score - a.score).slice(0, limit || 3);
  }

  function levelOf(points) {
    const p = points || 0;
    if (p >= 3000) return { name: '丰收', next: null, pct: 100, icon: '◆ ' };
    if (p >= 1500) return { name: '麦穗', next: 3000, pct: Math.round((p / 3000) * 100), icon: '◆ ' };
    if (p >= 600) return { name: '青禾', next: 1500, pct: Math.round((p / 1500) * 100), icon: '◆ ' };
    return { name: '新芽', next: 600, pct: Math.round((p / 600) * 100), icon: '◆ ' };
  }

  return { bmr, tdee, targetCalories, macros, bmi, buildFilters, allowedFoods, buildDay, buildWeek, buildPlan, buildWorkout, recommendProducts, levelOf, tierFactor, composeMeal };
})();
