'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';

/**
 * 要 **iOS 分组列表**那种观感时，用 `Card` 当区块底，
 * 并且**必须给 Accordion 传 `boxed={false}`** —— 否则两层底叠在一起
 * （Card 是不透明白 + 圆角 26，Group Box 是半透明 + 圆角 12，叠出来是个四不像）。
 *
 * 这也是本库反复出现的一条：**底只画一层，画在最外面那个容器上。**
 */
export default function AccordionInCard() {
  return (
    <Card className="w-[320px]">
      <Accordion type="multiple" boxed={false} defaultValue={['a']}>
        <AccordionItem value="a">
          <AccordionTrigger>Wi-Fi</AccordionTrigger>
          <AccordionContent>已连接到「书房」。</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>蓝牙</AccordionTrigger>
          <AccordionContent>2 台设备已配对。</AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
