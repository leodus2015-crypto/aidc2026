/**
 * 站点状态页：口令门 + 访问观测图表（中英文 / Light·Dark）。
 */
(function (global) {
  const STORAGE_KEY = 'aidc-analytics-token';

  function t(key, params) {
    return global.AidcI18n?.t?.(key, params) ?? key;
  }

  function resolveApiBase() {
    if (global.AIDC_API_BASE != null && global.AIDC_API_BASE !== '') {
      return String(global.AIDC_API_BASE).replace(/\/$/, '');
    }
    if (global.location && global.location.port === '8011') return 'http://127.0.0.1:8012';
    return '';
  }

  function apiUrl(path) {
    const base = resolveApiBase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function chartColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      pv: dark ? '#60a5fa' : '#2563eb',
      pvFill: dark ? 'rgba(96,165,250,.18)' : 'rgba(37,99,235,.12)',
      uv: dark ? '#34d399' : '#059669',
      bar: dark ? '#60a5fa' : '#3b82f6',
      text: dark ? '#b5c3d4' : '#64748b',
      grid: dark ? 'rgba(148,163,184,.15)' : 'rgba(148,163,184,.25)',
    };
  }

  function statusCodeLabel(code) {
    const key = `statusCodes.${code}`;
    const label = t(key);
    return label === key ? String(code) : label;
  }

  function initStatusPage() {
    const $ = (id) => document.getElementById(id);
    let token = sessionStorage.getItem(STORAGE_KEY) || '';
    let chartDaily;
    let chartPages;
    let chartStatus;
    let lastData = null;

    function showApp() {
      $('gate')?.classList.add('hidden');
      $('app')?.classList.remove('hidden');
    }

    function showGate() {
      $('gate')?.classList.remove('hidden');
      $('app')?.classList.add('hidden');
      sessionStorage.removeItem(STORAGE_KEY);
      token = '';
    }

    async function fetchSummary(days) {
      const res = await fetch(apiUrl(`/api/analytics/summary?days=${days}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error('unauthorized');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    function destroyCharts() {
      [chartDaily, chartPages, chartStatus].forEach((c) => c && c.destroy());
      chartDaily = chartPages = chartStatus = null;
    }

    function render(data) {
      lastData = data;
      const daily = data.daily || [];
      const pages = data.pages || [];
      const ips = data.ips || [];
      const status = data.status || [];
      const totals = data.totals || {};
      const range = data.range || {};
      const colors = chartColors();
      const loc = global.AidcI18n?.localeTag?.() || 'zh-CN';

      $('kpiPvTotal').textContent = Number(totals.pv || 0).toLocaleString(loc);
      $('kpiUvTotal').textContent = Number(totals.uv || 0).toLocaleString(loc);
      const dayCount = Math.max(1, daily.length || Number(range.days) || 1);
      const pvAvg = daily.length
        ? daily.reduce((s, d) => s + Number(d.pv || 0), 0) / daily.length
        : Number(totals.pv || 0) / dayCount;
      const uvAvg = daily.length
        ? daily.reduce((s, d) => s + Number(d.uv || 0), 0) / daily.length
        : Number(totals.uv || 0) / dayCount;
      $('kpiPvAvg').textContent = Math.round(pvAvg).toLocaleString(loc);
      $('kpiUvAvg').textContent = Math.round(uvAvg).toLocaleString(loc);
      $('kpiSource').textContent = data.source || '—';

      let meta = t('metaLine', {
        start: range.start || '—',
        end: range.end || '—',
        generated: data.generated_at || '—',
      });
      if (data.note) meta += ` · ${data.note}`;
      if (data.warning) meta += ` · ${data.warning}`;
      $('metaLine').textContent = meta;

      destroyCharts();
      if (!global.Chart) return;

      chartDaily = new Chart($('chartDaily'), {
        type: 'line',
        data: {
          labels: daily.map((d) => d.day),
          datasets: [
            {
              label: t('charts.pageViews'),
              data: daily.map((d) => d.pv),
              borderColor: colors.pv,
              backgroundColor: colors.pvFill,
              tension: 0.25,
              fill: true,
            },
            {
              label: t('charts.uniqueVisitors'),
              data: daily.map((d) => d.uv),
              borderColor: colors.uv,
              backgroundColor: 'transparent',
              tension: 0.25,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: colors.text } } },
          scales: {
            x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
            y: {
              beginAtZero: true,
              ticks: { precision: 0, color: colors.text },
              grid: { color: colors.grid },
            },
          },
        },
      });

      chartPages = new Chart($('chartPages'), {
        type: 'bar',
        data: {
          labels: pages.map((p) => p.path),
          datasets: [{
            label: t('charts.hits'),
            data: pages.map((p) => p.hits),
            backgroundColor: colors.bar,
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0, color: colors.text },
              grid: { color: colors.grid },
            },
            y: { ticks: { color: colors.text }, grid: { display: false } },
          },
        },
      });

      chartStatus = new Chart($('chartStatus'), {
        type: 'doughnut',
        data: {
          labels: status.map((s) => statusCodeLabel(s.status)),
          datasets: [{
            data: status.map((s) => s.hits),
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: colors.text } } },
        },
      });

      $('ipBody').innerHTML = ips.length
        ? ips.map((row, i) =>
            `<tr>
              <td class="py-2 pr-4 tabular-nums text-slate-400">${i + 1}</td>
              <td class="py-2 pr-4 font-mono text-slate-800">${row.ip || '—'}</td>
              <td class="py-2 pr-4 text-right tabular-nums font-semibold">${Number(row.hits || 0).toLocaleString(loc)}</td>
              <td class="py-2 pr-4 text-slate-700">${row.country || '—'}</td>
              <td class="py-2 text-slate-700">${row.city || '—'}</td>
            </tr>`
          ).join('')
        : `<tr><td colspan="5" class="py-6 text-center text-slate-400">${t('table.empty')}</td></tr>`;
    }

    async function load() {
      const days = Number($('daysSel')?.value) || 30;
      try {
        const data = await fetchSummary(days);
        showApp();
        render(data);
        $('pwdError')?.classList.add('hidden');
      } catch (_) {
        showGate();
        $('pwdError')?.classList.remove('hidden');
      }
    }

    async function tryLogin() {
      token = ($('pwdInput')?.value || '').trim();
      if (!token) {
        $('pwdError')?.classList.remove('hidden');
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, token);
      await load();
    }

    $('pwdOk')?.addEventListener('click', tryLogin);
    $('pwdInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryLogin();
    });
    $('refreshBtn')?.addEventListener('click', load);
    $('daysSel')?.addEventListener('change', load);
    $('logoutBtn')?.addEventListener('click', showGate);

    global.__aidcPageRefreshI18n = function () {
      global.AidcI18n?.applyDom?.();
      if (lastData) render(lastData);
    };

    global.addEventListener('aidc-theme-change', () => {
      if (lastData) render(lastData);
    });

    if (token) load();
    else $('pwdInput')?.focus();
  }

  global.initStatusPage = initStatusPage;
})(typeof window !== 'undefined' ? window : globalThis);
