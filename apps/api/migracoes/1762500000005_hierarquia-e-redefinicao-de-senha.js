// Planejamento 0023 / ADR 0010: hierarquia fixa de papéis e recuperação de senha.
// - Os quatro papéis ficam com as permissões fixas do domínio (fotografia de
//   2026-11-08; a API monta as permissões pelo código, não por esta coluna).
// - Papéis personalizados deixam de existir: quem tinha um vira Barbeiro.
// - A senha provisória definida pelo Dono sai: a função de apoio é removida.
// - Tokens de "esqueci a senha" (só o sha256, uso único, com validade).

const lista = (perms) =>
  `array[${perms.map((p) => `'${p}'`).join(', ')}]::text[]`;

const GERENTE = [
  'agenda.ver_propria',
  'agenda.ver',
  'agenda.gerenciar',
  'clientes.ver',
  'clientes.editar',
  'clientes.excluir',
  'caixa.operar',
  'caixa.fechar',
  'catalogo.gerenciar',
  'equipe.gerenciar',
  'relatorios.ver',
  'usuarios.gerenciar',
  'fidelidade.gerenciar',
  'pacotes.gerenciar',
  'pacotes.vender',
  'pagamentos.operar',
];
const DONO = [...GERENTE, 'barbearia.configurar', 'modulos.gerenciar'];
const RECEPCAO = [
  'agenda.ver',
  'agenda.gerenciar',
  'clientes.ver',
  'clientes.editar',
  'caixa.operar',
  'pacotes.vender',
];
const BARBEIRO = ['agenda.ver_propria'];

export const up = (pgm) => {
  pgm.sql(`
    update papeis set protegido = true, permissoes = ${lista(DONO)} where chave = 'dono';
    update papeis set protegido = true, permissoes = ${lista(GERENTE)} where chave = 'gerente';
    update papeis set protegido = true, permissoes = ${lista(RECEPCAO)} where chave = 'recepcao';
    update papeis set protegido = true, permissoes = ${lista(BARBEIRO)} where chave = 'barbeiro';

    -- Quem tinha papel personalizado vira Barbeiro (o menor acesso).
    update vinculos v
       set papel_id = (select b.id from papeis b
                        where b.barbearia_id = v.barbearia_id and b.chave = 'barbeiro')
     where v.papel_id in (select id from papeis
                           where chave is null or chave not in ('dono', 'gerente', 'recepcao', 'barbeiro'));
    delete from papeis
     where chave is null or chave not in ('dono', 'gerente', 'recepcao', 'barbeiro');

    -- Nem por acesso direto ao banco nasce papel fora da hierarquia.
    alter table papeis
      alter column chave set not null,
      add constraint papeis_hierarquia_fixa
        check (chave in ('dono', 'gerente', 'recepcao', 'barbeiro'));

    drop function if exists usuario_so_na_barbearia(bigint, bigint);

    create table redefinicoes_senha (
      id_hash text primary key,
      usuario_id bigint not null references usuarios (id) on delete cascade,
      expira_em timestamptz not null,
      usada_em timestamptz,
      criada_em timestamptz not null default now()
    );
    create index redefinicoes_senha_usuario on redefinicoes_senha (usuario_id);

    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'barbertime_app') then
        grant select, insert, update, delete on redefinicoes_senha to barbertime_app;
      end if;
    end $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop table if exists redefinicoes_senha;
    alter table papeis
      drop constraint if exists papeis_hierarquia_fixa,
      alter column chave drop not null;
  `);
};
