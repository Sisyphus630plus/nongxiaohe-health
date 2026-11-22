/* ============================================================
   农小禾 · 云端同步层
   使用 WorkBuddy 云服务（PostgREST 风格数据库）
   数据按 collection + id 存进 nxh_docs 表，逐行 upsert，避免整包覆盖
   ============================================================ */
(function () {
  'use strict';

  // publicConfig：endpoint / publishableKey 由云服务下发，属于可公开的前端配置
  const CONFIG = {
    endpoint: 'https://nongxiaohe-health-35480.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_qn8g6ygb7MyPQjb7sOtzlP_Y3vGOqamyHpFuCQHxuY7t69fWXnlYYUM',
  };

  const TABLE = 'nxh_docs';
  // 本地 store 集合名 -> 云端 collection 名
  const COLLECTIONS = {
    users: 'profiles',
    posts: 'posts',
    products: 'products',
    reports: 'reports',
    feedbacks: 'feedbacks',
    orders: 'orders',
  };
  const REVERSE = Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [v, k]));

  let client = null;
  let tried = false;
  let state = 'unknown'; // unknown | ok | fail
  let lastError = '';

  const IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  function init() {
    if (tried) return client;
    tried = true;
    // 本地开发不连云端，避免污染线上数据；云端行为统一在发布域名上验证
    if (IS_LOCAL) {
      state = 'fail';
      lastError = '本地预览模式：数据写入本地存档';
      return null;
    }
    try {
      if (!window.WorkBuddyCloud || typeof window.WorkBuddyCloud.createWorkBuddyCloud !== 'function') {
        state = 'fail';
        lastError = '云端 SDK 未加载';
        return null;
      }
      client = window.WorkBuddyCloud.createWorkBuddyCloud(CONFIG);
      state = 'ok';
    } catch (e) {
      client = null;
      state = 'fail';
      lastError = (e && e.message) || '云端初始化失败';
    }
    return client;
  }

  async function pullAll() {
    const c = init();
    if (!c) throw new Error(lastError || '云端不可用');
    const { data, error } = await c.database.from(TABLE).select('collection,id,data');
    if (error) {
      state = 'fail';
      lastError = error.message || '读取失败';
      throw new Error(lastError);
    }
    state = 'ok';
    lastError = '';
    const out = {};
    Object.keys(COLLECTIONS).forEach((k) => { out[k] = []; });
    (data || []).forEach((row) => {
      const key = REVERSE[row.collection];
      if (key && row.data) out[key].push(row.data);
    });
    return out;
  }

  /**
   * @param {{upserts: Array<{collection:string,id:string,data:object}>, deletes: Object<string,string[]>}} payload
   */
  async function push(payload) {
    const c = init();
    if (!c) throw new Error(lastError || '云端不可用');
    const upserts = (payload && payload.upserts) || [];
    const deletes = (payload && payload.deletes) || {};

    if (upserts.length) {
      const rows = upserts.map((u) => ({
        collection: u.collection,
        id: String(u.id),
        data: u.data,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await c.database.from(TABLE).upsert(rows, { onConflict: 'collection,id' });
      if (error) {
        state = 'fail';
        lastError = error.message || '写入失败';
        throw new Error(lastError);
      }
    }

    for (const coll of Object.keys(deletes)) {
      const ids = deletes[coll];
      if (!ids || !ids.length) continue;
      const { error } = await c.database.from(TABLE).delete().eq('collection', coll).in('id', ids);
      if (error) {
        state = 'fail';
        lastError = error.message || '删除失败';
        throw new Error(lastError);
      }
    }

    state = 'ok';
    lastError = '';
    return true;
  }

  function collectionOf(localName) {
    return COLLECTIONS[localName];
  }

  window.NXH_CLOUD = {
    init,
    pullAll,
    push,
    collectionOf,
    get state() { return state; },
    get local() { return IS_LOCAL; },
    get error() { return lastError; },
    available() { return state === 'ok'; },
  };
})();
