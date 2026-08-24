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
    tpsInputMiss: 600,
    tpsInputHit: 12000,
    tpsOutput: 100,
    pctMixMiss: 20,
    pctMixHit: 70,
    pctMixOut: 10,
    annualFixedOpex: 110,
    capexOpexPct: 3,
    serviceModel: 'ds-v4',
  };

  const ZH_CLOUD = {
    'ds-v4': {
      title: 'DeepSeek V4 档',
      updatedAt: '2026-08-24',
      pricingNote: 'DeepSeek-V4-Flash 高峰时段公开价（api-docs.deepseek.com/zh-cn）；各平台按 2026-08 峰谷调价后高峰价目整理，单位元/百万 Token',
      refInputMiss: 3.0,
      refInputHit: 0.1,
      refOutput: 9.0,
      clouds: [
        { name: 'DeepSeek 官方', inputMiss: 3.0, inputHit: 0.1, output: 9.0 },
        { name: '硅基流动', inputMiss: 1.0, inputHit: 0.02, output: 2.0 },
        { name: '阿里云百炼', inputMiss: 3.0, inputHit: 0.3, output: 9.0 },
        { name: '火山引擎', inputMiss: 3.0, inputHit: 0.1, output: 9.0 },
        { name: '腾讯云', inputMiss: 3.0, inputHit: 0.1, output: 9.0 },
        { name: '天翼云', inputMiss: 3.6, inputHit: 0.12, output: 10.8 },
      ],
    },
    'glm-52': {
      title: 'GLM-5.2 档',
      updatedAt: '2026-08-06',
      pricingNote: 'GLM-5.2 公开价；智谱 AI 开放平台 open.bigmodel.cn 价目，单位元/百万 Token',
      refInputMiss: 8.0,
      refInputHit: 2.0,
      refOutput: 28.0,
      clouds: [
        { name: '智谱 AI 官方', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '硅基流动', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '阿里云百炼', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '火山引擎', inputMiss: 8.5, inputHit: 2.1, output: 29.0 },
        { name: '腾讯云', inputMiss: 8.0, inputHit: 2.0, output: 28.0 },
        { name: '京东云', inputMiss: 8.2, inputHit: 2.0, output: 28.5 },
      ],
    },
  };

  const EN_CLOUD = {
    'ds-v4': {
      title: 'DeepSeek V4 tier',
      updatedAt: '2026-08-24',
      pricingNote: 'DeepSeek-V4-Flash peak-hour list prices per api-docs.deepseek.com (Aug 2026); USD/M tokens for overseas clouds.',
      refInputMiss: 0.44,
      refInputHit: 0.014,
      refOutput: 1.32,
      clouds: [
        { name: 'DeepSeek API Official', inputMiss: 0.44, inputHit: 0.014, output: 1.32 },
        { name: 'Tencent Cloud (peak)', inputMiss: 0.44, inputHit: 0.014, output: 1.32 },
        { name: 'Azure AI Foundry (UAE)', inputMiss: 0.66, inputHit: 0.021, output: 1.98 },
        { name: 'AWS Bedrock (me-central-1)', inputMiss: 0.62, inputHit: 0.62, output: 1.85 },
        { name: 'Azure AI Foundry (Global)', inputMiss: 0.57, inputHit: 0.019, output: 1.71 },
      ],
    },
    'glm-52': {
      title: 'GLM-5.2 tier',
      updatedAt: '2026-08-06',
      pricingNote: 'GLM-5.2 list prices from Z.AI / Zhipu open platform; USD/M tokens.',
      refInputMiss: 1.40,
      refInputHit: 0.26,
      refOutput: 4.40,
      clouds: [
        { name: 'Z.AI Official', inputMiss: 1.40, inputHit: 0.26, output: 4.40 },
        { name: 'SiliconFlow', inputMiss: 1.45, inputHit: 0.27, output: 4.50 },
        { name: 'OpenRouter (Z.AI)', inputMiss: 1.50, inputHit: 0.28, output: 4.60 },
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
