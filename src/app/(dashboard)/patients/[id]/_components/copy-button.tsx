"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Kopyala"
      className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground transition-all duration-150"
    >
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3" />
      }
    </button>
  )
}
