-- Planejamento 0025, sprint S2 (ADR 0017): privilégios mínimos do papel da aplicação.
-- A API nunca apaga usuários nem barbearias (desativa, ou remove o vínculo).
revoke delete on app.usuarios, app.barbearias from barbertime_app;
