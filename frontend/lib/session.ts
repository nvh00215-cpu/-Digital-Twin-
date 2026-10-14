import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "glycotwin_session";
export const SESSION_HOURS = 8;

export type Session = { username: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(username: string) {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function readSession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const username = typeof payload.username === "string" ? payload.username : payload.sub;
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
}

export function sessionCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
