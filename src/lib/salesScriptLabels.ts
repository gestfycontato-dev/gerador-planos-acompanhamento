import type { SalesScriptItemType, SalesScriptPhase } from '../types'

export const itemTypeLabels: Record<SalesScriptItemType, string> = {
  check: 'Check (ação a cumprir)',
  answer: 'Pergunta aberta (resposta do paciente)',
  script: 'Fala pronta (o que dizer)',
  attention: 'Atenção (alerta ou dica)',
}

export const phaseNames: Record<SalesScriptPhase, string> = {
  rapport: 'Recepção e rapport',
  situacao: 'Situação',
  problema: 'Problema',
  implicacao: 'Implicação',
  necessidade: 'Necessidade de solução',
  apresentacao: 'Apresentação e fechamento',
  encaminhamento: 'Encaminhamento',
}
