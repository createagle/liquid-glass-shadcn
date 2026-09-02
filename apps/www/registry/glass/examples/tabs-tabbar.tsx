'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/**
 * iOS 26+ 的浮动式 Tab Bar：底座 62pt 高，就是 `height` 的默认值。
 * 底座 → 指示器的内缩会按同一比例缩放，所以改 height 不会让内缩失真。
 */
export default function TabsTabBar() {
  return (
    <Tabs defaultValue="library" height={62}>
      <TabsList>
        <TabsTrigger value="library" className="w-[118px]">
          资料库
        </TabsTrigger>
        <TabsTrigger value="radio" className="w-[118px]">
          广播
        </TabsTrigger>
      </TabsList>
      <TabsContent value="library" className="pt-3 text-center text-[15px]">
        128 首歌曲
      </TabsContent>
      <TabsContent value="radio" className="pt-3 text-center text-[15px]">
        正在播放：Apple Music 1
      </TabsContent>
    </Tabs>
  );
}
