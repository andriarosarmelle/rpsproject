"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, Pill, PrimaryButton } from "@/components/rps/ui";
import { isDemoSession } from "@/lib/backend/auth";
import { getTrpcClient, formatTrpcError } from "@/lib/trpc/client";
import type { BackendCampaign, BackendReport, BackendCompany } from "@/lib/backend/types";

type CampaignReportsTableProps = {
  campaigns: BackendCampaign[];
  reports: BackendReport[];
  companies: BackendCompany[];
  scenario: string | null;
  initialCampaignId?: number | null;
};

type CampaignWithReport = BackendCampaign & {
  report?: BackendReport;
};

export function CampaignReportsTable({
  campaigns,
  reports,
  companies,
  initialCampaignId,
}: CampaignReportsTableProps) {
  const [filterCompanyId, setFilterCompanyId] = useState<number | "">("");
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const companyMap = useMemo(() => {
    const map = new Map<number, string>();
    companies.forEach((c) => map.set(c.id, c.name));
    campaigns.forEach((c) => {
      if (c.company?.id) map.set(c.company.id, c.company.name);
    });
    return map;
  }, [companies, campaigns]);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;
    if (filterCompanyId) {
      filtered = filtered.filter((c) => c.company?.id === filterCompanyId);
    }
    return filtered
      .map((c): CampaignWithReport => {
        const campaignReports = reports.filter((r) => r.campaign?.id === c.id);
        const latestReport = campaignReports.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })[0];
        return { ...c, report: latestReport };
      })
      .sort((a, b) => {
        if (initialCampaignId) {
          if (a.id === initialCampaignId && b.id !== initialCampaignId) {
            return -1;
          }
          if (b.id === initialCampaignId && a.id !== initialCampaignId) {
            return 1;
          }
        }

        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [campaigns, reports, filterCompanyId, initialCampaignId]);

  const handleAnalyze = useCallback(async (campaignId: number) => {
    setAnalyzingId(campaignId);
    setMessage(null);

    if (isDemoSession()) {
      setMessage({
        text: "Mode démo : analyse simulée. Le rapport général par mail sera disponible une fois n8n activé.",
        type: "success",
      });
      setAnalyzingId(null);
      return;
    }

    try {
      const trpc = getTrpcClient();
      const result = await trpc.adminSurveys.analyzeCampaign.mutate({ campaignId });
      setMessage({ text: result.message, type: "success" });
    } catch (error) {
      setMessage({ text: formatTrpcError(error), type: "error" });
    } finally {
      setAnalyzingId(null);
    }
  }, []);

  if (campaigns.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg text-slate-500">Aucune campagne pour le moment.</p>
        <p className="mt-2 text-sm text-slate-400">
          Cree une campagne depuis la page Sondages pour commencer.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="company-filter" className="text-sm font-semibold text-slate-700">
            Filtrer par entreprise :
          </label>
          <select
            id="company-filter"
            value={filterCompanyId}
            onChange={(e) => {
              setFilterCompanyId(e.target.value === "" ? "" : Number(e.target.value));
              setMessage(null);
            }}
            className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9b7223]/30"
          >
            <option value="">Toutes les entreprises</option>
            {Array.from(new Set(companyMap.entries())).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">
          {filteredCampaigns.length} campagne{filteredCampaigns.length > 1 ? "s" : ""}
        </p>
      </Card>

      {/* Message */}
      {message && (
        <Card
          className={`px-5 py-4 ${
            message.type === "success"
              ? "border-l-4 border-emerald-500 bg-emerald-50"
              : "border-l-4 border-red-500 bg-red-50"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              message.type === "success" ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {message.type === "success" ? "✅" : "❌"} {message.text}
          </p>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Campagne</th>
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Rapport</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => {
                const statusLabel = formatStatusLabel(campaign.status);
                const statusTone =
                  campaign.status === "terminated" || campaign.status === "archived"
                    ? "neutral"
                    : campaign.status === "active"
                    ? "success"
                    : "warning";
                const hasReport = !!campaign.report;

                return (
                  <tr key={campaign.id} className="border-t border-slate-100 align-top">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{campaign.name}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {campaign.company?.name || companyMap.get(campaign.company?.id ?? 0) || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <Pill tone={statusTone}>{statusLabel}</Pill>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatShortDate(campaign.start_date)}
                    </td>
                    <td className="px-6 py-4">
                      {hasReport ? (
                        <a
                          href={campaign.report!.report_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#9b7223] hover:underline"
                        >
                          📄 Voir rapport
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Aucun rapport</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {hasReport ? (
                        <span className="text-xs text-emerald-600 font-medium">
                          ✅ Complété
                        </span>
                      ) : (
                        <PrimaryButton
                          onClick={() => handleAnalyze(campaign.id)}
                          disabled={analyzingId !== null}
                          className="!py-2 !px-4 !text-xs"
                        >
                          {analyzingId === campaign.id ? "Lancement..." : "Analyser"}
                        </PrimaryButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info */}
      <Card className="border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="text-sm text-amber-900">
          💡 <strong>Info :</strong> L&apos;analyse prend 1 à 2 minutes. Le rapport complet sera
          envoye par email avec un lien vers Google Drive.
        </p>
      </Card>
    </div>
  );
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatStatusLabel(status: string) {
  const labels: Record<string, string> = {
    preparation: "Preparation",
    active: "Actif",
    terminated: "Termine",
    archived: "Archive",
  };
  return labels[status] || status;
}
