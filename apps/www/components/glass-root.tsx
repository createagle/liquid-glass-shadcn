'use client';

import { GlassProvider } from '@createagle/glass-core';

/**
 * 全站的 GlassProvider。
 *
 * 单独拆一个客户端组件，是为了让 `app/layout.tsx` 保持服务端组件 ——
 * 那里要同步注入 `glassSsrScript()`，而那段脚本必须在**首帧绘制之前**跑完。
 */
export function GlassRoot({ children }: { children: React.ReactNode }) {
  return <GlassProvider defaultTheme="system">{children}</GlassProvider>;
}
