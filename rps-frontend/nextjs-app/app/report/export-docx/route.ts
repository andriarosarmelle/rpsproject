import { NextResponse } from "next/server";
import { buildReportDocx } from "@/lib/reporting/docx";
import { getServerTrpcCaller } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const report = await getServerTrpcCaller().data.report({
      scenario: scenario ?? null,
    });
    const buffer = await buildReportDocx(report);
    const fileName = `${slugify(report.title)}.docx`;
    const bytes = new Uint8Array(buffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "La génération du rapport Word a échoué." },
      { status: 500 },
    );
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
