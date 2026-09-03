'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * 三态：未选 / 已选 / 半选。
 *
 * 「全选」那一格演示的是半选（indeterminate）的典型用法 ——
 * 它由下面两项算出来，自己不存状态。
 */
export default function CheckboxDemo() {
  // 元组而不是 boolean[] —— noUncheckedIndexedAccess 下按下标取值会带上 undefined
  const [items, setItems] = React.useState<[boolean, boolean]>([true, false]);
  const all = items.every(Boolean);
  const none = items.every((v) => !v);

  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={all ? true : none ? false : 'indeterminate'}
        onCheckedChange={(v) => setItems([v === true, v === true])}
      >
        全选
      </Checkbox>

      <div className="flex flex-col gap-3 pl-5">
        <Checkbox
          checked={items[0]}
          onCheckedChange={(v) => setItems([v === true, items[1]])}
        >
          邮件通知
        </Checkbox>
        <Checkbox
          checked={items[1]}
          onCheckedChange={(v) => setItems([items[0], v === true])}
        >
          推送通知
        </Checkbox>
      </div>

      <Checkbox disabled>暂不可选</Checkbox>
      <Checkbox disabled defaultChecked>
        已锁定
      </Checkbox>
    </div>
  );
}
