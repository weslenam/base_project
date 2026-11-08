# Planejamento 0017: Área de administração do Dono e perfil do usuário

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam
- **Relacionado:** ADRs 0006, 0010 e 0012; planejamento 0013
- **Commits:** ainda não commitado

## Solicitação de origem

> crie uma área de administracao para o Dono para poder configurar, também como profile trocar senha e configurar usuarios

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum. Escopo definido a partir do que já existe (usuários, papéis e módulos, do planejamento 0013).

## Objetivo

1. Dar ao Dono uma **área de Administração** própria no menu. Ela reúne uma tela nova, **Configurações da barbearia**, e as telas que já existiam: Usuários, Papéis e permissões, Módulos.
2. Na tela **Configurações da barbearia**, editar:
   - **Dados:** nome, endereço público (slug), telefone/WhatsApp, endereço e Instagram.
   - **Funcionamento:** horário por dia da semana.
   - **Regras do agendamento online:** antecedência mínima, até quantos dias à frente e cancelamento até X horas antes.
3. Criar o **Meu perfil**, para qualquer usuário logado. Ele permite editar o nome, **trocar a senha** (com a senha atual) e ver as barbearias às quais tem acesso, trocando entre elas.
4. Em **Usuários**, o Dono passa a poder **definir uma senha provisória** para quem esqueceu a sua.

**Fora do escopo:**

- trocar o e-mail da conta;
- recuperar senha por e-mail ("esqueci minha senha", que depende de envio de e-mail);
- fazer a página pública e a agenda (que ainda usam dados de exemplo) lerem estas configurações. Isso fica para a fase 3 do 0013.

## Decisões e restrições

- **Configuração da barbearia não é preferência.** A ADR 0006 e a regra da central de preferências tratam de escolhas de exibição do usuário. Horário e regras de agendamento são dados do negócio, valem para todos e são editados por quem tem permissão.
  - Ficam numa coluna `configuracoes jsonb` em `barbearias`.
  - São validados por um catálogo fechado em `@barbertime/dominio` (`CONFIG_BARBEARIA_PADRAO`, `validarConfigBarbearia`), usado pela API e pelo front. Registrado na **ADR 0012**.
- **Permissão nova `barbearia.configurar`** (grupo Administração). Fica só com o Dono, como as outras de administração (ADR 0010). Uma migração a inclui nos papéis Dono que já existem.
- **Troca de senha:**
  - exige a senha atual e respeita o mínimo de 8 caracteres;
  - encerra as **outras** sessões do usuário e mantém a atual.
- **Senha provisória definida pelo Dono:**
  - Só vale para conta que tem acesso **apenas a esta barbearia**. A conta é global (pode ter vínculo com outro tenant), e um dono não pode mexer em credencial que outro tenant também usa.
  - A verificação usa uma função `SECURITY DEFINER` restrita, porque o RLS esconde os vínculos de outras barbearias.
  - Não vale para a própria conta (essa vai pelo perfil).
  - Encerra todas as sessões da pessoa.
- **Trocar o endereço público (slug)** passa por advertência: o link antigo deixa de funcionar.
- **Menu agrupado:** o `DsLayout` passa a aceitar `grupo` nos itens (subtítulo no menu), com teste de contrato. Os grupos são Operação (sem título), Cadastros e Administração.
- UI só com Ds\* (skill `design-system`), sem barra de rolagem na página de configurações, que é dividida em abas.

## Etapas

- [x] 1. Domínio: `barbearia.js` (`CONFIG_BARBEARIA_PADRAO`, `validarConfigBarbearia`, `mesclarConfigBarbearia`), permissão `barbearia.configurar`, testes.
- [x] 2. Migração: coluna `barbearias.configuracoes`, permissão nos papéis Dono, função `usuario_so_na_barbearia`.
- [x] 3. API:
  - `GET/PUT /api/barbearia`;
  - `PUT /api/auth/perfil`;
  - `PUT /api/auth/senha`;
  - `PUT /api/usuarios/:id/senha`;
  - testes de integração.
- [x] 4. Lib UI: `grupo` no `DsLayout` com teste de contrato.
- [x] 5. Front:
  - rotas `/configuracoes` e `/perfil`;
  - menu agrupado;
  - nome do usuário no cabeçalho levando ao perfil;
  - telas `ConfiguracoesView` e `PerfilView`;
  - senha provisória no `UsuarioDialogo`;
  - testes.
- [x] 6. ADR 0012, README e índices; `pnpm verificar:tudo`.

## Critérios de pronto

- `pnpm verificar:tudo` passa (lint, testes unitários, build e integração).
- Dono edita e salva as configurações. Quem não tem `barbearia.configurar` recebe 403.
- Senha atual errada é recusada. Depois da troca, uma sessão aberta em outro navegador cai e a atual continua.
- O Dono define senha provisória só para conta exclusiva da barbearia.

## Riscos e pendências

- Página pública e agenda ainda não usam horário e regras (dados de exemplo). Vão usar quando migrarem para a API (0013, fase 3).
- Troca de e-mail e "esqueci minha senha" ficam para quando houver envio de e-mail (Mailpit já está no compose).

## Registro de mudanças

- 2026-11-07: plano criado.
- 2026-11-07: a pedido do usuário ("a pagina de componentes não precisamos mais dela né ou naoa precisa mais aparecer"), a vitrine `/componentes` saiu do menu e passou a existir só no modo de desenvolvimento.
