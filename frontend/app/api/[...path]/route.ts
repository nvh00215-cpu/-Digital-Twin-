import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  if (path[0] === "auth") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const backend = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const incoming = new URL(request.url);
  const target = `${backend}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const bytes = await upstream.arrayBuffer();
    const out = new Headers();
    const type = upstream.headers.get("content-type");
    if (type) out.set("content-type", type);
    return new NextResponse(bytes, { status: upstream.status, headers: out });
  } catch {
    return NextResponse.json({ error: "The twin API is unavailable." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
