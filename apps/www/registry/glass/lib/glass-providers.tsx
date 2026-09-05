'use client';

import { GlassProvider } from '@createagle/glass-core';
import type { ReactNode } from 'react';

/**
 * Liquid Glass 的应用级 Provider。
 *
 * 挂在应用根部（Next.js App Router 里就是 `app/layout.tsx` 的 `<body>` 内）：
 *
 * ```tsx
 * import { GlassProviders } from "@/components/glass-providers";
 * import { glassSsrScript } from "@createagle/glass-core";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="zh-CN" suppressHydrationWarning>
 *       <head>
 *         <script dangerouslySetInnerHTML={{ __html: glassSsrScript() }} />
 *       </head>
 *       <body>
 *         <GlassProviders>{children}</GlassProviders>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * `glassSsrScript()` 必须放在 `<head>` 里同步执行 —— 它在首次绘制前就把
 * 主题 / 材质档位 / tier 写到 `<html>` 上，避免首屏闪烁。
 */
export function GlassProviders({ children }: { children: ReactNode }) {
  return <GlassProvider defaultTheme="system">{children}</GlassProvider>;
}
