# Planejamento 0020: Operação pelo próprio barbeiro, encaixe e fila

- **Status:** Rascunho (começa depois da parte 2 do planejamento 0019)
- **Data:** 2026-11-07
- **Solicitado por:** weslenam
- **Relacionado:** planejamentos 0009, 0010, 0012 e 0019; ADR 0010
- **Commits:** ainda não commitado

## Solicitação de origem

> temos que achar uma forma do sistema se adaptar para o barbeiro porque normalmente no dia a dia o proprio barbeiro pode fazer o fechamento não tem alguem para fazer o atendimento eventualmente o dono faz mas não é o padrão então temos que trabalhar com agendamento e encaixe (avulso - que cadastramos em seguida) havia algo como fila nos sistemas concorrentes podemos fazer o mesmo

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente (durante o planejamento 0019)
- **Esclarecimentos:** a fazer antes de aprovar (ver _Perguntas em aberto_).

## Objetivo (rascunho)

Na maioria das barbearias não há recepção: **o próprio barbeiro** atende, abre e fecha a comanda e recebe. O dono faz isso às vezes, mas não é o padrão.

O sistema precisa se adaptar a esse modo de trabalho:

1. **"Meu dia" do barbeiro:** uma tela com a agenda dele, o próximo cliente e a fila. Nela, o barbeiro marca atendido e já abre e fecha a comanda com poucos toques.
2. **Encaixe:** atender agora quem chegou sem horário (avulso). O cadastro é opcional na hora e pode ser completado depois.
3. **Fila de espera** (como nos concorrentes):
   - quem chega sem horário entra na fila de um barbeiro ou de "qualquer um";
   - a fila mostra a posição e a estimativa de espera;
   - ao chamar, a pessoa vira um encaixe na agenda.
4. **Papéis:** o papel Barbeiro passa a operar o próprio caixa e as próprias comandas. A barbearia escolhe se o caixa é único ou um por barbeiro.

## Decisões já tomadas

- `barbeiros.usuario_id` (criado no 0019) liga o barbeiro à conta de usuário. É a base de "minha agenda", "minhas comandas" e "meu caixa".

## Perguntas em aberto

- **Caixa:** um caixa da barbearia (cada barbeiro recebe nele) ou um caixa por barbeiro?
- **Fila pública:** o cliente entra na fila pelo celular (link ou QR na porta) ou só o barbeiro inclui?
- **Comissão** (pedido anterior, adiado): o fechamento do barbeiro já mostra quanto ele fez no dia?

## Registro de mudanças

- 2026-11-07: rascunho criado a partir do pedido.
