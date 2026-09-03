'use client';

import { Card, CardRow } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * 本库有**两个**分隔线颜色，而且刻意不合并 —— 这个示例就是把它们并排放着看。
 *
 *   上面：分组列表**行之间**那条，由 Card 自己画，`--lg-list-separator`
 *         压白底是 #e6e6e6（iOS 27 实测）
 *   下面：通用分隔线 `<Separator>`，`--lg-separator`
 *         压白底是 #c6c6c7（社区通行值，[待核实]）—— **明显深得多**
 *
 * 同一份资源里两者就是不同的粗细，合并会把量到的事实抹掉。
 */
export default function SeparatorTwoColors() {
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-4">
      <Card>
        <CardRow>
          <span className="flex-1">Card 画的分隔线</span>
        </CardRow>
        <CardRow>
          <span className="flex-1">#e6e6e6 · 实测</span>
        </CardRow>
      </Card>
      <div className="rounded-[26px] bg-[var(--lg-card-fill)] px-4 py-3">
        <div className="py-1 text-[15px]">Separator 画的分隔线</div>
        <Separator />
        <div className="py-1 text-[15px]">#c6c6c7 · 待核实</div>
      </div>
    </div>
  );
}
