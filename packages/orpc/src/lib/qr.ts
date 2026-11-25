import { toString as renderQr } from "qrcode"

/** The one QR renderer: an svg string for a hotel page or a guest's code. */
export const qrSvg = (text: string): Promise<string> =>
  renderQr(text, { type: "svg", margin: 2, errorCorrectionLevel: "M" })
