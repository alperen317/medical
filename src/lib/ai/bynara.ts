import "server-only"
import OpenAI from "openai"

const MODEL    = process.env.BYNARA_MODEL    ?? "auto/bynara"
const BASE_URL = process.env.BYNARA_BASE_URL ?? "https://router.bynara.id/v1"

export type ChatMessage = { role: "system" | "user"; content: string }

/** Bynara (OpenAI uyumlu) LLM router yapılandırılmış mı? */
export function isBynaraConfigured(): boolean {
  return Boolean(process.env.BYNARA_API_KEY)
}

/**
 * Bynara LLM router'a sohbet tamamlama isteği gönderir ve temizlenmiş metni
 * döndürür. Reasoning modellerinin <think>...</think> bloğunu ve sızmış chat
 * şablon token'larını/kod-şeklindeki çıktıyı ayıklar.
 *
 * Garbage tespit edilirse boş string döner (çağıran taraf boşluğu ele almalı).
 */
export async function callBynara(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.BYNARA_API_KEY
  if (!apiKey) throw new Error("BYNARA_API_KEY tanımlı değil")

  const client = new OpenAI({ baseURL: BASE_URL, apiKey })

  let response
  try {
    response = await client.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.2,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`bynara: ${msg.slice(0, 200)}`)
  }

  const raw = response.choices?.[0]?.message?.content?.trim() ?? ""

  // Reasoning modelin <think>...</think> bloğunu at; yalnızca son cevabı tut
  const stripped = raw.includes("</think>")
    ? raw.slice(raw.lastIndexOf("</think>") + "</think>".length).trim()
    : raw

  // Kod-şeklindeki çıktıyı veya sızmış chat şablon token'larını garbage say
  const isGarbage =
    /\b(ConfigureServices|using System|public class|namespace \w|import \w+;|export (default|function|class)|const \w+ =|function \w+\()/.test(stripped)
    || stripped.includes("<|start_header_id|>")
    || stripped.includes("<|im_start|>")

  return isGarbage ? "" : stripped.trim()
}
