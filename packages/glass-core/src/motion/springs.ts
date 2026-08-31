/**
 * Spring 预设。对应 PROJECT_SPEC §5.4。
 *
 * SwiftUI 的三个预设直接映射到 Motion 的 `duration + bounce` spring：
 *
 *   .smooth  → bounce 0     材质淡入淡出、透明度
 *   .snappy  → bounce 0.15  **默认**：指示器移动、选中态切换
 *   .bouncy  → bounce 0.3   弹出、抓手回弹
 *
 * PROJECT_SPEC §15.6 明令：全库禁止硬编码 stiffness / damping，
 * 也禁止用 `ease-in-out` 之类的贝塞尔曲线做主要状态过渡。一律用这里的预设。
 */

export interface SpringPreset {
  type: 'spring';
  duration: number;
  bounce: number;
}

export const springs = {
  smooth: { type: 'spring', duration: 0.5, bounce: 0 },
  snappy: { type: 'spring', duration: 0.5, bounce: 0.15 },
  bouncy: { type: 'spring', duration: 0.5, bounce: 0.3 },
} as const satisfies Record<string, SpringPreset>;

export type SpringName = keyof typeof springs;

/**
 * `prefers-reduced-motion` 下的替代过渡。
 * PROJECT_SPEC §13 要求：移除形变/融合动画，只保留 ≤120ms 的透明度过渡。
 */
export const reducedMotionTransition = { duration: 0.12, ease: 'linear' } as const;

/** 按无障碍偏好挑选过渡参数。 */
export function transitionFor(
  name: SpringName,
  reducedMotion: boolean,
): SpringPreset | typeof reducedMotionTransition {
  return reducedMotion ? reducedMotionTransition : springs[name];
}

/**
 * 给非 Motion 场景（纯 CSS 过渡）用的近似值。
 * 注意这只是**近似** —— spring 无法用三次贝塞尔精确表达。
 * 只在 Tier C 或不方便引入 Motion 的地方使用。
 */
export const cssApprox = {
  smooth: 'cubic-bezier(0.32, 0.72, 0, 1) 500ms',
  snappy: 'cubic-bezier(0.32, 0.86, 0.2, 1.02) 500ms',
  bouncy: 'cubic-bezier(0.3, 1.2, 0.35, 1) 500ms',
} as const;
