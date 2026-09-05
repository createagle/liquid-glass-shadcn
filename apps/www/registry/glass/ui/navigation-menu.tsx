'use client';

// APPLE REFERENCE: **没有。**
//
// 两份官方设计资源（iOS/iPadOS 27 与 macOS 27，各 39 页）都查过了，
// 逐页比对的记录在 docs/research/apple-metrics.md §13.5：
//
//   - iOS 的 `Menus`（`507:24676`）是**弹出菜单**，不是横向导航条。
//   - macOS 的 `Menu Bar and Dock`（`207:14475`）是**系统菜单栏**，
//     对应的是本库的 `<Menubar>`，不是这个带大内容面板的东西。
//
// shadcn 的 `NavigationMenu` 是个 **Web 惯例**（横排触发器 + 悬停展开的大面板），
// Apple 平台上不存在这个控件。清单第 36 行原本写着「UINavigationBar / 菜单栏」——
// 那是把两个不相干的东西对上了，本批一并更正（见 component-inventory 修订八）。
//
// ── 所以：这个文件里**每一个数字都是 `[推定]`** ────────────────────────
//
// 与 Breadcrumb 那次（P2 第二批）同一套做法 —— 不编新数，全部借自
// **有实测的邻居**，并逐条写明借自哪里：
//
//   触发器几何   借 `MENUBAR_GEOMETRY`  ← §13.3 iPadOS 菜单栏项，实测
//   面板几何     借 `MENU_GEOMETRY`     ← §7.7 / §12.2 菜单面板，实测
//   展开态填充   借 `--lg-fill-tertiary` ← §13.3 实测正好命中这个 token
//
// 「借来的实测值」仍然是 `[推定]`：值本身可靠，但**用在这个组件上**没有依据。
// 这条区分是 PROJECT_SPEC §15.7 的要求，不要因为数字来源可靠就升格。
//
// ── 没做的两件，如实记着 ──────────────────────────────────────────────
//
//   - **`NavigationMenu.Indicator`**（面板上方那个小箭头）。Radix 提供了，
//     本库没接 —— Popover 的箭头刚在上一批量到（56×13，材质 Thick），
//     那是**有实测**的形状；这里随手放一个尺寸不同的箭头只会自相矛盾。
//   - **移动端的 Drawer 路径**。SPEC §9 点名了 NavigationMenu，
//     但 Radix 的 `Viewport` 定位与 `<Sheet>` 的档位面板没法共存
//     （与 DropdownMenu 那次同一个冲突）。这里**没有**做移动降级 ——
//     它是本批唯一一个欠着 §9 的组件，记在 STATUS 里。

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { GlassSurface } from '@createagle/glass-core';
import { MENU_GEOMETRY } from '@/components/ui/dropdown-menu';
import { MENUBAR_GEOMETRY } from '@/components/ui/menubar';
import { cn } from '@/lib/utils';

export const NAVIGATION_MENU_GEOMETRY = {
  /** 触发器高（px）。`[推定]` —— 借 §13.3 iPadOS 菜单栏项的实测 32 */
  triggerHeight: MENUBAR_GEOMETRY.height,
  /** 触发器左右内边距（px）。`[推定]` —— 借 §13.3 的实测 10.5 */
  triggerPaddingInline: MENUBAR_GEOMETRY.itemPaddingInline,
  /** 触发器字号（px）。`[推定]` —— 借 §13.3 的实测 14 */
  fontSize: MENUBAR_GEOMETRY.fontSize,
  /** 触发器行高（px）。`[推定]` —— 借 §13.3 的实测 16 */
  lineHeight: MENUBAR_GEOMETRY.lineHeight,
  /** 各项之间的间距（px）。`[推定]` —— 资源里菜单栏项是紧挨着的（gap 0），
   *  但那是因为它们各自带 10.5 的内边距；这里给 2 只是为了胶囊之间不粘连。 */
  gap: 2,
  /** 面板圆角（px）。`[推定]` —— 借 §7.7 菜单面板的实测 34 */
  panelRadius: MENU_GEOMETRY.radius,
  /** 面板内边距（px）。`[推定]` —— 借 §7.7 的实测 16 */
  panelPadding: MENU_GEOMETRY.paddingInline,
  /** 面板与触发器的间距（px）。`[推定]` —— 借 §7.7 的 8（那一条本身也是推定） */
  sideOffset: MENU_GEOMETRY.sideOffset,
} as const;

/**
 * 当前展开的是哪个菜单。
 *
 * ⚠️ **为什么要自己存一份**：视口的玻璃底是 Viewport 的**兄弟节点**
 * （理由见 `NavigationMenuViewport`），Radix 关闭时只卸载 Viewport 自己，
 * 那块玻璃不归它管 —— 不自己盯着 open，菜单关掉后页面上会留下一道
 * 高 0 但仍在投影的玻璃边。
 *
 * Radix 的 Root 没把 value 通过公开 context 暴露出来，所以在 Root 上
 * 接一下 `onValueChange` 自己存。与 ContextMenu 那次的 `OpenCtx` 同一手法。
 */
const OpenCtx = React.createContext(false);

function NavigationMenu({
  className,
  children,
  value,
  onValueChange,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  const [selfValue, setSelfValue] = React.useState('');
  const current = value ?? selfValue;

  return (
    <OpenCtx.Provider value={current !== ''}>
      <NavigationMenuPrimitive.Root
        className={cn('relative flex max-w-max flex-1 items-center justify-center', className)}
        {...(value === undefined ? {} : { value })}
        onValueChange={(next) => {
          if (value === undefined) setSelfValue(next);
          onValueChange?.(next);
        }}
        {...props}
        data-slot="navigation-menu"
      >
        {children}
        <NavigationMenuViewport />
      </NavigationMenuPrimitive.Root>
    </OpenCtx.Provider>
  );
}

function NavigationMenuList({
  className,
  style,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      className={cn('flex flex-1 list-none items-center justify-center', className)}
      style={{ gap: NAVIGATION_MENU_GEOMETRY.gap, ...style }}
      {...props}
      data-slot="navigation-menu-list"
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      className={cn('relative', className)}
      {...props}
      data-slot="navigation-menu-item"
    />
  );
}

/** 触发器与链接共用的一套外观 —— 胶囊、14px、展开/悬停时一层填充。 */
const ITEM_CLASS = cn(
  'inline-flex shrink-0 cursor-default items-center justify-center outline-none select-none',
  'text-[var(--lg-label-primary)] no-underline transition-colors duration-100',
  'hover:bg-[var(--lg-fill-quaternary)]',
  'data-[state=open]:bg-[var(--lg-fill-tertiary)]',
  'data-[active]:bg-[var(--lg-fill-tertiary)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lg-ring)]',
  'disabled:pointer-events-none disabled:opacity-40',
);

function itemStyle(): React.CSSProperties {
  return {
    height: NAVIGATION_MENU_GEOMETRY.triggerHeight,
    borderRadius: NAVIGATION_MENU_GEOMETRY.triggerHeight / 2,
    paddingInline: NAVIGATION_MENU_GEOMETRY.triggerPaddingInline,
    fontSize: NAVIGATION_MENU_GEOMETRY.fontSize,
    lineHeight: `${NAVIGATION_MENU_GEOMETRY.lineHeight}px`,
    fontWeight: 500,
  };
}

function NavigationMenuTrigger({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn('group', ITEM_CLASS, className)}
      style={{ gap: 4, ...itemStyle(), ...style }}
      {...props}
      data-slot="navigation-menu-trigger"
    >
      {children}
      <Chevron />
    </NavigationMenuPrimitive.Trigger>
  );
}

/**
 * 自己画的 chevron。
 *
 * ⚠️ 与 Collapsible 那次同一个理由：资源里的箭头是 **SF Symbols 的 PUA 码位**
 * （`􀆈` 之类），Web 上没有那套字体，直接渲染是豆腐块。
 * 形状 `[推定]`，尺寸取 10 —— 比 14px 的标签略小一圈。
 */
function Chevron() {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      className={cn(
        'shrink-0 text-[var(--lg-label-tertiary)]',
        'transition-transform duration-200',
        'group-data-[state=open]:rotate-180',
      )}
      data-slot="navigation-menu-chevron"
    >
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn('w-full', className)}
      style={{ padding: NAVIGATION_MENU_GEOMETRY.panelPadding }}
      {...props}
      data-slot="navigation-menu-content"
    />
  );
}

/**
 * 视口 —— Radix 把所有 `Content` 渲染进这一个盒子里，并按内容自动改尺寸。
 *
 * 玻璃贴在**整个视口**上，而不是每个 Content 各贴一块：
 * 一个视口 = 一块玻璃，切换菜单时是同一块玻璃在变形，
 * 而不是两块玻璃交叉淡入淡出。面板是 Layer B，折射实例数为 0。
 *
 * ── ⚠️ 玻璃必须是 Viewport 的**兄弟**，不能是它的孩子 ──────────────────
 *
 *   第一版把 `<GlassSurface>` 写在了 `<Viewport>` 里面。**它被静默丢掉了。**
 *   Radix 的 `NavigationMenuViewportImpl` 第一行就是
 *   `const { __scopeNavigationMenu, children, ...rest } = props` ——
 *   把 `children` **解构掉扔了**，只渲染注册进来的那些 Content。
 *   传进去的东西一声不响地消失，控制台一个字都没有。
 *
 *   这和本仓库踩过五次的 `data-slot` 覆盖是同一家族：
 *   **上游把调用方传的东西吃掉了。** 那边是被覆盖（值不对，还看得见），
 *   这边是被吞掉（元素压根不出现）。所以有一条测试专门钉住玻璃真的在。
 */
function NavigationMenuViewport({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  const open = React.useContext(OpenCtx);
  return (
    <div
      className="absolute top-full left-0 isolate z-50 flex justify-center"
      style={{ paddingTop: NAVIGATION_MENU_GEOMETRY.sideOffset }}
    >
      <div className="relative">
        {/*
          外框由 Viewport 在正常流里撑开，玻璃 `absolute inset-0` 铺满它。
          关闭时 Radix 会卸载 Viewport，外框高度归零 —— 玻璃也就跟着看不见了，
          但**投影仍在**，所以还要 `open` 这一道闸。
        */}
        {open ? (
          <GlassSurface
            layer="elevated"
            radius={NAVIGATION_MENU_GEOMETRY.panelRadius}
            continuous
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            data-slot="navigation-menu-panel"
          />
        ) : null}
        <NavigationMenuPrimitive.Viewport
          className={cn(
            'relative h-[var(--radix-navigation-menu-viewport-height)] origin-top overflow-hidden',
            className,
          )}
          {...props}
          data-slot="navigation-menu-viewport"
        />
      </div>
    </div>
  );
}

/**
 * 面板里的链接。
 *
 * ⚠️ 本库禁用 `asChild`，所以这里渲染的是一个真实的 `<a>` ——
 * 要接 Next.js 的 `<Link>` 请把它包在外面，或直接用 `href`。
 * （与 Breadcrumb 的 `BreadcrumbLink` 同一条约定。）
 */
function NavigationMenuLink({
  className,
  style,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      className={cn(ITEM_CLASS, 'w-full justify-start', className)}
      style={{ ...itemStyle(), ...style }}
      {...props}
      data-slot="navigation-menu-link"
    />
  );
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuViewport,
};
