"use server"
import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"

export async function loginAction(_prev: unknown, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/studies",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha incorretos." }
    }
    throw error
  }
}
