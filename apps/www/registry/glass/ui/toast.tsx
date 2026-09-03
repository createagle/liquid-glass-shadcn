'use client';

// APPLE REFERENCE: 无直接对应
//
// ⚠️⚠️ **这个组件在 Apple 那边没有对应物，参考图一张都没有。**
//
//   component-inventory 写的是「接近系统通知横幅」——「接近」两个字要当真：
//   系统通知横幅是**系统级**的，App 画不出来，设计资源里当然也不会有它的样例。
//   HIG 里与之最近的是 alerts / activity views，都不是这个形态。
//
//   所以本组件的几何分两类，逐条标注：
//     · 从别处**借**来的     内边距 14 借自 Alert 实测（§7.6）
//                            最大宽 370 借自 Grouped List 区块宽实测（§8.2）
//     · **纯推定**           圆角、堆叠偏移、停留时长、滑动关闭阈值
//
//   借来的值对它们的原主是 `[实测]`，对 Toast 只能算 `[推定 · 借自实测]`。
//
// 分层：`elevated` —— 与本库所有浮层面板（Popover / Dialog / Tooltip）一致。
//
// ── 为什么用 @radix-ui/react-toast 而不是自己写 ─────────────────────────
// 一个能用的 toast 要处理：live region 的正确用法、计时器在 hover/focus 时暂停、
// 指针滑动关闭、窗口失焦时不计时、F8 跳到通知区、多条时的焦点顺序。
// 这些**全是无障碍语义**，自己写十有八九是错的。Radix 已经做对了，
// 本库负责的是它的**皮**，不是它的行为 —— 与 Dialog / Select 是同一个分工。

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { GlassSurface, springs, useGlassOptional } from '@glass/core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 内边距（px）。`[推定]` —— 借自 Alert 实测的 14pt（apple-metrics §7.6） */
  padding: 14,
  /** 最大宽度（px）。`[推定]` —— 借自 Grouped List 的区块宽 370（§8.2） */
  maxWidth: 370,
  /** 圆角（px）。`[推定]` —— 取圆角阶梯上的 22 */
  radius: 22,
  /** 标题字号（px）。[实测] 17pt —— 与 Alert 标题、列表行标签同一档 */
  titleSize: 17,
  /** 描述字号（px）。[实测] 13pt —— SF footnote */
  descriptionSize: 13,
  /** 默认停留时长（ms）。`[推定]` */
  duration: 5000,
  /** 通知区距屏幕边缘（px）。`[推定]` */
  viewportInset: 16,
  /** 多条之间的间距（px）。`[推定]` */
  gap: 10,
} as const;

/* ── Provider / Viewport ─────────────────────────────────────────────── */

export interface GlassToastProviderProps
  extends React.ComponentProps<typeof ToastPrimitive.Provider> {}

function ToastProvider({
  duration = GEOMETRY.duration,
  swipeDirection = 'right',
  ...props
}: GlassToastProviderProps) {
  /**
   * `swipeDirection` 必须显式给 —— 不给的话 Radix 不会产生 `data-swipe-*`，
   * 上面那三条滑动关闭的 CSS 就永远不会触发（而且没有任何报错）。
   *
   * 选「向右」而不是「向下」：通知区在底部，向下滑等于把它推向它本来就在的方向，
   * 手势与视觉方向冲突。
   */
  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection={swipeDirection} {...props} />
  );
}

export interface GlassToastViewportProps
  extends React.ComponentProps<typeof ToastPrimitive.Viewport> {}

/**
 * 通知区。**整个应用只该有一个**，放在靠近根节点的地方。
 *
 * 位置定在**底部**而不是顶部：iOS 的系统横幅在顶部，但那是系统的地盘 ——
 * App 自己的临时消息压在状态栏/导航栏上会挡住系统信息。
 * 这是一处**刻意的选择**，不是还原。
 */
function ToastViewport({ className, style, ...props }: GlassToastViewportProps) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn('fixed z-[100] flex flex-col outline-none', className)}
      style={{
        insetInline: GEOMETRY.viewportInset,
        bottom: GEOMETRY.viewportInset,
        gap: GEOMETRY.gap,
        maxWidth: GEOMETRY.maxWidth,
        marginInline: 'auto',
        ...style,
      }}
      {...props}
    />
  );
}

/* ── Toast 本体 ──────────────────────────────────────────────────────── */

export type GlassToastVariant = 'default' | 'destructive';

export interface GlassToastProps extends React.ComponentProps<typeof ToastPrimitive.Root> {
  /**
   * `destructive` 只是**换个描边色**，不换材质。
   *
   * ⚠️ 刻意不做成红底白字：那样在最通透的材质档位下，
   * 红底会被背景稀释成粉色，白字直接掉出 AA。描边 + 正常标签色两边都稳。
   */
  variant?: GlassToastVariant;
}

function Toast({ className, variant = 'default', style, children, ...props }: GlassToastProps) {
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-variant={variant}
      // `.lg-toast` 提供入场 / 离场 / 滑动关闭三组动画，定义在 @glass/theme
      className={cn('lg-toast outline-none', className)}
      style={
        {
          /*
           * 入场/离场与滑动关闭的动效。
           *
           * ⚠️ 这里必须用 CSS 而不是 motion：Radix Toast 用 data-state /
           * data-swipe-direction 驱动，而 motion 的 rAF 内联样式会跟 Radix
           * 自己写的 --radix-toast-swipe-* 变量打架。而且**无限循环之外的
           * 一次性动画 Playwright 能冻住**，视觉回归照样可做。
           *
           * 时长与曲线取自 springs 的 CSS 近似表，不是随手写的（§15.6）。
           */
          '--lg-toast-duration': reducedMotion ? '120ms' : `${springs.snappy.duration * 1000}ms`,
          // 滑出去的终点要越过通知区的边距，否则会在屏幕边缘留一截
          '--lg-toast-viewport-inset': `${GEOMETRY.viewportInset}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <GlassSurface
        layer="elevated"
        radius={GEOMETRY.radius}
        continuous
        className="flex items-start gap-3"
        style={{
          padding: GEOMETRY.padding,
          ...(variant === 'destructive'
            ? { boxShadow: 'inset 0 0 0 1.5px var(--lg-destructive-fill)' }
            : {}),
        }}
      >
        {children}
      </GlassSurface>
    </ToastPrimitive.Root>
  );
}

function ToastTitle({ className, style, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('font-semibold', className)}
      style={{ fontSize: GEOMETRY.titleSize, color: 'var(--lg-label-primary)', ...style }}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('leading-snug', className)}
      style={{
        fontSize: GEOMETRY.descriptionSize,
        color: 'var(--lg-label-secondary)',
        ...style,
      }}
      {...props}
    />
  );
}

export interface GlassToastActionProps
  extends React.ComponentProps<typeof ToastPrimitive.Action> {}

/**
 * 行动按钮。
 *
 * ⚠️ Radix 要求它必须带 `altText` —— 那不是可选的礼貌，是**给辅助技术的兜底**：
 * 屏幕阅读器用户听到通知时按钮可能已经消失了，altText 描述的是
 * 「不用这个按钮的话该怎么做同一件事」。缺了它 Radix 会直接报错。
 */
function ToastAction({ className, style, ...props }: GlassToastActionProps) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 font-semibold outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]',
        className,
      )}
      style={{
        fontSize: GEOMETRY.descriptionSize,
        background: 'var(--lg-fill-secondary)',
        color: 'var(--lg-label-primary)',
        ...style,
      }}
      {...props}
    />
  );
}

function ToastClose({ className, style, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="关闭"
      className={cn(
        'shrink-0 rounded-full outline-none opacity-60 transition-opacity hover:opacity-100',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]',
        className,
      )}
      style={{ width: 20, height: 20, color: 'var(--lg-label-primary)', ...style }}
      {...props}
    >
      <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden="true">
        <path
          d="M6.5 6.5 L13.5 13.5 M13.5 6.5 L6.5 13.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </ToastPrimitive.Close>
  );
}

/* ── 命令式用法 ──────────────────────────────────────────────────────── */

export interface ToastItem {
  id: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: GlassToastVariant;
  duration?: number;
}

type Listener = (items: ToastItem[]) => void;

/**
 * 极简的队列。**刻意不引状态库** —— 一个 toast 队列就是一个数组加两个方法，
 * 引 zustand / jotai 会让 registry item 多一个用户未必想要的依赖。
 *
 * 模块级单例：`toast()` 在任何地方都能调，不需要拿到 context。
 * 这也意味着**一个页面只能有一个 `<Toaster />`** —— 多个会同时收到同一条消息。
 */
let items: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(items);
}

/** 弹一条通知。返回它的 id，可以用 `dismissToast(id)` 提前关掉。 */
export function toast(item: Omit<ToastItem, 'id'>): number {
  const id = ++nextId;
  items = [...items, { ...item, id }];
  emit();
  return id;
}

/** 提前关掉某一条。 */
export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

/**
 * 订阅队列。`<Toaster />` 用它，一般不需要自己调。
 *
 * ⚠️ 用 `useSyncExternalStore` 而不是 useState + useEffect：
 * 后者在 React 18+ 的并发渲染下会**丢掉订阅之前发生的更新**（撕裂），
 * 表现是「页面刚加载就调 toast() 的那一条不显示」。
 */
export function useToasts(): ToastItem[] {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    // SSR 快照：服务端永远是空队列
    () => items,
  );
}

export interface GlassToasterProps {
  /** 同时最多显示几条，超出的排队。默认 3。`[推定]` */
  limit?: number;
}

/**
 * 把队列渲染出来。整个应用放**一个**，靠近根节点。
 *
 * ```tsx
 * <Toaster />
 * // 任意位置：
 * toast({ title: '已保存', description: '改动会同步到所有设备。' });
 * ```
 */
function Toaster({ limit = 3 }: GlassToasterProps) {
  const all = useToasts();
  const visible = all.slice(0, limit);

  return (
    <ToastProvider>
      {visible.map((t) => (
        <Toast
          key={t.id}
          {...(t.variant ? { variant: t.variant } : {})}
          {...(t.duration !== undefined ? { duration: t.duration } : {})}
          onOpenChange={(open) => {
            // Radix 关闭动画结束后才真正从队列里摘掉，否则离场动画会被打断
            if (!open) dismissToast(t.id);
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
            {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  Toaster,
  GEOMETRY as TOAST_GEOMETRY,
};
