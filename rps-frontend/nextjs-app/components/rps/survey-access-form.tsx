"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, PrimaryButton } from "@/components/rps/ui";

export function SurveyAccessForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();

  function openSurvey(nextToken: string) {
    const normalized = nextToken.trim();

    if (!normalized) {
      return;
    }

    startTransition(() => {
      router.push(`/survey-response/${encodeURIComponent(normalized)}`);
    });
  }

  return (
    <Card className="mx-auto max-w-2xl p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
        Acces salarie
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-tight">
        Ouvrir le questionnaire avec un lien unique
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Colle ici le token recu dans l&apos;invitation pour ouvrir ton questionnaire personnel.
      </p>

      <div className="mt-6 space-y-4">
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Exemple: 4f2c8c9e-..."
          className="w-full rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton
            className="sm:w-auto"
            disabled={!token.trim() || isPending}
            onClick={() => openSurvey(token)}
          >
            {isPending ? "Ouverture..." : "Acceder au questionnaire"}
          </PrimaryButton>
        </div>
      </div>
    </Card>
  );
}
