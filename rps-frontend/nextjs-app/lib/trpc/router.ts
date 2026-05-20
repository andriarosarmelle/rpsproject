import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	isBackendConfigured,
} from "@/lib/backend/client";
import { getAppBaseUrl } from "@/lib/api";
import {
	deleteServerBackend as deleteBackend,
	getServerBackendItem as getBackendItem,
	patchServerBackend as patchBackend,
	postServerBackend as postBackend,
} from "@/lib/backend/server";
import {
	getDashboardData,
	getEmployeeManagementData,
	getReportData,
	getResultsData,
	getSurveyBuilderData,
	getSurveyResponseData,
	getAllSurveys,
} from "@/lib/repositories/rps-repository";

const t = initTRPC.create();

const scenarioSchema = z.string().optional().nullable();

function ensureBackendConfigured() {
	if (!isBackendConfigured()) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"Backend API URL is not configured. Set NEXT_PUBLIC_API_URL for browser requests and API_URL for server-side requests.",
		});
	}
}

const adminSurveysRouter = t.router({
	createCompany: t.procedure
		.input(
			z.object({
				name: z.string().min(2),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<{ id: number; name: string }, { name: string }>("/companies", {
				name: input.name,
			});
		}),

	createCampaign: t.procedure
		.input(
			z.object({
				companyId: z.number().int().positive(),
				title: z.string().min(1),
				description: z.string().max(1000).optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<
				{ id: number; status?: string },
				{
					company_id: number;
					name: string;
					description?: string;
					start_date?: string;
					end_date?: string;
				}
			>("/campaigns", {
				company_id: input.companyId,
				name: input.title,
				description: input.description || undefined,
				start_date: input.startDate || undefined,
				end_date: input.endDate || undefined,
			});
		}),

	updateCampaign: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				companyId: z.number().int().positive(),
				title: z.string().min(1),
				description: z.string().max(1000).optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return patchBackend<
				{ id: number; status?: string },
				{
					company_id: number;
					name: string;
					description?: string;
					start_date?: string;
					end_date?: string;
				}
			>(`/campaigns/${input.campaignId}`, {
				company_id: input.companyId,
				name: input.title,
				description: input.description || undefined,
				start_date: input.startDate || undefined,
				end_date: input.endDate || undefined,
			});
		}),

	activateCampaign: t.procedure
		.input(z.object({ campaignId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<{ status?: string }, Record<string, never>>(
				`/campaigns/${input.campaignId}/activate`,
				{},
			);
		}),

	terminateCampaign: t.procedure
		.input(z.object({ campaignId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<{ status?: string }, Record<string, never>>(
				`/campaigns/${input.campaignId}/terminate`,
				{},
			);
		}),

	archiveCampaign: t.procedure
		.input(z.object({ campaignId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<{ status?: string }, Record<string, never>>(
				`/campaigns/${input.campaignId}/archive`,
				{},
			);
		}),

	createQuestion: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				title: z.string().min(1),
				type: z.enum(["scale", "choice", "text"]),
				options: z.array(z.string()).optional(),
				orderIndex: z.number().int().min(0),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<
				{ id: number },
				{
					campaign_id: number;
					question_text: string;
					question_type: "scale" | "choice" | "text";
					rps_dimension: "scale" | "choice" | "text";
					choice_options?: string[];
					order_index: number;
				}
			>("/questions", {
				campaign_id: input.campaignId,
				question_text: input.title,
				question_type: input.type,
				rps_dimension: input.type,
				choice_options: input.type === "choice" ? input.options : undefined,
				order_index: input.orderIndex,
			});
		}),

	updateQuestion: t.procedure
		.input(
			z.object({
				questionId: z.number().int().positive(),
				title: z.string().min(1),
				type: z.enum(["scale", "choice", "text"]),
				options: z.array(z.string()).optional(),
				orderIndex: z.number().int().min(0),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return patchBackend(`/questions/${input.questionId}`, {
				question_text: input.title,
				question_type: input.type,
				rps_dimension: input.type,
				choice_options: input.type === "choice" ? input.options : undefined,
				order_index: input.orderIndex,
			});
		}),

	deleteQuestion: t.procedure
		.input(z.object({ questionId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return deleteBackend(`/questions/${input.questionId}`);
		}),

	reorderQuestions: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				items: z.array(
					z.object({
						questionId: z.number().int().positive(),
						orderIndex: z.number().int().min(0),
					}),
				),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return patchBackend(
				`/questions/campaign/${input.campaignId}/reorder`,
				input.items.map((item) => ({
					question_id: item.questionId,
					order_index: item.orderIndex,
				})),
			);
		}),

	campaigns: t.router({
		findOne: t.procedure
			.input(z.number().int().positive())
			.query(async (opts) => {
				ensureBackendConfigured();
				return getBackendItem(`/campaigns/${opts.input}`);
			}),
	}),

	analyzeCampaign: t.procedure
		.input(z.object({ campaignId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend<
				{ success: boolean; message: string },
				Record<string, never>
			>(`/campaigns/${input.campaignId}/analyze`, {});
		}),
});

const campaignParticipantsRouter = t.router({
	importEmployees: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				companyId: z.number().int().positive(),
				csv: z.string().min(1),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend(`/campaign-participants/campaign/${input.campaignId}/import-employees`, {
				company_id: input.companyId,
				csv: input.csv?.trim(),
			});
		}),

	sendInvitations: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				force: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend(`/campaign-participants/campaign/${input.campaignId}/send-invitations`, {
				app_url: getAppBaseUrl(),
				force: input.force,
			});
		}),

	remind: t.procedure
		.input(
			z.object({
				campaignId: z.number().int().positive(),
				minimumDaysSinceInvitation: z.number().int().min(0).optional(),
				force: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();
			return postBackend(`/campaign-participants/campaign/${input.campaignId}/remind`, {
				minimum_days_since_invitation: input.minimumDaysSinceInvitation,
				force: input.force,
			});
		}),
});

const surveyResponsesRouter = t.router({
	submit: t.procedure
		.input(
			z.object({
				participantToken: z.string().optional().nullable(),
				employeeId: z.number().int().positive().optional().nullable(),
				answers: z.array(
					z.object({
						questionId: z.number().int().positive(),
						answer: z.string().min(1),
					}),
				),
			}),
		)
		.mutation(async ({ input }) => {
			ensureBackendConfigured();

			if (!input.participantToken && !input.employeeId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "participantToken ou employeeId est requis.",
				});
			}

			if (!input.answers.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "answers est requis.",
				});
			}

			if (input.participantToken) {
				await postBackend(`/campaign-participants/token/${input.participantToken}/submit`, {
					responses: input.answers.map((answer) => ({
						question_id: answer.questionId,
						answer: answer.answer,
					})),
				});

				return { success: true, mode: "backend-token" as const };
			}

			await Promise.all(
				input.answers.map((answer) =>
					postBackend("/responses", {
						employee_id: input.employeeId,
						question_id: answer.questionId,
						answer: answer.answer,
					}),
				),
			);

			return { success: true, mode: "backend" as const };
		}),
});

const dataRouter = t.router({
	dashboard: t.procedure
		.input(
			z.object({
				scenario: scenarioSchema,
				campaignId: z.number().int().positive().optional().nullable(),
			}),
		)
		.query(({ input }) => getDashboardData(input.scenario, input.campaignId)),
	employeeManagement: t.procedure
		.input(
			z.object({
				scenario: scenarioSchema,
				campaignId: z.number().int().positive().optional().nullable(),
			}),
		)
		.query(({ input }) => getEmployeeManagementData(input.scenario, input.campaignId)),
	surveyBuilder: t.procedure
		.input(
			z.object({
				scenario: scenarioSchema,
				campaignId: z.number().int().positive().optional().nullable(),
			}),
		)
		.query(({ input }) => getSurveyBuilderData(input.scenario, input.campaignId)),
	listSurveys: t.procedure
		.input(z.object({ scenario: scenarioSchema }))
		.query(({ input }) => getAllSurveys(input.scenario)),
	surveyResponse: t.procedure
		.input(
			z.object({
				token: z.string().optional(),
				scenario: scenarioSchema,
			}),
		)
		.query(({ input }) => getSurveyResponseData(input.token, input.scenario)),
	results: t.procedure
		.input(
			z.object({
				scenario: scenarioSchema,
				campaignId: z.number().int().positive().optional().nullable(),
			}),
		)
		.query(({ input }) => getResultsData(input.scenario, input.campaignId)),
	report: t.procedure
		.input(
			z.object({
				scenario: scenarioSchema,
				campaignId: z.number().int().positive().optional().nullable(),
			}),
		)
		.query(({ input }) => getReportData(input.scenario, input.campaignId)),
});

export const appRouter = t.router({
	adminSurveys: adminSurveysRouter,
	campaignParticipants: campaignParticipantsRouter,
	surveyResponses: surveyResponsesRouter,
	data: dataRouter,
});

export type AppRouter = typeof appRouter;

export const caller = appRouter.createCaller;
