/**
 * Investment ROI 页 locale 配置：中英共用人民币默认值与云比价；语言只影响文案。
 */
(function (global) {
  'use strict';

  const ZH_DEFAULTS = {
    schemaVersion: 1,
    computeP: 768,
    clusterMw: 2.5,
    pctItDevice: 70,
    pctPowerCool: 10,
    pctLandBuild: 20,
    npuUnitPrice: 70,
    ascendInItPct: 85,
    deprecYears: 4,
    pue: 1.5,
    elecPrice: 0.70,
    utilization: 75,
    tpsInputMiss: 600,
    tpsInputHit: 12000,
    tpsOutput: 100,
    pctMixMiss: 20,
    pctMixHit: 70,
    pctMixOut: 10,
    annualFixedOpex: 800,
    capexOpexPct: 3,
    serviceModel: 'ds-v4',
  };

  const ZH_CLOUD = {
    'ds-v4': {
      title: 'DeepSeek V4 档',
      updatedAt: '2026-10-27',
      pricingNote: 'DeepSeek-V4.1-Flash（deepseek-flash）高峰/忙时公开价，单位元/百万 Token。官方 2026-09-10 起峰谷价见 api-docs.deepseek.com；各云按官网忙时档整理（阿里云百炼缓存命中 0.2，其余多为 0.04）。',
      refInputMiss: 2.0,
      refInputHit: 0.04,
      refOutput: 8.0,
      clouds: [
        { name: 'DeepSeek 官方', inputMiss: 2.0, inputHit: 0.04, output: 8.0 },
        { name: '硅基流动', inputMiss: 2.0, inputHit: 0.04, output: 8.0 },
        { name: '阿里云百炼', inputMiss: 2.0, inputHit: 0.2, output: 8.0 },
        { name: '火山引擎', inputMiss: 2.0, inputHit: 0.04, output: 8.0 },
        { name: '腾讯云', inputMiss: 2.0, inputHit: 0.04, output: 8.0 },
        { name: '天翼云', inputMiss: 2.0, inputHit: 0.04, output: 8.0 },
      ],
    },
    'glm-52': {
      title: 'GLM-5.2 档',
      updatedAt: '2026-10-27',
      pricingNote: 'GLM-5.2 公开价，单位元/百万 Token。智谱 docs.bigmodel.cn 与硅基流动、阿里云百炼、火山方舟、腾讯云 TokenHub、京东云 JoyMaaS 刊例均为输入 8 / 缓存命中 2 / 输出 28。',
      refInputMiss: 8.0,
      refInputHit: 2.0,
      refOutput: 28.0,
      clouds: [
        { name: '智谱 AI 官方', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '硅基流动', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '阿里云百炼', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '火山引擎', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '腾讯云', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '京东云', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
      ],
    },
  };

  function normalizeLocale(locale) {
    return locale === 'en' ? 'en' : 'zh';
  }

  function buildConfig(locale) {
    const loc = normalizeLocale(locale);
    return {
      locale: loc,
      localeTag: loc === 'en' ? 'en-US' : 'zh-CN',
      configKeys: { defaults: 'roi.defaults', cloudCompare: 'roi.cloud_compare' },
      localDefaults: ZH_DEFAULTS,
      localCloudCompare: ZH_CLOUD,
    };
  }

  function applyConfig(locale) {
    const loc = normalizeLocale(
      locale || global.AidcI18n?.getLocale?.() || global.AidcLocaleBridge?.getLocale?.() || 'zh'
    );
    global.ROI_PAGE_CONFIG = buildConfig(loc);
    return global.ROI_PAGE_CONFIG;
  }

  global.AidcInvestmentRoiInit = { buildConfig, applyConfig };
})(typeof window !== 'undefined' ? window : globalThis);
