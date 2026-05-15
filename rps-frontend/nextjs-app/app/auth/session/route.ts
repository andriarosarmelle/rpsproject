import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type User } from "@/lib/backend/auth";
import { getBackendItem } from "@/lib/backend/client";

function clearSessionCookies(response: NextResponse) {
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("auth_user", "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value?.trim();

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const user = await getBackendItem<User>("/auth/me", token);
    return NextResponse.json({ user });
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Session expirée ou invalide.",
      },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }
}
