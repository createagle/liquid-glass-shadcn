'use client';

// APPLE REFERENCE: UIAlertController / SwiftUI `.alert(_:isPresented:)`
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:24495）。
// 参考图 screenshots/ios27-alert.png，完整测量见 apple-metrics.md §7.6。
//
//   面板宽            300 pt        [实测]
//   圆角              **34 pt**     [实测] —— 从参考图的边缘轮廓拟合：
//                                   34 个采样点，均方误差 0.35，见 STATUS §0.45
//   内边距            14 pt（四周） [实测]
//   正文块内再内缩     8 pt          [实测]
//   标题 → 正文间距    10 pt         [实测]
//   正文块 → 按钮区    24 pt         [实测]
//   按钮              132 × 48 pt   [实测]，间距 8（132+8+132 = 272 = 300−28）
//   标题 / 正文        均 17 pt，行高 22  [实测] —— 两者墨迹高度都是 13px，
//                                   视觉上正文更小只是字重与颜色造成的
//
// ⚠️ 可信度：标 [实测] 而非 [官方]，因为 (a) 文件是 iOS 27 而 SPEC 基准是 iOS 26；
//    (b) 文件标题带 "(Community)"，发布者未经验证。
//
// ✅ 顺带印证：拟合出的 34 与 primitive.css 里既有的 --lg-radius-xl / -continuous
//    （34px）撞上了 —— 那个值原本是 Phase 1 定的，这次是独立来源。
//
// ── 分层 ──────────────────────────────────────────────────────────────
// PROJECT_SPEC §2 的分层速查表：`| Dialog | 面板 | —— |`
// 也就是**只有 Layer B 面板，没有 Layer I**。所以这里不做折射、不挖洞。
//
// ── 与经典 iOS Alert 的一处显著差别 ────────────────────────────────────
// **文字左对齐，不是居中。** 老版 UIAlertController 的标题与正文是居中的；
// iOS 26+ 的参考图里明确是左对齐（见 ios27-alert.png）。按参考图走。
//
// ── 刻意不用 asChild ──────────────────────────────────────────────────
// shadcn 会在 base-* style 的工程里把 asChild 改写成 Base UI 的 render prop，
// 与 @radix-ui/react-* 不兼容（Switch 上踩过，见 STATUS §0.3）。
// 所以 motion 元素一律**嵌在** Radix 部件里面，而不是通过 asChild 顶替它。

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { Button, type GlassButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 面板宽。iOS 27 实测 300pt —— 这是 **Alert** 的宽度，不是通用弹窗的宽度。 */
  width: 300,
  /** 圆角。由参考图边缘轮廓拟合得 34。 */
  radius: 34,
  /** 面板内边距。 */
  padding: 14,
  /** 正文块相对面板内边距再内缩。 */
  textInset: 8,
  /** 标题 → 正文。 */
  titleGap: 10,
  /** 正文块 → 按钮区。 */
  sectionGap: 24,
  /** 按钮之间。 */
  buttonGap: 8,
  /** 标题与正文的行高。 */
  lineHeight: 22,
  /** 标题与正文的字号（两者相同，已用墨迹高度核实）。 */
  fontSize: 17,
} as const;

/**
 * 开关态要自己接管一份。
 *
 * 原因：退场动画需要 `AnimatePresence`，而 Radix 在关闭时会立刻卸载 Content，
 * 动画根本来不及播。标准解法是 `forceMount` + 由我们控制挂载，
 * 那就必须知道当前是开是关 —— Radix 不对外暴露这个状态。
 */
const DialogCtx = React.createContext<{ open: boolean; close: () => void } | null>(null);

function useDialogCtx(part: string) {
  const ctx = React.useContext(DialogCtx);
  if (!ctx) throw new Error(`<${part}> 必须放在 <Dialog> 里`);
  return ctx;
}

export interface GlassDialogProps extends React.ComponentProps<typeof DialogPrimitive.Root> {}

function Dialog({ open, defaultOpen, onOpenChange, children, ...props }: GlassDialogProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const current = controlled ? open : uncontrolled;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const value = React.useMemo(
    () => ({ open: current, close: () => handleOpenChange(false) }),
    [current, handleOpenChange],
  );

  return (
    <DialogCtx.Provider value={value}>
      <DialogPrimitive.Root open={current} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogCtx.Provider>
  );
}

/**
 * 触发器保持 Radix 原样（一个带好了 aria 接线的原生 button）。
 *
 * ⚠️ 它**不是**本库的 Button。因为 asChild 在本库是禁用的，没法把任意元素
 * 提升成触发器；要自定义外观就给它 className，或者干脆自己控制 `open`。
 */
const DialogTrigger = DialogPrimitive.Trigger;

export interface GlassDialogCloseProps extends GlassButtonProps {}

/**
 * 关闭按钮 —— **直接渲染本库的 Button**，而不是 `<DialogClose asChild><Button/></DialogClose>`。
 *
 * 后者是 shadcn 生态的惯用写法，但 asChild 在本库禁用（shadcn 会在 base-* style
 * 的工程里把它改写成 Base UI 的 render prop，与 @radix-ui/react-* 不兼容）。
 * 于是把这层封进来：外观、尺寸、变体全部是 Button 的那一套，点击即关闭。
 *
 * ```tsx
 * <DialogFooter>
 *   <DialogClose variant="glass">Cancel</DialogClose>
 *   <DialogClose variant="prominent" onClick={submit}>Default</DialogClose>
 * </DialogFooter>
 * ```
 * `onClick` 会先跑；调用 `event.preventDefault()` 可以阻止关闭。
 */
function DialogClose({ onClick, ...props }: GlassDialogCloseProps) {
  const { close } = useDialogCtx('DialogClose');
  return (
    <Button
      // 不要写 data-slot —— Button 在展开 props **之前**设了 data-slot="button"，
      // 这里再给一个会把它顶掉，样式与测试赖以定位的结构钩子就断了。
      data-dialog-close=""
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) close();
      }}
      {...props}
    />
  );
}

export interface GlassDialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** 面板宽度（px）。默认 300 = iOS Alert 实测宽度。 */
  width?: number;
}

function DialogContent({
  className,
  children,
  width = GEOMETRY.width,
  ...props
}: GlassDialogContentProps) {
  const { open } = useDialogCtx('DialogContent');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay forceMount data-slot="dialog-overlay" className="fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0"
              style={{ background: 'var(--lg-scrim)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitionFor('smooth', reducedMotion)}
            />
          </DialogPrimitive.Overlay>

          <DialogPrimitive.Content
            forceMount
            data-slot="dialog-content"
            className={cn(
              'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none',
              className,
            )}
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={transitionFor('bouncy', reducedMotion)}
            >
              {/*
                Layer B 面板。PROJECT_SPEC §2 给 Dialog 的分层是「面板」而已 ——
                没有 Layer I，所以不折射、不挖洞。
                continuous 让支持 corner-shape 的浏览器用连续曲率；
                参考图导出的是标准圆弧（拟合残差 0.35），但 iOS 实际渲染是 squircle。
              */}
              <GlassSurface
                layer="elevated"
                radius={GEOMETRY.radius}
                continuous
                style={{ width, padding: GEOMETRY.padding }}
              >
                {children}
              </GlassSurface>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
}

export interface GlassDialogHeaderProps extends React.ComponentProps<'div'> {}

/** 标题 + 正文块。相对面板内边距再内缩 8，底部留 24 到按钮区。 */
function DialogHeader({ className, style, ...props }: GlassDialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col', className)}
      style={{
        padding: GEOMETRY.textInset,
        paddingBottom: GEOMETRY.sectionGap,
        gap: GEOMETRY.titleGap,
        ...style,
      }}
      {...props}
    />
  );
}

export interface GlassDialogTitleProps
  extends React.ComponentProps<typeof DialogPrimitive.Title> {}

function DialogTitle({ className, style, ...props }: GlassDialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // 左对齐 —— iOS 26+ 的参考图是左对齐，不是经典 Alert 的居中
      className={cn('text-left', className)}
      style={{
        fontSize: GEOMETRY.fontSize,
        lineHeight: `${GEOMETRY.lineHeight}px`,
        fontWeight: 600, // headline 17 semibold
        color: 'var(--lg-label-primary)',
        ...style,
      }}
      {...props}
    />
  );
}

export interface GlassDialogDescriptionProps
  extends React.ComponentProps<typeof DialogPrimitive.Description> {}

function DialogDescription({ className, style, ...props }: GlassDialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-left', className)}
      style={{
        fontSize: GEOMETRY.fontSize,
        lineHeight: `${GEOMETRY.lineHeight}px`,
        color: 'var(--lg-label-secondary)',
        ...style,
      }}
      {...props}
    />
  );
}

export interface GlassDialogFooterProps extends React.ComponentProps<'div'> {}

/**
 * 按钮区。参考图里是两个等宽按钮 132 + 间距 8 + 132 = 272（= 300 − 2×14）。
 *
 * 用 **grid 等分**而不是 `flex` + `[&>*]:flex-1`：Button 自己带 `shrink-0`，
 * 两个工具类都在 utilities 层，谁赢取决于生成顺序，按钮宽度会不稳定
 * （实测量出来不是 132）。grid 的轨道尺寸不受 flex-shrink 影响。
 */
function DialogFooter({ className, style, ...props }: GlassDialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('grid grid-flow-col auto-cols-fr', className)}
      style={{ gap: GEOMETRY.buttonGap, ...style }}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
