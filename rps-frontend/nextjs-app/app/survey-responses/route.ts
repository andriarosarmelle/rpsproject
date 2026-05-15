import { NextResponse } from "next/server";
import { postServerBackend as postBackend } from "@/lib/backend/server";

type SurveySubmissionPayload = {
  participantToken?: string | null;
  employeeId?: number | null;
  answers: Array<{
    questionId: number;
    answer: string;
  }>;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SurveySubmissionPayload;

  if ((!payload.employeeId && !payload.participantToken) || !payload.answers?.length) {
    return NextResponse.json(
      { message: "Les identifiants de l'employé ou du participant et les réponses sont requis." },
      { status: 400 },
    );
  }

  try {
    if (payload.participantToken) {
      await postBackend(`/campaign-participants/token/${payload.participantToken}/submit`, {
        responses: payload.answers.map((answer) => ({
          question_id: answer.questionId,
          answer: answer.answer,
        })),
      });

      return NextResponse.json({ success: true, mode: "backend-token" });
    }

    await Promise.all(
      payload.answers.map((answer) =>
        postBackend("/responses", {
          employee_id: payload.employeeId,
          question_id: answer.questionId,
          answer: answer.answer,
        }),
      ),
    );

    return NextResponse.json({ success: true, mode: "backend" });
  } catch {
    return NextResponse.json(
      { message: "La soumission a échoué." },
      { status: 502 },
    );
  }
}
