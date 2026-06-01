import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">Beacon</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session.user?.name ?? session.user?.email}
          </span>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
