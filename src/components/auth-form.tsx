"use client"
import * as React from "react"

type FormAction = (formData: FormData) => void | Promise<void>

/**
 * Form de autenticação com submit garantido no Enter em todos os navegadores.
 *
 * O comportamento nativo já submete ao apertar Enter num input, mas pequenos
 * quirks de foco (ex.: foco num <button type="button"> dentro do form) podem
 * "roubar" o Enter. Este handler intercepta o Enter no nível do form e força
 * a submissão via requestSubmit() — mantendo a server action e a validação
 * de campos. Para inputs/selects funciona; textarea é preservado (Enter = nova
 * linha). Em navegadores sem requestSubmit cai no comportamento nativo.
 */
export function AuthForm({
  action,
  className,
  children,
}: {
  action: FormAction
  className?: string
  children: React.ReactNode
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.shiftKey) return
    const target = e.target as HTMLElement
    if (target.tagName === "TEXTAREA" || target.isContentEditable) return
    const form = e.currentTarget
    if (typeof form.requestSubmit === "function") {
      e.preventDefault()
      form.requestSubmit()
    }
  }

  return (
    <form action={action} className={className} onKeyDown={onKeyDown}>
      {children}
    </form>
  )
}
