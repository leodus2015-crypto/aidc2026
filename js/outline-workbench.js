(function () {
  'use strict';

  const STORAGE_KEY = 'aidc-outline2026-v1';
  const DEFAULT_DATA_URL = 'data/outline2026.json';

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

  let outline = null;
  let selectedSectionId = null;
  let presentationMode = false;
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

  function getAllSections() {
    return outline.chapters.flatMap((ch) =>
      ch.sections.map((sec) => ({ chapter: ch, section: sec }))
    );
  }

  function markDirty() {
    dirty = true;
    updateSaveStatus('未保存…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistLocal, 800);
  }

  function updateSaveStatus(text) {
    if (els.saveStatus) els.saveStatus.textContent = text;
  }

  function persistLocal() {
    if (!outline) return;
    outline.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outline));
    dirty = false;
    updateSaveStatus(`已保存 · ${formatTime(outline.updatedAt)}`);
    renderSummary();
    renderTree();
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return iso;
    }
  }

  async function loadOutline() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        outline = JSON.parse(cached);
        if (!outline.chapters?.length) throw new Error('empty');
        selectedSectionId = outline.chapters[0]?.sections[0]?.id ?? null;
        updateSaveStatus(`已从本地恢复 · ${formatTime(outline.updatedAt)}`);
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const res = await fetch(DEFAULT_DATA_URL);
    if (!res.ok) throw new Error('无法加载默认大纲');
    outline = await res.json();
    outline.updatedAt = new Date().toISOString();
    selectedSectionId = outline.chapters[0]?.sections[0]?.id ?? null;
    persistLocal();
    updateSaveStatus('已加载默认大纲');
  }

  function renderSummary() {
    if (!els.summaryBar || !outline) return;
    const sections = getAllSections().map((x) => x.section);
    const counts = { draft: 0, review: 0, aligned: 0, final: 0, discuss: 0 };
    sections.forEach((s) => {
      if (counts[s.status] !== undefined) counts[s.status] += 1;
      s.keyPoints.forEach((kp) => {
        if (kp.status === 'discuss') counts.discuss += 1;
      });
    });
    els.summaryBar.innerHTML = `
      <span class="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">共 ${outline.chapters.length} 章 · ${sections.length} 节</span>
      <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-200">已对齐 ${counts.aligned + counts.final}</span>
      <span class="rounded-full bg-blue-50 px-3 py-1 text-blue-800 ring-1 ring-blue-200">评审中 ${counts.review}</span>
      <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">草稿 ${counts.draft}</span>
      <span class="rounded-full bg-amber-50 px-3 py-1 text-amber-800 ring-1 ring-amber-200">待讨论要点 ${counts.discuss}</span>
    `;
  }

  function renderTree() {
    if (!els.tree) return;
    els.tree.innerHTML = outline.chapters
      .map((chapter, ci) => {
        const sectionsHtml = chapter.sections
          .map((section) => {
            const active = section.id === selectedSectionId;
            const statusClass = SECTION_STATUS_CLASS[section.status] || SECTION_STATUS_CLASS.draft;
            return `
              <button
                type="button"
                data-section-id="${section.id}"
                class="group flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}"
              >
                <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">${ci + 1}.${chapter.sections.indexOf(section) + 1}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium leading-5 ${active ? 'text-blue-800' : 'text-slate-800'}">${escapeHtml(section.title)}</span>
                  <span class="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}">${STATUS_LABELS[section.status] || section.status}</span>
                </span>
              </button>
            `;
          })
          .join('');
        return `
          <div class="mb-4">
            <p class="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">第 ${ci + 1} 章</p>
            <p class="mb-2 px-2 text-sm font-semibold text-slate-900">${escapeHtml(chapter.title)}</p>
            <div class="space-y-1">${sectionsHtml}</div>
          </div>
        `;
      })
      .join('');

    els.tree.querySelectorAll('[data-section-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSectionId = btn.dataset.sectionId;
        renderTree();
        renderEditor();
      });
    });
  }

  function renderEditor() {
    const found = findSection(selectedSectionId);
    if (!found || !els.editor) {
      els.editor.innerHTML = '<p class="text-slate-500">请选择左侧子章节</p>';
      return;
    }

    const { chapter, section } = found;
    const readonly = presentationMode;

    els.editor.innerHTML = `
      <div class="space-y-6">
        <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">所属章节</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(chapter.title)}</p>
          ${readonly ? `<p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(chapter.positioning || '')}</p>` : `
            <label class="mt-3 block text-xs font-medium text-slate-500">章节定位</label>
            <textarea data-field="chapter-positioning" rows="2" class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(chapter.positioning || '')}</textarea>
          `}
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">子章节标题</label>
          ${readonly
            ? `<h2 class="mt-2 text-2xl font-bold tracking-tight text-slate-950">${escapeHtml(section.title)}</h2>`
            : `<input data-field="section-title" type="text" value="${escapeAttr(section.title)}" class="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />`}
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">副标题 / 核心命题</label>
          ${readonly
            ? `<p class="mt-2 text-base leading-7 text-slate-600">${escapeHtml(section.subtitle || '—')}</p>`
            : `<input data-field="section-subtitle" type="text" value="${escapeAttr(section.subtitle || '')}" placeholder="一句话概括本节核心命题" class="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />`}
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">负责人</label>
            ${readonly
              ? `<p class="mt-2 text-sm text-slate-700">${escapeHtml(section.owner || '未指定')}</p>`
              : `<input data-field="section-owner" type="text" value="${escapeAttr(section.owner || '')}" placeholder="姓名" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />`}
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">章节状态</label>
            ${readonly
              ? `<p class="mt-2"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${SECTION_STATUS_CLASS[section.status]}">${STATUS_LABELS[section.status]}</span></p>`
              : `<select data-field="section-status" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${section.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>`}
          </div>
        </div>

        <div>
          <div class="mb-3 flex items-center justify-between gap-3">
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-400">关键信息</label>
            ${readonly ? '' : `<button type="button" id="btnAddKeyPoint" class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ 添加要点</button>`}
          </div>
          <ul id="keyPointsList" class="space-y-2">
            ${section.keyPoints.map((kp, idx) => renderKeyPointRow(kp, idx, readonly)).join('')}
          </ul>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">支撑依据</label>
          ${readonly
            ? `<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">${escapeHtml(section.evidence || '—')}</p>`
            : `<textarea data-field="section-evidence" rows="3" placeholder="数据、案例、参考链接…" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(section.evidence || '')}</textarea>`}
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-400">待讨论</label>
          ${readonly
            ? `<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900/80">${escapeHtml(section.openQuestions || '—')}</p>`
            : `<textarea data-field="section-openQuestions" rows="2" placeholder="尚未达成一致的开放问题…" class="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm leading-6 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20">${escapeHtml(section.openQuestions || '')}</textarea>`}
        </div>
      </div>
    `;

    if (!readonly) bindEditorEvents(chapter, section);
  }

  function renderKeyPointRow(kp, idx, readonly) {
    if (readonly) {
      return `
        <li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span class="mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_STATUS_CLASS[kp.status] || POINT_STATUS_CLASS.draft}">${POINT_STATUS_LABELS[kp.status] || kp.status}</span>
          <span class="text-sm leading-6 text-slate-800">${escapeHtml(kp.text)}</span>
        </li>
      `;
    }
    return `
      <li class="rounded-xl border border-slate-200 bg-white p-3" data-kp-id="${kp.id}">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-slate-400">#${idx + 1}</span>
          <select data-kp-field="status" class="rounded-lg border border-slate-300 px-2 py-1 text-xs">
            ${Object.entries(POINT_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${kp.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <button type="button" data-kp-action="up" class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" title="上移">↑</button>
          <button type="button" data-kp-action="down" class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" title="下移">↓</button>
          <button type="button" data-kp-action="remove" class="ml-auto rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除</button>
        </div>
        <textarea data-kp-field="text" rows="2" class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">${escapeHtml(kp.text)}</textarea>
      </li>
    `;
  }

  function bindEditorEvents(chapter, section) {
    const setChapterPositioning = els.editor.querySelector('[data-field="chapter-positioning"]');
    if (setChapterPositioning) {
      setChapterPositioning.addEventListener('input', (e) => {
        chapter.positioning = e.target.value;
        markDirty();
      });
    }

    const bind = (field, key) => {
      const node = els.editor.querySelector(`[data-field="${field}"]`);
      if (!node) return;
      node.addEventListener('input', (e) => {
        section[key] = e.target.value;
        markDirty();
      });
      if (node.tagName === 'SELECT') {
        node.addEventListener('change', (e) => {
          section[key] = e.target.value;
          markDirty();
          renderTree();
        });
      }
    };

    bind('section-title', 'title');
    bind('section-subtitle', 'subtitle');
    bind('section-owner', 'owner');
    bind('section-status', 'status');
    bind('section-evidence', 'evidence');
    bind('section-openQuestions', 'openQuestions');

    const list = $('keyPointsList');
    list?.querySelectorAll('[data-kp-id]').forEach((row) => {
      const kpId = row.dataset.kpId;
      const kp = section.keyPoints.find((k) => k.id === kpId);
      if (!kp) return;

      row.querySelector('[data-kp-field="text"]')?.addEventListener('input', (e) => {
        kp.text = e.target.value;
        markDirty();
      });
      row.querySelector('[data-kp-field="status"]')?.addEventListener('change', (e) => {
        kp.status = e.target.value;
        markDirty();
        renderSummary();
      });
      row.querySelector('[data-kp-action="remove"]')?.addEventListener('click', () => {
        section.keyPoints = section.keyPoints.filter((k) => k.id !== kpId);
        markDirty();
        renderEditor();
        renderSummary();
      });
      row.querySelector('[data-kp-action="up"]')?.addEventListener('click', () => {
        moveKeyPoint(section, kpId, -1);
      });
      row.querySelector('[data-kp-action="down"]')?.addEventListener('click', () => {
        moveKeyPoint(section, kpId, 1);
      });
    });

    $('btnAddKeyPoint')?.addEventListener('click', () => {
      section.keyPoints.push({ id: uid('kp'), text: '', status: 'draft' });
      markDirty();
      renderEditor();
    });
  }

  function moveKeyPoint(section, kpId, delta) {
    const idx = section.keyPoints.findIndex((k) => k.id === kpId);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= section.keyPoints.length) return;
    const tmp = section.keyPoints[idx];
    section.keyPoints[idx] = section.keyPoints[next];
    section.keyPoints[next] = tmp;
    markDirty();
    renderEditor();
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
          const tag = POINT_STATUS_LABELS[kp.status] || kp.status;
          lines.push(`- [${tag}] ${kp.text}`);
        });
        lines.push('');
        if (sec.evidence) {
          lines.push('### 支撑依据', sec.evidence, '');
        }
        if (sec.openQuestions) {
          lines.push('### 待讨论', sec.openQuestions, '');
        }
        lines.push(`负责人：${sec.owner || '未指定'}`);
        lines.push(`状态：${STATUS_LABELS[sec.status] || sec.status}`, '', '---', '');
      });
    });
    return lines.join('\n').trim() + '\n';
  }

  function parseMarkdown(md) {
    const result = {
      version: 1,
      title: outline?.title || 'AI DC 白皮书 2.0 章节规划',
      subtitle: outline?.subtitle || '',
      chapters: [],
      updatedAt: new Date().toISOString(),
    };

    const chapterChunks = md.split(/^#\s+第(\d+)章\s+/m).slice(1);
    if (!chapterChunks.length) {
      throw new Error('未识别到章节，请使用「# 第1章 标题」格式');
    }

    for (let i = 0; i < chapterChunks.length; i += 2) {
      const chapterNum = chapterChunks[i];
      const body = chapterChunks[i + 1] || '';
      const titleLine = body.split('\n')[0]?.trim() || `第${chapterNum}章`;
      const chapter = {
        id: `ch${chapterNum}`,
        title: `第${chapterNum}章：${titleLine}`,
        positioning: extractBlock(body, /^>\s*定位[：:]\s*(.+)$/m) || '',
        sections: [],
      };

      const sectionParts = body.split(/^##\s+/m).slice(1);
      sectionParts.forEach((part, si) => {
        const lines = part.split('\n');
        const heading = lines[0]?.trim() || `(${si + 1}) 未命名`;
        const secBody = lines.slice(1).join('\n');
        const section = {
          id: `${chapter.id}-s${si + 1}`,
          title: heading.replace(/^\d+\.\d+\s+/, ''),
          subtitle: matchLine(secBody, /^副标题[：:]\s*(.+)$/m) || '',
          keyPoints: [],
          evidence: extractSection(secBody, '支撑依据'),
          openQuestions: extractSection(secBody, '待讨论'),
          owner: (matchLine(secBody, /^负责人[：:]\s*(.+)$/m) || '').replace(/^未指定$/, ''),
          status: parseSectionStatus(matchLine(secBody, /^状态[：:]\s*(.+)$/m)),
        };

        const kpBlock = extractSection(secBody, '关键信息');
        if (kpBlock) {
          kpBlock.split('\n').forEach((line) => {
            const m = line.match(/^-\s*\[(草稿|待讨论|已对齐)\]\s*(.+)$/);
            if (m) {
              const statusMap = { 草稿: 'draft', 待讨论: 'discuss', 已对齐: 'aligned' };
              section.keyPoints.push({
                id: uid('kp'),
                text: m[2].trim(),
                status: statusMap[m[1]] || 'draft',
              });
            } else {
              const plain = line.match(/^-\s+(.+)$/);
              if (plain) {
                section.keyPoints.push({ id: uid('kp'), text: plain[1].trim(), status: 'draft' });
              }
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
          evidence: '',
          openQuestions: '',
          owner: '',
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

  function extractSection(text, heading) {
    const re = new RegExp(`###\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n负责人[：:]|\\n状态[：:]|$)`, 'm');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  }

  function parseSectionStatus(label) {
    const map = { 草稿: 'draft', 评审中: 'review', 已对齐: 'aligned', 已定稿: 'final' };
    return map[label?.trim()] || 'draft';
  }

  function exportMarkdown() {
    const md = outlineToMarkdown(outline);
    downloadFile('whitepaper2026-outline.md', md, 'text/markdown;charset=utf-8');
  }

  function exportJson() {
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
    const parsed = previewImport();
    if (!parsed) return;
    if (!confirm('导入将覆盖当前大纲内容，是否继续？')) return;
    outline = parsed;
    selectedSectionId = outline.chapters[0]?.sections[0]?.id ?? null;
    persistLocal();
    renderAll();
    closeImportDialog();
  }

  function resetToDefault() {
    if (!confirm('将清除本地修改并从默认 JSON 重新加载，是否继续？')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function togglePresentation() {
    presentationMode = !presentationMode;
    document.body.classList.toggle('presentation-mode', presentationMode);
    els.btnPresentation?.classList.toggle('bg-violet-600', presentationMode);
    els.btnPresentation?.classList.toggle('text-white', presentationMode);
    els.btnPresentation.textContent = presentationMode ? '退出演示' : '演示模式';
    renderEditor();
  }

  function renderAll() {
    renderSummary();
    renderTree();
    renderEditor();
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
    els.btnExportMd?.addEventListener('click', exportMarkdown);
    els.btnExportJson?.addEventListener('click', exportJson);
    els.btnImport?.addEventListener('click', openImportDialog);
    els.btnImportClose?.addEventListener('click', closeImportDialog);
    els.btnImportPreview?.addEventListener('click', previewImport);
    els.btnImportApply?.addEventListener('click', applyImport);
    els.btnPresentation?.addEventListener('click', togglePresentation);
    els.btnReset?.addEventListener('click', resetToDefault);
    els.btnSaveNow?.addEventListener('click', persistLocal);

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

    window.addEventListener('beforeunload', (e) => {
      if (dirty) {
        persistLocal();
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  async function init() {
    els.summaryBar = $('summaryBar');
    els.tree = $('outlineTree');
    els.editor = $('sectionEditor');
    els.saveStatus = $('saveStatus');
    els.importPanel = $('importPanel');
    els.importText = $('importText');
    els.importPreview = $('importPreview');
    els.btnExportMd = $('btnExportMd');
    els.btnExportJson = $('btnExportJson');
    els.btnImport = $('btnImport');
    els.btnImportClose = $('btnImportClose');
    els.btnImportPreview = $('btnImportPreview');
    els.btnImportApply = $('btnImportApply');
    els.btnPresentation = $('btnPresentation');
    els.btnReset = $('btnReset');
    els.btnSaveNow = $('btnSaveNow');
    els.importFile = $('importFile');

    bindGlobalEvents();
    await loadOutline();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
