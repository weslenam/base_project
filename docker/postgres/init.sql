-- Executado uma única vez, na criação do volume do postgres (ADR 0001 e 0002).
-- Cria o papel da aplicação SEM superusuário e SEM BYPASSRLS, para que o
-- Row-Level Security valha também no desenvolvimento. O superusuário
-- (POSTGRES_USER) fica só para migrações e é o dono das tabelas.

\getenv app_senha APP_DB_PASSWORD

CREATE ROLE barbertime_app
  LOGIN
  PASSWORD :'app_senha'
  NOSUPERUSER
  NOBYPASSRLS
  NOCREATEDB
  NOCREATEROLE;

GRANT CONNECT ON DATABASE :"DBNAME" TO barbertime_app;
GRANT USAGE ON SCHEMA public TO barbertime_app;

-- Tabelas e sequências criadas pelas migrações (superusuário) já nascem acessíveis.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO barbertime_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO barbertime_app;
