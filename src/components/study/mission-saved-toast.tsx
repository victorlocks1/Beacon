"use client"
import { useEffect, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/toast"

// Dispara um toast de sucesso ao voltar do formulário de missão (que redireciona
// com ?saved=created|updated) e limpa o parâmetro da URL.
export function MissionSavedToast() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fired = useRef(false)

  useEffect(() => {
    const saved = params.get("saved")
    if (!saved || fired.current) return
    fired.current = true
    if (saved === "created") toast.success("Missão criada")
    else if (saved === "updated") toast.success("Missão atualizada")

    const next = new URLSearchParams(params.toString())
    next.delete("saved")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [params, pathname, router])

  return null
}
