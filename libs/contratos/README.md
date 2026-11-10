# @barbertime/contratos

Tipos das respostas e dos corpos da API, comuns à API e aos apps (planejamento 0040, ADR 0022). Só tipos: nada daqui existe em tempo de execução.

- A API tipa as respostas com estes contratos (datas como `Date`).
- Os apps leem com `EmJson<Contrato>`, que troca `Date` por texto ISO, como chega pelo JSON.
