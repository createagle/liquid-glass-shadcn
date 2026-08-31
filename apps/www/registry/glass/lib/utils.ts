import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 class 名。与 shadcn 生态保持完全一致的实现 ——
 * 本库的组件源码会 `import { cn } from "@/lib/utils"`，
 * 装到用户项目里时会复用他们已有的这个文件（如果已存在）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
