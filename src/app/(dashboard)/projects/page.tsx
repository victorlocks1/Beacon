import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"
import { ProjectCardMenu } from "@/components/project/project-card-menu"
import { Folder } from "lucide-react"

type ProjectWithCount = {
  id: string
  name: string
  archived: boolean
  _count: { studies: number }
}

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { studies: true } } },
  })

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)

  const shared = await prisma.studyMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      study: {
        select: { id: true, title: true, owner: { select: { name: true, email: true } } },
      },
    },
  })

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-headline-large text-on-surface">Projetos</h1>
        <CreateProjectDialog />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="mb-8">
          <TabsTrigger value="active">Ativos ({active.length})</TabsTrigger>
          <TabsTrigger value="archived">Arquivados ({archived.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ProjectGrid projects={active} empty="Nenhum projeto ainda. Crie o primeiro para começar." />
        </TabsContent>
        <TabsContent value="archived">
          <ProjectGrid projects={archived} empty="Nenhum projeto arquivado." />
        </TabsContent>
      </Tabs>

      {shared.length > 0 && (
        <div className="mt-14">
          <h2 className="text-title-large text-on-surface mb-5">Compartilhados comigo</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shared.map((m) => (
              <Link
                key={m.id}
                href={`/studies/${m.study.id}/review`}
                className="rounded-3xl bg-surface-container-low border border-outline-variant p-6 block transition-shadow hover:elevation-2"
              >
                <h3 className="text-title-large text-on-surface truncate">{m.study.title}</h3>
                <p className="text-body-small text-on-surface-variant mt-1">
                  por {m.study.owner.name ?? m.study.owner.email}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectGrid({ projects, empty }: { projects: ProjectWithCount[]; empty: string }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-24 border border-outline-variant rounded-3xl bg-surface-container-low">
        <p className="text-body-medium text-on-surface-variant">{empty}</p>
      </div>
    )
  }
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <div
          key={p.id}
          className="relative rounded-3xl bg-surface-container-low border border-outline-variant transition-shadow hover:elevation-2"
        >
          <div className="absolute top-3 right-3 z-10">
            <ProjectCardMenu
              projectId={p.id}
              name={p.name}
              archived={p.archived}
              studyCount={p._count.studies}
            />
          </div>
          <Link href={`/projects/${p.id}`} className="block p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/[0.06] text-primary mb-6">
              <Folder className="h-5 w-5" />
            </div>
            <h2 className="text-title-large text-on-surface truncate pr-8">{p.name}</h2>
            <p className="text-body-small text-on-surface-variant mt-1">
              {p._count.studies} {p._count.studies === 1 ? "study" : "studies"}
            </p>
          </Link>
        </div>
      ))}
    </div>
  )
}
