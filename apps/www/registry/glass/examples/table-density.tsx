'use client';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const ROWS = [
  ['文稿', '3 项', 0],
  ['草稿', '1 项', 1],
  ['归档', '12 项', 1],
] as const;

/**
 * 两档密度，和层级缩进。
 *
 * ⚠️ **`compact`（行高 20）才是实测值**，`default`（32）是本库为触屏放宽的
 * `[推定]` 值。别把默认值当成 Apple 的数。
 *
 * 层级缩进每级 15px，实测。
 */
export default function TableDensity() {
  return (
    <div className="flex flex-col gap-6">
      {(['default', 'compact'] as const).map((density) => (
        <div key={density} className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--lg-label-tertiary)]">
            density=&quot;{density}&quot;
          </span>
          <Table density={density} className="w-[280px]">
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>数量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(([name, count, level]) => (
                <TableRow key={name} level={level}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
