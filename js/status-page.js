/**
 * 站点状态页：口令门 + 访问观测图表（中英文 / Light·Dark）。
 */
(function (global) {
  const STORAGE_KEY = 'aidc-analytics-token';

  function t(key, params) {
    return global.AidcI18n?.t?.(key, params) ?? key;
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
      $('pwdInput')?.focus();
    }

    async function fetchSummary(days) {
      try {
        return await global.AidcApi.analyticsSummary(days, token);
      } catch (cause) {
        const error = new Error(cause?.code === 'UNAUTHORIZED' ? 'unauthorized' : 'unavailable');
        error.cause = cause;
        if (cause?.code === 'UNAUTHORIZED') {
          error.code = 'unauthorized';
        } else {
          error.code = 'unavailable';
        }
        throw error;
      }
    }

    function showGateError(key) {
      const error = $('pwdError');
      if (!error) return;
      error.textContent = t(key);
      error.classList.remove('hidden');
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

      const tbody = $('ipBody');
      if (!tbody) return;
      tbody.replaceChildren();
      if (!ips.length) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 5;
        emptyCell.className = 'py-6 text-center text-slate-400';
        emptyCell.textContent = t('table.empty');
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
      }
      ips.forEach((row, i) => {
        const tr = document.createElement('tr');
        const cells = [
          { className: 'py-2 pr-4 tabular-nums text-slate-400', text: String(i + 1) },
          { className: 'py-2 pr-4 font-mono text-slate-800', text: row.ip || '—' },
          { className: 'py-2 pr-4 text-right tabular-nums font-semibold', text: Number(row.hits || 0).toLocaleString(loc) },
          { className: 'py-2 pr-4 text-slate-700', text: row.country || '—' },
          { className: 'py-2 text-slate-700', text: row.city || '—' },
        ];
        cells.forEach((cell) => {
          const td = document.createElement('td');
          td.className = cell.className;
          td.textContent = cell.text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    async function load() {
      const days = Number($('daysSel')?.value) || 30;
      let data;
      try {
        data = await fetchSummary(days);
      } catch (error) {
        showGate();
        showGateError(error?.code === 'unauthorized' ? 'gate.errorUnauthorized' : 'gate.errorUnavailable');
        return;
      }

      showApp();
      $('pwdError')?.classList.add('hidden');
      try {
        render(data);
      } catch (error) {
        console.error('[status] render failed', error);
        if ($('metaLine')) $('metaLine').textContent = t('page.renderError');
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
