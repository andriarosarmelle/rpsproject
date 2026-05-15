"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/rps/brand-logo";
import { Card } from "@/components/rps/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmittedEmail(email.trim().toLowerCase());
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
          <div className="flex flex-col items-start gap-3">
            <BrandLogo />
            <span className="inline-flex rounded-full border border-[#d6c199] bg-[#fff7ea] px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#8a651f]">
              Acces administrateur
            </span>
          </div>

          <h1 className="max-w-2xl font-[family-name:var(--font-manrope)] text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Recuperation d'acces.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Saisissez votre adresse email pour enregistrer une demande de recuperation d'acces.
          </p>
        </section>

        <Card className="mx-auto w-full max-w-md rounded-[22px] border border-[#dfd1b9] bg-[rgba(255,252,246,0.95)] p-6 shadow-[0_24px_60px_rgba(40,33,24,0.16)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a651f]">
            Assistance connexion
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-manrope)] text-2xl font-extrabold tracking-tight text-slate-900">
            Reinitialiser mon acces
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Cette page conserve votre demande localement en attendant l'implementation complete du flux de reinitialisation.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[12px] border border-[#ddd2c0] bg-[#f8f3ea] px-4 py-3 text-sm outline-none transition focus:border-[#c9a86c] focus:ring-2 focus:ring-[#c9a86c]/30"
                placeholder="admin@entreprise.com"
              />
            </div>

            {submittedEmail ? (
              <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Demande enregistree pour <span className="font-semibold">{submittedEmail}</span>.
                <br />
                Revenez a la connexion et utilisez un compte administrateur valide.
              </div>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-[12px] border border-[#d5ba85] bg-[#181818] px-5 py-3 text-sm font-semibold text-[#f7f1e6] shadow-[0_14px_28px_rgba(24,24,24,0.14)] transition hover:-translate-y-0.5 hover:bg-[#242424]"
            >
              Enregistrer la demande
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <Link href="/login" className="text-[#8a651f] underline-offset-4 hover:underline">
              Retour a la connexion
            </Link>
            <Link href="/signup" className="text-slate-600 underline-offset-4 hover:underline">
              Creer un compte
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
