'use client';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

/**
 * ⚠️ **这个组件的每一个数字都是 `[推定]`** ——
 * iOS 与 macOS 两份官方资源里都没有面包屑 / path control。
 * 尺寸全部借自本库已有的实测值，并在组件头部写明借自哪里。
 *
 * 唯一对错分明的是语义：**当前页是 `<span aria-current="page">`，不是链接。**
 */
export default function BreadcrumbDemo() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">资料库</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">2026</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>九月</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
