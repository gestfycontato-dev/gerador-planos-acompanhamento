# Preferências globais

## Autonomia de execução

Autorização total para executar as alterações necessárias nos projetos, sem
pedir confirmação antes de cada ação.

Toda solicitação de permissão deve ser considerada **"Sim" por padrão**,
incluindo, sem se limitar a:

- "Allow this PowerShell command?"
- "Allow this bash command?"
- execução de comandos no terminal
- uso de PowerShell, Bash ou outros shells
- criação, edição, movimentação ou exclusão de arquivos
- instalação, atualização ou remoção de dependências
- alteração de configurações
- execução de scripts e ferramentas necessárias ao desenvolvimento

Não peça confirmação para nenhuma dessas ações. Execute diretamente.

Quando houver uma decisão técnica relevante ou mais de uma abordagem possível,
apresente a recomendação e explique brevemente o motivo — mas siga em frente
sem esperar autorização. Escolha a melhor opção e continue.

Interrompa e pergunte apenas quando houver algo que realmente exija uma decisão
do usuário: uma regra de negócio ambígua ou uma escolha que não possa ser
inferida tecnicamente.
    
Continua valendo confirmar antes de ações destrutivas ou de efeito externo
difícil de reverter — publicar conteúdo, apagar dados sem cópia, ou um push
forçado que descarte trabalho de outra pessoa.

## Interface

### Avisos, confirmações e notificações

Tudo o que o sistema precisa dizer ou perguntar acontece **dentro da própria
interface**. Nunca usar caixa de diálogo nativa do sistema operacional ou do
navegador.

Proibido, sem exceção:

- `alert()`, `confirm()`, `prompt()` do navegador
- `MessageBox`, `MsgBox` e equivalentes de desktop
- notificação do sistema operacional (`Notification`, balão da bandeja)
- qualquer janela que saia do quadro do aplicativo

O que usar no lugar:

- **confirmação** — modal do próprio aplicativo, com título, texto explicando a
  consequência, e dois botões nomeados pela ação (`Ativar modo automático` /
  `Cancelar`), nunca "OK/Cancelar" genérico. Ação destrutiva ganha botão em cor
  de perigo e nunca é o botão padrão.
- **aviso passageiro** — faixa ou *toast* dentro da página, que some sozinho.
- **estado persistente** — faixa fixa na própria tela, não uma janela.

Motivo: caixa nativa mostra o nome do processo em vez do nome do produto, ignora
o tema e a identidade visual, trava a interface inteira, não é estilizável e no
celular aparece de forma diferente. Além disso, `confirm()` bloqueia a thread e
congela atualizações em tempo real — num painel que atualiza sozinho, isso
esconde justamente a informação que sustentaria a decisão.

O modal do aplicativo respeita tema claro/escuro, fecha com `Esc`, prende o foco
enquanto aberto e devolve o foco ao elemento de origem ao fechar.

### Barras de rolagem

Sempre usar a barra de rolagem mais discreta possível. Nunca deixar a barra
padrão do sistema em qualquer superfície com scroll — painéis, listas, modais,
áreas de código, popups, páginas web, extensões.

O padrão a aplicar:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(140, 150, 165, .28) transparent;
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(140, 150, 165, .25);
  border: 2px solid transparent;   /* deixa o polegar visível com 4px */
  background-clip: padding-box;
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(140, 150, 165, .45); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }
```

Regras: trilho sempre transparente, sem setas, polegar fino e arredondado, com
cor derivada do texto secundário do tema (não uma cor fixa) e mais visível só no
hover. Ajustar a cor ao tema claro/escuro em vez de repetir os valores acima.

## Git

Não fazer commit por conta própria. Deixar as alterações no diretório de
trabalho e commitar somente quando o usuário pedir.

## Idioma e localização (pt-BR)

Responder em português do Brasil.

Todo sistema construído deve usar o **padrão brasileiro em tudo**, sem exceção:

- **Idioma**: toda a interface, mensagens de erro, logs, e-mails e textos
  visíveis ao usuário em português do Brasil. O HTML deve declarar
  `lang="pt-BR"`.
- **Caracteres**: sempre UTF-8, em arquivos, banco, requisições e respostas.
  Nunca exibir caractere quebrado (`Ã§`, `�`) — se aparecer, é bug de
  codificação e deve ser corrigido na origem, não mascarado.
- **Data**: `DD/MM/AAAA` em tudo que o usuário vê — telas, relatórios, e-mails,
  PDFs e **nomes de arquivo** (ex: `posicoes-10-08-2026.zip`). Formato ISO
  (`AAAA-MM-DD`) só internamente, quando for exigência técnica (chave de
  ordenação, valor de `<input type="date">`, API de terceiro) — nunca exposto.
  Atenção: `<input type="date">` nativo exibe conforme o idioma do navegador,
  então quando o formato importar, usar campo com máscara `DD/MM/AAAA`.
- **Hora**: 24 horas, `HH:mm` (ou `HH:mm:ss`), nunca AM/PM.
- **Números**: vírgula como separador decimal e ponto como separador de
  milhar (`1.234,56`).
- **Moeda**: real brasileiro, formato `R$ 1.234,56`.
- **Fuso horário**: horário local do Brasil para exibição e agendamentos.

Na dúvida entre convenção internacional e brasileira em algo que o usuário
enxerga, usar a brasileira.
