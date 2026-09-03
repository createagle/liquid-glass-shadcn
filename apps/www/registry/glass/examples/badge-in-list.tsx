'use client';

import { Card, CardRow } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * 徽章真正的落脚点：分组列表行的右侧。
 * 行高 52、左右内缩 16 都由 Card 提供（iOS 27 实测），徽章只管自己那一小块。
 */
export default function BadgeInList() {
  return (
    <Card className="w-full max-w-[370px]">
      <CardRow>
        <span className="flex-1">信息</span>
        <Badge variant="count">12</Badge>
      </CardRow>
      <CardRow>
        <span className="flex-1">软件更新</span>
        <Badge variant="count">1</Badge>
      </CardRow>
      <CardRow>
        <span className="flex-1">订阅</span>
        <Badge variant="outline">已过期</Badge>
      </CardRow>
    </Card>
  );
}
