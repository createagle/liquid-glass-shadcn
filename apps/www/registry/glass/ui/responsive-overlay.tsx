'use client';

// PROJECT_SPEC §9 的核心原语。
//
//   「Select、DropdownMenu、Combobox、ContextMenu、Menubar、NavigationMenu、
//     DatePicker、Popover 等所有『从触发点弹出浮层』的组件，在移动端**必须**
//     改为从底部滑出的 Drawer（对应 iOS 的 action sheet / 底部选择器）。」
//
// 桌面端渲染 <Popover>，紧凑视口下渲染 <Sheet>，**外部调用方式完全一致**。
//
// ── 判定 ──────────────────────────────────────────────────────────────
//
// SPEC 写死了规则：`(max-width: 768px) || (pointer: coarse)`，
// 实现在 `@glass/core` 的 `useIsCompact()`。**两条都要**：只看宽度会漏掉
// 横屏手机与平板，只看指针会漏掉触屏笔记本上被缩窄的窗口。
//
// 订阅走 `useSyncExternalStore`，不是 `useEffect + useState`。后者在 SSR 下
// 首帧会用错误的值渲染再纠正 —— 浮层本身默认是关的，看不见闪，但
// **触发器的 aria 接线会在两帧之间换一套**，屏幕阅读器可能读到中间态。
//
// SSR 快照一律返回 `false`（= 桌面路径）：服务端没有视口可测，任何猜测都会在
// hydration 时打架。客户端接管后的第一帧就修正，且因为走的是外部 store，
// **不会产生 hydration mismatch 警告**。
//
// ── 无障碍：两条路径必须等价 ──────────────────────────────────────────
//
// SPEC §9：「无障碍不能因为换了渲染方式而退化」。两条路径底层是两个不同的
// Radix 原语，默认行为并不一致 —— 最扎眼的是**可访问名称**：
// Radix Dialog（Sheet 走它）要求必须有 Title，Popover 则不要求。
//
// 所以 `title` 在本组件里是**必填**的：
//   - 移动路径 → 渲染成 `SheetTitle`（真的显示出来，iOS 的 action sheet 也有标题）
//   - 桌面路径 → 落到 `aria-label` 上
// 两边读出来的名称一样。
//
// ── 逃生口 ────────────────────────────────────────────────────────────
// `responsive={false}` 强制桌面行为（SPEC §9 明确要求提供）。

import * as React from 'react';
import { useIsCompact } from '@glass/core';
import {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverContent,
  type GlassPopoverContentProps,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  type GlassSheetContentProps,
} from '@/components/ui/sheet';

interface ResponsiveOverlayCtxValue {
  /** true = 走移动端 Drawer 路径 */
  compact: boolean;
}

const Ctx = React.createContext<ResponsiveOverlayCtxValue | null>(null);

function useOverlayCtx(part: string) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error(`<${part}> 必须放在 <ResponsiveOverlay> 里`);
  return ctx;
}

/** 供上层组件（Select / DropdownMenu）判断当前走的是哪条路径。 */
export function useOverlayMode(): 'sheet' | 'popover' {
  return useOverlayCtx('useOverlayMode').compact ? 'sheet' : 'popover';
}

export interface ResponsiveOverlayProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * 逃生口。`false` 时永远走桌面路径 —— 例如浮层内容在小屏 Drawer 里反而更难用，
   * 或者调用方已经自己做了移动端方案。SPEC §9 明确要求提供这个口子。
   */
  responsive?: boolean;
  children?: React.ReactNode;
}

function ResponsiveOverlay({
  open,
  defaultOpen,
  onOpenChange,
  responsive = true,
  children,
}: ResponsiveOverlayProps) {
  const compact = useIsCompact() && responsive;
  const value = React.useMemo(() => ({ compact }), [compact]);

  /**
   * 只把**真的传了的**键透下去。`exactOptionalPropertyTypes` 下
   * `{ open: undefined }` 与「没有 open」是两回事：前者会把 Radix 推进受控模式，
   * 于是浮层永远打不开。
   */
  const shared = {
    ...(open !== undefined ? { open } : {}),
    ...(defaultOpen !== undefined ? { defaultOpen } : {}),
    ...(onOpenChange !== undefined ? { onOpenChange } : {}),
  };

  /**
   * ⚠️ 两条路径是**两棵不同的树**，切换会把子树整个重挂。
   * 视口跨过 768 或指针类型变了才会发生，属于罕见事件，代价可以接受；
   * 换成「同一棵树里换渲染」要么得放弃 Radix 原语，要么得把两套 aria 接线
   * 自己实现一遍 —— 那才是真会退化的做法。
   */
  return (
    <Ctx.Provider value={value}>
      {compact ? <Sheet {...shared}>{children}</Sheet> : <Popover {...shared}>{children}</Popover>}
    </Ctx.Provider>
  );
}

export interface ResponsiveOverlayTriggerProps extends React.ComponentProps<'button'> {}

/**
 * 两条路径的 Trigger 都是 Radix 的原生 button（各自带好 aria-expanded /
 * aria-controls / aria-haspopup），props 形状一致，直接按模式转发。
 */
function ResponsiveOverlayTrigger(props: ResponsiveOverlayTriggerProps) {
  const { compact } = useOverlayCtx('ResponsiveOverlayTrigger');
  const Comp = compact ? SheetTrigger : PopoverTrigger;
  return <Comp data-slot="responsive-overlay-trigger" {...props} />;
}

export interface ResponsiveOverlayAnchorProps extends React.ComponentProps<'div'> {}

/**
 * 锚点。只有桌面路径用得上（Drawer 从屏幕底部出来，不锚任何东西）——
 * 移动路径下渲染成一个普通 div，**保留 DOM 结构**，免得调用方的布局在
 * 两条路径下不一样。
 */
function ResponsiveOverlayAnchor({ children, ...props }: ResponsiveOverlayAnchorProps) {
  const { compact } = useOverlayCtx('ResponsiveOverlayAnchor');
  if (compact) {
    return (
      <div data-slot="responsive-overlay-anchor" {...props}>
        {children}
      </div>
    );
  }
  return (
    <PopoverAnchor data-slot="responsive-overlay-anchor" {...props}>
      {children}
    </PopoverAnchor>
  );
}

export interface ResponsiveOverlayContentProps {
  /**
   * 无障碍名称。**必填** —— 两条路径的可访问名称必须一致，见文件头。
   * 移动路径下它会**显示出来**（iOS 的 action sheet 也有标题）；
   * 桌面路径下落到 `aria-label`。
   */
  title: string;
  /** 可选的说明文字。只在移动路径下显示（桌面浮层没地方放）。 */
  description?: string;
  className?: string;
  children?: React.ReactNode;
  /** 只影响桌面路径的参数（side / align / sideOffset / width …） */
  popover?: Omit<GlassPopoverContentProps, 'children' | 'className'>;
  /** 只影响移动路径的参数（detents / grabber / dragFrom …） */
  sheet?: Omit<GlassSheetContentProps, 'children' | 'className'>;
}

function ResponsiveOverlayContent({
  title,
  description,
  className,
  children,
  popover,
  sheet,
}: ResponsiveOverlayContentProps) {
  const { compact } = useOverlayCtx('ResponsiveOverlayContent');

  if (compact) {
    return (
      <SheetContent data-responsive-overlay="content" className={className} {...sheet}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
      </SheetContent>
    );
  }

  return (
    <PopoverContent
      // 不要写 data-slot —— PopoverContent / SheetContent 都在展开 props **之前**
      // 设了自己的 data-slot，这里再给一个会把它顶掉，样式与测试赖以定位的
      // 结构钩子就断了（Dialog 上踩过一次，见 STATUS §0.45）。
      data-responsive-overlay="content"
      // 桌面浮层没有可见标题，名称只能走 aria-label —— 不给的话
      // 屏幕阅读器在两条路径下读到的东西不一样，那就是 §9 说的「退化」。
      aria-label={title}
      className={className}
      {...popover}
    >
      {children}
    </PopoverContent>
  );
}

export {
  ResponsiveOverlay,
  ResponsiveOverlayTrigger,
  ResponsiveOverlayAnchor,
  ResponsiveOverlayContent,
};
