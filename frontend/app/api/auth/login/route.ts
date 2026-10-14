import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_HOURS, sessionCookie, signSession } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const DUMMY_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW";

type Bucket = { count: number; reset: number };

function buckets() {
  const holder = globalThis as typeof globalThis & { __glycoLoginBuckets?: Map<string, Bucket> };
  if (!holder.__glycoLoginBuckets) holder.__glycoLoginBuckets = new Map();
  return holder.__glycoLoginBuckets;
}

function allowed(ip: string) {
  const now = Date.now();
  const bucket = buckets().get(ip);
  if (!bucket || now > bucket.reset) {
    buckets().set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_ATTEMPTS;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) {
    return fail(429, "Too many sign-in attempts. Try again later.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(401, "Sign-in failed. Check the doctor id and password.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail(401, "Sign-in failed. Check the doctor id and password.");
  }

  const expectedUser = process.env.DOCTOR_USERNAME ?? "";
  const hash = process.env.DOCTOR_PASSWORD_HASH ?? "";
  const passwordOk = await bcrypt.compare(parsed.data.password, hash || DUMMY_HASH);
  const userOk = expectedUser.length > 0 && safeEqual(parsed.data.username, expectedUser);
  if (!hash || !userOk || !passwordOk) {
    return fail(401, "Sign-in failed. Check the doctor id and password.");
  }

  const token = await signSession(expectedUser);
  const response = NextResponse.json({ ok: true, username: expectedUser });
  response.cookies.set(SESSION_COOKIE, token, sessionCookie(SESSION_HOURS * 60 * 60));
  return response;
}
