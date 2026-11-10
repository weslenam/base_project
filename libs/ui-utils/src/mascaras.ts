// Máscaras e validações brasileiras. Puras: entram texto ou número, saem texto ou booleano.
// Convenção: o modelo guarda só dígitos (telefone, CPF) ou número (moeda).

/** Remove tudo que não é dígito: '(11) 9 8765' → '119 8765' → '1198765'. */
/** Valor de campo: texto digitado ou número. */
type Entrada = string | number | null | undefined;

export function somenteDigitos(valor: Entrada): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Formata progressivamente: '11987654321' → '(11) 98765-4321'; fixo com 10 dígitos → '(11) 3456-7890'. */
export function formatarTelefone(valor: Entrada): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Telefone completo: DDD válido e 10 dígitos (fixo) ou 11 começando por 9 (celular). */
export function validarTelefone(valor: Entrada): boolean {
  const d = somenteDigitos(valor);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 10) return /^[2-5]$/.test(d[2]);
  if (d.length === 11) return d[2] === '9';
  return false;
}

/** Formata progressivamente: '12345678909' → '123.456.789-09'. */
export function formatarCpf(valor: Entrada): string {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** CPF com 11 dígitos e dígitos verificadores corretos (rejeita sequências repetidas). */
export function validarCpf(valor: Entrada): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce(
      (total, n, i) => total + Number(n) * (base.length + 1 - i),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(d.slice(0, 9)) === Number(d[9]) &&
    digito(d.slice(0, 10)) === Number(d[10])
  );
}

const formatoDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Número em reais sem o símbolo: 1234.5 → '1.234,50'. Vazio para null/undefined. */
export function formatarDecimal(valor: Entrada): string {
  if (
    valor === null ||
    valor === undefined ||
    valor === '' ||
    Number.isNaN(Number(valor))
  )
    return '';
  return formatoDecimal.format(Number(valor));
}

/** Dígitos digitados como centavos: '123456' → 1234.56. Vazio vira null. */
export function centavosParaReais(valor: Entrada): number | null {
  const d = somenteDigitos(valor);
  return d ? Number(d) / 100 : null;
}
