import { EmployeesTableDemo } from "@/components/rps/employees-table-demo";
import { PageErrorState } from "@/components/rps/page-error-state";
import { getServerTrpcCaller } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; campaignId?: string; companyId?: string }>;
}) {
  const { scenario, campaignId, companyId } = await searchParams;
  const requestedCampaignId = campaignId ? Number(campaignId) : null;

  try {
    const [managementData, surveyBuilderData, surveysList] = await Promise.all([
      getServerTrpcCaller().data.employeeManagement({
        scenario: scenario ?? null,
        campaignId: requestedCampaignId,
      }),
      getServerTrpcCaller().data.surveyBuilder({
        scenario: scenario ?? null,
      }),
      getServerTrpcCaller().data.listSurveys({
        scenario: scenario ?? null,
      }),
    ]);

    const selectedSurvey =
      (requestedCampaignId
        ? surveysList.find((survey) => survey.id === requestedCampaignId)
        : null) ??
      surveysList.find((survey) => survey.id === managementData.campaignId) ??
      null;
    const effectiveCampaignId =
      requestedCampaignId ??
      selectedSurvey?.id ??
      surveyBuilderData.campaignId ??
      managementData.campaignId;
    const effectiveCompanyId =
      selectedSurvey?.companyId ??
      (companyId ? Number(companyId) : null) ??
      surveyBuilderData.companyId ??
      managementData.companyId;
    const effectiveCampaignName =
      selectedSurvey?.title ?? managementData.campaignName ?? surveyBuilderData.title;

    return (
      <section className="space-y-6">
        <EmployeesTableDemo
          managementData={managementData}
          companies={surveyBuilderData.companies}
          surveys={surveysList}
          defaultCompanyId={effectiveCompanyId}
          defaultCampaignId={effectiveCampaignId}
          defaultCampaignName={effectiveCampaignName}
          campaignId={effectiveCampaignId}
          companyId={effectiveCompanyId}
        />
      </section>
    );
  } catch (error) {
    return (
      <PageErrorState
        eyebrow="Participants"
        title="Gestion des employes"
        description="Consulte les participants, les relances et les liens individuels."
        message={
          error instanceof Error
            ? error.message
            : "Les données participants n'ont pas pu être chargées."
        }
      />
    );
  }
}
