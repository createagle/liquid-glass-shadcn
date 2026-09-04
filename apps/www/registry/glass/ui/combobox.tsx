'use client';

// APPLE REFERENCE: macOS 27 NSComboBox（「Combo Boxes」页，节点 `121:11951`）
//
// 测量见 docs/research/apple-metrics.md §14.6。
//
// ── iOS 没有这个控件，只能取 macOS ────────────────────────────────────
//
//   与 Checkbox / Radio 是同一种情况（见 component-inventory 修订三）：
//   iOS 上没有「可输入的下拉框」这个东西 —— UIPickerView 是滚轮，不能打字。
//   所以参考只能是 macOS 的 NSComboBox。
//
// ── ⚠️ 取结构与状态，**不取尺度** ──────────────────────────────────────
//
//   macOS 那份是鼠标语境的：控件 24 高、字号 13、下拉按钮 24×20。
//   本库基准是 iOS —— 控件 44（HIG 最小触控目标）、正文 17。
//   照抄 24 高会得到一个在整个库里格格不入、而且点不中的控件。
//
//   所以这里的做法与 §13.4 处理 macOS 侧栏行高一致：
//
//     结构  文本域 + 尾部下拉按钮 + 弹出列表      ← macOS 实测
//     状态  idle / 输入中 / 按钮按下 / 禁用       ← macOS 实测
//     配比  按钮底 0.08 → 0.16（按下）→ 0.04（禁用）  ← macOS 实测
//     尺度  高 44 / 字号 17 / 内边距                ← **借本库的 Input**，[推定]
//
//   每个常量上都标了它属于哪一类，不要混着读。
//
// ── 无障碍：ARIA 1.2 combobox 模式，全部手写 ──────────────────────────
//
//   Radix 没有 combobox 原语；shadcn 是用 Popover + cmdk 拼的，本库两样都没有。
//   所以 `role="combobox"` / `aria-expanded` / `aria-controls` /
//   `aria-activedescendant` / 方向键 / Enter / Escape 全是本文件自己接的。
//
//   ⚠️ 关键一条：**焦点始终留在输入框上**，靠 `aria-activedescendant`
//   指向高亮项，而不是把焦点挪进列表。焦点一旦离开输入框，
//   用户就没法继续打字了 —— 这正是 combobox 与 listbox 的分野。
//
// ⚠️ 分层：文本域 = 内容层（与 Input 的 field 一致）；弹出列表 = **Layer B**。

import * as React from 'react';
import { GlassSurface } from '@glass/core';
import { cn } from '@/lib/utils';

export const COMBOBOX_GEOMETRY = {
  /** 控件高（px）。`[推定]` —— 借本库 Input 的 field 变体 44（macOS 那份是 24） */
  height: 44,
  /** 左内边距（px）。`[推定]` —— 借 Input 的 0.25 × 高 */
  paddingLeft: 11,
  /** 右内边距（px）。`[推定]` —— 给按钮让位；macOS 是 28 对 24 高，按比例放大 */
  paddingRight: 48,
  /** 文本域圆角（px）。[实测] macOS 是 6 —— 这一档与尺度无关，直接用 */
  fieldRadius: 6,
  /** 下拉按钮宽 × 高（px）。`[推定]` —— macOS 是 24×20 对 24 高，按比例放大 */
  button: { w: 36, h: 32 },
  /** 下拉按钮圆角（px）。`[推定]` —— macOS 是 4.5 对 24×20，按比例放大 */
  buttonRadius: 8,
  /** 按钮距右边缘（px）。[实测] macOS 是 2 */
  buttonInset: 2,
  /** 字号（px）。`[推定]` —— 借本库正文 17（macOS 那份是 13 Medium） */
  fontSize: 17,
  /** 列表项高（px）。`[推定]` —— 借 DropdownMenu 实测的 40 */
  itemHeight: 40,
  /** 列表圆角（px）。`[推定]` —— 借 DropdownMenu 实测的 34 */
  listRadius: 34,
  /** 列表上下内边距（px）。`[推定]` —— 借 DropdownMenu 实测的 10 */
  listPaddingBlock: 10,
  /** 列表左右内边距（px）。`[推定]` —— 借 DropdownMenu 实测的 16 */
  listPaddingInline: 16,
  /** 列表项圆角（px）。`[推定]` —— 借 DropdownMenu 的 10（那一条本身也是推定） */
  itemRadius: 10,
  /** 列表与控件的间距（px）。`[推定]` —— 借 Popover 的 8（那一条本身也是推定） */
  listOffset: 8,
  /** 列表最大高（px）。`[推定]` —— 无来源，取 6 项 + 内边距 */
  listMaxHeight: 6 * 40 + 20,
} as const;

const BUTTON_FILL = {
  /** 下拉按钮静止底色。[实测] macOS `#000000 @ 0.08` */
  idle: 'rgb(0 0 0 / 0.08)',
  /** 下拉按钮按下 / 展开中的底色。[实测] macOS `#000000 @ 0.16` */
  active: 'rgb(0 0 0 / 0.16)',
  /** 下拉按钮禁用底色。[实测] macOS `#000000 @ 0.04` */
  disabled: 'rgb(0 0 0 / 0.04)',
} as const;

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface GlassComboboxProps
  extends Omit<React.ComponentProps<'div'>, 'onChange' | 'defaultValue'> {
  options: readonly ComboboxOption[];
  /** 受控值（选项的 `value`）。 */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 无障碍名称。没有可见 `<label>` 时必须传。 */
  'aria-label'?: string;
  /**
   * 过滤函数。默认是大小写不敏感的子串匹配。
   *
   * ⚠️ 默认实现**不做**拼音 / 模糊 / 权重排序 —— 那是 `Command` 的活，
   * 而 `Command` 本批没做。这里只做最朴素的一种，别指望它。
   */
  filter?: (option: ComboboxOption, query: string) => boolean;
}

const defaultFilter = (o: ComboboxOption, q: string) =>
  o.label.toLowerCase().includes(q.toLowerCase());

function Combobox({
  className,
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  placeholder = '',
  disabled = false,
  filter = defaultFilter,
  'aria-label': ariaLabel,
  ...props
}: GlassComboboxProps) {
  const id = React.useId();
  const listId = `${id}-list`;

  const [selfValue, setSelfValue] = React.useState<string | null>(defaultValue);
  const value = valueProp !== undefined ? valueProp : selfValue;

  const selectedLabel = React.useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [buttonDown, setButtonDown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /*
   * 输入框显示什么：
   *   合起来 → 选中项的标签
   *   展开中 → 用户正在打的字（还没打就先显示选中项的标签）
   * 两者分开存，是为了「打了半截又按 Escape」时能原样还原。
   */
  const shown = open ? query : selectedLabel;

  const visible = React.useMemo(
    () => (open && query !== '' ? options.filter((o) => filter(o, query)) : options),
    [open, query, options, filter],
  );

  const commit = React.useCallback(
    (option: ComboboxOption) => {
      if (option.disabled) return;
      if (valueProp === undefined) setSelfValue(option.value);
      onValueChange?.(option.value);
      setOpen(false);
      setQuery('');
    },
    [valueProp, onValueChange],
  );

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    const i = visible.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  };

  const move = (delta: number) => {
    if (visible.length === 0) return;
    let next = active;
    for (let step = 0; step < visible.length; step += 1) {
      next = (next + delta + visible.length) % visible.length;
      if (!visible[next]?.disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && open) {
      const option = visible[active];
      if (option) {
        event.preventDefault();
        commit(option);
      }
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : visible.length - 1);
    }
  };

  /*
   * 点外面关掉。
   *
   * ⚠️ 监听 `pointerdown` 而不是 `click`：`click` 要等到 mouseup，
   * 期间输入框已经失焦，列表会先闪一下再关。
   * 也不能只靠输入框的 `blur` —— 点列表项本身也会触发 blur，那样永远选不中。
   */
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const activeId = open && visible[active] ? `${id}-opt-${visible[active]!.value}` : undefined;

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-block', className)}
      {...props}
      data-slot="combobox"
      data-state={open ? 'open' : 'closed'}
    >
      <input
        ref={inputRef}
        role="combobox"
        type="text"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(activeId ? { 'aria-activedescendant': activeId } : {})}
        disabled={disabled}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setQuery('')}
        /*
         * 点输入框就展开 —— combobox 的常规行为。
         * ⚠️ 已经展开时**不要**再 openList()：那会把用户打了一半的字清掉。
         */
        onClick={() => {
          if (!open) openList();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full bg-[var(--lg-card-fill)] text-[var(--lg-label-primary)] outline-none',
          'placeholder:text-[var(--lg-label-tertiary)]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lg-ring)]',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
        style={{
          height: COMBOBOX_GEOMETRY.height,
          borderRadius: COMBOBOX_GEOMETRY.fieldRadius,
          paddingLeft: COMBOBOX_GEOMETRY.paddingLeft,
          paddingRight: COMBOBOX_GEOMETRY.paddingRight,
          fontSize: COMBOBOX_GEOMETRY.fontSize,
          // [实测] macOS 的文本域是 1px 描边 + 极淡投影，这里只取描边
          boxShadow: 'inset 0 0 0 1px var(--lg-separator)',
        }}
        data-slot="combobox-input"
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label="展开选项"
        disabled={disabled}
        onPointerDown={(e) => {
          // 别让按钮抢走输入框的焦点 —— 抢走了就没法继续打字
          e.preventDefault();
          setButtonDown(true);
        }}
        onPointerUp={() => setButtonDown(false)}
        onPointerLeave={() => setButtonDown(false)}
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery('');
          } else {
            openList();
          }
          inputRef.current?.focus();
        }}
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors duration-100"
        style={{
          insetInlineEnd: COMBOBOX_GEOMETRY.buttonInset,
          width: COMBOBOX_GEOMETRY.button.w,
          height: COMBOBOX_GEOMETRY.button.h,
          borderRadius: COMBOBOX_GEOMETRY.buttonRadius,
          // [实测] macOS 的三档底色
          backgroundColor: disabled
            ? BUTTON_FILL.disabled
            : buttonDown || open
              ? BUTTON_FILL.active
              : BUTTON_FILL.idle,
          color: 'var(--lg-label-primary)',
          opacity: disabled ? 0.4 : 1,
        }}
        data-slot="combobox-button"
        data-active={buttonDown || open ? 'true' : undefined}
      >
        {/* 自己画的 chevron —— 资源里是 SF Symbols 的私有区码位，Web 上是豆腐块 */}
        <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden="true">
          <path
            d="M1.5 1.5L5.5 5.5L9.5 1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <GlassSurface
          layer="elevated"
          radius={COMBOBOX_GEOMETRY.listRadius}
          continuous
          className="absolute start-0 z-50 w-full overflow-auto"
          style={{
            top: `calc(100% + ${COMBOBOX_GEOMETRY.listOffset}px)`,
            maxHeight: COMBOBOX_GEOMETRY.listMaxHeight,
            paddingBlock: COMBOBOX_GEOMETRY.listPaddingBlock,
            paddingInline: COMBOBOX_GEOMETRY.listPaddingInline,
          }}
          data-slot="combobox-list-surface"
        >
          <ul id={listId} role="listbox" {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
            {visible.length === 0 ? (
              <li
                className="flex items-center text-[var(--lg-label-tertiary)]"
                style={{
                  minHeight: COMBOBOX_GEOMETRY.itemHeight,
                  fontSize: COMBOBOX_GEOMETRY.fontSize,
                }}
                data-slot="combobox-empty"
              >
                无匹配项
              </li>
            ) : (
              visible.map((option, i) => (
                <li
                  key={option.value}
                  id={`${id}-opt-${option.value}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => commit(option)}
                  onPointerEnter={() => !option.disabled && setActive(i)}
                  className={cn(
                    'flex cursor-default items-center transition-colors duration-100',
                    'text-[var(--lg-label-primary)]',
                    option.disabled && 'pointer-events-none opacity-40',
                  )}
                  style={{
                    minHeight: COMBOBOX_GEOMETRY.itemHeight,
                    borderRadius: COMBOBOX_GEOMETRY.itemRadius,
                    paddingInline: 8,
                    fontSize: COMBOBOX_GEOMETRY.fontSize,
                    backgroundColor: i === active ? 'var(--lg-fill-tertiary)' : 'transparent',
                  }}
                  data-slot="combobox-option"
                  data-active={i === active ? 'true' : undefined}
                  data-selected={option.value === value ? 'true' : undefined}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        </GlassSurface>
      ) : null}
    </div>
  );
}

export { Combobox };
