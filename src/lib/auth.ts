import { SignJWT, jwtVerify } from "jose";

const COOKIE = "admin_token";

function getSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET غير مضبوط أو قصير جداً");
  }
  return new TextEncoder().encode(s);
}

export async function signAdminToken(): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const secret = getSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export const adminCookieName = COOKIE;
