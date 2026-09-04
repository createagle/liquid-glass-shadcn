'use client';

// APPLE REFERENCE: UIContextMenuInteraction（iOS 27「Contextual Menus」页）
//
// 节点 125:58750（Context Menu，4 个变体）与 128:76929（Dimming Overlay）。
// 记录见 docs/research/apple-metrics.md §12.2。
//
// ✅✅ **这个组件几乎不需要新几何 —— 它与 DropdownMenu 是同一块面板。**
//
//   这不是偷懒，是量出来的：Context Menu 的菜单项是 **218 × 40**，
//   与 §7.6 从 Edit Menu（另一个互不相关的节点 12740:24194）量到的**逐位相同**；
//   面板宽同为 250，圆角同为 34，分隔区同为 21。
//   所以本组件**直接 import `MENU_GEOMETRY`**，而不是抄一份数字过来 ——
//   将来那边修正了，这边跟着走。
//
// ── 唯一属于 Context Menu 自己的东西：背景压暗层 ──────────────────────
//
//   iOS 的上下文菜单打开时会把**背后整屏**压暗。
//   实测（节点 128:76929）：`#000000 @ 0.23`，**没有模糊**。
//
//   ⚠️ 「没有模糊」这一条是量出来的，不是漏看：那个节点的 effects 是空的。
//   直觉上 iOS 好像会虚化背景，但资源里就是一层纯色压暗。照做。
//
// ── 本批**没有实现**的一半，如实记着 ──────────────────────────────────
//
//   资源里的面板顶部还有一排 **Quick Actions / Control Group**
//   （整排高 56、单项 72.67 宽 / 圆角 20、标签 SF Pro Medium 12、
//   破坏性动作 #ff383c —— 全部已实测并记在 §12.2）。
//   那是 iOS 上下文菜单最有辨识度的一半，**本批没做**。
//   「没做」与「没有依据」是两回事，值已经记下了，随时可以补。
//
// ⚠️ 分层：**B + I** —— 面板是 Layer B，高亮项是 Layer I，与 DropdownMenu 同。

import * as React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { GlassSurface } from '@glass/core';
import { MENU_GEOMETRY } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 背景压暗层的不透明度。[实测] iOS 27 节点 128:76929 = #000000 @ 0.23 */
  scrimOpacity: 0.23,
} as const;

/**
 * 开合状态。
 *
 * ⚠️ **为什么要自己存一份**：压暗层必须与菜单同生共死，而它又不能和
 * `Content` 塞进同一个 `Portal`（理由见 `ContextMenuContent`）。
 * 单独一个 Portal 里放个裸 `div` 的话，Radix 不会替它做 presence ——
 * 菜单没开的时候那层压暗也会一直挂在页面上。
 *
 * Radix 的 ContextMenu 没有把 open 通过公开 context 暴露出来，
 * 所以在 Root 上接一下 `onOpenChange` 自己存。
 */
const OpenCtx = React.createContext(false);

function ContextMenu({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  const [open, setOpen] = React.useState(false);
  return (
    <OpenCtx.Provider value={open}>
      <ContextMenuPrimitive.Root
        {...props}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      />
    </OpenCtx.Provider>
  );
}

/**
 * 触发区。右键（桌面）或长按（触屏）打开。
 *
 * ⚠️ 本库禁用 `asChild`，所以这里渲染的是一个真实的 `<div>` ——
 * 把要被右键的内容放进去即可，不要指望它「变成」你的元素。
 */
function ContextMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger
      className={cn('outline-none', className)}
      {...props}
      data-slot="context-menu-trigger"
    />
  );
}

export interface GlassContextMenuContentProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Content> {
  /** 面板宽（px）。默认 250（实测）。 */
  width?: number;
  /**
   * 打开时压暗背景。默认 `true` —— iOS 就是这么做的。
   *
   * 关掉的唯一正当理由是「这个菜单开在一个已经有遮罩的浮层里」，
   * 两层压暗会叠成一片黑。
   */
  scrim?: boolean;
}

function ContextMenuContent({
  className,
  width = MENU_GEOMETRY.width,
  scrim = true,
  children,
  ...props
}: GlassContextMenuContentProps) {
  const open = React.useContext(OpenCtx);

  return (
    <>
      {/*
       * ⚠️⚠️ **压暗层必须自己占一个 `Portal`，不能和 Content 挤在同一个里。**
       *
       * Radix 的 `Portal` 内部是 `<Primitive.div asChild>` ——
       * 只接受**单个元素子节点**。塞两个进去会在打开的瞬间抛
       * 「Primitive.div failed to slot onto its children」，
       * 菜单整个渲染不出来（第一版就是这么写的，右键毫无反应）。
       *
       * 代价是这一层的 presence 要自己管：Radix 只替 `Content` 做挂载/卸载，
       * 裸 div 它不管 —— 所以上面用 `OpenCtx` 自己存了一份 open。
       *
       * 另外它**不能吃指针事件**：Radix 靠 Content 外面的 dismissable layer
       * 处理「点外面关掉」，压暗层拦下指针那套逻辑就失灵了。
       */}
      {scrim && open ? (
        <ContextMenuPrimitive.Portal>
          <div
            data-slot="context-menu-scrim"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40"
            style={{ backgroundColor: `rgb(0 0 0 / ${GEOMETRY.scrimOpacity})` }}
          />
        </ContextMenuPrimitive.Portal>
      ) : null}

      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className={cn('z-50 outline-none', className)}
          {...props}
          data-slot="context-menu-content"
        >
          <GlassSurface
            layer="elevated"
            radius={MENU_GEOMETRY.radius}
            continuous
            className="overflow-hidden"
            style={{
              width,
              paddingBlock: MENU_GEOMETRY.paddingBlock,
              paddingInline: MENU_GEOMETRY.paddingInline,
            }}
          >
            {children}
          </GlassSurface>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </>
  );
}

export interface GlassContextMenuItemProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Item> {
  /** 破坏性动作 —— 换成红色标签。[实测] iOS 用 #ff383c，本库走 destructive token */
  destructive?: boolean;
}

function ContextMenuItem({
  className,
  destructive = false,
  style,
  ...props
}: GlassContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'flex w-full cursor-default items-center outline-none select-none',
        'transition-colors duration-100',
        // 高亮态（键盘或指针）—— 与 DropdownMenu 同一档材质
        'data-[highlighted]:bg-[var(--lg-fill-tertiary)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        destructive
          ? 'text-[var(--lg-destructive-fill)]'
          : 'text-[var(--lg-label-primary)]',
        className,
      )}
      style={{
        minHeight: MENU_GEOMETRY.itemHeight,
        fontSize: MENU_GEOMETRY.fontSize,
        borderRadius: MENU_GEOMETRY.itemRadius,
        paddingInline: MENU_GEOMETRY.separatorInset,
        ...style,
      }}
      {...props}
      data-slot="context-menu-item"
      data-destructive={destructive ? 'true' : undefined}
    />
  );
}

/**
 * 分隔线。
 *
 * [实测] 分隔**区**高 21，线在区内偏移 2，线两侧相对菜单项再各内缩 8 ——
 * 这三个数与 DropdownMenu 共用同一份常量。
 */
function ContextMenuSeparator({ className }: { className?: string }) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('relative', className)}
      style={{ height: MENU_GEOMETRY.separatorZone }}
    >
      <span
        aria-hidden="true"
        className="absolute block bg-[var(--lg-separator)]"
        style={{
          top: MENU_GEOMETRY.separatorOffset,
          left: MENU_GEOMETRY.separatorInset,
          right: MENU_GEOMETRY.separatorInset,
          height: 1,
        }}
      />
    </ContextMenuPrimitive.Separator>
  );
}

function ContextMenuLabel({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center text-[var(--lg-label-secondary)]', className)}
      style={{
        minHeight: MENU_GEOMETRY.itemHeight,
        paddingInline: MENU_GEOMETRY.separatorInset,
        fontSize: 13,
        ...style,
      }}
      {...props}
      data-slot="context-menu-label"
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  GEOMETRY as CONTEXT_MENU_GEOMETRY,
};
