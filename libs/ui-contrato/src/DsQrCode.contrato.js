import { it, expect } from 'vitest';
import { esperar } from './apoio.js';

export function testarDsQrCode(DsQrCode, montar) {
  it('gera a imagem do QR com o texto alternativo', async () => {
    const w = montar(DsQrCode, {
      props: { valor: 'https://exemplo.dev/agendar/ze', rotulo: 'QR do link' },
    });
    await esperar(() => {
      const img = w.find('img');
      expect(img.exists()).toBe(true);
      expect(img.attributes('alt')).toBe('QR do link');
      expect(img.attributes('src')).toMatch(/^data:image\/png;base64,/);
    });
  });

  it('muda a imagem quando o valor muda', async () => {
    const w = montar(DsQrCode, { props: { valor: 'a', rotulo: 'QR' } });
    await esperar(() => expect(w.find('img').exists()).toBe(true));
    const antes = w.find('img').attributes('src');
    await w.setProps({ valor: 'b' });
    await esperar(() =>
      expect(w.find('img').attributes('src')).not.toBe(antes),
    );
  });
}
