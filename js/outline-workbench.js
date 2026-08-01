(function () {
  'use strict';

  const STORAGE_KEY = 'aidc-outline2026-v1';
  const DEFAULT_DATA_URL = 'data/outline2026.json';

  const TAB_ACTIVE =
    'rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition bg-white';
  const TAB_INACTIVE =
    'rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/80 hover:text-slate-950';

  const STATUS_LABELS = {
    draft: '草稿',
    review: '评审中',
    aligned: '已对齐',
    final: '已定稿',
  };

  const POINT_STATUS_LABELS = {
    draft: '草稿',
    discuss: '待讨论',
    aligned: '已对齐',
  };

  const POINT_STATUS_CLASS = {
    draft: 'bg-slate-100 text-slate-600',
    discuss: 'bg-amber-100 text-amber-800',
    aligned: 'bg-emerald-100 text-emerald-800',
  };

  const SECTION_STATUS_CLASS = {
    draft: 'bg-slate-100 text-slate-600',
    review: 'bg-blue-100 text-blue-800',
    aligned: 'bg-emerald-100 text-emerald-800',
    final: 'bg-violet-100 text-violet-800',
  };

  const CHAPTER_SHELL = [
    'border-stone-200 bg-[#f4f3ef] shadow-stone-300/30',
    'border-slate-200 bg-white shadow-slate-200/70',
    'border-slate-200 bg-slate-50 shadow-slate-200/60',
  ];

  let outline = null;
  let viewMode = 'edit';
  let saveTimer = null;
  let dirty = false;

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function findSection(sectionId) {
    for (const chapter of outline.chapters) {
      const section = chapter.sections.find((s) => s.id === sectionId);
      if (section) return { chapter, section };
    }
    return null;
  }

  function findChapter(chapterId) {
    return outline.chapters.find((c) => c.id === chapterId) || null;
  }

  function getAllSections() {
    return outline.chapters.flatMap((ch) => ch.sections);
  }

  function markDirty(options = {}) {
    dirty = true;
    updateSaveStatus('未保存…');
    clearTimeout(saveTimer);
    if (options.immediate) {
      persistLocal();
      return;
    }
    saveTimer = setTimeout(persistLocal, 600);
  }

  function updateSaveStatus(text) {
    if (els.saveStatus) els.saveStatus.textContent = text;
  }

  function syncDomToOutline() {
    if (!outline || !els.waterfall || viewMode !== 'edit') return;

    els.waterfall.querySelectorAll('[data-field="chapter-title"]').forEach((el) => {
      const chapter = findChapter(el.dataset.chapterId);
      if (chapter) chapter.title = el.value;
    });

    els.waterfall.querySelectorAll('[data-field="chapter-positioning"]').forEach((el) => {
      const chapter = findChapter(el.dataset.chapterId);
      if (chapter) chapter.positioning = el.value;
    });

    const sectionFieldMap = {
      'section-title': 'title',
      'section-subtitle': 'subtitle',
      'section-status': 'status',
      'section-openQuestions': 'openQuestions',
    };

    Object.entries(sectionFieldMap).forEach(([fieldName, key]) => {
      els.waterfall.querySelectorAll(`[data-field="${fieldName}"]`).forEach((el) => {
        const found = findSection(el.dataset.sectionId);
        if (found) found.section[key] = el.value;
      });
    });

    els.waterfall.querySelectorAll('[data-kp-id]').forEach((row) => {
      const found = findSection(row.dataset.sectionId);
      if (!found) return;
      const kp = found.section.keyPoints.find((item) => item.id === row.dataset.kpId);
      if (!kp) return;
      const textEl = row.querySelector('[data-kp-field="text"]');
      const statusEl = row.querySelector('[data-kp-field="status"]');
      if (textEl) kp.text = textEl.value;
      if (statusEl) kp.status = statusEl.value;
    });
  }

  function persistLocal() {
    if (!outline) return;
    syncDomToOutline();
    outline.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(outline));
    } catch (err) {
      console.error(err);
      updateSaveStatus('保存失败：浏览器本地存储不可用或已满');
      return;
    }
    dirty = false;
    clearTimeout(saveTimer);
    updateSaveStatus(`已保存 · ${formatTime(outline.updatedAt)}`);
    renderSummary();
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return iso;
    }
  }

  function normalizeOutline(data) {
    data.chapters?.forEach((chapter) => {
      chapter.sections?.forEach((section) => {
        delete section.owner;
        delete section.evidence;
      });
    });
    return data;
  }

  async function loadOutline() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        outline = normalizeOutline(JSON.parse(cached));
        if (!outline.chapters?.length) throw new Error('empty');
        updateSaveStatus(`已从本地恢复 · ${formatTime(outline.updatedAt)}`);
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const res = await fetch(DEFAULT_DATA_URL);
    if (!res.ok) throw new Error('无法加载默认大纲');
    outline = normalizeOutline(await res.json());
    outline.updatedAt = new Date().toISOString();
    persistLocal();
    updateSaveStatus('已加载默认大纲');
  }

  function setViewMode(mode) {
    if (viewMode === 'edit' && mode !== 'edit') {
      syncDomToOutline();
      if (dirty) persistLocal();
    }
    viewMode = mode;
    const isEdit = mode === 'edit';
    document.body.classList.toggle('edit-mode', isEdit);
    document.body.classList.toggle('preview-mode', !isEdit);
    els.tabEdit?.setAttribute('aria-selected', isEdit ? 'true' : 'false');
    els.tabPreview?.setAttribute('aria-selected', isEdit ? 'false' : 'true');
    els.tabEdit.className = isEdit ? TAB_ACTIVE : TAB_INACTIVE;
    els.tabPreview.className = isEdit ? TAB_INACTIVE : TAB_ACTIVE;
    els.tabEdit.tabIndex = isEdit ? 0 : -1;
    els.tabPreview.tabIndex = isEdit ? -1 : 0;
    renderWaterfall();
  }

  function renderSummary() {
    if (!els.summaryBar || !outline) return;
    const sections = getAllSections();
    const counts = { draft: 0, review: 0, aligned: 0, final: 0, discuss: 0 };
    sections.forEach((s) => {
      if (counts[s.status] !== undefined) counts[s.status] += 1;
      s.keyPoints.forEach((kp) => {
        if (kp.status === 'discuss') counts.discuss += 1;
      });
    });
    els.summaryBar.innerHTML = `
      <span class="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">${outline.chapters.length} 章 · ${sections.length} 节</span>
      <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-200">已对齐 ${counts.aligned + counts.final}</span>
      <span class="aidc-inset-panel rounded-full px-3 py-1 ring-1 ring-blue-200">评审中 ${counts.review}</span>
      <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">草稿 ${counts.draft}</span>
      <span class="rounded-full bg-amber-50 px-3 py-1 text-amber-800 ring-1 ring-amber-200">待讨论 ${counts.discuss}</span>
    `;
  }

  function renderKeyPointRow(kp, idx, sectionId) {
    if (viewMode === 'preview') {
      return `
        <li class="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3">
          <span class="mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_STATUS_CLASS[kp.status] || POINT_STATUS_CLASS.draft}">${POINT_STATUS_LABELS[kp.status] || kp.status}</span>
          <span class="text-sm leading-6 text-slate-800">${escapeHtml(kp.text) || '—'}</span>
        </li>
      `;
    }
    return `
      <li class="rounded-xl border border-slate-200 bg-white p-3" data-kp-id="${kp.id}" data-section-id="${sectionId}">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-slate-400">#${idx + 1}</span>
          <select data-kp-field="status" class="field-input rounded-lg border border-slate-300 px-2 py-1 text-xs">
            ${Object.entries(POINT_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${kp.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <button type="button" data-kp-action="up" class="edit-control rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">↑</button>
          <button type="button" data-kp-action="down" class="edit-control rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">↓</button>
          <button type="button" data-kp-action="remove" class="edit-control ml-auto rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除</button>
        </div>
        <textarea data-kp-field="text" rows="2" class="field-input mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(kp.text)}</textarea>
      </li>
    `;
  }

  function renderSectionBlock(chapter, section, si, ci) {
    const statusClass = SECTION_STATUS_CLASS[section.status] || SECTION_STATUS_CLASS.draft;
    const label = `${ci + 1}.${si + 1}`;

    if (viewMode === 'preview') {
      return `
        <section id="${section.id}" class="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6">
          <div class="flex flex-wrap items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">${label}</span>
            <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}">${STATUS_LABELS[section.status]}</span>
          </div>
          <h3 class="mt-4 text-lg font-bold leading-7 text-slate-950 sm:text-xl">${escapeHtml(section.title)}</h3>
          ${section.subtitle ? `<p class="mt-2 text-sm leading-6 text-slate-600 sm:text-base">${escapeHtml(section.subtitle)}</p>` : ''}
          <div class="mt-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">关键信息</p>
            <ul class="mt-2 space-y-2">${section.keyPoints.map((kp, idx) => renderKeyPointRow(kp, idx, section.id)).join('')}</ul>
          </div>
          ${section.openQuestions ? `<div class="mt-5 rounded-xl bg-amber-50/80 px-4 py-3"><p class="text-xs font-semibold text-amber-800">待讨论</p><p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-900/80">${escapeHtml(section.openQuestions)}</p></div>` : ''}
        </section>
      `;
    }

    return `
      <section id="${section.id}" class="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">${label}</span>
          <button type="button" data-section-action="remove" data-section-id="${section.id}" data-chapter-id="${chapter.id}" class="edit-control rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除本节</button>
        </div>
        <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">子章节标题</label>
        <input data-field="section-title" data-section-id="${section.id}" type="text" value="${escapeAttr(section.title)}" class="field-input mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">副标题 / 核心命题</label>
        <input data-field="section-subtitle" data-section-id="${section.id}" type="text" value="${escapeAttr(section.subtitle || '')}" placeholder="一句话概括本节核心命题" class="field-input mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <div class="mt-4">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">状态</label>
          <select data-field="section-status" data-section-id="${section.id}" class="field-input mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${section.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="mt-5">
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-400">关键信息</label>
            <button type="button" data-kp-action="add" data-section-id="${section.id}" class="edit-control rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">+ 添加</button>
          </div>
          <ul class="space-y-2" data-kp-list="${section.id}">
            ${section.keyPoints.map((kp, idx) => renderKeyPointRow(kp, idx, section.id)).join('')}
          </ul>
        </div>
        <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">待讨论</label>
        <textarea data-field="section-openQuestions" data-section-id="${section.id}" rows="2" class="field-input mt-2 w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm leading-6 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20">${escapeHtml(section.openQuestions || '')}</textarea>
      </section>
    `;
  }

  function renderChapterBlock(chapter, ci) {
    const shell = CHAPTER_SHELL[ci % CHAPTER_SHELL.length];
    const sectionsHtml = chapter.sections
      .map((section, si) => renderSectionBlock(chapter, section, si, ci))
      .join('');

    if (viewMode === 'preview') {
      return `
        <article id="${chapter.id}" class="scroll-mt-24 overflow-hidden rounded-3xl border shadow-xl ${shell}">
          <header class="border-b border-stone-200/60 px-6 py-8 sm:px-8 sm:py-10">
            <span class="inline-flex rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">第 ${ci + 1} 章</span>
            <h2 class="mt-4 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">${escapeHtml(chapter.title.replace(/^第.*?章[：:]\s*/, ''))}</h2>
            ${chapter.positioning ? `<p class="mt-4 max-w-2xl text-base leading-7 text-stone-600">${escapeHtml(chapter.positioning)}</p>` : ''}
          </header>
          <div class="space-y-5 p-5 sm:p-6 lg:p-8">${sectionsHtml}</div>
        </article>
      `;
    }

    return `
      <article id="${chapter.id}" class="scroll-mt-24 overflow-hidden rounded-3xl border shadow-xl ${shell}">
        <header class="border-b border-stone-200/60 px-6 py-6 sm:px-8">
          <span class="inline-flex rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">第 ${ci + 1} 章</span>
          <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-500">章节标题</label>
          <input data-field="chapter-title" data-chapter-id="${chapter.id}" type="text" value="${escapeAttr(chapter.title)}" class="field-input mt-2 w-full rounded-xl border border-stone-300 bg-white/80 px-4 py-2.5 text-xl font-bold text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-500">章节定位</label>
          <textarea data-field="chapter-positioning" data-chapter-id="${chapter.id}" rows="2" class="field-input mt-2 w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-sm leading-6 text-stone-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(chapter.positioning || '')}</textarea>
        </header>
        <div class="space-y-5 p-5 sm:p-6 lg:p-8">
          ${sectionsHtml}
          <button type="button" data-chapter-action="add-section" data-chapter-id="${chapter.id}" class="edit-control w-full rounded-2xl border border-dashed border-slate-300 bg-white/60 py-3 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-700">+ 添加子章节</button>
        </div>
      </article>
    `;
  }

  function renderWaterfall() {
    if (!els.waterfall || !outline) return;
    if (viewMode === 'edit' && els.waterfall.querySelector('.field-input')) {
      syncDomToOutline();
    }
    els.waterfall.innerHTML = outline.chapters
      .slice(0, 3)
      .map((chapter, ci) => renderChapterBlock(chapter, ci))
      .join('');
  }

  function handleWaterfallInput(e) {
    const t = e.target;
    const sectionId = t.dataset.sectionId;
    const chapterId = t.dataset.chapterId;

    if (t.dataset.field === 'chapter-title' && chapterId) {
      const ch = findChapter(chapterId);
      if (ch) { ch.title = t.value; markDirty(); }
      return;
    }
    if (t.dataset.field === 'chapter-positioning' && chapterId) {
      const ch = findChapter(chapterId);
      if (ch) { ch.positioning = t.value; markDirty(); }
      return;
    }
    if (!sectionId) return;

    const found = findSection(sectionId);
    if (!found) return;
    const { section } = found;
    const fieldMap = {
      'section-title': 'title',
      'section-subtitle': 'subtitle',
      'section-status': 'status',
      'section-openQuestions': 'openQuestions',
    };
    if (fieldMap[t.dataset.field]) {
      section[fieldMap[t.dataset.field]] = t.value;
      markDirty();
    }
    if (t.dataset.kpField === 'text') {
      const kp = section.keyPoints.find((k) => k.id === t.closest('[data-kp-id]')?.dataset.kpId);
      if (kp) { kp.text = t.value; markDirty(); }
    }
  }

  function handleWaterfallChange(e) {
    const t = e.target;
    if (t.dataset.kpField === 'status') {
      const row = t.closest('[data-kp-id]');
      const sectionId = row?.dataset.sectionId;
      const kpId = row?.dataset.kpId;
      const found = findSection(sectionId);
      const kp = found?.section.keyPoints.find((k) => k.id === kpId);
      if (kp) {
        kp.status = t.value;
        markDirty();
        renderSummary();
      }
    }
    if (t.dataset.field === 'section-status') {
      handleWaterfallInput(e);
      renderSummary();
    }
  }

  function handleWaterfallClick(e) {
    const btn = e.target.closest('[data-kp-action], [data-section-action], [data-chapter-action]');
    if (!btn) return;

    if (btn.dataset.kpAction === 'add') {
      const found = findSection(btn.dataset.sectionId);
      if (found) {
        found.section.keyPoints.push({ id: uid('kp'), text: '', status: 'draft' });
        markDirty();
        renderWaterfall();
      }
      return;
    }

    const row = btn.closest('[data-kp-id]');
    if (row && btn.dataset.kpAction) {
      const found = findSection(row.dataset.sectionId);
      if (!found) return;
      const { section } = found;
      const kpId = row.dataset.kpId;
      const idx = section.keyPoints.findIndex((k) => k.id === kpId);

      if (btn.dataset.kpAction === 'remove') {
        section.keyPoints = section.keyPoints.filter((k) => k.id !== kpId);
        markDirty();
        renderWaterfall();
        renderSummary();
      } else if (btn.dataset.kpAction === 'up' && idx > 0) {
        [section.keyPoints[idx - 1], section.keyPoints[idx]] = [section.keyPoints[idx], section.keyPoints[idx - 1]];
        markDirty();
        renderWaterfall();
      } else if (btn.dataset.kpAction === 'down' && idx < section.keyPoints.length - 1) {
        [section.keyPoints[idx + 1], section.keyPoints[idx]] = [section.keyPoints[idx], section.keyPoints[idx + 1]];
        markDirty();
        renderWaterfall();
      }
      return;
    }

    if (btn.dataset.sectionAction === 'remove') {
      const ch = findChapter(btn.dataset.chapterId);
      if (!ch || ch.sections.length <= 1) {
        alert('每章至少保留一个子章节');
        return;
      }
      if (!confirm('确定删除该子章节？')) return;
      ch.sections = ch.sections.filter((s) => s.id !== btn.dataset.sectionId);
      markDirty();
      renderWaterfall();
      renderSummary();
      return;
    }

    if (btn.dataset.chapterAction === 'add-section') {
      const ch = findChapter(btn.dataset.chapterId);
      if (!ch) return;
      const n = ch.sections.length + 1;
      ch.sections.push({
        id: uid('sec'),
        title: '（新子章节）',
        subtitle: '',
        keyPoints: [{ id: uid('kp'), text: '', status: 'draft' }],
        openQuestions: '',
        status: 'draft',
      });
      markDirty();
      renderWaterfall();
      renderSummary();
    }
  }

  function outlineToMarkdown(data) {
    const lines = [`# ${data.title}`, '', `> ${data.subtitle || ''}`, ''];
    data.chapters.forEach((ch, ci) => {
      lines.push(`# 第${ci + 1}章 ${ch.title.replace(/^第.*?章[：:]\s*/, '')}`, '');
      if (ch.positioning) lines.push(`> 定位：${ch.positioning}`, '');
      ch.sections.forEach((sec, si) => {
        lines.push(`## ${ci + 1}.${si + 1} ${sec.title}`, '');
        if (sec.subtitle) lines.push(`副标题：${sec.subtitle}`, '');
        lines.push('### 关键信息');
        sec.keyPoints.forEach((kp) => {
          lines.push(`- [${POINT_STATUS_LABELS[kp.status] || kp.status}] ${kp.text}`);
        });
        lines.push('');
        if (sec.openQuestions) lines.push('### 待讨论', sec.openQuestions, '');
        lines.push(`状态：${STATUS_LABELS[sec.status] || sec.status}`, '', '---', '');
      });
    });
    return lines.join('\n').trim() + '\n';
  }

  function parseMarkdown(md) {
    const normalized = String(md || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) throw new Error('Markdown 内容为空');

    const result = {
      version: 1,
      title: outline?.title || 'AI DC 白皮书 2.0 章节规划',
      subtitle: outline?.subtitle || '',
      chapters: [],
      updatedAt: new Date().toISOString(),
    };

    const docTitle = normalized.match(/^#\s+(.+)\n/m);
    if (docTitle && !/^#\s+第(\d+)章/m.test(docTitle[1])) {
      result.title = docTitle[1].trim();
    }
    const docSubtitle = normalized.match(/^>\s*(.+)$/m);
    if (docSubtitle && !docSubtitle[1].startsWith('定位：')) {
      result.subtitle = docSubtitle[1].trim();
    }

    let chapterChunks = normalized.split(/^#\s+第(\d+)章[：:\s]*/m).slice(1);
    if (!chapterChunks.length) {
      throw new Error('未识别到章节，请使用「# 第1章 标题」格式（每章以 # 第N章 开头）');
    }

    for (let i = 0; i < chapterChunks.length; i += 2) {
      const chapterNum = chapterChunks[i];
      const body = chapterChunks[i + 1] || '';
      const titleLine = body.split('\n')[0]?.trim() || `第${chapterNum}章`;
      const chapter = {
        id: `ch${chapterNum}`,
        title: `第${chapterNum}章：${titleLine.replace(/^第.*?章[：:\s]*/, '')}`,
        positioning: extractBlock(body, /^>\s*定位[：:]\s*(.+)$/m) || '',
        sections: [],
      };

      body.split(/^##\s+/m).slice(1).forEach((part, si) => {
        const lines = part.split('\n');
        const heading = lines[0]?.trim() || `(${si + 1}) 未命名`;
        const secBody = lines.slice(1).join('\n');
        const section = {
          id: `${chapter.id}-s${si + 1}`,
          title: heading.replace(/^\d+\.\d+\s+/, ''),
          subtitle: matchLine(secBody, /^副标题[：:]\s*(.+)$/m) || '',
          keyPoints: [],
          openQuestions: extractSection(secBody, '待讨论'),
          status: parseSectionStatus(matchLine(secBody, /^状态[：:]\s*(.+)$/m)),
        };

        const kpBlock = extractSection(secBody, '关键信息');
        if (kpBlock) {
          kpBlock.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const tagged = trimmed.match(/^-\s*\[(草稿|待讨论|已对齐|评审中|已定稿)\]\s*(.+)$/);
            if (tagged) {
              const statusMap = {
                草稿: 'draft',
                待讨论: 'discuss',
                已对齐: 'aligned',
                评审中: 'review',
                已定稿: 'final',
              };
              section.keyPoints.push({
                id: uid('kp'),
                text: tagged[2].trim(),
                status: statusMap[tagged[1]] || 'draft',
              });
              return;
            }
            const plain = trimmed.match(/^-\s+(.+)$/);
            if (plain) {
              section.keyPoints.push({ id: uid('kp'), text: plain[1].trim(), status: 'draft' });
            }
          });
        }
        if (!section.keyPoints.length) {
          section.keyPoints.push({ id: uid('kp'), text: '关键信息待补充', status: 'draft' });
        }
        chapter.sections.push(section);
      });

      if (!chapter.sections.length) {
        chapter.sections.push({
          id: `${chapter.id}-s1`,
          title: '（子章节待定）',
          subtitle: '',
          keyPoints: [{ id: uid('kp'), text: '关键信息待补充', status: 'draft' }],
          openQuestions: '',
          status: 'draft',
        });
      }
      result.chapters.push(chapter);
    }
    return result;
  }

  function matchLine(text, regex) {
    const m = text.match(regex);
    return m ? m[1].trim() : '';
  }

  function extractBlock(text, regex) {
    const m = text.match(regex);
    return m ? m[1].trim() : '';
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractSection(text, heading) {
    const safeHeading = escapeRegExp(heading);
    const re = new RegExp(
      `###\\s+${safeHeading}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n状态[：:])`,
      'm',
    );
    const matched = text.match(re);
    if (matched) return matched[1].trim();

    const fallback = new RegExp(`###\\s+${safeHeading}\\s*\\n([\\s\\S]*)`, 'm');
    const tail = text.match(fallback);
    return tail ? tail[1].replace(/\n---\s*$/, '').trim() : '';
  }

  function parseSectionStatus(label) {
    const map = { 草稿: 'draft', 评审中: 'review', 已对齐: 'aligned', 已定稿: 'final' };
    return map[label?.trim()] || 'draft';
  }

  function exportMarkdown() {
    syncDomToOutline();
    downloadFile('whitepaper2026-outline.md', outlineToMarkdown(outline), 'text/markdown;charset=utf-8');
  }

  function exportJson() {
    syncDomToOutline();
    downloadFile('whitepaper2026-outline.json', JSON.stringify(outline, null, 2), 'application/json');
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImportDialog() {
    els.importPanel?.classList.remove('hidden');
    if (els.importText) els.importText.value = outlineToMarkdown(outline);
  }

  function closeImportDialog() {
    els.importPanel?.classList.add('hidden');
    if (els.importPreview) els.importPreview.textContent = '';
  }

  function previewImport() {
    try {
      const parsed = parseMarkdown(els.importText.value);
      els.importPreview.textContent = `解析成功：${parsed.chapters.length} 章，${parsed.chapters.reduce((n, c) => n + c.sections.length, 0)} 节`;
      els.importPreview.className = 'text-sm text-emerald-700';
      return parsed;
    } catch (err) {
      els.importPreview.textContent = err.message || '解析失败';
      els.importPreview.className = 'text-sm text-red-600';
      return null;
    }
  }

  function applyImport() {
    syncDomToOutline();
    const parsed = previewImport();
    if (!parsed) return;
    if (!confirm('导入将覆盖当前大纲内容，是否继续？')) return;
    outline = normalizeOutline(parsed);
    dirty = true;
    persistLocal();
    renderAll();
    closeImportDialog();
  }

  function renderAll() {
    renderSummary();
    renderWaterfall();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function bindGlobalEvents() {
    els.tabPreview?.addEventListener('click', () => setViewMode('preview'));
    els.tabEdit?.addEventListener('click', () => setViewMode('edit'));
    els.btnExportMd?.addEventListener('click', exportMarkdown);
    els.btnExportJson?.addEventListener('click', exportJson);
    els.btnImport?.addEventListener('click', openImportDialog);
    els.btnImportClose?.addEventListener('click', closeImportDialog);
    els.btnImportPreview?.addEventListener('click', previewImport);
    els.btnImportApply?.addEventListener('click', applyImport);
    els.btnSaveNow?.addEventListener('click', () => {
      syncDomToOutline();
      persistLocal();
    });

    els.waterfall?.addEventListener('input', handleWaterfallInput);
    els.waterfall?.addEventListener('change', handleWaterfallChange);
    els.waterfall?.addEventListener('click', handleWaterfallClick);
    els.waterfall?.addEventListener(
      'blur',
      (e) => {
        if (!e.target.classList?.contains('field-input')) return;
        syncDomToOutline();
        markDirty({ immediate: true });
      },
      true,
    );

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && dirty) {
        persistLocal();
      }
    });

    els.importFile?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        els.importText.value = reader.result;
        previewImport();
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });

    window.addEventListener('beforeunload', () => {
      if (dirty) persistLocal();
    });

    window.addEventListener('pagehide', () => {
      if (dirty) persistLocal();
    });
  }

  async function init() {
    els.waterfall = $('outlineWaterfall');
    els.summaryBar = $('summaryBar');
    els.saveStatus = $('saveStatus');
    els.tabPreview = $('tabPreview');
    els.tabEdit = $('tabEdit');
    els.importPanel = $('importPanel');
    els.importText = $('importText');
    els.importPreview = $('importPreview');
    els.btnExportMd = $('btnExportMd');
    els.btnExportJson = $('btnExportJson');
    els.btnImport = $('btnImport');
    els.btnImportClose = $('btnImportClose');
    els.btnImportPreview = $('btnImportPreview');
    els.btnImportApply = $('btnImportApply');
    els.btnSaveNow = $('btnSaveNow');
    els.importFile = $('importFile');

    bindGlobalEvents();
    await loadOutline();
    setViewMode('edit');
    renderSummary();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
