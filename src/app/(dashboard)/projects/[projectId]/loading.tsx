import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Projeto: voltar, título + botão, e a lista de estudos.
export default function ProjectLoading() {
  return (
    <LoadingRegion className="max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center justify-between mb-10">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
    </LoadingRegion>
  )
}
