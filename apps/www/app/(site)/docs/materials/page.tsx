import Link from 'next/link';
import { GlassSurface } from '@createagle/glass-core';
import { LayerCompare, PunchCompare, AlphaLab } from '@/components/optics-lab';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';

export const metadata = {
  title: 'Materials',
  description:
    'Layer B 与 Layer I 是两种材质，不是同一种材质的两个强度。分层、挖洞、α=0 陷阱与可读性地板的完整推导。',
};

/**
 * Materials —— Phase 6 任务卡点名的两页分水岭之一。
 *
 * 「写透」不是字多，是**每个论断旁边都能自己按一下看到**：
 * 分层对照、挖洞开关、α 滑杆全是活的，而且默认落在 6px 条纹背景上 ——
 * 折射与色散在平滑渐变上本来就看不出来，只给渐变的演示等于什么都没演示。
 *
 * 页面上的每个数字都来自仓库里的实测记录，出处逐条写在正文里。
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

/** PROJECT_SPEC §2 的分层速查表，逐条抄过来 */
const LAYER_TABLE: [string, string, string][] = [
  ['Tabs / Segmented', '整条凹槽', '选中指示器'],
  ['Slider', '轨道 + 已填充段', 'knob（拖动时强度拉满）'],
  ['Switch', '轨道', 'knob'],
  ['Tab Bar / Toolbar / Dock', '整条栏', '选中项胶囊、按下的按钮'],
  ['Select / Dropdown / Popover', '弹层面板', '高亮项（hover / focus）'],
  ['Sheet / Drawer', '面板', 'grabber 抓手'],
  ['Dialog', '面板', '——'],
  ['Button', '静止：底座', '按下：升级为 Layer I'],
  ['Card / Table / List / Accordion', '两者都不用（内容层）', '——'],
];

/** 挖洞四种写法的实测（debug/holepunch-probe.html，判据是沿水平线的像素标准差） */
const PUNCH_TABLE: [string, string, string, string][] = [
  ['A 不挖洞（对照）', 'σ 0.5', 'σ 0.5', '全糊 —— 指示器看到的是被底座模糊过的背景'],
  ['B mask 直接挖在玻璃上', 'σ 0.5', 'σ 127.5', '洞内清晰，**但材质底色也被一起挖掉了**'],
  ['C 模糊放子层 + mask', 'σ 0.8', 'σ 89.0', '洞内清晰，底色保留 ✅'],
  ['D 模糊放子层 + clip-path', '同 C', '同 C', '同 C，**且支持圆角洞** ✅✅'],
];

export default function MaterialsPage() {
  return (
    <article className="flex max-w-[80ch] flex-col gap-14 pb-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">Materials</h1>
        <p className="text-[19px] leading-relaxed text-[var(--lg-label-secondary)]">
          Liquid Glass 不是一种均匀铺开的材质，而是<strong className="font-medium">一套分层系统</strong>。
          绝大多数「毛玻璃组件库」失败，都是因为把整个组件做成了同一种玻璃。
        </p>
      </header>

      <Section
        id="two-layers"
        title="两种材质，不是两个强度"
        lead="观察 iOS 的 tab bar、segmented control、slider，你会看到两个截然不同的材质层。它们的职责不同，因此实现也必须不同。"
      >
        <LayerCompare />

        <div className="grid gap-4 sm:grid-cols-2">
          <GlassSurface layer="base" radius={20} continuous className="flex flex-col gap-2 p-5">
            <span className="text-[17px] font-medium">Layer B —— 磨砂底座</span>
            <span className="text-[14px] leading-relaxed text-[var(--lg-label-secondary)]">
              整条胶囊、整个凹槽、整条轨道。它的首要职责是
              <strong className="font-medium">可读性</strong>，不是炫技：几乎没有可见的折射畸变、
              没有色散彩边、没有强镜面高光。
              <br />
              <br />
              实现是 <code className="font-mono">backdrop-filter: blur() saturate()</code> +
              半透明 tint 底色 + 一根 hairline 描边 + 克制的落影。
              <br />
              <br />
              <strong className="font-medium">禁止对底座使用 feDisplacementMap</strong> ——
              底座扭曲会直接毁掉其上文字的可读性。
            </span>
          </GlassSurface>

          <GlassSurface layer="base" radius={20} continuous className="flex flex-col gap-2 p-5">
            <span className="text-[17px] font-medium">Layer I —— 强玻璃指示器</span>
            <span className="text-[14px] leading-relaxed text-[var(--lg-label-secondary)]">
              选中态胶囊、slider 与 switch 的 knob、菜单的高亮项。
              这里才是真正的 Liquid Glass，而且要做得比你以为的更强烈：
              <br />
              <br />
              透镜畸变、<strong className="font-medium">可见的色散彩边</strong>、镜面高光、
              边缘提亮而中心通透。
              <br />
              <br />
              关键判据：
              <strong className="font-medium">指示器区域看到的背景应当比底座更清晰</strong>，
              而不是更模糊。它是「玻璃透镜浮在磨砂板上」，不是「两层磨砂叠加」。
            </span>
          </GlassSurface>
        </div>

        <Note>
          <strong className="font-medium">交互态才点亮。</strong>
          静止时指示器保持中等强度；按下 / 拖动时折射强度、色散偏移、高光亮度、缩放
          <strong className="font-medium">同时</strong>上扬，松手用 spring 回落而不是 ease。
          对应 Apple 那句 “the knob transforms into Liquid Glass during interaction”。
        </Note>
      </Section>

      <Section
        id="cheatsheet"
        title="分层速查表"
        lead="哪一块是 Layer B、哪一块是 Layer I，不是每次现判断的。下表逐条来自 PROJECT_SPEC §2，实现时照着抄。"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr>
                {['组件', 'Layer B（磨砂底座）', 'Layer I（强玻璃）'].map((h) => (
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
              {LAYER_TABLE.map(([name, b, i]) => (
                <tr key={name}>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 font-medium">
                    {name}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {b}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {i}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Note tone="warn">
          最后一行值得单独说：
          <strong className="font-medium">内容型组件两者都不用。</strong>
          Card / Table / List / Accordion 是承载内容的，
          <strong className="font-medium">材质属于控件层</strong>。
          在列表上堆玻璃是「毛玻璃 UI」最常见的走样方式，本库把它写成了明令禁止项。
          本库的 <code className="font-mono">Card</code> 因此
          <strong className="font-medium">刻意没有 glass 变体</strong>。
        </Note>
      </Section>

      <Section
        id="punch"
        title="挖洞：唯一能真正达成 SPEC 要求的做法"
        lead="「指示器看到的背景比底座更清晰」这句话，在纯 CSS 里没有声明式解法。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <code className="font-mono">backdrop-filter</code> 作用于元素背后
          <strong className="font-medium">已绘制的全部内容</strong>，其中包含父级底座模糊后的结果。
          所以嵌在底座里的指示器<strong className="font-medium">永远</strong>看到「已经被底座模糊过」的背景，
          不可能比底座更清晰。只要底座画在指示器后面，它就属于指示器的 backdrop。
        </p>

        <PunchCompare />

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          做法是把底座的模糊移到一个独立子层上，再在指示器所在位置把这个子层挖穿。
          四种写法都实测过（<code className="font-mono">debug/holepunch-probe.html</code>，
          判据是沿水平线的像素标准差 —— 条纹越清晰方差越大）：
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <thead>
              <tr>
                {['写法', '洞外', '洞内', '结论'].map((h) => (
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
              {PUNCH_TABLE.map(([w, out, inside, note]) => (
                <tr key={w}>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5">{w}</td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 font-mono text-[13px]">
                    {out}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 font-mono text-[13px]">
                    {inside}
                  </td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    <RichText text={note} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          选 D。指示器是胶囊形，<code className="font-mono">linear-gradient</code> 只能挖直角洞；
          <code className="font-mono">clip-path: path(evenodd, …)</code> 用「外框 + 内框」两个子路径，
          evenodd 填充规则让内框成为洞。
        </p>

        <CodeBlock
          lang="tsx"
          code={`import { GlassSurface, measurePunch, usePunchState } from '@createagle/glass-core';

// 值没变就不重渲染 —— 观察器每次触发都会产生新对象
const [punch, setPunch] = usePunchState();

// ⚠️ 基准必须是 .lg-surface 本体，不是装内容的那个 div：
//    后者在底座的内边距里面，直接相减会让洞整体偏一个内边距。
const surface = node.closest('.lg-surface');
setPunch(measurePunch(surface, highlightedItem, radius));

<GlassSurface layer="base" punch={punch}>…</GlassSurface>`}
        />

        <Note tone="warn">
          <strong className="font-medium">这个洞曾经偏了整整 (16, 10)，而且没人发现。</strong>
          DropdownMenu 最初拿「装内容的那个 div」当基准，而它在面板 10/16 的内边距里面。
          偏了之后洞与项仍有约 90% 重叠，「条纹清晰度翻倍」的实测照样成立 ——
          光学结论是对的，位置却一直没人验。做 Select 时才查出来，现在有逐像素对齐的断言。
        </Note>
      </Section>

      <Section
        id="alpha"
        title="α = 0 陷阱：材质透明了，保证也就没了"
        lead="玻璃把背景合成成 C = a·F + (1−a)·B。这个式子有一个决定性的性质：C 的值域宽度是 (1−a)，与背景 B 是什么无关。"
      >
        <AlphaLab />

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          换句话说：<strong className="font-medium">能否保证对比度，只由 a 决定，不由背景决定。</strong>
          这条推翻了两个直觉方案，两个都已实测证伪：
        </p>

        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <li>
            ✗ <code className="font-mono">mix-blend-mode: difference</code> 让文字自动反色 ——
            difference 保证的是 RGB 差，不是<strong className="font-medium">亮度差</strong>。
            中灰 #808080 上白字反色成 #7F7F7F，亮度几乎不变，
            <strong className="font-medium">实测 1.04:1，字直接消失</strong>。
          </li>
          <li>
            ✗ 元素级翻转<strong className="font-medium">文字颜色</strong> ——
            一个元素底下可以同时有纯黑和纯白（棋盘格、照片）。单一极性必然顾此失彼，
            实测比不自适应还差。
          </li>
        </ul>

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          正确的自适应对象是<strong className="font-medium">不透明度</strong>，不是文字颜色。
          这也正是 Apple 的说法：“Liquid Glass appears more opaque in larger elements like
          sidebars to preserve legibility over complex backgrounds.”
        </p>

        <Note tone="warn">
          <strong className="font-medium">这不是理论问题，是真撞过的车。</strong>
          PROJECT_SPEC 要求「按钮按下时升级为 Layer I」，而{' '}
          <code className="font-mono">.lg-surface[data-layer=&apos;indicator&apos;]</code>{' '}
          的 background-color 是 transparent，也就是 a = 0。实测 6px 条纹背景上，按钮标签对比度
          <br />
          <span className="font-mono">静止 15.46:1 → 按下 1.92:1</span>
          <br />
          字直接看不见。而同一个按钮在<strong className="font-medium">平滑渐变</strong>背景上是
          15.46 → 13.03，完全正常 —— 也就是说
          <strong className="font-medium">只在高频背景上翻车，看普通截图永远发现不了</strong>。
          <br />
          <br />
          修法是在升级为 Layer I 时把底座材质补回来。折射仍然在这一层背后跑（背景不再被底座模糊、
          镜面高光变强、亮度与饱和上扬），「变成玻璃」的观感还在，但 α 回到地板值。
          <code className="font-mono">scripts/press-legibility.mjs</code> 的 48 个测点就是这条的回归。
        </Note>

        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <strong className="font-medium">哪些地方要补、哪些不要补，判据只有一条：这层玻璃自己是不是底座。</strong>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-[14px]">
            <thead>
              <tr>
                {['位置', '补底色？', '为什么'].map((h) => (
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
                  ['Button 按下 / Toggle 选中 / Select 触发器', '✅ 必须补', '它自己就是那层底座，α 归零标签就没背景了'],
                  ['Tabs 指示器 / 菜单高亮项', '❌ 不补', '叠在底座材质之上，底座底色仍在标签背后'],
                  ['Sheet 的 grabber', '✅ 补', '4pt 高的横条，没有文字但要与底色区分'],
                ] as const
              ).map(([where, fill, why]) => (
                <tr key={where}>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5">{where}</td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5">{fill}</td>
                  <td className="border-b border-[var(--lg-separator)] px-3 py-2.5 text-[var(--lg-label-secondary)]">
                    {why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="floor"
        title="可读性地板"
        lead="PROJECT_SPEC §13：所有文本在材质档位 0（最通透）+ 最不利背景下仍需满足 WCAG AA。这句话要能执行，就得先把它变成一个能算的数。"
      >
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          由 <code className="font-mono">C = a·F + (1−a)·B</code> 反解出「要达到目标对比度，
          a 至少要多大」，就是地板值。不传实测背景时按最不利处理（B ∈ [0, 255]，纯黑到纯白都可能出现）。
          传入实测范围可以让地板降下来 —— 那就是元素级自适应省下的透明度。
        </p>
        <CodeBlock
          lang="ts"
          code={`import { minBaseAlphaFor, resolveLegibleAlpha } from '@createagle/glass-core';

// 保证模式：不知道背后是什么，按最不利算
minBaseAlphaFor({ baseColor: [255, 255, 255], labelColor: [0, 0, 0], labelAlpha: 1 });

// 自适应模式：探测到了背景的实际亮度范围，地板可以降下来
resolveLegibleAlpha(rawAlpha, 'light', 'adaptive', samples);`}
        />
        <Note>
          探测不出来（背景是图片 / 渐变 / 视频）时返回 null，自然回落到「保证模式」的最不利地板 ——
          <strong className="font-medium">探测失败只会更保守，不会更冒险</strong>。
        </Note>
      </Section>

      <Section id="next" title="接下来">
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          这一页讲的是「材质分几层、每层该长什么样」。
          <Link href="/docs/optics" className="underline underline-offset-4">
            Optics
          </Link>{' '}
          讲的是另一半：这些效果在浏览器里到底怎么做出来，做不出来的时候降级成什么。
        </p>
      </Section>
    </article>
  );
}
