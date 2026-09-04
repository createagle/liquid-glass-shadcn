'use client';

// APPLE REFERENCE: UISheetPresentationController / SwiftUI `.sheet` + `.presentationDetents`
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:24130）。
// 参考图 screenshots/ios27-sheet.png（整屏 402×874，1px = 1pt）。
// 完整测量见 apple-metrics.md §7.5。
//
//   左右边距          6 pt          [实测] —— 宽 390 = 402 − 12
//   底部边距          6 pt          [实测] —— 874 − (409 + 459) = 6
//   **圆角**          34 pt         [实测] —— 见下方「圆角是怎么定的」
//   抓手              58 × 4 pt     [实测] —— 元数据与像素扫描**逐位吻合**
//   抓手占位区        16 pt 高      [实测] —— 抓手在其中 y = 5
//   sheet 内工具栏    54 pt 高      [实测]
//   medium 档高度     459 / 874     [实测] —— 即 0.525，与 HIG「about half」相符
//
// ⚠️ 可信度：标 [实测] 而非 [官方]，理由同其他组件 ——
//    (a) 文件是 iOS 27 而 SPEC 基准是 iOS 26；(b) 文件标题带 "(Community)"。
//
// ── 圆角是怎么定的 ────────────────────────────────────────────────────
//
// apple-metrics §7.5 原本把圆角记为「仍未取得」。这次补上了。
//
// 参考图里 sheet 外面有一圈落影，直接按颜色阈值找边会量到影子而不是面板；
// 改成沿每行找**亮度最低点**（那条 1px 暗轮廓线就是面板边缘），再对
// `inset(dy) = r − √(r²−(r−dy)²)` 做最小二乘：
//
//   r = 34.08，RMSE 0.376 px（28 个采样点）
//   固定半径复算：34 → 0.379，32 → 1.175，36 → 1.116
//
// ✅ **34 与 --lg-radius-xl 又一次撞上了。** 这已经是第三处独立来源
//    （Phase 1 定的 token、Alert 的轮廓拟合、这次的 Sheet），可以认为
//    34 就是 iOS 大圆角容器的那个值。
//
// ⚠️ **只量到了上面两个角。** 下面两个角紧贴设备圆角边框与落影，
//    同一套方法量出来是噪声（拟合 r≈60、RMSE 2.5，明显在量影子）。
//
// ✅✅ **2026-09-04 更正：下两角不是 34，是 58 —— 而且当年那个「噪声」是对的。**
//
//    直接读节点属性（`I12740:24130;10525:1636` 的 `Fill + Shadow` 层）：
//    `topLeft = topRight = 34`，`bottomLeft = bottomRight = **58**`。
//    上两角的拟合值 34.08 因此得到独立确认；
//    而下两角当年拟合出的 **r ≈ 60** 被判成「在量影子」丢掉了 ——
//    它其实离真值 58 只差 2，是这套方法在那个位置**唯一一次接近正确**却被否掉。
//
//    58 不是随便一个数：sheet 左右各内缩 6，与设备圆角**同心**
//    （concentricRadius(64, 6) = 58）。也就是说下两角要贴着屏幕的圆角走，
//    上两角才是 sheet 自己的圆角。四角同值是错的。
//
//    **教训**：拟合出的异常值被解释成噪声之前，先问一句「如果它是真的，
//    能不能解释得通」。58 与设备圆角同心 —— 当年只要算一下就该发现。
//
// ── 分层 ──────────────────────────────────────────────────────────────
// PROJECT_SPEC §2 的分层速查表：`| Sheet / Drawer | 面板 | grabber 抓手 |`
// 也就是**面板是 Layer B，抓手是 Layer I**。
//
// ⚠️ 抓手只有 **4pt 高**。Layer I 要求「可见色散」，但色散偏移量在本库最强档
//    也就 1–2px 量级，压在一条 4px 高的横条上**看不出来** —— 这一条如实记在
//    STATUS 的自查里，没有假装达标。抓手仍然走 indicator 层（规格如此），
//    并按 Button / Toggle 的同一套办法补回底色（`--lg-grabber-fill`），
//    否则 α=0 的 4px 透明条等于没画。
//
// ── 拖拽从哪里起手 ────────────────────────────────────────────────────
//
// **默认只有抓手区与 SheetHeader 能起手拖拽**（`dragFrom="handle"`）。
//
// 不默认整片可拖的原因很实在：sheet 里通常有可滚动内容，「手指下滑」到底是
// 滚内容还是拖面板，需要一套滚动协调（内容滚到顶端后才把手势交给面板）。
// 那套东西没做，与其做一半不如不做 —— 内容不滚动的场景可以传
// `dragFrom="sheet"` 打开整片拖拽。这是**已知的未完成**，不是设计选择。

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type PanInfo,
} from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { Button, type GlassButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 左右边距。[实测] */
  sideInset: 6,
  /** 底部边距。[实测]（真机上会被 safe-area 顶上去，见 SheetContent 的 bottom） */
  bottomInset: 6,
  /** 上两角圆角。[实测] 34 —— 拟合 34.08 与节点属性两处一致 */
  radius: 34,
  /**
   * 下两角圆角。[实测] **58**，不是 34。
   *
   * 与设备圆角同心：sheet 左右各内缩 6，`concentricRadius(64, 6) = 58`。
   * 2026-09-04 更正，原来按对称推定成 34，见文件头。
   */
  radiusBottom: 58,
  /** 抓手宽。[实测] —— 58 × 4，元数据与像素扫描逐位吻合 */
  grabberWidth: 58,
  /** 抓手高。[实测] —— 只有 4pt，色散在这个尺度上看不出来，见文件头 */
  grabberHeight: 4,
  /** 抓手占位区高度。[实测] */
  grabberZone: 16,
  /** 抓手在占位区内的顶部偏移。[实测] */
  grabberTop: 5,
  /** sheet 内工具栏高。[实测] —— SheetHeader 的最小高度取它 */
  toolbarHeight: 54,
  /** 内容内边距。`[推定]` —— 参考图里 sheet 内容区是空的，量不到 */
  padding: 16,
} as const;

/**
 * 档位（detents）。数值是**视口高度的比例**。
 *
 *   0.525  [实测] —— 参考图里 sheet 高 459 / 屏高 874。
 *                    与 HIG 的 "medium is about half of the fully expanded height" 相符。
 *   0.94   `[推定]` —— **没有量到 large 档。** 参考图只给了一个档位。
 *                    取 0.94 是为了在顶部留出一点背后页面，做出 iOS 的层叠观感。
 */
export const DEFAULT_DETENTS = [0.525, 0.94] as const;

const MOTION = {
  /**
   * 甩动关闭的速度阈值（px/s）。`[推定]` —— 没有可逐帧量的 iOS 录像。
   * 500 px/s 大致是「明显甩了一下」而不是「慢慢拖下来」。
   */
  flingVelocity: 500,
  /**
   * 速度投影时长（秒）。松手时把当前速度外推这么久，用**落点**决定吸附到哪一档 ——
   * 这是 iOS 那种「跟手」的关键：快速小幅度也能翻档。`[推定]`
   */
  projection: 0.2,
  /** 拖过最矮档位高度的这个比例就关闭。`[推定]` */
  dismissRatio: 0.4,
  /** 背后页面缩到多小。`[推定]` —— iOS 的层叠观感，量不到具体值 */
  wrapperScale: 0.94,
} as const;

/* ── 视口高度 ─────────────────────────────────────────────────────────── */

/**
 * 用 `useSyncExternalStore` 而不是 `useEffect + useState` —— 与 PROJECT_SPEC §9
 * 对 ResponsiveOverlay 的要求同源：后者首帧会用错误的值渲染再纠正，
 * 档位高度会肉眼可见地跳一下。
 *
 * 取 `visualViewport.height` 优先：移动端浏览器地址栏收起/展开会改变可视高度，
 * `innerHeight` 不跟着变，sheet 底部会露出一条缝。
 */
function viewportHeight() {
  if (typeof window === 'undefined') return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

function subscribeViewport(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', onChange);
  window.visualViewport?.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.visualViewport?.removeEventListener('resize', onChange);
  };
}

function useViewportHeight() {
  return React.useSyncExternalStore(subscribeViewport, viewportHeight, () => 0);
}

/* ── context ──────────────────────────────────────────────────────────── */

interface SheetRootValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const SheetRootCtx = React.createContext<SheetRootValue | null>(null);

interface SheetPartsValue {
  close: () => void;
  /** 抓手区 / 标题区把拖拽起手权交给面板 */
  startDrag: (event: React.PointerEvent) => void;
  /** 抓手被**点按**（不是拖）→ 在档位间循环。HIG 明确要求。 */
  cycleDetent: () => void;
  dragFrom: 'handle' | 'sheet';
}

const SheetPartsCtx = React.createContext<SheetPartsValue | null>(null);

function useSheetParts(part: string) {
  const ctx = React.useContext(SheetPartsCtx);
  if (!ctx) throw new Error(`<${part}> 必须放在 <SheetContent> 里`);
  return ctx;
}

/* ── Root ─────────────────────────────────────────────────────────────── */

export interface GlassSheetProps extends React.ComponentProps<typeof SheetPrimitive.Root> {}

/**
 * 开关态自己接管一份 —— 与 Dialog 同因：退场动画要等面板真的滑出屏幕，
 * 而 Radix 在关闭时会立刻卸载 Content。
 */
function Sheet({ open, defaultOpen, onOpenChange, children, ...props }: GlassSheetProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const current = controlled ? open : uncontrolled;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const value = React.useMemo(() => ({ open: current, setOpen }), [current, setOpen]);

  return (
    <SheetRootCtx.Provider value={value}>
      <SheetPrimitive.Root open={current} onOpenChange={setOpen} {...props}>
        {children}
      </SheetPrimitive.Root>
    </SheetRootCtx.Provider>
  );
}

/**
 * 触发器保持 Radix 原样（带好 aria 接线的原生 button）。
 * 与 Dialog 同因：本库禁用 asChild，没法把任意元素提升成触发器。
 */
const SheetTrigger = SheetPrimitive.Trigger;

/* ── Content ──────────────────────────────────────────────────────────── */

export interface GlassSheetContentProps
  extends Omit<
    React.ComponentProps<typeof SheetPrimitive.Content>,
    'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
  > {
  /** 档位，视口高度的比例。默认 [0.525, 0.94]。传进来会自动升序排序。 */
  detents?: readonly number[];
  /** 初始停在第几档（升序后的索引）。默认 0，即最矮那一档。 */
  defaultDetent?: number;
  /** 是否显示抓手。默认 true —— HIG：抓手是下滑关闭的可见提示。 */
  grabber?: boolean;
  /** 下滑能否关闭。默认 true。 */
  dismissible?: boolean;
  /**
   * 从哪里起手拖拽。默认 `handle`（抓手区 + SheetHeader）。
   * 内容不滚动时可以用 `sheet` 打开整片拖拽 —— 理由见文件头。
   */
  dragFrom?: 'handle' | 'sheet';
}

function SheetContent(props: GlassSheetContentProps) {
  const root = React.useContext(SheetRootCtx);
  if (!root) throw new Error('<SheetContent> 必须放在 <Sheet> 里');
  // 拆成两层纯粹是为了把这句 throw 放在**所有 hook 之前**，
  // 否则 root 为空时会出现「hook 数量在两次 render 间不同」。
  return <SheetContentInner root={root} {...props} />;
}

function SheetContentInner({
  root,
  className,
  children,
  detents = DEFAULT_DETENTS,
  defaultDetent = 0,
  grabber = true,
  dismissible = true,
  dragFrom = 'handle',
  style,
  onOpenAutoFocus,
  ...props
}: GlassSheetContentProps & { root: SheetRootValue }) {
  const { open, setOpen } = root;
  const contentRef = React.useRef<HTMLDivElement>(null);

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const vh = useViewportHeight();
  const dragControls = useDragControls();

  const sorted = React.useMemo(() => [...detents].sort((a, b) => a - b), [detents]);
  const tallest = sorted[sorted.length - 1] ?? 1;

  /**
   * 面板始终按**最高档**的高度渲染，靠位移露出当前档 ——
   * 改 height 会触发重排，拖起来会卡。
   */
  const sheetHeight = tallest * vh;
  /** 每一档对应的位移量：档位越矮，往下推得越多。升序档位 → 降序位移。 */
  const offsets = React.useMemo(
    () => sorted.map((d) => (tallest - d) * vh),
    [sorted, tallest, vh],
  );
  /** 最矮档的位移（sheet 位置最低）、最高档的位移（= 0）。 */
  const offsetLowest = offsets[0] ?? 0;
  const offsetHighest = offsets[offsets.length - 1] ?? 0;
  /** 完全移出屏幕的位移。 */
  const dismissY = sheetHeight + GEOMETRY.bottomInset;

  const [detentIndex, setDetentIndex] = React.useState(() =>
    Math.min(Math.max(defaultDetent, 0), sorted.length - 1),
  );
  const y = useMotionValue(0);

  /**
   * 挂载态自己管，**不用 AnimatePresence**。
   *
   * 面板的退场不是一条 `exit` 变体，而是「把 y 弹到 dismissY」——
   * AnimatePresence 看不见这种由 motion value 驱动的退场，会在下一帧就卸载。
   * 所以这里等 `animate()` 的 promise 真的 resolve 了再卸载，
   * 卸载时机 = 面板真的滑出屏幕。
   */
  const [mounted, setMounted] = React.useState(open);
  const spring = transitionFor('snappy', reducedMotion);
  /** 这一轮打开是否已经把面板挪到过屏幕外（= 入场动画的起点）。 */
  const enteredRef = React.useRef(false);

  React.useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  React.useEffect(() => {
    if (!vh || !mounted) return;
    if (open) {
      // 先把面板放到屏幕外再往上弹，否则第一帧会直接出现在最终位置
      if (!enteredRef.current) {
        enteredRef.current = true;
        y.set(dismissY);
      }
      const controls = animate(y, offsets[detentIndex] ?? 0, spring);
      return () => controls.stop();
    }
    enteredRef.current = false;
    const controls = animate(y, dismissY, spring);
    void controls.then(() => setMounted(false));
    return () => controls.stop();
    // spring 是常量对象；offsets 变化（视口 resize）时要重新吸附
  }, [open, mounted, detentIndex, offsets, dismissY, vh, y]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 遮罩随下拉淡出 —— 拖到一半松手会回弹，遮罩跟着回来 */
  const scrimOpacity = useTransform(y, [offsetLowest, dismissY], [1, 0], { clamp: true });

  /**
   * 面板按**最高档**渲染再往下位移，于是低档位时面板底部有一截在屏幕外 ——
   * 如果内容直接按面板全高布局，`SheetFooter` 会被推出可视区（实测：视口 734、
   * medium 档下 footer 落在 y=953）。
   *
   * 用一条跟着位移走的 padding-bottom 把「屏幕外那一截」让出来，
   * 内容就始终按**可见高度**排版，footer 贴在可见底边上 —— iOS 的 sheet
   * 在 medium 档下也是这个行为（它是真的变矮，不是被裁掉）。
   */
  const hiddenBelow = useTransform(y, (v) => `${Math.max(0, Math.min(v, sheetHeight))}px`);

  /** 背后页面的层叠后退（PROJECT_SPEC §9）。reduced-motion 下整条不做。 */
  const wrapperScale = useTransform(y, [offsetLowest, dismissY], [MOTION.wrapperScale, 1], {
    clamp: true,
  });
  useMotionValueEvent(wrapperScale, 'change', (v) => {
    if (typeof document === 'undefined' || reducedMotion) return;
    const el = document.documentElement;
    el.style.setProperty('--lg-sheet-wrapper-scale', String(v));
    el.style.setProperty('--lg-sheet-wrapper-radius', `${GEOMETRY.radius}px`);
  });
  /** 卸载时收干净。关闭过程中不收 —— 收了背景会瞬间弹回去，动画就断了。 */
  React.useEffect(
    () => () => {
      const el = document.documentElement;
      el.style.removeProperty('--lg-sheet-wrapper-scale');
      el.style.removeProperty('--lg-sheet-wrapper-radius');
    },
    [],
  );

  const startDrag = React.useCallback(
    (event: React.PointerEvent) => {
      if (dragFrom === 'handle') dragControls.start(event);
    },
    [dragControls, dragFrom],
  );

  const cycleDetent = React.useCallback(() => {
    // HIG：> "they can also tap it to cycle through the detents"
    setDetentIndex((i) => (i + 1) % sorted.length);
  }, [sorted.length]);

  const parts = React.useMemo(
    () => ({ close: () => setOpen(false), startDrag, cycleDetent, dragFrom }),
    [setOpen, startDrag, cycleDetent, dragFrom],
  );

  function handleDragEnd(_: unknown, info: PanInfo) {
    const current = y.get();
    /**
     * 速度投影：把当前速度外推 200ms，用**落点**决定归到哪一档。
     * 只看位移的话，快速小幅度的甩动会被判成「没动」，手感会很木。
     */
    const projected = current + info.velocity.y * MOTION.projection;
    const flungDown = info.velocity.y > MOTION.flingVelocity;
    const pastThreshold =
      projected > offsetLowest + (sorted[0] ?? 0.5) * vh * MOTION.dismissRatio;

    if (dismissible && (flungDown || pastThreshold)) {
      setOpen(false);
      return;
    }

    let best = 0;
    let bestDist = Infinity;
    offsets.forEach((o, i) => {
      const d = Math.abs(projected - o);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best === detentIndex) animate(y, offsets[best] ?? 0, spring);
    else setDetentIndex(best);
  }

  if (!mounted) return null;

  return (
    <SheetPartsCtx.Provider value={parts}>
      <SheetPrimitive.Portal forceMount>
        <SheetPrimitive.Overlay forceMount data-slot="sheet-overlay" className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'var(--lg-scrim)', opacity: scrimOpacity }}
          />
        </SheetPrimitive.Overlay>

        <SheetPrimitive.Content
          forceMount
          ref={contentRef}
          data-slot="sheet-content"
          data-detent={detentIndex}
          /**
           * 打开时把焦点落在**面板本身**，而不是第一个可聚焦元素。
           *
           * 不这么做的话第一个可聚焦元素是抓手 —— 于是一打开就有一道焦点环
           * 套在那条 4pt 的横条上（视觉快照里当场看见了），而且屏幕阅读器
           * 先读到的是「调整面板高度」而不是面板的标题。
           * 面板自带 tabIndex=-1（Radix 给的），聚焦它即可正常播报标题。
           *
           * 调用方可以传自己的 onOpenAutoFocus 并 preventDefault 来接管。
           */
          onOpenAutoFocus={(e) => {
            onOpenAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            contentRef.current?.focus({ preventScroll: true });
          }}
          className={cn('fixed z-50 outline-none', className)}
          style={{
            left: GEOMETRY.sideInset,
            right: GEOMETRY.sideInset,
            /**
             * safe-area：iPhone 底部有 Home Indicator，实测的 6pt 边距会压在它上面。
             * 取两者较大值 —— 桌面上就是 6，真机上让开指示条。
             */
            bottom: `max(${GEOMETRY.bottomInset}px, env(safe-area-inset-bottom))`,
            height: sheetHeight || undefined,
            ...style,
          }}
          {...props}
        >
          <motion.div
            data-slot="sheet-panel"
            className="h-full w-full touch-none"
            style={{ y }}
            drag="y"
            dragControls={dragControls}
            dragListener={dragFrom === 'sheet'}
            dragConstraints={{ top: offsetHighest, bottom: dismissY }}
            dragElastic={{ top: 0.02, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
          >
            <GlassSurface
              layer="elevated"
              radius={GEOMETRY.radius}
              continuous
              className="h-full w-full overflow-hidden"
              /*
               * ⚠️ 四个角**不同值**：上 34、下 58（都是实测，见文件头）。
               * `GlassSurface` 的 `radius` 只接一个数，所以下两角用内联样式盖掉 ——
               * `border-radius` 的四角写法优先级与单值相同，写在 style 上就是最后一个赢。
               * `radius` 仍然要传：`--lg-surface-radius` 还被高光描边等内部计算用着。
               */
              style={{
                borderBottomLeftRadius: GEOMETRY.radiusBottom,
                borderBottomRightRadius: GEOMETRY.radiusBottom,
              }}
            >
              <motion.div
                data-slot="sheet-layout"
                className="flex h-full w-full flex-col"
                style={{ paddingBottom: hiddenBelow }}
              >
                {grabber ? <SheetGrabber /> : null}
                {children}
              </motion.div>
            </GlassSurface>
          </motion.div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPartsCtx.Provider>
  );
}

/* ── 抓手 ─────────────────────────────────────────────────────────────── */

/**
 * PROJECT_SPEC §2 把抓手归为 **Layer I**（面板是 Layer B）。
 *
 * ⚠️ 它只有 4pt 高 —— §14 要求 Layer I「有可见色散」，但色散偏移在本库最强档
 * 也只有 1–2px 量级，压在 4px 高的横条上看不出来。这条如实记在 STATUS 的自查里。
 * 走 indicator 层是照规格办事，同时按 Button / Toggle 的办法补回底色，
 * 否则 α=0 的透明条等于没画。
 *
 * 无障碍：HIG 明确抓手要支持 VoiceOver 且**点按可循环档位**，
 * 所以它是一个真正的 button，不是装饰性的 div。
 */
function SheetGrabber() {
  const { startDrag, cycleDetent, dragFrom } = useSheetParts('SheetGrabber');
  const movedRef = React.useRef(false);

  return (
    <div
      data-slot="sheet-grabber-zone"
      className="relative flex w-full shrink-0 items-start justify-center"
      style={{ height: GEOMETRY.grabberZone, paddingTop: GEOMETRY.grabberTop }}
      onPointerDown={(e) => {
        movedRef.current = false;
        startDrag(e);
      }}
      onPointerMove={() => {
        movedRef.current = true;
      }}
    >
      <button
        type="button"
        data-slot="sheet-grabber"
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]"
        style={{ width: GEOMETRY.grabberWidth, height: GEOMETRY.grabberHeight }}
        aria-label="调整面板高度"
        onClick={() => {
          // 拖过就不算点按，否则每次拖完都会多翻一档
          if (dragFrom === 'handle' && movedRef.current) return;
          cycleDetent();
        }}
      >
        {/* 抓手本体只有 4pt 高，命中区靠这层透明扩张撑到 HIG 的 44pt */}
        <span
          aria-hidden="true"
          data-slot="sheet-grabber-hit"
          className="absolute"
          style={{ inset: '-20px -12px', cursor: 'grab' }}
        />
        <GlassSurface
          layer="indicator"
          radius={GEOMETRY.grabberHeight / 2}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/*
            补回底色 —— 与 Button 按下态、Toggle 选中态是同一个陷阱：
            `.lg-surface[data-layer='indicator']` 的 background-color 是
            transparent，α=0 的 4px 横条在任何背景上都看不见。
          */}
          <span
            aria-hidden="true"
            data-slot="sheet-grabber-fill"
            className="absolute inset-0 rounded-[inherit]"
            style={{ background: 'var(--lg-grabber-fill)' }}
          />
        </GlassSurface>
      </button>
    </div>
  );
}

/* ── 槽位 ─────────────────────────────────────────────────────────────── */

export interface GlassSheetHeaderProps extends React.ComponentProps<'div'> {}

/**
 * 标题区。**同时也是拖拽起手区**（`dragFrom="handle"` 时）——
 * iOS 上从标题栏往下拖是最自然的关闭动作。
 * 高度取参考图里 sheet 内工具栏的 54pt。
 */
function SheetHeader({ className, style, ...props }: GlassSheetHeaderProps) {
  const { startDrag, dragFrom } = useSheetParts('SheetHeader');
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex shrink-0 flex-col justify-center', className)}
      style={{
        paddingInline: GEOMETRY.padding,
        minHeight: GEOMETRY.toolbarHeight,
        ...style,
      }}
      onPointerDown={dragFrom === 'handle' ? startDrag : undefined}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      // 参考图里 sheet 的标题是**居中**的（Alert 的标题则是左对齐 —— 两者不同）
      className={cn('text-center', className)}
      style={{
        fontSize: 17,
        lineHeight: '22px',
        fontWeight: 600,
        color: 'var(--lg-label-primary)',
        ...style,
      }}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={className}
      style={{
        // 15 = subheadline，`[待核实]`（apple-metrics §6 没找到 Apple 出处）
        fontSize: 15,
        lineHeight: '22px',
        color: 'var(--lg-label-secondary)',
        ...style,
      }}
      {...props}
    />
  );
}

export interface GlassSheetBodyProps extends React.ComponentProps<'div'> {}

/** 正文区，可滚动。注意它**不**参与拖拽 —— 理由见文件头。 */
function SheetBody({ className, style, ...props }: GlassSheetBodyProps) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      style={{ padding: GEOMETRY.padding, ...style }}
      {...props}
    />
  );
}

export interface GlassSheetFooterProps extends React.ComponentProps<'div'> {}

function SheetFooter({ className, style, ...props }: GlassSheetFooterProps) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('flex shrink-0 items-center gap-2', className)}
      style={{ padding: GEOMETRY.padding, ...style }}
      {...props}
    />
  );
}

export interface GlassSheetCloseProps extends GlassButtonProps {}

/**
 * 关闭按钮 —— **直接渲染本库的 Button**，与 `DialogClose` 同一套做法。
 *
 * 为什么不给一个裸 `<button>` 让调用方自己套外观：本库禁用 asChild，
 * `<SheetClose><Button/></SheetClose>` 会变成 button 套 button（无效 HTML，
 * React 会直接报 hydration 错 —— 写验证台时当场踩到）。
 *
 * 参考图里 sheet 的关闭键是工具栏上的圆形图标按钮，用
 * `<SheetClose variant="glass" size="icon">` 就是那个形态。
 *
 * 不要写 data-slot：Button 在展开 props **之前**设了 data-slot="button"，
 * 这里再给一个会把它顶掉（Dialog 上踩过）。
 */
function SheetClose({ onClick, ...props }: GlassSheetCloseProps) {
  const { close } = useSheetParts('SheetClose');
  return (
    <Button
      data-sheet-close=""
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) close();
      }}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
};
