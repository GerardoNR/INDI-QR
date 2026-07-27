// La Barcode Detection API (Chrome/Android) no está en las libs "DOM" que
// trae TypeScript porque no es un estándar W3C estable — solo Chromium la
// implementa. Se declara aquí lo mínimo que se usa, para poder detectarla
// en tiempo de ejecución (`'BarcodeDetector' in window`) sin recurrir a
// `any` en el resto del código.

interface DetectedBarcode {
  readonly boundingBox: DOMRectReadOnly
  readonly rawValue: string
  readonly format: string
  readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  static getSupportedFormats(): Promise<string[]>
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
