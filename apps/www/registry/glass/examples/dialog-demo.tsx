'use client';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

export default function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger>删除这段录音</DialogTrigger>
      <DialogContent>
        <DialogTitle>删除录音？</DialogTitle>
        <DialogDescription>此操作无法撤销，录音会从所有设备上移除。</DialogDescription>
        <DialogFooter>
          <DialogClose>取消</DialogClose>
          <DialogClose variant="destructive">删除</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
