/**
 * ?embed=1：隐藏站点 chrome，适配 iframe 嵌套。
 */
(function (global) {
  function isEmbed() {
    return new URLSearchParams(global.location.search || '').get('embed') === '1';
  }
  if (isEmbed()) {
    global.document.documentElement.classList.add('aidc-embed');
  }
  global.AidcEmbedMode = { isEmbed };
})(typeof window !== 'undefined' ? window : globalThis);
