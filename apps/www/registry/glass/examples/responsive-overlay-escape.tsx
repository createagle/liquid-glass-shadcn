'use client';

import {
  ResponsiveOverlay,
  ResponsiveOverlayTrigger,
  ResponsiveOverlayContent,
} from '@/components/ui/responsive-overlay';

/**
 * 逃生口：`responsive={false}` 之后，窄视口下**也**留在锚定浮层。
 * 与上面那个并排收窄窗口，就能看出两者的差别。
 */
export default function ResponsiveOverlayEscape() {
  return (
    <ResponsiveOverlay responsive={false}>
      <ResponsiveOverlayTrigger>始终是锚定浮层</ResponsiveOverlayTrigger>
      <ResponsiveOverlayContent title="不随视口切换" description="responsive={false}">
        <p className="text-[15px]">收窄窗口也不会变成 Drawer。</p>
      </ResponsiveOverlayContent>
    </ResponsiveOverlay>
  );
}
