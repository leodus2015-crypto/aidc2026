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

  function isLocalPreviewHost() {
    const loc = global.location;
    if (!loc) return false;
    const host = loc.hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') return false;
    return loc.protocol === 'http:' || loc.protocol === 'https:';
  }

  function foldAdminToken(value) {
    return String(value || '').trim().toLowerCase();
  }

  function localAdminTokenMatches(provided, expected) {
    const left = foldAdminToken(provided);
    const right = foldAdminToken(expected);
    return left !== '' && left === right;
  }

  async function loadLocalAdminToken() {
    if (global.AIDC_LOCAL_ADMIN_TOKEN) return String(global.AIDC_LOCAL_ADMIN_TOKEN);
    const res = await fetch('data/local-dev-admin.json', { cache: 'no-store' });
    if (!res.ok) return '';
    const body = await res.json();
    return body && body.token ? String(body.token) : '';
  }

  async function verifyAdmin(token, options) {
    try {
      return await api().verifyAdmin(token, options);
    } catch (error) {
      if (error && error.status === 401) throw error;
      if (!isLocalPreviewHost()) throw error;
      let expected = '';
      try {
        expected = await loadLocalAdminToken();
      } catch (_) {
        expected = '';
      }
      if (expected && localAdminTokenMatches(token, expected)) {
        return { authenticated: true, source: 'local' };
      }
      if (expected) {
        throw new (api().Error)('未授权', { code: 'UNAUTHORIZED', status: 401 });
      }
      throw error;
    }
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
