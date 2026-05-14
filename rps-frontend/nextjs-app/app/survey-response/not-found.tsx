import Link from "next/link";
import { Card } from "@/components/rps/ui";

export default function SurveyResponseNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="max-w-xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
          Lien invalide
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-manrope)] text-3xl font-extrabold">
          Ce questionnaire est introuvable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Le lien utilisé est invalide, expiré ou déjà supprimé.
        </p>
        <Link
          href="/survey-response"
          className="mt-6 inline-block rounded-[12px] bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5"
        >
          Revenir à l&apos;accès salarié
        </Link>
      </Card>
    </div>
  );
}
