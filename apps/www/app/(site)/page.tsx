import Link from 'next/link';
import { GlassSurface } from '@glass/core';
import { ComponentPreview } from '@/components/component-preview';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';
import { registryItems, apiStats } from '@/lib/registry';

/**
 * 首页。
 *
 * ⚠️ **这不是 PROJECT_SPEC §12 要求的那个 Hero。** 规格要的是「一个真实可交互的
 * iOS 风格界面（tab bar + segmented + slider 全部是活的）」，在 Phase 6 任务卡里
 * 排第 5 位，本批没做。这里是一个能用的落地页，把缺口如实写在页面上。
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pt-12">
      <section className="flex flex-col gap-6">
        <h1 className="max-w-[18ch] text-[clamp(38px,6vw,64px)] leading-[1.05] font-semibold tracking-tight">
          玻璃是有光学的， 不只是模糊。
        </h1>
        <p className="max-w-[62ch] text-[19px] leading-relaxed text-[var(--lg-label-secondary)]">
          以 Apple iOS 26 / macOS 26 的 Liquid Glass 为唯一视觉基准的 React 组件库。
          底座磨砂、指示器折射并带可见色散，两者严格分层；尺寸取自官方设计资源，
          每个数字都标着它是官方值、实测值还是推定值。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/docs/components/button"
            className="rounded-full bg-[var(--lg-accent-fill)] px-5 py-3 text-[17px] font-semibold text-[var(--lg-on-accent)]"
          >
            浏览组件
          </Link>
          <span className="text-[15px] text-[var(--lg-label-secondary)]">
            顶栏的三个开关是全站生效的 —— 拉一下「材质」滑杆看看
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[22px] font-semibold">装一个试试</h2>
        <CodeBlock lang="bash" code={'npx shadcn@latest add @glass/select'} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[22px] font-semibold">分层看得见</h2>
        <p className="max-w-[62ch] text-[15px] text-[var(--lg-label-secondary)]">
          下面这个 Select 的面板是 Layer B（磨砂，不折射），高亮项是 Layer I
          （强玻璃，折射且有可见色散）—— 面板会为高亮项挖一个洞，
          它折射到的才是没被面板模糊过的背景。
        </p>
        <ComponentPreview name="select-demo" minHeight={340} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[22px] font-semibold">现在有什么</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {registryItems.map((i) => (
            <Link key={i.name} href={`/docs/components/${i.name}` as never}>
              <GlassSurface
                layer="base"
                radius={22}
                continuous
                className="flex h-full flex-col gap-2 p-5"
              >
                <span className="text-[17px] font-medium">{i.title}</span>
                <span className="line-clamp-3 text-[13px] leading-relaxed text-[var(--lg-label-secondary)]">
                  <RichText text={i.description} />
                </span>
              </GlassSurface>
            </Link>
          ))}
        </div>
        <p className="text-[13px] text-[var(--lg-label-tertiary)]">
          {registryItems.length} 个组件 · {apiStats.labelled + apiStats.unlabelled} 个尺寸常量，
          其中 {apiStats.labelled} 个带可信度标注
          {apiStats.unlabelled ? `，${apiStats.unlabelled} 个还没有` : '（全部）'}。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">这个站点还缺什么</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-[var(--lg-label-secondary)]">
          <li>
            🔴 首页 Hero 还不是规格要求的「完全可交互的 iOS 界面」——
            现在只是一个普通落地页。
          </li>
          <li>🔴 Fidelity 标签页、⌘K 命令面板、Themes / Playground 都还没做。</li>
          <li>🔴 Docs 章节只有骨架；Materials 与 Optics 两页是重点，还没写。</li>
          <li>🟡 代码块没有语法高亮 —— 理由见 components/code-block.tsx 的文件头。</li>
        </ul>
      </section>
    </div>
  );
}
