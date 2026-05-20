import {
  BackendConfigurationError,
} from "@/lib/backend/client";
import {
  getServerBackendCollection as getBackendCollection,
  getServerBackendItem as getBackendItem,
} from "@/lib/backend/server";
import type {
  BackendCampaign,
  BackendCampaignProgress,
  BackendCompany,
  BackendEmployee,
  BackendQuestionnaire,
  BackendQuestion,
  BackendReport,
  BackendResponse,
} from "@/lib/backend/types";
import {
  type EmployeeRecord,
  type SurveyQuestion,
  mapStrapiReportTemplate,
} from "@/lib/strapi/mappers";
import { getStrapiSingle, isStrapiConfigured } from "@/lib/strapi/client";
import type { StrapiReportTemplate } from "@/lib/strapi/types";

export class RepositoryDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryDataError";
  }
}

type DashboardData = {
  metrics: {
    participationRate: number;
    averageStress: string;
    responded: number;
    totalEmployees: number;
    alertsDetected: number;
  };
  trendByRange: {
    monthly: { label: string; value: number }[];
    weekly: { label: string; value: number }[];
  };
  departmentDistribution: { label: string; value: number; color: string }[];
  insights: string[];
};

type ResultsData = {
  metrics: {
    participationRate: number;
    averageStress: string;
  };
  bars: {
    department: string;
    value: number;
    average: string;
  }[];
  analysis: string[];
};

type SurveyResponseData = {
  participantToken: string | null;
  employeeId: number | null;
  employeeName: string;
  employeeTitle: string;
  companyName: string;
  campaignName: string;
  status: string;
  completedAt: string | null;
  questions: SurveyQuestion[];
};

export type CampaignParticipantRecord = {
  id: number;
  employeeId: number;
  name: string;
  email: string;
  department: string;
  status: "pending" | "reminded" | "completed";
  responseStatus: EmployeeRecord["responseStatus"];
  invitationSentAt: string | null;
  reminderSentAt: string | null;
  completedAt: string | null;
  participationToken: string;
  surveyUrl: string;
};

export type EmployeeManagementData = {
  campaignId: number | null;
  companyId: number | null;
  campaignName: string;
  campaignStatus: string;
  participationRate: number;
  totalParticipants: number;
  completedParticipants: number;
  pendingParticipants: number;
  remindedParticipants: number;
  participants: CampaignParticipantRecord[];
};

export type SurveyBuilderData = {
  campaignId: number | null;
  companyId: number | null;
  companies: { id: number; name: string }[];
  campaigns: {
    id: number;
    name: string;
    description: string;
    status: string;
    companyId: number | null;
    startDate: string;
    endDate: string;
    questions: SurveyQuestion[];
  }[];
  title: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  questions: SurveyQuestion[];
  participantCount: number;
};

export type ReportTemplateData = {
  templateName: string;
  executiveSummaryTitle: string;
  executiveSummaryBody: string;
  methodologyTitle: string;
  methodologyBody: string;
  recommendationsTitle: string;
  recommendationsIntro: string;
  consultantNotesTitle: string;
  consultantNotesPlaceholder: string;
  conclusionTitle: string;
  conclusionBody: string;
};

export type ReportDocumentData = {
  title: string;
  companyName: string;
  participationRate: number;
  averageStress: number;
  alertCount: number;
  riskAreas: string[];
  recommendations: string[];
  archivedReportPath?: string | null;
  template: ReportTemplateData;
};

const EMPTY_TREND_BY_RANGE = {
  monthly: [] as { label: string; value: number }[],
  weekly: [] as { label: string; value: number }[],
};

const DEFAULT_REPORT_TEMPLATE: ReportTemplateData = {
  templateName: "Rapport RPS",
  executiveSummaryTitle: "Synthese executive",
  executiveSummaryBody: "",
  methodologyTitle: "Methodologie",
  methodologyBody: "",
  recommendationsTitle: "Recommandations",
  recommendationsIntro: "",
  consultantNotesTitle: "Notes consultant",
  consultantNotesPlaceholder: "",
  conclusionTitle: "Conclusion",
  conclusionBody: "",
};

const DEFAULT_REPORT_FALLBACK = {
  title: "Rapport RPS",
  companyName: "Entreprise",
  riskAreas: [] as string[],
};

function toRepositoryError(message: string, error?: unknown): RepositoryDataError {
  if (error instanceof BackendConfigurationError) {
    throw error;
  }

  if (error instanceof RepositoryDataError) {
    return error;
  }

  if (error instanceof Error && error.message) {
    return new RepositoryDataError(`${message} ${error.message}`);
  }

  return new RepositoryDataError(message);
}

function isBackendNotFoundError(error: unknown) {
  return error instanceof Error && /404/.test(error.message);
}

export async function getSurveyCampaign(
  scenario?: string | null,
  campaignId?: number | null,
) {
  try {
    const campaigns = await getBackendCollection<BackendCampaign>("/campaigns");
    const activeCampaign = resolveSelectedCampaign(campaigns, campaignId);

    if (!activeCampaign) {
      throw new RepositoryDataError("Aucun sondage n'est disponible pour le moment.");
    }

    return mapBackendCampaign(activeCampaign);
  } catch (error) {
    throw toRepositoryError("Impossible de charger le sondage selectionne.", error);
  }
}

export async function getSurveyQuestions(scenario?: string | null) {
  const currentCampaign = await getSurveyCampaign(scenario);
  return currentCampaign.questions;
}

export type SurveyOption = {
  id: number;
  title: string;
  status: string;
  companyId: number | null;
  companyName: string;
  startDate: string | null;
  endDate: string | null;
  participationRate: number;
  totalParticipants: number;
  completedParticipants: number;
};

export async function getAllSurveys(scenario?: string | null): Promise<SurveyOption[]> {
  try {
    const campaigns = await getBackendCollection<BackendCampaign>("/campaigns");

    if (!campaigns.length) {
      return [];
    }

    const progressEntries = await Promise.allSettled(
      campaigns.map((campaign) =>
        getBackendItem<BackendCampaignProgress>(
          `/campaign-participants/campaign/${campaign.id}/progress`,
        ),
      ),
    );
    const progressByCampaignId = new Map<number, BackendCampaignProgress | null>();

    campaigns.forEach((campaign, index) => {
      const progressEntry = progressEntries[index];
      progressByCampaignId.set(
        campaign.id,
        progressEntry?.status === "fulfilled" ? progressEntry.value : null,
      );
    });

    return [...campaigns]
      .sort(sortCampaignsByRecency)
      .map((campaign) =>
        mapSurveyOption(campaign, progressByCampaignId.get(campaign.id) ?? null),
      );
  } catch (error) {
    throw toRepositoryError("Impossible de charger la liste des sondages.", error);
  }
}

export async function getSurveyBuilderData(
  scenario?: string | null,
  campaignId?: number | null,
): Promise<SurveyBuilderData> {
  try {
    const [campaigns, companies] = await Promise.all([
      getBackendCollection<BackendCampaign>("/campaigns"),
      getBackendCollection<BackendCompany>("/companies"),
    ]);
    const activeCampaign = resolveSelectedCampaign(campaigns, campaignId);
    const companyOptions = companies.map((company) => ({
      id: company.id,
      name: company.name,
    }));

    const campaignOptions = campaigns.map((campaign) => {
      const mappedCampaign = mapBackendCampaign(campaign);

      return {
        id: campaign.id,
        name: mappedCampaign.title,
        description: mappedCampaign.description,
        status: mappedCampaign.status,
        companyId: campaign.company?.id ?? null,
        startDate: mappedCampaign.startDate ?? "",
        endDate: mappedCampaign.endDate ?? "",
        questions: mappedCampaign.questions,
      };
    });

    if (activeCampaign) {
      const mappedCampaign = mapBackendCampaign(activeCampaign);
      const activeCompanyId = activeCampaign.company?.id ?? null;
      const progress = await getBackendItem<BackendCampaignProgress>(
        `/campaign-participants/campaign/${activeCampaign.id}/progress`,
      ).catch(() => null);

      return {
        campaignId: activeCampaign.id,
        companyId: activeCompanyId,
        companies: companyOptions,
        campaigns: campaignOptions,
        title: mappedCampaign.title,
        description: mappedCampaign.description,
        status: mappedCampaign.status,
        startDate: mappedCampaign.startDate ?? "",
        endDate: mappedCampaign.endDate ?? "",
        questions: mappedCampaign.questions,
        participantCount: progress?.total_participants ?? 0,
      };
    }

    return {
      campaignId: null,
      companyId: companyOptions[0]?.id ?? null,
      companies: companyOptions,
      campaigns: campaignOptions,
      title: "",
      description: "",
      status: "draft",
      startDate: "",
      endDate: "",
      questions: [],
      participantCount: 0,
    };
  } catch (error) {
    throw toRepositoryError("Impossible de charger le builder de sondage.", error);
  }
}

export async function getEmployees(scenario?: string | null) {
  try {
    const entries = await getBackendCollection<BackendEmployee>("/employees");
    return entries.map(mapBackendEmployee);
  } catch (error) {
    throw toRepositoryError("Impossible de charger la liste des employes.", error);
  }
}

export async function getEmployeeManagementData(
  scenario?: string | null,
  campaignId?: number | null,
): Promise<EmployeeManagementData> {
  try {
    const campaigns = await getBackendCollection<BackendCampaign>("/campaigns");
    const activeCampaign =
      (campaignId ? campaigns.find((item) => item.id === campaignId) : null) ??
      campaigns.find((item) => item.status === "active") ??
      campaigns[0];

    if (!activeCampaign) {
      return buildEmptyEmployeeManagementData();
    }

    const progress = await getBackendItem<BackendCampaignProgress>(
      `/campaign-participants/campaign/${activeCampaign.id}/progress`,
    );

    return {
      campaignId: activeCampaign.id,
      companyId: activeCampaign.company?.id ?? null,
      campaignName: activeCampaign.name,
      campaignStatus: activeCampaign.status,
      participationRate: progress.participation_rate,
      totalParticipants: progress.total_participants,
      completedParticipants: progress.completed_participants,
      pendingParticipants: progress.pending_participants,
      remindedParticipants: progress.reminded_participants,
      participants: progress.participants.map((participant) => ({
          id: participant.id,
          employeeId: participant.employee.id,
          name: `${participant.employee.first_name} ${participant.employee.last_name}`.trim(),
          email: participant.employee.email,
          department: participant.employee.department ?? "Non renseigne",
          status: participant.status,
          responseStatus:
            participant.status === "completed" ? "Responded" : "Not responded",
          invitationSentAt: participant.invitation_sent_at,
          reminderSentAt: participant.reminder_sent_at,
          completedAt: participant.completed_at,
          participationToken: participant.participation_token,
          surveyUrl: `/survey-response/${participant.participation_token}`,
        })),
    };
  } catch (error) {
    throw toRepositoryError("Impossible de charger les participants du sondage.", error);
  }
}

export async function getDashboardData(
  scenario?: string | null,
  campaignId?: number | null,
): Promise<DashboardData> {
  try {
    const [campaigns, responses] = await Promise.all([
      getBackendCollection<BackendCampaign>("/campaigns"),
      getBackendCollection<BackendResponse>("/responses"),
    ]);
    const selectedCampaign = resolveSelectedCampaign(campaigns, campaignId);

    if (!selectedCampaign) {
      throw new RepositoryDataError("Aucun sondage n'est disponible pour le tableau de bord.");
    }

    const progress = await getBackendItem<BackendCampaignProgress>(
      `/campaign-participants/campaign/${selectedCampaign.id}/progress`,
    );

    return buildDashboardData(selectedCampaign, progress, responses);
  } catch (error) {
    throw toRepositoryError("Impossible de charger le tableau de bord.", error);
  }
}

export async function getResultsData(
  scenario?: string | null,
  campaignId?: number | null,
): Promise<ResultsData> {
  try {
    const [campaigns, responses] = await Promise.all([
      getBackendCollection<BackendCampaign>("/campaigns"),
      getBackendCollection<BackendResponse>("/responses"),
    ]);
    const selectedCampaign = resolveSelectedCampaign(campaigns, campaignId);

    if (!selectedCampaign) {
      throw new RepositoryDataError("Aucun sondage n'est disponible pour afficher les resultats.");
    }

    const progress = await getBackendItem<BackendCampaignProgress>(
      `/campaign-participants/campaign/${selectedCampaign.id}/progress`,
    );

    return buildResultsData(selectedCampaign, progress, responses);
  } catch (error) {
    throw toRepositoryError("Impossible de charger les resultats du sondage.", error);
  }
}

export async function getReportData(
  scenario?: string | null,
  campaignId?: number | null,
) {
  const template = await getReportTemplateData();

  try {
    const [campaigns, responses, reports] = await Promise.all([
      getBackendCollection<BackendCampaign>("/campaigns"),
      getBackendCollection<BackendResponse>("/responses"),
      getBackendCollection<BackendReport>("/reports"),
    ]);
    const selectedCampaign = resolveSelectedCampaign(campaigns, campaignId);

    if (!selectedCampaign) {
      throw new RepositoryDataError("Aucun sondage n'est disponible pour generer un rapport.");
    }

    const progress = await getBackendItem<BackendCampaignProgress>(
      `/campaign-participants/campaign/${selectedCampaign.id}/progress`,
    );

    return {
      ...buildReportData(selectedCampaign, progress, responses, reports),
      template,
    };
  } catch (error) {
    throw toRepositoryError("Impossible de charger le rapport.", error);
  }
}

export async function getReportTemplateData(): Promise<ReportTemplateData> {
  if (!isStrapiConfigured()) {
    return DEFAULT_REPORT_TEMPLATE;
  }

  try {
    const response = await getStrapiSingle<StrapiReportTemplate>("/api/report-template");
    return mapStrapiReportTemplate(response.data);
  } catch {
    return DEFAULT_REPORT_TEMPLATE;
  }
}

export async function getSurveyResponseData(
  token?: string,
  scenario?: string | null,
): Promise<SurveyResponseData> {
  if (token) {
    try {
      const questionnaire = await getBackendItem<BackendQuestionnaire>(
        `/campaign-participants/token/${token}/questionnaire`,
      );
      if (questionnaire) {
        return mapBackendQuestionnaire(questionnaire);
      }
    } catch (error) {
      if (isBackendNotFoundError(error)) {
        return {
          participantToken: null,
          employeeId: null,
          employeeName: "",
          employeeTitle: "",
          companyName: "",
          campaignName: "",
          status: "not-found",
          completedAt: null,
          questions: [],
        };
      }

      throw toRepositoryError("Impossible de charger le questionnaire salarie.", error);
    }
  }

  try {
    const [currentCampaign, employeeEntries] = await Promise.all([
      getSurveyCampaign(scenario),
      getBackendCollection<BackendEmployee>("/employees"),
    ]);

    if (!employeeEntries.length) {
      throw new RepositoryDataError("Aucun employe n'est disponible pour ce questionnaire.");
    }

    return {
      participantToken: null,
      employeeId: employeeEntries[0]?.id ?? 1,
      employeeName:
        `${employeeEntries[0]?.first_name ?? ""} ${employeeEntries[0]?.last_name ?? ""}`.trim() ||
        "Salarie",
      employeeTitle: employeeEntries[0]?.department ?? "Collaborateur",
      companyName: currentCampaign.companyName,
      campaignName: currentCampaign.title,
      status: "pending",
      completedAt: null,
      questions: currentCampaign.questions,
    };
  } catch (error) {
    throw toRepositoryError("Impossible de charger le questionnaire salarie.", error);
  }
}

function buildEmptyEmployeeManagementData(): EmployeeManagementData {
  return {
    campaignId: null,
    companyId: null,
    campaignName: "",
    campaignStatus: "draft",
    participationRate: 0,
    totalParticipants: 0,
    completedParticipants: 0,
    pendingParticipants: 0,
    remindedParticipants: 0,
    participants: [],
  };
}

function mapBackendQuestionnaire(entry: BackendQuestionnaire): SurveyResponseData {
  return {
    participantToken: entry.token,
    employeeId: entry.employee.id,
    employeeName: `${entry.employee.first_name} ${entry.employee.last_name}`.trim(),
    employeeTitle: entry.employee.department ?? "Collaborateur",
    companyName: entry.campaign.company?.name ?? "Entreprise",
    campaignName: entry.campaign.name,
    status: entry.status,
    completedAt: entry.completed_at,
    questions: entry.questions
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map(mapBackendQuestion),
  };
}

function mapSurveyOption(
  campaign: BackendCampaign,
  progress?: BackendCampaignProgress | null,
): SurveyOption {
  return {
    id: campaign.id,
    title: campaign.name,
    status: mapCampaignStatus(campaign.status),
    companyId: campaign.company?.id ?? null,
    companyName: campaign.company?.name ?? "Entreprise",
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    participationRate: progress?.participation_rate ?? 0,
    totalParticipants: progress?.total_participants ?? 0,
    completedParticipants: progress?.completed_participants ?? 0,
  };
}

function mapBackendCampaign(entry: BackendCampaign) {
  return {
    id: entry.id,
    documentId: `campaign-${entry.id}`,
    title: entry.name,
    description:
      entry.description ??
      "Description du sondage ici. Ce champ peut etre utilise pour fournir des instructions ou des informations supplementaires aux participants.",
    status: mapCampaignStatus(entry.status),
    startDate: entry.start_date ?? "",
    endDate: entry.end_date ?? "",
    companyName: entry.company?.name ?? "Entreprise",
    questions: (entry.questions ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map(mapBackendQuestion),
  };
}

function mapBackendQuestion(entry: BackendQuestion): SurveyQuestion {
  const type = normalizeQuestionType(entry.question_type);
  const defaultOptions = ["Oui", "Partiellement", "Non"];

  return {
    id: String(entry.id),
    documentId: `question-${entry.id}`,
    type,
    title: entry.question_text,
    helpText: entry.rps_dimension
      ? `Dimension analysee: ${entry.rps_dimension}`
      : "Question du questionnaire RPS",
    options:
      type === "choice"
        ? entry.choice_options?.filter(Boolean).length
          ? entry.choice_options.filter(Boolean)
          : defaultOptions
        : undefined,
    orderIndex: entry.order_index ?? 0,
  };
}

function mapBackendEmployee(entry: BackendEmployee): EmployeeRecord {
  const fullName = `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim();
  const responseStatus = (entry.responses?.length ?? 0) > 0 ? "Responded" : "Not responded";

  return {
    id: entry.id,
    documentId: `employee-${entry.id}`,
    name: fullName || "Employe",
    email: entry.email,
    department: entry.department ?? "Non renseigne",
    stressScore: computeStressScore(entry.responses ?? []),
    responseStatus,
  };
}

function normalizeQuestionType(type: string | null | undefined): SurveyQuestion["type"] {
  switch ((type ?? "").toLowerCase()) {
    case "scale":
    case "rating":
    case "likert":
      return "scale";
    case "choice":
    case "multiple_choice":
    case "radio":
      return "choice";
    default:
      return "text";
  }
}

function mapCampaignStatus(status: string) {
  switch (status) {
    case "active":
      return "active" as const;
    case "archived":
      return "archived" as const;
    case "terminated":
      return "terminated" as const;
    default:
      return "draft" as const;
  }
}

function computeStressScore(responses: Pick<BackendResponse, "answer" | "question">[]) {
  const scaleValues = responses
    .filter((response) => normalizeQuestionType(response.question?.question_type) === "scale")
    .map((response) => Number(response.answer))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);

  if (!scaleValues.length) {
    return 0;
  }

  const average = scaleValues.reduce((sum, value) => sum + value, 0) / scaleValues.length;
  return Number(average.toFixed(1));
}

function buildDashboardData(
  campaign: BackendCampaign,
  progress: BackendCampaignProgress,
  responses: BackendResponse[],
): DashboardData {
  const employeesData = buildCampaignEmployeeRecords(campaign, progress, responses);
  const respondedEmployees = employeesData.filter(
    (employee) => employee.responseStatus === "Responded",
  );
  const participationRate = progress.participation_rate;
  const stressValues = respondedEmployees
    .map((employee) => employee.stressScore)
    .filter((value) => value > 0);
  const averageStressValue = stressValues.length
    ? stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length
    : 0;
  const departmentAverages = buildDepartmentStressBars(employeesData);
  const filteredResponses = filterResponsesForCampaign(campaign, progress, responses);

  return {
    metrics: {
      participationRate,
      averageStress: averageStressValue.toFixed(1),
      responded: respondedEmployees.length,
      totalEmployees: progress.total_participants,
      alertsDetected: departmentAverages.filter((item) => Number(item.average) >= 4).length,
    },
    trendByRange: buildTrendByRange(filteredResponses),
    departmentDistribution: buildDepartmentDistributionFromParticipants(progress),
    insights: buildInsights(campaign, departmentAverages, participationRate),
  };
}

function buildResultsData(
  campaign: BackendCampaign,
  progress: BackendCampaignProgress,
  responses: BackendResponse[],
): ResultsData {
  const employeesData = buildCampaignEmployeeRecords(campaign, progress, responses);
  const respondedEmployees = employeesData.filter(
    (employee) => employee.responseStatus === "Responded",
  );
  const participationRate = progress.participation_rate;
  const stressValues = respondedEmployees
    .map((employee) => employee.stressScore)
    .filter((value) => value > 0);
  const averageStressValue = stressValues.length
    ? stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length
    : 0;
  const bars = buildDepartmentStressBars(employeesData);
  const filteredResponses = filterResponsesForCampaign(campaign, progress, responses);

  return {
    metrics: {
      participationRate,
      averageStress: averageStressValue.toFixed(1),
    },
    bars,
    analysis: buildAnalysis(bars, filteredResponses.length),
  };
}

function buildReportData(
  campaign: BackendCampaign,
  progress: BackendCampaignProgress,
  responses: BackendResponse[],
  reports: BackendReport[],
) {
  const latestReport = [...reports]
    .filter((entry) =>
      campaign ? entry.campaign?.id === campaign.id : true,
    )
    .sort((left, right) => {
      const leftDate = Date.parse(left.created_at);
      const rightDate = Date.parse(right.created_at);

      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
        return rightDate - leftDate;
      }

      return right.id - left.id;
    })[0];
  const resultsData = buildResultsData(campaign, progress, responses);
  const dashboardData = buildDashboardData(campaign, progress, responses);
  const riskAreas = resultsData.bars
    .filter((item) => Number(item.average) >= 3.5)
    .map((item) => item.department)
    .slice(0, 3);

  return {
    title: campaign
      ? `${campaign.name}`
      : reports[0]
        ? `${reports[0].campaign.name}`
        : DEFAULT_REPORT_FALLBACK.title,
    companyName: campaign?.company?.name ?? DEFAULT_REPORT_FALLBACK.companyName,
    participationRate: dashboardData.metrics.participationRate,
    averageStress: Number(resultsData.metrics.averageStress),
    alertCount: dashboardData.metrics.alertsDetected,
    riskAreas: riskAreas.length ? riskAreas : DEFAULT_REPORT_FALLBACK.riskAreas,
    recommendations: buildRecommendations(riskAreas, dashboardData.metrics.participationRate),
    archivedReportPath: latestReport?.report_path ?? null,
  };
}

function buildDepartmentStressBars(employeesData: EmployeeRecord[]) {
  const departments = Array.from(
    new Set(employeesData.map((employee) => employee.department).filter(Boolean)),
  );

  return departments.map((department) => {
    const records = employeesData.filter(
      (employee) =>
        employee.department === department &&
        employee.responseStatus === "Responded" &&
        employee.stressScore > 0,
    );
    const average = records.length
      ? records.reduce((sum, employee) => sum + employee.stressScore, 0) / records.length
      : 0;

    return {
      department,
      value: Number((average * 20).toFixed(0)),
      average: average.toFixed(1),
    };
  });
}

function buildDepartmentDistributionFromParticipants(progress: BackendCampaignProgress) {
  const palette = ["#F59E0B", "#FCD34D", "#D97706", "#92400E", "#B45309"];
  const totals = new Map<string, number>();

  for (const participant of progress.participants) {
    const department = participant.employee.department ?? "Non renseigne";
    totals.set(department, (totals.get(department) ?? 0) + 1);
  }

  const employeeCount = progress.participants.length || 1;

  return Array.from(totals.entries()).map(([label, count], index) => ({
    label,
    value: Number(((count / employeeCount) * 100).toFixed(0)),
    color: palette[index % palette.length],
  }));
}

function buildTrendByRange(responses: BackendResponse[]) {
  const scaleResponses = responses.filter(
    (response) => normalizeQuestionType(response.question?.question_type) === "scale",
  );
  const monthly = buildAveragedSeries(scaleResponses, "month", 7);
  const weekly = buildAveragedSeries(scaleResponses, "week", 5);

  return {
    monthly: monthly.length ? monthly : EMPTY_TREND_BY_RANGE.monthly,
    weekly: weekly.length ? weekly : EMPTY_TREND_BY_RANGE.weekly,
  };
}

function buildAveragedSeries(
  responses: BackendResponse[],
  granularity: "month" | "week",
  slots: number,
) {
  const now = new Date();
  const labels: { key: string; label: string }[] = [];

  for (let index = slots - 1; index >= 0; index -= 1) {
    const date = new Date(now);

    if (granularity === "month") {
      date.setMonth(now.getMonth() - index);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      labels.push({
        key,
        label: date.toLocaleString("fr-FR", { month: "short" }),
      });
    } else {
      date.setDate(now.getDate() - index * 7);
      const weekStart = getWeekStart(date);
      const key = weekStart.toISOString().slice(0, 10);
      labels.push({
        key,
        label: `S${labels.length + 1}`,
      });
    }
  }

  return labels.map(({ key, label }) => {
    const values = responses
      .filter((response) => getBucketKey(new Date(response.created_at), granularity) === key)
      .map((response) => Number(response.answer))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);

    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

    return {
      label,
      value: Number(average.toFixed(1)),
    };
  });
}

function getBucketKey(date: Date, granularity: "month" | "week") {
  if (granularity === "month") {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }

  return getWeekStart(date).toISOString().slice(0, 10);
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function buildInsights(
  currentCampaign: BackendCampaign | undefined,
  bars: { department: string; average: string }[],
  participationRate: number,
) {
  const mostExposed = [...bars]
    .sort((left, right) => Number(right.average) - Number(left.average))
    .slice(0, 2)
    .filter((item) => Number(item.average) > 0)
    .map((item) => item.department);

  const insights = [
    currentCampaign
      ? `Sondage actif: ${currentCampaign.name}.`
      : "Aucun sondage actif n'est remontee par l'API.",
    participationRate < 60
      ? "Le taux de participation reste faible et demande une relance ciblee."
      : "Le taux de participation permet une premiere lecture exploitable.",
  ];

  if (mostExposed.length) {
    insights.push(`Les departements les plus exposes sont ${mostExposed.join(" et ")}.`);
  }

  return insights;
}

function buildAnalysis(
  bars: { department: string; average: string }[],
  responseCount: number,
) {
  const ordered = [...bars].sort(
    (left, right) => Number(right.average) - Number(left.average),
  );
  const analysis = ordered
    .filter((item) => Number(item.average) > 0)
    .slice(0, 3)
    .map(
      (item) =>
        `${item.department}: stress moyen ${item.average}/5 sur les reponses consolidees.`,
    );

  if (!analysis.length) {
    analysis.push("Les donnees de reponse sont encore insuffisantes pour produire une analyse fine.");
  }

  if (responseCount > 0) {
    analysis.push(`${responseCount} reponses individuelles sont actuellement consolidees.`);
  }

  return analysis;
}

function buildRecommendations(riskAreas: string[], participationRate: number) {
  const recommendations = [
    participationRate < 70
      ? "Lancer une relance ciblee des collaborateurs n'ayant pas encore repondu."
      : "Maintenir un sondage de suivi reguliere pour conserver la dynamique de reponse.",
  ];

  if (riskAreas.length) {
    recommendations.push(
      `Prioriser un plan d'action manageriale sur ${riskAreas.join(", ")}.`,
    );
  }

  recommendations.push(
    "Documenter les signaux faibles remontes dans les questions ouvertes et suivre leur evolution.",
  );

  return recommendations;
}

function resolveSelectedCampaign(
  campaigns: BackendCampaign[],
  campaignId?: number | null,
) {
  return (
    (campaignId ? campaigns.find((item) => item.id === campaignId) : null) ??
    campaigns.find((item) => item.status === "active") ??
    campaigns[0]
  );
}

function sortCampaignsByRecency(left: BackendCampaign, right: BackendCampaign) {
  const leftTime = Date.parse(left.created_at);
  const rightTime = Date.parse(right.created_at);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.id - left.id;
}

function filterResponsesForCampaign(
  campaign: BackendCampaign,
  progress: BackendCampaignProgress,
  responses: BackendResponse[],
) {
  const questionIds = new Set((campaign.questions ?? []).map((question) => question.id));
  const participantIds = new Set(
    progress.participants.map((participant) => participant.employee.id),
  );

  return responses.filter((response) => {
    const employeeId = response.employee?.id;
    return Boolean(
      employeeId &&
        questionIds.has(response.question.id) &&
        participantIds.has(employeeId),
    );
  });
}

function buildCampaignEmployeeRecords(
  campaign: BackendCampaign,
  progress: BackendCampaignProgress,
  responses: BackendResponse[],
) {
  const filteredResponses = filterResponsesForCampaign(campaign, progress, responses);
  const responsesByEmployee = new Map<number, BackendResponse[]>();

  for (const response of filteredResponses) {
    const employeeId = response.employee?.id;

    if (!employeeId) {
      continue;
    }

    const current = responsesByEmployee.get(employeeId) ?? [];
    current.push(response);
    responsesByEmployee.set(employeeId, current);
  }

  return progress.participants.map((participant) => {
    const employeeResponses = responsesByEmployee.get(participant.employee.id) ?? [];
    const fullName =
      `${participant.employee.first_name ?? ""} ${participant.employee.last_name ?? ""}`.trim();

    return {
      id: participant.employee.id,
      documentId: `employee-${participant.employee.id}`,
      name: fullName || "Employe",
      email: participant.employee.email,
      department: participant.employee.department ?? "Non renseigne",
      stressScore: computeStressScore(employeeResponses),
      responseStatus:
        participant.status === "completed" || employeeResponses.length > 0
          ? "Responded"
          : "Not responded",
    } satisfies EmployeeRecord;
  });
}
