function layoutSsdMountedLabels() {
  document.querySelectorAll('.ssd-mounted').forEach((group) => {
    const text = group.querySelector('.ssd-mounted-text');
    if (!text) return;

    const spans = Array.from(text.querySelectorAll('tspan'));
    const lengths = spans.map((ts) => (
      typeof ts.getComputedTextLength === 'function' ? ts.getComputedTextLength() : 0
    ));
    const totalWidth = lengths.reduce((sum, len) => sum + len, 0);
    const ssdCenterX = 170;
    let x = ssdCenterX - totalWidth / 2;

    spans.forEach((ts, index) => {
      ts.setAttribute('x', String(x));
      x += lengths[index];
    });

    group.querySelectorAll('.ssd-hl-bg').forEach((rect) => {
      rect.setAttribute('visibility', 'hidden');
    });

    text.querySelectorAll('tspan.ssd-hl').forEach((ts) => {
      const idx = ts.getAttribute('data-hl');
      const rect = group.querySelector(`.ssd-hl-bg[data-hl="${idx}"]`);
      if (!rect) return;
      const bb = ts.getBBox();
      rect.setAttribute('x', bb.x - 2);
      rect.setAttribute('y', bb.y - 1);
      rect.setAttribute('width', Math.max(0, bb.width + 4));
      rect.setAttribute('height', Math.max(0, bb.height + 2));
      rect.removeAttribute('visibility');
    });
  });
}

function refreshInferenceDataflowPage() {
  requestAnimationFrame(() => {
    layoutSsdMountedLabels();
  });
}

window.__aidcPageRefreshI18n = refreshInferenceDataflowPage;

function initInferenceDataflowPage() {
  refreshInferenceDataflowPage();
}

window.initInferenceDataflowPage = initInferenceDataflowPage;
