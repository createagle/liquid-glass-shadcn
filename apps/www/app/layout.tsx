import type { Metadata } from 'next';
import { glassSsrScript } from '@createagle/glass-core';
import { GlassRoot } from '@/components/glass-root';
import './globals.css';

/**
 * 根布局只负责三件事：html/body、防闪烁脚本、GlassProvider。
 *
 * 顶栏与侧栏在 `app/(site)/layout.tsx` —— 分成路由组是为了让
 * `/view/[name]`（独立全屏预览，SPEC §12）**不带任何站点装饰**，
 * 同时仍然共享同一个 Provider 与同一块玻璃。
 */
export const metadata: Metadata = {
  title: {
    default: 'Liquid Glass UI',
    template: '%s · Liquid Glass UI',
  },
  description:
    '以 Apple iOS 26 / macOS 26 的 Liquid Glass 设计语言为唯一视觉基准的 React 组件库。光学引擎走 npm，组件源码走 shadcn registry。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * `suppressHydrationWarning`：下面那段内联脚本会在 React 接管之前
     * 往 <html> 上写 class 与 data-glass-*，服务端渲染的标记必然与之不同。
     * 这是防闪烁的固有代价，也是 next-themes 等库的同一处理。
     */
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/*
          首屏防闪烁 —— PROJECT_SPEC §12「暗色模式无闪烁（内联脚本）」。

          必须**同步执行、且在 `<head>` 里**：它要在 `<body>` 被解析出来之前，
          就把主题 / 材质档位 / tier 三个属性写到 `<html>` 上。
          放进 body（`next/script` 的 beforeInteractive 就是这么放的）意味着
          浏览器已经开始解析会绘制背景的元素了 —— 差的那一点点正是闪烁本身。

          ⚠️ 这会让 Next 在**开发模式**下打一条警告：
             "Encountered a script tag while rendering React component."
          它说的是「客户端渲染时这段不会执行」—— 对我们成立也无所谓，
          这段脚本本来就只需要在首屏跑一次。
          换成 `next/script` 试过：警告照旧（它内部也是渲染一个 script 标签），
          而注入位置反而从 head 掉到了 body 开头。**所以保留裸标签。**
          这条警告在 tests/docs-site.behavior.spec.ts 的白名单里，附了原因。
        */}
        <script dangerouslySetInnerHTML={{ __html: glassSsrScript({ defaultTheme: 'system' }) }} />
      </head>
      <body>
        <GlassRoot>{children}</GlassRoot>
      </body>
    </html>
  );
}
