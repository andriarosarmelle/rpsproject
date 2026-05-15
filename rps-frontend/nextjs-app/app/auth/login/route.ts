import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_AUTH_TOKEN, type AuthResponse, type LoginCredentials } from "@/lib/backend/auth";
import { isMockBackendEnabled, postBackend } from "@/lib/backend/client";

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
    const response = isMockBackendEnabled()
      ? {
          user: {
            id: 0,
            email: credentials.email.trim().toLowerCase(),
            name: "Démo administrateur",
          },
          token: DEMO_AUTH_TOKEN,
        }
      : await postBackend<AuthResponse, LoginCredentials>("/auth/login", credentials);

    await persistSession(response);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Identifiants incorrects.",
      },
      { status: 401 },
    );
  }
}
