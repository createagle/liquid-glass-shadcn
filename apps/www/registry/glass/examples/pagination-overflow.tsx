'use client';

import * as React from 'react';
import { Pagination } from '@/components/ui/pagination';

/**
 * 页数多的时候，两端的点会缩小 —— 实测里是**三档**尺寸：
 *
 *   Default   8   当前页附近
 *   Adjacent  6   紧邻溢出区
 *   Overflow  4   最外侧
 *
 * 拖动下面的滑杆看它怎么变。
 */
export default function PaginationOverflow() {
  const [page, setPage] = React.useState(5);
  const total = 12;
  return (
    <div className="flex flex-col items-center gap-4">
      <Pagination total={total} page={page} />
      <input
        type="range"
        min={0}
        max={total - 1}
        value={page}
        onChange={(e) => setPage(Number(e.target.value))}
        aria-label="当前页"
        className="w-[220px]"
      />
    </div>
  );
}
