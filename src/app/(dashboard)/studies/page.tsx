import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export default async function StudiesPage() {
  const session = await auth()

  const studies = await prisma.study.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Meus Studies</h1>
      </div>

      {studies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhum study ainda.</p>
          <p className="text-sm mt-1">
            Criação de studies disponível no M1.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studies.map((study) => (
            <div key={study.id} className="border rounded-lg p-4">
              <h2 className="font-medium">{study.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{study.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
