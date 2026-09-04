'use client';

import * as React from 'react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from '@/components/ui/menubar';

/**
 * iPadOS 的菜单栏。
 *
 * ⚠️ **条本身没有材质** —— 实测四个变体的 fills / effects / strokes 全是空的。
 * 有材质的只有展开中的那一项（`#767680 @ 0.12` + 投影），
 * 以及弹出的面板（与 DropdownMenu 同一块）。
 */
export default function MenubarDemo() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger app>示例</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>关于本 App</MenubarItem>
          <MenubarSeparator />
          <MenubarItem shortcut="⌘,">设置…</MenubarItem>
          <MenubarSeparator />
          <MenubarItem shortcut="⌘Q" destructive>
            退出
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>文件</MenubarTrigger>
        <MenubarContent>
          <MenubarItem shortcut="⌘N">新建</MenubarItem>
          <MenubarItem shortcut="⌘O">打开…</MenubarItem>
          <MenubarSeparator />
          <MenubarItem shortcut="⌘S">存储</MenubarItem>
          <MenubarItem disabled>恢复到…</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>编辑</MenubarTrigger>
        <MenubarContent>
          <MenubarItem shortcut="⌘Z">撤销</MenubarItem>
          <MenubarItem shortcut="⇧⌘Z">重做</MenubarItem>
          <MenubarSeparator />
          <MenubarItem shortcut="⌘X">剪切</MenubarItem>
          <MenubarItem shortcut="⌘C">拷贝</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
