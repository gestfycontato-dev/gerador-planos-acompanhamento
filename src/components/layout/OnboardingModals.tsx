import { ArrowLeft, Sparkles, Stethoscope } from 'lucide-react'
import { Button } from '../ui/Button'

export function WelcomeModal({ onStart }: { onStart: () => void }) {
  return <div className="welcome-layer"><div className="welcome-modal">
    <div className="welcome-art"><div><Sparkles size={24}/></div><span>BOAS VENDAS!</span></div>
    <h2>Vamos preparar seu espaço</h2>
    <p>Antes de criar o primeiro plano de acompanhamento, cadastre as informações da clínica e do médico prescritor.</p>
    <div className="welcome-steps">
      <div><b>1</b><span><strong>Cadastre a clínica</strong>Logo, razão social e dados de contato.</span></div>
      <div><b>2</b><span><strong>Cadastre o médico</strong>Nome, e-mail e CRM do responsável.</span></div>
    </div>
    <Button variant="primary" className="welcome-button" onClick={onStart}>Vamos lá! <ArrowLeft className="welcome-arrow" size={17}/></Button>
  </div></div>
}

export function ServicesIntroModal({ onClose }: { onClose: () => void }) {
  return <div className="welcome-layer"><div className="welcome-modal">
    <div className="welcome-art"><div><Stethoscope size={24}/></div><span>PRÓXIMO PASSO</span></div>
    <h2>Cadastre seus produtos e serviços</h2>
    <p>Agora que colocou os dados da clínica e do médico, é hora de cadastrar seus produtos e serviços.</p>
    <Button variant="primary" className="welcome-button" onClick={onClose}>Vamos lá! <ArrowLeft className="welcome-arrow" size={17}/></Button>
  </div></div>
}
