'use client';

import { Textarea } from '@/components/ui/textarea';

/**
 * 多行输入的独立形态。圆角取 14 而不是胶囊 —— 多行控件做成胶囊很怪，
 * 而且官方资源里**没有多行输入的参考图**，这里的竖向内边距全是推定值。
 */
export default function TextareaField() {
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-3">
      <Textarea placeholder="说点什么…" />
      <Textarea defaultValue="已禁用的多行输入" disabled />
    </div>
  );
}
