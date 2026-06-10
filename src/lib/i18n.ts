export type Lang = "pt" | "es"

// Strings da experiência do TESTADOR (convite) — o resto do app fica em PT.
export const tester = {
  pt: {
    welcomeTitle: "Teste de usabilidade",
    welcomeIntro:
      "Você foi convidado(a) para um teste rápido e anônimo. Não há respostas certas ou erradas — queremos entender como você usa a interface.",
    tasksCount: (n: number) =>
      `Você verá ${n === 1 ? "uma tarefa" : `${n} tarefas`} e deverá clicar pela interface para realizá-${n === 1 ? "la" : "las"}.`,
    anonymous: "Leva poucos minutos. Seus cliques são registrados de forma anônima.",
    start: "Começar",
    unavailableTitle: "Teste indisponível",
    unavailableBody:
      "Este teste não está aberto no momento. Verifique o link com quem te convidou.",
    taskOf: (i: number, n: number) => `Tarefa ${i} de ${n}`,
    giveUp: "Não consegui",
    viewMission: "Ver tarefa",
    viewScenario: "Ver cenário",
    hideScenario: "Ocultar cenário",
    thanksTitle: "Obrigado! 🎉",
    thanksBody: "Você concluiu o teste. Pode fechar esta aba.",
  },
  es: {
    welcomeTitle: "Prueba de usabilidad",
    welcomeIntro:
      "Te invitamos a una prueba rápida y anónima. No hay respuestas correctas o incorrectas — queremos entender cómo usas la interfaz.",
    tasksCount: (n: number) =>
      `Verás ${n === 1 ? "una tarea" : `${n} tareas`} y deberás hacer clic por la interfaz para realizar${n === 1 ? "la" : "las"}.`,
    anonymous: "Toma pocos minutos. Tus clics se registran de forma anónima.",
    start: "Empezar",
    unavailableTitle: "Prueba no disponible",
    unavailableBody:
      "Esta prueba no está abierta en este momento. Verifica el enlace con quien te invitó.",
    taskOf: (i: number, n: number) => `Tarea ${i} de ${n}`,
    giveUp: "No lo logré",
    viewMission: "Ver tarea",
    viewScenario: "Ver escenario",
    hideScenario: "Ocultar escenario",
    thanksTitle: "¡Gracias! 🎉",
    thanksBody: "Completaste la prueba. Puedes cerrar esta pestaña.",
  },
} as const

export function tt(lang: Lang) {
  return tester[lang] ?? tester.pt
}
