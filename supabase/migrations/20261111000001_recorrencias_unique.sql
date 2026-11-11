-- Evita duplicatas de contas geradas por recorrência sob concorrência
-- (code-review 0027-2B: check-then-insert sem transação; a constraint garante
-- que apenas um INSERT vence, o outro recebe violation e é ignorado).
ALTER TABLE app.contas
  ADD CONSTRAINT contas_recorrencia_vencimento_unique
  UNIQUE (barbearia_id, recorrencia_id, vencimento);
