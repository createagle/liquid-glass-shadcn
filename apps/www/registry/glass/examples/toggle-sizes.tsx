'use client';

import { Toggle } from '@/components/ui/toggle';

/**
 * Toggle 的几何完全继承 Button（它没有属于自己的 Apple 参考图），
 * 所以三档高度与胶囊圆角逐项相同 —— 有测试钉住这件事。
 */
export default function ToggleSizes() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Toggle size="sm">Small</Toggle>
      <Toggle defaultPressed>Default</Toggle>
      <Toggle size="lg">Large</Toggle>
      <Toggle size="icon" defaultPressed aria-label="加粗">
        B
      </Toggle>
    </div>
  );
}
