'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function TabsDemo() {
  return (
    <Tabs defaultValue="today" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="today">Today</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>
      <TabsContent value="today" className="pt-4 text-center text-[15px]">
        今天走了 8,214 步
      </TabsContent>
      <TabsContent value="week" className="pt-4 text-center text-[15px]">
        本周日均 6,902 步
      </TabsContent>
      <TabsContent value="month" className="pt-4 text-center text-[15px]">
        本月日均 7,431 步
      </TabsContent>
    </Tabs>
  );
}
