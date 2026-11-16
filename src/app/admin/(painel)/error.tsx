"use client";

import { Button } from "@/components/ui/button";

export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border-2 border-destructive bg-cream p-6 text-center">
      <p className="font-display text-2xl font-black text-destructive">Não foi possível carregar</p>
      <p className="mt-2 text-choc-deep">
        Pode ser a conexão ou uma instabilidade momentânea. Seus dados não foram perdidos.
      </p>
      <Button size="lg" className="mt-4" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
