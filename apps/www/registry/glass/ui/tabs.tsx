'use client';

// APPLE REFERENCE: UISegmentedControl / iOS 26+ 浮动式 Tab Bar
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:24081），
// 示例帧 402×874 即 iPhone 16 Pro 逻辑点尺寸，故 Figma 数值直接是 pt。
// 完整测量记录见 docs/research/apple-metrics.md §7.2。
//
//   底座 BG（Layer B）      244 × 62 pt              [实测]
//   按钮组                  236 × 54 pt              [实测]
//   底座 → 按钮组内缩        4 pt（四周）             [实测]
//   单个 Tab（Layer I）      120 × 54 pt              [实测]
//   形状                    胶囊 → 外半径 31 / 内半径 27  [实测]
//   Search 独立胶囊          62 × 62 pt               [实测]
//
// ⚠️ 可信度说明：上表标 [实测] 而非 [官方]，因为
//   (a) 该文件是 iOS 27，PROJECT_SPEC 的基准是 iOS 26；
//   (b) 文件标题带 "(Community)"，发布者是否为 Apple 未经验证。
// 本组件按比例而非绝对 pt 实现（见 GEOMETRY），所以上述数值用作**比例依据**。
//
// ✅ 外半径 31 − 内缩 4 = 内半径 27，与 concentricRadius(31, 4) 一致 ——
//    同心圆角公式由这份官方资源独立验证。

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { GlassSurface, concentricRadius, transitionFor, useGlassOptional, type GlassPunch } from '@glass/core';
import { cn } from '@/lib/utils';

/**
 * 几何比例 —— 从 iOS 27 实测值归一化而来，随高度缩放。
 *
 * 不写死 pt 是因为 Web 上的 Tabs 宽度由内容决定，段数也不固定；
 * 锁死的是**比例关系**，那才是设计语言里稳定的部分。
 */
const GEOMETRY = {
  /** 底座高度默认值。iOS 27 实测 62pt。 */
  height: 62,
  /** 底座 → 指示器的内缩。iOS 27 实测 4pt。 */
  inset: 4,
} as const;

interface TabsContextValue {
  /** 指示器相对底座的位置，供底座挖洞用 */
  punch: GlassPunch | null;
  setPunch: (p: GlassPunch | null) => void;
  inset: number;
  baseRadius: number;
}

const TabsCtx = React.createContext<TabsContextValue | null>(null);

export interface GlassTabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  /** 底座高度（px）。默认 62，对应 iOS 27 实测值。 */
  height?: number;
}

function Tabs({ className, height = GEOMETRY.height, style, ...props }: GlassTabsProps) {
  const [punch, setPunch] = React.useState<GlassPunch | null>(null);
  const inset = Math.round((GEOMETRY.inset / GEOMETRY.height) * height);
  const baseRadius = height / 2;

  const ctx = React.useMemo(
    () => ({ punch, setPunch, inset, baseRadius }),
    [punch, inset, baseRadius],
  );

  return (
    <TabsCtx.Provider value={ctx}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn('flex flex-col gap-4', className)}
        style={{ '--lg-tabs-height': `${height}px`, ...style } as React.CSSProperties}
        {...props}
      />
    </TabsCtx.Provider>
  );
}

export interface GlassTabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List> {}

/**
 * Layer B 磨砂底座。
 *
 * 三件事在这里发生：
 *  1. 底座本身是磨砂材质（**绝不折射** —— PROJECT_SPEC §15.2）
 *  2. 按指示器位置挖洞，让指示器看到未被底座模糊过的背景（§2）
 *  3. 用 relative 定位为指示器提供坐标系
 */
function TabsList({ className, children, ...props }: GlassTabsListProps) {
  const ctx = React.useContext(TabsCtx);
  if (!ctx) throw new Error('<TabsList> 必须放在 <Tabs> 里');

  return (
    <GlassSurface
      layer="base"
      radius={ctx.baseRadius}
      punch={ctx.punch}
      className={cn('relative isolate w-fit', className)}
      style={{ height: 'var(--lg-tabs-height)', padding: ctx.inset }}
    >
      <TabsPrimitive.List
        data-slot="tabs-list"
        className="relative flex h-full items-stretch gap-0"
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </GlassSurface>
  );
}

export interface GlassTabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger> {}

/**
 * 触发器 + Layer I 指示器。
 *
 * 指示器只渲染在**选中项**上，并用 `layoutId` 让 motion 在切换时
 * 做共享布局动画 —— 一个滑动的胶囊，而不是淡入淡出两个。
 */
function TabsTrigger({ className, children, value, ...props }: GlassTabsTriggerProps) {
  const ctx = React.useContext(TabsCtx);
  if (!ctx) throw new Error('<TabsTrigger> 必须放在 <Tabs> 里');
  const ref = React.useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  /**
   * 把选中项的几何同步给底座去挖洞。
   *
   * 用 ResizeObserver + data-state 观察而不是从 Radix 读状态：
   * 洞的位置取决于**布局结果**（宽度由内容决定），只有量出来才准。
   */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const isOn = el.getAttribute('data-state') === 'active';
      setSelected(isOn);
      if (!isOn) return;
      const parent = el.closest('.lg-surface') as HTMLElement | null;
      if (!parent) return;
      const p = parent.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      ctx.setPunch({
        x: r.left - p.left,
        y: r.top - p.top,
        width: r.width,
        height: r.height,
        radius: r.height / 2,
      });
    };

    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['data-state'] });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [ctx]);

  /**
   * 按下态在 window 上收尾：指针可能在别的元素上松开（快速滑动切换时常见），
   * 只听自己的 pointerup 会把 pressed 卡住。
   */
  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const indicatorRadius = concentricRadius(ctx.baseRadius, ctx.inset);

  /**
   * PROJECT_SPEC §13：`prefers-reduced-motion` 下必须去掉形变动画，
   * 只保留 ≤120ms 的透明度过渡。所以过渡参数走 transitionFor() 而不是
   * 直接用 springs.snappy —— 后者在该偏好下依然会做弹簧位移。
   */
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      data-slot="tabs-trigger"
      className={cn(
        'relative z-10 inline-flex items-center justify-center gap-1.5',
        'px-5 text-[15px] font-semibold whitespace-nowrap',
        'rounded-[inherit] outline-none select-none',
        // 焦点环必须在玻璃上清晰可见（PROJECT_SPEC §13）
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      style={{
        // 未选中用次级标签色，选中转主要标签色 —— 走 token，不写裸色值
        color: selected ? 'var(--lg-label-primary)' : 'var(--lg-label-secondary)',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      {...props}
    >
      {/*
        未选中项的 hover 反馈。

        **只有 hover，没有单独的 active。** Radix 在 pointerdown 就完成选中，
        未选中项因此不存在可见的「按下但仍未选中」阶段 —— 写一段按下加深的
        分支只会是死代码。按下的反馈由选中后的指示器上扬承担（见下面的 pressed），
        这与 iOS 上按一下分段控件的观感一致。

        用 motion 的 opacity 而不是 CSS transition：PROJECT_SPEC §15.6 禁止
        用贝塞尔曲线做状态过渡，一律走 spring 预设。
        颜色走 fill 家族 token，不写裸色值（§15.4）。
      */}
      {!selected ? (
        <motion.span
          aria-hidden="true"
          data-slot="tabs-trigger-highlight"
          className="absolute inset-0 -z-10 rounded-[inherit]"
          style={{ background: 'var(--lg-fill-quaternary)' }}
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      ) : null}

      {selected ? (
        <motion.span
          layoutId="lg-tabs-indicator"
          transition={transitionFor('snappy', reducedMotion)}
          className="absolute inset-0 -z-10"
          aria-hidden="true"
        >
          {/*
            按下选中项时，指示器的折射 / 高光 / 饱和同时上扬 ——
            对应 Apple 的 "the knob transforms into Liquid Glass during interaction"
            （PROJECT_SPEC §2「交互态才点亮」）。
          */}
          <GlassSurface
            layer="indicator"
            radius={indicatorRadius}
            pressed={pressed}
            className="h-full w-full"
          />
        </motion.span>
      ) : null}
      <span className="relative">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export interface GlassTabsContentProps
  extends React.ComponentProps<typeof TabsPrimitive.Content> {}

function TabsContent({ className, ...props }: GlassTabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
