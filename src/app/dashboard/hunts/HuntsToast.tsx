"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Toast from "@/components/Toast";

export default function HuntsToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

  useEffect(() => {
    const msg = searchParams.get("toast");
    const type = (searchParams.get("type") ?? "info") as "error" | "success" | "info";
    if (msg) {
      setToast({ message: msg, type });
      // Clean the URL without re-rendering the page
      const params = new URLSearchParams(searchParams.toString());
      params.delete("toast");
      params.delete("type");
      const clean = params.size > 0 ? `${pathname}?${params}` : pathname;
      router.replace(clean, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const dismiss = useCallback(() => setToast(null), []);

  if (!toast) return null;
  return <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />;
}
