import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Resultados (geral e por missão): cabeçalho, indicadores e blocos de análise.
export default function ResultsLoading() {
  return (
    <LoadingRegion className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-80 max-w-full mb-6" />
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    </LoadingRegion>
  )
}
