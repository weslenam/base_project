-- Planejamento 0035: quem criou cada agendamento e bloqueio. Com `agenda.ajudar`
-- (Barbeiro), só se confirma, cancela ou remove o que a própria pessoa criou.
-- Registros antigos e os da página pública ficam sem autor (null).

alter table app.atendimentos
  add column criado_por bigint references app.usuarios (id) on delete set null;

alter table app.bloqueios
  add column criado_por bigint references app.usuarios (id) on delete set null;
