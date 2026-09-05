'use client';

/**
 * Materials / Optics 两页用的活演示。
 *
 * 这两页是 Phase 6 任务卡点名「要写透」的分水岭页。写透的意思不是字多，
 * 而是**每个论断旁边都能自己按一下看到**。所以这里的演示都满足两条：
 *
 *   1. **可切换到 6px 黑白条纹背景。** 折射与色散在平滑渐变上本来就看不出来 ——
 *      全库的光学诊断（sweep / ab / 对比度审计 / 挖洞实测）一直用条纹当高频最坏情况。
 *      只给渐变背景的演示等于什么都没演示。
 *   2. **两边共用同一块背景、同一个尺寸。** 不共用就不是对照。
 */

import * as React from 'react';
import { GlassSurface, useGlass, measurePunch, usePunchState } from '@createagle/glass-core';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/* ── 背景 ─────────────────────────────────────────────────────────────── */

export type LabBackground = 'stripes' | 'photo' | 'flat';

const BACKGROUNDS: Record<LabBackground, React.CSSProperties> = {
  /** 6px 黑白条纹 —— 高频最坏情况。折射有没有效，只有这个背景说了算。 */
  stripes: { background: 'repeating-linear-gradient(90deg,#000 0 6px,#fff 6px 12px)' },
  /** 彩色渐变 —— 像照片，好看，但折射在上面几乎看不出来 */
  photo: {
    background:
      'radial-gradient(40% 55% at 12% 18%,#ff2d55 0,transparent 60%),' +
      'radial-gradient(45% 60% at 84% 14%,#ffcc00 0,transparent 60%),' +
      'radial-gradient(55% 50% at 78% 86%,#001133 0,transparent 62%),' +
      'linear-gradient(115deg,#000 0,#fff 35%,#0a84ff 70%,#000 100%)',
  },
  /** 中灰实色 —— 参考图背后就是它 */
  flat: { background: '#5e5e5e' },
};

const BG_LABEL: Record<LabBackground, string> = {
  stripes: '6px 条纹',
  photo: '彩色渐变',
  flat: '中灰实色',
};

export function BackgroundPicker({
  value,
  onChange,
  hint,
}: {
  value: LabBackground;
  onChange: (v: LabBackground) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={value} onValueChange={(v) => onChange(v as LabBackground)} height={40}>
        <TabsList>
          {(Object.keys(BACKGROUNDS) as LabBackground[]).map((k) => (
            <TabsTrigger key={k} value={k} className="text-[13px]">
              {BG_LABEL[k]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {hint ? <span className="text-[13px] text-[var(--lg-label-tertiary)]">{hint}</span> : null}
    </div>
  );
}

function Stage({
  bg,
  height = 180,
  children,
}: {
  bg: LabBackground;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-2xl"
      style={{ ...BACKGROUNDS[bg], height }}
    >
      {children}
    </div>
  );
}

/* ── Layer B vs Layer I ───────────────────────────────────────────────── */

/**
 * 分层对照：同一块背景、同一个尺寸，左边磨砂底座、右边强玻璃指示器。
 *
 * 这张演示要说明的是 PROJECT_SPEC §2 的核心论断：
 * **它们是两种材质，不是同一种材质的两个强度。**
 */
export function LayerCompare() {
  const [bg, setBg] = React.useState<LabBackground>('stripes');
  const { tier } = useGlass();

  return (
    <div className="flex flex-col gap-3">
      <BackgroundPicker
        value={bg}
        onChange={setBg}
        hint={`当前渲染路径 Tier ${tier.toUpperCase()} —— 顶栏可以强制切换`}
      />
      <Stage bg={bg} height={200}>
        <div className="flex items-center gap-8">
          {(
            [
              ['base', 'Layer B · 磨砂底座'],
              ['indicator', 'Layer I · 强玻璃'],
            ] as const
          ).map(([layer, label]) => (
            <div key={layer} className="flex flex-col items-center gap-2">
              <GlassSurface
                layer={layer}
                radius={27}
                className="flex h-[54px] w-[120px] items-center justify-center"
              >
                <span className="relative text-[15px] font-medium">{label.split(' · ')[0]}</span>
              </GlassSurface>
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Stage>
    </div>
  );
}

/* ── 挖洞 ─────────────────────────────────────────────────────────────── */

/**
 * 挖洞的开关对照。
 *
 * 左边是「指示器嵌在磨砂底座里」的真实结构，右边多做一件事：
 * 把底座的模糊**挖穿**，让指示器直接看到未被模糊过的背景。
 *
 * 条纹背景下这个差别一眼可见；换到渐变就几乎看不出来 —— 这本身
 * 就是「为什么全库的光学诊断都用条纹」的最好说明。
 */
export function PunchCompare() {
  const [bg, setBg] = React.useState<LabBackground>('stripes');
  const [punched, setPunched] = React.useState(true);
  const [punch, setPunch] = usePunchState();

  const indicatorRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        setPunch(null);
        return;
      }
      const sync = () => {
        const target = indicatorRef.current;
        // 基准必须是 `.lg-surface` 本体 —— node 在底座的内边距里面。
        // 组件里都是这么取的，理由见 @createagle/glass-core 的 punch.ts。
        const surface = node.closest<HTMLElement>('.lg-surface');
        if (!target || !surface) return;
        setPunch(measurePunch(surface, target, 27));
      };
      sync();
      // 尺寸随字体/布局稳定下来还会变一两帧，观察一下就够
      const ro = new ResizeObserver(sync);
      ro.observe(node);
      return () => ro.disconnect();
    },
    [setPunch],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-5">
        <BackgroundPicker value={bg} onChange={setBg} />
        <label className="flex items-center gap-2 text-[14px]">
          <span>挖洞</span>
          <Switch checked={punched} onCheckedChange={setPunched} aria-label="挖洞" />
        </label>
      </div>
      {/* data-lab 只为测试与截图定位 —— 这一节里还有 Tabs 与 Switch，
          它们自己也会挖洞，光按 [data-punched] 找会一次找到三个 */}
      <div data-lab="punch-stage">
      <Stage bg={bg} height={180}>
        <GlassSurface
          layer="base"
          radius={31}
          punch={punched ? punch : null}
          className="relative isolate flex h-[62px] items-center p-1"
        >
          {/*
            回调 ref 挂在底座上，位置从指示器量。
            measurePunch 会把基准取到 .lg-surface 本体、并除掉可能的缩放 ——
            早期版本自己相减，结果偏了一个内边距（见 STATUS §0.52）。
          */}
          <div ref={attach} className="relative flex h-full">
            <div className="flex h-full w-[120px] items-center justify-center">
              <span className="relative text-[15px] text-white/70">Tab 1</span>
            </div>
            <div ref={indicatorRef} className="relative h-full w-[120px]">
              <GlassSurface
                layer="indicator"
                radius={27}
                className="flex h-full w-full items-center justify-center"
              >
                <span className="relative text-[15px] font-medium">Tab 2</span>
              </GlassSurface>
            </div>
          </div>
        </GlassSurface>
      </Stage>
      </div>
      <p className="text-[13px] text-[var(--lg-label-tertiary)]">
        条纹背景下：挖洞打开时，指示器里的条纹比底座里的<strong className="font-medium">清楚</strong>；关掉之后两边一样糊。
        换到「彩色渐变」再试一次 —— 差别几乎消失，因为渐变没有可位移的高频内容。
      </p>
    </div>
  );
}

/* ── α 与可读性 ───────────────────────────────────────────────────────── */

/**
 * `C = a·F + (1−a)·B` 的可视化。
 *
 * 关键性质：**合成结果的值域宽度是 (1−a)，与背景 B 是什么无关。**
 * 也就是说能否保证对比度**只由 a 决定**。这条是本库整套可读性地板的地基，
 * 也是「α 归零 = 保证消失」的直接推论。
 */
export function AlphaLab() {
  const [alpha, setAlpha] = React.useState(0.62);
  // 底座填充色（亮色主题）与标签色，取自 token 的实际取值
  const F = 255;
  const label = 0;
  const worst = (b: number) => {
    const c = alpha * F + (1 - alpha) * b;
    const lum = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const l1 = Math.max(lum(c), lum(label));
    const l2 = Math.min(lum(c), lum(label));
    return (l1 + 0.05) / (l2 + 0.05);
  };
  // 最不利背景：纯黑与纯白里更差的那一个
  const ratio = Math.min(worst(0), worst(255));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-wrap items-center gap-4">
        <span className="text-[14px] whitespace-nowrap">材质不透明度 a</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(e) => setAlpha(Number(e.target.value))}
          aria-label="材质不透明度"
          className="h-1 w-[220px] accent-[var(--lg-accent-fill)]"
        />
        <span className="font-mono text-[14px] tabular-nums">{alpha.toFixed(2)}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {[0, 128, 255].map((b) => (
          <div key={b} className="flex flex-col items-center gap-1">
            <div
              className="flex h-[64px] w-[110px] items-center justify-center rounded-xl"
              style={{ background: `rgb(${b} ${b} ${b})` }}
            >
              <div
                className="flex h-[44px] w-[92px] items-center justify-center rounded-lg text-[15px]"
                style={{
                  background: `rgb(255 255 255 / ${alpha})`,
                  color: 'rgb(0 0 0)',
                }}
              >
                标签
              </div>
            </div>
            <span className="text-[11px] text-[var(--lg-label-tertiary)]">背景 {b}</span>
          </div>
        ))}
        <div
          className={cn(
            'ml-2 rounded-xl px-4 py-3 text-[14px]',
            ratio >= 4.5 ? '' : 'ring-1 ring-[var(--lg-on-glass-red)]',
          )}
          style={{ background: 'var(--lg-fill-quaternary)' }}
        >
          最不利背景下的对比度{' '}
          <strong
            className="font-mono"
            style={{ color: ratio >= 4.5 ? 'var(--lg-on-glass-green)' : 'var(--lg-on-glass-red)' }}
          >
            {ratio.toFixed(2)}:1
          </strong>
          <span className="ml-2 text-[var(--lg-label-tertiary)]">
            {ratio >= 4.5 ? '过 WCAG AA' : '不过 AA（正文 4.5）'}
          </span>
        </div>
      </div>
      <p className="text-[13px] text-[var(--lg-label-tertiary)]">
        把 a 拉到 0 试试：三块背景上的标签同时不可读。
        <strong className="font-medium">这不是「透明度低了不好看」，是保证本身没有了</strong> ——
        值域宽度 (1−a) 变成 1，合成结果可以是任何值。
      </p>
    </div>
  );
}

/* ── 三级降级 ─────────────────────────────────────────────────────────── */

/**
 * Tier A / B / C 并排。
 *
 * ⚠️ **不能靠顶栏的全局 tier 开关来演示这件事** —— 那个一次只能看到一档，
 * 读者得来回切、凭记忆比。这里把三档同时摆出来：
 * 每一格套一层自己的 `data-glass-tier`，CSS 的属性选择器就会各走各的路径。
 *
 * 这也顺带证明了一件事：三条渲染路径是**纯 CSS 分支**，
 * 同一个 `<GlassSurface>` 在三种祖先下自动变成三种实现，组件不需要知道自己在哪一档。
 */
export function TierLab() {
  const [bg, setBg] = React.useState<LabBackground>('stripes');
  const TIER_NOTE: Record<'a' | 'b' | 'c', string> = {
    a: '真折射 + 三通道色散',
    b: '微模糊 + inset 阴影 + 渐变彩边',
    c: '半透明纯色 + 描边',
  };

  return (
    <div className="flex flex-col gap-3">
      <BackgroundPicker
        value={bg}
        onChange={setBg}
        hint="三档同时渲染，与顶栏的全局开关无关"
      />
      <Stage bg={bg} height={200}>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {(['a', 'b', 'c'] as const).map((t) => (
            /*
              两件事缺一不可：
                · 祖先上的 data-glass-tier —— 三档是 CSS 的**后代选择器**
                · refraction={t === 'a'} —— Tier A 的折射是 JS 注入的**内联样式**，
                  优先级高于任何 CSS，光加属性盖不住它
              只做第一件的话，三格会长得一模一样（第一版就是这样，截图上一眼看穿）。
            */
            <div key={t} data-glass-tier={t} className="flex flex-col items-center gap-2">
              <GlassSurface
                layer="indicator"
                radius={27}
                refraction={t === 'a'}
                className="flex h-[54px] w-[120px] items-center justify-center"
              >
                <span className="relative text-[15px] font-medium">Tier {t.toUpperCase()}</span>
              </GlassSurface>
              <span className="max-w-[140px] rounded-full bg-black/45 px-2 py-0.5 text-center text-[11px] text-white">
                {TIER_NOTE[t]}
              </span>
            </div>
          ))}
        </div>
      </Stage>
      <p className="text-[13px] text-[var(--lg-label-tertiary)]">
        条纹背景下 A 与 B 的差别最明显：A 的条纹在边缘被<strong className="font-medium">推挤并分离出彩边</strong>，
        B 只是整体提亮加一圈渐变描边。C 干脆没有背景透出 —— 但三档看起来都是完成的设计，
        没有哪一档像「坏掉的版本」。
      </p>
    </div>
  );
}
