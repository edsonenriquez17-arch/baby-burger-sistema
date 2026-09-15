import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_SESION = "bb_sesion";
const RUTAS_PUBLICAS = ["/login", "/manifest.webmanifest"];

/**
 * Chequeo optimista: si no hay cookie válida, manda a /login.
 * La verificación real de usuario activo y permisos ocurre en cada página
 * (ver src/lib/auth/session.ts), nunca solo aquí.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));
  const token = request.cookies.get(COOKIE_SESION)?.value;

  let sesionValida = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      sesionValida = true;
    } catch {
      sesionValida = false;
    }
  }

  if (!esPublica && !sesionValida) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("volver", pathname);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(COOKIE_SESION);
    return res;
  }

  if (pathname === "/login" && sesionValida) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Todo excepto archivos estáticos e internos de Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
