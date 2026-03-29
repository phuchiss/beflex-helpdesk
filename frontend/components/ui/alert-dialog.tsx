'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'default';
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'default',
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
          <AlertDialogPrimitive.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-4 flex justify-end gap-3">
            <AlertDialogPrimitive.Close className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
              {cancelLabel}
            </AlertDialogPrimitive.Close>
            <button
              onClick={() => { onConfirm(); onOpenChange(false); }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg text-white',
                variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
