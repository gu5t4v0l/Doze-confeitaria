"use client";

import { useSyncExternalStore } from "react";
import { todayInSaoPaulo } from "@/lib/dates";

const subscribe = () => () => {};
const getServerSnapshot = () => "";

/** "AAAA-MM-DD" de hoje em America/Sao_Paulo só no cliente; "" no servidor. */
export function useToday(): string {
  return useSyncExternalStore(subscribe, () => todayInSaoPaulo(), getServerSnapshot);
}
