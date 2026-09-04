'use client';

// APPLE REFERENCE: UICalendarView / SwiftUI `DatePicker(.graphical)`
//                  （iOS 27「Date and Time Pickers」页）
//
// 节点 `5442:1885`（Pickers，Inline / Compact 两个变体）、`50:63907`（_Day，5 状态）、
// `50:63951`（_Week）、`5442:1477`（Calendar）。测量见 apple-metrics.md §14.1–14.4。
//
// ── ❗ 这个组件不上玻璃，而且这次**有 Apple 自证** ────────────────────
//
//   资源里同一个日历有两个变体，材质**不一样**：
//
//     Style=Inline    嵌在内容里  →  **纯白不透明**，左右内边距 16
//     Style=Compact   弹出层      →  **玻璃**（Material，圆角 13），左右内边距 12
//
//   PROJECT_SPEC §2 说「内容型组件不堆玻璃，材质属于控件层」——
//   这一条通常只能靠推理落实，这次资源直接给了证据：**同一个日历，
//   嵌进内容就是白的，浮起来才是玻璃。**
//
//   所以 `<Calendar>`（本文件）是**内容层**，一句玻璃都没有；
//   玻璃在 `<DatePicker>` 的弹层上，那边才是 Compact 变体的对应物。
//
// ── 为什么自己写网格，不引 react-day-picker ────────────────────────────
//
//   shadcn 的 Calendar 是 react-day-picker 的皮肤。本库不引它，两个原因：
//
//   1. 几何是**全实测**的（格 38 正圆、横向节距 50、纵向间距 7、
//      表头 Semibold 13）。套在别人的 DOM 上要靠一层层选择器去够，
//      而本库的规矩是「组件里禁止魔法数字，一律走常量」—— 够不到就得写死。
//   2. 它自带一套 class 命名与 `components` 覆写协议，与本库的
//      `data-slot` 约定是两套东西，混在一起调用方要同时学两份。
//
//   代价：键盘导航、月份切换、闰年边界全部是**本库自己写的**，
//   出 bug 也是本库的。测试因此把这些逐条钉住。
//
// ── ⚠️ 选中态是**黑底白字**，不是主题蓝 ────────────────────────────────
//
//   实测：Selected = 实心 `#000000` + 白字 Semibold；
//   只有「今天且被选中」才是实心 `#0088ff`。
//   多数 Web 日历把选中画成主题色，这里**刻意不跟**。

import * as React from 'react';
import { cn } from '@/lib/utils';

export const CALENDAR_GEOMETRY = {
  /** 日期格边长（px）。[实测] 38，正圆 */
  cell: 38,
  /** 横向节距（px）。[实测] 50 —— 格 38，间隙 12 */
  columnPitch: 50,
  /** 周与周之间的间距（px）。[实测] 7 —— Calendar 帧的 auto-layout itemSpacing */
  rowGap: 7,
  /** 网格上内边距（px）。[实测] 3 */
  gridPaddingTop: 3,
  /** 日期字号（px）。[实测] 20 */
  dayFontSize: 20,
  /** 日期行高（px）。[实测] 24 */
  dayLineHeight: 24,
  /** 日期字距（px）。[实测] −0.45（选中态为 0） */
  dayLetterSpacing: -0.45,
  /** 星期表头高（px）。[实测] 20 */
  weekdayHeight: 20,
  /** 星期缩写字号（px）。[实测] 13 Semibold */
  weekdayFontSize: 13,
  /** 星期缩写行高（px）。[实测] 18 */
  weekdayLineHeight: 18,
  /** 月份行高（px）。[实测] 40 */
  headerHeight: 40,
  /** 月份行内边距。[实测] 上 13 / 右 6 / 下 3 / 左 8 */
  headerPadding: { top: 13, right: 6, bottom: 3, left: 8 },
  /** 月 + 年的字号（px）。[实测] 17 Semibold */
  titleFontSize: 17,
  /** 月 + 年的行高（px）。[实测] 22 */
  titleLineHeight: 22,
  /** 上/下月箭头的命中框（px）。[实测] 15 × 24 */
  arrow: { w: 15, h: 24 },
  /** 两个箭头之间的间距（px）。[实测] 28 */
  arrowGap: 28,
  /** 表头与网格之间的间距（px）。[实测] 4 */
  headerGap: 4,
  /** 主体上下内边距（px）。[实测] 8 */
  bodyPaddingBlock: 8,
  /** 嵌入形态的左右内边距（px）。[实测] 16（弹层形态是 12，见 date-picker.tsx） */
  paddingInline: 16,
  /** 一周的列数。[实测] 资源里 `_Week` 就是 7 格 —— 同时也是公历事实 */
  columns: 7,
} as const;

/** 一周 7 天 + 6 行的网格宽（px）。[实测] 338 = 6 × 50 + 38 */
export const CALENDAR_WIDTH =
  (CALENDAR_GEOMETRY.columns - 1) * CALENDAR_GEOMETRY.columnPitch + CALENDAR_GEOMETRY.cell;

/* ── 日期工具 ─────────────────────────────────────────────────────────
   全部按**本地时区**处理。刻意不引 date-fns 之类 —— 这里只用到四个操作，
   而多一个依赖就多一份要随 registry 分发的东西。 */

/** 同一天？只比年月日，忽略时分秒。 */
export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 当月 1 号。传进来的时分秒一律丢掉。 */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  /*
   * ⚠️ 必须从**当月 1 号**起算。直接 `setMonth` 会在「1 月 31 日 + 1 月」
   * 这种输入上溢出成 3 月 3 日 —— 月份切换按钮点几下就跑到别的月去了。
   */
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * 生成当月的网格。
 *
 * 返回**扁平**的 42 格（6 行 × 7 列）—— 行数固定，切换月份时面板高度不跳。
 * 非本月的格子是 `null`，对应资源里的 `State=Null`（整格什么都不画）。
 */
function buildGrid(month: Date, firstDayOfWeek: number): (Date | null)[] {
  const first = startOfMonth(month);
  const lead = (first.getDay() - firstDayOfWeek + 7) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

/* ── 组件 ─────────────────────────────────────────────────────────────── */

export interface GlassCalendarProps
  extends Omit<React.ComponentProps<'div'>, 'onSelect' | 'defaultValue'> {
  /** 受控选中日期。传 `null` = 没有选中。 */
  selected?: Date | null;
  /** 非受控初值。 */
  defaultSelected?: Date | null;
  onSelect?: (date: Date) => void;
  /** 受控显示月份。 */
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /**
   * 「今天」是哪天。默认 `new Date()`。
   *
   * ⚠️ **测试与快照必须传死值。** 默认值随时钟走，
   * 视觉回归会在过日期的那一晚自己红掉。
   */
  today?: Date;
  /** 一周从周几开始。0 = 周日（[实测] 资源里就是周日打头）。 */
  firstDayOfWeek?: number;
  /**
   * 月份标题与星期缩写的语言。
   *
   * ⚠️ **默认写死 `'en-US'`，不用运行时默认语言。** 后者在服务端与浏览器上
   * 可能不同，`Intl` 输出跟着不同，直接就是一次 hydration mismatch。
   * 要本地化就显式传 —— 那时两端传的是同一个值，才是安全的。
   */
  locale?: string;
  /** 某天是否不可选。 */
  disabled?: (date: Date) => boolean;
}

function Calendar({
  className,
  style,
  selected: selectedProp,
  defaultSelected = null,
  onSelect,
  month: monthProp,
  onMonthChange,
  today,
  firstDayOfWeek = 0,
  locale = 'en-US',
  disabled,
  ...props
}: GlassCalendarProps) {
  const [selfSelected, setSelfSelected] = React.useState<Date | null>(defaultSelected);
  const selected = selectedProp !== undefined ? selectedProp : selfSelected;

  const [selfMonth, setSelfMonth] = React.useState<Date>(() =>
    startOfMonth(selected ?? today ?? new Date()),
  );
  const month = monthProp ?? selfMonth;

  /*
   * `today` 默认值只在挂载时取一次。每次 render 都 new 一个的话，
   * 依赖它的 memo 每帧都失效，而且跨零点会在半路换值。
   */
  const [fallbackToday] = React.useState(() => new Date());
  const now = today ?? fallbackToday;

  const setMonth = React.useCallback(
    (next: Date) => {
      if (monthProp === undefined) setSelfMonth(next);
      onMonthChange?.(next);
    },
    [monthProp, onMonthChange],
  );

  const pick = React.useCallback(
    (date: Date) => {
      if (selectedProp === undefined) setSelfSelected(date);
      onSelect?.(date);
    },
    [selectedProp, onSelect],
  );

  const weeks = React.useMemo(() => {
    const flat = buildGrid(month, firstDayOfWeek);
    return Array.from({ length: 6 }, (_, i) => flat.slice(i * 7, i * 7 + 7));
  }, [month, firstDayOfWeek]);

  const weekdays = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-07 是个周日，用它当基准数七天出来
    const sunday = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(addDays(sunday, (i + firstDayOfWeek) % 7)).toUpperCase(),
    );
  }, [locale, firstDayOfWeek]);

  const title = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month),
    [locale, month],
  );

  /**
   * 网格里当前可聚焦的那一格（roving tabindex）。
   *
   * ⚠️ **整块网格只有一个 tab stop。** 42 个格子各自可聚焦的话，
   * 键盘用户要按 42 次 Tab 才能走过一个月 —— 这是 ARIA grid 模式的要求，
   * 也是本库 RadioGroup 那批已经踩熟的一条。
   */
  const [focusDay, setFocusDay] = React.useState<number | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  /** 当月里哪一格拿 `tabIndex=0`：优先选中日 → 今天 → 1 号。 */
  const inThisMonth = (d: Date | null | undefined) =>
    !!d && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  const activeDay =
    focusDay ??
    (inThisMonth(selected) ? selected!.getDate() : inThisMonth(now) ? now.getDate() : 1);

  const moveFocus = React.useCallback(
    (from: Date, delta: number) => {
      const next = addDays(from, delta);
      if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
        setMonth(startOfMonth(next));
      }
      setFocusDay(next.getDate());
      /*
       * 焦点要等新的一格渲染出来才挪得过去 —— 跨月时那一格这一帧还不存在。
       * 用 rAF 而不是 setTimeout(0)：后者会在浏览器已经绘制之后才跑，看得见跳一下。
       */
      requestAnimationFrame(() => {
        const el = gridRef.current?.querySelector<HTMLElement>(
          `[data-day="${next.getFullYear()}-${next.getMonth()}-${next.getDate()}"]`,
        );
        el?.focus();
      });
    },
    [month, setMonth],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const iso = target.dataset['day'];
    if (!iso) return;
    const parts = iso.split('-').map(Number);
    const current = new Date(parts[0]!, parts[1]!, parts[2]!);
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = step[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveFocus(current, delta);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const dow = (current.getDay() - firstDayOfWeek + 7) % 7;
      moveFocus(current, event.key === 'Home' ? -dow : 6 - dow);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setMonth(addMonths(month, event.key === 'PageUp' ? -1 : 1));
      setFocusDay(null);
    }
  };

  return (
    <div
      className={cn('inline-flex flex-col', className)}
      style={{ paddingInline: CALENDAR_GEOMETRY.paddingInline, ...style }}
      {...props}
      data-slot="calendar"
    >
      {/* ── 月份行 ── */}
      <div
        className="flex items-center justify-between"
        style={{
          height: CALENDAR_GEOMETRY.headerHeight,
          paddingTop: CALENDAR_GEOMETRY.headerPadding.top,
          paddingRight: CALENDAR_GEOMETRY.headerPadding.right,
          paddingBottom: CALENDAR_GEOMETRY.headerPadding.bottom,
          paddingLeft: CALENDAR_GEOMETRY.headerPadding.left,
        }}
        data-slot="calendar-header"
      >
        <span
          aria-live="polite"
          className="text-[var(--lg-label-primary)]"
          style={{
            fontSize: CALENDAR_GEOMETRY.titleFontSize,
            lineHeight: `${CALENDAR_GEOMETRY.titleLineHeight}px`,
            letterSpacing: -0.43,
            fontWeight: 600,
          }}
          data-slot="calendar-title"
        >
          {title}
        </span>
        <span className="flex items-center" style={{ gap: CALENDAR_GEOMETRY.arrowGap }}>
          <ArrowButton dir="prev" onClick={() => setMonth(addMonths(month, -1))} />
          <ArrowButton dir="next" onClick={() => setMonth(addMonths(month, 1))} />
        </span>
      </div>

      {/* ── 主体 ── */}
      <div
        className="flex flex-col"
        style={{
          paddingBlock: CALENDAR_GEOMETRY.bodyPaddingBlock,
          gap: CALENDAR_GEOMETRY.headerGap,
        }}
      >
        <div
          aria-hidden="true"
          className="grid"
          style={{
            height: CALENDAR_GEOMETRY.weekdayHeight,
            width: CALENDAR_WIDTH,
            gridTemplateColumns: `repeat(7, ${CALENDAR_GEOMETRY.cell}px)`,
            columnGap: CALENDAR_GEOMETRY.columnPitch - CALENDAR_GEOMETRY.cell,
          }}
          data-slot="calendar-weekdays"
        >
          {weekdays.map((w) => (
            <span
              key={w}
              className="text-center text-[var(--lg-label-tertiary)]"
              style={{
                fontSize: CALENDAR_GEOMETRY.weekdayFontSize,
                lineHeight: `${CALENDAR_GEOMETRY.weekdayLineHeight}px`,
                fontWeight: 600,
              }}
            >
              {w}
            </span>
          ))}
        </div>

        <div
          ref={gridRef}
          role="grid"
          aria-label={title}
          onKeyDown={onKeyDown}
          className="grid"
          style={{
            width: CALENDAR_WIDTH,
            paddingTop: CALENDAR_GEOMETRY.gridPaddingTop,
            gridTemplateColumns: `repeat(7, ${CALENDAR_GEOMETRY.cell}px)`,
            columnGap: CALENDAR_GEOMETRY.columnPitch - CALENDAR_GEOMETRY.cell,
            rowGap: CALENDAR_GEOMETRY.rowGap,
          }}
          data-slot="calendar-grid"
        >
          {/*
            ⚠️ `role="grid"` 的孩子**必须**是 `role="row"`，不能直接放 gridcell。
            但插一层真实的 div 会把 CSS Grid 的列切断 —— 解法是
            `display: contents`：行在无障碍树里存在，在布局里不存在。
          */}
          {weeks.map((week, w) => (
            <div key={w} role="row" style={{ display: 'contents' }}>
              {week.map((date, i) =>
                date === null ? (
                  // State=Null —— 资源里整格什么都不画
                  <span
                    key={`empty-${w}-${i}`}
                    role="gridcell"
                    aria-hidden="true"
                    style={{ height: CALENDAR_GEOMETRY.cell }}
                  />
                ) : (
                  <DayCell
                    key={date.getTime()}
                    date={date}
                    selected={isSameDay(date, selected)}
                    current={isSameDay(date, now)}
                    disabled={disabled?.(date) ?? false}
                    tabIndex={date.getDate() === activeDay ? 0 : -1}
                    onSelect={pick}
                    onFocusDay={setFocusDay}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 上/下月按钮。
 *
 * ⚠️ 箭头是自己画的 SVG：资源里用的是 SF Symbols 的私有区码位（`􀆉` / `􀆊`），
 * Web 上没有那套字体，直接渲染是豆腐块。与 Collapsible / Sidebar 同一个坑。
 */
function ArrowButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? '上个月' : '下个月'}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full text-[var(--lg-label-primary)]',
        'transition-colors duration-100 hover:bg-[var(--lg-fill-quaternary)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lg-ring)]',
      )}
      style={{ width: CALENDAR_GEOMETRY.arrow.w, height: CALENDAR_GEOMETRY.arrow.h }}
      data-slot={`calendar-${dir}`}
    >
      <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
        <path
          d={dir === 'prev' ? 'M7.5 1L1.5 7.5L7.5 14' : 'M1.5 1L7.5 7.5L1.5 14'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

interface DayCellProps {
  date: Date;
  selected: boolean;
  current: boolean;
  disabled: boolean;
  tabIndex: number;
  onSelect: (d: Date) => void;
  onFocusDay: (day: number) => void;
}

function DayCell({
  date,
  selected,
  current,
  disabled,
  tabIndex,
  onSelect,
  onFocusDay,
}: DayCellProps) {
  /*
   * [实测] 四种态：
   *   Default            无底，黑字 Regular
   *   Current            #0088ff @ 0.12 正圆底，蓝字 Regular
   *   Selected           实心黑底，白字 Semibold      ← 注意**不是**主题蓝
   *   Current+Selected   实心蓝底，白字 Semibold
   */
  const fill = selected
    ? current
      ? 'var(--lg-blue)'
      : 'var(--lg-label-primary)'
    : current
      ? 'color-mix(in srgb, var(--lg-blue) 12%, transparent)'
      : 'transparent';

  const color = selected
    ? 'var(--lg-on-accent)'
    : current
      ? 'var(--lg-blue)'
      : 'var(--lg-label-primary)';

  return (
    <button
      type="button"
      role="gridcell"
      tabIndex={tabIndex}
      disabled={disabled}
      aria-selected={selected}
      // 今天 —— WAI-ARIA 的日期网格用 aria-current="date"
      aria-current={current ? 'date' : undefined}
      data-day={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
      data-selected={selected ? 'true' : undefined}
      data-current={current ? 'true' : undefined}
      onClick={() => onSelect(date)}
      onFocus={() => onFocusDay(date.getDate())}
      className={cn(
        'flex items-center justify-center transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lg-ring)]',
        'disabled:pointer-events-none disabled:opacity-30',
        !selected && !current && 'hover:bg-[var(--lg-fill-quaternary)]',
      )}
      style={{
        width: CALENDAR_GEOMETRY.cell,
        height: CALENDAR_GEOMETRY.cell,
        /*
         * ⚠️ 用常量算出来的 19，**不用 `rounded-full`**。
         * Tailwind v4 的 `rounded-full` 是 `calc(infinity * 1px)`，
         * 计算值是 33554400 —— 视觉上一样，但断言「正圆 = 边长的一半」就没法写了，
         * 而这个库的规矩是几何必须能从常量核对回去。
         */
        borderRadius: CALENDAR_GEOMETRY.cell / 2,
        backgroundColor: fill,
        color,
        fontSize: CALENDAR_GEOMETRY.dayFontSize,
        lineHeight: `${CALENDAR_GEOMETRY.dayLineHeight}px`,
        // [实测] 选中态是 Semibold 且字距归零，未选中是 Regular / −0.45
        fontWeight: selected ? 600 : 400,
        letterSpacing: selected ? 0 : CALENDAR_GEOMETRY.dayLetterSpacing,
      }}
      data-slot="calendar-day"
    >
      {date.getDate()}
    </button>
  );
}

export { Calendar };
