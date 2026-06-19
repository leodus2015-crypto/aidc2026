function initAboutUsPage() {
  const t = (k, p) => AidcI18n.t(k, p);
  const loc = () => AidcI18n.localeTag();

  const fallback = {
    version: 2,
    source: 'Cursor Dashboard · usage-events-2026-06-19.csv',
    updated_at: '2026-06-19T12:00:00+08:00',
    periods: [
      {
        period: '2026-04-25 — 2026-05-25',
        period_start: '2026-04-25',
        period_end: '2026-05-25',
        recorded_at: '2026-06-19',
        total_tokens: 84624306,
        categories: [
          {
            name: 'Cache',
            tokens: 77889664,
            usage_percent: 92.0,
            items: [
              { name: 'Cache Read', tokens: 77889664, usage_percent: 92.0 },
              { name: 'Cache Write', tokens: 0, usage_percent: 0.0 },
            ],
          },
          {
            name: 'API',
            tokens: 489627,
            usage_percent: 0.6,
            items: [{ name: 'gpt-5.5-medium', tokens: 489627, usage_percent: 0.6 }],
          },
          {
            name: 'Auto + Composer',
            tokens: 6245015,
            usage_percent: 7.4,
            items: [
              { name: 'composer-2.5-fast', tokens: 3278591, usage_percent: 3.9 },
              { name: 'composer-2-fast', tokens: 2808023, usage_percent: 3.3 },
              { name: 'auto', tokens: 158401, usage_percent: 0.2 },
            ],
          },
        ],
      },
      {
        period: '2026-05-25 — 2026-06-25',
        period_start: '2026-05-25',
        period_end: '2026-06-25',
        recorded_at: '2026-06-19',
        total_tokens: 75566407,
        categories: [
          {
            name: 'Cache',
            tokens: 68232576,
            usage_percent: 90.3,
            items: [
              { name: 'Cache Read', tokens: 68232576, usage_percent: 90.3 },
              { name: 'Cache Write', tokens: 0, usage_percent: 0.0 },
            ],
          },
          {
            name: 'API',
            tokens: 2781102,
            usage_percent: 3.7,
            items: [{ name: 'gpt-5.5-medium', tokens: 2781102, usage_percent: 3.7 }],
          },
          {
            name: 'Auto + Composer',
            tokens: 4552729,
            usage_percent: 6.0,
            items: [{ name: 'composer-2.5-fast', tokens: 4552729, usage_percent: 6.0 }],
          },
        ],
      },
    ],
  };

  const barColors = ['bg-teal-500', 'bg-blue-600', 'bg-sky-500', 'bg-violet-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];

  function labelCategory(name) {
    const map = {
      Cache: t('usage.catCache'),
      API: t('usage.catApi'),
      'Auto + Composer': t('usage.catComposer'),
    };
    return map[name] || name;
  }

  function labelItem(name) {
    const map = {
      'Cache Read': t('usage.itemCacheRead'),
      'Cache Write': t('usage.itemCacheWrite'),
    };
    return map[name] || name;
  }
  let lastUsageData = null;

  function formatTokens(value) {
    const n = Number(value) || 0;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString(loc());
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString(loc());
  }

  function normalizePeriods(data) {
    if (Array.isArray(data.periods) && data.periods.length) {
      return [...data.periods].sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
    }
    const baseline = data.baseline;
    if (!baseline) return [];
    return [
      {
        period: baseline.period,
        period_start: baseline.period_start || baseline.period?.split('—')[0]?.trim(),
        period_end: baseline.period_end || baseline.period?.split('—')[1]?.trim(),
        recorded_at: baseline.recorded_at,
        total_tokens: baseline.total_tokens,
        categories: baseline.categories || [],
      },
    ];
  }

  function renderBreakdown(categories) {
    if (!Array.isArray(categories) || !categories.length) {
      return `<li class="text-sm text-slate-500">${t('msg.noBreakdown')}</li>`;
    }
    return categories
      .map((category) => {
        const items = (category.items || [])
          .filter((item) => Number(item.tokens) > 0)
          .map((item, index) => {
            const color = barColors[index % barColors.length];
            const width = Math.max(0.6, Math.min(100, Number(item.usage_percent) || 0));
            return `
              <li>
                <div class="flex items-center justify-between gap-4 text-sm">
                  <span class="font-medium text-slate-800">${labelItem(item.name)}</span>
                  <span class="shrink-0 tabular-nums text-slate-600">${formatTokens(item.tokens)} · ${width}%</span>
                </div>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div class="h-full rounded-full ${color}" style="width: ${width}%"></div>
                </div>
              </li>`;
          })
          .join('');

        return `
          <li>
            <p class="text-sm font-semibold text-slate-800">${t('msg.categoryLine', {
              name: labelCategory(category.name),
              tokens: formatTokens(category.tokens),
              percent: category.usage_percent,
            })}</p>
            <ul class="mt-3 space-y-3" role="list">${items}</ul>
          </li>`;
      })
      .join('');
  }

  function renderUsage(data) {
    lastUsageData = data;
    const periods = normalizePeriods(data);
    const latest = periods[periods.length - 1];
    const periodLabel = latest?.period || '—';

    const setText = (id, text) => {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    };

    const totalTokens = periods.reduce((sum, entry) => sum + (Number(entry.total_tokens) || 0), 0);

    setText('usageSource', data.source || 'Cursor Dashboard · Included Usage');
    setText('usageUpdatedAt', formatDate(data.updated_at || latest?.recorded_at));
    setText('usageTotalTokens', periods.length ? formatTokens(totalTokens) : '—');
    setText('usageBreakdownTitle', t('usage.breakdownTitle', { period: periodLabel }));

    const periodList = document.getElementById('usagePeriodList');
    if (periodList) {
      periodList.innerHTML = periods.length
        ? periods
            .map(
              (entry) =>
                `<li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><span>${entry.period}</span><span class="tabular-nums font-semibold text-slate-900">${formatTokens(entry.total_tokens)}</span></li>`
            )
            .join('')
        : `<li class="text-slate-500">${t('msg.noEntries')}</li>`;
    }

    const breakdown = document.getElementById('usageBreakdown');
    if (breakdown) breakdown.innerHTML = renderBreakdown(latest?.categories || []);
  }

  fetch('data/ai-usage.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : fallback))
    .then(renderUsage)
    .catch(() => renderUsage(fallback));

  window.__aidcPageRefreshI18n = function refreshAboutUsI18n() {
    if (lastUsageData) renderUsage(lastUsageData);
  };
}

window.initAboutUsPage = initAboutUsPage;
