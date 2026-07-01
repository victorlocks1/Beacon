import { redirect } from "next/navigation"

// A lista de estudos agora vive dentro de um projeto. A home é /projects.
export default function StudiesRedirect() {
  redirect("/projects")
}
