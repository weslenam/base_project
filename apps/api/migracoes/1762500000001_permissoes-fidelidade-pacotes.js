// Planejamento 0015 / ADR 0010: permissões novas dos módulos Fidelidade e Pacotes
// entram nos papéis padrão das barbearias que já existem.

const adicionar = (perms) =>
  `permissoes = array(select distinct unnest(permissoes || array[${perms
    .map((p) => `'${p}'`)
    .join(', ')}]::text[]) order by 1)`;

export const up = (pgm) => {
  pgm.sql(`
    update papeis set ${adicionar(['fidelidade.gerenciar', 'pacotes.gerenciar', 'pacotes.vender'])}
     where chave in ('dono', 'gerente');
    update papeis set ${adicionar(['pacotes.vender'])}
     where chave = 'recepcao';
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    update papeis set permissoes = array(
      select unnest(permissoes) except
      select unnest(array['fidelidade.gerenciar', 'pacotes.gerenciar', 'pacotes.vender'])
    );
  `);
};
