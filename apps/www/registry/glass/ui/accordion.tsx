'use client';

// APPLE REFERENCE: **没有一个叫 Accordion 的 Apple 控件。**
//
// 清单第 29 行写的是「无直接对应；接近 grouped list 可折叠 section」。
// 这次在 macOS 27 资源里找到的是**两个零件**，不是一个成品：
//
//   Disclosure Button   节点 121:12048   → 触发器，几何全部实测（§11.1）
//   Group Box           节点 121:11263   → 区块底，实测（§11.2 / §11.3）
//
// 也就是说：**零件是实测的，怎么拼是本库定的。** 这两件事必须分开说。
//
// ── 实测的部分 ────────────────────────────────────────────────────────
//
//   触发器            见 collapsible.tsx（本组件直接复用它）      [实测]
//   区块底色          亮 #000000@0.03 × 0.50 → 等效 0.015        [实测]
//   区块圆角          12                                         [实测]
//
// ── 本库定的部分（全部 `[推定]`）────────────────────────────────────
//
//   项与项之间怎么分（分隔线？间距？）、标题行高、内容区内边距 ——
//   Group Box 在资源里就是**一个空的圆角矩形**，里面什么都没画。
//
// ── 一处刻意的选择：区块底用 Group Box，不用 Card ────────────────────
//
//   `Card` 是 **iOS 的分组列表区块**（不透明白、圆角 26、行高 52，全部实测）。
//   Group Box 是 **macOS 圈一组控件的容器**（极淡的半透明、圆角 12）。
//   两者不是一回事，混用会得到一个「iOS 的壳装 macOS 的芯」的四不像。
//
//   需要 iOS 分组列表那种观感时，正确做法是 `Card` + `CardRow`，
//   把 Collapsible 放进行里 —— 文档页的第二个示例演示的就是这个。
//
// ⚠️ 分层：**内容层，不带玻璃。** 与 Checkbox 同一个理由 ——
//   Apple 的这两个零件里一个模糊 / 折射都没有，且手风琴常常一屏好几个。

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { DisclosureIndicator, COLLAPSIBLE_GEOMETRY } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 区块圆角（px）。[实测] macOS Group Box 12 */
  radius: 12,
  /** 标题行高（px）。`[推定]` —— Group Box 里没画任何行 */
  triggerHeight: 44,
  /** 左右内边距（px）。`[推定]` */
  paddingInline: 12,
  /** 内容区下内边距（px）。`[推定]` */
  contentPaddingBottom: 12,
  /** 触发器与标题的间距（px）。`[推定]` —— 沿用 Collapsible 的 8 */
  gap: COLLAPSIBLE_GEOMETRY.gap,
  /** 指示器边长（px）。[实测] 的档位里最小的圆形档 */
  indicatorSize: COLLAPSIBLE_GEOMETRY.size,
} as const;

/**
 * ⚠️ **必须是 `type` 交叉，不能 `interface extends`。**
 *
 * Radix 的 Accordion Root 是个**可辨识联合**
 * （`AccordionSingleProps | AccordionMultipleProps`，靠 `type` 字段区分），
 * 而 `interface extends` 只接受「成员静态可知」的对象类型 ——
 * 对着联合写会得到 TS2312。
 */
type AccordionRootProps = React.ComponentProps<typeof AccordionPrimitive.Root>;

export type GlassAccordionProps = AccordionRootProps & {
  /**
   * 画出区块底（Group Box）。默认 `true`。
   *
   * 传 `false` 就只有几何与行为，底交给调用方 ——
   * 放进 `Card` 里用的时候必须传 `false`，否则两层底叠在一起。
   */
  boxed?: boolean;
};

/**
 * 手风琴。
 *
 * ```tsx
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="a">
 *     <AccordionTrigger>通知</AccordionTrigger>
 *     <AccordionContent>…</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
function Accordion({ className, boxed = true, style, ...props }: GlassAccordionProps) {
  return (
    <AccordionPrimitive.Root
      /*
       * ⚠️ 这里的断言不是偷懒。把 `type`（single / multiple）连同其余 prop
       * 一起走 rest 展开之后，TS 就认不出这是联合里的哪一支了 ——
       * 判别字段丢在 rest 里，编译器没法再收窄。
       * 运行时是对的（调用方必然传了 type，那是 Radix 的必填项）。
       */
      {...(props as AccordionRootProps)}
      className={cn('w-full', boxed && 'bg-[var(--lg-groupbox-fill)]', className)}
      style={boxed ? { borderRadius: GEOMETRY.radius, ...style } : style}
      data-slot="accordion"
      data-boxed={boxed ? 'true' : undefined}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        /*
         * 项与项之间用一条分隔线，且**最后一项不画** ——
         * 这是 iOS 分组列表的做法（Card 里也是这么干的），
         * 因为 Group Box 那边没有任何依据可循。`[推定]`
         */
        'border-b border-[var(--lg-list-separator)] last:border-b-0',
        className,
      )}
      {...props}
      data-slot="accordion-item"
    />
  );
}

export interface GlassAccordionTriggerProps
  extends React.ComponentProps<typeof AccordionPrimitive.Trigger> {
  /** 指示器边长（px）。默认 28。 */
  indicatorSize?: number;
}

/**
 * ⚠️ Radix 要求 Trigger 外面裹一层 `AccordionPrimitive.Header`
 * （它渲染成 `<h3>`，是 accordion 的无障碍结构的一部分）。
 * 这里把那一层封进来，调用方不用记。
 */
function AccordionTrigger({
  className,
  children,
  indicatorSize = GEOMETRY.indicatorSize,
  style,
  ...props
}: GlassAccordionTriggerProps) {
  const disabled = props.disabled === true;
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group/disclosure flex flex-1 items-center outline-none',
          'text-[17px] text-[var(--lg-label-primary)]',
          'disabled:cursor-default disabled:opacity-45',
          'focus-visible:[box-shadow:inset_0_0_0_3.5px_var(--lg-ring)]',
          className,
        )}
        style={{
          minHeight: GEOMETRY.triggerHeight,
          paddingInline: GEOMETRY.paddingInline,
          gap: GEOMETRY.gap,
          borderRadius: GEOMETRY.radius,
          ...style,
        }}
        {...props}
        data-slot="accordion-trigger"
      >
        {/*
         * 与 Collapsible 同一手法：两个指示器，靠 CSS 的
         * group-data-[state=open] 切换，不在 React 里同步一份状态。
         */}
        <DisclosureIndicator
          size={indicatorSize}
          disabled={disabled}
          className="group-data-[state=open]/disclosure:hidden"
        />
        <DisclosureIndicator
          size={indicatorSize}
          open
          disabled={disabled}
          className="hidden group-data-[state=open]/disclosure:inline-flex"
        />
        <span className="flex-1 text-left">{children}</span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/**
 * 内容区。高度动画与 Collapsible 共用 `.lg-collapsible-content`
 * （见 optics.css），Radix 两边的 CSS 变量名不同，那条规则里都写了。
 */
function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn('lg-collapsible-content overflow-hidden', className)}
      {...props}
      data-slot="accordion-content"
    >
      <div
        className="text-[15px] text-[var(--lg-label-secondary)]"
        style={{
          paddingInline: GEOMETRY.paddingInline,
          paddingBottom: GEOMETRY.contentPaddingBottom,
          // 指示器宽 + 间距 —— 让内容与标题文字左缘对齐。`[推定]`
          paddingLeft: GEOMETRY.paddingInline + GEOMETRY.indicatorSize + GEOMETRY.gap,
        }}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  GEOMETRY as ACCORDION_GEOMETRY,
};
