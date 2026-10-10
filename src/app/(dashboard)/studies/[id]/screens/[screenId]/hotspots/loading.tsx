import { Skeleton, LoadingRegion } from "@/components/ui/skeleton"

// Editor de hotspots: cabeçalho, a tela à esquerda e o painel de hotspots à direita.
export default function HotspotsLoading() {
  return (
    <LoadingRegion className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56" />
        </div>
      </div>
      <div className="flex gap-6 flex-1 min-h-0">
        <Skeleton className="flex-1 rounded-lg" />
        <div className="w-72 shrink-0 space-y-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    </LoadingRegion>
  )
}
