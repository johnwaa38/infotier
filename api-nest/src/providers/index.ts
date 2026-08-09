export interface OcrProvider { extract(buffer: Buffer): Promise<{ text: string; confidence: number }> }
export interface FaceProvider { compare(selfie: Buffer, idFace?: Buffer): Promise<{ matchScore: number; liveness: number }> }
export class StubOcr implements OcrProvider { async extract(buffer: Buffer){ const c=Math.min(0.99,(buffer.length%1000)/1000+0.5); return { text:'STUB_OCR_TEXT', confidence:c } } }
export class StubFace implements FaceProvider { async compare(selfie: Buffer){ const m=Math.min(0.99,(selfie.length%800)/800+0.3); const l=Math.min(0.99,(selfie.length%900)/900+0.3); return { matchScore:m, liveness:l } } }
