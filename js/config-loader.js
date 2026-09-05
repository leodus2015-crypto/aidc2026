/**
 * AIDC 配置加载：API/数据库优先，失败回退本地默认值。
 * 可通过 window.AIDC_API_BASE 覆盖 API 根地址（生产同域留空即可）。
 */
(function (global) {
  function api() {
    if (!global.AidcApi) throw new Error('AidcApi 未加载');
    return global.AidcApi;
  }

  async function loadConfig(key, localFallback, options) {
    try {
      const body = await api().getConfig(key, options);
      return {
        source: 'database',
        key,
        data: body.data != null ? body.data : body,
        version: body.version,
        updatedAt: body.updated_at,
      };
    } catch (err) {
      console.warn(`[AidcConfig] ${key} 使用本地默认:`, err && err.message ? err.message : err);
      return {
        source: 'local',
        key,
        data: typeof structuredClone === 'function'
          ? structuredClone(localFallback)
          : JSON.parse(JSON.stringify(localFallback)),
        error: err && err.message ? err.message : String(err),
      };
    }
  }

  function saveConfig(key, data, token, options) {
    return api().saveConfig(key, data, token, options);
  }

  function verifyAdmin(token, options) {
    return api().verifyAdmin(token, options);
  }

  async function checkHealth(options) {
    try {
      return await api().health(options);
    } catch {
      return { ok: false, database: 'down' };
    }
  }

  global.AidcConfig = {
    load: loadConfig,
    save: saveConfig,
    verifyAdmin,
    health: checkHealth,
    resolveApiBase: () => api().resolveApiBase(),
  };
})(typeof window !== 'undefined' ? window : globalThis);
