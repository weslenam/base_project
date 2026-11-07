# Planejamento 0012: Busca de cliente pelo telefone, com cadastro rápido

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0006 (agenda), 0008 e 0010 (comanda)
- **Commits:** ainda não commitado (branch `feat/caixa-comanda`)

## Solicitação de origem

> qual é a regra do cliente avulso?
> precisamos adaptar para que a busca seja baseada no telefone do cliente para agilizar e caso não encontre opcao de cadastrar

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Resposta à pergunta (regra vigente):** na comanda, o cliente é opcional; sem cliente, ela é gravada como "Cliente avulso". Entra no caixa normalmente, e a comissão continua ligada ao barbeiro de cada item, mas nada vai para o histórico de nenhum cliente. O agendamento sempre exige cliente cadastrado; a página pública acha ou cria o cliente pelo telefone.

## Objetivo

No balcão, achar o cliente pelo telefone em vez de rolar uma lista de nomes e, se o número não existir, cadastrá-lo ali mesmo com o nome. Isso vale para a **comanda** e para o **novo agendamento**.

**Fora do escopo:** busca por nome nesses diálogos (a tela Clientes já faz) e mudar a regra do avulso.

## Decisões e restrições

- **Componente do app `BuscaCliente`** (`src/telas/clientes/`). Ele conhece a API, por isso não fica na lib de UI, e é montado só com `Ds*`. Funciona assim:
  - O campo é `DsInputTelefone` ("Telefone do cliente").
  - Com 4 dígitos ou mais, mostra até 5 clientes cujo telefone contém os dígitos (os últimos 4 já bastam), em botões grandes com nome e telefone. Um toque seleciona.
  - Com o número completo e válido sem cadastro, aparece "Nenhum cliente com este telefone" e o **cadastro rápido**: campo Nome e botão "Cadastrar e usar". O telefone repetido continua negado pela API.
  - Selecionado, mostra o nome, o telefone, um selo de faltas (se houver) e o botão "Trocar".
  - `permitirAvulso` (só na comanda) mostra o botão "Seguir sem cadastro (avulso)". A regra do avulso não muda: só fica explícita.
- **Agendamento:** a advertência de faltas recentes continua, agora consultando o cliente escolhido.
- **Comanda paga ou cancelada:** mostra só o nome, sem busca.

## Etapas

- [x] 1. `BuscaCliente`.
- [x] 2. Usar no `ComandaDialogo` (com avulso) e no `NovoAgendamento`.
- [x] 3. Testes de tela: achar pelos últimos dígitos, cadastrar número novo, seguir como avulso. Rodar `pnpm verificar`.

## Critérios de pronto

- Digitar parte do telefone de um cliente existente e tocar no resultado seleciona o cliente.
- Telefone completo sem cadastro permite cadastrar com o nome e já seleciona o cliente novo.
- Na comanda, "avulso" continua possível e explícito.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Durante a execução, os resultados passaram a vir **ordenados por quem termina com os dígitos digitados**: os telefones de exemplo são sequenciais e "4321" aparecia em vários. O `DsInputTelefone` ganhou `validarNumero` (padrão `true`): no campo de busca, ele não acusa número incompleto enquanto se digita.
- 2026-11-07: Concluído. 1 contrato novo (`validarNumero`) e 4 testes de tela: últimos dígitos na comanda, cadastro rápido, avulso explícito e agendamento com aviso de faltas. `pnpm verificar` passa.
