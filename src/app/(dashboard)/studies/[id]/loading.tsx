import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Estudo: cabeçalho com ações, abas (Protótipo | Missões) e lista de telas com
// o painel lateral de upload/importação.
export default function StudyLoading() {
  return (
    <LoadingRegion className="max-w-[1500px] mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-8 w-80 flex-1 max-w-md" />
        <div className="flex-1" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <Skeleton className="h-10 w-56 mb-8" />
      <Skeleton className="h-6 w-24 mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>
      </div>
    </LoadingRegion>
  )
}
