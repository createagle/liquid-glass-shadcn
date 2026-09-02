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

/**
 * 单按钮的告知型 Alert。
 *
 * 注意标题与正文是**左对齐**的 —— 老版 UIAlertController 居中，
 * iOS 26+ 的参考图里明确是左对齐，本库按参考图走。
 */
export default function DialogSingle() {
  return (
    <Dialog>
      <DialogTrigger>检查更新</DialogTrigger>
      <DialogContent>
        <DialogTitle>已是最新版本</DialogTitle>
        <DialogDescription>你的设备已安装 iOS 27.1，无需更新。</DialogDescription>
        <DialogFooter>
          <DialogClose variant="prominent">好</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
