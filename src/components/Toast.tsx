"use client";

import { useEffect } from "react";

type ToastType = "error" | "success" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
}

const icons: Record<ToastType, React.ReactNode> = {
  error: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
    </svg>
  ),
};

const styles: Record<ToastType, string> = {
  error: "bg-red-950 border-red-700 text-red-300",
  success: "bg-green-950 border-green-700 text-green-300",
  info: "bg-gray-900 border-gray-700 text-gray-300",
};

export default function Toast({ message, type = "error", onDismiss, duration = 6000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl max-w-sm w-full text-sm ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1 leading-snug whitespace-pre-wrap">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
