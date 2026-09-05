function initAboutUsPage() {
  const t = (k, p) => AidcI18n.t(k, p);
  const loc = () => AidcI18n.localeTag();

  const fallback = {
    "version": 3,
    "updated_at": "2026-08-29T10:11:24+08:00",
    "source": "Cursor Dashboard \u00b7 usage-events-2026-08-29.csv",
    "notes": "\u7531 Cursor \u5bfc\u51fa CSV \u6c47\u603b\uff1bIncluded \u884c\u6309\u8d26\u5355\u5468\u671f\u62c6\u5206\u3002\u540c\u4e00\u5468\u671f\u91cd\u590d\u5bfc\u5165\u65f6\uff0c\u4ec5\u5408\u5e76\u4e8b\u4ef6\u65e5\u671f\u665a\u4e8e recorded_at \u7684\u589e\u91cf\u3002input_cache_hit = Cache Read\uff1binput_cache_miss = Input (w/ Cache Write) + Input (w/o Cache Write)\uff1boutput = Output Tokens\u3002\u5386\u53f2\u4ec5\u6709\u6a21\u578b\u4fa7\u5206\u7c7b\u7684\u5468\u671f\uff0c\u6309\u8fd1\u671f\u5b9e\u6d4b\u6bd4\u4f8b\u4f30\u7b97\u4e09\u7c7b\u62c6\u5206\u3002",
    "periods": [
        {
            "period": "2026-04-25 \u2014 2026-05-25",
            "period_start": "2026-04-25",
            "period_end": "2026-05-25",
            "recorded_at": "2026-06-19",
            "total_tokens": 84624306,
            "token_types": [
                {
                    "name": "input_cache_miss",
                    "tokens": 5846620,
                    "usage_percent": 6.9
                },
                {
                    "name": "input_cache_hit",
                    "tokens": 77889664,
                    "usage_percent": 92.0
                },
                {
                    "name": "output",
                    "tokens": 888022,
                    "usage_percent": 1.0
                }
            ],
            "estimated": true
        },
        {
            "period": "2026-05-25 \u2014 2026-06-25",
            "period_start": "2026-05-25",
            "period_end": "2026-06-25",
            "recorded_at": "2026-06-23",
            "total_tokens": 265728228,
            "token_types": [
                {
                    "name": "input_cache_miss",
                    "tokens": 25352323,
                    "usage_percent": 9.5
                },
                {
                    "name": "input_cache_hit",
                    "tokens": 236525231,
                    "usage_percent": 89.0
                },
                {
                    "name": "output",
                    "tokens": 3850674,
                    "usage_percent": 1.4
                }
            ],
            "estimated": true
        },
        {
            "period": "2026-06-25 \u2014 2026-07-25",
            "period_start": "2026-06-25",
            "period_end": "2026-07-25",
            "recorded_at": "2026-07-21",
            "total_tokens": 157872029,
            "token_types": [
                {
                    "name": "input_cache_miss",
                    "tokens": 13198184,
                    "usage_percent": 8.4
                },
                {
                    "name": "input_cache_hit",
                    "tokens": 143133855,
                    "usage_percent": 90.7
                },
                {
                    "name": "output",
                    "tokens": 1539990,
                    "usage_percent": 1.0
                }
            ],
            "estimated": true
        },
        {
            "period": "2026-07-25 \u2014 2026-08-25",
            "period_start": "2026-07-25",
            "period_end": "2026-08-25",
            "recorded_at": "2026-08-24",
            "total_tokens": 248603286,
            "token_types": [
                {
                    "name": "input_cache_miss",
                    "tokens": 13019218,
                    "usage_percent": 5.2
                },
                {
                    "name": "input_cache_hit",
                    "tokens": 234083203,
                    "usage_percent": 94.2
                },
                {
                    "name": "output",
                    "tokens": 1500865,
                    "usage_percent": 0.6
                }
            ],
            "estimated": true
        },
        {
            "period": "2026-08-25 \u2014 2026-09-25",
            "period_start": "2026-08-25",
            "period_end": "2026-09-25",
            "recorded_at": "2026-08-27",
            "total_tokens": 55791828,
            "token_types": [
                {
                    "name": "input_cache_miss",
                    "tokens": 2477042,
                    "usage_percent": 4.4
                },
                {
                    "name": "input_cache_hit",
                    "tokens": 53147991,
                    "usage_percent": 95.3
                },
                {
                    "name": "output",
                    "tokens": 166795,
                    "usage_percent": 0.3
                }
            ],
            "estimated": false
        }
    ]
};

  const barColors = {
    input_cache_miss: 'bg-amber-500',
    input_cache_hit: 'bg-teal-500',
    output: 'bg-blue-600',
  };

  function labelTokenType(name) {
    const map = {
      input_cache_miss: t('usage.typeMiss'),
      input_cache_hit: t('usage.typeHit'),
      output: t('usage.typeOutput'),
    };
    return map[name] || name;
  }
  let lastUsageData = null;
  let lastReleaseData = null;

  const releaseFallback = {
    version: 'v2026.07.09',
    build: '12',
    updatedAt: '2026-07-09',
    siteUrl: 'https://www.aidc2026.cn',
    repoUrl: 'https://github.com/leodus2015-crypto/aidc2026',
  };

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
        token_types: baseline.token_types || baseline.categories || [],
      },
    ];
  }

  function accumulateTokenTypes(periods) {
    const totals = {
      input_cache_miss: 0,
      input_cache_hit: 0,
      output: 0,
    };
    periods.forEach((period) => {
      (period.token_types || []).forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(totals, item.name)) {
          totals[item.name] += Number(item.tokens) || 0;
        }
      });
    });
    const total = totals.input_cache_miss + totals.input_cache_hit + totals.output;
    return ['input_cache_miss', 'input_cache_hit', 'output'].map((name) => ({
      name,
      tokens: totals[name],
      usage_percent: total ? Math.round((totals[name] * 1000) / total) / 10 : 0,
    }));
  }

  function formatPercent(value) {
    const n = Number(value) || 0;
    return `${n.toFixed(1)}%`;
  }

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderBreakdown(tokenTypes, list) {
    list.replaceChildren();
    const items = Array.isArray(tokenTypes)
      ? tokenTypes.filter((item) => Number(item.tokens) > 0)
      : [];
    if (!items.length) {
      list.appendChild(createEl('li', 'text-sm text-slate-500', t('msg.noBreakdown')));
      return;
    }
    items.forEach((item) => {
      const color = barColors[item.name] || 'bg-slate-400';
      const width = Math.max(0.6, Math.min(100, Number(item.usage_percent) || 0));
      const li = document.createElement('li');
      const row = createEl('div', 'flex items-center justify-between gap-4 text-sm');
      row.appendChild(createEl('span', 'font-medium text-slate-800', labelTokenType(item.name)));
      row.appendChild(
        createEl(
          'span',
          'shrink-0 tabular-nums text-slate-600',
          `${formatTokens(item.tokens)} · ${formatPercent(item.usage_percent)}`
        )
      );
      const track = createEl('div', 'mt-2 h-2 overflow-hidden rounded-full bg-slate-100');
      track.setAttribute('aria-hidden', 'true');
      const bar = createEl('div', `h-full rounded-full ${color}`);
      bar.style.width = `${width}%`;
      track.appendChild(bar);
      li.appendChild(row);
      li.appendChild(track);
      list.appendChild(li);
    });
  }

  function renderUsage(data) {
    lastUsageData = data;
    const periods = normalizePeriods(data);

    const setText = (id, text) => {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    };

    const totalTokens = periods.reduce((sum, entry) => sum + (Number(entry.total_tokens) || 0), 0);
    const tokenTypes = accumulateTokenTypes(periods);

    setText('usageSource', data.source || 'Cursor Dashboard · Included Usage');
    setText('usageUpdatedAt', formatDate(data.updated_at || periods[periods.length - 1]?.recorded_at));
    setText('usageTotalTokens', periods.length ? formatTokens(totalTokens) : '—');
    setText('usageBreakdownTitle', t('usage.breakdownTitle'));

    const periodList = document.getElementById('usagePeriodList');
    if (periodList) {
      periodList.replaceChildren();
      if (!periods.length) {
        periodList.appendChild(createEl('li', 'text-slate-500', t('msg.noEntries')));
      } else {
        periods.forEach((entry) => {
          const li = createEl(
            'li',
            'aidc-inset-panel flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2'
          );
          li.appendChild(createEl('span', '', entry.period || '—'));
          li.appendChild(
            createEl('span', 'tabular-nums font-semibold text-slate-900', formatTokens(entry.total_tokens))
          );
          periodList.appendChild(li);
        });
      }
    }

    const breakdown = document.getElementById('usageBreakdown');
    if (breakdown) renderBreakdown(tokenTypes, breakdown);
  }

  function formatReleaseVersion(data) {
    return data.version || '—';
  }

  function renderRelease(data) {
    lastReleaseData = data;
    const siteLink = document.getElementById('openSourceSiteLink');
    if (siteLink && /^https?:\/\//i.test(data.siteUrl || '')) {
      siteLink.href = data.siteUrl;
    }
    const meta = document.getElementById('openSourceReleaseMeta');
    if (meta) {
      meta.textContent = t('openSource.releaseLine', {
        version: formatReleaseVersion(data),
        date: formatDate(data.updatedAt),
      });
    }
  }

  fetch('data/ai-usage.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : fallback))
    .then(renderUsage)
    .catch(() => renderUsage(fallback));

  fetch('data/site-release.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : releaseFallback))
    .then(renderRelease)
    .catch(() => renderRelease(releaseFallback));

  window.__aidcPageRefreshI18n = function refreshAboutUsI18n() {
    if (lastUsageData) renderUsage(lastUsageData);
    if (lastReleaseData) renderRelease(lastReleaseData);
  };

  initStatusEntryAvatar();
}

function initStatusEntryAvatar() {
  const el = document.getElementById('status-entry-avatar');
  if (!el) return;

  const HOLD_MS = 2000;
  let timer = null;
  let raf = null;
  let start = 0;
  let armed = false;

  function setArmed(next) {
    armed = next;
    el.classList.toggle('is-armed', armed);
    el.setAttribute('aria-disabled', armed ? 'false' : 'true');
    if (armed) {
      el.style.removeProperty('--aidc-status-progress');
      el.classList.remove('is-charging');
    }
  }

  function clearCharge() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    el.classList.remove('is-charging');
    el.style.removeProperty('--aidc-status-progress');
  }

  function tick(now) {
    const p = Math.min(100, ((now - start) / HOLD_MS) * 100);
    el.style.setProperty('--aidc-status-progress', `${p}%`);
    if (p < 100) raf = requestAnimationFrame(tick);
  }

  function beginCharge() {
    if (armed) return;
    clearCharge();
    start = performance.now();
    el.classList.add('is-charging');
    raf = requestAnimationFrame(tick);
    timer = setTimeout(() => {
      setArmed(true);
      clearCharge();
    }, HOLD_MS);
  }

  function resetCharge() {
    clearCharge();
    setArmed(false);
  }

  el.addEventListener('pointerenter', beginCharge);
  el.addEventListener('pointerleave', resetCharge);
  el.addEventListener('blur', resetCharge);
  el.addEventListener('click', (e) => {
    if (!armed) {
      e.preventDefault();
      return;
    }
    const locale = window.AidcI18n?.getLocale?.() || 'zh';
    const url = new URL(el.href, location.href);
    if (locale === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    e.preventDefault();
    location.href = url.pathname + url.search + url.hash;
  });
}

window.initAboutUsPage = initAboutUsPage;
