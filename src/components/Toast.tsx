'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-300 ${
        toast.type === 'success'
          ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/30'
          : toast.type === 'error'
          ? 'bg-rose-950/80 text-rose-200 border-rose-500/30'
          : 'bg-indigo-950/80 text-indigo-200 border-indigo-500/30'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
        {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
        <span className="leading-snug">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
