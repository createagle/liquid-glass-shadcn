'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyTier, detectTierSync, probeFeImage, type GlassTier } from '../tiers/detect.js';
import { useGlassPreferences, type GlassPreferences } from './preferences.js';
import { STORAGE_KEYS } from './ssr-script.js';
import {
  resolveLegibleAlpha,
  SECONDARY_ALPHA_AT_FLOOR,
  APPLE_SECONDARY_ALPHA,
  type LegibilityMode,
} from '../a11y/legibility.js';

/**
 * GlassProvider —— PROJECT_SPEC §5（Provider 职责）/ §7（明暗）/ §8（材质档位）。
 *
 * 职责：
 *   - 主题 light / dark / system，写 `.dark` class 与 `data-glass-theme`
 *   - 材质档位 tint 0..1 **连续取值**，在 4 个语义档之间线性插值（不是跳变）
 *   - tier 覆写（文档站需要能手动强制切档以便审查 B / C 的完成度）
 *   - 无障碍偏好订阅并做降级
 *   - localStorage 持久化（与 ssr-script.ts 共用 key）
 */

export type GlassTheme = 'light' | 'dark' | 'system';
/** 4 个语义档位。tint 是连续的，这里只是给档位命名。 */
export type TintStep = 'clear' | 'default' | 'tinted' | 'solid';

export interface GlassContextValue {
  theme: GlassTheme;
  setTheme: (t: GlassTheme) => void;
  /** 解析后的实际外观 */
  resolvedTheme: 'light' | 'dark';

  /** 材质档位，连续值 0..1 */
  tint: number;
  setTint: (v: number) => void;
  /** tint 落在哪个语义档上（仅用于展示） */
  tintStep: TintStep;

  tier: GlassTier;
  /** 强制 tier；传 null 恢复自动检测 */
  setTierOverride: (t: GlassTier | null) => void;
  tierOverride: GlassTier | null;

  preferences: GlassPreferences;
  /** 综合无障碍偏好后，折射是否应当启用 */
  refractionEnabled: boolean;
  /** 可读性策略。`GlassSurface` 据此决定要不要做逐元素背景探测。 */
  legibility: LegibilityMode;
  /** 当前档位插值出的**原始**底座 alpha（未加可读性地板） */
  rawBaseAlpha: number;
}

const GlassContext = createContext<GlassContextValue | null>(null);

/**
 * 材质档位插值表。**只影响 Layer B 底座** ——
 * PROJECT_SPEC §8 明确要求指示器（Layer I）的折射强度不随档位变化，
 * 否则在通透档下玻璃感会整个丢掉。
 */
interface MaterialStop {
  alpha: number;
  blur: number;
  saturate: number;
  /** 描边对比度系数 */
  stroke: number;
}

const STOPS: Record<'light' | 'dark', [MaterialStop, MaterialStop, MaterialStop, MaterialStop]> = {
  // clear → default → tinted → solid
  light: [
    { alpha: 0.34, blur: 8, saturate: 1.9, stroke: 0.5 },
    { alpha: 0.62, blur: 14, saturate: 1.7, stroke: 1.0 },
    { alpha: 0.78, blur: 20, saturate: 1.35, stroke: 1.3 },
    { alpha: 0.96, blur: 26, saturate: 1.05, stroke: 1.6 },
  ],
  dark: [
    { alpha: 0.22, blur: 8, saturate: 1.8, stroke: 0.6 },
    { alpha: 0.44, blur: 14, saturate: 1.6, stroke: 1.0 },
    { alpha: 0.62, blur: 20, saturate: 1.3, stroke: 1.35 },
    { alpha: 0.94, blur: 26, saturate: 1.0, stroke: 1.7 },
  ],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function resolveMaterial(tint: number, scheme: 'light' | 'dark'): MaterialStop {
  const stops = STOPS[scheme];
  const clamped = Math.min(1, Math.max(0, tint));
  const pos = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const t = pos - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return {
    alpha: lerp(a.alpha, b.alpha, t),
    blur: lerp(a.blur, b.blur, t),
    saturate: lerp(a.saturate, b.saturate, t),
    stroke: lerp(a.stroke, b.stroke, t),
  };
}

export function tintToStep(tint: number): TintStep {
  const steps: TintStep[] = ['clear', 'default', 'tinted', 'solid'];
  const idx = Math.round(Math.min(1, Math.max(0, tint)) * 3);
  return steps[idx]!;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 隐私模式：忽略
  }
}

export interface GlassProviderProps {
  children: ReactNode;
  defaultTheme?: GlassTheme;
  /** 默认材质档位。0.34 ≈ 语义档 `default` */
  defaultTint?: number;
  /** 强制 tier，主要给文档站的审查开关用 */
  tier?: GlassTier;
  /**
   * 可读性策略，默认 `guaranteed`（PROJECT_SPEC §13 是「不可协商」项）。
   *
   * `guaranteed` 会把材质 alpha 抬到 AA 地板之上，代价是最通透档
   * 没有名义上那么通透。若确知背景可控，可改 `adaptive` 或 `off`。
   * 取值含义见 `a11y/legibility.ts`。
   */
  legibility?: LegibilityMode;
}

export function GlassProvider({
  children,
  defaultTheme = 'system',
  defaultTint = 0.34,
  tier: tierProp,
  legibility = 'guaranteed',
}: GlassProviderProps) {
  const preferences = useGlassPreferences();

  /**
   * ⚠️ 首次渲染**必须**与服务端产出完全一致，否则 hydration 不匹配（React #418）。
   *
   * 所以这里的初始 state 一律用「服务端也能算出的值」：
   *   - 不读 localStorage
   *   - 不做 tier 检测（一律先当 'c'）
   *   - theme 一律先用 defaultTheme，不看 prefers-color-scheme
   *
   * 真实值在挂载后的 effect 里补上。这不会造成可见闪烁 ——
   * 因为 `glassSsrScript()` 已经在**首次绘制之前**把
   * `.dark` / `data-glass-theme` / `data-glass-tint` / `data-glass-tier`
   * 写到 `<html>` 上了，CSS 从第一帧起就是对的。
   * React 的 state 只是随后追上来，用于 JS 侧的分支（折射滤镜等）。
   *
   * 这正是 PROJECT_SPEC §9 强调的「避免 SSR hydration mismatch」，
   * 也是「内联脚本负责首屏，React 负责挂载后」这套分工的意义。
   * 该 bug 是被 Phase 5 的干净工程冒烟测试抓出来的。
   */
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<GlassTheme>(defaultTheme);
  const [tint, setTintState] = useState<number>(defaultTint);
  const [tierOverride, setTierOverrideState] = useState<GlassTier | null>(tierProp ?? null);
  const [detectedTier, setDetectedTier] = useState<GlassTier>('c');

  // 挂载后一次性把持久化值与真实检测结果读进来
  useEffect(() => {
    const storedTheme = readStored(STORAGE_KEYS.theme) as GlassTheme | null;
    if (storedTheme) setThemeState(storedTheme);

    const rawTint = readStored(STORAGE_KEYS.tint);
    if (rawTint != null) {
      const n = Number.parseFloat(rawTint);
      if (Number.isFinite(n) && n >= 0 && n <= 1) setTintState(n);
    }

    if (!tierProp) {
      const storedTier = readStored(STORAGE_KEYS.tier) as GlassTier | null;
      if (storedTier) setTierOverrideState(storedTier);
    }
    setDetectedTier(detectTierSync());
    setMounted(true);
    // 只跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 挂载前不参考系统偏好，避免首帧与服务端不一致
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (mounted && preferences.prefersDark ? 'dark' : 'light') : theme;

  // 运行时探针：CSS.supports 说 true 不代表滤镜真的产出内容（见 tiers/detect.ts）
  useEffect(() => {
    if (!mounted || detectedTier !== 'a') return;
    let cancelled = false;
    void probeFeImage().then((ok) => {
      if (!cancelled && !ok) setDetectedTier('b');
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, detectedTier]);

  // reduced-transparency 直接把材质压到 Tier C 的表现
  const tier: GlassTier = preferences.reducedTransparency
    ? 'c'
    : (tierOverride ?? detectedTier);

  const refractionEnabled = tier === 'a' && !preferences.reducedTransparency;

  // 把状态写到 <html> 上，CSS 全部用属性选择器分支
  useEffect(() => {
    if (!mounted) return; // 挂载前由 glassSsrScript() 负责，别覆盖它写好的值
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.setAttribute('data-glass-theme', resolvedTheme);
  }, [mounted, resolvedTheme]);

  useEffect(() => {
    if (!mounted) return;
    applyTier(tier);
  }, [mounted, tier]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    // reduced-transparency 时强制 solid 档
    const effective = preferences.reducedTransparency ? 1 : tint;
    const m = resolveMaterial(effective, resolvedTheme);

    /**
     * 可读性地板 —— PROJECT_SPEC §13「档位 0 + 最不利背景仍需过 AA」。
     *
     * 这里传 `null` 当作「没有实测背景」，于是按最不利背景（纯黑↔纯白）求地板。
     * 元素级的实测范围由 `GlassSurface` 自己探测后局部覆盖，
     * 因为背景是**逐元素**不同的，根节点上算不出来。
     */
    const alpha = resolveLegibleAlpha(m.alpha, resolvedTheme, legibility, null);

    root.setAttribute('data-glass-tint', String(effective));
    root.setAttribute('data-glass-tint-step', tintToStep(effective));
    root.setAttribute('data-glass-legibility', legibility);
    root.style.setProperty('--lg-tint', String(effective));
    // ↓ 连续插值出来的底座材质。Layer I 的折射参数不在这里，故不受档位影响。
    root.style.setProperty('--lg-base-alpha', alpha.toFixed(4));
    // 原始（未加地板）的档位值，供需要「真·通透」的场合与调试台对照
    root.style.setProperty('--lg-base-alpha-raw', m.alpha.toFixed(4));
    root.style.setProperty('--lg-base-blur', `${m.blur.toFixed(2)}px`);
    root.style.setProperty('--lg-base-saturate', m.saturate.toFixed(3));
    root.style.setProperty('--lg-stroke-strength', m.stroke.toFixed(3));
    /**
     * secondary 标签的 alpha 也要随地板抬升 —— 否则底座达标了、次级文字仍然不达标。
     * ⚠️ 这会**偏离 Apple 原值 0.6**：Apple 的 secondaryLabel 压在纯白上只有
     * 3.44:1，本身就不过 AA，且任何材质不透明度都救不回来。取舍理由见
     * `a11y/legibility.ts` 的 SECONDARY_ALPHA_AT_FLOOR 注释。
     */
    root.style.setProperty(
      '--lg-label-secondary-alpha',
      legibility === 'off' ? String(APPLE_SECONDARY_ALPHA) : String(SECONDARY_ALPHA_AT_FLOOR),
    );
  }, [mounted, tint, resolvedTheme, preferences.reducedTransparency, legibility]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute(
      'data-glass-contrast',
      preferences.moreContrast ? 'more' : 'normal',
    );
    document.documentElement.setAttribute(
      'data-glass-motion',
      preferences.reducedMotion ? 'reduced' : 'full',
    );
  }, [mounted, preferences.moreContrast, preferences.reducedMotion]);

  const setTheme = useCallback((t: GlassTheme) => {
    setThemeState(t);
    writeStored(STORAGE_KEYS.theme, t);
  }, []);

  const setTint = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setTintState(clamped);
    writeStored(STORAGE_KEYS.tint, String(clamped));
  }, []);

  const setTierOverride = useCallback((t: GlassTier | null) => {
    setTierOverrideState(t);
    writeStored(STORAGE_KEYS.tier, t);
  }, []);

  const value = useMemo<GlassContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      tint,
      setTint,
      tintStep: tintToStep(tint),
      tier,
      setTierOverride,
      tierOverride,
      preferences,
      refractionEnabled,
      legibility,
      rawBaseAlpha: resolveMaterial(
        preferences.reducedTransparency ? 1 : tint,
        resolvedTheme,
      ).alpha,
    }),
    [
      theme,
      setTheme,
      resolvedTheme,
      tint,
      setTint,
      tier,
      setTierOverride,
      tierOverride,
      preferences,
      refractionEnabled,
      legibility,
    ],
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

export function useGlass(): GlassContextValue {
  const ctx = useContext(GlassContext);
  if (!ctx) throw new Error('useGlass 必须在 <GlassProvider> 内部使用');
  return ctx;
}

/** 不抛错的版本，供 GlassSurface 在无 Provider 时也能降级工作 */
export function useGlassOptional(): GlassContextValue | null {
  return useContext(GlassContext);
}

export { resolveMaterial };
