import { FilePlus2, Handshake, Plus } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'

export function CreatePlanPage({ startWithAssistant, startWithoutAssistant }: { startWithAssistant: () => void; startWithoutAssistant: () => void }) {
  return <div className="page">
    <PageHeader kicker="CRIAR PLANO" title="Como você quer criar o plano?" subtitle="Escolha se o roteiro do assistente de vendas vai guiar a consulta, ou se prefere montar o plano direto."/>
    <div className="create-choices two">
      <button onClick={startWithAssistant}><div className="choice-icon coral-bg"><Handshake size={24}/></div><span>CONSULTA GUIADA</span><h3>Criar plano usando o assistente de vendas</h3><p>Segue o roteiro fase a fase durante o atendimento, do rapport até o fechamento da venda.</p><b>Começar <Plus size={16}/></b></button>
      <button onClick={startWithoutAssistant}><div className="choice-icon mint-bg"><FilePlus2 size={24}/></div><span>DIRETO AO PLANO</span><h3>Criar plano sem o assistente de vendas</h3><p>Monta o cronograma e os objetivos direto, com só as perguntas do roteiro que têm campo de resposta.</p><b>Começar <Plus size={16}/></b></button>
    </div>
    <p className="documents-intro">Quer criar ou editar um template? Vá em Cadastros → Templates de plano ou Objetivos.</p>
  </div>
}
