'use client';

// APPLE REFERENCE: iOS 27「Sidebars」页 / SwiftUI `NavigationSplitView` 的 sidebar 列
//
// 节点 `10464:33764`（Sidebar 组合件）、`131:70029`（Sidebar Row，12 变体）、
// `10472:45236`（BG，2 变体）、`131:66427`（Section Header）、
// `5840:25291`（_Selection BG）。完整测量见 docs/research/apple-metrics.md §13.1–13.2。
//
// ── 这是全库第一次实现 HIG 里那条**单独点名侧栏**的规则 ────────────────
//
//   > Liquid Glass … is more opaque in larger elements like sidebars.
//
//   清单第 43 行从一开始就抄着这句话，但库里一处都没实现过 —— 因为
//   HIG **只给了一句话，没给数字**。这次量到了：
//
//     侧栏背景覆盖层    **0.92**（窗口失焦那一档 0.97）   [实测]
//     控件层 Page Control  ≈ **0.10**（§12.1，Ultrathin）  [实测]
//
//   差九倍。落成 `@createagle/glass-core` 的 `<GlassSurface scale="large">`，
//   加成量 `--lg-large-boost: 0.3` —— 默认档 0.62 + 0.3 = 0.92，正好命中实测值，
//   且材质档位滑杆继续有效。
//
//   ❗ **只加了不透明度，没有加模糊。** 同一次测量里侧栏的背景模糊是 r=80，
//     反而**小于** Page Control 的 r=100。「面积越大糊得越狠」是想当然，
//     被资源否掉了。顺手把 blur 也调大就是拿推定值冒充实测。
//
// ── 选中态**不是** Layer I，这是有意的 ────────────────────────────────
//
//   资源里的选中态（`5840:25291`）是一层减色填充（亮 `LINEAR_BURN`、
//   暗 `LINEAR_DODGE`），**没有任何位移或色散痕迹**。所以它按内容层做。
//
//   这同时是性能上的必然：侧栏可以有几十行，每个选中行都上折射会瞬间
//   撞穿 PROJECT_SPEC §5.2 的 **8 个折射实例**红线。
//   整个侧栏只有**一块**玻璃 —— 容器本身。
//
// ── 紧凑视口：**不走 §9 的底部 Drawer**，这里要说明理由 ────────────────
//
//   SPEC §9 要求「从触发点弹出浮层」的组件在移动端改为底部 Drawer。
//   侧栏**不属于那一类** —— 它不是从某个触发点弹出的浮层，是一块导航区域。
//   iOS 自己在紧凑宽度下的行为是 `UISplitViewController` 的 `.overlay`
//   显示模式：**从前缘滑出的覆盖层**，不是底部 sheet。
//
//   所以这里做前缘滑出。⚠️ 它**没有**复用本库的 `<Sheet>`：Sheet 是
//   带档位的底部面板，`side` 这个概念它没有。改走 `@radix-ui/react-dialog`
//   直接实现 —— 焦点陷阱、Escape、滚动锁、`aria-modal` 全部由 Radix 提供，
//   自己写焦点陷阱是本库不打算冒的险。
//
// ── 与 shadcn 的 API 差异，如实写在这里 ────────────────────────────────
//
//   shadcn 的 sidebar 是 `SidebarMenu > SidebarMenuItem > SidebarMenuButton`
//   三层嵌套，外加 rail / inset / cookie 持久化 / 快捷键。
//   本库合成一层 `<SidebarItem>`，并且**没有做**：
//     - rail（拖拽改宽）        - inset 变体
//     - cookie 持久化           - 全局快捷键
//   没做的原因是它们都不来自 Apple 资源，是 shadcn 自己的产品决定。
//   需要的话调用方自己接 `open` / `onOpenChange` 即可。

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional, useIsCompact } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

export const SIDEBAR_GEOMETRY = {
  /** 侧栏总宽（px）。[实测] 320 —— 内容区 300 + 左右各 10 内边距 */
  width: 320,
  /** 容器内边距（px）。[实测] 10（四边） */
  padding: 10,
  /** 行高（px）。[实测] 44 —— 也正好是 HIG 的最小触控目标 */
  itemHeight: 44,
  /** 行的右内边距（px）。[实测] 8 */
  itemPaddingRight: 8,
  /** 行在 level 0 时的左内边距（px）。[实测] 10 */
  itemPaddingLeft: 10,
  /** 每加一级缩进（px）。[实测] Level 0→10、1→30、2→50，等差 20 */
  indentStep: 20,
  /** 行内图标与文字的间距（px）。[实测] 8 */
  itemGap: 8,
  /** 行字号（px）。[实测] 17 */
  fontSize: 17,
  /** 行行高（px）。[实测] 22 */
  lineHeight: 22,
  /** 行字距（px）。[实测] −0.43 */
  letterSpacing: -0.43,
  /** 区块标题整块高（px）。[实测] 54 */
  groupLabelHeight: 54,
  /** 区块标题上内边距（px）。[实测] 21 */
  groupLabelPaddingTop: 21,
  /** 区块标题下内边距（px）。[实测] 11 */
  groupLabelPaddingBottom: 11,
  /** 区块标题左右内边距（px）。[实测] 12 */
  groupLabelPaddingInline: 12,
  /** 禁用态整行不透明度。[实测] 0.5 */
  disabledOpacity: 0.5,
  /** 容器圆角（px）。`[推定]` —— 资源里的侧栏是贴边的，没有圆角可量。
   *  取 `--lg-radius-lg` 那一档的 22，与本库其它大面板一致。 */
  radius: 22,
} as const;

/** 行的水平内边距 —— 缩进只影响左边。[实测] */
export function sidebarIndent(level: number): number {
  return SIDEBAR_GEOMETRY.itemPaddingLeft + Math.max(0, level) * SIDEBAR_GEOMETRY.indentStep;
}

/* ── context ──────────────────────────────────────────────────────────── */

interface SidebarCtxValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  /** true = 紧凑视口，侧栏走前缘覆盖层 */
  compact: boolean;
  /** 供 Trigger 接 aria-controls */
  id: string;
}

const SidebarCtx = React.createContext<SidebarCtxValue | null>(null);

function useSidebar(): SidebarCtxValue {
  const ctx = React.useContext(SidebarCtx);
  if (!ctx) throw new Error('<Sidebar> 及其子件必须放在 <SidebarProvider> 里');
  return ctx;
}

export interface GlassSidebarProviderProps extends React.ComponentProps<'div'> {
  /** 受控开合。不传则组件自己管。 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function SidebarProvider({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  className,
  children,
  ...props
}: GlassSidebarProviderProps) {
  const compact = useIsCompact();
  const reactId = React.useId();
  const [selfOpen, setSelfOpen] = React.useState(defaultOpen);
  const open = openProp ?? selfOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setSelfOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  /*
   * ⚠️ 紧凑视口下**默认是关的**，不管 defaultOpen 是什么。
   * 前缘覆盖层会盖住整片内容，开着进页面等于挡住了正文。
   * 这一条只在「进入紧凑」的那一刻生效，之后用户仍可自由开合。
   */
  const wasCompact = React.useRef(compact);
  React.useEffect(() => {
    if (compact && !wasCompact.current) setOpen(false);
    wasCompact.current = compact;
  }, [compact, setOpen]);

  const value = React.useMemo<SidebarCtxValue>(
    () => ({ open, setOpen, compact, id: `sidebar-${reactId}` }),
    [open, setOpen, compact, reactId],
  );

  return (
    <SidebarCtx.Provider value={value}>
      <div className={cn('flex', className)} {...props} data-slot="sidebar-provider">
        {children}
      </div>
    </SidebarCtx.Provider>
  );
}

/* ── 容器 ─────────────────────────────────────────────────────────────── */

export interface GlassSidebarProps extends React.ComponentProps<'div'> {
  /** 宽（px）。默认 320（实测）。 */
  width?: number;
  /** 无障碍标签。侧栏是 `<nav>`，必须有可访问名称。 */
  label?: string;
}

function Sidebar({
  className,
  style,
  width = SIDEBAR_GEOMETRY.width,
  label = 'Sidebar',
  children,
  ...props
}: GlassSidebarProps) {
  const { open, setOpen, compact, id } = useSidebar();
  const glass = useGlassOptional();
  const reduced = glass?.preferences.reducedMotion ?? false;

  const surface = (
    <GlassSurface
      layer="base"
      /* ⚠️ 这一句就是 HIG「更不透明」那条规则的落点。见文件头。 */
      scale="large"
      radius={SIDEBAR_GEOMETRY.radius}
      continuous
      className={cn('flex h-full flex-col overflow-hidden', className)}
      style={{ width, padding: SIDEBAR_GEOMETRY.padding, ...style }}
      {...props}
      data-slot="sidebar"
    >
      {children}
    </GlassSurface>
  );

  // ── 紧凑：前缘滑出的覆盖层（Radix Dialog 提供焦点陷阱 / Escape / 滚动锁）──
  //
  // ⚠️ motion 元素一律**嵌在** Radix 部件里面，不用 `asChild` 顶替它 ——
  //    与 Dialog / Sheet 同一套写法，理由见 dialog.tsx 文件头
  //    （shadcn 会在 base-* style 的工程里把 asChild 改写成 Base UI 的 render prop）。
  //    `scripts/registry-lint.mjs` 对整个 registry 强制这一条。
  if (compact) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open ? (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay
                forceMount
                data-slot="sidebar-overlay"
                className="fixed inset-0 z-40"
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ background: 'var(--lg-scrim)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transitionFor('smooth', reduced)}
                />
              </DialogPrimitive.Overlay>

              <DialogPrimitive.Content
                forceMount
                id={id}
                data-slot="sidebar-panel"
                className="fixed inset-y-0 start-0 z-50 outline-none"
              >
                {/*
                 * Radix Dialog 要求 Content 内必须有 Title，否则控制台报警。
                 * 侧栏在视觉上不该有标题，所以放一个只给读屏用的。
                 * （STATUS 里记着「没有任何测试看过控制台」那一条 —— 这次不添新的。）
                 */}
                <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
                <motion.div
                  className="h-full"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={transitionFor('snappy', reduced)}
                >
                  {surface}
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          ) : null}
        </AnimatePresence>
      </DialogPrimitive.Root>
    );
  }

  // ── 宽视口：就地占位，折叠时宽度收到 0 ──────────────────────────────
  return (
    <motion.nav
      id={id}
      aria-label={label}
      data-state={open ? 'open' : 'closed'}
      data-slot="sidebar-region"
      className="relative shrink-0 overflow-hidden"
      initial={false}
      animate={{ width: open ? width : 0 }}
      transition={transitionFor('snappy', reduced)}
      /*
       * ⚠️ 折叠后必须 `inert`，否则宽度是 0 但里面的链接**仍然可以 Tab 到** ——
       * 焦点跑进一块看不见的区域，且屏幕阅读器会照读不误。
       * （`hidden` 不能用：那样宽度动画就没有东西可以过渡了。）
       */
      {...(open ? {} : { inert: true })}
    >
      <div style={{ width }} className="h-full">
        {surface}
      </div>
    </motion.nav>
  );
}

/* ── 触发器 ───────────────────────────────────────────────────────────── */

export interface GlassSidebarTriggerProps extends React.ComponentProps<'button'> {}

function SidebarTrigger({ className, onClick, children, ...props }: GlassSidebarTriggerProps) {
  const { open, setOpen, id } = useSidebar();
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'text-[var(--lg-label-primary)] transition-colors duration-100',
        'hover:bg-[var(--lg-fill-quaternary)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lg-ring)]',
        className,
      )}
      style={{ width: SIDEBAR_GEOMETRY.itemHeight, height: SIDEBAR_GEOMETRY.itemHeight }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
      data-slot="sidebar-trigger"
    >
      {children ?? <SidebarIcon />}
      <span className="sr-only">{open ? '收起侧栏' : '展开侧栏'}</span>
    </button>
  );
}

/**
 * 默认图标。自己画的 —— 资源里的图标是 SF Symbols 的 PUA 码位，
 * Web 上没有那套字体，直接渲染出来是豆腐块。
 * （同一个坑在 collapsible.tsx 的 chevron 上记过一次。）
 */
function SidebarIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="18"
        height="16"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <path d="M7.5 1.5V16.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

/* ── 结构件 ───────────────────────────────────────────────────────────── */

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
      data-slot="sidebar-header"
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
      data-slot="sidebar-content"
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('shrink-0', className)} {...props} data-slot="sidebar-footer" />
  );
}

/**
 * 一个分区。`<SidebarGroupLabel>` 是它的可访问名称 ——
 * 所以这里用 `role="group"` + `aria-labelledby`，而不是裸 div。
 */
export interface GlassSidebarGroupProps extends React.ComponentProps<'div'> {}

const GroupCtx = React.createContext<string | null>(null);

function SidebarGroup({ className, children, ...props }: GlassSidebarGroupProps) {
  const labelId = React.useId();
  return (
    <GroupCtx.Provider value={labelId}>
      <div
        role="group"
        aria-labelledby={labelId}
        className={cn('flex flex-col', className)}
        {...props}
        data-slot="sidebar-group"
      >
        {children}
      </div>
    </GroupCtx.Provider>
  );
}

function SidebarGroupLabel({ className, style, ...props }: React.ComponentProps<'div'>) {
  const labelId = React.useContext(GroupCtx);
  return (
    <div
      id={labelId ?? undefined}
      className={cn('flex items-center text-[var(--lg-label-secondary)]', className)}
      style={{
        minHeight: SIDEBAR_GEOMETRY.groupLabelHeight,
        paddingTop: SIDEBAR_GEOMETRY.groupLabelPaddingTop,
        paddingBottom: SIDEBAR_GEOMETRY.groupLabelPaddingBottom,
        paddingInline: SIDEBAR_GEOMETRY.groupLabelPaddingInline,
        fontSize: SIDEBAR_GEOMETRY.fontSize,
        lineHeight: `${SIDEBAR_GEOMETRY.lineHeight}px`,
        letterSpacing: SIDEBAR_GEOMETRY.letterSpacing,
        ...style,
      }}
      {...props}
      data-slot="sidebar-group-label"
    />
  );
}

/* ── 行 ───────────────────────────────────────────────────────────────── */

export interface GlassSidebarItemProps extends React.ComponentProps<'button'> {
  /** 缩进级数。[实测] 每级 20px，资源画到 2，本库不设上界（macOS 那边画到 4）。 */
  level?: number;
  /** 选中态。整条侧栏里应当只有一个。 */
  selected?: boolean;
  /** 前置图标。 */
  icon?: React.ReactNode;
  /** 尾部说明文字（资源里叫 Detail）。 */
  detail?: React.ReactNode;
}

function SidebarItem({
  className,
  style,
  level = 0,
  selected = false,
  icon,
  detail,
  disabled,
  children,
  ...props
}: GlassSidebarItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      /*
       * `aria-current="page"` 而不是 `aria-selected` —— 侧栏行是导航目标，
       * 不是 listbox 选项。读屏会读成「当前页」，这才是它的语义。
       */
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex w-full items-center text-start',
        'transition-colors duration-100',
        'text-[var(--lg-label-primary)]',
        // 选中态：一层减色填充，**不是折射透镜**。理由见文件头。
        selected ? 'bg-[var(--lg-fill-tertiary)]' : 'hover:bg-[var(--lg-fill-quaternary)]',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lg-ring)]',
        'disabled:pointer-events-none',
        className,
      )}
      style={{
        minHeight: SIDEBAR_GEOMETRY.itemHeight,
        // 胶囊 —— [实测] r=100 于 44 高
        borderRadius: SIDEBAR_GEOMETRY.itemHeight / 2,
        paddingInlineStart: sidebarIndent(level),
        paddingInlineEnd: SIDEBAR_GEOMETRY.itemPaddingRight,
        gap: SIDEBAR_GEOMETRY.itemGap,
        fontSize: SIDEBAR_GEOMETRY.fontSize,
        lineHeight: `${SIDEBAR_GEOMETRY.lineHeight}px`,
        letterSpacing: SIDEBAR_GEOMETRY.letterSpacing,
        ...(disabled ? { opacity: SIDEBAR_GEOMETRY.disabledOpacity } : {}),
        ...style,
      }}
      {...props}
      data-slot="sidebar-item"
      data-level={level}
      data-selected={selected ? 'true' : undefined}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center text-[var(--lg-blue)]"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detail ? (
        <span className="shrink-0 text-[var(--lg-label-secondary)]">{detail}</span>
      ) : null}
    </button>
  );
}

export {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  useSidebar,
};
