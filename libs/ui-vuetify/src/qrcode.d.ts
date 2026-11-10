// Tipos mínimos do pacote `qrcode` (sem @types no projeto): só o que o DsQrCode usa.
declare module 'qrcode' {
  interface OpcoesDoQrCode {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
  const QRCode: {
    toDataURL(texto: string, opcoes?: OpcoesDoQrCode): Promise<string>;
  };
  export default QRCode;
}
