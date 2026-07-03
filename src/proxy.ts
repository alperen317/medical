import { NextRequest, NextResponse } from "next/server"
import { decrypt } from "@/lib/session"

const PUBLIC_ROUTES = ["/login", "/setup", "/set-password", "/forgot-password"]
const AUTH_ROUTES = ["/login"]

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC_ROUTES.some((r) => path.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => path.startsWith(r))

  const token = req.cookies.get("medpanel_session")?.value
  const session = await decrypt(token)

  // Giriş yapmamış kullanıcı korumalı sayfaya erişmeye çalışıyor
  if (!isPublic && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // Giriş yapmış kullanıcı /login'e gelirse dashboard'a yönlendir
  if (isAuthRoute && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }

  // v1 hasta detay/kayıt akışları kilitli: sadece super_admin erişebilir (arşiv/referans amaçlı)
  if (path.startsWith("/patients") && session?.roleName !== "super_admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
