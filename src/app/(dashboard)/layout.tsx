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
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top app bar (M3) */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-sm border-b border-outline-variant">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary text-base font-semibold">
              B
            </div>
            <span className="text-title-large text-on-surface">Beacon</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-body-medium text-on-surface-variant hidden sm:block">
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
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-12">{children}</main>
    </div>
  )
}
