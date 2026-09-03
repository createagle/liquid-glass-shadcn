'use client';

import { Avatar } from '@/components/ui/avatar';

/** 内联的一张渐变图 —— 示例不依赖任何外部资源，复制走也能跑。 */
const SAMPLE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23ff2d55'/%3E%3Cstop offset='1' stop-color='%235856d6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' fill='url(%23g)'/%3E%3C/svg%3E";

/**
 * 三种情况：有图、图挂了、根本没图。
 * 中间那个的地址是故意写错的 —— 它会 onError 回退到首字母，
 * **不会留下一个破图标**。
 */
export default function AvatarDemo() {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={SAMPLE} alt="有头像的用户" />
      <Avatar src="/definitely-not-here.png" alt="图挂了的用户" fallback="WD" />
      <Avatar alt="没有头像的用户" fallback="LG" />
    </div>
  );
}
