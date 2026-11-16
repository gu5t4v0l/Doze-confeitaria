"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

/** Avisos temporários. Região aria-live: leitores de tela anunciam salvo/erro. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setMessages((m) => m.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current++;
      setMessages((m) => [...m.slice(-2), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            role={m.kind === "error" ? "alert" : undefined}
            className={cn(
              "pointer-events-auto flex w-full max-w-md animate-bar-in items-start gap-3 rounded-2xl px-4 py-3 text-[0.95rem] font-semibold shadow-lg ring-2",
              m.kind === "error"
                ? "bg-destructive text-white ring-white/60"
                : "bg-choc text-cream ring-cream/60",
            )}
          >
            <i
              aria-hidden="true"
              className={cn(
                "mt-0.5 text-xl",
                m.kind === "error"
                  ? "ri-error-warning-line"
                  : m.kind === "success"
                    ? "ri-checkbox-circle-line"
                    : "ri-information-line",
              )}
            />
            <p className="min-w-0 flex-1 leading-snug">{m.text}</p>
            <button
              type="button"
              onClick={() => dismiss(m.id)}
              aria-label="Fechar aviso"
              className="-my-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15"
            >
              <i className="ri-close-line text-lg" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
