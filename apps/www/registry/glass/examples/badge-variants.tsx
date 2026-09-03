'use client';

import { Badge } from '@/components/ui/badge';

/**
 * 四个变体里只有 `count`（红底白字的通知角标）有 iOS 对应物，
 * 其余三个是本库为了可用性补的，没有 Apple 依据。
 *
 * 刻意**没有** glass 变体 —— 实测表明徽章通常压在平滑底色上，
 * 那里折射的 meanΔ 只有 2.8/255，等于白花一个折射名额。
 */
export default function BadgeVariants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="count">3</Badge>
      <Badge variant="neutral">草稿</Badge>
      <Badge variant="accent">新</Badge>
      <Badge variant="outline">已归档</Badge>
    </div>
  );
}
