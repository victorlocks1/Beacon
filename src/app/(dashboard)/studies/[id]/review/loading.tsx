import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Revisão: cabeçalho, abas (Fluxo completo | Comentários) e o painel central.
export default function ReviewLoading() {
  return (
    <LoadingRegion className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-72 mb-6" />
      <Skeleton className="h-72 rounded-3xl" />
    </LoadingRegion>
  )
}
