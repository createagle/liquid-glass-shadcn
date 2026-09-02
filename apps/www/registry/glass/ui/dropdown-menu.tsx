'use client';

// APPLE REFERENCE: UIMenu / SwiftUI `Menu`
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:24185 —— Edit Menu）。
// 参考图 screenshots/ios27-menu.png，完整测量见 apple-metrics.md §7.7。
//
//   面板宽            250 pt      [实测]
//   上下内边距        10 pt       [实测]
//   左右内边距        16 pt       [实测] —— 菜单项因此是 218 宽
//   菜单项高          40 pt       [实测]（带副标题的 60）
//   分隔区高          21 pt       [实测]
//   分隔线            1 pt，位于分隔区顶端 **+2**，左右各再内缩 8（面板内共 24）
//                                 [实测] —— 两条分隔线独立复核一致
//
// ⚠️ **面板圆角 22 是 `[推定]`，不是实测。** 菜单面板是半透明玻璃压在中灰背景上，
//    轮廓拟合不收敛（圆弧 RMSE 1.5–2.2px；自由超椭圆里 r 与 n 强烈互换）。
//    完整记录见 apple-metrics §7.7 与 popover.tsx 的文件头。
//
// ── 分层：Layer I 终于有地方落了 ──────────────────────────────────────
//
// PROJECT_SPEC §2：`| Select / Dropdown / Popover | 弹层面板 | 高亮项(hover/focus) |`
//
//   面板   = Layer B（elevated，磨砂，**不折射**）
//   高亮项 = Layer I（强玻璃，折射 + 色散）
//
// Popover 那一批只做了面板 —— 它装的是任意内容，没有「项」这个概念。
// 这里补上另一半。高亮项是 218×40，**尺度足够看见色散**（对比 Sheet 的抓手
// 只有 4pt 高，那里就看不出来）。
//
// 底座要**挖洞**：指示器嵌在磨砂面板里，不挖洞的话折射看到的是被面板模糊过的
// 背景，等于没折射（Tabs 那批查出来的，见 STATUS §0.2）。洞跟着高亮项走。
//
// ── 移动端：桌面走 Radix，移动端是**我们自己接的线** ──────────────────
//
// SPEC §9 要求这类组件在移动端改成底部 Drawer。两条路径的实现不对称，
// 这一点必须说清楚：
//
//   桌面 → `@radix-ui/react-dropdown-menu`：roving focus、typeahead、
//           aria-activedescendant、方向键、Home/End 全是 Radix 的
//   移动 → 本库的 `<Sheet>` + **我们自己写的** role=menu / role=menuitem
//           与方向键导航
//
// 为什么不能两边都用 Radix：Radix 的 `DropdownMenu.Content` 自带 popper 定位，
// 它必须挂在自己的 Portal 里，没法塞进 Sheet 的面板中；而 Sheet 的档位、拖拽、
// 甩动关闭又是 SPEC §9 点名要求的。二者只能取其一。
//
// ⚠️ **移动路径少一样东西：typeahead（首字母跳转）。** Radix 有，我们没写。
//    移动端没有物理键盘时它本来就用不上，但接了外接键盘就会缺。
//    这是**已知的未完成**，记在 STATUS 里，不假装等价。

import * as React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';
import {
  GlassSurface,
  measurePunch,
  transitionFor,
  useGlassOptional,
  useIsCompact,
  type GlassPunch,
} from '@glass/core';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export const MENU_GEOMETRY = {
  /** 面板默认宽。[实测] */
  width: 250,
  /** 面板上下内边距。[实测] */
  paddingBlock: 10,
  /** 面板左右内边距。[实测] —— 菜单项因此是 250 − 2×16 = 218 宽 */
  paddingInline: 16,
  /** 面板圆角。**`[推定]`** —— 拟合不收敛，取 --lg-radius-lg，见文件头 */
  radius: 22,
  /** 菜单项高。[实测] */
  itemHeight: 40,
  /** 分隔区高。[实测] */
  separatorZone: 21,
  /** 分隔线在分隔区内的偏移。[实测] */
  separatorOffset: 2,
  /** 分隔线相对菜单项框再内缩。[实测] —— 16 + 8 = 面板内 24 */
  separatorInset: 8,
  /** 菜单项字号。`[待核实]` —— 与 Alert / 列表行同取 body 17 */
  fontSize: 17,
  /** 与触发器的间距。`[推定]` —— 参考图里菜单与触发它的按钮不在同一帧 */
  sideOffset: 8,
  /**
   * 高亮项的圆角。`[推定]` —— 参考图里没有高亮态可量（静态稿）。
   * 取 10：比面板的 22 小一圈，视觉上像「嵌在里面的一块」。
   */
  itemRadius: 10,
} as const;

/* ── context ──────────────────────────────────────────────────────────── */

interface MenuCtxValue {
  /** true = 走移动端 Drawer 路径 */
  compact: boolean;
  /** 面板要按高亮项挖洞（只有桌面路径需要 —— 移动端的项不是 Layer I） */
  punch: GlassPunch | null;
  setPunch: (p: GlassPunch | null) => void;
  /**
   * 关闭菜单。桌面路径由 Radix 在选中后自动关；
   * 移动路径是我们自己接的 role=menu，得自己关。
   */
  setOpen: (next: boolean) => void;
}

const MenuCtx = React.createContext<MenuCtxValue | null>(null);

function useMenuCtx(part: string) {
  const ctx = React.useContext(MenuCtx);
  if (!ctx) throw new Error(`<${part}> 必须放在 <DropdownMenu> 里`);
  return ctx;
}

/* ── Root ─────────────────────────────────────────────────────────────── */

export interface GlassDropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * 逃生口：强制桌面行为（SPEC §9 明确要求提供）。
   * 例如菜单项极多、在小屏 Drawer 里反而更难用时。
   */
  responsive?: boolean;
  children?: React.ReactNode;
}

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  responsive = true,
  children,
}: GlassDropdownMenuProps) {
  const compact = useIsCompact() && responsive;
  const [punch, setPunch] = React.useState<GlassPunch | null>(null);

  /**
   * 开关态自己接管一份，两条路径都以受控方式驱动。
   *
   * 不是为了好看：移动路径是我们自己接的 `role=menu`，选中之后**得自己关**
   * （桌面路径 Radix 会替我们关）。要关就得拿得到 setOpen，而 Sheet 的
   * 关闭入口 `SheetClose` 是个按钮组件，菜单项用不上。
   */
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

  const value = React.useMemo(
    () => ({ compact, punch, setPunch, setOpen }),
    [compact, punch, setOpen],
  );

  return (
    <MenuCtx.Provider value={value}>
      {compact ? (
        <Sheet open={current} onOpenChange={setOpen}>
          {children}
        </Sheet>
      ) : (
        <MenuPrimitive.Root open={current} onOpenChange={setOpen}>
          {children}
        </MenuPrimitive.Root>
      )}
    </MenuCtx.Provider>
  );
}

export interface GlassDropdownMenuTriggerProps extends React.ComponentProps<'button'> {}

/**
 * 两条路径的 Trigger 都是各自原语的原生 button（aria-haspopup / aria-expanded
 * 由原语接好）。与全库一致：本库禁用 asChild，要自定义外观就给 className。
 */
function DropdownMenuTrigger(props: GlassDropdownMenuTriggerProps) {
  const { compact } = useMenuCtx('DropdownMenuTrigger');
  const Comp = compact ? SheetTrigger : MenuPrimitive.Trigger;
  return <Comp data-slot="dropdown-menu-trigger" {...props} />;
}

/* ── 移动路径的键盘导航 ───────────────────────────────────────────────── */

/**
 * 移动路径下 role=menu 的方向键导航。**这是我们自己接的线**，
 * 桌面路径由 Radix 负责（还多一个 typeahead，我们没写，见文件头）。
 *
 * 覆盖：↑ ↓ Home End，以及跳过 disabled 项。
 * Enter / Space 不用特判 —— 项本身是 `<button>`，浏览器原生就会触发 click。
 * Esc 由 Sheet（Radix Dialog）负责。
 *
 * ⚠️ 用 `onKeyDown` 属性，**不要**写成 `useEffect` + ref 去 addEventListener：
 * 那样第一次 effect 跑的时候 ref 还是 null（浮层此刻可能还没挂载），
 * 而 ref 变化不会触发 effect 重跑 —— 监听器就永远装不上。
 * （第一版就是这么写的，测试当场红了。挖洞那条也是同一个坑，见下面的回调 ref。）
 */
function handleMenuKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const root = e.currentTarget;
  const items = [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
    (el) => el.getAttribute('aria-disabled') !== 'true',
  );
  if (items.length === 0) return;
  e.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  let next = 0;
  if (e.key === 'End') next = items.length - 1;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
  else next = current <= 0 ? items.length - 1 : current - 1;
  items[next]?.focus();
}

/* ── Content ──────────────────────────────────────────────────────────── */

export interface GlassDropdownMenuContentProps {
  /**
   * 无障碍名称。**移动路径必填** —— Radix Dialog（Sheet 走它）要求必须有 Title，
   * 桌面的 Radix Menu 不要求。为了两条路径读出来的名称一致，这里统一要求：
   * 移动路径下会显示出来（iOS 的 action sheet 也有标题），桌面路径落到 aria-label。
   */
  title: string;
  className?: string;
  children?: React.ReactNode;
  /** 面板宽度（px）。默认 250 = iOS Edit Menu 的实测宽度。 */
  width?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

function DropdownMenuContent({
  title,
  className,
  children,
  width = MENU_GEOMETRY.width,
  side = 'bottom',
  align = 'start',
  sideOffset = MENU_GEOMETRY.sideOffset,
}: GlassDropdownMenuContentProps) {
  const ctx = useMenuCtx('DropdownMenuContent');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const { compact, setPunch } = ctx;

  /**
   * 挖洞：把高亮项的位置同步给面板。
   *
   * 指示器嵌在磨砂面板里，不挖洞的话它折射到的是**被面板模糊过**的背景，
   * 等于没折射（Tabs 那批查出来的，STATUS §0.2）。
   *
   * ⚠️ 必须用**回调 ref**，不能用 `useEffect` + `panelRef.current`：
   * 浮层是 Radix Portal 里的东西，effect 第一次跑的时候面板可能还没挂上，
   * 而 ref 的赋值不会触发 effect 重跑 —— observer 就永远装不上。
   * （第一版就是这么写的，`data-punched` 一直是 null，测试当场红了。）
   *
   * 一个 observer 盯整棵子树的 `data-highlighted` —— Radix 换高亮项时改的就是
   * 这个属性，比在每个 Item 里各挂一个省得多。
   */
  const observerRef = React.useRef<MutationObserver | null>(null);
  const clearRafRef = React.useRef(0);
  const attachPanel = React.useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      cancelAnimationFrame(clearRafRef.current);
      if (!node || compact) {
        setPunch(null);
        return;
      }
      const sync = () => {
        const item = node.querySelector<HTMLElement>('[data-highlighted]');
        if (!item) {
          /**
           * 换项的一瞬间，Radix 会**先摘掉旧项**的 `data-highlighted`、再给新项挂上 ——
           * 中间存在一帧「谁都没高亮」。立刻把洞收掉的话，洞会跟着闪一下。
           * 等一帧再确认：真的没人高亮了才收。
           * （CI 上还因此翻过一次车：测试在那一帧里读 .lg-punch-layer，读到 null。）
           */
          cancelAnimationFrame(clearRafRef.current);
          clearRafRef.current = requestAnimationFrame(() => {
            if (!node.querySelector('[data-highlighted]')) setPunch(null);
          });
          return;
        }
        cancelAnimationFrame(clearRafRef.current);
        /**
         * ⚠️ 基准是 **`.lg-surface` 本体**，不是这个装内容的 div。
         *
         * 第一版拿 `node.getBoundingClientRect()` 当基准，而 node 在面板的
         * 内边距**里面** —— 洞于是整体偏了 (16, 10)：218 宽的项，洞落在
         * x=0…218，项其实在 x=16…234。偏了之后仍有 ~90% 重叠，
         * 条纹清晰度照样翻倍，所以「有没有色散」量对了，
         * 「洞在不在位置上」却一直没人验。Select 那一批才查出来。
         * 缩放补偿也在 measurePunch 里，理由见 @glass/core 的 punch.ts。
         */
        const surface = node.closest<HTMLElement>('.lg-surface');
        if (surface) setPunch(measurePunch(surface, item, MENU_GEOMETRY.itemRadius));
      };
      sync();
      const mo = new MutationObserver(sync);
      mo.observe(node, { subtree: true, attributes: true, attributeFilter: ['data-highlighted'] });
      observerRef.current = mo;
    },
    [compact, setPunch],
  );

  /* ── 移动路径：底部 Drawer + 我们自己接的 role=menu ─────────────────── */
  if (compact) {
    return (
      <SheetContent data-dropdown-menu="content" className={className}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div role="menu" aria-label={title} className="flex flex-col" onKeyDown={handleMenuKeyDown}>
            {children}
          </div>
        </SheetBody>
      </SheetContent>
    );
  }

  /* ── 桌面路径：Radix Menu + Layer B 面板 ───────────────────────────── */
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-dropdown-menu="content"
        /**
         * 桌面路径**不设 aria-label**。
         *
         * Radix 已经把 `aria-labelledby` 指向触发器了 —— 那正是 WAI-ARIA 的
         * menu 模式要求的（菜单由打开它的按钮命名），而且 labelledby 优先级
         * 高于 label，写了也是死代码。
         *
         * 于是两条路径的可访问名称**不一样**：桌面是触发器的文字，移动是
         * Drawer 的可见标题（Radix Dialog 要求必须有 Title）。两边都对，
         * 但确实不同 —— 与「模态性差异」是同一类事，测试里各测各的。
         */
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 outline-none', className)}
        style={{ width }}
      >
        <motion.div
          data-slot="dropdown-menu-panel"
          // 从触发器那一侧长出来：Radix 把落位算好后写进这个变量
          className="origin-[var(--radix-dropdown-menu-content-transform-origin)]"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transitionFor('snappy', reducedMotion)}
        >
          <GlassSurface
            layer="elevated"
            radius={MENU_GEOMETRY.radius}
            continuous
            punch={ctx.punch}
            className="relative isolate"
            style={{
              paddingBlock: MENU_GEOMETRY.paddingBlock,
              paddingInline: MENU_GEOMETRY.paddingInline,
            }}
          >
            <div ref={attachPanel} className="relative flex flex-col">
              {children}
            </div>
          </GlassSurface>
        </motion.div>
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

/* ── Item ─────────────────────────────────────────────────────────────── */

export interface GlassDropdownMenuItemProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSelect?: (event: Event) => void;
  /** 破坏性操作。用 AA 安全的红，不是裸的 systemRed（§13）。 */
  destructive?: boolean;
}

function DropdownMenuItem({
  children,
  className,
  disabled,
  onSelect,
  destructive,
}: GlassDropdownMenuItemProps) {
  const ctx = useMenuCtx('DropdownMenuItem');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  /**
   * 高亮态跟着**焦点**走。
   *
   * Radix 的菜单用 roving focus：`data-highlighted` 与「这一项被 focus」是同一件事，
   * 所以直接听 focus / blur 就够了，不必给每个项挂一个 MutationObserver。
   * （面板那边挖洞仍然听 `data-highlighted` —— 那是一个 observer 管整棵子树。）
   */
  const [highlighted, setHighlighted] = React.useState(false);

  const style: React.CSSProperties = {
    minHeight: MENU_GEOMETRY.itemHeight,
    fontSize: MENU_GEOMETRY.fontSize,
    borderRadius: MENU_GEOMETRY.itemRadius,
    color: destructive ? 'var(--lg-on-glass-red)' : 'var(--lg-label-primary)',
  };
  const base = cn(
    'relative flex w-full items-center gap-3 text-left outline-none select-none',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
    className,
  );

  /* 移动路径：项不是 Layer I —— Drawer 里没有「悬停」，高亮只是按下反馈 */
  if (ctx.compact) {
    return (
      <button
        type="button"
        role="menuitem"
        data-slot="dropdown-menu-item"
        aria-disabled={disabled ? 'true' : undefined}
        disabled={disabled}
        className={cn(base, 'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]')}
        style={style}
        onClick={() => {
          // 与 Radix 的 onSelect 语义对齐：preventDefault() 可以阻止关闭
          const event = new Event('select', { cancelable: true });
          onSelect?.(event);
          if (!event.defaultPrevented) ctx.setOpen(false);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      // exactOptionalPropertyTypes 下 `disabled: undefined` 与「没传」是两回事
      {...(disabled !== undefined ? { disabled } : {})}
      {...(onSelect ? { onSelect } : {})}
      className={base}
      style={style}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
    >
      {/*
        Layer I 高亮项。PROJECT_SPEC §2 给这一类的 Layer I 就是它。
        面板那边按同一块矩形挖了洞，折射才看得到未被模糊的背景。

        ⚠️ 与 Button 按下态 / Toggle 选中态**不同**：那两处必须补回底色，
        因为它们**自己就是**那层底座，α 归零标签就没背景了。
        这里高亮项是**叠在面板材质之上**的，面板底色仍在标签背后 ——
        与 Tabs 的指示器同理（实测 15.51:1）。所以这里不补底色，
        让折射与色散真的显形。scripts/press-legibility.mjs 里有这一条的测点。
      */}
      <motion.span
        aria-hidden="true"
        data-slot="dropdown-menu-item-highlight"
        className="absolute inset-0 -z-10"
        initial={false}
        animate={{ opacity: highlighted ? 1 : 0 }}
        transition={transitionFor('smooth', reducedMotion)}
      >
        <GlassSurface layer="indicator" radius={MENU_GEOMETRY.itemRadius} className="h-full w-full" />
      </motion.span>
      <span className="relative">{children}</span>
    </MenuPrimitive.Item>
  );
}

/* ── Separator / Label / Group ────────────────────────────────────────── */

export interface GlassDropdownMenuSeparatorProps {
  className?: string;
}

/**
 * 分隔区。**不是一条线，是一块 21pt 高的区域**，线在区顶 +2 处。
 * 这个偏移量是量出来的（两条分隔线独立复核一致），不是居中。
 */
function DropdownMenuSeparator({ className }: GlassDropdownMenuSeparatorProps) {
  const { compact } = useMenuCtx('DropdownMenuSeparator');
  const Comp = compact ? 'div' : MenuPrimitive.Separator;
  return (
    <Comp
      data-slot="dropdown-menu-separator"
      className={cn('relative', className)}
      style={{ height: MENU_GEOMETRY.separatorZone }}
    >
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          top: MENU_GEOMETRY.separatorOffset,
          left: MENU_GEOMETRY.separatorInset,
          right: MENU_GEOMETRY.separatorInset,
          height: 1,
          background: 'var(--lg-separator)',
        }}
      />
    </Comp>
  );
}

export interface GlassDropdownMenuLabelProps {
  children?: React.ReactNode;
  className?: string;
}

function DropdownMenuLabel({ children, className }: GlassDropdownMenuLabelProps) {
  const { compact } = useMenuCtx('DropdownMenuLabel');
  const Comp = compact ? 'div' : MenuPrimitive.Label;
  return (
    <Comp
      data-slot="dropdown-menu-label"
      className={cn('flex items-center', className)}
      style={{
        minHeight: MENU_GEOMETRY.itemHeight,
        // 15 = subheadline，`[待核实]`（apple-metrics §6 没找到 Apple 出处）
        fontSize: 15,
        color: 'var(--lg-label-secondary)',
      }}
    >
      {children}
    </Comp>
  );
}

export interface GlassDropdownMenuGroupProps {
  children?: React.ReactNode;
  className?: string;
}

function DropdownMenuGroup({ children, className }: GlassDropdownMenuGroupProps) {
  const { compact } = useMenuCtx('DropdownMenuGroup');
  const Comp = compact ? 'div' : MenuPrimitive.Group;
  return (
    <Comp data-slot="dropdown-menu-group" className={cn('flex flex-col', className)}>
      {children}
    </Comp>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
};
