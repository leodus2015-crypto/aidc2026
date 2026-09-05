/**
 * AIDC 统一 HTTP API 客户端。
 * 页面不得自行拼接 /api/、认证、超时或错误解析。
 */
(function (global) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 3000;

  class AidcApiError extends Error {
    constructor(message, options) {
      super(message);
      this.name = 'AidcApiError';
      this.code = options?.code || 'API_ERROR';
      this.status = options?.status || 0;
      this.requestId = options?.requestId || null;
      this.details = options?.details;
    }
  }

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
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${resolveApiBase()}${normalized}`;
  }

  function newRequestId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function parseResponse(res) {
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch (_) {
        return null;
      }
    }
    return res.text();
  }

  async function request(path, options) {
    const opts = options || {};
    const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const requestId = opts.requestId || newRequestId();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', abortFromCaller, { once: true });
    }

    const headers = new Headers(opts.headers || {});
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    headers.set('X-Request-ID', requestId);
    if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);
    let body = opts.body;
    if (body != null && typeof body !== 'string' && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }

    try {
      const res = await fetch(buildUrl(path), {
        method: opts.method || 'GET',
        headers,
        body,
        signal: controller.signal,
        cache: opts.cache || 'no-store',
        credentials: opts.credentials || 'same-origin',
      });
      const payload = await parseResponse(res);
      if (!res.ok) {
        const detail = payload && typeof payload === 'object' ? payload.detail : payload;
        throw new AidcApiError(
          typeof detail === 'string' && detail ? detail : `HTTP ${res.status}`,
          {
            code: res.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
            status: res.status,
            requestId: res.headers.get('x-request-id') || requestId,
            details: payload,
          }
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof AidcApiError) throw error;
      if (error?.name === 'AbortError') {
        throw new AidcApiError(timedOut ? '请求超时' : '请求已取消', {
          code: timedOut ? 'TIMEOUT' : 'ABORTED',
          requestId,
        });
      }
      throw new AidcApiError('API 不可用', {
        code: 'NETWORK_ERROR',
        requestId,
        details: error?.message || String(error),
      });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener?.('abort', abortFromCaller);
    }
  }

  function getConfig(key, options) {
    return request(`/api/config/${encodeURIComponent(key)}`, options);
  }

  function saveConfig(key, data, token, options) {
    return request(`/api/config/${encodeURIComponent(key)}`, {
      ...options,
      method: 'PUT',
      token,
      body: { data },
    });
  }

  function verifyAdmin(token, options) {
    return request('/api/admin/verify', {
      ...options,
      method: 'POST',
      token,
    });
  }

  function health(options) {
    return request('/api/health', options);
  }

  function analyticsSummary(days, token, options) {
    const value = Math.max(1, Math.min(90, Number(days) || 30));
    return request(`/api/analytics/summary?days=${value}`, {
      ...options,
      token,
    });
  }

  global.AidcApi = {
    Error: AidcApiError,
    request,
    getConfig,
    saveConfig,
    verifyAdmin,
    health,
    analyticsSummary,
    resolveApiBase,
  };
})(typeof window !== 'undefined' ? window : globalThis);
