import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type AuthResponse, type LoginCredentials } from "@/lib/backend/auth";
import { postBackend } from "@/lib/backend/client";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function createCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

async function persistSession(response: AuthResponse) {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", response.token, createCookieOptions(true));
}

export async function POST(request: Request) {
  try {
    const credentials = (await request.json()) as LoginCredentials;
    const response = await postBackend<AuthResponse, LoginCredentials>("/auth/login", credentials);

    await persistSession(response);
    return NextResponse.json(response);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const isRateLimited = /429\s+Too Many Requests|too many/i.test(rawMessage);
    const message =
      isRateLimited
        ? "Trop de tentatives de connexion. Réessayez dans quelques minutes."
        : /401\s+Unauthorized.*Invalid credentials/i.test(rawMessage)
        ? "Identifiants incorrects."
        : rawMessage
          ? rawMessage
          : "Identifiants incorrects.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: isRateLimited ? 429 : 401 },
    );
  }
}
