import Link from "next/link";
import { PageErrorState } from "@/components/rps/page-error-state";
import { SurveyBuilderDemo } from "@/components/rps/survey-builder-demo";
import { Card, Pill, SectionHeader } from "@/components/rps/ui";
import { getServerTrpcCaller } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; tab?: string; campaignId?: string }>;
}) {
  const { scenario, tab, campaignId } = await searchParams;
  const activeTab = tab ?? "create";
  const selectedCampaignId = campaignId ? Number.parseInt(campaignId, 10) || null : null;

  try {
    const surveyBuilderData = await getServerTrpcCaller().data.surveyBuilder({
      scenario: scenario ?? null,
      campaignId: selectedCampaignId,
    });
    const managementData =
      activeTab === "list"
        ? await getServerTrpcCaller().data.employeeManagement({
            scenario: scenario ?? null,
          })
        : null;
    const resultsHref = scenario
      ? `/results?scenario=${encodeURIComponent(scenario)}`
      : "/results";
    const companyName =
      surveyBuilderData.companies.find((company) => company.id === surveyBuilderData.companyId)?.name ??
      "Entreprise a definir";
    const completionRate = managementData?.participationRate ?? 0;
    const statusLabel = formatStatusLabel(surveyBuilderData.status);
    const statusTone =
      surveyBuilderData.status === "active"
        ? "success"
        : surveyBuilderData.status === "draft"
          ? "warning"
          : "neutral";

    if (activeTab === "list") {
      return (
        <section className="space-y-6">
        <SectionHeader
          eyebrow="Gestion des sondages"
          title="Liste des sondages"
          description="Consulte les sondages en cours, leur statut et le niveau de completion avant d'acceder aux resultats."
        />

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-[family-name:var(--font-manrope)] text-xl font-bold">
                Sondages en cours
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Filtre par entreprise ou statut pour retrouver rapidement un sondage.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                placeholder="Rechercher le nom de l'entreprise"
                className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              />
              <select className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none">
                <option value="active">active</option>
                <option value="draft">brouillon</option>
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
                <tr className="border-t border-slate-100 align-top">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{companyName}</p>
                    <p className="mt-1 text-slate-600">{surveyBuilderData.title}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Pill tone={statusTone}>{statusLabel}</Pill>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <Pill tone={completionRate >= 70 ? "success" : "warning"}>
                        {completionRate}%
                      </Pill>
                      <span className="text-xs text-slate-500">completion globale</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {formatShortDate(surveyBuilderData.startDate)}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {formatShortDate(surveyBuilderData.endDate)}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={resultsHref}
                      className="inline-flex items-center justify-center rounded-[12px] bg-[#181818] px-4 py-2 text-xs font-semibold no-underline shadow-[0_12px_24px_rgba(24,24,24,0.12)] transition hover:-translate-y-0.5 hover:bg-[#242424]"
                      style={{ color: '#ffffff' }}
                    >
                      Voir les resultats
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        </section>
      );
    }

    return (
      <section className="space-y-6">
      <SurveyBuilderDemo
        initialData={surveyBuilderData}
        mode={activeTab === "edit" ? "edit" : "create"}
        hydrateInitialCampaign={Boolean(selectedCampaignId)}
      />
      </section>
    );
  } catch (error) {
    return (
      <PageErrorState
        eyebrow="Gestion des sondages"
        title="Sondages"
        description="Crée, modifie ou consulte les sondages disponibles."
        message={
          error instanceof Error
            ? error.message
            : "Les données sondage n'ont pas pu être chargées."
        }
      />
    );
  }
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
  if (value === "draft") {
    return "brouillon";
  }
  if (value === "archived") {
    return "archive";
  }
  return value || "inconnu";
}
