# ADR 0023: Logs de auditoria e proteção de PII dos clientes

- **Status:** Proposto
- **Data:** 2026-11-12
- **Relacionado:** ADRs 0001, 0009, 0010, 0014; planejamentos 0024 e 0041

## Contexto

O checklist de segurança levantado pelo usuário em 2026-11-12 identificou dois itens sem cobertura:

1. **Auditoria de operações sensíveis**: trocas de senha, baixas de contas, fechamentos de caixa, cancelamentos de comanda paga. Se um acesso indevido ocorrer, não há como reconstruir o que foi feito nem por quem.

2. **Dados pessoais do cliente (PII)**: nome, CPF, telefone e histórico de atendimentos são dados de titulares de barbearias concorrentes dentro do mesmo banco. O isolamento via RLS garante separação entre barbearias, mas não protege contra um ataque que explore uma falha no servidor ou acesso físico ao disco.

A LGPD exige que o controlador (a barbearia) e o operador (o BarberTime) demonstrem que os dados pessoais têm proteção adequada. Sem criptografia em repouso nem logs de acesso a dados sensíveis, essa demonstração é difícil.

## Decisão

### 1. Logs de auditoria

Criar uma tabela `auditoria` global (sem `barbearia_id` na chave primária, mas com ele como coluna) para registrar eventos sensíveis:

```sql
create table auditoria (
  id         bigserial primary key,
  ocorrido_em timestamptz not null default now(),
  barbearia_id integer references barbearias(id),
  usuario_id  integer references usuarios(id),
  evento      text not null,       -- 'senha_trocada', 'baixa_realizada', ...
  entidade    text,                 -- 'contas', 'comandas', 'caixa', ...
  entidade_id integer,
  detalhes    jsonb                 -- campos alterados, sem PII exposta em texto
);
```

**Eventos obrigatórios na fase 1:**
- `senha_trocada` / `senha_redefinida`
- `baixa_realizada` / `baixa_cancelada` (contas financeiras)
- `caixa_fechado` / `movimento_manual`
- `comanda_paga` / `comanda_cancelada` (depois de paga)
- `papel_alterado` / `usuario_desativado` (gestão de acesso)

**Regras:**
- A auditoria é **append-only**: sem UPDATE nem DELETE na tabela (política RLS ou privilégio revogado do `barbertime_app`).
- O `barbertime_app` só faz INSERT; leituras são para o Business Center (operadores da plataforma) e para o Dono da barbearia (só os seus registros, via RLS).
- Não guardar senha, token nem chave em `detalhes` — só IDs e valores de negócio.
- O fuso horário de `ocorrido_em` é UTC; a tela exibe no fuso da barbearia.

### 2. Proteção de PII

**Decisão mínima para a fase 1 (pré-produção):**
- **Não criptografar campos individualmente** ainda: a complexidade de índice, busca e migração é alta para esta fase.
- **Exigir criptografia em repouso do volume do banco** (`pgdata` cifrado pelo provedor de hospedagem ou LUKS). Documentado como pré-requisito do ADR de hospedagem (B1 do plano 0024).
- **Pseudonimização no log de acesso da API**: o Fastify loga a URL com IDs numéricos, não nomes. Garantir que nomes, e-mails e telefones não apareçam em logs de request/response.

**Decisão futura (fase 2, quando houver demanda regulatória ou volume):**
- Criptografia por campo (`pgcrypto.pgp_sym_encrypt`) para CPF e telefone, com chave por barbearia em variável de ambiente.
- Pseudonimização opcional do nome no histórico quando o cliente solicitar exclusão (LGPD `direito ao esquecimento`), sem apagar o registro de atendimento.

### 3. Exclusão de cliente (LGPD)

Registrar como requisito para o planejamento de gestão de clientes:
- Exclusão lógica: marcar o cliente como `excluido_em` e anonimizar nome/CPF/telefone.
- O histórico de atendimentos é mantido (vínculo com o negócio) mas sem vínculo ao titular.
- Exportação dos dados do cliente a pedido (PDF ou JSON), acessível pelo Dono.

## Consequências

- Uma migração nova cria a tabela `auditoria` com a política RLS.
- Os serviços que tratam os eventos listados ganham uma chamada de INSERT (pode ser via função `registrar_auditoria(evento, entidade, id, detalhes)` para manter o serviço limpo).
- Nenhum campo de PII entra em `req.log` — verificação no code review.
- A criptografia em repouso do volume é pré-requisito da hospedagem (bloqueia B1 do plano 0024).
- A fase 2 (criptografia por campo) exige ADR próprio e migração com reescrita dos dados.
