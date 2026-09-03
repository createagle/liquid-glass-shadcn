'use client';

import { Progress } from '@/components/ui/progress';

/**
 * 不定态 —— 不知道还要多久。
 *
 * 关键不在动画，在**无障碍语义**：不定态下组件不会写 `aria-valuenow`，
 * 辅助技术正是靠「有 role=progressbar 但没有 valuenow」播报「进行中，进度未知」。
 * 填一个假的 0 会让屏幕阅读器念出「0%」，比不说更糟。
 *
 * `prefers-reduced-motion` 下条纹完全静止 —— 但仍然是条纹，
 * 既不像空轨道也不像满轨道，视觉上还读得出「在进行」。
 */
export default function ProgressIndeterminate() {
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-2">
      <Progress aria-label="正在连接" />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">正在连接…</span>
    </div>
  );
}
