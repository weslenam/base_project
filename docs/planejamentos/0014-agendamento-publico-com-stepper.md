# Planejamento 0014: Agendamento público em etapas (stepper), sem rolagem

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamento 0006 (página pública), ADR 0003
- **Commits:** a335f18 (branch `feat/backend-acl-modulos`)

## Solicitação de origem

> esta tela temos que revisa-la talvez usar stepper para nao ter barra de rolagem

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente, com captura de tela da página `/agendar/barbearia-modelo`. A mensagem chegou durante o planejamento 0013 e foi atendida logo depois dele.
- **O que a captura mostrava:** cabeçalho da barbearia e a etapa "1 Serviço". As etapas seguintes (barbeiro, dia, horário, dados) se acumulavam abaixo, e a página crescia com rolagem.

### Solicitações relacionadas

> o stepper ficou bom mas a tela ainda não esta boa penso q poderiamos deixar maior e podemos tbm aproveitar se o cliente já tiver cadastro mostramos e aproveitamos para dar alguma saudação (2026-11-07, com captura da etapa "Seus dados")

A captura mostrava os nomes das etapas cortados ("BARBEI…", "SEUS D…"), o aviso "Campo obrigatório" aparecendo antes de qualquer digitação e o nome sendo pedido antes do telefone.

### Ajuste de 2026-11-07 (página maior e saudação ao cliente)

- **Mais larga:** até 64rem. Em telas largas, duas colunas: à esquerda as etapas, à direita o cartão **"Seu agendamento"**, com serviço, duração, preço, barbeiro, dia e horário. No celular, continua o resumo em uma linha. Os botões de opção ficam maiores (64px).
- **"Seus dados" com o telefone primeiro.** Com o número completo, o app consulta se o cliente existe:
  - **já cadastrado:** "Olá, Rafael! Que bom te ver de novo." e o botão para confirmar, sem pedir o nome. Há também a opção "Não é você?".
  - **novo:** "Primeira vez por aqui? Seja bem-vindo!" e o campo do nome.
- **Privacidade (LGPD):** a consulta pública devolve **só o primeiro nome**, sem sobrenome, histórico ou qualquer outro dado.
- **Validação:** os campos só acusam erro depois de a pessoa tentar confirmar.

## Objetivo

Mostrar **uma etapa por vez** num stepper (Serviço → Barbeiro → Dia → Horário → Seus dados). Escolher uma opção já avança para a próxima etapa. Um resumo das escolhas fica sempre visível, e "Voltar" retorna à etapa anterior. Nada de rolagem no celular, nas etapas normais.

**Fora do escopo:** regras de agendamento, que continuam as mesmas, e os dados, que seguem sendo os de exemplo até a fase 3 do planejamento 0013.

## Decisões e restrições

- **Novo componente `DsPassos`** (indicador de etapas):
  - lista ordenada com `aria-current="step"` na etapa atual;
  - etapas concluídas viram botões para voltar a elas;
  - no celular, mostra só os números e o nome da etapa atual.
  - Tem contrato.
- **Na página:**
  - cabeçalho compacto da barbearia;
  - `DsPassos`;
  - resumo das escolhas numa linha ("Corte · Marcos · Amanhã · 10:00");
  - o conteúdo da etapa atual;
  - "Voltar" no rodapé.
- **Avanço automático:** o toque numa opção avança, como num PDV. A última etapa tem o formulário e "Confirmar horário".
- **Mudar uma escolha anterior** limpa as que dependem dela: trocar o serviço ou o barbeiro limpa o horário.

## Etapas

- [x] 1. `DsPassos` com contrato, vitrine e README.
- [x] 2. Reescrever `AgendamentoPublicoView` em etapas.
- [x] 3. Testes de tela (fluxo completo, voltar, resumo) e `pnpm verificar`.

- [x] 4. Página maior com o cartão "Seu agendamento" em telas largas.
- [x] 5. Telefone primeiro, reconhecimento do cliente (só o primeiro nome) e saudação.
- [x] 6. Testes de tela (cliente que volta e cliente novo) e `pnpm verificar`.

## Critérios de pronto

- Cada etapa cabe na tela de um celular comum (cerca de 390×740) sem rolagem.
- O fluxo completo continua passando nos testes, agora etapa por etapa.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. `DsPassos` com 2 testes de contrato; 1 teste de tela novo (avanço, resumo, Voltar e voltar pela etapa concluída), e o fluxo completo antigo passa sem mudança. **Estimativa da etapa mais alta** (Serviço, com 4 opções), num celular de 390×740: cabeçalho ~70 + etapas ~60 + resumo ~40 + título ~32 + 4 opções de 52 + espaços ~100 + rodapé ~50 ≈ **560px**. A conferência visual fica com o usuário.
- 2026-11-07: Plano reaberto para a solicitação relacionada (página maior e saudação).
- 2026-11-07: Ajuste concluído. A página tem até 64rem, com o cartão "Seu agendamento" ao lado em telas largas, e o telefone vem primeiro com a saudação. `api.clientes.reconhecer` devolve só o primeiro nome. O erro aparece só ao tentar confirmar. Testes: 1 de dados e 4 de tela (cliente novo, cliente que volta sem mostrar o sobrenome, "Não é você?", cartão com escolhas e valor).
