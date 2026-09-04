'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

/**
 * `type="single" collapsible` —— 一次只开一项，且允许全部收起。
 *
 * 区块底用的是 macOS 的 Group Box（极淡的半透明 + 圆角 12，均实测），
 * **不是** iOS 的分组列表区块 —— 那是 `Card`，两者不是一回事。
 */
export default function AccordionDemo() {
  return (
    <Accordion type="single" collapsible defaultValue="notify" className="w-[320px]">
      <AccordionItem value="notify">
        <AccordionTrigger>通知</AccordionTrigger>
        <AccordionContent>
          允许这个 App 发送通知。关闭后仍会在 App 内显示未读标记。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="privacy">
        <AccordionTrigger>隐私</AccordionTrigger>
        <AccordionContent>控制它能读到哪些数据。</AccordionContent>
      </AccordionItem>
      <AccordionItem value="storage">
        <AccordionTrigger>存储</AccordionTrigger>
        <AccordionContent>已占用 1.2 GB，其中缓存 340 MB。</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
