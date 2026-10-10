import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Lista de projetos (e padrão do painel): título, abas e grade de cartões.
export default function DashboardLoading() {
  return (
    <LoadingRegion className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-10 w-64 mb-8" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
    </LoadingRegion>
  )
}
