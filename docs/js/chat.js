/* 农小禾健康 · 对话引擎
 * 意图优先（价格 / 产品 / 推荐 / 情绪 / 档案）+ DeepSeek 自由对话兜底
 */
window.NXH_CHAT = (function () {
  const D = window.NXH_DATA;
  const E = window.NXH_ENGINE;

  let serverOK = null;

  async function checkServer() {
    if (serverOK !== null) return serverOK;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      serverOK = r.ok;
    } catch (e) { serverOK = false; }
    return serverOK;
  }

  async function callLLM(messages, opts) {
    const ok = await checkServer();
    if (!ok) throw new Error('offline');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), (opts && opts.timeout) || 42000);
    try {
      const r = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, temperature: (opts && opts.temperature) || 0.85, max_tokens: (opts && opts.max_tokens) || 700 }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok || !data.content) throw new Error(data.error || 'bad response');
      return data.content.trim();
    } finally { clearTimeout(timer); }
  }

  /* ---------------- 意图识别 ---------------- */
  const PRICE_RE = /(多少钱|价格|价钱|几块|几元|报价|贵不贵|怎么卖|优惠|打折)/;
  const REC_RE = /(吃什么|吃啥|推荐|搭配|礼盒|送礼|送人|送长辈|买什么|早餐|午餐|晚餐|加餐|食谱|菜谱)/;
  const EMO_RE = /(累|烦|孤单|孤独|焦虑|心事|难过|emo|压力|睡不着|坚持不下去|好想放弃|崩溃|委屈|想哭|聊聊|陪我|说说话|不开心|郁闷)/;
  const ARCH_RE = /(打卡|坚持|多少天|连续|积分|等级|收藏|心愿单)/;
  const GREET_RE = /^(你好|hi|hello|嗨|在吗|早上好|中午好|晚上好|早安|晚安)[!！。~\s]*$/i;
  const THANKS_RE = /(谢谢|感谢|多谢|辛苦了|thanks|thx)/i;
  const BMI_RE = /(bmi|体脂|基础代谢|bmr|tdee|热量缺口|代谢)/i;

  const PRODUCT_ALIAS = [
    { id: 'p3', keys: ['蜂蜜', '洋槐', '蜜'] },
    { id: 'p5', keys: ['费南雪', 'financier', '蛋糕', '烘焙'] },
    { id: 'p6', keys: ['礼盒', '礼包', '礼物', '送礼'] },
    { id: 'p11', keys: ['蜂王浆', '王浆'] },
    { id: 'p2', keys: ['杂粮', '低gi米', '糙米', '主食'] },
    { id: 'p1', keys: ['蔬菜', '时蔬', '果蔬', '青菜'] },
    { id: 'p7', keys: ['鸡蛋', '土鸡蛋'] },
    { id: 'p8', keys: ['坚果'] },
    { id: 'p10', keys: ['鸡胸'] },
    { id: 'p9', keys: ['亚麻籽油', '油'] },
    { id: 'p4', keys: ['苹果蜂蜜水', '蜂蜜水', '饮料'] },
  ];

  function findProduct(text) {
    for (const a of PRODUCT_ALIAS) {
      if (a.keys.some((k) => text.includes(k))) return a.id;
    }
    return null;
  }

  function detect(text) {
    const t = (text || '').trim();
    if (PRICE_RE.test(t)) return { intent: 'price' };
    if (BMI_RE.test(t)) return { intent: 'bmi' };
    const pid = findProduct(t);
    if (pid) return { intent: 'product', productId: pid };
    if (REC_RE.test(t)) return { intent: 'recommend' };
    if (EMO_RE.test(t)) return { intent: 'emotion' };
    if (ARCH_RE.test(t)) return { intent: 'archive' };
    if (GREET_RE.test(t)) return { intent: 'greet' };
    if (THANKS_RE.test(t)) return { intent: 'thanks' };
    return { intent: 'free' };
  }

  function priceTable(products) {
    const wanted = ['p3', 'p5', 'p6'];
    const list = wanted.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    const rows = list.map((p) => `· ${p.name}　¥${p.price}　${p.points} 积分　${p.spec || ''}`).join('\n');
    return `这几款问得最多，价格直接给你 👇\n${rows}\n\n都是「参考价·仅供估算」，积分价 = 人民币 × 20。想拿积分换的话，去打卡或监督别人打卡都能攒。`;
  }

  function productReply(products, id) {
    const p = products.find((x) => x.id === id);
    if (!p) return { segs: ['这款我暂时没找到，要不要看看当季的时蔬箱？'], cards: [] };
    const seg = `「${p.name}」${p.spec ? '（' + p.spec + '）' : ''}\n${p.desc}\n单价 ¥${p.price}，${p.points} 积分可以换一份。`;
    return { segs: [seg], cards: [p.id] };
  }

  function recommendReply(ctx) {
    const { profile, products, plan } = ctx;
    const recs = E.recommendProducts(profile || {}, products, 2);
    const goalText = { fatloss: '减脂', muscle: '增肌', keep: '健康保持', elder: '长辈养生', chronic: '控三高' }[profile && profile.goal] || '健康';
    const meal = plan && plan.week && plan.week[0] && plan.week[0].meals[1];
    const mealLine = meal ? `今天午餐我配的是：${meal.items.map((i) => i.name).join(' + ')}，约 ${meal.kcal} 千卡、${meal.cost} 元。` : '点一下「我的方案」，我按你的预算把三餐都配好。';
    const segs = [
      `按你现在「${goalText}」的目标，我给个不费劲的搭配思路：${mealLine}`,
      `如果想把食材升级一下，可以看看这两样 ——`,
    ];
    return { segs, cards: recs.map((p) => p.id) };
  }

  function archiveReply(ctx) {
    const s = ctx.stats || {};
    return {
      segs: [
        `你已经连续陪伴 ${s.streak || 1} 天了，我们聊过 ${s.rounds || 0} 轮，你收藏了 ${s.favorites || 0} 个商品。`,
        `今天${s.checkedToday ? '已经打过卡了，很棒' : '还没打卡，先去首页勾一下清单吧'}。积分现在有 ${s.points || 0}，再攒一攒就能在慧选里换东西。`,
      ],
      cards: [],
    };
  }

  const EMO_SEGS = [
    ['我在的，先不用急着振作。', '累的时候，把今天的目标调小一点也算完成 —— 比如只走 10 分钟、只喝够水。要不要去「树洞」把心里那句话写下来？写完会轻一点。'],
    ['听起来今天有点难熬。', '你不用表现得很好，跟我说说就行。要是想安静一会儿，树洞那边只存你自己手机里，写完可以不留痕迹。'],
    ['辛苦了，能坚持到现在已经很不容易。', '先吃点东西、喝口热水，别急着复盘。等你想说话，我一直在这儿。'],
  ];

  function emotionReply(ctx) {
    const i = Math.floor(Math.random() * EMO_SEGS.length);
    return { segs: EMO_SEGS[i], cards: [], action: 'treehole' };
  }

  function fallbackFree(text, ctx) {
    const name = (ctx.user && ctx.user.name) || '你';
    if (/减脂|瘦|减肥/.test(text)) {
      return ['减脂最有效的不是饿，是「蛋白质够 + 有热量缺口 + 能坚持」。', '按你的数据，每天吃到 ' + ((ctx.plan && ctx.plan.target) || 1500) + ' 千卡左右就有缺口了，别低于 1200。要不要我看看你今天吃了什么？'];
    }
    if (/增肌|肌肉/.test(text)) {
      return ['增肌就三件事：练到位、吃够蛋白、睡够觉。', '你现在每天蛋白目标 ' + ((ctx.plan && ctx.plan.macros && ctx.plan.macros.protein) || 100) + 'g，分三四次吃比一次猛补更有用。'];
    }
    if (/失眠|睡不着/.test(text)) {
      return ['睡不好时，晚餐别太晚、别太油，睡前两小时把手机放远一点。', '如果连续两周都睡不好，建议去看看医生，别硬扛。'];
    }
    return [
      `我听到你说的「${text.slice(0, 24)}」了。`,
      '要不我们从最小的一步开始：今天想先解决吃、还是动？我按你的预算和口味给你配。',
    ];
  }

  /* ---------------- 自由对话 Prompt ---------------- */
  function profileLine(ctx) {
    const p = (ctx.plan && ctx.plan.profile) || ctx.profile;
    if (!p) return '用户还没填健康档案。';
    const goal = { fatloss: '减脂', muscle: '增肌', keep: '健康保持', elder: '长辈养生', chronic: '控三高' }[p.goal] || '健康保持';
    const parts = [
      `性别${p.gender === 'male' ? '男' : '女'}`,
      `${p.age}岁`,
      `${p.height}cm`,
      `${p.weight}kg`,
      `目标：${goal}`,
    ];
    if (ctx.plan) parts.push(`目标热量 ${ctx.plan.target} 千卡，蛋白 ${ctx.plan.macros.protein}g`);
    if (p.avoid && p.avoid.length) parts.push('忌口：' + p.avoid.map((a) => (D.AVOID_OPTIONS.find((x) => x.id === a) || {}).name || a).join('/'));
    if (p.chronic && p.chronic.length) parts.push('慢病：' + p.chronic.join('/'));
    if (p.mealBudget) parts.push(`每餐预算 ${p.mealBudget} 元`);
    return parts.join('，');
  }

  async function freeReply(text, ctx) {
    const products = (ctx.products || []).filter((p) => p.status !== 0);
    const catalog = products.map((p) => `${p.name}（¥${p.price}，${p.points}积分，${p.tags.join('/')}）`).join('；');
    const sys = [
      '你是「小禾」，农小禾健康的 AI 健康陪伴教练。',
      '说话风格：温柔、实在、口语化，像一个懂营养的朋友。不用敬语堆砌，不说教，不喊口号，不用 emoji 轰炸（最多 1 个）。',
      '回答长度：一般 2-3 句、总共不超过 90 字；用户明确问知识时才展开，可用短分行。',
      '边界：不做疾病诊断、不推荐药物；涉及慢病、孕期、服药，提醒遵医嘱。不编造产品价格。',
      '用户档案：' + profileLine(ctx),
      '在售商品（价格仅供估算）：' + catalog,
      '历史对话轮数：' + ((ctx.stats && ctx.stats.rounds) || 0) + '，连续陪伴：' + ((ctx.stats && ctx.stats.streak) || 1) + ' 天。',
      '如果用户情绪低落，先接住情绪，再给一个很小的具体动作，并可建议去「树洞」。',
    ].join('\n');
    const history = (ctx.history || []).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const content = await callLLM([{ role: 'system', content: sys }, ...history, { role: 'user', content: text }], { temperature: 0.9, max_tokens: 420 });
    const segs = content.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    return { segs: segs.length ? segs : [content], cards: [] };
  }

  /**
   * 生成回复
   * @returns {{segs:string[], cards:string[], action?:string}}
   */
  async function reply(text, ctx) {
    const d = detect(text);
    const products = ctx.products || [];
    if (d.intent === 'price') return { segs: [priceTable(products)], cards: ['p3', 'p5', 'p6'] };
    if (d.intent === 'product') return productReply(products, d.productId);
    if (d.intent === 'recommend') return recommendReply(ctx);
    if (d.intent === 'emotion') return emotionReply(ctx);
    if (d.intent === 'archive') return archiveReply(ctx);
    if (d.intent === 'bmi') {
      const b = ctx.plan ? ctx.plan.bmi : null;
      return {
        segs: [
          'BMI 是体重（kg）除以身高（m）的平方，用来粗看体重是否在合理区间：18.5–23.9 正常，24–27.9 超重，28 以上肥胖。',
          b ? `你现在是 ${b.value}（${b.label}）。它看不出肌肉和脂肪的比例，所以别只盯这个数字 —— 腰围和体感更重要。` : '它看不出肌肉和脂肪的比例，配合腰围一起看更准。',
        ],
        cards: [],
      };
    }
    if (d.intent === 'greet') {
      return { segs: [`在的，${(ctx.user && ctx.user.name) || '朋友'}。今天想先解决吃，还是想聊聊？`], cards: [] };
    }
    if (d.intent === 'thanks') {
      return { segs: ['不用客气，能帮上就好。', '记得喝水，今天的事慢慢来。'], cards: [] };
    }
    try {
      return await freeReply(text, ctx);
    } catch (e) {
      return { segs: fallbackFree(text, ctx), cards: [], offline: true };
    }
  }

  /* ---------------- 打卡鼓励 ---------------- */
  const ENCOURAGE_FALLBACK = [
    '今天的清单划掉了，这就够了。连续 {streak} 天，身体比你以为的更记得你的努力。',
    '{done} 项完成，剩下的留给明天也没关系。慢一点，但别停。',
    '又见面了，第 {streak} 天。不用做到满分，做到今天这一格就好。',
    '你来打卡这件事本身，就已经比昨天好一点了。今晚早点睡。',
  ];

  async function encourage(ctx) {
    const s = ctx.stats || {};
    try {
      const content = await callLLM([
        { role: 'system', content: '你是健康应用里的温柔教练小禾。写一句 40 字以内的鼓励，具体、不说教、不用感叹号堆砌、最多一个 emoji。不要提及"AI"。' },
        { role: 'user', content: `用户今天完成 ${s.done || 0}/${s.total || 4} 项，连续 ${s.streak || 1} 天，目标 ${(ctx.profile && ctx.profile.goal) || 'keep'}，当前积分 ${s.points || 0}。请写一句。` },
      ], { temperature: 0.95, max_tokens: 120 });
      return content.replace(/^["「]|["」]$/g, '').trim();
    } catch (e) {
      const t = ENCOURAGE_FALLBACK[Math.floor(Math.random() * ENCOURAGE_FALLBACK.length)];
      return t.replace('{streak}', s.streak || 1).replace('{done}', s.done || 0);
    }
  }

  /* ---------------- 方案文字（目标解读 + 提醒） ---------------- */
  function fallbackNarrative(profile, plan) {
    const goalName = { fatloss: '减脂', muscle: '增肌', keep: '健康保持', elder: '长辈养生', chronic: '控三高' }[profile.goal] || '健康保持';
    const reading = `你的基础代谢约 ${plan.bmr} 千卡，日常总消耗约 ${plan.tdee} 千卡。按「${goalName}」的目标，我们把每天的热量定在 ${plan.target} 千卡，蛋白质 ${plan.macros.protein}g、碳水 ${plan.macros.carb}g、脂肪 ${plan.macros.fat}g。这个缺口不大，目的是让你稳着往下走，而不是硬扛。`;
    const tips = [
      '每餐先吃蛋白质和蔬菜，最后吃主食，饱腹感会更稳。',
      `每天喝够 1500–1700ml 水，训练日再加 300ml。`,
      '睡够 7 小时，比多练一次更影响第二天的状态。',
    ];
    return { reading, tips };
  }

  async function planNarrative(profile, plan) {
    const goalName = { fatloss: '减脂', muscle: '增肌', keep: '健康保持', elder: '长辈养生', chronic: '控三高' }[profile.goal] || '健康保持';
    const d1 = (plan.week && plan.week[0]) || null;
    const mealsLine = d1 ? d1.meals.map((m) => `${m.label}：${m.items.map((i) => i.name).join('+')}（${m.kcal}千卡 / ¥${m.cost}）`).join('；') : '';
    const prompt = [
      `用户：${profile.gender === 'male' ? '男' : '女'}，${profile.age}岁，${profile.height}cm，${profile.weight}kg，目标「${goalName}」。`,
      `BMR ${plan.bmr}，TDEE ${plan.tdee}，目标热量 ${plan.target} 千卡；蛋白 ${plan.macros.protein}g、碳水 ${plan.macros.carb}g、脂肪 ${plan.macros.fat}g。`,
      `每餐预算 ${profile.mealBudget || 25} 元，每周运动 ${profile.trainDays || 3} 天，器材 ${(profile.equip || ['home']).join('/')}。`,
      profile.chronic && profile.chronic.length ? `慢病：${profile.chronic.join('、')}。` : '',
      mealsLine ? `第一天实际搭配：${mealsLine}。解读里举例只能引用这些食材，不要另编食物。` : '',
      '请输出严格 JSON：{"reading":"80-120字的目标解读，口语、具体、不喊口号","tips":["20字内提醒1","提醒2","提醒3"]}',
      '不要输出 markdown 代码块，不要额外文字。',
    ].filter(Boolean).join('\n');
    try {
      const content = await callLLM([
        { role: 'system', content: '你是注册营养师，为健康应用撰写方案解读。只输出 JSON，语言温和、具体、可执行，不做医疗诊断。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.7, max_tokens: 500 });
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const obj = JSON.parse(cleaned);
      if (!obj.reading || !Array.isArray(obj.tips)) throw new Error('shape');
      return { reading: String(obj.reading).slice(0, 300), tips: obj.tips.slice(0, 3).map((t) => String(t).slice(0, 40)) };
    } catch (e) {
      return fallbackNarrative(profile, plan);
    }
  }

  return { reply, detect, encourage, planNarrative, callLLM, checkServer, fallbackNarrative };
})();
