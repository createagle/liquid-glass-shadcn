'use client';

// APPLE REFERENCE: UIDatePicker `.compact` / SwiftUI `DatePicker`（默认样式）
//                  （iOS 27「Date and Time Pickers」页）
//
// 节点 `30:53803`（Date and time - Collapsed，2 状态）与
// `51:60427`（Pickers · Style=Compact）。测量见 apple-metrics.md §14.1 / §14.5。
//
// ── 与 `<Calendar>` 的分工，来自资源本身 ──────────────────────────────
//
//   资源里同一个日历有两个变体，**材质不一样**：
//
//     Style=Inline    嵌在内容里  →  纯白不透明，左右内边距 16   → `<Calendar>`
//     Style=Compact   弹出层      →  **玻璃**，圆角 13，内边距 12 → **本文件**
//
//   所以这里的玻璃不是「弹层就该有玻璃」推出来的，是量出来的。
//   ⚠️ 面板圆角 **13**：比菜单的 34、Popover 的 38 小得多。
//     一开始我以为是量错了，回去复核了两个变体 —— Compact 的
//     `Fill + Shadow` 与 `Glass Effect` 两层都写着 13。**是真的。**
//
// ── 触发器：两枚胶囊，不是一个输入框 ──────────────────────────────────
//
//   实测 `30:53803`：日期与时间是**两枚独立的胶囊**（112×34 / 86×34，
//   中间间距 6），底色都是 `#767680 @ 0.12` —— 又一次正好落在
//   `--lg-fill-tertiary` 上（这是该系填充第四次命中既有 token）。
//
//   ⚠️ **选中态只有文字变色**（转 `#0088ff`），底色不变。
//     这与本库大多数控件「选中改底色」的直觉相反，但资源里就是这样。
//
// ── 本组件**不做**时间选择 ────────────────────────────────────────────
//
//   资源里时间那一枚点开是滚轮（UIDatePicker 的 wheels 形态），
//   那是另一个控件、另一套几何，**本批没有量**。
//   所以 `time` 那一枚默认不渲染；传了 `time` 才显示，且它是**只读展示**。
//   「没做」与「没有依据」是两回事 —— 这里是前者。
//
// ⚠️ 分层：触发器 = 内容层填充（不是玻璃）；弹层面板 = **Layer B**。

import * as React from 'react';
import {
  ResponsiveOverlay,
  ResponsiveOverlayTrigger,
  ResponsiveOverlayContent,
} from '@/components/ui/responsive-overlay';
import { Calendar, CALENDAR_GEOMETRY, CALENDAR_WIDTH } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export const DATE_PICKER_GEOMETRY = {
  /** 触发器胶囊高（px）。[实测] 34 */
  pillHeight: 34,
  /** 日期胶囊宽（px）。[实测] 112 —— 内容撑开时以此为最小宽 */
  datePillMinWidth: 112,
  /** 时间胶囊宽（px）。[实测] 86 */
  timePillMinWidth: 86,
  /** 两枚胶囊之间的间距（px）。[实测] 6 */
  pillGap: 6,
  /** 胶囊左右内边距（px）。[实测] 11 */
  pillPaddingInline: 11,
  /** 胶囊上下内边距（px）。[实测] 6 */
  pillPaddingBlock: 6,
  /** 胶囊文字字号（px）。[实测] 17 */
  fontSize: 17,
  /** 胶囊文字行高（px）。[实测] 22 */
  lineHeight: 22,
  /** 胶囊文字字距（px）。[实测] −0.43 */
  letterSpacing: -0.43,
  /**
   * 弹层面板圆角（px）。[实测] **13**。
   *
   * 比菜单的 34、Popover 的 38 小得多 —— 复核过两个变体的
   * `Fill + Shadow` 与 `Glass Effect` 两层，都是 13。
   */
  panelRadius: 13,
  /** 弹层面板左右内边距（px）。[实测] 12（嵌入形态是 16） */
  panelPaddingInline: 12,
} as const;

export interface GlassDatePickerProps
  extends Omit<React.ComponentProps<'div'>, 'onSelect' | 'defaultValue'> {
  /** 受控选中日期。 */
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (date: Date) => void;
  /** 「今天」。默认 `new Date()` —— 测试与快照请传死值。 */
  today?: Date;
  /** 语言。默认 `'en-US'`，理由见 `<Calendar>` 的同名 prop。 */
  locale?: string;
  /**
   * 时间那一枚胶囊的内容。**只读展示**，点开没有滚轮 ——
   * 资源里的时间选择是另一个控件，本批没有量。不传就不渲染这一枚。
   */
  time?: string;
  /** 无障碍标签。移动端会渲染成 Drawer 的标题，必须有。 */
  label?: string;
  /** 占位文案（还没选日期时）。 */
  placeholder?: string;
  disabled?: boolean;
}

function DatePicker({
  className,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  today,
  locale = 'en-US',
  time,
  label = '选择日期',
  placeholder = 'Select date',
  disabled = false,
  ...props
}: GlassDatePickerProps) {
  const [selfValue, setSelfValue] = React.useState<Date | null>(defaultValue);
  const value = valueProp !== undefined ? valueProp : selfValue;
  const [open, setOpen] = React.useState(false);

  const text = React.useMemo(() => {
    if (!value) return placeholder;
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value);
  }, [value, locale, placeholder]);

  const pick = (date: Date) => {
    if (valueProp === undefined) setSelfValue(date);
    onValueChange?.(date);
    setOpen(false);
  };

  return (
    <div
      className={cn('inline-flex items-center', className)}
      style={{ gap: DATE_PICKER_GEOMETRY.pillGap }}
      {...props}
      data-slot="date-picker"
    >
      <ResponsiveOverlay open={open} onOpenChange={setOpen}>
        <ResponsiveOverlayTrigger
          className={cn(
            'inline-flex items-center justify-center',
            'transition-colors duration-100',
            'bg-[var(--lg-fill-tertiary)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lg-ring)]',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
          disabled={disabled}
          style={{
            minWidth: DATE_PICKER_GEOMETRY.datePillMinWidth,
            height: DATE_PICKER_GEOMETRY.pillHeight,
            // 胶囊 —— [实测] r=100 于 34 高
            borderRadius: DATE_PICKER_GEOMETRY.pillHeight / 2,
            paddingInline: DATE_PICKER_GEOMETRY.pillPaddingInline,
            fontSize: DATE_PICKER_GEOMETRY.fontSize,
            lineHeight: `${DATE_PICKER_GEOMETRY.lineHeight}px`,
            letterSpacing: DATE_PICKER_GEOMETRY.letterSpacing,
            /*
             * [实测] 打开（= 资源里的 Selected 态）**只有文字变色**，底色不变。
             * 与本库多数控件的直觉相反，但资源里就是这样。
             */
            color: open ? 'var(--lg-blue)' : 'var(--lg-label-primary)',
          }}
          data-slot="date-picker-trigger"
          data-state={open ? 'open' : 'closed'}
        >
          {text}
        </ResponsiveOverlayTrigger>

        <ResponsiveOverlayContent
          title={label}
          /*
           * 圆角与内边距都要覆盖默认值：
           *   radius        [实测] Compact 面板是 **13**，不是 Popover 默认的 38
           *   padding 0     内边距由 Calendar 自己带（左右 12），面板不再叠一层
           *   width null    由日历撑开，不是 Popover 默认的 250
           */
          popover={{
            radius: DATE_PICKER_GEOMETRY.panelRadius,
            paddingBlock: 0,
            paddingInline: 0,
            width: null,
            align: 'start',
          }}
        >
          <Calendar
            selected={value}
            onSelect={pick}
            {...(today ? { today } : {})}
            locale={locale}
            style={{
              // [实测] 弹层形态的左右内边距是 12，不是嵌入形态的 16
              paddingInline: DATE_PICKER_GEOMETRY.panelPaddingInline,
              width: CALENDAR_WIDTH + DATE_PICKER_GEOMETRY.panelPaddingInline * 2,
            }}
          />
        </ResponsiveOverlayContent>
      </ResponsiveOverlay>

      {time ? (
        <span
          className="inline-flex items-center justify-center bg-[var(--lg-fill-tertiary)] text-[var(--lg-label-primary)]"
          style={{
            minWidth: DATE_PICKER_GEOMETRY.timePillMinWidth,
            height: DATE_PICKER_GEOMETRY.pillHeight,
            borderRadius: DATE_PICKER_GEOMETRY.pillHeight / 2,
            paddingInline: DATE_PICKER_GEOMETRY.pillPaddingInline,
            fontSize: DATE_PICKER_GEOMETRY.fontSize,
            lineHeight: `${DATE_PICKER_GEOMETRY.lineHeight}px`,
            letterSpacing: DATE_PICKER_GEOMETRY.letterSpacing,
          }}
          data-slot="date-picker-time"
        >
          {time}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 嵌入形态 —— 直接把日历放进内容里，不弹出。
 *
 * 对应资源的 `Style=Inline`：**纯白不透明，一句玻璃都没有**，左右内边距 16。
 * 需要玻璃就用上面的 `<DatePicker>`（那是 Compact 变体）。
 */
function DatePickerInline({
  className,
  ...props
}: React.ComponentProps<typeof Calendar>) {
  return (
    <div
      className={cn('inline-block bg-[var(--lg-card-fill)]', className)}
      data-slot="date-picker-inline"
    >
      <Calendar {...props} />
    </div>
  );
}

/** 供文档站与测试引用 —— 嵌入形态的内边距就是 Calendar 自己的那一份。 */
export const DATE_PICKER_INLINE_PADDING = CALENDAR_GEOMETRY.paddingInline;

export { DatePicker, DatePickerInline };
