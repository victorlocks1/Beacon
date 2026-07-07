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
    howItWorksTitle: "Como funciona",
    startTask: "Iniciar tarefa",
    unavailableTitle: "Teste indisponível",
    unavailableBody:
      "Este teste não está aberto no momento. Verifique o link com quem te convidou.",
    taskOf: (i: number, n: number) => `Tarefa ${i} de ${n}`,
    stepOf: (i: number, n: number) => `Passo ${i} de ${n}`,
    giveUp: "Não consegui",
    viewMission: "Ver tarefa",
    viewScenario: "Ver cenário",
    hideScenario: "Ocultar cenário",
    continue: "Continuar",
    skip: "Pular",
    yes: "Sim",
    no: "Não",
    openPlaceholder: "Escreva sua resposta...",
    chooseOne: "Escolha uma opção",
    rateHint: "Toque nas estrelas para avaliar",
    taskDoneToast: (n: number) => `Tarefa ${n} concluída`,
    taskDoneTitle: "Tarefa concluída!",
    taskDoneBody: "Boa! Você concluiu esta tarefa.",
    taskGaveUpTitle: "Tarefa encerrada",
    taskGaveUpBody: "Sem problema. Vamos seguir para o próximo passo.",
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
    howItWorksTitle: "Cómo funciona",
    startTask: "Iniciar tarea",
    unavailableTitle: "Prueba no disponible",
    unavailableBody:
      "Esta prueba no está abierta en este momento. Verifica el enlace con quien te invitó.",
    taskOf: (i: number, n: number) => `Tarea ${i} de ${n}`,
    stepOf: (i: number, n: number) => `Paso ${i} de ${n}`,
    giveUp: "No lo logré",
    viewMission: "Ver tarea",
    viewScenario: "Ver escenario",
    hideScenario: "Ocultar escenario",
    continue: "Continuar",
    skip: "Saltar",
    yes: "Sí",
    no: "No",
    openPlaceholder: "Escribe tu respuesta...",
    chooseOne: "Elige una opción",
    rateHint: "Toca las estrellas para valorar",
    taskDoneToast: (n: number) => `Tarea ${n} completada`,
    taskDoneTitle: "¡Tarea completada!",
    taskDoneBody: "¡Bien! Completaste esta tarea.",
    taskGaveUpTitle: "Tarea finalizada",
    taskGaveUpBody: "Sin problema. Sigamos con el siguiente paso.",
    thanksTitle: "¡Gracias! 🎉",
    thanksBody: "Completaste la prueba. Puedes cerrar esta pestaña.",
  },
} as const

export function tt(lang: Lang) {
  return tester[lang] ?? tester.pt
}
