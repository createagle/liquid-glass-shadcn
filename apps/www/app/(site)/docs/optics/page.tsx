import Link from 'next/link';
import { GlassSurface } from '@createagle/glass-core';
import { TierLab } from '@/components/optics-lab';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';

export const metadata = {
  title: 'Optics',
  description:
    '三级降级、位移场的标定、色散比例、性能红线，以及一件必须说清楚的事：光学参数至今没有真机基准。',
};

/**
 * Optics —— Phase 6 任务卡点名的两页分水岭之二。
 *
 * 这一页与 Materials 的分工：那边讲「材质分几层、每层该长什么样」，
 * 这边讲「这些效果在浏览器里到底怎么做出来，做不出来时降级成什么」。
 *
 * ⚠️ 最后一节是本页最重要的一节：**光学参数至今没有真机基准。**
 * 一个讲光学的页面如果不写这件事，就是在拿推定值冒充实测值。
 */

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-28 flex-col gap-4">
      <h2 className="text-[26px] font-semibold tracking-tight">{title}</h2>
      {lead ? (
        <p className="max-w-[72ch] text-[17px] leading-relaxed text-[var(--lg-label-secondary)]">
          {lead}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function Note({ tone = 'plain', children }: { tone?: 'plain' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border-l-[3px] px-4 py-3 text-[15px] leading-relaxed"
      style={{
        borderColor: tone === 'warn' ? 'var(--lg-on-glass-orange)' : 'var(--lg-separator)',
        background: 'var(--lg-fill-quaternary)',
      }}
    >
      {children}
    </div>
  );
}

const TIERS: { tier: string; who: string; how: string; note: string }[] = [
  {
    tier: 'A',
    who: '支持 backdrop-filter: url(#x)（Chromium 系）',
    how: 'SVG feDisplacementMap 真折射 + 三通道色散 + 镜面高光',
    note: '完整方案。底座挖洞让指示器看到未被模糊的背景。',
  },
  {
    tier: 'B',
    who: '支持 blur() 但不支持 url()（Safari、Firefox）',
    how: '≤1px 微模糊 + 提亮 + 多层 inset 阴影模拟边缘透镜 + 渐变边框模拟彩边',
    note: '**不是「坏掉的 A」** —— 拿不到真色散，但拿得到「边缘有彩色」这个信号。',
  },
  {
    tier: 'C',
    who: '不支持 backdrop-filter',
    how: '半透明纯色 + 描边 + 渐变高光；不透明度上调 0.26 补偿没有模糊',
    note: '结构与可读性必须完全正确，只是没有玻璃感。',
  },
];

export default function OpticsPage() {
  return (
    <article className="flex max-w-[80ch] flex-col gap-14 pb-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">Optics</h1>
        <p className="text-[19px] leading-relaxed text-[var(--lg-label-secondary)]">
          折射、色散、镜面高光在浏览器里怎么做出来；做不出来的时候降级成什么；
          以及一件必须先说清楚的事 ——
          <strong className="font-medium">这些参数至今没有真机基准</strong>。
        </p>
      </header>

      <Section
        id="tiers"
        title="三级降级：每一档都是完整设计"
        lead="判据是特性检测，不是 UA 嗅探。三条路径各自都要看起来像一个做完的设计，而不是「高配的残缺版」。"
      >
        <TierLab />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[14px]">
            <thead>
              <tr>
                {['Tier', '什么浏览器', '怎么做', '说明'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[var(--lg-separator)] px-3 py-2 text-left text-[13px] font-medium text-[var(--lg-label-secondary)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.tier}>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 font-mono font-semibold">
                    {t.tier}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {t.who}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {t.how}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    <RichText text={t.note} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CodeBlock
          lang="ts"
          code={`const blur = CSS.supports('backdrop-filter', 'blur(10px)');
const url = CSS.supports('backdrop-filter', 'url(#x)');
if (blur && url) return 'a';
if (blur) return 'b';
// Safari 只认带前缀的写法时，这里仍应判为 B 而不是 C
if (CSS.supports('-webkit-backdrop-filter', 'blur(10px)')) return 'b';
return 'c';`}
        />

        <Note tone="warn">
          <strong className="font-medium">不要用 -webkit- 前缀做检测 key。</strong>
          实测 Chromium 148 对带前缀写法的 <code className="font-mono">CSS.supports()</code>{' '}
          返回 false，尽管无前缀完全可用。带前缀只在<strong className="font-medium">输出 CSS</strong>
          时作为 Safari 兼容补充。
        </Note>

        <Note>
          <strong className="font-medium">Firefox 落在 Tier B，与 PROJECT_SPEC 的括注不同。</strong>
          SPEC 的 Tier C 行括号里写了「含 Firefox 默认配置」，但 Firefox 自 103 起已默认支持{' '}
          <code className="font-mono">backdrop-filter: blur()</code>。
          实现严格执行 SPEC 给出的<strong className="font-medium">判据</strong>，而不是那句括注。
        </Note>
      </Section>

      <Section
        id="probe"
        title="CSS.supports 说 true，不代表滤镜真的产出了内容"
        lead="这是 Phase 0 最直接的教训，也是本库为什么在特性检测之外还要跑一次运行时探针。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          当时 <code className="font-mono">CSS.supports(&apos;backdrop-filter&apos;,&apos;url(#x)&apos;)</code>{' '}
          返回 true，但因为承载滤镜的 <code className="font-mono">&lt;svg&gt;</code> 尺寸属性为 0，
          <code className="font-mono">feImage</code> 静默输出为空 ——
          <strong className="font-medium">整条折射链失效却不报任何错</strong>。
          探针的做法是把一个「只有 feImage」的滤镜作用在 SVG 内的矩形上，光栅化到 canvas 后读回像素。
        </p>
        <Note tone="warn">
          探针有已知局限：它验证的是 <strong className="font-medium">SVG 光栅化路径</strong>下的 feImage，
          与 <code className="font-mono">backdrop-filter</code> 的合成路径并不完全等价
          （后者无法从 JS 读回像素）。它能挡住「feImage 完全没实现」，
          挡不住只在 backdrop 路径上失效的情况。真正的护栏是<strong className="font-medium">按正确写法构造滤镜</strong>。
        </Note>
      </Section>

      <Section
        id="scale"
        title="位移量必须按短边比例，绝对像素从原理上就不成立"
        lead="这是本库在光学上犯过的最大一个错，也是最值得别人抄走的一条教训。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <code className="font-mono">distortionScale</code> 原先是绝对像素（档位 −110 / −180 / −260），
          在调试页那**一个尺寸**（117×45）上标定得挺好。做 Tabs 时露馅：
          85×54 的指示器上，−180 意味着
          <strong className="font-medium">边缘位移 ±90px —— 超过元素本身的宽度</strong>。
          边缘于是采样到完全无关的远处内容，整体糊成一团不贴合胶囊的团块，
          并在边界留下一道生硬的深色闭合曲线。
        </p>
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          绝对值从原理上就不成立：同一套参数要同时服务 24px 的 Slider knob 与 390px 宽的 Sheet，
          <strong className="font-medium">只有比例才可能两头都对</strong>。改成短边的比例：
        </p>
        <CodeBlock
          lang="ts"
          code={`const REFRACT_RATIO = { 1: -0.45, 2: -0.7, 3: -1.0 } as const;
const scale = REFRACT_RATIO[intensity] * Math.min(width, height);

// 色散偏移也改成相对 |scale| 的比例 —— 位移随尺寸缩放了，
// 偏移量不跟着缩放就会在小元素上变成整片彩虹
const DISPERSE_RATIO = {
  1: { green: 0.065, blue: 0.16 },
  2: { green: 0.13,  blue: 0.32 },
  3: { green: 0.2,   blue: 0.48 },
} as const;`}
        />
        <Note tone="warn">
          <strong className="font-medium">教训：光学参数只在一个尺寸上标定，等于没标定。</strong>
        </Note>
      </Section>

      <Section
        id="radial"
        title="衰减必须是径向的，不能是矩形的"
        lead="改完比例之后仍然残留一道单色蓝竖线贴在右缘。根因不是参数，是构造。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          原贴图把线性梯度<strong className="font-medium">铺满全图</strong>，
          再用一块模糊的圆角矩形把中心压回中性。于是衰减轮廓是
          <strong className="font-medium">矩形</strong>的 —— 位移场是「剪切」而不是径向透镜，
          各方向不对称，色散在某一侧堆积成单色边。
        </p>
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          改成：中性灰基底（零位移）+ 线性梯度用<strong className="font-medium">径向剖面遮罩</strong>。
          位移向量因此是 <code className="font-mono">A(r) × (x−cx, y−cy)</code>，
          方向严格指向外，<strong className="font-medium">天然对称</strong>。
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <li>
            基底从<strong className="font-medium">黑色改为中性灰</strong>。黑色在{' '}
            <code className="font-mono">feDisplacementMap</code> 里等于最大负位移，
            未被梯度覆盖的区域（如圆角外）会整片剧烈偏移。
          </li>
          <li>
            两条梯度的合并从 <code className="font-mono">difference</code> 改为{' '}
            <code className="font-mono">screen</code>。中性灰基底上 difference 会反相。
          </li>
        </ul>
      </Section>

      <Section
        id="budget"
        title="性能红线：同屏 8 个折射实例"
        lead="超过之后新实例不再创建滤镜，直接借用 Tier B 的处理。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          降级实例仍然是一个<strong className="font-medium">完成度正确的设计</strong>，
          而不是一块空白 —— 与 Tier B 走的是同一套 CSS（
          <code className="font-mono">[data-refraction=&apos;off&apos;]</code>）。
          开发模式下会在控制台打一条 warn，说明是哪种降级、该怎么办。
        </p>
        <Note tone="warn">
          <strong className="font-medium">8 这个数字是 PROJECT_SPEC 的 [推定] 值</strong>，
          Apple 并未给出任何上限，本库也没有做过帧率实测来验证它。
          它现在的作用是「有一个上限」而不是「这个上限是对的」。
        </Note>
      </Section>

      <Section
        id="a11y"
        title="三种无障碍偏好下的降级"
        lead="PROJECT_SPEC §13 把这三条列为不可协商。它们改的是 token，所以对所有组件一次性生效。"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <thead>
              <tr>
                {['偏好', '做什么'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[var(--lg-separator)] px-3 py-2 text-left text-[13px] font-medium text-[var(--lg-label-secondary)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [
                    'prefers-reduced-transparency',
                    '全部材质切到 solid 档位，移除 backdrop-filter 与折射；内容层也压成不透明',
                  ],
                  [
                    'prefers-reduced-motion',
                    '移除形变动画，保留 ≤120ms 的透明度过渡；spring 预设自动退化，组件不需要各自判断',
                  ],
                  ['prefers-contrast: more', '提高描边对比、标签色升到实色、加强分隔线'],
                ] as const
              ).map(([k, v]) => (
                <tr key={k}>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 font-mono text-[13px]">
                    {k}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          动效那一条走 <code className="font-mono">transitionFor()</code> 而不是直接用{' '}
          <code className="font-mono">springs.snappy</code> —— 后者在该偏好下依然会做弹簧位移。
          组件里凡是过渡，一律经过这个函数。
        </Note>
      </Section>

      <Section
        id="no-baseline"
        title="必须说清楚：光学参数至今没有真机基准"
        lead="这一节是本页最重要的一节。"
      >
        <GlassSurface layer="base" radius={20} continuous className="flex flex-col gap-3 p-5">
          <p className="text-[15px] leading-relaxed">
            本库的<strong className="font-medium">几何</strong>推到了能推的极限：Tab Bar、Switch、
            Slider、Alert、Menu、Button、Grouped List、Sheet、菜单项内部布局都有实测，
            每个数字旁边标着 <code className="font-mono">[官方]</code>{' '}
            <code className="font-mono">[实测]</code> <code className="font-mono">[推定]</code>。
          </p>
          <p className="text-[15px] leading-relaxed">
            <strong className="font-medium">光学不是。</strong>
            折射强度、色散偏移、镜面高光的亮度、knob 与抓手静止态该白到什么程度 ——
            至今<strong className="font-medium">全是 [推定]</strong>。
          </p>
          <p className="text-[15px] leading-relaxed">
            原因很简单：<strong className="font-medium">没有 iOS 真机截图</strong>。
            现有的参考图是 Apple Design Resources 的 Figma 渲染稿，
            而 Figma 画不出折射与色散 —— 静态设计稿本来就没有这些信息。
          </p>
          <p className="text-[15px] leading-relaxed">
            这件事有一个直接后果：
            <strong className="font-medium">Tier A 与 Tier B 在常规尺寸下不易区分</strong>。
            径向场消除了伪影，但折射也变温和了；放大能看到对称彩边，小尺寸下偏弱。
            强度档位可能需要上调，但<strong className="font-medium">在拿到真机截图之前不做</strong> ——
            没有基准的调参就是来回瞎试。
          </p>
        </GlassSurface>

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          能做的是给出<strong className="font-medium">相对</strong>证据。DropdownMenu 那一批第一次量到：
          6px 条纹背景上，高亮项内的最大通道差是 <span className="font-mono">29</span>，
          同一面板未高亮处是 <span className="font-mono">2</span>；挖洞让条纹清晰度约翻倍
          （σ 34.7 vs 17–18）。Select 那一批补上了绝对证据 —— 洞与项在 1px 内对齐。
          <br />
          <br />
          但<strong className="font-medium">「29 是不是对的」仍然无从校准</strong>。
          这一页不会假装它是。
        </p>
      </Section>

      <Section id="next" title="接下来">
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          回到{' '}
          <Link href="/docs/materials" className="underline underline-offset-4">
            Materials
          </Link>{' '}
          看分层与可读性地板，或者直接去{' '}
          <Link href="/docs/components/tabs" className="underline underline-offset-4">
            Tabs
          </Link>{' '}
          看这套东西在一个真实组件上长什么样 —— 那一页有与 Apple 参考图的并排对照。
        </p>
      </Section>
    </article>
  );
}
