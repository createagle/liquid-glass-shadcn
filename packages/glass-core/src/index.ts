/**
 * `@glass/core` —— Liquid Glass UI 的光学引擎。
 *
 * 分发边界（PROJECT_SPEC §4 的明确决策，不要合并）：
 *   - **光学引擎**（本包）走 npm，用户 `pnpm add @glass/core`，**不进 registry**
 *   - **组件皮肤**走 shadcn registry，源码落到用户项目里，可自由修改
 *
 * 样式需要单独引入：
 * ```ts
 * import '@glass/core/optics.css';
 * ```
 */

// ── 能力分级 ────────────────────────────────────────────────────────────
export {
  detectTierSync,
  probeFeImage,
  applyTier,
  resolveTier,
  GLASS_TIER_ATTR,
  type GlassTier,
} from './tiers/detect.js';

// ── 滤镜工厂 ────────────────────────────────────────────────────────────
export {
  createDisplacementMap,
  displacementKey,
  DISPLACEMENT_DEFAULTS,
  type DisplacementChannel,
  type DisplacementMapOptions,
  type ResolvedDisplacementMap,
} from './filter/displacement-map.js';

export {
  acquireFilter,
  releaseFilter,
  activeFilterCount,
  resetFilters,
  getFilterContainer,
  REFRACTION_DEFAULTS,
  type RefractionOptions,
} from './filter/filter-factory.js';

export {
  useGlassFilter,
  MAX_ACTIVE_REFRACTIONS,
  type UseGlassFilterOptions,
  type UseGlassFilterResult,
} from './filter/use-glass-filter.js';

// ── Provider ────────────────────────────────────────────────────────────
export {
  GlassProvider,
  useGlass,
  useGlassOptional,
  tintToStep,
  resolveMaterial,
  type GlassTheme,
  type TintStep,
  type GlassContextValue,
  type GlassProviderProps,
} from './provider/glass-provider.js';

export {
  useMediaQuery,
  useGlassPreferences,
  type GlassPreferences,
} from './provider/preferences.js';

export { glassSsrScript, STORAGE_KEYS, type SsrScriptOptions } from './provider/ssr-script.js';

// ── 原语 ────────────────────────────────────────────────────────────────
export { GlassSurface, type GlassLayer, type GlassSurfaceProps } from './surface/glass-surface.js';

// ── 形状 ────────────────────────────────────────────────────────────────
export {
  concentricRadius,
  concentricCorners,
  cornersToCss,
  supportsContinuousCorners,
  continuousCornerStyle,
  type ConcentricOptions,
  type CornerInsets,
  type CornerRadii,
} from './shape/concentric.js';

// ── 动效 ────────────────────────────────────────────────────────────────
export {
  springs,
  cssApprox,
  transitionFor,
  reducedMotionTransition,
  type SpringPreset,
  type SpringName,
} from './motion/springs.js';
