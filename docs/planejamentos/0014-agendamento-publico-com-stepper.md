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

## Critérios de pronto

- Cada etapa cabe na tela de um celular comum (cerca de 390×740) sem rolagem.
- O fluxo completo continua passando nos testes, agora etapa por etapa.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. `DsPassos` com 2 testes de contrato; 1 teste de tela novo (avanço, resumo, Voltar e voltar pela etapa concluída), e o fluxo completo antigo passa sem mudança. **Estimativa da etapa mais alta** (Serviço, com 4 opções), num celular de 390×740: cabeçalho ~70 + etapas ~60 + resumo ~40 + título ~32 + 4 opções de 52 + espaços ~100 + rodapé ~50 ≈ **560px**. A conferência visual fica com o usuário.
