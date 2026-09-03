'use client';

import * as React from 'react';
import { Card, CardRow } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

/**
 * 骨架屏该和它将来要变成的东西**同构** —— 行高、内缩、块的位置都对得上，
 * 内容到位时才不会跳一下。这里的行高 52 与内缩 16 都是 Card 给的（iOS 27 实测）。
 */
export default function SkeletonCard() {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-3">
      <Card aria-busy={!loaded}>
        <CardRow>
          {loaded ? (
            <span className="flex-1">无线局域网</span>
          ) : (
            <Skeleton style={{ height: 14, width: 96 }} />
          )}
          {loaded ? (
            <Switch defaultChecked aria-label="无线局域网" />
          ) : (
            <Skeleton style={{ height: 28, width: 64, borderRadius: 14 }} />
          )}
        </CardRow>
        <CardRow>
          {loaded ? (
            <span className="flex-1">隔空投送</span>
          ) : (
            <Skeleton style={{ height: 14, width: 72 }} />
          )}
          {loaded ? (
            <Switch aria-label="隔空投送" />
          ) : (
            <Skeleton style={{ height: 28, width: 64, borderRadius: 14 }} />
          )}
        </CardRow>
      </Card>
      <button
        type="button"
        className="self-start text-[13px] text-[var(--lg-accent-fill)]"
        onClick={() => setLoaded((v) => !v)}
      >
        {loaded ? '再看一次骨架' : '内容到位'}
      </button>
    </div>
  );
}
