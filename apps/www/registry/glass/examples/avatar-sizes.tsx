'use client';

import { Avatar } from '@/components/ui/avatar';

/**
 * ⚠️ 尺寸全是 `[推定]` —— Apple 没有 Avatar 控件，资源里也没有可量的样例。
 * 首字母字号按边长的 0.4 跟随缩放，那个比例同样是推定的。
 */
export default function AvatarSizes() {
  return (
    <div className="flex items-center gap-3">
      {[24, 32, 40, 56].map((s) => (
        <Avatar key={s} size={s} alt={s + ' 点的头像'} fallback="LG" />
      ))}
    </div>
  );
}
