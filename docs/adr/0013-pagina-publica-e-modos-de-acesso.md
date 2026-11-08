# ADR 0013: Página pública de agendamento com modo de acesso escolhido pelo Dono

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0001, 0010, 0011 e 0012; planejamento 0019

## Contexto

Cada barbearia tem uma página em que o cliente final agenda sem login (`/agendar/<slug>`). Ao publicar o sistema, algumas barbearias querem divulgar a página (Instagram, Google). Outras preferem que só quem recebeu o link consiga agendar, ou não querem agendamento pela internet.

## Decisão

- **Três modos**, em `configuracoes.paginaPublica.modo` (ADR 0012):
  - `publica`: qualquer pessoa com o endereço agenda. É o padrão.
  - `com_link`: o link leva um código (`/agendar/<slug>?c=<código>`). O código fica em `barbearias.token_publico`, é aleatório (128 bits) e o Dono pode gerar outro a qualquer momento, o que invalida o link antigo.
  - `desativada`: só a recepção marca.
- A página também exige o módulo `agendamento_online` ativo (ADR 0011).
- **API pública** em `/api/publico/:slug`, sem sessão:
  - Página inexistente, desativada, sem módulo ou com código errado recebem a **mesma** resposta 404, para não revelar que a barbearia existe.
  - O código é comparado em tempo constante.
  - Expõe só o necessário (sem comissão, sem dados de outros clientes). O reconhecimento por telefone devolve apenas o primeiro nome.
  - Aplica o horário de funcionamento e as regras do agendamento online (antecedência mínima, dias à frente).
- **Compartilhar:** em Configurações > Página pública, com o link, copiar, WhatsApp, QR code (`DsQrCode`) e abrir a página. O link não aparece mais no menu, porque o modo `com_link` precisa do código.

## Consequências

- Trocar o código ou o endereço quebra links já enviados. A tela avisa antes.
- **Antes de produção:** limitar requisições na API pública (por IP e por slug), contra varredura de telefones e agendamentos falsos. Em seguida, confirmar o agendamento por código no WhatsApp ou SMS (planejamento 0015, fase 2).
