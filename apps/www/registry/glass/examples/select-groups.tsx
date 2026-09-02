'use client';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';

/**
 * 分组、分隔区与禁用项。
 *
 * 分隔区**不是一条线，是一块 21pt 高的区域**，线在区顶 +2 处 ——
 * 那个偏移是量出来的，不是居中。
 */
export default function SelectGroups() {
  return (
    <Select defaultValue="name">
      <SelectTrigger aria-label="排序方式">
        <SelectValue placeholder="选择排序方式" />
      </SelectTrigger>
      <SelectContent title="排序方式">
        <SelectGroup>
          <SelectLabel>文件属性</SelectLabel>
          <SelectItem value="name">名称</SelectItem>
          <SelectItem value="size">大小</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>时间</SelectLabel>
          <SelectItem value="modified">修改日期</SelectItem>
          <SelectItem value="created" disabled>
            创建日期（未索引）
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
