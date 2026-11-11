import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * No WSL sem as bibliotecas do sistema (sem sudo), o script
 * scripts/preparar-navegador.sh extrai as que o Chromium precisa em
 * ~/.cache/pw-libs/raiz. Aqui elas entram no LD_LIBRARY_PATH do navegador.
 * Com as bibliotecas instaladas no sistema, isto não muda nada.
 */
export function ambienteDoNavegador(): NodeJS.ProcessEnv {
  const raiz = join(homedir(), '.cache/pw-libs/raiz');
  if (!existsSync(raiz)) return { ...process.env };
  const pastas = new Set<string>();
  const visitar = (dir: string): void => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      const info = statSync(caminho, { throwIfNoEntry: false });
      if (!info) continue;
      if (info.isDirectory()) visitar(caminho);
      else if (nome.includes('.so')) pastas.add(dir);
    }
  };
  visitar(raiz);
  const atual = process.env.LD_LIBRARY_PATH;
  return {
    ...process.env,
    LD_LIBRARY_PATH: [...pastas, ...(atual ? [atual] : [])].join(':'),
  };
}
