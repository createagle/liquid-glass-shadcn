'use client';

// APPLE REFERENCE: **两份官方设计资源里都没有。**
//
// 清单第 35 行写的是「无 iOS 对应；macOS path control」。
// 这次两边都翻了：
//
//   iOS 27（ojEQo0rKaQ5ioARo0CO0pf）    —— 没有任何 path / breadcrumb 节点
//   macOS 27（dRTOe4ObAK8UGqW9CBoJPM）  —— **没有 Path Controls 页**，
//                                          全库搜 /path/i 只搜到矢量图层名
//
// 也就是说：**这个组件的每一个数字都是 `[推定]`。**
// 与 Skeleton / Toast 同一档，不与 Checkbox / Table 那种混为一谈。
//
// ── 那么这些数字是从哪来的 ────────────────────────────────────────────
//
//   全部**借自本库已有的实测值**，并写明借自哪里 ——
//   这样至少它与库里其它组件是自洽的，而不是各拍各的脑袋：
//
//     字号 17     借自 Card 的行标签（[实测]，iOS body）
//     行高 44     借自 HIG 的最小触控目标（[官方]）
//     间距 8      借自 Collapsible 的触发器间距（那边也是推定）
//     分隔符      chevron.forward，与 Table / Collapsible 同一个自绘 SVG
//
//   **借来的实测值不会因为借了就变成实测值。** 这里一律标 `[推定]`。
//
// ── 一处**刻意不做**的东西 ────────────────────────────────────────────
//
//   macOS 的 path control 会在空间不够时把中间几级折成一个「…」菜单。
//   本库**没有做**这个折叠 —— 折叠的阈值、折几级、折起来点开是什么，
//   一条依据都没有，做出来就是四个连环推定。
//   需要时请自己在数据层裁剪，把 `<BreadcrumbEllipsis />` 摆进去。
//
// ⚠️ 分层：**内容层。** 面包屑是导航文字，不是控件。

import * as React from 'react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 字号（px）。`[推定]` —— 借自 Card 行标签的 17（那边是实测） */
  fontSize: 17,
  /** 行高（px）。`[推定]` —— 取 HIG 的 44 触控下限，让每一级都点得中 */
  itemHeight: 44,
  /** 项与分隔符之间的间距（px）。`[推定]` —— 借自 Collapsible 的 8 */
  gap: 8,
  /** 分隔符字形尺寸（px）。`[推定]` */
  separatorSize: 12,
} as const;

/**
 * 分隔符字形。与 Collapsible / Table 用的是同一条自绘路径 ——
 * 资源里的 `chevron.forward` 是 SF Symbols 私有区码位，网页上是豆腐块。
 * **形状 `[推定]`**。
 */
const CHEVRON_RIGHT = 'M 4.6 2.6 L 8 6 L 4.6 9.4';

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="面包屑"
      className={cn('w-full', className)}
      {...props}
      data-slot="breadcrumb"
    />
  );
}

function BreadcrumbList({ className, style, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn('flex flex-wrap items-center', className)}
      style={{ gap: GEOMETRY.gap, fontSize: GEOMETRY.fontSize, ...style }}
      {...props}
      data-slot="breadcrumb-list"
    />
  );
}

function BreadcrumbItem({ className, style, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      className={cn('inline-flex items-center', className)}
      style={{ gap: GEOMETRY.gap, minHeight: GEOMETRY.itemHeight, ...style }}
      {...props}
      data-slot="breadcrumb-item"
    />
  );
}

/**
 * 可点的那一级。
 *
 * ⚠️ 本库禁用 `asChild`，所以这里**不接受**外部链接组件。
 * 要用 Next 的 `<Link>` 时，把 `BreadcrumbLink` 换成你自己的一行 ——
 * 它只有一个 className，没有隐藏行为。
 */
function BreadcrumbLink({ className, ...props }: React.ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        'rounded-[8px] text-[var(--lg-label-secondary)] outline-none',
        'transition-colors duration-100 hover:text-[var(--lg-label-primary)]',
        'focus-visible:[box-shadow:0_0_0_3.5px_var(--lg-ring)]',
        className,
      )}
      {...props}
      data-slot="breadcrumb-link"
    />
  );
}

/**
 * 当前这一级。
 *
 * 渲染成 `<span aria-current="page">` 而不是链接 —— 当前页不该是可点的，
 * 那是面包屑最常见的无障碍错误。
 */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-current="page"
      className={cn('text-[var(--lg-label-primary)]', className)}
      {...props}
      data-slot="breadcrumb-page"
    />
  );
}

function BreadcrumbSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      // 装饰性 —— 屏幕阅读器不该把「>」读出来
      role="presentation"
      aria-hidden="true"
      className={cn('flex items-center text-[var(--lg-label-tertiary)]', className)}
      {...props}
      data-slot="breadcrumb-separator"
    >
      {children ?? (
        <svg
          width={GEOMETRY.separatorSize}
          height={GEOMETRY.separatorSize}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d={CHEVRON_RIGHT}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </li>
  );
}

/**
 * 省略号。**本库不自动折叠** —— 见文件头。
 * 需要折叠时自己在数据层裁剪，把这个摆进去。
 */
function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('text-[var(--lg-label-tertiary)]', className)}
      {...props}
      data-slot="breadcrumb-ellipsis"
    >
      …
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  GEOMETRY as BREADCRUMB_GEOMETRY,
};
