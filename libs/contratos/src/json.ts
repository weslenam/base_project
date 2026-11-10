/**
 * O tipo como chega ao front depois do JSON: Date vira texto ISO, e o resto
 * segue a mesma forma. A API tipa com Date; a camada de dados dos apps usa
 * `EmJson<Contrato>`.
 */
export type EmJson<T> = T extends Date
  ? string
  : T extends readonly (infer I)[]
    ? EmJson<I>[]
    : T extends object
      ? { [K in keyof T]: EmJson<T[K]> }
      : T;
