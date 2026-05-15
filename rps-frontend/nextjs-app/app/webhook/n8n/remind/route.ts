import { NextResponse } from "next/server";
import { postServerBackend as postBackend } from "@/lib/backend/server";

type RemindResult = {
  reminded_count?: number;
  reminded?: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaignId, companyId } = body;

    if (!campaignId || !companyId) {
      return NextResponse.json(
        { error: "Les identifiants de la campagne et de l'entreprise sont requis" },
        { status: 400 },
      );
    }

    const result = await postBackend<RemindResult, { minimum_days_since_invitation: number; force: boolean }>(
      `/campaign-participants/campaign/${campaignId}/remind`,
      {
        minimum_days_since_invitation: 0,
        force: true,
      },
    );

    return NextResponse.json({
      success: true,
      reminded: result.reminded_count || result.reminded || 0,
      message: "Relances envoyées avec succès",
      data: result,
    });
  } catch (error) {
    console.error("Remind forwarding error:", error);

    return NextResponse.json(
      {
        success: false,
        reminded: 0,
        error: "Echec de l'envoi des relances",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 },
    );
  }
}
