'use client';

import { Button } from '@/components/ui/button';

/**
 * 三档高度加一个正方形图标位。
 *
 * `sm` = 44 不是随手取的：那是 HIG 的最小触控目标 [官方]，再小就不合规。
 * `default` = 48 是 iOS 27 实测；`lg` = 56 是推定值，只为排版层级多给一档。
 */
export default function ButtonSizes() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button size="sm">Small · 44</Button>
      <Button>Default · 48</Button>
      <Button size="lg">Large · 56</Button>
      <Button size="icon" aria-label="更多">
        ⋯
      </Button>
    </div>
  );
}
