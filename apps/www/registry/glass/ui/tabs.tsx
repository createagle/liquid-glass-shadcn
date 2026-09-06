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
//
// ── 指示器可拖动：本库的扩展，不是实测还原 ────────────────────────────
//
// iOS 的分段控件可以**按住选中段横向拖动**，指示器跟手走、松手落到最近一段。
// 但这条**在手上的两份设计资源里都找不到依据** —— 静态设计稿画不出手势。
// 所以它在本文件里的定位是「基于 iOS 交互常识的库扩展」，
// 一切与它相关的数值一律 [推定]，没有一个敢标 [实测]。
//
// 落地时的三条硬约束：
//
//   1. **指示器必须归 List 所有，不能挂在 trigger 里。** 挂在 trigger 里时它是
//      `absolute inset-0`，靠 motion 的 layoutId 在两个 trigger 之间做共享布局动画。
//      那套写法下「拖动」根本无从谈起：拖到一半选中态一变，指示器就会从一个
//      trigger 卸载、在另一个上挂载，layout 动画与拖动位移互相打架。
//      改成 List 里**唯一一个**实例、用量出来的几何定位之后，
//      拖动只是改一个 motion value，选中切换只是改目标值。
//
//      顺带解决了旧写法里那个 layoutId 命名空间的坑（每个实例必须自带 useId，
//      否则同页面多组 Tabs 的指示器会塌到同一个坐标上）——
//      现在压根没有 layoutId，那一类问题不可能再发生。
//
//   2. **挖洞必须跟着指示器实时走。** 洞是让指示器看到「未被底座模糊过」的背景的
//      唯一手段（punch.ts）。拖动时洞若停在原处，指示器一离开洞就等于没有折射 ——
//      玻璃会在半路上突然变成一块糊。这是实现里最容易漏、也最毁效果的一条。
//
//   3. **只能从当前选中段起拖。** 从别的段起手意味着要同时处理
//      「指示器正飞过来」和「手指在拖」两个位移源，行为无法预测；
//      iOS 上也只有选中段可拖。按在别的段上就是普通的点选。

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'motion/react';
import {
  GlassSurface,
  concentricRadius,
  springs,
  transitionFor,
  useGlassOptional,
  usePunchState,
} from '@createagle/glass-core';
import { cn } from '@/lib/utils';

/**
 * 几何比例 —— 从 iOS 27 实测值归一化而来，随高度缩放。
 *
 * 不写死 pt 是因为 Web 上的 Tabs 宽度由内容决定，段数也不固定；
 * 锁死的是**比例关系**，那才是设计语言里稳定的部分。
 */
const GEOMETRY = {
  /** 底座高度默认值。[实测] 62pt */
  height: 62,
  /** 底座 → 指示器的内缩。[实测] 4pt */
  inset: 4,
} as const;

/**
 * 拖动相关的常量。**整组 [推定]** —— 见文件头，手势在设计资源里没有依据。
 */
const DRAG = {
  /**
   * 超过这个位移（px）才算「拖动」，之前都算「按住」。[推定]
   * 太小会让普通点击也走拖动分支（手指落下时的抖动就有 2–3px），
   * 太大则要先划一段死区手感才跟上。3px 是常见的指针容差量级。
   */
  threshold: 3,
  /**
   * 甩动时的横向拉伸上限。[推定]
   * 1.06 是「看得出在拉，但不像橡皮筋」的量 —— 再大就滑稽了。
   */
  maxStretch: 1.06,
  /** 达到最大拉伸所需的速度（px/s）。[推定] */
  stretchAtVelocity: 1600,
  /** 按住（未拖动）时的放大量。[推定] —— 要「按得动」，又不能顶出底座 */
  pressScale: 1.03,
  /** 横向拉多少，纵向就收回多少的比例。[推定] 近似等体积，像被拉长的液滴 */
  squashRatio: 0.6,
} as const;

interface TabsGeometry {
  inset: number;
  baseRadius: number;
}

const TabsCtx = React.createContext<TabsGeometry | null>(null);

/** List 提供给 trigger 的回调 —— 指示器归 List 所有，按下由 List 接管。 */
const TabsListCtx = React.createContext<{
  onTriggerPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
} | null>(null);

export interface GlassTabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  /** 底座高度（px）。默认 62，对应 iOS 27 实测值。 */
  height?: number;
}

function Tabs({ className, height = GEOMETRY.height, style, ...props }: GlassTabsProps) {
  const inset = Math.round((GEOMETRY.inset / GEOMETRY.height) * height);
  const baseRadius = height / 2;
  const ctx = React.useMemo(() => ({ inset, baseRadius }), [inset, baseRadius]);

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

interface Seg {
  el: HTMLElement;
  left: number;
  width: number;
  /** 禁用段照样占位置（指示器要从它上面划过去），但不能成为拖动的落点 */
  disabled: boolean;
}

/**
 * Layer B 磨砂底座 + **唯一那个** Layer I 指示器。
 *
 * 四件事在这里发生：
 *  1. 底座本身是磨砂材质（**绝不折射** —— PROJECT_SPEC §15.2）
 *  2. 量出各段的几何，把指示器摆到选中那一段上
 *  3. 按住选中段可以横向拖动，指示器跟手走
 *  4. 按指示器**当前**位置挖洞（拖动时逐帧跟随），
 *     让指示器看到未被底座模糊过的背景（§2）
 */
function TabsList({ className, children, style, ...props }: GlassTabsListProps) {
  const geo = React.useContext(TabsCtx);
  if (!geo) throw new Error('<TabsList> 必须放在 <Tabs> 里');

  const listRef = React.useRef<HTMLDivElement>(null);
  const [punch, setPunch] = usePunchState();
  const [segs, setSegs] = React.useState<Seg[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [listHeight, setListHeight] = React.useState(0);
  const [pressed, setPressed] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  /* 指示器的位置与宽度。拖动时直接 set，选中切换时用 spring 动过去。 */
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  /* 甩动拉伸：速度驱动，永远弹回 1。reduced-motion 下整条链路不生效。 */
  const stretch = useSpring(1, springs.bouncy);
  /* 按住时轻微放大 */
  const pressScale = useSpring(1, springs.snappy);
  /* 横向拉长时纵向收一点，像一滴被拉开的液体，而不是一块被放大的方片 */
  const squash = useTransform(stretch, (v) => 1 - (v - 1) * DRAG.squashRatio);

  React.useEffect(() => {
    pressScale.set(reducedMotion ? 1 : pressed ? DRAG.pressScale : 1);
  }, [pressed, reducedMotion, pressScale]);

  /**
   * 量一遍：每段相对 List 的 left / width，以及哪一段是选中的。
   *
   * 用**布局结果**而不是 Radix 的 value：段宽由内容决定，只有量出来才准。
   * 这一段原来分散在每个 trigger 的 effect 里（各自 observe 自己），
   * 现在收拢到 List —— 指示器只有一个，测量也该只有一处。
   */
  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const lb = list.getBoundingClientRect();
    const els = Array.from(
      list.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]'),
    );
    const next = els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        left: r.left - lb.left,
        width: r.width,
        disabled: el.hasAttribute('disabled') || el.hasAttribute('data-disabled'),
      };
    });
    setSegs(next);
    setListHeight(lb.height);
    setActiveIndex(els.findIndex((el) => el.getAttribute('data-state') === 'active'));
  }, []);

  React.useEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    /* data-state 变了要重量（选中切换）；尺寸变了也要（内容/字体/容器） */
    const mo = new MutationObserver(measure);
    mo.observe(list, { attributes: true, attributeFilter: ['data-state'], subtree: true });
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    for (const el of list.querySelectorAll('[data-slot="tabs-trigger"]')) ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [measure, children]);

  const active = activeIndex >= 0 ? segs[activeIndex] : undefined;

  /**
   * 把指示器送到选中段。**拖动过程中不接管** ——
   * 那时位置由手指决定，这里插一脚会打架。
   */
  React.useEffect(() => {
    if (!active || dragging) return;
    const t = transitionFor('snappy', reducedMotion);
    /* 首次出现直接落位，不从 0 飞过来 */
    if (width.get() === 0) {
      x.jump(active.left);
      width.jump(active.width);
      return;
    }
    const a = animate(x, active.left, t);
    const b = animate(width, active.width, t);
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, dragging, reducedMotion, x, width]);

  /**
   * 挖洞跟着指示器**逐帧**走。
   *
   * ⚠️ 这是拖动能不能成立的关键（见文件头第 2 条）：洞停在原处的话，
   * 指示器一拖出洞就只能看到被底座模糊过的背景，折射当场失效 ——
   * 玻璃会在半路突然变成一块糊。
   *
   * 订阅 motion value 而不是把位置也放进 React state：位置每帧都在变，
   * 走 state 会让整棵子树每帧重渲染。这里只有 punch 一个 state，
   * 而 `usePunchState` 在值没变时不会触发重渲染（容差 0.01px）。
   */
  React.useEffect(() => {
    if (!listHeight) return;
    const apply = () => {
      const w = width.get();
      if (w <= 0) {
        setPunch(null);
        return;
      }
      setPunch({
        x: geo.inset + x.get(),
        y: geo.inset,
        width: w,
        height: listHeight,
        radius: listHeight / 2,
      });
    };
    apply();
    const offX = x.on('change', apply);
    const offW = width.on('change', apply);
    return () => {
      offX();
      offW();
    };
  }, [x, width, listHeight, geo.inset, setPunch]);

  /* ── 拖动 ─────────────────────────────────────────────────────────── */

  const drag = React.useRef<{
    pointerId: number;
    /** 指针在 List 内的 x 与指示器 left 的差 —— 保持抓取点不跳 */
    grabOffset: number;
    startClientX: number;
    lastClientX: number;
    lastT: number;
    moved: boolean;
  } | null>(null);

  const onTriggerPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      setPressed(true);
      const el = e.currentTarget;
      /* 只有当前选中段能起拖 —— 理由见文件头第 3 条 */
      if (el.getAttribute('data-state') !== 'active') return;
      const list = listRef.current;
      if (!list) return;
      const lb = list.getBoundingClientRect();
      drag.current = {
        pointerId: e.pointerId,
        grabOffset: e.clientX - lb.left - x.get(),
        startClientX: e.clientX,
        lastClientX: e.clientX,
        lastT: performance.now(),
        moved: false,
      };
    },
    [x],
  );

  /**
   * 移动与收尾都挂在 window 上，**不用 setPointerCapture**。
   *
   * 捕获会把后续事件（含松手那一下的 click）全部锁到起手的那个 trigger 上 ——
   * 于是拖到别的段松手时，Radix 收到的是**原来那一段**的 click，
   * 选中态会被弹回去。挂 window 则让原生 click 落在指针底下的那个段上，
   * 与拖动过程中已经切好的值一致。
   *
   * 顺带解决旧代码里那个问题：指针可能在别的元素上松开（快速滑动切换时常见），
   * 只听自己的 pointerup 会把按下态卡住。
   */
  React.useEffect(() => {
    if (!pressed) return;

    const onMove = (e: PointerEvent) => {
      const st = drag.current;
      const list = listRef.current;
      if (!st || !list || e.pointerId !== st.pointerId) return;

      if (!st.moved) {
        if (Math.abs(e.clientX - st.startClientX) < DRAG.threshold) return;
        st.moved = true;
        setDragging(true);
      }

      const lb = list.getBoundingClientRect();
      const w = width.get();
      const next = Math.min(Math.max(e.clientX - lb.left - st.grabOffset, 0), lb.width - w);
      x.set(next);

      /* 速度 → 横向拉伸。reduced-motion 下整条链路不参与（§13） */
      if (!reducedMotion) {
        const now = performance.now();
        const dt = Math.max(1, now - st.lastT);
        const v = Math.abs(((e.clientX - st.lastClientX) / dt) * 1000);
        st.lastClientX = e.clientX;
        st.lastT = now;
        const k = Math.min(1, v / DRAG.stretchAtVelocity);
        stretch.set(1 + k * (DRAG.maxStretch - 1));
      }

      /*
       * 指示器**中心**落在哪一段，就切到哪一段。
       *
       * Radix 不把 value 的 setter 暴露出来，所以只能从 DOM 这一侧发事件。
       *
       * ⚠️ **必须是 `mousedown`，不能是 `.click()`。** Radix 的 Tabs Trigger
       * 只挂了 `onMouseDown` / `onKeyDown` / `onFocus`，**根本没有 onClick** ——
       * 第一版写的 `el.click()` 于是什么都没发生：指示器跟着手指走、宽度也在变，
       * 唯独选中态纹丝不动，而且不报任何错。
       * （`onMouseDown` 里还判了 `button === 0 && !ctrlKey`，所以两个字段都要给。）
       *
       * 再补一次 `focus()`：让 roving tabindex 跟到新选中项上，
       * 否则拖完之后按 Tab 回来，焦点还在起手那一段。
       * `preventScroll` 是必须的 —— 拖动中让页面滚一下会很难受。
       */
      const centre = next + w / 2;
      const target = segs.findIndex((sg) => centre >= sg.left && centre < sg.left + sg.width);
      if (target >= 0 && target !== activeIndex && !segs[target]!.disabled) {
        const el = segs[target]!.el;
        el.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
        );
        el.focus({ preventScroll: true });
        animate(width, segs[target]!.width, transitionFor('snappy', reducedMotion));
      }
    };

    const onUp = () => {
      const st = drag.current;
      drag.current = null;
      setPressed(false);
      stretch.set(1);
      /* 交回给上面那个 effect：它会用 spring 把指示器落到选中段 */
      if (st?.moved) setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [pressed, segs, activeIndex, reducedMotion, x, width, stretch]);

  const listCtx = React.useMemo(() => ({ onTriggerPointerDown }), [onTriggerPointerDown]);
  const indicatorRadius = concentricRadius(geo.baseRadius, geo.inset);

  return (
    <GlassSurface
      layer="base"
      radius={geo.baseRadius}
      punch={punch}
      className={cn('relative isolate w-fit', className)}
      /*
       * `style` 与 `className` 必须落在**同一个元素**上。
       *
       * 原先 className 给了 GlassSurface（可见的那层玻璃），而 style 跟着 ...props
       * 落到里面那个 flex 行上 —— 于是 `className="absolute"` + `style={{bottom:16}}`
       * 这种再正常不过的写法会得到「absolute 生效了但 bottom 没生效」，
       * 栏跑到容器顶上去。首页 Hero 把 Tab Bar 定到屏幕底部时踩到的就是这个。
       * 这是和 data-slot 覆盖同一类的坑：**调用方看不到组件内部把 props 拆到了哪儿**。
       */
      style={{ height: 'var(--lg-tabs-height)', padding: geo.inset, ...style }}
    >
      <TabsListCtx.Provider value={listCtx}>
        <TabsPrimitive.List
          ref={listRef}
          data-slot="tabs-list"
          className="relative flex h-full items-stretch gap-0"
          /*
           * 横向归控件、纵向留给页面滚动。
           * 不写的话触屏上一横划就被浏览器判成滚动，指示器根本拖不动。
           */
          style={{ touchAction: 'pan-y' }}
          {...props}
        >
          {segs.length > 0 && activeIndex >= 0 ? (
            <motion.div
              aria-hidden="true"
              data-slot="tabs-indicator"
              data-dragging={dragging ? 'true' : undefined}
              className="pointer-events-none absolute top-0 left-0 h-full"
              style={{ x, width, scale: pressScale, scaleX: stretch, scaleY: squash }}
            >
              {/*
                材质的三档强度，越交互越「液态」：

                  静止    intensity 2 / dispersion 2
                  按住    pressed → intensity 3、提亮、饱和上扬、投影加深
                          （GlassSurface 内部处理，见 optics.css 的 data-pressed）
                  拖动    再把色散推到 3 —— 边缘出现可见的彩色分离，
                          那是 Layer I 的签名特征（PROJECT_SPEC §2 要求指示器
                          「必须有可见色散」），静止时不该这么强。

                对应 Apple 那句 "the knob transforms into Liquid Glass during
                interaction"：静止是磨砂上的一块亮片，手一碰才真的变成玻璃。
              */}
              <GlassSurface
                layer="indicator"
                radius={indicatorRadius}
                pressed={pressed}
                dispersion={dragging ? 3 : 2}
                className="h-full w-full"
              />
            </motion.div>
          ) : null}
          {children}
        </TabsPrimitive.List>
      </TabsListCtx.Provider>
    </GlassSurface>
  );
}

export interface GlassTabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger> {}

/**
 * 触发器。**不再自带指示器** —— 指示器是 List 里唯一的一个（见文件头第 1 条）。
 *
 * 这里只剩三件事：文字、未选中项的 hover 反馈、把按下事件交给 List。
 * 选中与否一律走 `data-state` 的 CSS 变体，不再用 MutationObserver 同步到
 * React state —— 那份状态原本只是为了给自己那个指示器用的。
 */
function TabsTrigger({ className, children, value, onPointerDown, ...props }: GlassTabsTriggerProps) {
  const listCtx = React.useContext(TabsListCtx);
  if (!listCtx) throw new Error('<TabsTrigger> 必须放在 <TabsList> 里');
  const [hovered, setHovered] = React.useState(false);
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <TabsPrimitive.Trigger
      value={value}
      data-slot="tabs-trigger"
      className={cn(
        'group relative z-10 inline-flex items-center justify-center gap-1.5',
        'px-5 text-[15px] font-semibold whitespace-nowrap',
        'rounded-[inherit] outline-none select-none',
        // 未选中用次级标签色，选中转主要标签色 —— 走 token，不写裸色值
        'text-[var(--lg-label-secondary)] data-[state=active]:text-[var(--lg-label-primary)]',
        // 焦点环必须在玻璃上清晰可见（PROJECT_SPEC §13）
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      onPointerDown={(e) => {
        listCtx.onTriggerPointerDown(e);
        onPointerDown?.(e);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      {...props}
    >
      {/*
        未选中项的 hover 反馈。

        **只有 hover，没有单独的 active。** Radix 在 pointerdown 就完成选中，
        未选中项因此不存在可见的「按下但仍未选中」阶段 —— 写一段按下加深的
        分支只会是死代码。按下的反馈由指示器承担（见 TabsList 里的强度阶梯），
        这与 iOS 上按一下分段控件的观感一致。

        选中时整块藏起来走 `group-data-[state=active]:hidden`，
        不再需要一份「我是不是选中」的 React state。

        用 motion 的 opacity 而不是 CSS transition：PROJECT_SPEC §15.6 禁止
        用贝塞尔曲线做状态过渡，一律走 spring 预设。
        颜色走 fill 家族 token，不写裸色值（§15.4）。
      */}
      <motion.span
        aria-hidden="true"
        data-slot="tabs-trigger-highlight"
        className="absolute inset-0 -z-10 rounded-[inherit] group-data-[state=active]:hidden"
        style={{ background: 'var(--lg-fill-quaternary)' }}
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={transitionFor('smooth', reducedMotion)}
      />
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
