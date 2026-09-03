'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * `variant="field"` —— 独立成框的玻璃胶囊。
 *
 * ⚠️ 这一支**没有 Apple 参考图**：高度取的是 HIG 的 44pt 最小触控目标，
 * 圆角取半高做胶囊，都是推定值。有实测依据的是 `variant="list"`，见另一个示例。
 */
export default function InputField() {
  const [value, setValue] = React.useState('可以清除我');
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-3">
      <Input placeholder="电子邮件" type="email" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} clearable />
      <Input placeholder="已禁用" disabled />
    </div>
  );
}
