import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSession,
  deleteSession,
  getSessionUser,
  getUserAuthByEmail,
  touchLastSeen,
  upsertUser,
} from "./db";
import type { User } from "./types";

/**
 * Sign-in with database-backed sessions in an httpOnly cookie, via two
 * methods: Google (hand-rolled OIDC authorization-code flow — no
 * dependencies) and email + password (scrypt-hashed, stored on the user row).
 *
 * DUAL MODE: when SESSION_SECRET is not configured, auth is OFF and the app
 * runs as a single-user instance whose data belongs to the implicit 'local'
 * user (an admin). Deploys therefore never brick on missing credentials.
 * Google specifically also needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET —
 * without them the Google button disappears and password sign-in stands
 * alone.
 */

export const SESSION_COOKIE = "scalae_session";
export const STATE_COOKIE = "scalae_oauth_state";

export function authEnabled(): boolean {
  return !!process.env.SESSION_SECRET;
}

/** Whether the Google OIDC flow is configured (the button and its routes). */
export function googleEnabled(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.SESSION_SECRET
  );
}

/** The implicit owner when auth is off — full admin, id 'local'. */
export const LOCAL_USER: User = {
  id: "local",
  email: "local@scalae",
  name: "Local investor",
  picture: "",
  role: "admin",
  createdAt: "1970-01-01T00:00:00.000Z",
  lastSeenAt: "1970-01-01T00:00:00.000Z",
};

const hmac = (data: string) =>
  createHmac("sha256", process.env.SESSION_SECRET ?? "dev").update(data).digest("hex");

/** Signed OAuth state: random nonce + HMAC, round-tripped via cookie. */
export function newState(): string {
  const nonce = randomBytes(16).toString("hex");
  return `${nonce}.${hmac(nonce)}`;
}

export function stateValid(state: string | null | undefined): boolean {
  if (!state) return false;
  const [nonce, sig] = state.split(".");
  if (!nonce || !sig) return false;
  const expect = hmac(nonce);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
  } catch {
    return false;
  }
}

/** The app's own origin, for OAuth redirect URIs (proxy-aware on Vercel). */
export function appOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export function googleAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Exchange the authorization code server-to-server and validate the identity.
 * The id_token arrives directly from Google's token endpoint over TLS, so
 * claims validation (iss/aud/exp/email_verified) suffices without local JWKS
 * signature verification.
 */
export async function exchangeCode(
  origin: string,
  code: string
): Promise<{ email: string; name: string; picture: string } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    console.error("[scalae] google token exchange failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;
  const payload = data.id_token.split(".")[1];
  if (!payload) return null;
  let claims: IdTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
  } catch {
    return null;
  }
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audOk = claims.aud === process.env.GOOGLE_CLIENT_ID;
  const fresh = (claims.exp ?? 0) * 1000 > Date.now();
  if (!issOk || !audOk || !fresh || !claims.email || claims.email_verified === false) return null;
  return {
    email: claims.email,
    name: claims.name ?? claims.email.split("@")[0],
    picture: claims.picture ?? "",
  };
}

/** Sign the profile in: upsert the user, mint a session, return the cookie value. */
export async function signIn(profile: { email: string; name: string; picture: string }) {
  const user = await upsertUser(profile);
  const session = await createSession(user.id);
  return { user, session };
}

// ---------------------------------------------------------------------------
// Password auth (scrypt, node:crypto only — no dependencies)
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, N, r, p, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Email + password sign-in: verify against the stored hash, mint a session.
 * Null on ANY failure — unknown email, no password set, wrong password —
 * so the route can answer with one generic message (no user enumeration).
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ user: User; session: { token: string; expiresAt: string } } | null> {
  const auth = await getUserAuthByEmail(email);
  if (!auth || !verifyPassword(password, auth.passwordHash)) return null;
  touchLastSeen(auth.user.id).catch(() => {});
  const session = await createSession(auth.user.id);
  return { user: auth.user, session };
}

export async function signOut(token: string | undefined): Promise<void> {
  if (token) await deleteSession(token).catch(() => {});
}

/** The signed-in user — or the implicit local admin when auth is off. */
export async function currentUser(): Promise<User | null> {
  if (!authEnabled()) return LOCAL_USER;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await getSessionUser(token);
  if (user) touchLastSeen(user.id).catch(() => {});
  return user;
}

/** Route guard: the user, or null (the route should 401). */
export async function requireUser(): Promise<User | null> {
  return currentUser();
}
