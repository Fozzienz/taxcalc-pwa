declare module "@react-pdf/pdfkit" {
  export function registerStdFonts(...fonts: unknown[]): void;
}

declare module "@react-pdf/pdfkit/standard-fonts/*" {
  const font: { name: string };
  export default font;
}
