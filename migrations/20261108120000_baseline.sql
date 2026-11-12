-- Baseline do BarberTime no Supabase local (planejamento 0025, sprint S1; ADRs 0015 e 0017).
-- Gerada do schema das migrações JS 0000 a 0007 (apps/api/migracoes), já no schema `app`,
-- que o PostgREST não publica. As políticas usam app.barbearia_atual(), que lê o GUC
-- app.barbearia_id definido pela API a cada transação.

create schema if not exists app;

-- Papel da aplicação: sem BYPASSRLS. A senha e o LOGIN vêm de fora do git
-- (apps/api/scripts/papel-app.js, a partir de DATABASE_URL).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'barbertime_app') then
    create role barbertime_app nologin nosuperuser nobypassrls;
  end if;
end $$;

create function app.barbearia_atual() returns bigint
  language sql stable
  as $$ select nullif(current_setting('app.barbearia_id', true), '')::bigint $$;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE FUNCTION app.barbearias_do_usuario(p_usuario bigint) RETURNS TABLE(barbearia_id bigint, nome text, slug text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'app'
    AS $$
      select b.id, b.nome, b.slug
        from vinculos v join barbearias b on b.id = v.barbearia_id
       where v.usuario_id = p_usuario and v.ativo
       order by b.nome
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;


CREATE TABLE app.atendimentos (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    data date NOT NULL,
    inicio text,
    fim text,
    barbeiro_id bigint,
    servico_id bigint,
    cliente_id bigint,
    estado text NOT NULL,
    motivo text,
    canal text DEFAULT 'balcao'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    origem text DEFAULT 'agendamento'::text NOT NULL,
    cliente_nome text,
    duracao integer,
    confirmado_em timestamp with time zone,
    chegou_em timestamp with time zone,
    iniciado_em timestamp with time zone,
    finalizado_em timestamp with time zone,
    CONSTRAINT atendimentos_agendado_completo CHECK (((origem <> 'agendamento'::text) OR ((barbeiro_id IS NOT NULL) AND (inicio IS NOT NULL) AND (fim IS NOT NULL)))),
    CONSTRAINT atendimentos_canal CHECK ((canal = ANY (ARRAY['balcao'::text, 'publico'::text]))),
    CONSTRAINT atendimentos_estado CHECK ((estado = ANY (ARRAY['agendado'::text, 'chegou'::text, 'na_fila'::text, 'em_atendimento'::text, 'finalizado'::text, 'pago'::text, 'desistiu'::text, 'no_show'::text, 'cancelado'::text]))),
    CONSTRAINT atendimentos_horario CHECK (((inicio IS NULL) OR (fim IS NULL) OR (inicio < fim))),
    CONSTRAINT atendimentos_origem CHECK ((origem = ANY (ARRAY['agendamento'::text, 'avulso'::text])))
);

ALTER TABLE ONLY app.atendimentos FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.atendimentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.atendimentos_id_seq OWNED BY app.atendimentos.id;



CREATE TABLE app.barbearia_modulos (
    barbearia_id bigint NOT NULL,
    modulo text NOT NULL,
    estado text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT barbearia_modulos_estado_check CHECK ((estado = ANY (ARRAY['inativo'::text, 'solicitado'::text, 'ativo'::text])))
);

ALTER TABLE ONLY app.barbearia_modulos FORCE ROW LEVEL SECURITY;



CREATE TABLE app.barbearias (
    id bigint NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    token_publico text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
    CONSTRAINT barbearias_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
    CONSTRAINT barbearias_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);



CREATE SEQUENCE app.barbearias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.barbearias_id_seq OWNED BY app.barbearias.id;



CREATE TABLE app.barbeiros (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    usuario_id bigint,
    nome text NOT NULL,
    inicio text NOT NULL,
    fim text NOT NULL,
    comissao numeric(5,2) DEFAULT 0 NOT NULL,
    excluido_em timestamp with time zone,
    em_pausa boolean DEFAULT false NOT NULL,
    CONSTRAINT barbeiros_check CHECK ((inicio < fim)),
    CONSTRAINT barbeiros_comissao_check CHECK (((comissao >= (0)::numeric) AND (comissao <= (100)::numeric))),
    CONSTRAINT barbeiros_fim_check CHECK ((fim ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)),
    CONSTRAINT barbeiros_inicio_check CHECK ((inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)),
    CONSTRAINT barbeiros_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0))
);

ALTER TABLE ONLY app.barbeiros FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.barbeiros_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.barbeiros_id_seq OWNED BY app.barbeiros.id;



CREATE TABLE app.bloqueios (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    barbeiro_id bigint NOT NULL,
    data date NOT NULL,
    inicio text NOT NULL,
    fim text NOT NULL,
    motivo text DEFAULT 'Bloqueado'::text NOT NULL,
    cancelado boolean DEFAULT false NOT NULL,
    CONSTRAINT bloqueios_check CHECK ((inicio < fim))
);

ALTER TABLE ONLY app.bloqueios FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.bloqueios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.bloqueios_id_seq OWNED BY app.bloqueios.id;



CREATE TABLE app.caixas (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    data date NOT NULL,
    valor_inicial numeric(10,2) DEFAULT 0 NOT NULL,
    aberto boolean DEFAULT true NOT NULL,
    aberto_as text NOT NULL,
    fechado_as text,
    dinheiro_contado numeric(10,2),
    diferenca numeric(10,2),
    CONSTRAINT caixas_valor_inicial_check CHECK ((valor_inicial >= (0)::numeric))
);

ALTER TABLE ONLY app.caixas FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.caixas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.caixas_id_seq OWNED BY app.caixas.id;



CREATE TABLE app.categorias_financeiras (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    CONSTRAINT categorias_financeiras_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
    CONSTRAINT categorias_financeiras_tipo_check CHECK ((tipo = ANY (ARRAY['pagar'::text, 'receber'::text])))
);

ALTER TABLE ONLY app.categorias_financeiras FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.categorias_financeiras_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.categorias_financeiras_id_seq OWNED BY app.categorias_financeiras.id;



CREATE TABLE app.clientes (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    nome text NOT NULL,
    telefone text,
    cpf text,
    observacoes text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    excluido_em timestamp with time zone,
    CONSTRAINT clientes_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
    CONSTRAINT clientes_telefone_check CHECK ((telefone ~ '^[0-9]{10,11}$'::text))
);

ALTER TABLE ONLY app.clientes FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.clientes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.clientes_id_seq OWNED BY app.clientes.id;



CREATE TABLE app.comandas (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    caixa_id bigint NOT NULL,
    atendimento_id bigint,
    cliente_id bigint,
    barbeiro_id bigint,
    hora text NOT NULL,
    itens jsonb DEFAULT '[]'::jsonb NOT NULL,
    desconto numeric(10,2) DEFAULT 0 NOT NULL,
    forma text,
    estado text DEFAULT 'aberta'::text NOT NULL,
    paga_as text,
    CONSTRAINT comandas_desconto_check CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT comandas_estado_check CHECK ((estado = ANY (ARRAY['aberta'::text, 'paga'::text, 'cancelada'::text])))
);

ALTER TABLE ONLY app.comandas FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.comandas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.comandas_id_seq OWNED BY app.comandas.id;



CREATE TABLE app.compras (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    fornecedor_id bigint NOT NULL,
    data date NOT NULL,
    frete numeric(12,2) DEFAULT 0 NOT NULL,
    desconto numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    cancelada_em timestamp with time zone,
    criada_por bigint,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compras_desconto_check CHECK ((desconto >= (0)::numeric)),
    CONSTRAINT compras_frete_check CHECK ((frete >= (0)::numeric)),
    CONSTRAINT compras_total_check CHECK ((total >= (0)::numeric))
);

ALTER TABLE ONLY app.compras FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.compras_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.compras_id_seq OWNED BY app.compras.id;



CREATE TABLE app.contas (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    tipo text NOT NULL,
    descricao text NOT NULL,
    categoria_id bigint NOT NULL,
    valor numeric(12,2) NOT NULL,
    vencimento date NOT NULL,
    fornecedor_id bigint,
    cliente_id bigint,
    compra_id bigint,
    parcela integer,
    parcelas integer,
    origem text DEFAULT 'manual'::text NOT NULL,
    situacao text DEFAULT 'aberta'::text NOT NULL,
    pago_em date,
    valor_pago numeric(12,2),
    forma text,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contas_descricao_check CHECK ((length(TRIM(BOTH FROM descricao)) > 0)),
    CONSTRAINT contas_origem_check CHECK ((origem = ANY (ARRAY['manual'::text, 'compra'::text, 'recorrencia'::text]))),
    CONSTRAINT contas_situacao_check CHECK ((situacao = ANY (ARRAY['aberta'::text, 'quitada'::text, 'cancelada'::text]))),
    CONSTRAINT contas_tipo_check CHECK ((tipo = ANY (ARRAY['pagar'::text, 'receber'::text]))),
    CONSTRAINT contas_valor_check CHECK ((valor > (0)::numeric))
);

ALTER TABLE ONLY app.contas FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.contas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.contas_id_seq OWNED BY app.contas.id;



CREATE TABLE app.fichas_tecnicas (
    barbearia_id bigint NOT NULL,
    servico_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    CONSTRAINT fichas_tecnicas_quantidade_check CHECK ((quantidade > (0)::numeric))
);

ALTER TABLE ONLY app.fichas_tecnicas FORCE ROW LEVEL SECURITY;



CREATE TABLE app.fornecedores (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    nome text NOT NULL,
    documento text,
    telefone text,
    observacoes text DEFAULT ''::text NOT NULL,
    excluido_em timestamp with time zone,
    CONSTRAINT fornecedores_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0))
);

ALTER TABLE ONLY app.fornecedores FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.fornecedores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.fornecedores_id_seq OWNED BY app.fornecedores.id;



CREATE TABLE app.itens_compra (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    compra_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    custo_unitario numeric(12,2) NOT NULL,
    CONSTRAINT itens_compra_custo_unitario_check CHECK ((custo_unitario >= (0)::numeric)),
    CONSTRAINT itens_compra_quantidade_check CHECK ((quantidade > (0)::numeric))
);

ALTER TABLE ONLY app.itens_compra FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.itens_compra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.itens_compra_id_seq OWNED BY app.itens_compra.id;



CREATE TABLE app.movimentos_estoque (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    tipo text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    custo_unitario numeric(12,2),
    motivo text DEFAULT ''::text NOT NULL,
    comanda_id bigint,
    compra_id bigint,
    usuario_id bigint,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimentos_estoque_quantidade_check CHECK ((quantidade <> (0)::numeric)),
    CONSTRAINT movimentos_estoque_tipo_check CHECK ((tipo = ANY (ARRAY['compra'::text, 'venda'::text, 'consumo_servico'::text, 'consumo_manual'::text, 'ajuste_inventario'::text, 'estorno_compra'::text])))
);

ALTER TABLE ONLY app.movimentos_estoque FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.movimentos_estoque_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.movimentos_estoque_id_seq OWNED BY app.movimentos_estoque.id;



CREATE TABLE app.papeis (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    chave text NOT NULL,
    nome text NOT NULL,
    protegido boolean DEFAULT false NOT NULL,
    permissoes text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT papeis_hierarquia_fixa CHECK ((chave = ANY (ARRAY['dono'::text, 'gerente'::text, 'recepcao'::text, 'barbeiro'::text]))),
    CONSTRAINT papeis_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0))
);

ALTER TABLE ONLY app.papeis FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.papeis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.papeis_id_seq OWNED BY app.papeis.id;



CREATE SEQUENCE app.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE app.produtos (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    nome text NOT NULL,
    preco numeric(10,2),
    comissao numeric(5,2) DEFAULT 0 NOT NULL,
    excluido_em timestamp with time zone,
    tipo text DEFAULT 'revenda'::text NOT NULL,
    unidade text DEFAULT 'un'::text NOT NULL,
    estoque_minimo numeric(12,3) DEFAULT 0 NOT NULL,
    ultimo_custo numeric(12,2),
    saldo numeric(12,3) DEFAULT 0 NOT NULL,
    CONSTRAINT produtos_comissao_check CHECK (((comissao >= (0)::numeric) AND (comissao <= (100)::numeric))),
    CONSTRAINT produtos_estoque_minimo_check CHECK ((estoque_minimo >= (0)::numeric)),
    CONSTRAINT produtos_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
    CONSTRAINT produtos_preco_da_revenda CHECK (((tipo = 'consumivel'::text) OR ((preco IS NOT NULL) AND (preco > (0)::numeric)))),
    CONSTRAINT produtos_tipo_check CHECK ((tipo = ANY (ARRAY['revenda'::text, 'consumivel'::text]))),
    CONSTRAINT produtos_unidade_check CHECK ((unidade = ANY (ARRAY['un'::text, 'ml'::text, 'g'::text, 'cx'::text, 'par'::text])))
);

ALTER TABLE ONLY app.produtos FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.produtos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.produtos_id_seq OWNED BY app.produtos.id;



CREATE TABLE app.redefinicoes_senha (
    id_hash text NOT NULL,
    usuario_id bigint NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usada_em timestamp with time zone,
    criada_em timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE app.servicos (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    nome text NOT NULL,
    duracao integer NOT NULL,
    preco numeric(10,2) NOT NULL,
    excluido_em timestamp with time zone,
    CONSTRAINT servicos_duracao_check CHECK ((duracao > 0)),
    CONSTRAINT servicos_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
    CONSTRAINT servicos_preco_check CHECK ((preco >= (0)::numeric))
);

ALTER TABLE ONLY app.servicos FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.servicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.servicos_id_seq OWNED BY app.servicos.id;



CREATE TABLE app.sessoes (
    id_hash text NOT NULL,
    usuario_id bigint NOT NULL,
    barbearia_id bigint,
    expira_em timestamp with time zone NOT NULL,
    criada_em timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE app.usuarios (
    id bigint NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuarios_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0))
);



CREATE SEQUENCE app.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.usuarios_id_seq OWNED BY app.usuarios.id;



CREATE TABLE app.vinculos (
    id bigint NOT NULL,
    barbearia_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    papel_id bigint NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY app.vinculos FORCE ROW LEVEL SECURITY;



CREATE SEQUENCE app.vinculos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE app.vinculos_id_seq OWNED BY app.vinculos.id;



ALTER TABLE ONLY app.atendimentos ALTER COLUMN id SET DEFAULT nextval('app.atendimentos_id_seq'::regclass);



ALTER TABLE ONLY app.barbearias ALTER COLUMN id SET DEFAULT nextval('app.barbearias_id_seq'::regclass);



ALTER TABLE ONLY app.barbeiros ALTER COLUMN id SET DEFAULT nextval('app.barbeiros_id_seq'::regclass);



ALTER TABLE ONLY app.bloqueios ALTER COLUMN id SET DEFAULT nextval('app.bloqueios_id_seq'::regclass);



ALTER TABLE ONLY app.caixas ALTER COLUMN id SET DEFAULT nextval('app.caixas_id_seq'::regclass);



ALTER TABLE ONLY app.categorias_financeiras ALTER COLUMN id SET DEFAULT nextval('app.categorias_financeiras_id_seq'::regclass);



ALTER TABLE ONLY app.clientes ALTER COLUMN id SET DEFAULT nextval('app.clientes_id_seq'::regclass);



ALTER TABLE ONLY app.comandas ALTER COLUMN id SET DEFAULT nextval('app.comandas_id_seq'::regclass);



ALTER TABLE ONLY app.compras ALTER COLUMN id SET DEFAULT nextval('app.compras_id_seq'::regclass);



ALTER TABLE ONLY app.contas ALTER COLUMN id SET DEFAULT nextval('app.contas_id_seq'::regclass);



ALTER TABLE ONLY app.fornecedores ALTER COLUMN id SET DEFAULT nextval('app.fornecedores_id_seq'::regclass);



ALTER TABLE ONLY app.itens_compra ALTER COLUMN id SET DEFAULT nextval('app.itens_compra_id_seq'::regclass);



ALTER TABLE ONLY app.movimentos_estoque ALTER COLUMN id SET DEFAULT nextval('app.movimentos_estoque_id_seq'::regclass);



ALTER TABLE ONLY app.papeis ALTER COLUMN id SET DEFAULT nextval('app.papeis_id_seq'::regclass);



ALTER TABLE ONLY app.produtos ALTER COLUMN id SET DEFAULT nextval('app.produtos_id_seq'::regclass);



ALTER TABLE ONLY app.servicos ALTER COLUMN id SET DEFAULT nextval('app.servicos_id_seq'::regclass);



ALTER TABLE ONLY app.usuarios ALTER COLUMN id SET DEFAULT nextval('app.usuarios_id_seq'::regclass);



ALTER TABLE ONLY app.vinculos ALTER COLUMN id SET DEFAULT nextval('app.vinculos_id_seq'::regclass);



ALTER TABLE ONLY app.atendimentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.barbearia_modulos
    ADD CONSTRAINT barbearia_modulos_pkey PRIMARY KEY (barbearia_id, modulo);



ALTER TABLE ONLY app.barbearias
    ADD CONSTRAINT barbearias_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.barbearias
    ADD CONSTRAINT barbearias_slug_key UNIQUE (slug);



ALTER TABLE ONLY app.barbeiros
    ADD CONSTRAINT barbeiros_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.bloqueios
    ADD CONSTRAINT bloqueios_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.caixas
    ADD CONSTRAINT caixas_barbearia_id_data_key UNIQUE (barbearia_id, data);



ALTER TABLE ONLY app.caixas
    ADD CONSTRAINT caixas_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_barbearia_id_id_key UNIQUE (barbearia_id, id);



ALTER TABLE ONLY app.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.clientes
    ADD CONSTRAINT clientes_barbearia_id_telefone_key UNIQUE (barbearia_id, telefone);



ALTER TABLE ONLY app.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_atendimento_id_key UNIQUE (atendimento_id);



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.compras
    ADD CONSTRAINT compras_barbearia_id_id_key UNIQUE (barbearia_id, id);



ALTER TABLE ONLY app.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.fichas_tecnicas
    ADD CONSTRAINT fichas_tecnicas_pkey PRIMARY KEY (servico_id, produto_id);



ALTER TABLE ONLY app.fornecedores
    ADD CONSTRAINT fornecedores_barbearia_id_id_key UNIQUE (barbearia_id, id);



ALTER TABLE ONLY app.fornecedores
    ADD CONSTRAINT fornecedores_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.itens_compra
    ADD CONSTRAINT itens_compra_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.papeis
    ADD CONSTRAINT papeis_barbearia_id_nome_key UNIQUE (barbearia_id, nome);



ALTER TABLE ONLY app.papeis
    ADD CONSTRAINT papeis_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.redefinicoes_senha
    ADD CONSTRAINT redefinicoes_senha_pkey PRIMARY KEY (id_hash);



ALTER TABLE ONLY app.servicos
    ADD CONSTRAINT servicos_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.sessoes
    ADD CONSTRAINT sessoes_pkey PRIMARY KEY (id_hash);



ALTER TABLE ONLY app.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);



ALTER TABLE ONLY app.vinculos
    ADD CONSTRAINT vinculos_barbearia_id_usuario_id_key UNIQUE (barbearia_id, usuario_id);



ALTER TABLE ONLY app.vinculos
    ADD CONSTRAINT vinculos_pkey PRIMARY KEY (id);



CREATE INDEX atendimentos_barbearia ON app.atendimentos USING btree (barbearia_id);



CREATE INDEX atendimentos_cliente ON app.atendimentos USING btree (cliente_id);



CREATE INDEX atendimentos_dia ON app.atendimentos USING btree (barbearia_id, data, barbeiro_id);



CREATE INDEX barbeiros_barbearia ON app.barbeiros USING btree (barbearia_id);



CREATE UNIQUE INDEX barbeiros_usuario_unico ON app.barbeiros USING btree (usuario_id) WHERE ((usuario_id IS NOT NULL) AND (excluido_em IS NULL));



CREATE INDEX bloqueios_barbearia ON app.bloqueios USING btree (barbearia_id);



CREATE INDEX caixas_barbearia ON app.caixas USING btree (barbearia_id);



CREATE INDEX categorias_financeiras_barbearia ON app.categorias_financeiras USING btree (barbearia_id);



CREATE UNIQUE INDEX categorias_nome_unico ON app.categorias_financeiras USING btree (barbearia_id, tipo, lower(nome));



CREATE INDEX clientes_barbearia ON app.clientes USING btree (barbearia_id);



CREATE UNIQUE INDEX clientes_da_barbearia ON app.clientes USING btree (barbearia_id, id);



CREATE INDEX comandas_barbearia ON app.comandas USING btree (barbearia_id);



CREATE INDEX comandas_caixa ON app.comandas USING btree (caixa_id);



CREATE INDEX comandas_cliente ON app.comandas USING btree (cliente_id);



CREATE INDEX compras_barbearia ON app.compras USING btree (barbearia_id);



CREATE INDEX contas_barbearia ON app.contas USING btree (barbearia_id);



CREATE INDEX contas_compra ON app.contas USING btree (compra_id);



CREATE INDEX contas_vencimento ON app.contas USING btree (barbearia_id, situacao, vencimento);



CREATE INDEX fornecedores_barbearia ON app.fornecedores USING btree (barbearia_id);



CREATE INDEX itens_compra_barbearia ON app.itens_compra USING btree (barbearia_id);



CREATE INDEX itens_compra_compra ON app.itens_compra USING btree (compra_id);



CREATE INDEX movimentos_estoque_barbearia ON app.movimentos_estoque USING btree (barbearia_id);



CREATE INDEX movimentos_estoque_produto ON app.movimentos_estoque USING btree (produto_id, criado_em DESC);



CREATE INDEX papeis_barbearia ON app.papeis USING btree (barbearia_id);



CREATE INDEX produtos_barbearia ON app.produtos USING btree (barbearia_id);



CREATE UNIQUE INDEX produtos_da_barbearia ON app.produtos USING btree (barbearia_id, id);



CREATE UNIQUE INDEX produtos_nome_unico ON app.produtos USING btree (barbearia_id, lower(nome)) WHERE (excluido_em IS NULL);



CREATE INDEX redefinicoes_senha_usuario ON app.redefinicoes_senha USING btree (usuario_id);



CREATE INDEX servicos_barbearia ON app.servicos USING btree (barbearia_id);



CREATE UNIQUE INDEX servicos_da_barbearia ON app.servicos USING btree (barbearia_id, id);



CREATE UNIQUE INDEX servicos_nome_unico ON app.servicos USING btree (barbearia_id, lower(nome)) WHERE (excluido_em IS NULL);



CREATE INDEX sessoes_usuario ON app.sessoes USING btree (usuario_id);



CREATE UNIQUE INDEX usuarios_email_unico ON app.usuarios USING btree (lower(email));



CREATE INDEX vinculos_barbearia ON app.vinculos USING btree (barbearia_id);



ALTER TABLE ONLY app.atendimentos
    ADD CONSTRAINT agendamentos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.atendimentos
    ADD CONSTRAINT agendamentos_barbeiro_id_fkey FOREIGN KEY (barbeiro_id) REFERENCES app.barbeiros(id);



ALTER TABLE ONLY app.atendimentos
    ADD CONSTRAINT agendamentos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES app.servicos(id);



ALTER TABLE ONLY app.atendimentos
    ADD CONSTRAINT atendimentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES app.clientes(id) ON DELETE RESTRICT;



ALTER TABLE ONLY app.barbearia_modulos
    ADD CONSTRAINT barbearia_modulos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.barbeiros
    ADD CONSTRAINT barbeiros_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.barbeiros
    ADD CONSTRAINT barbeiros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES app.usuarios(id) ON DELETE SET NULL;



ALTER TABLE ONLY app.bloqueios
    ADD CONSTRAINT bloqueios_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.bloqueios
    ADD CONSTRAINT bloqueios_barbeiro_id_fkey FOREIGN KEY (barbeiro_id) REFERENCES app.barbeiros(id);



ALTER TABLE ONLY app.caixas
    ADD CONSTRAINT caixas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.clientes
    ADD CONSTRAINT clientes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES app.atendimentos(id) ON DELETE SET NULL;



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_barbeiro_id_fkey FOREIGN KEY (barbeiro_id) REFERENCES app.barbeiros(id);



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES app.caixas(id);



ALTER TABLE ONLY app.comandas
    ADD CONSTRAINT comandas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES app.clientes(id) ON DELETE SET NULL;



ALTER TABLE ONLY app.compras
    ADD CONSTRAINT compras_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.compras
    ADD CONSTRAINT compras_barbearia_id_fornecedor_id_fkey FOREIGN KEY (barbearia_id, fornecedor_id) REFERENCES app.fornecedores(barbearia_id, id);



ALTER TABLE ONLY app.compras
    ADD CONSTRAINT compras_criada_por_fkey FOREIGN KEY (criada_por) REFERENCES app.usuarios(id);



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_barbearia_id_categoria_id_fkey FOREIGN KEY (barbearia_id, categoria_id) REFERENCES app.categorias_financeiras(barbearia_id, id);



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_barbearia_id_cliente_id_fkey FOREIGN KEY (barbearia_id, cliente_id) REFERENCES app.clientes(barbearia_id, id);



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_barbearia_id_compra_id_fkey FOREIGN KEY (barbearia_id, compra_id) REFERENCES app.compras(barbearia_id, id);



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.contas
    ADD CONSTRAINT contas_barbearia_id_fornecedor_id_fkey FOREIGN KEY (barbearia_id, fornecedor_id) REFERENCES app.fornecedores(barbearia_id, id);



ALTER TABLE ONLY app.fichas_tecnicas
    ADD CONSTRAINT fichas_tecnicas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.fichas_tecnicas
    ADD CONSTRAINT fichas_tecnicas_barbearia_id_produto_id_fkey FOREIGN KEY (barbearia_id, produto_id) REFERENCES app.produtos(barbearia_id, id);



ALTER TABLE ONLY app.fichas_tecnicas
    ADD CONSTRAINT fichas_tecnicas_barbearia_id_servico_id_fkey FOREIGN KEY (barbearia_id, servico_id) REFERENCES app.servicos(barbearia_id, id);



ALTER TABLE ONLY app.fornecedores
    ADD CONSTRAINT fornecedores_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.itens_compra
    ADD CONSTRAINT itens_compra_barbearia_id_compra_id_fkey FOREIGN KEY (barbearia_id, compra_id) REFERENCES app.compras(barbearia_id, id) ON DELETE CASCADE;



ALTER TABLE ONLY app.itens_compra
    ADD CONSTRAINT itens_compra_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.itens_compra
    ADD CONSTRAINT itens_compra_barbearia_id_produto_id_fkey FOREIGN KEY (barbearia_id, produto_id) REFERENCES app.produtos(barbearia_id, id);



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_barbearia_id_compra_id_fkey FOREIGN KEY (barbearia_id, compra_id) REFERENCES app.compras(barbearia_id, id);



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_barbearia_id_produto_id_fkey FOREIGN KEY (barbearia_id, produto_id) REFERENCES app.produtos(barbearia_id, id);



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES app.comandas(id) ON DELETE SET NULL;



ALTER TABLE ONLY app.movimentos_estoque
    ADD CONSTRAINT movimentos_estoque_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES app.usuarios(id);



ALTER TABLE ONLY app.papeis
    ADD CONSTRAINT papeis_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.produtos
    ADD CONSTRAINT produtos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.redefinicoes_senha
    ADD CONSTRAINT redefinicoes_senha_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES app.usuarios(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.servicos
    ADD CONSTRAINT servicos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.sessoes
    ADD CONSTRAINT sessoes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.sessoes
    ADD CONSTRAINT sessoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES app.usuarios(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.vinculos
    ADD CONSTRAINT vinculos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES app.barbearias(id) ON DELETE CASCADE;



ALTER TABLE ONLY app.vinculos
    ADD CONSTRAINT vinculos_papel_id_fkey FOREIGN KEY (papel_id) REFERENCES app.papeis(id);



ALTER TABLE ONLY app.vinculos
    ADD CONSTRAINT vinculos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES app.usuarios(id) ON DELETE CASCADE;



ALTER TABLE app.atendimentos ENABLE ROW LEVEL SECURITY;


CREATE POLICY atendimentos_da_barbearia ON app.atendimentos USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.barbearia_modulos ENABLE ROW LEVEL SECURITY;


CREATE POLICY barbearia_modulos_da_barbearia ON app.barbearia_modulos USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.barbeiros ENABLE ROW LEVEL SECURITY;


CREATE POLICY barbeiros_da_barbearia ON app.barbeiros USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.bloqueios ENABLE ROW LEVEL SECURITY;


CREATE POLICY bloqueios_da_barbearia ON app.bloqueios USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.caixas ENABLE ROW LEVEL SECURITY;


CREATE POLICY caixas_da_barbearia ON app.caixas USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.categorias_financeiras ENABLE ROW LEVEL SECURITY;


CREATE POLICY categorias_financeiras_da_barbearia ON app.categorias_financeiras USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.clientes ENABLE ROW LEVEL SECURITY;


CREATE POLICY clientes_da_barbearia ON app.clientes USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.comandas ENABLE ROW LEVEL SECURITY;


CREATE POLICY comandas_da_barbearia ON app.comandas USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.compras ENABLE ROW LEVEL SECURITY;


CREATE POLICY compras_da_barbearia ON app.compras USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.contas ENABLE ROW LEVEL SECURITY;


CREATE POLICY contas_da_barbearia ON app.contas USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.fichas_tecnicas ENABLE ROW LEVEL SECURITY;


CREATE POLICY fichas_tecnicas_da_barbearia ON app.fichas_tecnicas USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.fornecedores ENABLE ROW LEVEL SECURITY;


CREATE POLICY fornecedores_da_barbearia ON app.fornecedores USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.itens_compra ENABLE ROW LEVEL SECURITY;


CREATE POLICY itens_compra_da_barbearia ON app.itens_compra USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.movimentos_estoque ENABLE ROW LEVEL SECURITY;


CREATE POLICY movimentos_estoque_da_barbearia ON app.movimentos_estoque USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.papeis ENABLE ROW LEVEL SECURITY;


CREATE POLICY papeis_da_barbearia ON app.papeis USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.produtos ENABLE ROW LEVEL SECURITY;


CREATE POLICY produtos_da_barbearia ON app.produtos USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.servicos ENABLE ROW LEVEL SECURITY;


CREATE POLICY servicos_da_barbearia ON app.servicos USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));



ALTER TABLE app.vinculos ENABLE ROW LEVEL SECURITY;


CREATE POLICY vinculos_da_barbearia ON app.vinculos USING ((barbearia_id = app.barbearia_atual())) WITH CHECK ((barbearia_id = app.barbearia_atual()));


--
-- PostgreSQL database dump complete
--




-- Privilégios: só o papel da aplicação usa o schema `app`.
revoke all on schema app from public;
grant usage on schema app to barbertime_app;
grant select, insert, update, delete on all tables in schema app to barbertime_app;
grant usage, select on all sequences in schema app to barbertime_app;
grant execute on all functions in schema app to barbertime_app;
alter default privileges in schema app grant select, insert, update, delete on tables to barbertime_app;
alter default privileges in schema app grant usage, select on sequences to barbertime_app;
alter default privileges in schema app grant execute on functions to barbertime_app;
alter role barbertime_app set search_path = app;

-- Papéis do Supabase (se existirem neste servidor) não enxergam nada em `app`.
do $$
declare papel text;
begin
  foreach papel in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on schema app from %I', papel);
      execute format('revoke all on all tables in schema app from %I', papel);
      execute format('revoke all on all sequences in schema app from %I', papel);
      execute format('revoke all on all functions in schema app from %I', papel);
    end if;
  end loop;
end $$;

-- Quem conecta neste banco procura primeiro em `app`.
do $$ begin
  execute format('alter database %I set search_path = app, public, extensions', current_database());
end $$;
