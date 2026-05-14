"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/rps/brand-logo";
import { Card } from "@/components/rps/ui";
import { login, saveAuth } from "@/lib/backend/auth";
const headingFontClass = "font-[family-name:var(--font-manrope)]";
const inputClassName =
  "w-full rounded-[12px] border border-[#ddd2c0] bg-[#f8f3ea] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#c9a86c] focus:ring-2 focus:ring-[#c9a86c]/30 disabled:cursor-not-allowed disabled:text-slate-500";
const primaryButtonClassName =
  "w-full rounded-[12px] border border-[#d5ba85] bg-[#181818] px-5 py-3 text-sm font-semibold text-[#f7f1e6] shadow-[0_14px_28px_rgba(24,24,24,0.14)] transition hover:-translate-y-0.5 hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-[12px] border border-[#d5ba85] bg-[#181818] px-5 py-3 text-sm font-semibold text-[#f7f1e6] shadow-[0_14px_28px_rgba(24,24,24,0.16)] transition hover:-translate-y-0.5 hover:bg-[#242424]";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await login({ email, password });
      saveAuth(response);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion administrateur indisponible.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_18%,#f3e4c7_0%,#efe3d1_34%,#ede8df_58%,#e6e3dd_100%)] px-5 py-10 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-[#cfa85f]/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#3f3428]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[#8a651f]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-7 rounded-[26px] border border-[#dfd1b9] bg-[rgba(255,252,246,0.88)] p-7 shadow-[0_30px_70px_rgba(40,33,24,0.12)] sm:p-10">
          <div className="flex flex-col items-start gap-2">
            <BrandLogo />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a651f]">
              Mesurez, comprenez, agissez
            </p>
          </div>

          <h1 className={`max-w-2xl ${headingFontClass} text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl`}>
            Votre espace de pilotage des risques psychosociaux.
          </h1>

        

          <p className="text-sm text-slate-600">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-semibold text-[#c9a86c] hover:underline">
              Créer un compte
            </Link>
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/survey-response"
              className="rounded-[12px] border border-[#d8ccba] bg-[#fffaf1] px-5 py-3 text-sm font-semibold text-slate-700 no-underline transition hover:bg-[#f8eedf]"
            >
              Voir le parcours salarié
            </Link>
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md rounded-[22px] border border-[#dfd1b9] bg-[rgba(255,252,246,0.95)] p-6 shadow-[0_24px_60px_rgba(40,33,24,0.16)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a651f]">
            Accès administrateur
          </p>
          <h2 className={`mt-2 ${headingFontClass} text-2xl font-extrabold tracking-tight text-slate-900`}>
            Connexion administrateur
          </h2>

          <form onSubmit={(event) => void handleLogin(event)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
                className={inputClassName}
                placeholder="admin@entreprise.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
                Mot de passe
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
                className={inputClassName}
                placeholder="Votre mot de passe"
              />
            </div>

            {error ? (
              <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={isLoading} className={primaryButtonClassName}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
