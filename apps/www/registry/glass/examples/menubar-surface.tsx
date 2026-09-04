'use client';

import * as React from 'react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/components/ui/menubar';

/**
 * `surface` —— 给菜单栏加一块玻璃底座。
 *
 * ⚠️ **iPadOS 不这么做。** 实测菜单栏是完全透明的，直接压在壁纸或内容上。
 * 这个 prop 是本库的扩展，给「菜单栏压在杂乱内容上、必须自己撑出可读性」
 * 的场景用；不是还原。
 */
export default function MenubarSurface() {
  return (
    <div className="flex flex-col gap-4">
      <Menubar surface>
        <MenubarMenu>
          <MenubarTrigger app>示例</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>关于本 App</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>显示</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>放大</MenubarItem>
            <MenubarItem>缩小</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        上面这一条是本库的扩展；默认（不传 surface）才是 iPadOS 的样子。
      </span>
    </div>
  );
}
