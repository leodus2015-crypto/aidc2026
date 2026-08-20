/**
 * 全站静态资源版本号（由 scripts/bump-asset-version.py 同步）。
 * HTML 中须以 <script src="js/aidc-asset-version.js?v=N"> 引入，且置于其它本地 js 之前。
 */
(function (g) {
  var FALLBACK = '64';
  var s = typeof document !== 'undefined' && document.currentScript;
  var m = s && s.src && s.src.match(/[?&]v=(\d+)/);
  g.AIDC_ASSET_VERSION = m ? m[1] : FALLBACK;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
