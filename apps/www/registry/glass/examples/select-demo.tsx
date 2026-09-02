'use client';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export default function SelectDemo() {
  return (
    <Select defaultValue="size">
      <SelectTrigger aria-label="排序方式">
        <SelectValue placeholder="选择排序方式" />
      </SelectTrigger>
      <SelectContent title="排序方式">
        <SelectItem value="name">Name</SelectItem>
        <SelectItem value="date">Date Modified</SelectItem>
        <SelectItem value="size">Size</SelectItem>
        <SelectItem value="shared">Shared By</SelectItem>
        <SelectItem value="tags">Tags</SelectItem>
      </SelectContent>
    </Select>
  );
}
