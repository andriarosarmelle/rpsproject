import { DashboardContent } from "@/components/rps/dashboard-content";
import { PageErrorState } from "@/components/rps/page-error-state";
import { getServerTrpcCaller } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario } = await searchParams;

  try {
    const surveys = await getServerTrpcCaller().data.listSurveys({
      scenario: scenario ?? null,
    });

    return <DashboardContent surveys={surveys} scenario={scenario ?? null} />;
  } catch (error) {
    return (
      <PageErrorState
        eyebrow="Tableau de bord"
        title="Entreprises et sondages"
        description="Consulte les sondages par entreprise et accède aux résultats."
        message={
          error instanceof Error
            ? error.message
            : "Le tableau de bord n'a pas pu être chargé."
        }
      />
    );
  }
}
