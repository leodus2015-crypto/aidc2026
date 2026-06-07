/**
 * AIDC 配置加载：API/数据库优先，失败回退本地默认值。
 * 可通过 window.AIDC_API_BASE 覆盖 API 根地址（生产同域留空即可）。
 */
(function (global) {
  const DEFAULT_TIMEOUT_MS = 3000;

  function resolveApiBase() {
    if (global.AIDC_API_BASE != null && global.AIDC_API_BASE !== '') {
      return String(global.AIDC_API_BASE).replace(/\/$/, '');
    }
    if (global.location && global.location.port === '8011') {
      return 'http://127.0.0.1:8012';
    }
    return '';
  }

  function buildUrl(path) {
    const base = resolveApiBase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function loadConfig(key, localFallback, options) {
    const timeoutMs = (options && options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(buildUrl(`/api/config/${encodeURIComponent(key)}`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = await res.json();
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
    } finally {
      clearTimeout(timer);
    }
  }

  async function saveConfig(key, data, token, options) {
    const timeoutMs = (options && options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(buildUrl(`/api/config/${encodeURIComponent(key)}`), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkHealth(options) {
    const timeoutMs = (options && options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(buildUrl('/api/health'), {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return { ok: false, database: 'down' };
      return res.json();
    } catch {
      return { ok: false, database: 'down' };
    } finally {
      clearTimeout(timer);
    }
  }

  global.AidcConfig = {
    load: loadConfig,
    save: saveConfig,
    health: checkHealth,
    resolveApiBase,
  };
})(typeof window !== 'undefined' ? window : globalThis);
