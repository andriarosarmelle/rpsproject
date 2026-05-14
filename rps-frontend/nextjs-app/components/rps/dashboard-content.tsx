"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Pill, PrimaryButton, SectionHeader } from "@/components/rps/ui";
import type { SurveyOption } from "@/lib/repositories/rps-repository";

export function DashboardContent({
  surveys,
  scenario,
}: {
  surveys: SurveyOption[];
  scenario?: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredSurveys = useMemo(() => {
    return surveys.filter((survey) => {
      const matchesSearch =
        survey.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        survey.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || survey.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, surveys]);

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Tableau de bord"
        title="Liste des entreprises"
        description="Accède aux sondages par entreprise, avec statut, taux de complétion et accès direct aux résultats."
        action={
          <Link href="/surveys?tab=create" className="inline-flex">
            <PrimaryButton>Créer un sondage</PrimaryButton>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-[family-name:var(--font-manrope)] text-xl font-bold">
              Tableau des sondages
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Recherche par entreprise et filtre par statut pour retrouver rapidement un sondage.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              placeholder="recherche le nom de l'entreprise"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">active</option>
              <option value="draft">brouillon</option>
              <option value="terminated">termine</option>
              <option value="archived">archive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Taux de completion</th>
                <th className="px-6 py-4">Date de debut</th>
                <th className="px-6 py-4">Date de fin</th>
                <th className="px-6 py-4">Resultats</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurveys.length > 0 ? (
                filteredSurveys.map((survey) => {
                  const resultsHref = buildResultsHref(survey.id, scenario ?? null);
                  const statusTone =
                    survey.status === "active"
                      ? "success"
                      : survey.status === "draft" || survey.status === "preparation"
                        ? "warning"
                        : "neutral";

                  return (
                    <tr key={survey.id} className="border-t border-slate-100 align-top">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{survey.companyName}</p>
                        <p className="mt-1 text-slate-600">{survey.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Pill tone={statusTone}>{formatStatusLabel(survey.status)}</Pill>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <Pill tone={survey.participationRate >= 70 ? "success" : "warning"}>
                            {survey.participationRate}%
                          </Pill>
                          <span className="text-xs text-slate-500">
                            {survey.completedParticipants}/{survey.totalParticipants} participants
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatShortDate(survey.startDate)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatShortDate(survey.endDate)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={resultsHref}
                          className="inline-flex items-center justify-center rounded-[12px] bg-[#181818] px-4 py-2 text-xs font-semibold no-underline shadow-[0_12px_24px_rgba(24,24,24,0.12)] transition hover:-translate-y-0.5 hover:bg-[#242424]"
                          style={{ color: "#ffffff" }}
                        >
                          Voir les resultats
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-slate-100">
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Aucun sondage ne correspond a vos criteres de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function buildResultsHref(campaignId: number, scenario?: string | null) {
  const params = new URLSearchParams();
  params.set("view", "detail");
  params.set("campaignId", String(campaignId));

  if (scenario) {
    params.set("scenario", scenario);
  }

  return `/results?${params.toString()}`;
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatStatusLabel(value: string) {
  if (value === "active") {
    return "active";
  }
  if (value === "draft" || value === "preparation") {
    return "brouillon";
  }
  if (value === "terminated") {
    return "termine";
  }
  if (value === "archived") {
    return "archive";
  }
  return value || "inconnu";
}
