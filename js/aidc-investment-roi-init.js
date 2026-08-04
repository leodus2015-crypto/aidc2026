/**
 * Investment ROI 页 locale 配置：中文/英文默认值与云比价 fallback。
 */
(function (global) {
  'use strict';

  const ZH_DEFAULTS = {
    schemaVersion: 1,
    computeP: 768,
    clusterMw: 2.5,
    pctItDevice: 65,
    pctPowerCool: 25,
    pctLandBuild: 10,
    npuUnitPrice: 60,
    ascendInItPct: 85,
    deprecYears: 5,
    pue: 1.25,
    elecPrice: 0.65,
    utilization: 75,
    tpsInputMiss: 900,
    tpsInputHit: 3600,
    tpsOutput: 28,
    annualFixedOpex: 800,
    capexOpexPct: 3,
    serviceModel: 'ds-v4',
  };

  const EN_DEFAULTS = {
    schemaVersion: 1,
    computeP: 768,
    clusterMw: 2.5,
    pctItDevice: 65,
    pctPowerCool: 25,
    pctLandBuild: 10,
    npuUnitPrice: 7,
    ascendInItPct: 85,
    deprecYears: 5,
    pue: 1.25,
    elecPrice: 0.09,
    utilization: 75,
    tpsInputMiss: 900,
    tpsInputHit: 3600,
    tpsOutput: 28,
    annualFixedOpex: 110,
    capexOpexPct: 3,
    serviceModel: 'ds-v4',
  };

  const ZH_CLOUD = {
    'ds-v4': {
      title: 'DeepSeek V4 档',
      updatedAt: '2026-08-01',
      pricingNote: 'DeepSeek-V4-Flash 公开价；各平台按官网/百炼等公开价目整理，单位元/百万 Token',
      clouds: [
        { name: 'DeepSeek 官方', inputMiss: 1.0, inputHit: 0.02, output: 2.0 },
        { name: '硅基流动', inputMiss: 1.0, inputHit: 0.02, output: 2.0 },
        { name: '阿里云百炼', inputMiss: 1.0, inputHit: 0.02, output: 2.0 },
        { name: '火山引擎', inputMiss: 1.0, inputHit: 0.02, output: 2.0 },
        { name: '腾讯云', inputMiss: 1.2, inputHit: 0.024, output: 2.4 },
        { name: '天翼云', inputMiss: 1.2, inputHit: 0.024, output: 2.4 },
      ],
    },
    'glm-51': {
      title: 'GLM-5.1 档',
      updatedAt: '2026-08-01',
      pricingNote: 'GLM-5.1 公开价（32K 内档位）；智谱官方缓存命中价，其余平台按公开价目整理',
      clouds: [
        { name: '智谱 AI 官方', inputMiss: 6.0, inputHit: 1.3, output: 24.0 },
        { name: '硅基流动', inputMiss: 6.0, inputHit: 1.3, output: 24.0 },
        { name: '阿里云百炼', inputMiss: 6.0, inputHit: 1.3, output: 24.0 },
        { name: '火山引擎', inputMiss: 6.5, inputHit: 1.4, output: 25.0 },
        { name: '腾讯云', inputMiss: 7.0, inputHit: 1.5, output: 26.0 },
        { name: '京东云', inputMiss: 6.8, inputHit: 1.4, output: 25.0 },
      ],
    },
  };

  const EN_CLOUD = {
    'ds-v4': {
      title: 'DeepSeek V4 tier',
      updatedAt: '2026-08-01',
      pricingNote: 'DeepSeek-V4-Flash list prices per DeepSeek API docs (Jul 2026); USD/M tokens.',
      clouds: [
        { name: 'DeepSeek API Official', inputMiss: 0.14, inputHit: 0.0028, output: 0.28 },
        { name: 'Azure AI Foundry (UAE)', inputMiss: 0.21, inputHit: 0.0042, output: 0.56 },
        { name: 'AWS Bedrock (me-central-1)', inputMiss: 0.62, inputHit: 0.62, output: 1.85 },
        { name: 'Azure AI Foundry (Global)', inputMiss: 0.19, inputHit: 0.0038, output: 0.51 },
      ],
    },
    'glm-51': {
      title: 'GLM-5.1 tier',
      updatedAt: '2026-08-01',
      pricingNote: 'GLM-5.1 list prices (≤32K tier) from Zhipu open platform; USD/M tokens.',
      clouds: [
        { name: 'Zhipu Official', inputMiss: 0.84, inputHit: 0.18, output: 3.36 },
        { name: 'SiliconFlow', inputMiss: 0.95, inputHit: 0.19, output: 3.55 },
        { name: 'OpenRouter (Z.AI)', inputMiss: 1.0, inputHit: 0.2, output: 3.2 },
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
      configKeys:
        loc === 'en'
          ? { defaults: 'roi.defaults.en', cloudCompare: 'roi.cloud_compare.en' }
          : { defaults: 'roi.defaults', cloudCompare: 'roi.cloud_compare' },
      localDefaults: loc === 'en' ? EN_DEFAULTS : ZH_DEFAULTS,
      localCloudCompare: loc === 'en' ? EN_CLOUD : ZH_CLOUD,
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
