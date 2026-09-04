'use client';

import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';

const FILES = [
  ['报告.pdf', '2.4 MB', '昨天'],
  ['照片', '—', '上周'],
  ['预算.xlsx', '18 KB', '3 月 2 日'],
  ['归档.zip', '104 MB', '去年'],
] as const;

/**
 * ⚠️ **表格上一句玻璃都没有**，这是 PROJECT_SPEC §2 的硬性要求 ——
 * 表格是信息密度最高的内容，任何模糊或折射都会直接伤到可读性。
 *
 * 点一行看选中态：表格**有焦点**时是实心蓝 `#0165e2` + 白字，
 * 失焦时退成较淡的一档（两档都是实测值）。
 */
export default function TableDemo() {
  const [sel, setSel] = React.useState(1);
  return (
    <Table className="w-[340px]">
      <TableCaption>点一行试试，再点表格外面看失焦态</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead sorted="asc">名称</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>修改时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {FILES.map(([name, size, when], i) => (
          <TableRow
            key={name}
            tabIndex={0}
            selected={sel === i}
            onFocus={() => setSel(i)}
            onClick={() => setSel(i)}
          >
            <TableCell>{name}</TableCell>
            <TableCell>{size}</TableCell>
            <TableCell>{when}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
