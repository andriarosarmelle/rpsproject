"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Info,
} from "lucide-react";
import { Card, Pill } from "@/components/rps/ui";
import { appFetch } from "@/lib/api";
import type {
  EmployeeManagementData,
  SurveyOption,
} from "@/lib/repositories/rps-repository";
import { formatTrpcError, getTrpcClient } from "@/lib/trpc/client";

type RemindResponse =
  | {
      reminded?: number;
      reminded_count?: number;
      remindedParticipants?: number;
      count?: number;
      success?: boolean;
      message?: string;
    }
  | undefined;

export function EmployeesTableDemo({
  managementData,
  companies,
  surveys,
  defaultCompanyId,
  defaultCampaignId,
  defaultCampaignName,
  campaignId: propCampaignId,
  companyId: propCompanyId,
}: {
  managementData: EmployeeManagementData;
  companies: { id: number; name: string }[];
  surveys: SurveyOption[];
  defaultCompanyId: number | null;
  defaultCampaignId: number | null;
  defaultCampaignName: string;
  campaignId?: number | null;
  companyId?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    defaultCompanyId ? String(defaultCompanyId) : (companies[0] ? String(companies[0].id) : ""),
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    defaultCampaignId ? String(defaultCampaignId) : "",
  );
  const [filter, setFilter] = useState<"all" | "completed" | "pending" | "reminded">("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [surveyDetails, setSurveyDetails] = useState<any>(null);
  const [surveyDetailsError, setSurveyDetailsError] = useState<string | null>(null);
  const [loadingSurveyDetails, setLoadingSurveyDetails] = useState(false);

  const availableSurveys = useMemo(() => {
    if (!selectedCompanyId) {
      return surveys;
    }

    return surveys.filter((survey) => String(survey.companyId) === selectedCompanyId);
  }, [selectedCompanyId, surveys]);

  const selectedSurvey =
    surveys.find((survey) => String(survey.id) === selectedCampaignId) ??
    availableSurveys[0] ??
    null;
  const lockedCompanyId =
    selectedSurvey?.companyId ? String(selectedSurvey.companyId) : selectedCompanyId;
  const hasCompanyMismatch = Boolean(
    selectedSurvey?.companyId &&
      selectedCompanyId &&
      String(selectedSurvey.companyId) !== selectedCompanyId,
  );
  const pendingParticipantsCount = managementData.participants.filter(
    (participant) => participant.status !== "completed",
  ).length;

  const [remindCompanyId, setRemindCompanyId] = useState<string>(
    selectedCompanyId || (companies[0] ? String(companies[0].id) : "")
  );
  const [remindCampaignId, setRemindCampaignId] = useState<string>(
    selectedCampaignId || ""
  );

  const remindAvailableSurveys = useMemo(() => {
    if (!remindCompanyId) return surveys;
    return surveys.filter((survey) => String(survey.companyId) === remindCompanyId);
  }, [remindCompanyId, surveys]);

  const filteredParticipants = useMemo(() => {
    return managementData.participants.filter((participant) => {
      const haystack =
        `${participant.name} ${participant.email} ${participant.department}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesFilter = filter === "all" || participant.status === filter;
      const matchesCompany =
        !lockedCompanyId ||
        (managementData.companyId !== null && String(managementData.companyId) === lockedCompanyId);

      return matchesQuery && matchesFilter && matchesCompany;
    });
  }, [filter, lockedCompanyId, managementData.companyId, managementData.participants, query]);

  function pushSelection(nextCompanyId: string, nextCampaignId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextCompanyId) {
      params.set("companyId", nextCompanyId);
    } else {
      params.delete("companyId");
    }

    if (nextCampaignId) {
      params.set("campaignId", nextCampaignId);
    } else {
      params.delete("campaignId");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSurveySelection(nextCampaignId: string) {
    setSelectedCampaignId(nextCampaignId);

    const nextSurvey = surveys.find((survey) => String(survey.id) === nextCampaignId) ?? null;
    const nextCompanyId = nextSurvey?.companyId ? String(nextSurvey.companyId) : "";

    if (nextCompanyId && nextCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(nextCompanyId);
    }

    pushSelection(nextCompanyId, nextCampaignId);
  }

  function resolveCampaignId() {
    if (selectedCampaignId) {
      return Number(selectedCampaignId);
    }

    if (selectedSurvey?.id) {
      return selectedSurvey.id;
    }

    return propCampaignId ?? managementData.campaignId;
  }

  function resolveCompanyId() {
    if (lockedCompanyId) {
      return Number(lockedCompanyId);
    }

    if (selectedSurvey?.companyId) {
      return selectedSurvey.companyId;
    }

    return propCompanyId ?? managementData.companyId;
  }

  // Fetch survey details when campaign changes
  useEffect(() => {
    const campaignId = resolveCampaignId();

    if (!campaignId) {
      setSurveyDetails(null);
      setSurveyDetailsError(null);
      return;
    }

    const fetchSurveyDetails = async () => {
      setLoadingSurveyDetails(true);
      setSurveyDetailsError(null);
      try {
        const details = await getTrpcClient().adminSurveys.campaigns.findOne.query(campaignId);
        setSurveyDetails(details);
      } catch (err) {
        setSurveyDetails(null);
        const message = formatTrpcError(err);

        if (/404|not found|introuvable/i.test(message)) {
          setSurveyDetailsError("Le sondage sélectionné est introuvable ou a été supprimé.");
        } else if (/backend unavailable|fetch failed|network|ECONNREFUSED|ENOTFOUND/i.test(message)) {
          setSurveyDetailsError("Le backend est indisponible pour charger le détail du sondage.");
        } else if (/not configured|PRECONDITION_FAILED/i.test(message)) {
          setSurveyDetailsError("Le backend n'est pas configuré pour charger le détail du sondage.");
        } else {
          setSurveyDetailsError(message || "Une erreur est survenue lors du chargement du sondage.");
        }
      } finally {
        setLoadingSurveyDetails(false);
      }
    };

    fetchSurveyDetails();
  }, [selectedCampaignId, surveys]);

  async function handleRemindPending() {
    const campaignId = Number(remindCampaignId);
    const companyId = Number(remindCompanyId);

    if (!campaignId || !companyId) {
      setError("Sélectionnez une entreprise et un sondage valides pour procéder.");
      return;
    }

    const remindSurvey = remindAvailableSurveys.find(s => String(s.id) === remindCampaignId);
    if (remindSurvey && companyId !== remindSurvey.companyId) {
      setError("L’entreprise choisie ne correspond pas au sondage sélectionné.");
      return;
    }

    const pendingCount = managementData.participants.filter(
      (participant) => participant.status !== "completed",
    ).length;

    if (pendingCount === 0) {
      setFeedback("Aucun employé en attente de réponse.");
      return;
    }

    if (!confirm(`Relancer ${pendingCount} employé(s) n'ayant pas encore répondu ?`)) {
      return;
    }

    setError(null);
    setFeedback(null);
    setIsPending(true);

    try {
      const directResult = (await getTrpcClient().campaignParticipants.remind.mutate({
        campaignId,
        force: true,
      })) as RemindResponse;
      const remindedCount = extractRemindedCount(directResult) ?? pendingCount;

      setFeedback(`Relance envoyée à ${remindedCount} employé(s).`);
      router.refresh();
    } catch {
      try {
        const response = await appFetch("/api/webhook/n8n/remind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            companyId,
            remindPending: true,
            message: "Rappel : Votre participation au sondage RPS est attendue.",
          }),
        });

        if (!response.ok) {
          throw new Error("Échec de l'appel à n8n");
        }

        const fallbackResult = (await response.json()) as RemindResponse;
        const remindedCount = extractRemindedCount(fallbackResult) ?? pendingCount;

        setFeedback(`Relance envoyée à ${remindedCount} employé(s).`);
      } catch {
        setError("La relance a échoué. Vérifiez la configuration n8n.");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card className="p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Suivi du sondage
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-lg sm:text-xl font-bold">
            Gestion des participants
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sélectionnez un sondage pour consulter les participants, suivre leur statut et ouvrir
            leurs liens individuels.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Building2 className="h-4 w-4 text-amber-600" />
                Entreprise
              </p>
              <div className="relative">
                <select
                  value={selectedCompanyId}
                  onChange={(event) => {
                    setSelectedCompanyId(event.target.value);
                    const companySurveys = surveys.filter(
                      (survey) => String(survey.companyId) === event.target.value
                    );
                    if (companySurveys.length > 0) {
                      handleSurveySelection(String(companySurveys[0].id));
                    }
                  }}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition-all duration-200 hover:border-amber-300 hover:shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">-- Choisir une entreprise --</option>
                  {companies.map((company) => {
                    const companySurveys = surveys.filter(
                      (survey) => survey.companyId === company.id
                    );
                    return (
                      <option key={company.id} value={String(company.id)}>
                        {company.name} {companySurveys.length > 0 ? `(${companySurveys.length} sondage${companySurveys.length > 1 ? 's' : ''})` : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              {lockedCompanyId && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-700" />
                  <p className="text-xs text-amber-800">
                    Entreprise sélectionnée : <span className="font-semibold">{companies.find(c => String(c.id) === lockedCompanyId)?.name}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 className="h-4 w-4 text-amber-600" />
                Sondage
              </p>
              <div className="relative">
                <select
                  value={selectedCampaignId}
                  onChange={(event) => handleSurveySelection(event.target.value)}
                  disabled={availableSurveys.length === 0}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition-all duration-200 hover:border-amber-300 hover:shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {availableSurveys.length === 0 ? (
                    <option value="">Aucun sondage disponible</option>
                  ) : (
                    <>
                      <option value="">-- Choisir un sondage --</option>
                      {availableSurveys.map((survey) => (
                        <option key={survey.id} value={String(survey.id)}>
                          {survey.title}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              {selectedCampaignId && selectedSurvey && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                  <Info className="h-4 w-4 text-blue-700" />
                  <p className="text-xs text-blue-800">
                    {selectedSurvey.title}
                  </p>
                </div>
              )}
            </div>
          </div>

          {hasCompanyMismatch ? (
            <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-medium text-rose-700">
                L’entreprise choisie ne correspond pas au sondage sélectionné.
              </p>
            </div>
          ) : null}

          {feedback ? (
            <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>{feedback}</span>
              </p>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Relance manuelle
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-lg sm:text-xl font-bold">
            Relancer les employés en attente
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sélectionnez l'entreprise et le sondage, puis envoyez une relance aux participants qui n'ont pas encore répondu.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Building2 className="h-4 w-4 text-amber-600" />
                Entreprise
              </p>
              <div className="relative">
                <select
                  value={remindCompanyId}
                  onChange={(event) => {
                    setRemindCompanyId(event.target.value);
                    const companySurveys = surveys.filter(
                      (survey) => String(survey.companyId) === event.target.value
                    );
                    if (companySurveys.length > 0) {
                      setRemindCampaignId(String(companySurveys[0].id));
                    } else {
                      setRemindCampaignId("");
                    }
                  }}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition-all duration-200 hover:border-amber-300 hover:shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">-- Choisir une entreprise --</option>
                  {companies.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 className="h-4 w-4 text-amber-600" />
                Sondage concerné
              </p>
              <div className="relative">
                <select
                  value={remindCampaignId}
                  onChange={(event) => setRemindCampaignId(event.target.value)}
                  disabled={remindAvailableSurveys.length === 0}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition-all duration-200 hover:border-amber-300 hover:shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {remindAvailableSurveys.length === 0 ? (
                    <option value="">Aucun sondage disponible</option>
                  ) : (
                    <>
                      <option value="">-- Choisir un sondage --</option>
                      {remindAvailableSurveys.map((survey) => (
                        <option key={survey.id} value={String(survey.id)}>
                          {survey.title}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[12px] bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Participants à relancer</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{pendingParticipantsCount}</p>
            <p className="mt-1 text-xs text-slate-500">
              Sondage sélectionné : {remindCampaignId ? remindAvailableSurveys.find(s => String(s.id) === remindCampaignId)?.title : "Aucun sondage"}
            </p>
          </div>

          <button
            onClick={handleRemindPending}
            disabled={isPending || !remindCampaignId}
            className="mt-4 w-full rounded-[12px] bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? "En cours..." : "Forcer une relance manuelle"}
          </button>
        </Card>
      </div>

      {/* Survey Details Card */}
      {selectedCampaignId && (
        <Card className="p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Détails du sondage
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-lg sm:text-xl font-bold">
            {loadingSurveyDetails ? "Chargement..." : (surveyDetails?.title || "Sondage sans titre")}
          </h3>
          
          {loadingSurveyDetails ? (
            <p className="mt-4 text-sm text-slate-500">Chargement des details...</p>
          ) : surveyDetailsError ? (
            <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-medium text-rose-700">{surveyDetailsError}</p>
            </div>
          ) : surveyDetails ? (
            <div className="mt-4 space-y-4">
              {/* Dates */}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 tracking-[0.05em]">Dates</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-[8px] bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Début</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {surveyDetails?.start_date
                        ? new Date(surveyDetails.start_date).toLocaleDateString('fr-FR')
                        : "Non défini"}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Fin</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {surveyDetails?.end_date
                        ? new Date(surveyDetails.end_date).toLocaleDateString('fr-FR')
                        : "Non défini"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {surveyDetails?.description && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 tracking-[0.05em]">Description</p>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {surveyDetails.description}
                  </p>
                </div>
              )}

              {/* Questions Count */}
              {surveyDetails?.questions && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 tracking-[0.05em]">Questions</p>
                  <div className="mt-2">
                    {surveyDetails.questions.length > 0 ? (
                      <Pill tone="neutral">
                        {surveyDetails.questions.length} question{surveyDetails.questions.length > 1 ? 's' : ''}
                      </Pill>
                    ) : (
                      <p className="text-sm text-slate-500">Aucune question</p>
                    )}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 tracking-[0.05em]">Statut</p>
                <div className="mt-2">
                  <Pill tone={surveyDetails?.status === 'active' ? 'success' : 'neutral'}>
                    {surveyDetails?.status === 'active' ? 'Actif' : 'Inactif'}
                  </Pill>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Aucun detail de sondage disponible.</p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-[family-name:var(--font-manrope)] text-lg sm:text-xl font-bold">
              Participants au sondage
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Liens individuels et statut de complétion.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un participant"
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none w-full sm:w-auto"
            />
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as "all" | "completed" | "pending" | "reminded")
              }
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="all">Tous</option>
              <option value="completed">Complétés</option>
              <option value="pending">En attente</option>
              <option value="reminded">Relancés</option>
            </select>
          </div>
        </div>

        {filteredParticipants.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-6">
            <p className="text-sm text-slate-500">Aucun participant trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-4 sm:px-6">Participant</th>
                  <th className="hidden px-4 py-4 sm:px-6 md:table-cell">Fonction</th>
                  <th className="px-4 py-4 sm:px-6">Statut</th>
                  <th className="hidden px-4 py-4 sm:px-6 lg:table-cell">Invitation</th>
                  <th className="px-4 py-4 sm:px-6">Lien sondage</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 sm:px-6">
                      <p className="font-semibold">{participant.name}</p>
                      <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                        {participant.email}
                      </p>
                    </td>
                    <td className="hidden px-4 py-4 text-slate-600 sm:px-6 md:table-cell">
                      {participant.department}
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-2">
                        <Pill
                          tone={
                            participant.status === "completed"
                              ? "success"
                              : participant.status === "reminded"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {participant.status}
                        </Pill>
                        <span className="text-xs text-slate-500">{participant.responseStatus}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 text-slate-600 sm:px-6 lg:table-cell">
                      <p className="text-xs sm:text-sm">{formatShortDate(participant.invitationSentAt)}</p>
                      {participant.reminderSentAt ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Relance : {formatShortDate(participant.reminderSentAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={participant.surveyUrl}
                          className="text-xs font-semibold text-amber-700 underline-offset-4 hover:underline sm:text-sm"
                        >
                          Ouvrir le lien
                        </Link>
                        <code className="max-w-[12rem] truncate text-xs text-slate-500 sm:max-w-[24rem]">
                          {participant.participationToken}
                        </code>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
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

function extractRemindedCount(result: RemindResponse) {
  if (!result) {
    return null;
  }

  return (
    result.reminded ??
    result.reminded_count ??
    result.remindedParticipants ??
    result.count ??
    null
  );
}
