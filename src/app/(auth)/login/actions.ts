"use server"
import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

export async function loginAction(_prev: unknown, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha incorretos." }
    }
    throw error
  }
  redirect("/studies")
}
