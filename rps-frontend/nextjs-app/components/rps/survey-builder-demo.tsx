"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, GripHorizontal } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/rps/ui";
import type { SurveyBuilderData } from "@/lib/repositories/rps-repository";
import type { SurveyQuestion } from "@/lib/strapi/mappers";
import { getTrpcClient } from "@/lib/trpc/client";

const defaultChoiceOptions = ["Oui", "Partiellement", "Non"];
const scaleAnswerGuide = [
  { value: 1, label: "Pas du tout d'accord" },
  { value: 2, label: "Plutôt pas d'accord" },
  { value: 3, label: "Neutre" },
  { value: 4, label: "Plutôt d'accord" },
  { value: 5, label: "Tout à fait d'accord" },
];

type ImportedParticipantPayload = {
  employee?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    company_name?: string;
  };
  first_name?: string;
  last_name?: string;
  email?: string;
  company_name?: string;
  participation_token?: string;
  token?: string;
};

type ImportEmployeesResponse = {
  imported_employees?: number;
  participants?: ImportedParticipantPayload[];
};

type SendInvitationsResponse = {
  sent_count?: number;
  failed_count?: number;
  skipped_count?: number;
  message?: string;
};

type SurveyQuestionType = "scale" | "choice" | "text" | "section";

const templateByType: Record<SurveyQuestionType, SurveyQuestion> = {
  scale: {
    id: "new-scale",
    documentId: "question-template-scale",
    type: "scale",
    title: "Comment jugez-vous votre niveau d'énergie au travail ?",
    helpText: "Question échelle 1 à 5",
    orderIndex: 99,
  },
  choice: {
    id: "new-choice",
    documentId: "question-template-choice",
    type: "choice",
    title: "Votre manager clarifie-t-il les priorités ?",
    helpText: "Question à choix multiple",
    options: defaultChoiceOptions,
    orderIndex: 99,
  },
  text: {
    id: "new-text",
    documentId: "question-template-text",
    type: "text",
    title: "Quel point devrait être prioritaire sur le prochain trimestre ?",
    helpText: "Question texte libre",
    orderIndex: 99,
  },
  section: {
    id: "new-section",
    documentId: "question-template-section",
    type: "section",
    title: "Nouvelle section",
    helpText: "Titre de section pour regrouper les questions",
    orderIndex: 99,
  },
};

type SurveyBuilderMode = "create" | "edit";

export function SurveyBuilderDemo({
  initialData,
  mode,
}: {
  initialData: SurveyBuilderData;
  mode: SurveyBuilderMode;
}) {
  const router = useRouter();
  const initialCompanyId = getInitialCompanyId(initialData, mode);
  const [isPending, startTransition] = useTransition();
  const mutationInFlightRef = useRef(false);
  const [isMutating, setIsMutating] = useState(false);
  const [companies, setCompanies] = useState(initialData.companies);
  const [campaigns, setCampaigns] = useState(initialData.campaigns);
  const [campaignId, setCampaignId] = useState(
    mode === "create" ? null : initialData.campaignId,
  );
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [status, setStatus] = useState(mode === "create" ? "draft" : initialData.status);
  const [title, setTitle] = useState(() => (mode === "create" ? "" : initialData.title));
  const [description, setDescription] = useState(() =>
    mode === "create" ? "" : initialData.description,
  );
  const [startDate, setStartDate] = useState(toDateInputValue(initialData.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(initialData.endDate));
  const [questions, setQuestions] = useState(
    mode === "create"
      ? []
      : initialData.questions
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(ensureQuestionOptions),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsv, setImportCsv] = useState(
    "Nom,Prénom,Adresse courriel,Fonction\nLefebvre,Anne,anne.lefebvre@test.com,gestionnaire\nTremblay,Marc,marc.tremblay@test.com,cadre",
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<{
    count: number;
    participants: Array<{ name: string; email: string; link: string }>;
  } | null>(null);
  const [hasDownloadedLinks, setHasDownloadedLinks] = useState(false);
  const [hasSentInvitations, setHasSentInvitations] = useState(false);
  const [isSendingInvitations, setIsSendingInvitations] = useState(false);
  const [isPreparingImport, setIsPreparingImport] = useState(false);
  const [participantCount, setParticipantCount] = useState(
    mode === "create" ? 0 : initialData.participantCount,
  );
  const canEditQuestions = status !== "active";
  const isBusy = isPending || isMutating;
  const isCreateMode = mode === "create";
  const selectedCompanyName =
    companies.find((company) => company.id === companyId)?.name?.trim() ?? "";
  const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);
  const campaignMatchesCompany =
    !campaignId || !companyId || !selectedCampaign || selectedCampaign.companyId === companyId;
  const trimmedTitle = (title ?? "").trim();
  const trimmedDescription = description.trim();
  const effectiveCampaignTitle = trimmedTitle;
  const isDateRangeInvalid = isEndDateBeforeStartDate(startDate, endDate);
  const canSaveCampaign =
    Boolean(companyId) && effectiveCampaignTitle.length >= 3 && !isDateRangeInvalid;
  const isSurveyReadyForImport = Boolean(
    campaignId &&
      companyId &&
      campaignMatchesCompany &&
      status === "active" &&
      questions.length > 0,
  );
  const hasImportedEmployees = Boolean(
    participantCount > 0 ||
      (importSuccess && (importSuccess.count > 0 || importSuccess.participants.length > 0)),
  );
  const canActivateCampaign = Boolean(campaignId && questions.length > 0);
  const isAllStepsComplete = Boolean(
    campaignId && status === "active" && questions.length > 0 && hasImportedEmployees,
  );
  const invitationActionLabel = mode === "edit" ? "Renvoyer" : "Envoyer";
  useEffect(() => {
    setCompanies(initialData.companies);
    setCampaigns(initialData.campaigns);
    setCampaignId(mode === "create" ? null : initialData.campaignId);
    setCompanyId(getInitialCompanyId(initialData, mode));
    setNewCompanyName("");
    setStatus(mode === "create" ? "draft" : initialData.status);
    setTitle(mode === "create" ? "" : initialData.title);
    setDescription(mode === "create" ? "" : initialData.description);
    setStartDate(toDateInputValue(initialData.startDate));
    setEndDate(toDateInputValue(initialData.endDate));
    setQuestions(
      mode === "create"
        ? []
        : initialData.questions
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map(ensureQuestionOptions),
    );
    setFeedback(null);
    setError(null);
    setIsImportModalOpen(false);
    setImportFeedback(null);
    setImportError(null);
    setImportValidationErrors([]);
    setImportSuccess(null);
    setHasDownloadedLinks(false);
    setHasSentInvitations(false);
    setSelectedFileName(null);
    setIsPreparingImport(false);
    setIsSendingInvitations(false);
    setIsMutating(false);
    mutationInFlightRef.current = false;
    setParticipantCount(mode === "create" ? 0 : initialData.participantCount);
  }, [initialData, mode]);
  function runMutation<TResponse>(
    mutation: () => Promise<TResponse>,
    successMessage: string,
    optimistic?: () => void,
    onSuccess?: (result: TResponse) => void,
    refreshOnSuccess = true,
  ) {
    if (mutationInFlightRef.current) {
      return;
    }

    mutationInFlightRef.current = true;
    setIsMutating(true);
    setFeedback(null);
    setError(null);

    optimistic?.();

    startTransition(async () => {
      try {
        const result = await mutation();
        if (result !== undefined) {
          onSuccess?.(result);
        }
        setFeedback(successMessage);
        if (refreshOnSuccess) {
          router.refresh();
        }
      } catch (caughtError) {
        let errorMessage = "La mise à jour du sondage a échoué. Vérifiez le backend.";
        
        if (caughtError instanceof Error) {
          if (caughtError.message.includes("fetch") || caughtError.message.includes("Backend")) {
            errorMessage = "Impossible de joindre le serveur. Vérifiez que le backend est démarré.";
          } else if (caughtError.message.includes("Délai")) {
            errorMessage = caughtError.message;
          } else {
            errorMessage = caughtError.message;
          }
        }
        
        setError(errorMessage);
      } finally {
        mutationInFlightRef.current = false;
        setIsMutating(false);
      }
    });
  }

  function createCompany() {
    if (!isCreateMode) {
      setError("L'ajout d'entreprise est désactivé en mode modification.");
      return;
    }

    const trimmedName = newCompanyName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 150) {
      setError("Le nom de l'entreprise doit contenir entre 2 et 150 caractères.");
      return;
    }

    const alreadyExists = companies.some(
      (company) => company.name?.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (alreadyExists) {
      setError("Cette entreprise existe déjà. Selectionne-la dans la liste.");
      return;
    }

    runMutation<{ id: number; name: string }>(
      () =>
        getTrpcClient().adminSurveys.createCompany.mutate({
          name: trimmedName,
        }),
      "Entreprise créée et sélectionnée.",
      undefined,
      (result) => {
        setCompanies((current) => [...current, result]);
        setCompanyId(result.id);
        setCampaignId(null);
        setStatus("draft");
        setQuestions([]);
        setImportSuccess(null);
        setHasDownloadedLinks(false);
        setHasSentInvitations(false);
        setParticipantCount(0);
        setNewCompanyName("");
      },
      false,
    );
  }

  function validateCampaignBeforeSave() {
    if (!companyId) {
      setError("Choisis une entreprise avant d'enregistrer le sondage.");
      return false;
    }

    if (effectiveCampaignTitle.length < 3) {
      setError("Le nom du sondage doit contenir au moins 3 caractères.");
      return false;
    }

    if (isDateRangeInvalid) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return false;
    }

    if (mode === "edit" && !campaignId) {
      setError("Aucun sondage existant à modifier.");
      return false;
    }

    return true;
  }

  function handleCompanySelection(nextCompanyId: number) {
    setCompanyId(nextCompanyId);

    if (mode === "create") {
      setCampaignId(null);
      setStatus("draft");
      setQuestions([]);
      setImportSuccess(null);
      setHasDownloadedLinks(false);
      setHasSentInvitations(false);
      setParticipantCount(0);
      return;
    }
    
    const companyCampaigns = campaigns.filter((c) => c.companyId === nextCompanyId);

    if (companyCampaigns.length > 0) {
      const nextCampaign =
        companyCampaigns.find((campaign) => campaign.id === campaignId) ?? companyCampaigns[0];
      syncSelectedCampaign(nextCampaign.id);
      return;
    }

    setCampaignId(null);
    setStatus("draft");
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setQuestions([]);
    setImportSuccess(null);
    setHasDownloadedLinks(false);
    setHasSentInvitations(false);
    setParticipantCount(0);
    setError("Aucun sondage existant pour cette entreprise.");
  }

  function syncSelectedCampaign(nextCampaignId: number) {
    const nextCampaign = campaigns.find((campaign) => campaign.id === nextCampaignId);

    if (!nextCampaign) {
      return;
    }

    setCampaignId(nextCampaign.id);
    setCompanyId(nextCampaign.companyId);
    setStatus(nextCampaign.status);
    setTitle(nextCampaign.name);
    setDescription(nextCampaign.description);
    setStartDate(toDateInputValue(nextCampaign.startDate));
    setEndDate(toDateInputValue(nextCampaign.endDate));
    setQuestions(
      nextCampaign.questions
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(ensureQuestionOptions),
    );
    setImportSuccess(null);
    setHasDownloadedLinks(false);
    setHasSentInvitations(false);
    setParticipantCount(0);
    setFeedback("Chargement du sondage sélectionné...");
    setError(null);

    if (mode === "edit") {
      router.push(`/surveys?tab=edit&campaignId=${nextCampaign.id}`);
    }
  }

  function saveCampaign() {
    if (!validateCampaignBeforeSave()) {
      return;
    }

    const selectedCompanyId = companyId;
    if (selectedCompanyId === null) {
      setError("Choisis une entreprise avant d'enregistrer le sondage.");
      return;
    }

    if (campaignId) {
      runMutation(
        () =>
          getTrpcClient().adminSurveys.updateCampaign.mutate({
            campaignId,
            companyId: selectedCompanyId,
            title: effectiveCampaignTitle,
            description: trimmedDescription || undefined,
            startDate,
            endDate,
          }),
        "Sondage mis à jour.",
        undefined,
        (result) => {
          if (result?.status) {
            setStatus(result.status);
          }
          setCampaigns((current) =>
            current.map((campaign) =>
              campaign.id === campaignId
                ? {
                    ...campaign,
                    name: effectiveCampaignTitle,
                    description: trimmedDescription,
                    status: result?.status ?? campaign.status,
                    companyId: selectedCompanyId,
                    startDate,
                    endDate,
                    questions,
                  }
                : campaign,
            ),
          );
        },
        mode === "edit",
      );
      return;
    }

    runMutation<{ id: number; status?: string }>(
        () =>
          getTrpcClient().adminSurveys.createCampaign.mutate({
            companyId: selectedCompanyId,
            title: effectiveCampaignTitle,
            description: trimmedDescription || undefined,
            startDate,
            endDate,
          }),
      "Sondage créé.",
      undefined,
      (result) => {
        setCampaignId(result.id);
        setStatus(result.status ?? "preparation");
        setCampaigns((current) =>
          current.some((campaign) => campaign.id === result.id)
            ? current
            : [
                ...current,
                {
                  id: result.id,
                  name: effectiveCampaignTitle,
                  description: trimmedDescription,
                  status: result.status ?? "preparation",
                  companyId: selectedCompanyId,
                  startDate,
                  endDate,
                  questions: [],
                },
              ],
        );
        setParticipantCount(0);
      },
      false,
    );
  }

  async function ensureCampaignForImport() {
    if (!companyId) {
      setError("Choisis une entreprise avant d'importer les employés.");
      return null;
    }

    if (effectiveCampaignTitle.length < 3) {
      setError("Le nom du sondage doit contenir au moins 3 caractères avant l'import.");
      return null;
    }

    if (!trimmedDescription) {
      setError("Ajoute une description avant d'importer les employés.");
      return null;
    }

    if (isDateRangeInvalid) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return null;
    }

    if (campaignId) {
      return campaignId;
    }

    const selectedCompanyId = companyId;
    setIsPreparingImport(true);
    setFeedback(null);
    setError(null);

    try {
      const result = await getTrpcClient().adminSurveys.createCampaign.mutate({
        companyId: selectedCompanyId,
        title: effectiveCampaignTitle,
        description: trimmedDescription,
        startDate,
        endDate,
      });

      setCampaignId(result.id);
      setStatus(result.status ?? "preparation");
      setCampaigns((current) =>
        current.some((campaign) => campaign.id === result.id)
          ? current
          : [
              ...current,
              {
                id: result.id,
                name: effectiveCampaignTitle,
                description: trimmedDescription,
                status: result.status ?? "preparation",
                companyId: selectedCompanyId,
                startDate,
                endDate,
                questions: [],
              },
            ],
      );
      setParticipantCount(0);
      setFeedback("Sondage créé. Tu peux maintenant importer les employés.");
      return result.id;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "La création du sondage a échoué avant l'import.",
      );
      return null;
    } finally {
      setIsPreparingImport(false);
    }
  }

  async function openImportModal() {
    const ensuredCampaignId = await ensureCampaignForImport();

    if (!ensuredCampaignId || !companyId) {
      setError("Enregistrez d'abord le sondage avec son entreprise avant d'importer les employés.");
      return;
    }

    if (!campaignMatchesCompany) {
      setError("Le sondage sélectionné n'appartient pas à cette entreprise. Enregistrez ou sélectionnez le bon sondage avant l'import.");
      return;
    }

    if (!isSurveyReadyForImport) {
      setError(
        questions.length === 0
          ? "Crée et vérifie les questions avant d'activer puis d'importer les employés."
          : "Activez d'abord le sondage avant d'importer les employés.",
      );
      return;
    }

    setImportError(null);
    setImportFeedback(null);
    setHasDownloadedLinks(false);
    setHasSentInvitations(false);
    setIsImportModalOpen(true);
  }

  function closeImportModal() {
    setIsImportModalOpen(false);
  }

  function validateImportCsv() {
    const validation = validateCsvFormat(importCsv);
    setImportValidationErrors(validation.errors);
    return validation;
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError(null);
    setImportFeedback(null);
    setImportValidationErrors([]);
    setSelectedFileName(file.name);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();

      if (extension === "csv" || extension === "txt") {
        const text = await file.text();
        setImportCsv(normalizeCsv(text));
        setImportFeedback(`Fichier chargé : ${file.name}`);
        return;
      }

      if (!["xlsx", "xls"].includes(extension || "")) {
        setImportError("Format non supporté. Utilisez .xlsx, .xls, .csv ou .txt");
        return;
      }

      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("empty_workbook");
      }

      const firstSheet = workbook.Sheets[firstSheetName];

      // Use sheet_to_json for better data extraction and column mapping
      const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        setImportError("Le fichier Excel est vide ou ne contient aucune donnée.");
        return;
      }

      console.log(`[Excel Import] Extracted ${jsonData.length} rows from Excel file`);
      console.log("[Excel Import] Column headers:", Object.keys(jsonData[0]));

      // Map Excel columns to expected CSV format with flexible column name matching
      // NOTE: Company name is NOT in Excel - it comes from the selected campaign
      const normalizedData = jsonData.map((row) => {
        const keys = Object.keys(row);
        
        console.log("[Excel Import] Processing row with keys:", keys);

        // Flexible column mapping - exact match first, then partial match
        const findColumn = (aliases: string[]): string => {
          // Try exact match first (case-insensitive)
          for (const alias of aliases) {
            const exactMatch = keys.find(
              (key) => key.toLowerCase().trim() === alias.toLowerCase().trim()
            );
            if (exactMatch) {
              console.log(`[Excel Import] Exact match for "${alias}": "${exactMatch}"`);
              return row[exactMatch];
            }
          }
          
          // Then try partial match
          for (const alias of aliases) {
            const partialMatch = keys.find(
              (key) => key.toLowerCase().trim().includes(alias.toLowerCase().trim())
            );
            if (partialMatch) {
              console.log(`[Excel Import] Partial match for "${alias}": "${partialMatch}"`);
              return row[partialMatch];
            }
          }
          
          console.warn(`[Excel Import] No match found for aliases:`, aliases);
          return "";
        };

        const nom = findColumn(["Nom", "name", "last name", "nom de famille"]);
        const prenom = findColumn(["Prenom", "Prénom", "first name", "prenom"]);
        const email = findColumn(["Adresse courriel", "Adresse email", "Email", "Courriel", "E-mail", "Mail"]);
        const fonction = findColumn(["Fonction", "poste", "role", "titre", "department"]);

        console.log("[Excel Import] Extracted values:", { nom, prenom, email, fonction });

        return {
          Nom: String(nom).trim(),
          Prenom: String(prenom).trim(),
          "Adresse courriel": String(email).trim(),
          Fonction: String(fonction).trim(),
        };
      });

      // Convert to CSV with proper formatting
      // NOTE: Entreprise column is NOT included - backend uses campaign.company.name automatically
      const csvHeaders = ["Nom", "Prenom", "Adresse courriel", "Fonction"];
      const csvLines = [csvHeaders.join(",")];

      normalizedData.forEach((row: Record<string, string>) => {
        const values = csvHeaders.map((header) => {
          const value = row[header] || "";
          // Escape quotes and wrap in quotes if contains comma, quotes, or newlines
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvLines.push(values.join(","));
      });

      const parsedCsv = csvLines.join("\n");

      console.log("[Excel Import] Generated CSV preview (first 500 chars):", parsedCsv.slice(0, 500));
      console.log(`[Excel Import] Total rows in CSV: ${csvLines.length - 1}`);
      console.log(`[Excel Import] Company will be auto-set from campaign: ${selectedCompanyName || "N/A"}`);

      setImportCsv(normalizeCsv(parsedCsv));
      setImportFeedback(`Fichier chargé : ${file.name} (${jsonData.length} employés extraits, entreprise: ${selectedCompanyName || "auto"})`);
    } catch {
      setImportError("Le fichier n'a pas pu être lu. Vérifiez le format et réessayez.");
    } finally {
      event.target.value = "";
    }
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to the textarea copy path below.
      }
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.readOnly = true;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }

  function copyAllLinks() {
    if (!importSuccess) {
      return;
    }

    const links = importSuccess.participants.map((participant) => `${participant.name}: ${participant.link}`).join("\n");
    copyToClipboard(links).then((copied) => {
      setImportFeedback(
        copied
          ? "Tous les liens ont ete copiés dans le presse-papiers."
          : "La copie automatique n'est pas disponible dans ce navigateur. Telechargez la liste des liens.",
      );
    });
  }

  function downloadLinksList() {
    if (!importSuccess) {
      return;
    }

    const headers = ["Nom", "Prénom", "Email", "Fonction", "Lien sondage unique"];
    const rows = importSuccess.participants.map((participant) => {
      const parts = participant.name.split(" ");
      return [parts.slice(1).join(" "), parts[0] ?? "", participant.email, "", participant.link];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const exportMeta = [
      `Entreprise: ${selectedCompanyName || "Entreprise"}`,
      `Sondage: ${effectiveCampaignTitle || "Sondage"}`,
      `Date d'export: ${new Date().toLocaleDateString("fr-FR")}`,
      "",
    ].join("\n");

    const blob = new Blob([`\ufeff${exportMeta}\n${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Liens_${selectedCompanyName || "Entreprise"}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setHasDownloadedLinks(true);
    setImportFeedback("La liste des liens a été téléchargée.");
  }

  function handleImportEmployees() {
    if (!campaignId || !companyId) {
      setImportError("Enregistrez d'abord le sondage avant d'importer les employés.");
      return;
    }

    if (!campaignMatchesCompany) {
      setImportError("Le sondage selectionne n'appartient pas a cette entreprise. Enregistrez ou selectionnez le bon sondage avant l'import.");
      return;
    }

    if (!importCsv.trim()) {
      setImportError("Le fichier CSV est vide. Veuillez ajouter des données.");
      return;
    }

    const validation = validateImportCsv();
    if (!validation.valid) {
      setImportError(`Format CSV invalide. ${validation.errors.length} erreur(s) détectée(s).`);
      return;
    }

    if (validation.lineCount === 0) {
      setImportError("Aucune donnée à importer. Ajoutez au moins un employé.");
      return;
    }

    setImportError(null);
    setImportFeedback(null);

    startTransition(async () => {
      try {
        // Log data being sent to backend for debugging
        const csvLines = importCsv.split("\n").filter((line) => line.trim());
        console.log(`[Import Employees] Sending ${csvLines.length - 1} employees to backend`);
        console.log("[Import Employees] CSV headers:", csvLines[0]);
        console.log("[Import Employees] Company ID:", companyId);
        console.log("[Import Employees] Campaign ID:", campaignId);
        
        const rawResult = await getTrpcClient().campaignParticipants.importEmployees.mutate({
          campaignId,
          companyId,
          csv: importCsv,
        });
        const result = rawResult as ImportEmployeesResponse;

        console.log("[Import Employees] Backend response:", result);
        
        const participants = (result.participants ?? []).map((participant) => {
          // Backend returns employee data nested in employee object
          const firstName = participant.employee?.first_name || participant.first_name || "";
          const lastName = participant.employee?.last_name || participant.last_name || "";
          const email = participant.employee?.email || participant.email || "";
          const token = participant.participation_token || participant.token || "";

          console.log("Processing participant:", { firstName, lastName, email, token });

          return {
            name: `${firstName} ${lastName}`.trim() || "Employé",
            email,
            link: `${window.location.origin}/survey-response/${token}`,
          };
        });

        console.log("Processed participants:", participants);

        setImportSuccess({
          count: result.imported_employees || participants.length,
          participants,
        });
        setParticipantCount(result.imported_employees || participants.length);
        setHasDownloadedLinks(false);
        setHasSentInvitations(false);
        setImportFeedback("Import terminé. Vous pouvez maintenant télécharger la liste des employés avec leurs liens respectifs.");
        if (mode === "edit") {
          router.refresh();
        }
      } catch (caughtError) {
        let errorMessage = "L'import a échoué. Vérifiez le fichier et réessayez.";

        if (caughtError instanceof Error) {
          if (caughtError.message.includes("Délai d'attente")) {
            errorMessage = `${caughtError.message} - Essayez avec un fichier plus petit ou une meilleure connexion.`;
          } else {
            errorMessage = caughtError.message;
          }
        }

        setImportError(errorMessage);
      }
    });
  }

  function addQuestion(type: SurveyQuestionType) {
    if (!canEditQuestions) {
      setError("Impossible d'ajouter des questions quand le sondage est actif.");
      return;
    }

    if (!campaignId) {
      setError("Le sondage doit exister avant d'ajouter des questions.");
      return;
    }

    const template = ensureQuestionOptions(templateByType[type]);
    const temporaryId = `tmp-${Date.now()}`;

    runMutation<{ id: number }>(
      () =>
        getTrpcClient().adminSurveys.createQuestion.mutate({
          campaignId,
          title: template.title,
          type: type === "section" ? "text" : type,
          options: template.options,
          orderIndex: questions.length,
        }),
      type === "section" ? "Section ajoutée." : "Question ajoutée.",
      () =>
        setQuestions((current) => [
          ...current,
          { ...template, id: temporaryId, documentId: temporaryId },
        ]),
      (result) => {
        setQuestions((current) =>
          current.map((question) =>
            question.id === temporaryId
              ? {
                  ...question,
                  id: String(result.id),
                  documentId: `question-${result.id}`,
                }
              : question,
          ),
        );
      },
      mode === "edit",
    );
  }

  function updateQuestion(index: number, updates: Partial<SurveyQuestion>) {
    setQuestions((current) =>
      current.map((question, currentIndex) => {
        if (currentIndex !== index) {
          return question;
        }

        const nextQuestion = {
          ...question,
          ...updates,
        };

        if (updates.type === "choice") {
          nextQuestion.options = question.options?.length
            ? question.options
            : [...defaultChoiceOptions];
        }

        if (updates.type && updates.type !== "choice") {
          nextQuestion.options = undefined;
        }

        return nextQuestion;
      }),
    );
  }

  function updateChoiceOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) {
          return question;
        }

        const options = [...(question.options ?? [...defaultChoiceOptions])];
        options[optionIndex] = value;
        return { ...question, options };
      }),
    );
  }

  function addChoiceOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) {
          return question;
        }

        return {
          ...question,
          options: [
            ...(question.options ?? [...defaultChoiceOptions]),
            `Choix ${(question.options?.length ?? defaultChoiceOptions.length) + 1}`,
          ],
        };
      }),
    );
  }

  function removeChoiceOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) {
          return question;
        }

        const nextOptions = (question.options ?? []).filter((_, index) => index !== optionIndex);
        return {
          ...question,
          options: nextOptions.length ? nextOptions : [""],
        };
      }),
    );
  }

  function persistQuestion(question: SurveyQuestion, index: number) {
    if (!Number.isFinite(Number(question.id))) {
      setError("La question doit d'abord être créee avant édition détaillée.");
      return;
    }

    const trimmedQuestionTitle = question.title.trim();
    if (trimmedQuestionTitle.length < 5) {
      setError("Le texte de la question doit contenir au moins 5 caractères.");
      return;
    }

    const sanitizedOptions = sanitizeOptions(question.options);

    if (question.type === "choice" && sanitizedOptions.length < 2) {
      setError("Ajoute au moins deux choix pour un QCM.");
      return;
    }

    runMutation(
      () =>
        getTrpcClient().adminSurveys.updateQuestion.mutate({
          questionId: Number(question.id),
          title: trimmedQuestionTitle,
          type: question.type === "section" ? "text" : question.type,
          options: question.type === "choice" ? sanitizedOptions : undefined,
          orderIndex: index,
        }),
      question.type === "section" ? "Section mise à jour." : "Question mise à jour.",
      undefined,
      undefined,
      mode === "edit",
    );
  }

  function removeQuestion(question: SurveyQuestion) {
    if (!Number.isFinite(Number(question.id))) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      return;
    }

    runMutation(
      () =>
        getTrpcClient().adminSurveys.deleteQuestion.mutate({
          questionId: Number(question.id),
        }),
      "Question supprimée.",
      () => setQuestions((current) => current.filter((item) => item.id !== question.id)),
      undefined,
      mode === "edit",
    );
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length || !campaignId) {
      return;
    }

    const nextQuestions = questions.slice();
    [nextQuestions[index], nextQuestions[nextIndex]] = [nextQuestions[nextIndex], nextQuestions[index]];
    const reordered = nextQuestions.map((question, orderIndex) => ({
      ...question,
      orderIndex,
    }));
    setQuestions(reordered);

    const reorderableItems = reordered.filter((question) => Number.isFinite(Number(question.id)));

    runMutation(
      () =>
        getTrpcClient().adminSurveys.reorderQuestions.mutate({
          campaignId,
          items: reorderableItems.map((question) => ({
            questionId: Number(question.id),
            orderIndex: question.orderIndex,
          })),
        }),
      "Ordre des questions mis à jour.",
      undefined,
      undefined,
      mode === "edit",
    );
  }

  function changeCampaignStatus(action: "activateCampaign" | "terminateCampaign" | "archiveCampaign") {
    if (!campaignId) {
      setError("Aucun sondage actif n'est disponible.");
      return;
    }

    if (action === "activateCampaign") {
      if (!canSaveCampaign) {
        setError("Corriger les informations du sondage avant activation.");
        return;
      }
      if (questions.length === 0) {
        setError("Ajouter au moins une question avant d'activer le sondage.");
        return;
      }
    }

    const successMessage =
      action === "activateCampaign"
        ? "Sondage activé."
        : action === "terminateCampaign"
          ? "Sondage désactivé."
          : "Sondage archivé.";

    runMutation<{ status?: string }>(
      () => {
        if (action === "activateCampaign") {
          return getTrpcClient().adminSurveys.activateCampaign.mutate({ campaignId });
        }

        if (action === "terminateCampaign") {
          return getTrpcClient().adminSurveys.terminateCampaign.mutate({ campaignId });
        }

        return getTrpcClient().adminSurveys.archiveCampaign.mutate({ campaignId });
      },
      successMessage,
      undefined,
      (result) => {
        if (result?.status) {
          setStatus(result.status);
        }
      },
      mode === "edit",
    );
  }

  function handleActivateStep() {
    if (questions.length === 0) {
      setError("Ajouter d'abord des questions avant d'activer le sondage.");
      return;
    }

    if (!confirm("Es-tu sûr que toutes les questions du sondage sont correctes avant activation ?")) {
      return;
    }

    changeCampaignStatus("activateCampaign");
  }

  async function handleDeploymentStep() {
    if (!campaignId) {
      setError("Enregistrez d'abord le sondage avant l'envoi.");
      return;
    }

    const forceResend = mode === "edit";

    if (
      forceResend &&
      !confirm(
        "Renvoyer les invitations aux employes qui n'ont pas encore repondu ? Le lien affichera le contenu actuel du sondage.",
      )
    ) {
      return;
    }

    setIsSendingInvitations(true);
    setFeedback(null);
    setError(null);

    try {
      const rawResult = await getTrpcClient().campaignParticipants.sendInvitations.mutate({
        campaignId,
        force: forceResend,
      });
      const result = rawResult as SendInvitationsResponse;
      const sentCount = result.sent_count ?? 0;
      const failedCount = result.failed_count ?? 0;

      setHasSentInvitations(sentCount > 0);
      setFeedback(
        failedCount > 0
          ? `Invitations ${forceResend ? "renvoyees" : "envoyees"} a ${sentCount} employe(s), ${failedCount} echec(s).`
          : sentCount > 0
          ? `Invitations ${forceResend ? "renvoyees" : "envoyees"} a ${sentCount} employe(s).`
          : result.message ?? "Aucune nouvelle invitation a envoyer.",
      );
      if (mode === "edit") {
        router.refresh();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "L'envoi automatique a echoue.",
      );
    } finally {
      setIsSendingInvitations(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="overflow-hidden border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl font-extrabold tracking-tight text-slate-900">
              Configuration du sondage
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Entreprise, période, description, questions, activation et import.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleDeploymentStep}
              disabled={isBusy || isSendingInvitations || !isAllStepsComplete}
              className="inline-flex items-center justify-center rounded-[10px] bg-[#111827] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              {isSendingInvitations ? "Envoi..." : invitationActionLabel}
            </button>
            {importSuccess ? (
              <button
                type="button"
                onClick={downloadLinksList}
                disabled={isBusy || isSendingInvitations}
                className="inline-flex items-center justify-center rounded-[10px] border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
              >
                Télécharger les liens
              </button>
            ) : null}
            {hasSentInvitations ? (
              <p className="text-[11px] font-medium text-emerald-700">
                Invitations envoyées
              </p>
            ) : hasDownloadedLinks ? (
              <p className="text-[11px] font-medium text-emerald-700">
                Liens téléchargés
              </p>
            ) : isAllStepsComplete ? (
              <p className="text-[11px] font-medium text-slate-500">
                Prêt à envoyer
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Card 1: Entreprise */}
          <div className="relative rounded-[14px] border border-slate-200 bg-[#fbfbfc] p-4 flex flex-col">
            <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-700">
              1
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Entreprise
            </p>
            
            {/* Survey Selection Dropdown (Edit Mode) */}
            {mode === "edit" && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Sondage</label>
                <select
                  value={campaignId ?? ""}
                  onChange={(event) => {
                    const newCampaignId = Number(event.target.value);
                    if (newCampaignId) {
                      syncSelectedCampaign(newCampaignId);
                    }
                  }}
                  className="mt-1 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="" disabled>
                    Choisir un sondage
                  </option>
                  {campaigns
                    .filter((c) => c.companyId === companyId)
                    .map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.status})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <select
              value={companyId ?? ""}
              onChange={(event) => handleCompanySelection(Number(event.target.value))}
              className="mt-3 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="" disabled>
                Choisir
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {isCreateMode ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newCompanyName}
                  onChange={(event) => setNewCompanyName(event.target.value)}
                  className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Nouvelle..."
                />
                <button
                  type="button"
                  disabled={isBusy || newCompanyName.trim().length < 2}
                  onClick={createCompany}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-300 bg-[#4b5563] text-base font-bold text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +
                </button>
              </div>
            ) : null}
          </div>

          {/* Card 2: Periode */}
          <div className="relative rounded-[14px] border border-slate-200 bg-[#fbfbfc] p-4 flex flex-col">
            <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-700">
              2
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Période
            </p>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
            {isDateRangeInvalid ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>La date de fin doit être supérieure ou égale au début.</span>
              </p>
            ) : null}
          </div>

          {/* Card 3: Nom et description */}
          <div className="relative rounded-[14px] border border-slate-200 bg-[#fbfbfc] p-4 flex flex-col">
            <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-700">
              3
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Nom et description
            </p>
            <input
              className="mt-3 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nom du sondage"
            />
            <textarea
              className="mt-2 w-full resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description du sondage"
            />
          </div>

          {/* Card 4: Activation */}
          <div className="relative rounded-[14px] border border-slate-200 bg-[#fbfbfc] p-4 flex flex-col">
            <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-700">
              4
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Activation
            </p>
            {status !== "active" ? (
              <>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  Crée et vérifie les questions avant activation.
                </p>
                <button
                  type="button"
                  onClick={handleActivateStep}
                  disabled={!canActivateCampaign || isBusy}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-[10px] bg-[#111827] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Activer
                </button>
              </>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="inline-flex w-full items-center justify-center rounded-[10px] bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Actif
                </div>
                <button
                  type="button"
                  onClick={() => changeCampaignStatus("terminateCampaign")}
                  disabled={isBusy}
                  className="inline-flex w-full items-center justify-center rounded-[10px] border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Désactiver
                </button>
              </div>
            )}
          </div>

          {/* Card 5: Import */}
          <div className="relative rounded-[14px] border border-slate-200 bg-[#fbfbfc] p-4 flex flex-col">
            <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-700">
              5
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Import
            </p>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">
              Disponible après activation.
            </p>
            <button
              type="button"
              onClick={openImportModal}
              disabled={!isSurveyReadyForImport || isBusy || isPreparingImport}
              className="mt-3 inline-flex w-full items-center justify-center rounded-[10px] bg-[#111827] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPreparingImport ? "Préparation..." : "Importer"}
            </button>
            {hasImportedEmployees ? (
              <p className="mt-2 text-center text-[11px] font-medium text-emerald-700">
                {participantCount || importSuccess?.count || 0} employé(s) importé(s)
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Boutons d'action principaux */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <PrimaryButton
          disabled={isBusy || !canSaveCampaign || (mode === "edit" && !campaignId)}
          onClick={saveCampaign}
          className="sm:w-auto"
        >
          {isBusy ? "Enregistrement..." : campaignId ? "Enregistrer" : "Créer"}
        </PrimaryButton>
        {campaignId && (
          <SecondaryButton disabled={isBusy} onClick={() => changeCampaignStatus("archiveCampaign")} className="sm:w-auto">
            Archiver
          </SecondaryButton>
        )}
      </div>

      {/* Gestion des questions */}
      <div className="mt-4 sm:mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 mb-3">
          Gestion des questions
        </p>
        <p className="mb-4 rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Finalise les questions avant activation : ce contenu sera celui visible dans le lien envoyé aux employés.
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
          <SecondaryButton 
            disabled={isBusy || !campaignId || status === "active"} 
            onClick={() => addQuestion("scale")} 
            className="sm:w-auto"
          >
            Ajouter échelle 1-5
          </SecondaryButton>
          <SecondaryButton 
            disabled={isBusy || !campaignId || status === "active"} 
            onClick={() => addQuestion("choice")} 
            className="sm:w-auto"
          >
            Ajouter QCM
          </SecondaryButton>
          <SecondaryButton 
            disabled={isBusy || !campaignId || status === "active"} 
            onClick={() => addQuestion("text")} 
            className="sm:w-auto"
          >
            Ajouter texte libre
          </SecondaryButton>
        </div>

        {feedback && (
          <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>{feedback}</span>
            </p>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </p>
          </div>
        )}
        {questions.length === 0 && status === "active" && (
          <p className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            Attention : Au moins une question est requise avant d&apos;importer les employés. Ajoutez au moins une question maintenant.
          </p>
        )}
        {!canEditQuestions && questions.length > 0 && (
          <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Le sondage est actif. Les questions ne peuvent plus être modifiées tant qu&apos;il reste actif.
          </p>
        )}

        <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
          {questions.map((question, index) => {
            const isSection = question.type === "section";
            
            return (
              <div
                key={`${question.id}-${index}`}
                className={`rounded-[12px] sm:rounded-[16px] border p-3 sm:p-4 shadow-sm ${
                  isSection
                    ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {isSection ? (
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <GripHorizontal className="h-5 w-5 text-amber-700" />
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                          Section
                        </p>
                      </div>
                      <input
                        value={question.title}
                        onChange={(event) => updateQuestion(index, { title: event.target.value })}
                        disabled={!canEditQuestions}
                        className="w-full text-lg font-bold bg-transparent border-b-2 border-amber-300 pb-2 outline-none focus:border-amber-500"
                        placeholder="Titre de la section"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <SecondaryButton
                        className="flex-1 sm:flex-none px-3 py-2"
                        disabled={index === 0 || !canEditQuestions}
                        onClick={() => moveQuestion(index, -1)}
                      >
                        Monter
                      </SecondaryButton>
                      <SecondaryButton
                        className="flex-1 sm:flex-none px-3 py-2"
                        disabled={index === questions.length - 1 || !canEditQuestions}
                        onClick={() => moveQuestion(index, 1)}
                      >
                        Descendre
                      </SecondaryButton>
                      <SecondaryButton
                        className="flex-1 sm:flex-none px-3 py-2 text-red-600 hover:bg-red-50"
                        disabled={!canEditQuestions}
                        onClick={() => removeQuestion(question)}
                      >
                        Supprimer
                      </SecondaryButton>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                          Bloc {index + 1}
                        </p>
                        <p className="mt-2 text-sm font-semibold">{question.type}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <SecondaryButton
                          className="flex-1 sm:flex-none px-3 py-2"
                          disabled={index === 0 || !canEditQuestions}
                          onClick={() => moveQuestion(index, -1)}
                        >
                          Monter
                        </SecondaryButton>
                        <SecondaryButton
                          className="flex-1 sm:flex-none px-3 py-2"
                          disabled={index === questions.length - 1 || !canEditQuestions}
                          onClick={() => moveQuestion(index, 1)}
                        >
                          Descendre
                        </SecondaryButton>
                      </div>
                    </div>
                    <input
                      value={question.title}
                      onChange={(event) => updateQuestion(index, { title: event.target.value })}
                      disabled={!canEditQuestions}
                      className="mt-3 sm:mt-4 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none"
                    />
                    <select
                      value={question.type}
                      onChange={(event) =>
                        updateQuestion(index, { type: event.target.value as SurveyQuestion["type"] })
                      }
                      disabled={!canEditQuestions}
                      className="mt-3 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none"
                    >
                      <option value="scale">Echelle 1 a 5</option>
                      <option value="choice">QCM</option>
                      <option value="text">Texte libre</option>
                      <option value="section">Section</option>
                    </select>

                    {question.type === "scale" && (
                      <div className="mt-3 sm:mt-4 rounded-[12px] sm:rounded-[14px] border border-sky-200 bg-sky-50/70 p-3 sm:p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                          Lecture de l&apos;echelle
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Le répondant choisit une note de 1 à 5 pour indiquer son niveau d&apos;accord.
                        </p>
                        <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-5">
                          {scaleAnswerGuide.map((item) => (
                            <div
                              key={`scale-guide-${item.value}`}
                              className="rounded-[12px] border border-sky-200 bg-white px-3 py-3 text-center"
                            >
                              <p className="text-base font-bold text-sky-800">{item.value}</p>
                              <p className="mt-1 text-xs text-slate-600">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.type === "choice" && (
                      <div className="mt-3 sm:mt-4 rounded-[12px] sm:rounded-[14px] border border-amber-200 bg-amber-50/50 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                            Choix du QCM
                          </p>
                          <SecondaryButton
                            className="w-full sm:w-auto px-3 py-2"
                            disabled={(question.options?.length ?? 0) >= 6 || !canEditQuestions}
                            onClick={() => addChoiceOption(index)}
                          >
                            Ajouter un choix
                          </SecondaryButton>
                        </div>
                        <div className="mt-3 space-y-3">
                          {(question.options ?? [...defaultChoiceOptions]).map((option, optionIndex) => (
                            <div key={`${question.id}-option-${optionIndex}`} className="flex gap-2 sm:gap-3">
                              <input
                                value={option}
                                onChange={(event) => updateChoiceOption(index, optionIndex, event.target.value)}
                                disabled={!canEditQuestions}
                                className="w-full rounded-[12px] border border-amber-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none"
                                placeholder={`Choix ${optionIndex + 1}`}
                              />
                              <SecondaryButton
                                className="px-3 py-2 shrink-0"
                                disabled={(question.options?.length ?? 0) <= 2 || !canEditQuestions}
                                onClick={() => removeChoiceOption(index, optionIndex)}
                              >
                                Retirer
                              </SecondaryButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                      <PrimaryButton disabled={isBusy || !canEditQuestions} onClick={() => persistQuestion(question, index)} className="w-full sm:w-auto">
                        Enregistrer la question
                      </PrimaryButton>
                      <SecondaryButton disabled={isBusy || !canEditQuestions} onClick={() => removeQuestion(question)} className="w-full sm:w-auto">
                        Supprimer
                      </SecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] px-4 sm:px-6 py-3 sm:py-4 text-white">
          <p className="text-xs sm:text-sm text-slate-300">Aperçu du sondage</p>
          <h3 className="mt-1 font-[family-name:var(--font-manrope)] text-lg sm:text-xl font-bold">
            Aperçu du questionnaire
          </h3>
        </div>
        <div className="space-y-3 sm:space-y-4 p-3 sm:p-6">
          <div className="rounded-[12px] sm:rounded-[16px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Sondage
            </p>
            <p className="mt-2 text-base sm:text-lg font-semibold">
              {effectiveCampaignTitle || "Entreprise a definir"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {companies.find((company) => company.id === companyId)?.name ?? "Entreprise a definir"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>

          {questions.map((question, index) => (
            <div key={`${question.id}-preview-${index}`} className="rounded-[12px] sm:rounded-[16px] border border-slate-200 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Question {index + 1}
              </p>
              <p className="mt-2 text-sm font-medium">{question.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {question.type === "scale"
                  ? "Reponse attendue sur une echelle de 1 a 5, de pas du tout d&apos;accord a tout a fait d&apos;accord."
                  : question.type === "choice"
                    ? "Selection d'un choix parmi les options ci-dessous."
                    : "Champ libre pour commentaire qualitatif."}
              </p>
              {question.type === "scale" && (
                <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-5">
                  {scaleAnswerGuide.map((item) => (
                    <div
                      key={`${question.id}-scale-preview-${item.value}`}
                      className="rounded-[12px] border border-sky-200 bg-sky-50/60 px-3 py-2 text-center"
                    >
                      <p className="text-sm font-bold text-sky-800">{item.value}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {question.type === "choice" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sanitizeOptions(question.options).map((option) => (
                    <span
                      key={`${question.id}-${option}`}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isImportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/55 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl my-4 sm:my-0 rounded-[16px] sm:rounded-[24px] bg-white shadow-2xl overflow-y-auto max-h-[95vh] sm:max-h-[92vh]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 sm:gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 py-4 sm:py-5">
              <div className="flex-1 pr-8 sm:pr-12">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Import des employés
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-xl sm:text-2xl font-bold text-slate-900">
                  {effectiveCampaignTitle || "Sondage"} - {selectedCompanyName || "Entreprise"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Chargez ici le fichier des employés. 
                  Une fois l&apos;import terminé, 
                  vous pourrez télécharger la liste des liens individuels.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                className="shrink-0 rounded-[12px] border border-slate-200 px-3 sm:px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 py-4 sm:py-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                {[
                  {
                    step: 1,
                    title: "Sondage activé",
                    body: "Les questions sont validées avant l'import et l'envoi des liens.",
                    done: Boolean(campaignId && status === "active" && questions.length > 0),
                  },
                  {
                    step: 2,
                    title: "Importer les employés",
                    body: "Chargez votre fichier Excel ou CSV dans la zone prévue.",
                    done: hasImportedEmployees,
                  },
                  {
                    step: 3,
                    title: "Télécharger les liens",
                    body: "Téléchargez les liens individuels une fois l'import terminé.",
                    done: hasDownloadedLinks,
                  },
                ].map((item) => (
                  <div
                    key={`modal-step-${item.step}`}
                    className={`rounded-[12px] sm:rounded-[16px] border p-3 sm:p-4 ${
                      item.done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-900">
                        {item.step}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.done ? "Terminé" : "En cours"}</p>
                      </div>
                    </div>
                    <p className="mt-2 sm:mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>

              <Card className="p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Etape 2
                </p>
                <div className="mt-4 rounded-[12px] border border-dashed border-slate-300 bg-slate-50/80 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Ajouter un fichier</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Formats acceptés : .xlsx, .xls, .csv
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-[12px] border border-slate-200 bg-[#181818] px-4 py-2.5 sm:py-3 text-sm font-semibold text-white transition hover:bg-[#242424]">
                      Choisir un fichier
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt"
                        className="hidden"
                        onChange={handleImportFileChange}
                      />
                    </label>
                  </div>
                  {selectedFileName ? (
                    <p className="mt-3 text-xs text-slate-500">Fichier sélectionné : {selectedFileName}</p>
                  ) : null}
                </div>

                <div className="mt-4 sm:mt-5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Données CSV
                    </label>
                    {importCsv.trim() ? (
                      <button
                        type="button"
                        onClick={validateImportCsv}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        Vérifier le format
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    value={importCsv}
                    onChange={(event) => {
                      setImportCsv(event.target.value);
                      setImportValidationErrors([]);
                    }}
                    className="mt-2 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none font-mono min-h-32 sm:min-h-40"
                    placeholder="Nom,Prenom,Adresse courriel,Fonction"
                  />
                </div>

                {importValidationErrors.length > 0 ? (
                  <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-3 sm:px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      {importValidationErrors.length} erreur(s) détectée(s)
                    </p>
                    <ul className="mt-2 space-y-1">
                      {importValidationErrors.map((validationError, index) => (
                        <li key={`validation-${index}`} className="text-xs text-amber-700">
                          • {validationError}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {importFeedback ? (
                  <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-3">
                    <p className="text-sm font-medium text-emerald-700">{importFeedback}</p>
                  </div>
                ) : null}
                {importError ? (
                  <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-3 sm:px-4 py-3">
                    <p className="text-sm font-medium text-rose-700">{importError}</p>
                  </div>
                ) : null}

                <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                  <PrimaryButton
                    disabled={isBusy || !importCsv.trim() || importValidationErrors.length > 0}
                    onClick={handleImportEmployees}
                    className="w-full sm:w-auto"
                  >
                    {isBusy ? "Import en cours..." : "Importer les employés"}
                  </PrimaryButton>
                  <SecondaryButton onClick={closeImportModal} disabled={isBusy} className="w-full sm:w-auto">
                    Fermer
                  </SecondaryButton>
                </div>
              </Card>

              {importSuccess ? (
                <Card className="p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Liste des employés et liens
                  </p>
                  <h4 className="mt-2 text-base sm:text-lg font-bold text-slate-900">
                    {importSuccess.count} employé(s) importé(s)
                  </h4>
                  <p className="mt-2 text-sm text-slate-600">
                    L&apos;import est terminé. Vous pouvez maintenant télécharger la liste des liens.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                    <PrimaryButton onClick={downloadLinksList} className="w-full sm:w-auto">
                      Télécharger les liens
                    </PrimaryButton>
                    <SecondaryButton onClick={copyAllLinks} className="w-full sm:w-auto">Copier tous les liens</SecondaryButton>
                  </div>
                  <div className="mt-4 sm:mt-5 max-h-60 sm:max-h-72 space-y-2 sm:space-y-3 overflow-y-auto">
                    {importSuccess.participants.map((participant, index) => (
                      <div
                        key={`participant-link-${index}`}
                        className="flex flex-col gap-2 sm:gap-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3 sm:p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{participant.name}</p>
                          <p className="text-xs text-slate-500">{participant.email}</p>
                        </div>
                        <code className="block flex-1 truncate text-xs text-slate-600">
                          {participant.link}
                        </code>
                        <SecondaryButton
                          className="w-full sm:w-auto px-3 sm:px-4 py-2"
                          onClick={() =>
                            copyToClipboard(participant.link).then((copied) => {
                              setImportFeedback(
                                copied
                                  ? `Lien copie pour ${participant.name}.`
                                  : "La copie automatique n'est pas disponible dans ce navigateur. Telechargez la liste des liens.",
                              );
                            })
                          }
                        >
                          Copier
                        </SecondaryButton>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getInitialCompanyId(initialData: SurveyBuilderData, mode: SurveyBuilderMode) {
  if (mode === "create") {
    return initialData.companies[0]?.id ?? null;
  }

  return initialData.companyId;
}

function sanitizeOptions(options?: string[]) {
  return (options ?? []).map((option) => option.trim()).filter(Boolean);
}

function normalizeCsv(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function validateCsvFormat(rawCsv: string): { valid: boolean; errors: string[]; lineCount: number } {
  const errors: string[] = [];
  const csv = normalizeCsv(rawCsv);
  const lines = csv.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    errors.push("Le fichier est vide. Veuillez ajouter des donnees.");
    return { valid: false, errors, lineCount: 0 };
  }

  if (lines.length < 2) {
    errors.push("Le CSV doit contenir un en-tete et au moins une ligne de donnees.");
    return { valid: false, errors, lineCount: 0 };
  }

  const detectCsvDelimiter = (line: string) => {
    const supportedDelimiters = [",", ";", "\t"] as const;
    let bestDelimiter: (typeof supportedDelimiters)[number] =
      supportedDelimiters[0];
    let bestCount = -1;

    for (const delimiter of supportedDelimiters) {
      let count = 0;
      let inQuotes = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === '"') {
          if (inQuotes && line[index + 1] === '"') {
            index += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }

        if (!inQuotes && char === delimiter) {
          count += 1;
        }
      }

      if (count > bestCount) {
        bestDelimiter = delimiter;
        bestCount = count;
      }
    }

    return bestDelimiter;
  };

  const delimiter = detectCsvDelimiter(lines[0]);

  // Parse headers (handle quoted CSV fields)
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  console.log("[CSV Validation] Detected headers:", headers);
  
  // Required columns with flexible matching (backend is flexible, so frontend should be too)
  // Email column can be: "adresse courriel", "courriel", "email", "adresse email", etc.
  const hasNameColumn = headers.some((h) => h.includes("nom") || h.includes("name") || h.includes("last"));
  const hasFirstNameColumn = headers.some((h) => h.includes("prenom") || h.includes("first") || h.includes("prénom"));
  const hasEmailColumn = headers.some((h) => 
    h.includes("email") || h.includes("courriel") || h.includes("mail")
  );
  const hasFunctionColumn = headers.some((h) => 
    h.includes("fonction") || h.includes("role") || h.includes("poste") || h.includes("title") || h.includes("department")
  );
  
  const missingHeaders = [];
  if (!hasNameColumn) missingHeaders.push("nom/name");
  if (!hasFirstNameColumn) missingHeaders.push("prenom/first name");
  if (!hasEmailColumn) missingHeaders.push("email/courriel");
  if (!hasFunctionColumn) missingHeaders.push("fonction/role");

  if (missingHeaders.length > 0) {
    errors.push(`Colonnes manquantes : ${missingHeaders.join(", ")}. Colonnes détectées : ${headers.join(", ")}`);
  }

  // Find email column (flexible matching)
  const emailIndex = headers.findIndex(
    (header) => header.includes("email") || header.includes("courriel") || header.includes("mail"),
  );

  if (emailIndex === -1) {
    errors.push("Aucune colonne email trouvée. Utilisez email, courriel, ou adresse courriel.");
  }

  let validEmails = 0;
  let emptyEmailCount = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);

    if (values.length < headers.length) {
      errors.push(`Ligne ${index + 1}: nombre de colonnes insuffisant.`);
      continue;
    }

    if (emailIndex >= 0) {
      const email = values[emailIndex].replace(/^["']|["']$/g, "").trim();
      if (!email) {
        emptyEmailCount++;
        errors.push(`Ligne ${index + 1}: email vide. Tous les employés doivent avoir une adresse email.`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Ligne ${index + 1}: email invalide "${email}"`);
      } else {
        validEmails += 1;
      }
    }
  }

  return {
    valid: errors.length === 0 && validEmails > 0,
    errors: errors.slice(0, 6),
    lineCount: lines.length - 1,
  };
}

function ensureQuestionOptions(question: SurveyQuestion): SurveyQuestion {
  if (question.type !== "choice") {
    return question;
  }

  return {
    ...question,
    options: sanitizeOptions(question.options).length
      ? sanitizeOptions(question.options)
      : [...defaultChoiceOptions],
  };
}

function toDateInputValue(value: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function isEndDateBeforeStartDate(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return false;
  }

  return new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`);
}


