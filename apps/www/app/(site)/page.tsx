import Link from 'next/link';
import { GlassSurface } from '@createagle/glass-core';
import { HeroPhone } from '@/components/hero-phone';
import { ComponentPreview } from '@/components/component-preview';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';
import { registryItems, apiStats } from '@/lib/registry';

/**
 * 首页。
 *
 * Hero 是 PROJECT_SPEC §12 点名要的那个：一台**真的能用**的 iOS 界面，
 * tab bar / 分段控件 / 滑杆 / 开关全是本库组件，没有一张截图。
 * 实现与同屏折射预算的推算在 components/hero-phone.tsx 的文件头。
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pt-10">
      <section className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="max-w-[16ch] text-[clamp(38px,5.4vw,60px)] leading-[1.05] font-semibold tracking-tight">
            玻璃是有光学的， 不只是模糊。
          </h1>
          <p className="max-w-[54ch] text-[19px] leading-relaxed text-[var(--lg-label-secondary)]">
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
            <Link
              href="/docs/materials"
              className="rounded-full px-5 py-3 text-[17px] font-semibold text-[var(--lg-label-primary)] ring-1 ring-[var(--lg-separator)] ring-inset"
            >
              分层原理
            </Link>
          </div>
          <p className="max-w-[54ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
            右边那台是活的 —— 切 tab、拖分段、拉滑杆、开开关都可以，
            也可以直接在里面<strong className="font-semibold text-[var(--lg-label-primary)]">上下滚</strong>：内容从悬浮 Tab Bar
            底下穿过去的那一下，
            才是这套设计语言真正的样子。顶栏的三个开关对它同样生效。
          </p>
        </div>

        <HeroPhone className="shrink-0" />
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
          它折射到的才是没被面板模糊过的背景。完整的推导、可交互的对照与实测数字在{' '}
          <Link href="/docs/materials" className="underline underline-offset-4">
            Materials
          </Link>
          。
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
          <li>🔴 Themes / Playground（实时调档位并导出 CSS 变量片段）还没有。</li>
          <li>🔴 Docs 里的 Theming / Dark Mode / CLI / Registry 四页还没写。</li>
          <li>🟡 代码块没有语法高亮 —— 理由见 components/code-block.tsx 的文件头。</li>
          <li>
            🔴 上面那台手机<strong>没有视觉回归快照</strong> —— 它是个活界面
            （layout 动画 + 滚动），快照会天天飘。现在靠 8 条行为断言钉住「它是活的」。
          </li>
          <li>
            🔴 <Link href="/docs/components/slider" className="underline underline-offset-4">
              Slider
            </Link>{' '}
            那一页真的超了 §5.2 的同屏折射预算：9 个要折射、只批了 8 个，
            有一个 knob 一直在 Tier B。发现了，没修 —— 理由记在 STATUS 的 0.63 一节。
          </li>
          <li>
            🟡 上面那台手机里，唯一<strong>没有</strong>真机基准的仍然是光学本身 ——
            折射强度与色散偏移至今全是 <code>[推定]</code>，见{' '}
            <Link href="/docs/optics" className="underline underline-offset-4">
              Optics
            </Link>
            。
          </li>
        </ul>
      </section>
    </div>
  );
}
