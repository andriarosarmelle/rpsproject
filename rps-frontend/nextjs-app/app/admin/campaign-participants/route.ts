import { NextResponse } from "next/server";
import { isMockBackendEnabled } from "@/lib/backend/client";
import { postServerBackend as postBackend } from "@/lib/backend/server";

type ImportPayload = {
  action: "import";
  campaignId: number;
  companyId: number;
  csv: string;
};

type RemindPayload = {
  action: "remind";
  campaignId: number;
  minimumDaysSinceInvitation?: number;
  force?: boolean;
};

type AdminPayload = ImportPayload | RemindPayload;

export async function POST(request: Request) {
  const payload = (await request.json()) as AdminPayload;

  if (isMockBackendEnabled()) {
    return NextResponse.json({ success: true, mode: "demo" });
  }

  try {
    if (payload.action === "import") {
      if (!payload.campaignId || !payload.companyId || !payload.csv.trim()) {
        return NextResponse.json(
          { message: "L'identifiant de la campagne, de l'entreprise et la liste des employés sont requis." },
          { status: 400 },
        );
      }

      const result = await postBackend(
        `/campaign-participants/campaign/${payload.campaignId}/import-employees`,
        {
          company_id: payload.companyId,
          csv: payload.csv,
        },
      );

      return NextResponse.json({ success: true, result });
    }

    if (payload.action === "remind") {
      if (!payload.campaignId) {
        return NextResponse.json({ message: "L'identifiant de la campagne est requise." }, { status: 400 });
      }

      const result = await postBackend(
        `/campaign-participants/campaign/${payload.campaignId}/remind`,
        {
          minimum_days_since_invitation: payload.minimumDaysSinceInvitation,
          force: payload.force,
        },
      );

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ message: "Action non supportée." }, { status: 400 });
  } catch {
    return NextResponse.json(
      { message: "L'action a échoué." },
      { status: 502 },
    );
  }
}
