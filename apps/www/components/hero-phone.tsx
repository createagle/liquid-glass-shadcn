'use client';

import * as React from 'react';
import { GlassScrollEdge, useScrollEdge } from '@glass/core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardRow } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * 首页 Hero 的那台「手机」—— PROJECT_SPEC §12 要的
 * 「一个真实可交互的 iOS 风格界面（tab bar + segmented + slider 全部是活的）」。
 *
 * 这里没有一张截图。三个 tab、分段控件、两个滑杆、两个开关**全是本库组件**，
 * 可点、可拖、可键盘操作，并且真的改变屏幕上的东西：
 *
 *   · 分段控件      真的过滤下面的网格，不是换个高亮
 *   · 亮度滑杆      真的把整块屏幕调暗（连玻璃一起，就像真的调背光）
 *   · 「大字体」开关  真的把这块屏幕的字号整体放大
 *   · 滚动          内容真的从悬浮 Tab Bar 底下穿过去 —— 这才是玻璃的正题
 *
 * ── 为什么背景是 App 底色而不是壁纸 ──────────────────────────────────
 * 第一版在屏幕底下铺了张壁纸，想让玻璃有东西可折射。错了两次：
 *   1. iOS 里 Tab Bar 折射的是**滚动的 App 内容**，不是壁纸 —— 壁纸只在主屏可见。
 *   2. 内容文字直接压在壁纸上，换成诊断用的 6px 黑白条纹时**必然过不了 AA**。
 *      在一个把「最不利背景下仍满足 AA」写进 §13 的库的首页上摆一个反例，
 *      比少一个炫技演示糟糕得多。
 * 所以：底是 App 底色，高频内容由**封面网格**提供 —— 它从栏底下滚过去的时候，
 * 模糊和色散扭的就是它。想在条纹上看光学，Materials / Optics 两页有专门的演示台。
 *
 * ── 同屏折射预算：这台手机把首页顶到了红线上 ──────────────────────
 * PROJECT_SPEC §5.2 的红线是 **8 个活跃折射实例**（这个数字本身是 `[推定]`，
 * Apple 只说了「限制同屏数量」，没给数）。超限的实例会被 useGlassFilter 拒绝，
 * 静默退回 Tier B，并打上 `data-refraction="off"`。
 *
 * 关键在于**这是整页预算，不是本组件的预算**。首页上浏览器实测（Tier A）：
 *
 *   顶栏             材质滑杆 1 + tier 分段 1 + 明暗开关 1     = 3
 *   Preview/Code     页面下方那个 ComponentPreview 的分段      = 1
 *   ├ 资料库         Tab Bar 1 + 分段 1 + 音量滑杆 1           = 3  → 合计 7
 *   ├ 设置           Tab Bar 1 + 亮度滑杆 1 + 开关 2           = 4  → 合计 **8**
 *   └ 相册           Tab Bar 1                                = 1  → 合计 5
 *
 * 也就是说**「设置」这一屏正好卡在 8 上，一点余量都没有**。首页上任何地方
 * 再多一个强玻璃控件，就会有一个实例静默降级。这个余裕是靠 Radix 默认卸载
 * 未选中面板换来的，不是设计出来的。
 *
 * site.spec.ts 有一条断言逐个 tab 检查首页不出现 `data-refraction="off"` ——
 * 越线的那天由 CI 说，而不是由用户在某个屏幕上看出来「那个胶囊怎么不一样」。
 */

const DEVICE = {
  /** iPhone 16 Pro 逻辑点宽。[实测] —— tabs.tsx 引用的那份 Figma 示例帧就是 402×874 */
  width: 402,
  /**
   * ⚠️ 刻意**不是** 874。Hero 里放不下整机，这里截短了。
   * 标出来免得被当成机型尺寸抄走。`[非官方 · 版面需要]`
   */
  height: 668,
  /** 屏幕圆角。`[推定]` —— 没有任何官方数字，照截图拟合 */
  radius: 54,
  /** 悬浮 Tab Bar 高度。[实测] 62pt，与 tabs.tsx 的 GEOMETRY.height 同源 */
  tabBar: 62,
  /** Tab Bar 到屏幕底边。`[推定]` */
  tabBarInset: 16,
  /** 分段控件高度。[实测] 32pt —— apple-metrics §7.1 的 UISegmentedControl */
  segmented: 32,
  /** 状态栏高度。`[推定]` */
  statusBar: 44,
} as const;

/**
 * 「专辑封面」。没有素材，就用系统色板拼 —— 但**必须带高频细节**，
 * 否则它从 Tab Bar 底下滚过去时，玻璃什么也扭不出来：
 * 折射扭曲的是背后的**边缘**，背后是一片平滑渐变就等于什么都没有。
 * 那层 2px 斜纹就是干这个的。
 */
function Art({ hue, className }: { hue: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('overflow-hidden rounded-[10px]', className)}
      style={{
        backgroundImage: [
          'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.18) 0 2px, transparent 2px 4px)',
          'radial-gradient(120% 120% at 20% 12%, rgb(255 255 255 / 0.45), transparent 58%)',
          `linear-gradient(150deg, var(${hue}), var(--lg-indigo))`,
        ].join(','),
      }}
    />
  );
}

const HUES = [
  '--lg-pink',
  '--lg-orange',
  '--lg-teal',
  '--lg-purple',
  '--lg-green',
  '--lg-red',
  '--lg-yellow',
  '--lg-blue',
] as const;

const hueAt = (i: number) => HUES[i % HUES.length] as string;

type Kind = 'album' | 'artist';

const ITEMS: { title: string; sub: string; kind: Kind }[] = [
  { title: '午夜降落', sub: '专辑 · 12 首', kind: 'album' },
  { title: '海雾', sub: '艺人 · 8 张专辑', kind: 'artist' },
  { title: '玻璃与光', sub: '专辑 · 9 首', kind: 'album' },
  { title: '北纬四十度', sub: '艺人 · 3 张专辑', kind: 'artist' },
  { title: '折射率', sub: '专辑 · 11 首', kind: 'album' },
  { title: '色散', sub: '艺人 · 5 张专辑', kind: 'artist' },
  { title: '磨砂玻璃', sub: '专辑 · 7 首', kind: 'album' },
  { title: '同心圆角', sub: '专辑 · 10 首', kind: 'album' },
];

/* ── 屏幕 ─────────────────────────────────────────────────────────────── */

export function HeroPhone({ className }: { className?: string }) {
  const [filter, setFilter] = React.useState<'all' | Kind>('all');
  const [volume, setVolume] = React.useState([64]);
  const [brightness, setBrightness] = React.useState([88]);
  const [bigText, setBigText] = React.useState(false);
  const [wifi, setWifi] = React.useState(true);
  const [tab, setTab] = React.useState('library');

  const shown = ITEMS.filter((i) => filter === 'all' || i.kind === filter);

  /**
   * 滚动边缘效果（§13）。三个面板共用一套 —— Radix 会卸载未选中的面板，
   * 所以 `scrollRef` 是 callback ref，理由见 @glass/core 的 scroll-edge.tsx。
   */
  const { scrollRef, topRef, bottomRef } = useScrollEdge<HTMLDivElement>();

  // 内容区上下都要让位：上给状态栏，下给悬浮 Tab Bar，否则首末行永远压在栏底下
  const padTop = DEVICE.statusBar + 8;
  const padBottom = DEVICE.tabBar + DEVICE.tabBarInset * 2;

  const panes: [string, React.ReactNode][] = [
    [
      'library',
      <LibraryPane
        key="library"
        filter={filter}
        setFilter={setFilter}
        shown={shown}
        volume={volume}
        setVolume={setVolume}
      />,
    ],
    [
      'settings',
      <SettingsPane
        key="settings"
        brightness={brightness}
        setBrightness={setBrightness}
        bigText={bigText}
        setBigText={setBigText}
        wifi={wifi}
        setWifi={setWifi}
      />,
    ],
    ['photos', <PhotosPane key="photos" />],
  ];

  return (
    <div
      data-hero-phone=""
      className={cn('relative isolate overflow-hidden', className)}
      style={
        {
          width: DEVICE.width,
          height: DEVICE.height,
          borderRadius: DEVICE.radius,
          // App 底色 —— iOS 的分组列表背景。文字用 --lg-label-primary，明暗自适应。
          background: 'var(--lg-grouped-bg)',
          color: 'var(--lg-label-primary)',
          // ⚠️ --lg-shadow 是**一整条 box-shadow 值**，不是 RGB 三元组，套不进 rgb()。
          //    这台设备的投影比控件深得多（它是一整块「硬件」），所以单独写。
          boxShadow: '0 30px 80px -24px rgb(16 22 40 / 0.45)',
          // 「大字体」改的是这块屏幕的根字号，下面的文字全按 px 写，所以只影响用 em 的地方——
          // 这里直接把它当开关用：19 / 17 两档，对应 iOS 的动态字体上调一档。
          fontSize: bigText ? 19 : 17,
        } as React.CSSProperties
      }
    >
      {/* 状态栏。9:41 是 Apple 所有产品图里的固定时间 —— 静态装饰，不是控件。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-end justify-between px-8 pb-1.5 text-[15px] font-semibold"
        style={{ height: DEVICE.statusBar }}
      >
        <span>9:41</span>
        {/*
          信号与电池是**画**出来的，不是字形。
          第一版直接写了 ▮▮▮ / ⌁ 两个字符 —— 渲染出来是三个黑方块加一条波浪线，
          字形在不同系统上根本不可控。这里全用 currentColor 的方块拼，
          跟着 --lg-label-primary 走，明暗自适应。
        */}
        <span className="flex items-center gap-1.5 opacity-80">
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span
                key={h}
                style={{ width: 3, height: h, borderRadius: 1, background: 'currentColor' }}
              />
            ))}
          </span>
          <span className="flex items-center gap-[1px]">
            <span
              style={{
                position: 'relative',
                width: 22,
                height: 11,
                borderRadius: 3,
                border: '1px solid currentColor',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  insetBlock: 1.5,
                  left: 1.5,
                  width: 13,
                  borderRadius: 1.5,
                  background: 'currentColor',
                }}
              />
            </span>
            <span
              style={{ width: 1.5, height: 4, borderRadius: 1, background: 'currentColor' }}
            />
          </span>
        </span>
      </div>

      <Tabs
        value={tab}
        onValueChange={setTab}
        height={DEVICE.tabBar}
        // Tab Bar 要浮在内容**上面**，不是排在内容下面 —— 覆盖掉默认的纵向流
        className="absolute inset-0 block gap-0"
      >
        {panes.map(([value, pane]) => (
          <TabsContent
            key={value}
            value={value}
            // 只给当前面板挂 ref：未选中的面板已被 Radix 卸载，不该参与
            ref={value === tab ? scrollRef : undefined}
            data-hero-scroll={value === tab ? '' : undefined}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-4"
            style={{ paddingTop: padTop, paddingBottom: padBottom }}
          >
            {pane}
          </TabsContent>
        ))}

        {/*
          滚动边缘效果 —— 作用在**背后的内容**上（模糊 + 压雾），栏自身一点不变。
          方向按 Apple，不按 SPEC §13 的字面写法，理由见 @glass/core/scroll-edge.tsx。
          写在 TabsList 之前：它该压住内容，不该压住 Tab Bar。
        */}
        <GlassScrollEdge ref={topRef} edge="top" variant="soft" height={DEVICE.statusBar + 40} />
        <GlassScrollEdge ref={bottomRef} edge="bottom" variant="soft" height={padBottom + 24} />

        <TabsList
          className="absolute left-1/2 z-10 w-fit -translate-x-1/2"
          style={{ bottom: DEVICE.tabBarInset }}
        >
          <TabsTrigger value="library" className="w-[104px] text-[15px]">
            资料库
          </TabsTrigger>
          <TabsTrigger value="settings" className="w-[104px] text-[15px]">
            设置
          </TabsTrigger>
          <TabsTrigger value="photos" className="w-[104px] text-[15px]">
            相册
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/*
        亮度。真机调背光是把**整块屏幕**压暗，玻璃也不例外 —— 所以这层压在最上面，
        z 序高于 Tab Bar。除以 200：滑杆下限 20 对应最深 0.4，再深就看不清了。
      */}
      <div
        aria-hidden="true"
        data-hero-dim=""
        className="pointer-events-none absolute inset-0 z-30 bg-black"
        style={{ opacity: (100 - (brightness[0] ?? 100)) / 200 }}
      />
    </div>
  );
}

/* ── 资料库：分段控件 + 网格 + 音量滑杆 ──────────────────────────────── */

function LibraryPane({
  filter,
  setFilter,
  shown,
  volume,
  setVolume,
}: {
  filter: 'all' | Kind;
  setFilter: (v: 'all' | Kind) => void;
  shown: typeof ITEMS;
  volume: number[];
  setVolume: (v: number[]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-[34px] leading-none font-bold tracking-tight">资料库</h3>

      {/*
        分段控件 —— 与底下的 Tab Bar 是**同一个组件**，只是矮一档。
        iOS 也是这么干的：UISegmentedControl 和浮动 Tab Bar 共用一套材质语言。
        它真的在过滤下面的网格。
      */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as 'all' | Kind)}
        height={DEVICE.segmented}
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1 text-[13px]">
            全部
          </TabsTrigger>
          <TabsTrigger value="album" className="flex-1 text-[13px]">
            专辑
          </TabsTrigger>
          <TabsTrigger value="artist" className="flex-1 text-[13px]">
            艺人
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div data-hero-grid="" className="grid grid-cols-2 gap-3">
        {shown.map((item, i) => (
          <div key={item.title} className="flex min-w-0 flex-col gap-1">
            <Art hue={hueAt(i)} className="aspect-square w-full" />
            <span className="truncate text-[15px] font-medium">{item.title}</span>
            <span className="truncate text-[13px] text-[var(--lg-label-secondary)]">
              {item.sub}
            </span>
          </div>
        ))}
      </div>

      {/*
        音量。**不用 Card 包** —— Card 是内容层，控件不该再糊一层内容材质
        （PROJECT_SPEC §2「材质属于控件层」）。滑杆自己就是控件。
      */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-baseline justify-between text-[13px] text-[var(--lg-label-secondary)]">
          <span>音量</span>
          <span className="tabular-nums">{volume[0]}</span>
        </div>
        <Slider value={volume} onValueChange={setVolume} aria-label="音量" className="w-full" />
      </div>
    </div>
  );
}

/* ── 设置：分组列表 + 开关 + 亮度滑杆 ───────────────────────────────── */

function SettingsPane({
  brightness,
  setBrightness,
  bigText,
  setBigText,
  wifi,
  setWifi,
}: {
  brightness: number[];
  setBrightness: (v: number[]) => void;
  bigText: boolean;
  setBigText: (v: boolean) => void;
  wifi: boolean;
  setWifi: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-[34px] leading-none font-bold tracking-tight">设置</h3>

      {/*
        分组列表用默认的 `grouped` 档，不用 `material` ——
        它压在 App 底色上，不是压在照片上，糊一层材质纯属徒增一层。
        这条是 Card 自己的文档里写的规矩，首页不该带头破。
      */}
      <Card className="w-full">
        <CardRow>
          <span className="flex-1">无线局域网</span>
          <Switch checked={wifi} onCheckedChange={setWifi} aria-label="无线局域网" />
        </CardRow>
        <CardRow>
          <span className="flex-1">大字体</span>
          <Switch checked={bigText} onCheckedChange={setBigText} aria-label="大字体" />
        </CardRow>
        <CardRow>
          <span className="flex-1">网络</span>
          <span className="text-[var(--lg-label-secondary)]">{wifi ? 'Glass-5G' : '未连接'}</span>
        </CardRow>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-[13px] text-[var(--lg-label-secondary)]">
          <span>亮度</span>
          <span className="tabular-nums">{brightness[0]}%</span>
        </div>
        <Slider
          value={brightness}
          onValueChange={setBrightness}
          min={20}
          aria-label="亮度"
          className="w-full"
        />
        <span className="text-[13px] text-[var(--lg-label-secondary)]">
          拖它 —— 整块屏幕真的会跟着暗下去，玻璃也不例外。
        </span>
      </div>

      <Card className="w-full">
        <CardRow>
          <span className="flex-1">字号</span>
          <span className="text-[var(--lg-label-secondary)]">{bigText ? '19 pt' : '17 pt'}</span>
        </CardRow>
        <CardRow interactive>
          <span className="flex-1">关于本机</span>
          <span className="text-[var(--lg-label-secondary)]">Liquid Glass UI</span>
        </CardRow>
      </Card>

      <p className="pb-2 text-[13px] leading-relaxed text-[var(--lg-label-secondary)]">
        这一页刻意做长了一点 —— 往下滚，看内容从底下那条 Tab Bar 穿过去时
        栏底自动多出来的那层雾。那是<strong className="font-semibold">滚动边缘效果</strong>在压暗背后的内容，
        不是栏自己变浑了。
      </p>
    </div>
  );
}

/* ── 相册：最密的高频内容，玻璃在这一页最好看 ────────────────────────── */

function PhotosPane() {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[34px] leading-none font-bold tracking-tight">相册</h3>
      <div data-hero-photos="" className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 27 }, (_, i) => (
          <Art key={i} hue={hueAt(i * 3)} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}
