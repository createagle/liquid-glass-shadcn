'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from '@/components/ui/toast';

/**
 * 多条排队。`<Toaster limit>` 决定同时显示几条，超出的等前面的关掉再上。
 *
 * ⚠️ 队列是**模块级单例** —— 一个页面只能有一个 `<Toaster />`，
 * 放两个会让同一条消息显示两遍。这一点写在组件里的注释上。
 */
export default function ToastStack() {
  const n = React.useRef(0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="glass"
        onClick={() => {
          n.current += 1;
          toast({ title: `第 ${n.current} 条`, description: '连点几下看看排队。' });
        }}
      >
        再来一条
      </Button>
      <Toaster limit={3} />
    </div>
  );
}
