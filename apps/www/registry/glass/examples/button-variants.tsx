'use client';

import { Button } from '@/components/ui/button';

export default function ButtonVariants() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button>Glass</Button>
      <Button variant="prominent">Prominent</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="plain">Plain</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
