import type { FaceProvider } from './index'; export class AzureFaceProvider implements FaceProvider { async compare(selfie: Buffer, _idFace?: Buffer){ return { matchScore:0.88, liveness:0.86 } } }
