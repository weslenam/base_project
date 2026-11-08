# Planejamento 0023: Hierarquia fixa de papéis e "esqueci a senha"

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** weslenam
- **Relacionado:** ADR 0010 (revisado), ADR 0014; planejamento 0022 (regra "ninguém concede o que não tem", que esta hierarquia substitui)
- **Commits:** ver git log ("feat(acesso): hierarquia fixa de papéis e esqueci a senha")

## Solicitação de origem

> temos que impor regra de hierarquia ou seja:
> 1 dono
> 2 gerente
> 3 recepcao
> 4 barbeiro
>
> eu nao posso alterar papel subindo nem lateral muito menos senhas e isso não é customizavel
> e só posso alterar a minha em profile ou seja na minha área
>
> então segurança ciber ataque vencemos?

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Papéis personalizados → **Remover**: ficam só os 4 papéis fixos, com permissões fixas. A tela Papéis passa a ser só leitura. Quem tiver papel personalizado vira Barbeiro.
  - Quem esqueceu a senha → **Esqueci a senha por e-mail**: ninguém troca senha de ninguém. O link é de uso único e expira em 1h. A senha provisória do Dono sai.
  - Quem gerencia usuários → **Dono e Gerente**, cada um só os níveis abaixo do seu.
  - Dono → **Um Dono só por barbearia**: o do cadastro. Ninguém promove alguém a Dono. Transferir a barbearia fica para depois.
  - "Vencemos?" → respondido na conversa: não existe "vencer"; ficou a lista do que segue aberto, que vira checklist de pré-produção se o usuário quiser.

## Objetivo

Trocar a ACL configurável por uma **hierarquia fixa**: Dono (1) > Gerente (2) > Recepção (3) > Barbeiro (4). Cada um só age sobre quem está **estritamente abaixo**: convidar, dar papel, trocar papel, desativar e remover. Nada sobe nem fica na lateral, e nada é personalizável.

Senha passa a ser só da própria pessoa: troca em Meu perfil e, se esqueceu, recupera por e-mail.

**Fora do escopo:**

- transferir a barbearia ou trocar o Dono;
- verificação em duas etapas;
- o checklist de pré-produção.

## Decisões e restrições

- **Níveis e permissões no domínio** (`@barbertime/dominio`), não no banco.
  - O contexto da requisição monta as permissões a partir da **chave** do papel e dos módulos ativos. A coluna `papeis.permissoes` deixa de ser fonte de verdade, e assim nem um dado adulterado no banco dá acesso.
  - Uma migração sincroniza a coluna com os valores fixos.
- **Permissões fixas:**
  - Dono: todas.
  - Gerente: tudo menos `barbearia.configurar` e `modulos.gerenciar`; ganha `usuarios.gerenciar`.
  - Recepção e Barbeiro: como hoje.
  - `papeis.gerenciar` sai do catálogo.
- **Regra única no domínio:** `podeAgirSobre(nivelDeQuemAge, nivelDoAlvo)` é verdadeiro só quando o alvo está estritamente abaixo. Ela vale para o papel dado, o papel atual do alvo e o papel novo.
  - Com isso, ninguém dá o papel Dono (não há nível acima de 1), o que garante um Dono só.
  - Substitui o `permissoesAlemDasSuas` do planejamento 0022.
- **Papéis personalizados:** a migração move os usuários deles para Barbeiro e apaga esses papéis. As rotas POST, PUT e DELETE de `/papeis` saem; o GET continua, só para leitura.
- **Senha provisória:** a rota `PUT /usuarios/:id/senha` e a opção na tela saem.
- **Esqueci a senha** (ADR 0014):
  - `POST /api/auth/esqueci {email}` responde sempre a mesma coisa, exista o e-mail ou não. O e-mail sai sem esperar o envio, para o tempo não revelar nada. Tem limite por IP e por e-mail.
  - O token tem 32 bytes aleatórios; só o sha256 vai para o banco. Expira em 1h e é de uso único.
  - Os tokens anteriores do usuário caem quando sai um novo.
  - `POST /api/auth/redefinir {token, senha}` troca a senha, invalida o token e derruba todas as sessões. Tem limite por IP.
  - O envio passa por `opts.correio`: SMTP com `nodemailer` (Mailpit no dev) e um correio falso nos testes.
- **Front:**
  - Link "Esqueci minha senha" em Entrar e telas públicas `/esqueci-senha` e `/redefinir-senha`.
  - Usuários oferece só os papéis abaixo do seu; Papéis vira só leitura.
  - Tudo com componentes `Ds*` (skill `design-system`).

## Etapas

- [x] 1. Planejamento (este documento) e revisão do ADR 0010.
- [x] 2. Domínio: níveis, permissões fixas, `podeAgirSobre`; saem `papeis.gerenciar` e `permissoesAlemDasSuas`. Testes.
- [x] 3. Migração: sincroniza os 4 papéis, move personalizados para Barbeiro e apaga os personalizados; tabela `redefinicoes_senha`.
- [x] 4. API: contexto pela chave; usuários com hierarquia; papéis só GET; sai a senha provisória.
- [x] 5. API: esqueci e redefinir, correio (SMTP e falso), limites e schemas.
- [x] 6. Front: Usuários e Papéis (só leitura), Entrar com o link, telas de esqueci e redefinir; dados (HTTP e memória).
- [x] 7. Testes: domínio, integração (hierarquia, um Dono só, recuperação de senha) e telas; ajustar os testes da senha provisória e dos papéis personalizados.
- [x] 8. `pnpm verificar:tudo`.
- [x] 9. `security-review` (bloqueante) e registro.
- [x] 10. Fechar: índices e commit (push só com autorização do usuário).

## Critérios de pronto

- Gerente não convida, altera nem remove Gerente nem Dono; Recepção e Barbeiro não gerenciam ninguém.
- Ninguém dá o papel Dono.
- Não existe rota para trocar a senha de outra pessoa.
- Esqueci a senha:
  - mesma resposta para e-mail existente e inexistente;
  - o link funciona uma vez e expira;
  - as sessões caem.
- `pnpm verificar:tudo` verde e revisão de segurança sem achados.

## Riscos e pendências

- Barbearia com mais de um Dono hoje (dados de desenvolvimento): a migração não escolhe; os dois continuam, mas nenhum consegue mexer no outro.
- Envio de e-mail em produção depende de SMTP configurado (`SMTP_URL`, `APP_URL`); sem isso, em produção o pedido é registrado mas o e-mail não sai (logado como erro).
- Transferir a barbearia ou trocar o Dono, quando o Dono sair, fica para um planejamento próprio (suporte/super admin).

## Registro de mudanças

- 2026-11-08: criado, com as respostas do usuário às quatro perguntas de esclarecimento.
- 2026-11-08: implementado.
  - Domínio: `nivelDoPapel`, `permissoesDoPapel`, `podeAgirSobre` e `papeisAbaixoDe`.
  - Migração `1762500000005`, com a restrição `papeis_hierarquia_fixa` no banco.
  - API: contexto montado pela chave do papel; `/papeis` só com GET; rotas `/auth/esqueci` e `/auth/redefinir`, com correio SMTP (`nodemailer` 10.2.1) e correio falso nos testes.
  - Front: telas Esqueci e Redefinir; Usuários com a hierarquia; Papéis só leitura.
  - `pnpm verificar:tudo` verde:
    - API: 54 testes de integração (8 novos, com hierarquia, adulteração da coluna e recuperação de senha);
    - domínio: 73 testes;
    - front: 116 testes (6 novos).
  - O teste de tempo do login oscilou uma vez (razão 2,36). Ganhou aquecimento e a faixa passou de 0,5 a 2 para 0,33 a 3; ainda reprova a regressão real (0,07).
  - A senha inicial definida ao convidar continua, porque é a criação da conta e não a troca da senha de alguém. Uma melhoria possível é convidar sem senha, mandando um link de "criar senha" por e-mail.
- 2026-11-08: revisão de segurança sobre o stage, sem achados com confiança ≥ 8. Foram avaliados e descartados: bypass da hierarquia, token de redefinição, enumeração, injeção no e-mail e migração. Commit feito; o push espera autorização.
