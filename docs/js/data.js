/* 农小禾健康 · 基础数据层
 * 1) 三档城市食材参考价位表（约 48 种，标注为参考价·仅供估算）
 * 2) 农小禾慧选 商品种子数据
 * 3) 运动动作库
 * 4) 用户广场种子动态
 * 5) 隐私政策 / 免责声明全文
 */
window.NXH_DATA = (function () {
  const CITY_TIERS = [
    { id: 't1', name: '一线城市', factor: 1.35, desc: '北上广深' },
    { id: 't2', name: '二线城市', factor: 1.0, desc: '省会及计划单列市' },
    { id: 't3', name: '三线及以下', factor: 0.82, desc: '地级市 / 县域' },
  ];

  /* ---------- 食材价位表：price 为二线城市每 100g 参考价（元） ---------- */
  const FOODS = [
    // 蛋白质类
    { id: 'egg', name: '鸡蛋', emoji: '🥚', kcal: 155, p: 13, c: 1.1, f: 10.6, price: 2.4, unit: '1 个约 50g', group: 'protein', f_: { egg: 1 } },
    { id: 'chicken_breast', name: '鸡胸肉', emoji: '🍗', kcal: 133, p: 31, c: 0, f: 5, price: 6.8, unit: '100g', group: 'protein', f_: { meat: 1 } },
    { id: 'chicken_leg', name: '鸡腿肉', emoji: '🍗', kcal: 181, p: 16, c: 0, f: 13, price: 3.6, unit: '100g', group: 'protein', f_: { meat: 1 } },
    { id: 'pork_loin', name: '猪里脊', emoji: '🥩', kcal: 143, p: 20.3, c: 1.5, f: 6.2, price: 5.6, unit: '100g', group: 'protein', f_: { meat: 1, pork: 1 } },
    { id: 'beef_shank', name: '牛腱子', emoji: '🥩', kcal: 106, p: 20.2, c: 1.2, f: 2.3, price: 9.2, unit: '100g', group: 'protein', f_: { meat: 1, beef: 1 } },
    { id: 'grass_carp', name: '草鱼', emoji: '🐟', kcal: 113, p: 16.6, c: 0, f: 5.2, price: 3.4, unit: '100g', group: 'protein', f_: { fish: 1 } },
    { id: 'seabass', name: '鲈鱼', emoji: '🐟', kcal: 105, p: 18.6, c: 0, f: 3.4, price: 7.8, unit: '100g', group: 'protein', f_: { fish: 1 } },
    { id: 'salmon', name: '三文鱼', emoji: '🍣', kcal: 139, p: 20.4, c: 0, f: 7.9, price: 18, unit: '100g', group: 'protein', f_: { fish: 1, purine: 1 } },
    { id: 'shrimp', name: '基围虾', emoji: '🦐', kcal: 101, p: 18.2, c: 2.8, f: 1.4, price: 11, unit: '100g', group: 'protein', f_: { seafood: 1, purine: 1 } },
    { id: 'tofu', name: '北豆腐', emoji: '🧊', kcal: 116, p: 12.2, c: 3, f: 6.9, price: 2.8, unit: '100g', group: 'protein', f_: { soy: 1 } },
    { id: 'dougan', name: '豆干', emoji: '🟫', kcal: 140, p: 16.2, c: 6, f: 6.6, price: 3.4, unit: '100g', group: 'protein', f_: { soy: 1 } },
    { id: 'yogurt', name: '无糖酸奶', emoji: '🥛', kcal: 63, p: 3.5, c: 5, f: 3.3, price: 3.2, unit: '100g', group: 'protein', f_: { dairy: 1 } },
    { id: 'milk', name: '牛奶', emoji: '🥛', kcal: 54, p: 3, c: 3.4, f: 3.2, price: 1.4, unit: '100ml', group: 'protein', f_: { dairy: 1 } },
    { id: 'ham', name: '火腿肠', emoji: '🌭', kcal: 212, p: 14, c: 15.6, f: 10.4, price: 4, unit: '100g', group: 'protein', f_: { meat: 1, pork: 1, sodium: 1, purine: 1 } },
    // 主食类
    { id: 'rice', name: '大米', emoji: '🍚', kcal: 346, p: 7.4, c: 77, f: 0.8, price: 0.65, unit: '100g 生重', group: 'staple', f_: {} },
    { id: 'brown_rice', name: '糙米', emoji: '🌾', kcal: 348, p: 7.7, c: 75, f: 2.7, price: 1.5, unit: '100g 生重', group: 'staple', f_: {} },
    { id: 'oats', name: '燕麦片', emoji: '🥣', kcal: 377, p: 15, c: 66, f: 6.7, price: 2.4, unit: '100g', group: 'staple', f_: { gluten: 1 } },
    { id: 'whole_bun', name: '全麦馒头', emoji: '🍞', kcal: 223, p: 7, c: 44, f: 1.6, price: 1.9, unit: '100g', group: 'staple', f_: { gluten: 1 } },
    { id: 'buckwheat', name: '荞麦面', emoji: '🍜', kcal: 340, p: 11, c: 70, f: 2, price: 2.2, unit: '100g 生重', group: 'staple', f_: { gluten: 1 } },
    { id: 'whole_toast', name: '全麦吐司', emoji: '🍞', kcal: 246, p: 9, c: 46, f: 3.3, price: 2.6, unit: '100g', group: 'staple', f_: { gluten: 1 } },
    { id: 'sweet_potato', name: '红薯', emoji: '🍠', kcal: 86, p: 1.6, c: 20, f: 0.1, price: 1, unit: '100g', group: 'staple', f_: {} },
    { id: 'corn', name: '玉米', emoji: '🌽', kcal: 112, p: 4, c: 22, f: 1.2, price: 2, unit: '1 根约 200g', group: 'staple', f_: {} },
    { id: 'potato', name: '土豆', emoji: '🥔', kcal: 77, p: 2, c: 17, f: 0.1, price: 0.8, unit: '100g', group: 'staple', f_: {} },
    { id: 'millet', name: '小米', emoji: '🌾', kcal: 358, p: 9, c: 75, f: 3.1, price: 1.8, unit: '100g 生重', group: 'staple', f_: {} },
    { id: 'congee', name: '白粥', emoji: '🥣', kcal: 46, p: 1.1, c: 9.9, f: 0.2, price: 0.4, unit: '100g', group: 'staple', f_: { sugar: 1 } },
    // 蔬菜类
    { id: 'broccoli', name: '西兰花', emoji: '🥦', kcal: 36, p: 4.1, c: 4.3, f: 0.6, price: 1.4, unit: '100g', group: 'veg', f_: {} },
    { id: 'spinach', name: '菠菜', emoji: '🥬', kcal: 28, p: 2.6, c: 2.8, f: 0.3, price: 0.9, unit: '100g', group: 'veg', f_: {} },
    { id: 'lettuce', name: '生菜', emoji: '🥬', kcal: 15, p: 1.4, c: 2.1, f: 0.2, price: 0.7, unit: '100g', group: 'veg', f_: {} },
    { id: 'tomato', name: '番茄', emoji: '🍅', kcal: 20, p: 0.9, c: 3.5, f: 0.2, price: 0.7, unit: '100g', group: 'veg', f_: {} },
    { id: 'cucumber', name: '黄瓜', emoji: '🥒', kcal: 16, p: 0.8, c: 2.9, f: 0.2, price: 0.6, unit: '100g', group: 'veg', f_: {} },
    { id: 'carrot', name: '胡萝卜', emoji: '🥕', kcal: 39, p: 1, c: 8.8, f: 0.2, price: 0.6, unit: '100g', group: 'veg', f_: {} },
    { id: 'mushroom', name: '香菇', emoji: '🍄', kcal: 26, p: 2.2, c: 5.2, f: 0.3, price: 1.4, unit: '100g', group: 'veg', f_: {} },
    { id: 'radish', name: '白萝卜', emoji: '🥗', kcal: 21, p: 0.9, c: 4, f: 0.1, price: 0.5, unit: '100g', group: 'veg', f_: {} },
    { id: 'pepper', name: '青椒', emoji: '🫑', kcal: 22, p: 1, c: 5.4, f: 0.2, price: 0.9, unit: '100g', group: 'veg', f_: {} },
    { id: 'bean', name: '四季豆', emoji: '🫛', kcal: 31, p: 2, c: 7, f: 0.4, price: 1.1, unit: '100g', group: 'veg', f_: {} },
    { id: 'pickle', name: '榨菜', emoji: '🥬', kcal: 29, p: 1.3, c: 5, f: 0.2, price: 0.8, unit: '100g', group: 'veg', f_: { sodium: 1 } },
    // 水果 / 坚果 / 油脂
    { id: 'apple', name: '苹果', emoji: '🍎', kcal: 53, p: 0.4, c: 13.7, f: 0.2, price: 0.9, unit: '1 个约 200g', group: 'fruit', f_: {} },
    { id: 'banana', name: '香蕉', emoji: '🍌', kcal: 93, p: 1.4, c: 22, f: 0.2, price: 0.6, unit: '1 根约 120g', group: 'fruit', f_: {} },
    { id: 'blueberry', name: '蓝莓', emoji: '🫐', kcal: 57, p: 0.7, c: 14.5, f: 0.3, price: 5, unit: '100g', group: 'fruit', f_: {} },
    { id: 'orange', name: '橙子', emoji: '🍊', kcal: 48, p: 0.9, c: 11.8, f: 0.1, price: 0.9, unit: '1 个约 200g', group: 'fruit', f_: {} },
    { id: 'kiwi', name: '猕猴桃', emoji: '🥝', kcal: 61, p: 1.1, c: 14.5, f: 0.5, price: 1.3, unit: '100g', group: 'fruit', f_: {} },
    { id: 'walnut', name: '核桃仁', emoji: '🌰', kcal: 646, p: 14.9, c: 19.1, f: 58.8, price: 12, unit: '100g', group: 'fat', f_: { nut: 1 } },
    { id: 'peanut', name: '花生米', emoji: '🥜', kcal: 574, p: 24.8, c: 21.7, f: 44.3, price: 7, unit: '100g', group: 'fat', f_: { peanut: 1 } },
    { id: 'olive_oil', name: '橄榄油', emoji: '🫒', kcal: 899, p: 0, c: 0, f: 99.9, price: 9, unit: '100ml', group: 'fat', f_: {} },
    { id: 'honey', name: '蜂蜜', emoji: '🍯', kcal: 321, p: 0.4, c: 75, f: 1.9, price: 4, unit: '100g', group: 'fat', f_: { sugar: 1 } },
    { id: 'soymilk', name: '无糖豆浆', emoji: '🥛', kcal: 31, p: 3, c: 1.2, f: 1.6, price: 0.8, unit: '100ml', group: 'protein', f_: { soy: 1 } },
    { id: 'cheese', name: '奶酪', emoji: '🧀', kcal: 328, p: 25, c: 3.5, f: 26, price: 10, unit: '100g', group: 'protein', f_: { dairy: 1 } },
  ];

  const AVOID_OPTIONS = [
    { id: 'egg', name: '蛋类' },
    { id: 'dairy', name: '乳制品' },
    { id: 'soy', name: '大豆' },
    { id: 'gluten', name: '麸质/小麦' },
    { id: 'seafood', name: '虾蟹贝' },
    { id: 'fish', name: '鱼类' },
    { id: 'peanut', name: '花生' },
    { id: 'nut', name: '坚果' },
    { id: 'beef', name: '牛肉' },
    { id: 'pork', name: '猪肉' },
  ];

  const DIET_MODES = ['均衡', '地中海', '低GI', '低碳', '高蛋白', '素食', '清真'];
  const CHRONIC = ['高血压', '糖尿病', '高血脂', '痛风/高尿酸'];

  /* ---------- 农小禾慧选 商品 ---------- */
  const PRODUCTS = [
    { id: 'p1', name: '当季有机时蔬箱', price: 69, cat: '时令果蔬', img: '', emoji: '🥬', desc: '6 种当季蔬菜随机搭配，凌晨采摘、当日直发，膳食纤维与维生素一次补齐。', tags: ['时令', '高纤维', '低GI', '蔬菜'], stock: 88, status: 1, spec: '约 3kg / 箱' },
    { id: 'p2', name: '低GI五谷杂粮米', price: 59, cat: '杂粮主食', img: '', emoji: '🌾', desc: '糙米、黑米、燕麦、藜麦科学配比，升糖更平缓，替代白米的主食首选。', tags: ['杂粮', '低GI', '控糖', '主食'], stock: 120, status: 1, spec: '1kg / 袋' },
    { id: 'p3', name: '洋槐蜂蜜', price: 88, cat: '蜂蜜冲饮', img: 'img/honey.jpg', emoji: '🍯', desc: '秦岭洋槐花期单采，低温灌装，入口清香不齁，替代白糖的温柔甜。', tags: ['蜂蜜', '冲饮', '礼赠', '低加工'], stock: 60, status: 1, spec: '500g / 瓶' },
    { id: 'p4', name: '苹果蜂蜜水', price: 25, cat: '蜂蜜冲饮', img: 'img/applewater.jpg', emoji: '🍎', desc: '苹果汁与洋槐蜜调配，无额外添加蔗糖，下午三点的一杯清醒。', tags: ['冲饮', '低糖', '果味'], stock: 150, status: 1, spec: '300ml × 6 瓶' },
    { id: 'p5', name: '费南雪（6 枚）', price: 45, cat: '健康烘焙', img: 'img/financier.jpg', emoji: '🧁', desc: '杏仁粉与土鸡蛋烘烤，减糖配方，小份量装，嘴馋时的一块刚刚好。', tags: ['烘焙', '减糖', '下午茶'], stock: 40, status: 1, spec: '6 枚 / 盒' },
    { id: 'p6', name: '农小禾健康礼盒', price: 199, cat: '礼盒', img: 'img/giftbox.jpg', emoji: '🎁', desc: '杂粮、蜂蜜、坚果三层组合，送长辈、送同事都体面，附手写祝福卡。', tags: ['礼盒', '送礼', '长辈', '组合装'], stock: 35, status: 1, spec: '3 层 / 盒' },
    { id: 'p7', name: '高山散养土鸡蛋', price: 42, cat: '蛋奶', img: '', emoji: '🥚', desc: '高山散养、谷物喂养，蛋黄饱满，优质蛋白最平价稳定的来源。', tags: ['蛋白', '蛋类', '家常'], stock: 200, status: 1, spec: '30 枚 / 盒' },
    { id: 'p8', name: '每日坚果小包', price: 79, cat: '坚果零食', img: '', emoji: '🌰', desc: '原味烘焙、无盐无糖，每包 25g 定量，加餐时补充好脂肪。', tags: ['坚果', '加餐', '好脂肪'], stock: 90, status: 1, spec: '25g × 20 包' },
    { id: 'p9', name: '冷榨亚麻籽油', price: 98, cat: '粮油调味', img: '', emoji: '🫒', desc: '低温冷榨，富含 α-亚麻酸，凉拌或出锅后淋一勺即可。', tags: ['油脂', '凉拌', '心血管'], stock: 45, status: 1, spec: '500ml / 瓶' },
    { id: 'p10', name: '原味鸡胸肉（即食）', price: 39, cat: '优质蛋白', img: '', emoji: '🍗', desc: '低温慢煮、零添加，每袋 100g 含 23g 蛋白，撕开就能吃。', tags: ['蛋白', '健身', '即食', '低脂'], stock: 110, status: 1, spec: '100g × 5 袋' },
    { id: 'p11', name: '鲜蜂王浆', price: 168, cat: '蜂蜜冲饮', img: '', emoji: '🍯', desc: '春季油菜花期采集，全程冷链，10-HDA 含量标注清晰；口感酸涩微辣，建议小勺含服。', tags: ['蜂王浆', '冷链', '滋补', '礼赠'], stock: 28, status: 1, spec: '250g / 瓶' },
  ];

  /* ---------- 商品补充信息（产地 / 详情 / 视频） ---------- */
  const PRODUCT_EXTRAS = {
    p1: {
      sold: 126, origin: '云南曲靖 · 合作社直采', ship: '每日 16:00 前下单，次日发出',
      detail: '每天清晨五点采摘，按当日成熟度搭配 6 种时令蔬菜：叶菜 2 种、根茎 2 种、瓜果 2 种，装满一箱约 3kg。\n不打蜡、不催熟，叶菜带一点泥，是正常的。收到后建议先吃叶菜，根茎类可冷藏保存一周。\n适合两口之家一周的蔬菜量，也适合想开始自己做饭、又不想每天买菜的人。',
    },
    p2: {
      sold: 208, origin: '黑龙江五常 · 合作农场', ship: '48 小时内发出',
      detail: '糙米、黑米、燕麦米、藜麦、荞麦、高粱米六种粗粮配比，提前浸泡 40 分钟再煮，口感更软。\n和白米按 1:2 混着煮，升糖更平缓，也更容易坚持；血糖偏高的人可以从 1:3 开始。\n1kg 真空袋装，开封后建议冷藏，两个月内吃完。',
    },
    p3: {
      poster: true, sold: 342, origin: '陕西秦岭 · 洋槐花期单采', ship: '48 小时内发出',
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      detail: '只取洋槐花期的头道蜜，低温灌装，不额外加糖也不浓缩，所以天冷时会自然结晶，是正常现象。\n入口清香、甜度柔和，冲水、拌酸奶、抹全麦面包都合适；一岁以内婴儿不建议食用蜂蜜。\n每次一小勺（约 10g）就够，替代白糖更温和，但仍然是糖，控糖人群请计入当日总量。',
    },
    p4: {
      sold: 96, origin: '陕西秦岭 · 自有灌装线', ship: '48 小时内发出',
      detail: '苹果汁与洋槐蜜调配，不额外添加蔗糖，一瓶约 90 千卡。\n下午三点想喝甜的，用它替代奶茶，是更容易坚持的一步。\n冷藏后口感更好；开盖后请当天喝完。',
    },
    p6: {
      poster: true, sold: 58, origin: '农小禾 · 组合装', ship: '48 小时内发出，可附手写祝福卡',
      detail: '三层组合：杂粮两袋、洋槐蜂蜜一瓶、每日坚果十包，装在手提礼盒里。\n送长辈选它不会出错——都是能吃完、不浪费的东西；送礼时可以在备注里写祝福语，我们手写在卡片上。\n企业团购可联系客服定制卡片与logo。',
    },
    p10: {
      sold: 174, origin: '山东 · 合作加工厂', ship: '冷链发出',
      detail: '低温慢煮，不加保水剂，每袋 100g 含约 23g 蛋白质。\n撕开就能吃，也可以切片拌沙拉、夹全麦面包；训练后 30 分钟内吃一袋，是最省事的补蛋白方式。\n冷藏保存，开封后当天吃完。',
    },
    p11: {
      sold: 41, origin: '春季油菜花期 · 全程冷链', ship: '顺丰冷链，48 小时内发出',
      detail: '春季油菜花期采集，全程冷链运输，10-HDA 含量在瓶身标注。\n口感酸涩微辣，建议每天一小勺含服，不要用热水冲。\n蜂王浆需冷冻保存；过敏体质、哮喘人群与儿童食用前请咨询医生。',
    },
  };

  PRODUCTS.forEach((p) => {
    Object.assign(p, { sold: 0, origin: '农小禾合作农场', ship: '48 小时内发出' }, PRODUCT_EXTRAS[p.id] || {});
  });

  /* ---------- 运动动作库 ---------- */
  const EXERCISES = {
    home: [
      { name: '徒手深蹲', tip: '膝盖朝脚尖方向，下蹲到大腿接近平行', type: 'strength', sets: '3 组 × 15 次' },
      { name: '跪姿俯卧撑', tip: '身体成一条直线，肘部向后 45°', type: 'strength', sets: '3 组 × 10 次' },
      { name: '臀桥', tip: '脚跟发力顶髋，顶点停 1 秒', type: 'strength', sets: '3 组 × 15 次' },
      { name: '平板支撑', tip: '收腹夹臀，别塌腰', type: 'strength', sets: '3 组 × 40 秒' },
      { name: '开合跳', tip: '落地轻一点，膝盖微屈缓冲', type: 'cardio', sets: '4 组 × 40 秒' },
      { name: '高抬腿', tip: '上身别后仰，节奏均匀', type: 'cardio', sets: '4 组 × 30 秒' },
      { name: '箭步蹲', tip: '前腿膝盖不内扣，重心在两腿之间', type: 'strength', sets: '3 组 × 12 次/侧' },
      { name: '靠墙静蹲', tip: '背贴墙，大腿与地面约 60°', type: 'strength', sets: '3 组 × 45 秒' },
      { name: '卷腹', tip: '下巴微收，用腹部把肩胛骨带离地面', type: 'strength', sets: '3 组 × 15 次' },
      { name: '登山跑', tip: '肩膀在手腕正上方，核心收紧', type: 'cardio', sets: '4 组 × 30 秒' },
    ],
    small: [
      { name: '哑铃高脚杯深蹲', tip: '双手抱铃于胸前，下蹲时挺胸', type: 'strength', sets: '4 组 × 12 次' },
      { name: '哑铃划船', tip: '肩胛骨先收紧，再拉肘', type: 'strength', sets: '4 组 × 12 次' },
      { name: '哑铃推举', tip: '手腕在肘上方，别耸肩', type: 'strength', sets: '3 组 × 12 次' },
      { name: '哑铃硬拉', tip: '屈髋为主，背部保持中立', type: 'strength', sets: '3 组 × 12 次' },
      { name: '弹力带划船', tip: '肘部贴身，末端停 1 秒', type: 'strength', sets: '3 组 × 15 次' },
      { name: '壶铃摆动', tip: '用髋部发力，不是用手臂抬', type: 'cardio', sets: '4 组 × 20 次' },
      { name: '哑铃箭步蹲', tip: '下蹲时躯干直立，步幅别太小', type: 'strength', sets: '3 组 × 12 次/侧' },
    ],
    gym: [
      { name: '杠铃深蹲', tip: '核心绷紧，蹲到平行或略低', type: 'strength', sets: '4 组 × 8 次' },
      { name: '卧推', tip: '肩胛后收下沉，杠到胸口轻触', type: 'strength', sets: '4 组 × 8 次' },
      { name: '高位下拉', tip: '拉到锁骨附近，别用惯性甩', type: 'strength', sets: '4 组 × 10 次' },
      { name: '坐姿划船', tip: '挺胸，肘贴近身体向后拉', type: 'strength', sets: '4 组 × 12 次' },
      { name: '罗马尼亚硬拉', tip: '屈髋下放，感受大腿后侧拉伸', type: 'strength', sets: '4 组 × 10 次' },
      { name: '腿举', tip: '膝盖不锁死，下放到 90°', type: 'strength', sets: '4 组 × 12 次' },
      { name: '绳索下压', tip: '大臂固定，只动小臂', type: 'strength', sets: '3 组 × 15 次' },
      { name: '跑步机快走', tip: '坡度 4–6，心率控制在能说话的强度', type: 'cardio', sets: '20 分钟' },
    ],
    outdoor: [
      { name: '快走', tip: '步频加快，摆臂自然', type: 'cardio', sets: '30 分钟' },
      { name: '慢跑', tip: '能边跑边说话的速度最合适', type: 'cardio', sets: '25 分钟' },
      { name: '跳绳', tip: '前脚掌落地，膝盖保持弹性', type: 'cardio', sets: '5 组 × 2 分钟' },
      { name: '骑行', tip: '坐垫高度以腿近伸直为宜', type: 'cardio', sets: '40 分钟' },
      { name: '爬坡走', tip: '上坡时身体微前倾，别弓背', type: 'cardio', sets: '20 分钟' },
      { name: '公园器械拉伸', tip: '每个动作保持 20–30 秒', type: 'mobility', sets: '10 分钟' },
    ],
    elder: [
      { name: '饭后散步', tip: '饭后 30 分钟再走，20–30 分钟即可', type: 'cardio', sets: '25 分钟' },
      { name: '太极八式', tip: '动作缓慢均匀，呼吸自然', type: 'mobility', sets: '15 分钟' },
      { name: '弹力带拉伸', tip: '拉到轻微紧绷即可，不憋气', type: 'mobility', sets: '3 组 × 12 次' },
      { name: '坐姿抬腿', tip: '扶稳椅背，抬腿停 2 秒', type: 'strength', sets: '3 组 × 12 次/侧' },
      { name: '靠墙静蹲（轻）', tip: '角度浅一点，膝盖不疼为准', type: 'strength', sets: '3 组 × 20 秒' },
      { name: '肩颈舒缓操', tip: '缓慢绕肩，不猛甩头', type: 'mobility', sets: '8 分钟' },
      { name: '扶椅提踵', tip: '踮脚停 1 秒，练小腿防跌倒', type: 'strength', sets: '3 组 × 15 次' },
    ],
  };

  /* ---------- 用户广场种子动态 ---------- */
  const SEED_POSTS = [
    {
      id: 'seed1',
      authorId: 'demo_u1',
      authorName: '林小满',
      avatar: '🌿',
      title: '减脂第 21 天 · 我的 1500 大卡一日三餐',
      summary: '早餐鸡蛋燕麦碗，午餐鸡胸杂粮饭，晚餐清蒸鲈鱼配西兰花。预算每餐 30 元，一周瘦了 1.6kg，没饿过肚子。',
      goal: '减脂',
      kcal: 1520,
      likes: 42,
      likedBy: [],
      comments: [
        { id: 'c1', userId: 'demo_u2', name: '阿哲', text: '这个搭配看着就好吃，求午餐细节！', time: '2 小时前' },
        { id: 'c2', userId: 'demo_u3', name: '周末', text: '已经跟着吃了三天，胃很舒服。', time: '5 小时前' },
      ],
      time: '今天 08:20',
      seed: true,
    },
    {
      id: 'seed2',
      authorId: 'demo_u4',
      authorName: '陈建国',
      avatar: '🌾',
      title: '给爸爸准备的控三高食谱（少盐版）',
      summary: '爸爸高血压 + 血糖偏高，把咸菜换成凉拌黄瓜，主食一半换成杂粮饭，两周血压记录平稳了一些。',
      goal: '控三高',
      kcal: 1680,
      likes: 67,
      likedBy: [],
      comments: [
        { id: 'c3', userId: 'demo_u5', name: '小舟', text: '收藏了，我妈妈情况差不多。', time: '1 天前' },
      ],
      time: '昨天 19:40',
      seed: true,
    },
    {
      id: 'seed3',
      authorId: 'demo_u6',
      authorName: '苏禾',
      avatar: '🍃',
      title: '长辈模式真好用，奶奶自己会打卡了',
      summary: '字大按钮大，首页只剩吃什么、怎么动、打卡三件事。奶奶现在每天散步完自己点一下，连续 9 天了。',
      goal: '长辈养生',
      kcal: 1750,
      likes: 88,
      likedBy: [],
      comments: [
        { id: 'c4', userId: 'demo_u7', name: '木木', text: '这个功能太需要了，给我妈也开一下。', time: '2 天前' },
      ],
      time: '2 天前',
      seed: true,
    },
  ];

  const PRIVACY = `农小禾健康 · 隐私政策与免责声明
生效日期：2026 年 11 月 22 日　　版本：v2.0
农小禾健康（以下简称"本应用"或"我们"）是一款通过健康问卷、规则算法与人工智能辅助，为用户提供个性化饮食与运动计划的健康管理工具。我们深知健康信息的敏感性，依据《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》等法律法规，制定本政策。

第一部分　隐私政策

一、我们收集哪些信息
1. 账户与身份信息
您登录时填写的手机号。演示版本中验证码在页面内显示，身份通过浏览器本地会话维持；正式环境应通过运营商短信验证码完成验证。
2. 健康档案信息（核心数据）
基础身份：性别、年龄、身高、体重；
健康目标及细化：目标体重、期望周期、减重速度、慢病类型、目标体重等；
运动条件：常用器材/场地、每周可运动天数、单次时长、运动基础、伤病情况；
饮食条件：饮食模式偏好、忌口与过敏原、每日餐数；
经济与场景：城市线级档位、每餐预算。
其中慢病信息、过敏原信息属于敏感个人信息，我们仅在生成方案所必需的范围内处理。
3. 使用记录
打卡记录、体重/饮食/运动记录、连续陪伴天数、AI 对话轮数、心愿单、积分与兑换记录、监督记录、订单与收货信息（收货人、手机号、地址）。
4. 用户生成内容
您在"用户广场"发布的帖子、评论、点赞、举报内容，以及提交给"树洞"的心情文字。
5. 本地存储与云端同步
登录后浏览器本地会缓存一份数据副本，用于断网时继续使用；您的档案、方案、打卡、积分、心愿单、订单等数据会同步至云端数据库，以便换设备登录后恢复。"树洞"内容仅保存在您的设备本机，不上传云端。
我们不收集：精确地理位置、通讯录、相册全量访问、用于广告追踪的设备标识符。拍照按钮为占位功能，不上传照片。

二、我们如何使用您的信息
1. 生成健康方案：计算基础代谢（BMR）、每日总消耗（TDEE）、目标热量与三大营养素，并按预算、忌口与慢病禁忌搭配食材、生成运动计划；
2. 提供陪伴对话："小禾 AI"依据您的健康目标与对话上下文作答；
3. 记录与激励：打卡、连续天数、积分、监督与兑换；
4. 社区功能：展示您主动发布的动态，供其他用户互动；
5. 体验优化：统计对话轮数等数据以改进服务。
6. 我们不会将您的健康信息用于广告推送，也不会出售给第三方。

三、信息共享与第三方
1. 云服务商：您的档案、方案、帖子、心愿单、订单与商品数据存储在 WorkBuddy 云平台数据库中，用于跨设备持久化。管理员上传的商品图片以压缩后的图片数据形式存于同一云数据库。
2. 人工智能服务：生成方案与鼓励文案时，本应用通过 WorkBuddy 云平台调用大语言模型。我们仅向模型传递脱敏后的结构化参数（如性别、年龄、身高体重、目标热量、预算、忌口、器材、每周天数），不传递手机号等直接身份标识。
3. 其他用户：仅您主动发布的广场动态、点赞与评论对其他用户可见；健康档案、方案详情、心愿单不对其他普通用户开放。管理员可在后台查看档案与方案，用于运营管理与客服支持。
4. 除上述情形外，我们不会向任何第三方披露您的个人信息，法律法规另有规定的除外。

四、数据存储与安全
数据主要存储于云端数据库；会话状态、树洞等少量数据保存在您本机浏览器。我们采用传输加密、访问权限控制等技术措施保护数据。
订单支付：当前演示版本的"在线支付"为模拟流程，不接入真实支付通道、不产生真实扣款，也不收集银行卡等支付凭证；正式收款需另行接入持牌支付机构的商户号与支付回调。
特别提示：当前版本为演示/体验版本，云端数据访问控制策略较为宽松，除管理员外的用户理论上可能通过技术手段访问非本人数据。请勿在演示环境中填写真实、完整的敏感健康信息或病历资料。
正式对外服务版本应实施严格的按用户数据隔离策略，并接入运营商短信验证与正式账号鉴权。

五、您的权利
您有权：查询访问您的个人信息；更正不准确的信息；删除您的信息；撤回同意（退出登录即停止会话）；注销账号（停止使用并清除本地数据）；要求我们解释本政策。
可通过应用内「我的 → 建议与反馈」提出上述请求，我们会在合理期限内处理。

六、未成年人保护
本应用面向成年人，未成年人在监护人陪同下使用。我们不会有意收集 14 周岁以下儿童的个人信息。

七、政策更新
政策变更时将更新版本号与生效日期；重大变更将在应用内提示。

第二部分　免责声明
1. 非医疗建议：本应用提供的饮食、运动方案与健康解读基于通用营养学公式（如 Mifflin-St Jeor 基础代谢公式）与规则算法生成，仅供健康管理与生活参考，不构成医疗诊断、治疗或用药建议，不替代专业医师意见。
2. 特殊人群：患有慢病（高血压、糖尿病、高血脂、痛风等）、处于孕期或哺乳期、正在服药、术后恢复或有其他健康问题者，请在专业医师或注册营养师指导下使用，并遵医嘱。
3. AI 生成内容：方案文本由人工智能辅助生成，可能存在不准确或过时之处。请结合实际情况判断，关键数值（热量、营养素、食材克重）以应用内结构化明细为准。
4. 价格与支付：食材与商品价格标注为"参考价·仅供估算"，不代表实时市场价或实际成交价。积分兑换为演示机制，不涉及真实支付、不发放实物。演示环境中的在线下单与支付为模拟流程，不产生真实交易；正式环境接入支付机构后，以下单页展示的金额与订单记录为准。
5. 禁忌过滤的局限：系统已对忌口、过敏原与慢病禁忌做硬性过滤，但食材加工方式、交叉污染、个体差异等情形无法完全覆盖。食物过敏者请自行二次核实配料表，谨慎食用。
6. 用户生成内容：用户广场中的帖子、评论由用户自行发布，观点不代表本应用立场。请勿发布违法、虚假医疗信息或他人隐私内容；我们有权删除违规内容并对违规用户发出警告。
7. 第三方服务：本应用依赖云平台与大模型服务。因服务中断、网络故障导致的不可用，我们将在合理范围内修复，但不承担由此产生的间接损失。
8. 运动风险：请依据自身身体状况量力而行，运动前做好热身，出现不适立即停止并就医。长辈模式仅为界面与内容适配，不替代实际看护。
9. 责任限制：在法律允许的范围内，本应用对因使用或无法使用本应用所产生的损失不承担责任。

联系我们：应用内「我的 → 建议与反馈」

免责声明（精简版）：本方案为健康参考，不替代医疗建议；慢病、孕期、服药人群请遵医嘱。`;

  return { CITY_TIERS, FOODS, AVOID_OPTIONS, DIET_MODES, CHRONIC, PRODUCTS, EXERCISES, SEED_POSTS, PRIVACY };
})();
