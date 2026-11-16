import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/session";
import { LoginForm } from "@/app/admin/login/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Image
        src="/logo.webp"
        alt="DoZé Confeitaria"
        width={512}
        height={512}
        priority
        sizes="160px"
        className="mx-auto size-40 drop-shadow-md"
      />
      <h1 className="mt-4 text-center font-display text-3xl font-black text-choc">Painel da DoZé</h1>
      <p className="mt-1 text-center text-choc-deep">Entre com o seu e-mail e a sua senha para mexer no cardápio.</p>
      <Suspense fallback={null}>
        <AlreadyLoggedIn />
      </Suspense>
      <LoginForm />
    </main>
  );
}

/** Quem já tem sessão válida vai direto ao painel (o proxy também faz isso). */
async function AlreadyLoggedIn() {
  if (await isAdmin()) redirect("/admin");
  return null;
}
