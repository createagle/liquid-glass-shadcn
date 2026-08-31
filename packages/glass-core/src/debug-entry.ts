/**
 * 调试页入口 —— 只导出**不依赖 React** 的部分，
 * 这样 `debug/index.html` 可以是一个纯 HTML 页面，不需要 Next.js 也不需要 React
 * （PROJECT_SPEC Phase 1 任务卡第 6 条的硬性要求）。
 *
 * 构建：
 *   npx esbuild src/debug-entry.ts --bundle --format=iife \
 *     --global-name=GlassOptics --outfile=debug/glass-optics.js
 */

export {
  createDisplacementMap,
  displacementKey,
  DISPLACEMENT_DEFAULTS,
} from './filter/displacement-map.js';

export {
  acquireFilter,
  releaseFilter,
  activeFilterCount,
  resetFilters,
  getFilterContainer,
  REFRACTION_DEFAULTS,
} from './filter/filter-factory.js';

export { detectTierSync, probeFeImage, applyTier } from './tiers/detect.js';

export { springs, cssApprox } from './motion/springs.js';
