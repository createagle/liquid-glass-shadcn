import Link from 'next/link';
import { GlassSurface } from '@createagle/glass-core';
import { registryItems, apiStats } from '@/lib/registry';

export const metadata = { title: '介绍' };

/**
 * Docs 首页。
 *
 * ⚠️ PROJECT_SPEC §12 要求的 Docs 章节是
 * Introduction / Installation / Theming / Dark Mode / **Materials** / **Optics** /
 * CLI / Registry。本批只有 Introduction 与 Installation；
 * Materials 与 Optics 是任务卡里点名「要写透」的两页，排在第 7 位，还没写。
 * 缺口如实列在页面底部。
 */
export default function DocsIndexPage() {
  return (
    <article className="flex max-w-[72ch] flex-col gap-8 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">介绍</h1>
        <p className="text-[17px] leading-relaxed text-[var(--lg-label-secondary)]">
          Liquid Glass UI 把 Apple 在 iOS 26 / macOS 26 引入的 Liquid Glass
          当作唯一视觉基准，而不是「毛玻璃风格」的又一次再创作。
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">两件事决定了这个库长什么样</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <GlassSurface layer="base" radius={22} continuous className="flex flex-col gap-2 p-5">
            <span className="text-[17px] font-medium">分层：Layer B / Layer I</span>
            <span className="text-[14px] leading-relaxed text-[var(--lg-label-secondary)]">
              底座是磨砂的，<strong>永远不折射</strong> —— 它的首要职责是让上面的字能看清。
              指示器才是真玻璃：折射、色散、镜面高光，而且只在交互态点亮。
              把整个组件做成同一种玻璃是本库明令禁止的做法。
            </span>
          </GlassSurface>
          <GlassSurface layer="base" radius={22} continuous className="flex flex-col gap-2 p-5">
            <span className="text-[17px] font-medium">每个数字都要能说出出处</span>
            <span className="text-[14px] leading-relaxed text-[var(--lg-label-secondary)]">
              尺寸取自 Apple 官方设计资源，逐个标注
              <code className="font-mono"> [官方] </code>
              <code className="font-mono"> [实测] </code>
              <code className="font-mono"> [推定] </code>。
              组件页上那张「尺寸常量与可信度」表直接从源码注释生成 ——
              量不出来的就写量不出来，不拿推定值冒充实测。
            </span>
          </GlassSurface>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">分发方式</h2>
        <p className="text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          光学引擎 <code className="font-mono">@createagle/glass-core</code> 走 npm（滤镜工厂、
          能力分级、Provider、token），组件源码走 shadcn registry
          —— 装进你的工程后可以随便改。两者刻意不合并：引擎要能升级，皮肤要能定制。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">现状</h2>
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          {registryItems.length} 个组件已交付（P0 全部）。
          {apiStats.labelled + apiStats.unlabelled} 个尺寸常量里，{apiStats.labelled}{' '}
          个带可信度标注。
        </p>
        <div className="flex flex-wrap gap-5 text-[15px]">
          <Link href="/docs/materials" className="underline underline-offset-4">
            先读 Materials（分层与可读性）→
          </Link>
          <Link href="/docs/components/button" className="underline underline-offset-4">
            直接看组件 →
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">这一页还缺什么</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-[var(--lg-label-secondary)]">
          <li>🔴 Theming / Dark Mode / CLI / Registry 四页还没有。</li>
          <li>
            🟡 Materials 与 Optics 已经写了 —— 那两页是本库与其他「毛玻璃 UI 库」的分水岭，
            建议从它们开始读。
          </li>
        </ul>
      </section>
    </article>
  );
}
