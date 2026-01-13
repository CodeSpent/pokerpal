'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

// Toast context for managing toasts
interface Toast {
  id: string;
  title?: string;
  description: string;
  variant?: 'default' | 'error' | 'success';
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return {
    toast: context.addToast,
    error: (description: string, title?: string) =>
      context.addToast({ description, title, variant: 'error' }),
    success: (description: string, title?: string) =>
      context.addToast({ description, title, variant: 'success' }),
    dismiss: context.removeToast,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            open={true}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
            duration={4000}
            className={cn(
              'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
              'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full',
              toast.variant === 'error' && 'border-red-500/50 bg-red-950 text-red-50',
              toast.variant === 'success' && 'border-emerald-500/50 bg-emerald-950 text-emerald-50',
              (!toast.variant || toast.variant === 'default') && 'border-zinc-700 bg-zinc-900 text-zinc-50'
            )}
          >
            <div className="grid gap-1">
              {toast.title && (
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {toast.title}
                </ToastPrimitive.Title>
              )}
              <ToastPrimitive.Description className="text-sm opacity-90">
                {toast.description}
              </ToastPrimitive.Description>
            </div>
            <ToastPrimitive.Close
              className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-zinc-800 focus:opacity-100 focus:outline-none group-hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-auto sm:right-4 sm:top-4 sm:flex-col sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
