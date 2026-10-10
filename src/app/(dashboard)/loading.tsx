// Mostrado IMEDIATAMENTE ao clicar num link do painel, enquanto o servidor
// busca os dados da próxima página. Sem isso, o clique parece "não ter pego":
// a tela antiga fica parada até a nova chegar inteira.
export default function DashboardLoading() {
  return (
    <div className="max-w-[1600px] mx-auto animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center justify-between mb-8">
        <div className="h-9 w-56 rounded-xl bg-surface-container-high" />
        <div className="h-10 w-36 rounded-full bg-surface-container-high" />
      </div>
      <div className="h-10 w-64 rounded-lg bg-surface-container-high mb-8" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-36 rounded-3xl border border-outline-variant bg-surface-container-low" />
        ))}
      </div>
    </div>
  )
}
