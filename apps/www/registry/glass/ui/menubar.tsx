'use client';

// APPLE REFERENCE: iPadOS 27 的菜单栏（「Status Bars and Menu Bars」页）
//
// 节点 `5413:10006`（Status bar and Menu bar - iPad，8 个变体）与
// `5413:10045`（_Menu bar item，4 个变体）。测量见 docs/research/apple-metrics.md §13.3。
//
// ── ❗ 实测推翻了清单第 37 行 ──────────────────────────────────────────
//
//   清单原文：`| 37 | Menubar | iPadOS 新增的 menu bar | **B + I**（高亮项） |`
//
//   **条本身不是玻璃。** 四个变体的 `fills` / `effects` / `strokes`
//   **全是空的** —— 菜单栏直接压在壁纸或内容上，一点底都没有。
//   （变体属性里那个 `Background=Light/Dark` 说的是**背后**是亮是暗，
//    菜单栏据此换文字颜色，正说明它自己是透的。）
//
//   有材质的只有**展开中的那一项**：
//     胶囊填充 `#767680 @ 0.12`（blend LINEAR_DODGE）
//     + 投影 `rgba(0,0,0,0.08)`，模糊 16，下移 2      [实测]
//
//   所以本组件默认渲染一条**透明**的菜单栏。想要一条可见的玻璃条
//   请显式传 `surface` —— 那是本库的扩展，**不是 iPadOS 的做法**，
//   prop 名和这段注释都写明了这一点。
//
// ── 又一次撞上既有 token ──────────────────────────────────────────────
//
//   `#767680 @ 0.12` 与本库的 `--lg-fill-tertiary`（`#787880 / 0.12`）
//   只差 R/G 各 2。同一批测量里侧栏搜索框的 `#787880 @ 0.16` 则与
//   `--lg-fill-secondary` **逐位相同**。加上 §10 的 `#0088ff`，
//   这是第三处「Apple 的填充基色导出时有 ±2 漂移」的独立佐证。
//   **本组件因此没有新增任何颜色 token。**
//
// ── 弹出面板：直接复用 DropdownMenu 的实测几何 ────────────────────────
//
//   与 ContextMenu 同一个理由 —— 面板是同一块面板（250 宽、圆角 34、
//   项 218×40、分隔区 21）。`import { MENU_GEOMETRY }` 而不是抄一份数字，
//   将来那边修正了这边跟着走。
//
// ⚠️ 分层：条 = 无材质；展开项 = 填充（**不是 Layer I**，没有折射）；面板 = Layer B。

import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { GlassSurface } from '@glass/core';
import { MENU_GEOMETRY } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const MENUBAR_GEOMETRY = {
  /** 条高（px）。[实测] 32 —— 也是菜单项的高 */
  height: 32,
  /** 条左右内边距（px）。[实测] 16 */
  paddingInline: 16,
  /** 菜单区（各项所在的那一段）左右内边距（px）。[实测] 6 */
  itemsPaddingInline: 6,
  /** 菜单项左右内边距（px）。[实测] 10.5（应用名那一项是 10） */
  itemPaddingInline: 10.5,
  /** 应用名项的左右内边距（px）。[实测] 10 */
  appPaddingInline: 10,
  /** 字号（px）。[实测] 14 */
  fontSize: 14,
  /** 行高（px）。[实测] 16 */
  lineHeight: 16,
  /**
   * 展开项的投影。[实测] `rgba(0,0,0,0.08)`，模糊 16，下移 2。
   *
   * ⚠️ 这里**不走 `--lg-shadow`**：那个 token 是面板级的落影，
   * 值与这一处实测不同。硬要复用就得改 token，会影响所有面板。
   */
  openShadow: '0 2px 16px rgb(0 0 0 / 0.08)',
} as const;

/* ── 条 ───────────────────────────────────────────────────────────────── */

export interface GlassMenubarProps
  extends React.ComponentProps<typeof MenubarPrimitive.Root> {
  /**
   * 给菜单栏加一块玻璃底座。默认 `false`。
   *
   * ⚠️ **iPadOS 不这么做** —— 实测四个变体的菜单栏一点底都没有（见文件头）。
   * 这个 prop 是给「菜单栏需要压在杂乱内容上、必须自己撑出可读性」的场景用的，
   * 是本库的扩展，不是还原。
   */
  surface?: boolean;
}

function Menubar({ className, style, surface = false, children, ...props }: GlassMenubarProps) {
  const bar = (
    <MenubarPrimitive.Root
      className={cn('flex items-center', className)}
      style={{
        minHeight: MENUBAR_GEOMETRY.height,
        paddingInline: surface
          ? MENUBAR_GEOMETRY.itemsPaddingInline
          : MENUBAR_GEOMETRY.paddingInline,
        ...style,
      }}
      {...props}
      data-slot="menubar"
      data-surface={surface ? 'true' : undefined}
    >
      {children}
    </MenubarPrimitive.Root>
  );

  if (!surface) return bar;

  return (
    <GlassSurface
      layer="base"
      radius={MENUBAR_GEOMETRY.height / 2}
      continuous
      className="inline-flex"
      data-slot="menubar-surface"
    >
      {bar}
    </GlassSurface>
  );
}

/** 一个顶级菜单。`value` 由 Radix 用来做菜单之间的接力（移过去就换菜单）。 */
function MenubarMenu(props: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />;
}

export interface GlassMenubarTriggerProps
  extends React.ComponentProps<typeof MenubarPrimitive.Trigger> {
  /**
   * 应用名那一项 —— [实测] 字重 **Bold**、左右内边距 **10**；
   * 其余项是 Medium、10.5。
   */
  app?: boolean;
}

function MenubarTrigger({
  className,
  style,
  app = false,
  ...props
}: GlassMenubarTriggerProps) {
  return (
    <MenubarPrimitive.Trigger
      className={cn(
        'inline-flex shrink-0 cursor-default items-center justify-center outline-none select-none',
        'text-[var(--lg-label-primary)] transition-colors duration-100',
        // 展开态：一层填充 + 一点投影。**不是折射**，资源里没有任何位移痕迹。
        'data-[state=open]:bg-[var(--lg-fill-tertiary)]',
        /*
         * ⚠️ 必须是 `[box-shadow:…]` 这种**任意属性**，不能写 `shadow-[…]`。
         * Tailwind v4 的 `shadow-*` 是个复合工具类，会连带写 `--tw-shadow`
         * 等一串变量，把基于 var() 的整条阴影冲掉 —— Checkbox 的焦点环
         * 就是这么踩出来的（六条透明零阴影，类名和变量都对，就是不显示）。
         */
        'data-[state=open]:[box-shadow:var(--lg-menubar-open-shadow)]',
        'data-[highlighted]:bg-[var(--lg-fill-quaternary)]',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lg-ring)]',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      style={{
        height: MENUBAR_GEOMETRY.height,
        // 胶囊 —— [实测] r=100 于 32 高
        borderRadius: MENUBAR_GEOMETRY.height / 2,
        paddingInline: app
          ? MENUBAR_GEOMETRY.appPaddingInline
          : MENUBAR_GEOMETRY.itemPaddingInline,
        fontSize: MENUBAR_GEOMETRY.fontSize,
        lineHeight: `${MENUBAR_GEOMETRY.lineHeight}px`,
        fontWeight: app ? 700 : 500,
        ['--lg-menubar-open-shadow' as string]: MENUBAR_GEOMETRY.openShadow,
        ...style,
      }}
      {...props}
      data-slot="menubar-trigger"
      data-app={app ? 'true' : undefined}
    />
  );
}

/* ── 面板 ─────────────────────────────────────────────────────────────── */

export interface GlassMenubarContentProps
  extends React.ComponentProps<typeof MenubarPrimitive.Content> {
  /** 面板宽（px）。默认 250 —— DropdownMenu 的实测值。 */
  width?: number;
}

function MenubarContent({
  className,
  width = MENU_GEOMETRY.width,
  children,
  ...props
}: GlassMenubarContentProps) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        align="start"
        sideOffset={MENU_GEOMETRY.sideOffset}
        className={cn('z-50 outline-none', className)}
        {...props}
        data-slot="menubar-content"
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
      </MenubarPrimitive.Content>
    </MenubarPrimitive.Portal>
  );
}

export interface GlassMenubarItemProps
  extends React.ComponentProps<typeof MenubarPrimitive.Item> {
  /** 破坏性动作 —— 换成红色标签。 */
  destructive?: boolean;
  /** 右侧快捷键提示。 */
  shortcut?: string;
}

function MenubarItem({
  className,
  style,
  destructive = false,
  shortcut,
  children,
  ...props
}: GlassMenubarItemProps) {
  return (
    <MenubarPrimitive.Item
      className={cn(
        'flex w-full cursor-default items-center outline-none select-none',
        'transition-colors duration-100',
        'data-[highlighted]:bg-[var(--lg-fill-tertiary)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        destructive ? 'text-[var(--lg-destructive-fill)]' : 'text-[var(--lg-label-primary)]',
        className,
      )}
      style={{
        minHeight: MENU_GEOMETRY.itemHeight,
        fontSize: MENU_GEOMETRY.fontSize,
        borderRadius: MENU_GEOMETRY.itemRadius,
        paddingInline: MENU_GEOMETRY.separatorInset,
        gap: MENU_GEOMETRY.separatorInset,
        ...style,
      }}
      {...props}
      data-slot="menubar-item"
      data-destructive={destructive ? 'true' : undefined}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-[var(--lg-label-tertiary)]"
          data-slot="menubar-shortcut"
        >
          {shortcut}
        </span>
      ) : null}
    </MenubarPrimitive.Item>
  );
}

/** 分隔线 —— 三个数与 DropdownMenu / ContextMenu 共用同一份常量。[实测] */
function MenubarSeparator({ className }: { className?: string }) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
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
    </MenubarPrimitive.Separator>
  );
}

function MenubarLabel({
  className,
  style,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Label>) {
  return (
    <MenubarPrimitive.Label
      className={cn('flex items-center text-[var(--lg-label-secondary)]', className)}
      style={{
        minHeight: MENU_GEOMETRY.itemHeight,
        paddingInline: MENU_GEOMETRY.separatorInset,
        fontSize: 13,
        ...style,
      }}
      {...props}
      data-slot="menubar-label"
    />
  );
}

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
};
