'use client';

import * as React from 'react';
import { Pagination } from '@/components/ui/pagination';

/**
 * iOS 的 UIPageControl。容器是一块 **Ultrathin 玻璃**（实测），
 * 两个点色正好落在既有的 label token 上 —— 这个组件没有新增任何颜色 token。
 */
export default function PaginationDemo() {
  const [page, setPage] = React.useState(2);
  return (
    <div className="flex flex-col items-center gap-4">
      <Pagination total={5} page={page} onPageChange={setPage} />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        第 {page + 1} 页 —— 点圆点换页
      </span>
    </div>
  );
}
