import type { OcrProvider } from './index'; export class GoogleVisionProvider implements OcrProvider { async extract(buffer: Buffer){ return { text:'VISION_TEXT', confidence:0.9 } } }
