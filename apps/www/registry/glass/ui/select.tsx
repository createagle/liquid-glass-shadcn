'use client';

// APPLE REFERENCE: SwiftUI `Picker`（`.pickerStyle(.menu)`）/
//                  UIKit 的下拉式 `UIButton`（`changesSelectionAsPrimaryAction`）
//
// 弹层就是**菜单本体** —— 与 DropdownMenu 同一块材质、同一套几何
// （Apple Design Resources《iOS and iPadOS 27》，fileKey ojEQo0rKaQ5ioARo0CO0pf，
//  节点 12740:24185，完整测量见 apple-metrics.md §7.7）。
//
//   面板宽 250 · 上下内边距 10 · 左右内边距 16（项宽 218）
//   项高 40 · 分隔区 21（1pt 线在区顶 +2、左右各再内缩 8）
//
// ── 这一批新量出来的：菜单项**内部**的前导布局 ────────────────────────
//
// 之前只量到「项 = 218×40」这一层。这次拆开了 Item 实例
// （节点 12740:24194 → 子节点 Leading / Symbol / Label and Subtitle）：
//
//   Leading 框   x=6，宽 204        →  项内**再内缩 6**             [实测]
//   Symbol       x=0，28×20         →  图标列宽 **28**              [实测]
//   Label 块     x=36，宽 168       →  图标与标签间距 **8**（36−28）[实测]
//
// 也就是说标签在项内从 x=42 起（面板内 16+42 = 58）。三个 Item 实例一致。
//
// ⚠️ **对勾放在这一列是 `[推定]`，不是实测。** 参考图是静态的 Edit Menu，
//    里面没有任何「选中态」可量。取 Symbol 列的依据是 UIKit：
//    UIAction 的 `state == .on` 时对勾占的正是 image 槽位。
//    列本身的尺寸（28×20 / 内缩 6 / 间距 8）是实测，**别把两件事混着引用**。
//
// ⚠️ 对勾颜色取 `--lg-label-primary`，同样是 `[推定]`。UIKit 的菜单对勾用
//    菜单的 tintColor，而系统菜单的 tintColor 默认就是 label 色。没有实测。
//
// ── 分层 ──────────────────────────────────────────────────────────────
//
// PROJECT_SPEC §2：`| Select / Dropdown / Popover | 弹层面板 | 高亮项(hover/focus) |`
//
//   面板     = Layer B（elevated，磨砂，**不折射**）
//   高亮项   = Layer I（强玻璃，折射 + 色散），面板为它挖洞
//   **选中项 ≠ 高亮项**：选中是持久状态，用对勾表示，**不给玻璃**；
//     高亮是瞬时的键盘/指针焦点。两者可以同时落在同一项上。
//
// ── 两条路径 ──────────────────────────────────────────────────────────
//
// SPEC §9：这类浮层在紧凑视口必须换成底部 Drawer。与 DropdownMenu 同构：
//
//   桌面 → `@radix-ui/react-select`（combobox + listbox 全套由 Radix 接）
//   移动 → 本库 `<Sheet>` + **我们自己接的** role=listbox / role=option
//
// **DropdownMenu 欠的 typeahead，这一批还上了** —— 移动路径的 listbox 自带
// 首字母跳转（1s 缓冲、同字母循环、空格只在缓冲非空时计入）。见 useListboxKeyDown。
//
// 两条路径仍有一处不对称，如实记着：
//   桌面触发器是 Radix 的 `role=combobox` + `aria-haspopup=listbox`；
//   移动触发器是 Dialog 触发器，我们补了 `role=combobox`，
//   `aria-haspopup` 留 Radix 的 `dialog` —— 它确实开的是 dialog，
//   而 WAI-ARIA 1.2 的 combobox 本来就允许 `aria-haspopup=dialog`。

import * as React from 'react';
import { createPortal } from 'react-dom';
import * as SelectPrimitive from '@radix-ui/react-select';
import { motion, type MotionStyle } from 'motion/react';
import {
  GlassSurface,
  measurePunch,
  transitionFor,
  useGlassOptional,
  useIsCompact,
  usePunchState,
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

export const SELECT_GEOMETRY = {
  /** 面板默认宽。[实测]（= Menu） */
  width: 250,
  /** 面板上下内边距。[实测] */
  paddingBlock: 10,
  /** 面板左右内边距。[实测] —— 项因此是 250 − 2×16 = 218 宽 */
  paddingInline: 16,
  /** 面板圆角。**`[推定]`** —— 轮廓拟合不收敛，取 --lg-radius-lg。见 §7.7 */
  radius: 22,
  /** 项高。[实测] */
  itemHeight: 40,
  /** 项内**再内缩**。[实测] —— Leading 框在 218 项内 x=6、宽 204 */
  itemInset: 6,
  /** 前导图标列宽。[实测] —— 对勾画在这一列（**列宽实测、对勾位置推定**） */
  symbolWidth: 28,
  /** 前导图标列高。[实测] */
  symbolHeight: 20,
  /** 图标与标签的间距。[实测] —— 36 − 28 */
  symbolGap: 8,
  /** 分隔区高。[实测] */
  separatorZone: 21,
  /** 分隔线在分隔区内的偏移。[实测] */
  separatorOffset: 2,
  /** 分隔线相对项框再内缩。[实测] —— 16 + 8 = 面板内 24 */
  separatorInset: 8,
  /** 项字号。`[待核实]` —— 与 Alert / 列表行同取 body 17 */
  fontSize: 17,
  /** 与触发器的间距。`[推定]` */
  sideOffset: 8,
  /** 高亮项圆角。`[推定]` —— 与 DropdownMenu 取同一个值 */
  itemRadius: 10,
  /** 触发器高。[实测] —— 与 Button 的 default 同源（iOS 27 两处独立印证 48） */
  triggerHeight: 48,
  /** 触发器水平内边距 / 高度。[实测] —— 12 ÷ 48 */
  triggerPaddingRatio: 0.25,
  /** 触发器标签字号。[实测] 17pt = SF body */
  triggerLabelSize: 17,
  /** 触发器按下缩放。`[推定]` —— 与 Button 同值，保持同一套按下隐喻 */
  triggerPressScale: 0.97,
  /** chevron.up.chevron.down 的绘制尺寸。`[推定]` —— 参考图里没有下拉按钮可量 */
  chevron: 12,
} as const;

/** typeahead 缓冲的存活时间（ms）。与 Radix 的默认值一致。 */
const TYPEAHEAD_TIMEOUT = 1000;

/* ── icons ───────────────────────────────────────────────────────────── */

/**
 * 对勾。SF Symbols 的 checkmark 没有可再分发的矢量源，这是**近似描摹**，
 * 画在实测的 28×20 图标列里。`[推定]`
 */
function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 20"
      width={SELECT_GEOMETRY.symbolWidth}
      height={SELECT_GEOMETRY.symbolHeight}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 10.6 L10.4 15.2 L21 4.9" />
    </svg>
  );
}

/** chevron.up.chevron.down 的近似描摹。`[推定]` */
function ChevronUpDownGlyph() {
  const s = SELECT_GEOMETRY.chevron;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 18"
      width={s}
      height={(s * 18) / 12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.2 7 L6 3.2 L9.8 7" />
      <path d="M2.2 11 L6 14.8 L9.8 11" />
    </svg>
  );
}

/* ── context ─────────────────────────────────────────────────────────── */

interface SelectCtxValue {
  /** true = 走移动端 Drawer 路径 */
  compact: boolean;
  open: boolean;
  setOpen: (next: boolean) => void;
  value: string | undefined;
  setValue: (next: string) => void;
  disabled: boolean;
  /** 面板按高亮项挖洞（只有桌面路径需要） */
  punch: GlassPunch | null;
  setPunch: (p: GlassPunch | null) => void;
  /** value → 标签文本。移动路径的触发器靠它显示当前值，见 SelectContent。 */
  labels: Map<string, string>;
  registerLabel: (value: string, label: string) => void;
}

const SelectCtx = React.createContext<SelectCtxValue | null>(null);

function useSelectCtx(part: string) {
  const ctx = React.useContext(SelectCtx);
  if (!ctx) throw new Error(`<${part}> 必须放在 <Select> 里`);
  return ctx;
}

/* ── Root ────────────────────────────────────────────────────────────── */

export interface GlassSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** 提交表单用的字段名（只有桌面路径由 Radix 接出隐藏 input，见文件尾的说明） */
  name?: string;
  required?: boolean;
  /** 逃生口：强制桌面行为（SPEC §9 要求提供）。 */
  responsive?: boolean;
  children?: React.ReactNode;
}

function Select({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  name,
  required,
  responsive = true,
  children,
}: GlassSelectProps) {
  const compact = useIsCompact() && responsive;
  // 值没变就不重渲染 —— 观察器每次触发都产生新对象，理由见 usePunchState
  const [punch, setPunch] = usePunchState();

  /**
   * 开关态与选中值都自己接管一份，两条路径都以受控方式驱动。
   * 移动路径是我们自己接的 role=listbox：选中之后**得自己关**、
   * 当前值也**得自己记**（桌面路径这两件事都是 Radix 做的）。
   */
  const [openUncontrolled, setOpenUncontrolled] = React.useState(defaultOpen ?? false);
  const openControlled = open !== undefined;
  const currentOpen = openControlled ? open : openUncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!openControlled) setOpenUncontrolled(next);
      onOpenChange?.(next);
    },
    [openControlled, onOpenChange],
  );

  const [valueUncontrolled, setValueUncontrolled] = React.useState(defaultValue);
  const valueControlled = value !== undefined;
  const currentValue = valueControlled ? value : valueUncontrolled;
  const setValue = React.useCallback(
    (next: string) => {
      if (!valueControlled) setValueUncontrolled(next);
      onValueChange?.(next);
    },
    [valueControlled, onValueChange],
  );

  /**
   * value → 标签文本。**只有移动路径需要**：Sheet 关着的时候 `SelectItem`
   * 根本没渲染，触发器就无从知道当前值该显示成什么。
   * 解法与 Radix Select 内部一样 —— 关闭时把 children 渲染进一个游离的
   * DocumentFragment，让项照常注册，但不出现在文档里。见 LabelRegistrar。
   */
  const labelsRef = React.useRef(new Map<string, string>());
  const [labelVersion, bumpLabels] = React.useReducer((n: number) => n + 1, 0);
  const registerLabel = React.useCallback((v: string, label: string) => {
    if (labelsRef.current.get(v) === label) return;
    labelsRef.current.set(v, label);
    bumpLabels();
  }, []);

  const ctx = React.useMemo<SelectCtxValue>(
    () => ({
      compact,
      open: currentOpen,
      setOpen,
      value: currentValue,
      setValue,
      disabled,
      punch,
      setPunch,
      labels: labelsRef.current,
      registerLabel,
    }),
    // labelVersion 只用来让消费者跟着 Map 的变化重渲染 —— Map 本身是稳定引用
    [compact, currentOpen, setOpen, currentValue, setValue, disabled, punch, registerLabel, labelVersion],
  );

  return (
    <SelectCtx.Provider value={ctx}>
      {compact ? (
        <Sheet open={currentOpen} onOpenChange={disabled ? noop : setOpen}>
          {children}
        </Sheet>
      ) : (
        <SelectPrimitive.Root
          open={currentOpen}
          onOpenChange={setOpen}
          // exactOptionalPropertyTypes 下 `x: undefined` 与「没传」是两回事
          {...(currentValue !== undefined ? { value: currentValue } : {})}
          onValueChange={setValue}
          disabled={disabled}
          {...(name !== undefined ? { name } : {})}
          {...(required !== undefined ? { required } : {})}
        >
          {children}
        </SelectPrimitive.Root>
      )}
    </SelectCtx.Provider>
  );
}

/** 稳定引用的空函数 —— 写成内联箭头会每次渲染换新引用 */
function noop() {}

/* ── Trigger ─────────────────────────────────────────────────────────── */

export interface GlassSelectTriggerProps {
  className?: string;
  /** 无障碍名称。触发器的可见内容只是「当前值」，说不出这是**选什么**的。 */
  'aria-label'?: string;
  children?: React.ReactNode;
}

/**
 * 触发器的玻璃外观。
 *
 * ⚠️ 为什么不直接把 `<Button>` 塞进触发器里：本库禁用 `asChild`（registry-lint
 * 会拦），而把 Button 放进 Radix 的触发器就是 button 套 button —— Sheet 那一批
 * 已经踩过（SheetClose 因此改成直接渲染 Button）。所以这里把 Button 的材质层
 * **就地重写一遍**，几何常量指向同一批实测值。
 */
function TriggerChrome({ pressed, children }: { pressed: boolean; children: React.ReactNode }) {
  const radius = SELECT_GEOMETRY.triggerHeight / 2;
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  return (
    <>
      <GlassSurface
        layer={pressed ? 'indicator' : 'base'}
        radius={radius}
        pressed={pressed}
        // `.lg-surface` 自带 position: relative，定位必须走内联样式
        style={{ position: 'absolute', inset: 0 }}
      >
        {/*
          升级到 Layer I 时补回底座材质 —— 与 Button 同因，**这一层是可读性的命根子**：
          `.lg-surface[data-layer='indicator']` 的 background-color 是 transparent，
          α 归零则 C = a·F + (1−a)·B 的地板保证一起消失。
          触发器**自己就是**那层底座，与菜单里的高亮项（叠在面板之上）不是一回事。
        */}
        {pressed ? (
          <span
            aria-hidden="true"
            data-slot="select-trigger-legibility-fill"
            className="absolute inset-0 rounded-[inherit]"
            style={{ background: 'rgb(var(--lg-base-color) / var(--lg-base-alpha))' }}
          />
        ) : null}
        <motion.span
          aria-hidden="true"
          data-slot="select-trigger-dim"
          className="absolute inset-0 rounded-[inherit]"
          style={{ background: 'var(--lg-press-dim)' }}
          initial={false}
          animate={{ opacity: pressed ? 1 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      </GlassSurface>
      {/* 内容必须是定位元素，才画得到绝对定位的材质层之上 */}
      <span className="relative flex w-full items-center justify-between gap-2">{children}</span>
    </>
  );
}

/**
 * 提到模块级：`motion.create` 每次调用都产出新的组件类型，
 * 写在渲染函数里会让子树每次渲染都卸载重挂。
 */
const MotionSelectTrigger = motion.create(SelectPrimitive.Trigger);
const MotionSheetTrigger = motion.create(SheetTrigger);

function SelectTrigger({ className, children, ...props }: GlassSelectTriggerProps) {
  const ctx = useSelectCtx('SelectTrigger');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const [pressed, setPressed] = React.useState(false);

  /** 指针可能在别的元素上松开，按下态必须在 window 上收尾（与 Button 同） */
  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const height = SELECT_GEOMETRY.triggerHeight;
  const shared = {
    'data-slot': 'select-trigger',
    'data-pressed': pressed ? 'true' : undefined,
    className: cn(
      'relative inline-flex shrink-0 items-center outline-none select-none',
      'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-2',
      'focus-visible:ring-offset-transparent',
      'disabled:pointer-events-none disabled:opacity-40',
      className,
    ),
    style: {
      height,
      minWidth: SELECT_GEOMETRY.width,
      paddingInline: Math.round(height * SELECT_GEOMETRY.triggerPaddingRatio),
      borderRadius: height / 2,
      fontSize: SELECT_GEOMETRY.triggerLabelSize,
      color: 'var(--lg-label-primary)',
    } as MotionStyle,
    onPointerDown: () => setPressed(true),
    ...props,
  };

  const body = (
    <TriggerChrome pressed={pressed}>
      {children}
      <span aria-hidden="true" data-slot="select-trigger-chevron" className="shrink-0 opacity-60">
        <ChevronUpDownGlyph />
      </span>
    </TriggerChrome>
  );

  const animate = { scale: pressed ? SELECT_GEOMETRY.triggerPressScale : 1 };
  const transition = transitionFor('snappy', reducedMotion);

  if (ctx.compact) {
    return (
      <MotionSheetTrigger
        {...shared}
        /**
         * Dialog 触发器补上 combobox 语义。`aria-haspopup` 留 Radix 的 `dialog`
         * —— 它确实开的是 dialog，而 WAI-ARIA 1.2 的 combobox 允许这个取值。
         */
        role="combobox"
        disabled={ctx.disabled}
        initial={false}
        animate={animate}
        transition={transition}
      >
        {body}
      </MotionSheetTrigger>
    );
  }

  return (
    <MotionSelectTrigger {...shared} initial={false} animate={animate} transition={transition}>
      {body}
    </MotionSelectTrigger>
  );
}

/* ── Value ───────────────────────────────────────────────────────────── */

export interface GlassSelectValueProps {
  placeholder?: string;
  className?: string;
}

/**
 * 当前值。桌面路径直接用 Radix 的 `Select.Value`；
 * 移动路径没有这个原语，靠 Root 里的 value → 标签表自己渲染。
 */
function SelectValue({ placeholder, className }: GlassSelectValueProps) {
  const ctx = useSelectCtx('SelectValue');
  if (!ctx.compact) {
    return (
      <SelectPrimitive.Value
        data-slot="select-value"
        className={cn('truncate', className)}
        {...(placeholder !== undefined ? { placeholder } : {})}
      />
    );
  }
  const label = ctx.value === undefined ? undefined : ctx.labels.get(ctx.value);
  const empty = label === undefined;
  return (
    <span
      data-slot="select-value"
      data-placeholder={empty ? 'true' : undefined}
      className={cn('truncate', className)}
      style={empty ? { color: 'var(--lg-label-secondary)' } : undefined}
    >
      {empty ? (placeholder ?? '') : label}
    </span>
  );
}

/* ── 移动路径：listbox 的键盘导航 + typeahead ────────────────────────── */

function optionsOf(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')].filter(
    (el) => el.getAttribute('aria-disabled') !== 'true',
  );
}

/**
 * 移动路径 role=listbox 的键盘导航。**这是我们自己接的线**，
 * 桌面路径由 Radix 负责。
 *
 * 覆盖 ↑ ↓ Home End + **typeahead**（首字母跳转）。
 * DropdownMenu 那一批欠着 typeahead，这里还上了 —— 规则照 WAI-ARIA 的
 * listbox 模式：
 *   · 1s 无输入则清空缓冲；
 *   · 缓冲里全是同一个字母时按「循环下一个以它开头的项」处理，
 *     否则按整段前缀匹配（从当前项本身开始，拼词才不会一直往后跑）；
 *   · 空格只在缓冲非空时计入 —— 否则它得留给「选中当前项」。
 *
 * ⚠️ 用 `onKeyDown` 属性，**不要**写成 `useEffect` + ref 去 addEventListener：
 * 浮层在 Portal 里，effect 第一次跑时 ref 还是 null，而 ref 赋值不触发 effect
 * 重跑，监听器就永远装不上。（DropdownMenu 那一批在这上面栽过两次。）
 */
function useListboxKeyDown() {
  const bufferRef = React.useRef('');
  const timerRef = React.useRef(0);

  React.useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  return React.useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const root = e.currentTarget;
    const items = optionsOf(root);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      let next = 0;
      if (e.key === 'End') next = items.length - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
      else next = current <= 0 ? items.length - 1 : current - 1;
      items[next]?.focus();
      return;
    }

    /* ── typeahead ── */
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    // 空格要留给「选中当前项」，只有拼词中途才算字符
    if (e.key === ' ' && bufferRef.current === '') return;

    const buffer = bufferRef.current + e.key.toLowerCase();
    bufferRef.current = buffer;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      bufferRef.current = '';
    }, TYPEAHEAD_TIMEOUT);

    // 全是同一个字母 → 在以它开头的项之间循环（WAI-ARIA 的 listbox 模式）
    const repeated = buffer.length > 1 && new Set(buffer).size === 1;
    const needle = repeated ? buffer[0]! : buffer;
    const from = buffer.length === 1 || repeated ? current + 1 : current;
    const ordered = items.map((_, i) => items[(from + i + items.length) % items.length]!);
    const hit = ordered.find((el) => (el.textContent ?? '').trim().toLowerCase().startsWith(needle));
    if (hit) {
      e.preventDefault();
      hit.focus();
    }
  }, []);
}

/* ── Content ─────────────────────────────────────────────────────────── */

export interface GlassSelectContentProps {
  /**
   * 无障碍名称。**移动路径必填** —— Sheet 走 Radix Dialog，它要求必须有 Title。
   * 桌面路径落到面板的 `aria-label`：Radix Select 的 Content 是 listbox，
   * 与 menu 不同，**不会**自动由触发器命名，所以两条路径的名称在这里是一致的
   * （DropdownMenu 那边两条路径的名称不同，是 menu 模式使然，不要照抄结论）。
   */
  title: string;
  className?: string;
  children?: React.ReactNode;
  /** 面板宽度（px）。默认 250 = iOS 菜单实测宽度。 */
  width?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

function SelectContent({
  title,
  className,
  children,
  width = SELECT_GEOMETRY.width,
  side = 'bottom',
  align = 'start',
  sideOffset = SELECT_GEOMETRY.sideOffset,
}: GlassSelectContentProps) {
  const ctx = useSelectCtx('SelectContent');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const { compact, setPunch } = ctx;
  const onKeyDown = useListboxKeyDown();

  /**
   * 挖洞：把高亮项的位置同步给面板。
   *
   * 指示器嵌在磨砂面板里，不挖洞的话它折射到的是**被面板模糊过**的背景，
   * 等于没折射（Tabs 那批查出来的，STATUS §0.2）。
   *
   * ⚠️ 必须用**回调 ref**，不能用 `useEffect` + `panelRef.current`：
   * 浮层是 Radix Portal 里的东西，effect 第一次跑时面板还没挂上，
   * 而 ref 赋值不会触发 effect 重跑 —— observer 就永远装不上。
   *
   * 与 DropdownMenu 相比多两件事：
   *
   *   · Select 的视口**会滚动**（选项可能很多），Radix 换高亮项时会先改属性、
   *     再把它滚进视野，两件事不在同一帧 —— 除了 MutationObserver 还要听滚动，
   *     并在下一帧再对一次。
   *   · 洞的坐标必须相对 **`.lg-surface` 本体**、且要除掉入场动画的缩放。
   *     这两件事都交给 `measurePunch()`（原因写在 @glass/core 的 punch.ts 里，
   *     DropdownMenu 原来就是在这上面偏了一个内边距）。
   */
  const observerRef = React.useRef<MutationObserver | null>(null);
  const clearRafRef = React.useRef(0);
  const syncRafRef = React.useRef(0);
  const attachPanel = React.useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      cancelAnimationFrame(clearRafRef.current);
      cancelAnimationFrame(syncRafRef.current);
      if (!node || compact) {
        setPunch(null);
        return;
      }
      const sync = () => {
        const item = node.querySelector<HTMLElement>('[data-highlighted]');
        if (!item) {
          /**
           * 换项的一瞬间 Radix 会**先摘掉旧项**再给新项挂上，中间有一帧谁都没高亮。
           * 立刻收洞的话洞会跟着闪一下（DropdownMenu 那批在 CI 上抓到过这一帧）。
           * 等一帧再确认。
           */
          cancelAnimationFrame(clearRafRef.current);
          clearRafRef.current = requestAnimationFrame(() => {
            if (!node.querySelector('[data-highlighted]')) setPunch(null);
          });
          return;
        }
        cancelAnimationFrame(clearRafRef.current);
        const surface = node.closest<HTMLElement>('.lg-surface');
        if (surface) setPunch(measurePunch(surface, item, SELECT_GEOMETRY.itemRadius));
      };
      const syncSoon = () => {
        sync();
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = requestAnimationFrame(sync);
      };
      syncSoon();
      const mo = new MutationObserver(syncSoon);
      mo.observe(node, { subtree: true, attributes: true, attributeFilter: ['data-highlighted'] });
      observerRef.current = mo;
      // 滚动发生在内层视口上，不冒泡 —— 必须捕获
      node.addEventListener('scroll', syncSoon, { capture: true, passive: true });
    },
    [compact, setPunch],
  );

  /* ── 移动路径 ─────────────────────────────────────────────────────── */
  if (compact) {
    /**
     * Sheet 关着的时候把 children 渲染进一个**游离的 DocumentFragment**。
     * 目的只有一个：让 `SelectItem` 照常跑注册 effect，触发器才知道当前值
     * 该显示成什么文字。渲染进 fragment 的节点不在文档里，既不可见也不可聚焦。
     * （Radix Select 内部就是这么解决同一个问题的。）
     */
    if (!ctx.open) return <LabelRegistrar>{children}</LabelRegistrar>;
    return (
      <SheetContent
        data-glass-select="content"
        className={className}
        /**
         * 打开时把焦点交给**当前选中项**（没有选中就交给第一项）。
         * 不接管的话 Sheet 会把焦点放在面板本身，方向键与 typeahead 都要多按一次。
         */
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const root = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
            '[role="listbox"]',
          );
          if (!root) return;
          const items = optionsOf(root);
          const selected = items.find((el) => el.getAttribute('aria-selected') === 'true');
          (selected ?? items[0])?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div
            role="listbox"
            aria-label={title}
            data-slot="select-listbox"
            className="flex flex-col"
            onKeyDown={onKeyDown}
          >
            {children}
          </div>
        </SheetBody>
      </SheetContent>
    );
  }

  /* ── 桌面路径 ─────────────────────────────────────────────────────── */
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-glass-select="content"
        position="popper"
        side={side}
        align={align}
        sideOffset={sideOffset}
        aria-label={title}
        className={cn('z-50 outline-none', className)}
        style={{ width }}
      >
        <motion.div
          data-slot="select-panel"
          // 从触发器那一侧长出来：Radix 把落位算好后写进这个变量
          className="origin-[var(--radix-select-content-transform-origin)]"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transitionFor('snappy', reducedMotion)}
        >
          <GlassSurface
            layer="elevated"
            radius={SELECT_GEOMETRY.radius}
            continuous
            punch={ctx.punch}
            className="relative isolate"
            style={{
              paddingBlock: SELECT_GEOMETRY.paddingBlock,
              paddingInline: SELECT_GEOMETRY.paddingInline,
              maxHeight: 'var(--radix-select-content-available-height)',
            }}
          >
            <div ref={attachPanel} className="relative flex flex-col">
              <SelectPrimitive.Viewport data-slot="select-viewport">
                {children}
              </SelectPrimitive.Viewport>
            </div>
          </GlassSurface>
        </motion.div>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * 只为注册 value → 标签的隐形挂载点（移动路径、Sheet 关着时）。
 * 拆成组件是为了让 ref 与 `createPortal` 有个稳定的宿主，
 * 同时把「SSR 时没有 document」这件事收在一处。
 */
function LabelRegistrar({ children }: { children?: React.ReactNode }) {
  const fragRef = React.useRef<DocumentFragment | null>(null);
  if (fragRef.current === null && typeof document !== 'undefined') {
    fragRef.current = document.createDocumentFragment();
  }
  if (!fragRef.current) return null;
  return createPortal(<div hidden>{children}</div>, fragRef.current);
}

/* ── Item ────────────────────────────────────────────────────────────── */

export interface GlassSelectItemProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /**
   * 触发器上显示的文字。默认取 `children` 的纯文本；
   * children 里有图标之类的非文本内容时传这个。
   */
  textValue?: string;
}

function SelectItem({ value, children, className, disabled, textValue }: GlassSelectItemProps) {
  const ctx = useSelectCtx('SelectItem');
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  /**
   * 高亮态跟着**焦点**走 —— Radix 的 listbox 也是 roving focus，
   * `data-highlighted` 与「这一项被 focus」是同一件事。
   * （面板那边挖洞仍然听 `data-highlighted`：一个 observer 管整棵子树。）
   */
  const [highlighted, setHighlighted] = React.useState(false);
  const selected = ctx.value === value;

  /** 注册标签，供移动路径的触发器显示当前值 */
  const label = textValue ?? (typeof children === 'string' ? children : undefined);
  const itemRef = React.useRef<HTMLElement | null>(null);
  const { registerLabel } = ctx;
  React.useEffect(() => {
    // children 不是纯字符串时退回读 DOM 文本 —— fragment 里的节点也读得到
    const text = label ?? itemRef.current?.textContent?.trim();
    if (text) registerLabel(value, text);
  }, [label, value, registerLabel]);

  const style: React.CSSProperties = {
    minHeight: SELECT_GEOMETRY.itemHeight,
    fontSize: SELECT_GEOMETRY.fontSize,
    borderRadius: SELECT_GEOMETRY.itemRadius,
    paddingInline: SELECT_GEOMETRY.itemInset,
    color: 'var(--lg-label-primary)',
  };
  const base = cn(
    'relative flex w-full items-center text-left outline-none select-none',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
    'aria-disabled:pointer-events-none aria-disabled:opacity-40',
    className,
  );

  /**
   * 前导图标列。**28×20 是实测的**（Figma 的 Item → Leading → Symbol），
   * 对勾画在这一列里是 `[推定]`（依据 UIKit 的 `.on` 状态占 image 槽位）。
   * 列**永远占位**，不是选中才出现 —— 否则选中/未选中的标签会横向跳。
   */
  const indicator = (
    <span
      data-slot="select-item-indicator"
      data-selected={selected ? 'true' : undefined}
      className="relative flex shrink-0 items-center justify-center"
      style={{
        width: SELECT_GEOMETRY.symbolWidth,
        height: SELECT_GEOMETRY.symbolHeight,
        marginInlineEnd: SELECT_GEOMETRY.symbolGap,
      }}
    >
      {/* 颜色继承 label 色，`[推定]` —— 见文件头 */}
      {selected ? <CheckGlyph /> : null}
    </span>
  );

  /* 移动路径：项不是 Layer I —— Drawer 里没有悬停，高亮只是焦点提示 */
  if (ctx.compact) {
    return (
      <button
        ref={itemRef as React.RefObject<HTMLButtonElement>}
        type="button"
        role="option"
        data-slot="select-item"
        aria-selected={selected}
        aria-disabled={disabled ? 'true' : undefined}
        className={cn(base, 'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]')}
        style={style}
        onClick={() => {
          if (disabled) return;
          ctx.setValue(value);
          ctx.setOpen(false);
        }}
      >
        {indicator}
        <span className="truncate">{children}</span>
      </button>
    );
  }

  return (
    <SelectPrimitive.Item
      ref={itemRef as React.RefObject<HTMLDivElement>}
      value={value}
      data-slot="select-item"
      {...(disabled !== undefined ? { disabled } : {})}
      {...(textValue !== undefined ? { textValue } : {})}
      className={base}
      style={style}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
    >
      {/*
        Layer I 高亮项。面板按同一块矩形挖了洞，折射才看得到未被模糊的背景。

        ⚠️ 与触发器按下态**不同**：触发器必须补回底色（它自己就是那层底座，
        α 归零标签就没背景了）。这里高亮项是**叠在面板材质之上**的，
        面板底色仍在标签背后 —— 与 Tabs 的指示器、DropdownMenu 的高亮项同理。
        所以这里不补底色，让折射与色散真的显形。
        scripts/press-legibility.mjs 里这两条各有一个测点。
      */}
      <motion.span
        aria-hidden="true"
        data-slot="select-item-highlight"
        className="absolute inset-0 -z-10"
        initial={false}
        animate={{ opacity: highlighted ? 1 : 0 }}
        transition={transitionFor('smooth', reducedMotion)}
      >
        <GlassSurface
          layer="indicator"
          radius={SELECT_GEOMETRY.itemRadius}
          className="h-full w-full"
        />
      </motion.span>
      {indicator}
      <SelectPrimitive.ItemText>
        <span className="relative truncate">{children}</span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/* ── Separator / Label / Group ───────────────────────────────────────── */

export interface GlassSelectSeparatorProps {
  className?: string;
}

/**
 * 分隔区。**不是一条线，是一块 21pt 高的区域**，线在区顶 +2 处。
 * 这个偏移量是量出来的（两条分隔线独立复核一致），不是居中。
 */
function SelectSeparator({ className }: GlassSelectSeparatorProps) {
  const { compact } = useSelectCtx('SelectSeparator');
  const Comp = compact ? 'div' : SelectPrimitive.Separator;
  return (
    <Comp
      data-slot="select-separator"
      className={cn('relative', className)}
      style={{ height: SELECT_GEOMETRY.separatorZone }}
    >
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          top: SELECT_GEOMETRY.separatorOffset,
          left: SELECT_GEOMETRY.separatorInset,
          right: SELECT_GEOMETRY.separatorInset,
          height: 1,
          background: 'var(--lg-separator)',
        }}
      />
    </Comp>
  );
}

export interface GlassSelectLabelProps {
  children?: React.ReactNode;
  className?: string;
}

function SelectLabel({ children, className }: GlassSelectLabelProps) {
  const { compact } = useSelectCtx('SelectLabel');
  const Comp = compact ? 'div' : SelectPrimitive.Label;
  return (
    <Comp
      data-slot="select-label"
      className={cn('flex items-center', className)}
      style={{
        minHeight: SELECT_GEOMETRY.itemHeight,
        paddingInline: SELECT_GEOMETRY.itemInset,
        // 15 = subheadline，`[待核实]`（apple-metrics §6 没找到 Apple 出处）
        fontSize: 15,
        color: 'var(--lg-label-secondary)',
      }}
    >
      {children}
    </Comp>
  );
}

export interface GlassSelectGroupProps {
  children?: React.ReactNode;
  className?: string;
}

function SelectGroup({ children, className }: GlassSelectGroupProps) {
  const { compact } = useSelectCtx('SelectGroup');
  const Comp = compact ? 'div' : SelectPrimitive.Group;
  return (
    <Comp data-slot="select-group" className={cn('flex flex-col', className)}>
      {children}
    </Comp>
  );
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
};
