import { NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { isIcdConfigured, searchIcd } from "@/lib/icd/client"

export const dynamic = "force-dynamic"

/**
 * WHO ICD-11 arama proxy'si. ClientSecret'ı sunucu tarafında tutar; istemci
 * yalnızca `?q=` ile sorgular. Oturum zorunludur.
 *
 * Yanıt: { configured: boolean, results: { code, title }[] }
 */
export async function GET(request: Request) {
  const session = await getOptionalSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!isIcdConfigured()) {
    // Kimlik bilgileri yoksa uygulama çökmemeli — istemci serbest metne düşer.
    return NextResponse.json({ configured: false, results: [] })
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) {
    return NextResponse.json({ configured: true, results: [] })
  }

  try {
    const results = await searchIcd(q)
    return NextResponse.json({ configured: true, results })
  } catch (err) {
    console.error("[icd] search failed:", err)
    return NextResponse.json({ error: "icd_upstream_error", results: [] }, { status: 502 })
  }
}
