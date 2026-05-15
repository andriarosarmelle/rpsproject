import { PageErrorState } from "@/components/rps/page-error-state";
import { Card, SectionHeader } from "@/components/rps/ui";
import { isBackendConfigured } from "@/lib/backend/client";
import { getServerBackendCollection as getBackendCollection } from "@/lib/backend/server";
import type { BackendCampaign, BackendCompany, BackendReport } from "@/lib/backend/types";
import { CampaignReportsTable } from "./CampaignReportsTable";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; campaignId?: string }>;
}) {
  const { scenario, campaignId } = await searchParams;
  const requestedCampaignId = campaignId ? Number(campaignId) : null;

  if (!isBackendConfigured()) {
    return (
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Rapports"
          title="Rapports Resultats"
          description="Configure le backend pour lancer l'analyse IA de tes campagnes et recevoir tes rapports par email."
        />
        <Card className="p-8 text-center">
          <p className="text-slate-500">Backend non configuré.</p>
        </Card>
      </section>
    );
  }

  try {
    const [campaigns, reports, companies] = await Promise.all([
      getBackendCollection<BackendCampaign>("/campaigns"),
      getBackendCollection<BackendReport>("/reports"),
      getBackendCollection<BackendCompany>("/companies"),
    ]);

    return (
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Rapports"
          title="Rapports Resultats"
          description="Analyse des campagnes et rapports par email."
        />

        <CampaignReportsTable
          campaigns={campaigns}
          reports={reports}
          companies={companies}
          scenario={scenario ?? null}
          initialCampaignId={requestedCampaignId}
        />
      </section>
    );
  } catch (error) {
    return (
      <PageErrorState
        eyebrow="Rapports"
        title="Rapports Resultats"
        description="Analyse des campagnes et rapports par email."
        message={
          error instanceof Error ? error.message : "Les rapports n'ont pas pu être chargés."
        }
      />
    );
  }
}
