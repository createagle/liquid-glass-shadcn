'use client';

import {
  ResponsiveOverlay,
  ResponsiveOverlayTrigger,
  ResponsiveOverlayContent,
} from '@/components/ui/responsive-overlay';

/**
 * 把浏览器窗口收窄到 768 以下（或用触屏设备打开），
 * 同一段代码会自动换成从底部滑出的 Drawer —— PROJECT_SPEC §9。
 */
export default function ResponsiveOverlayDemo() {
  return (
    <ResponsiveOverlay>
      <ResponsiveOverlayTrigger>更多操作</ResponsiveOverlayTrigger>
      <ResponsiveOverlayContent title="更多操作" description="窄视口下会变成底部 Drawer。">
        <div className="flex flex-col gap-2 text-[17px]">
          <span>移到相簿</span>
          <span>复制链接</span>
          <span>显示简介</span>
        </div>
      </ResponsiveOverlayContent>
    </ResponsiveOverlay>
  );
}
