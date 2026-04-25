import { createWorker } from 'tesseract.js';

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerInitializing = false;
const workerQueue: Array<{ resolve: (w: any) => void }> = [];

async function getWorker() {
  if (workerInstance) return workerInstance;
  if (workerInitializing) {
    return new Promise<any>((resolve) => workerQueue.push({ resolve }));
  }
  
  workerInitializing = true;
  workerInstance = await createWorker('eng', 1, {
    // Use CDN-hosted worker for smaller bundle
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
  });
  
  workerInitializing = false;
  workerQueue.forEach(({ resolve }) => resolve(workerInstance));
  workerQueue.length = 0;
  
  return workerInstance;
}

export interface LocalOCRResult {
  text: string;
  confidence: number;
  provider: 'tesseract_local';
  processingTimeMs: number;
}

export async function ocrWithTesseract(imageSource: File | Blob | string): Promise<LocalOCRResult> {
  const start = performance.now();
  const worker = await getWorker();
  
  const { data } = await worker.recognize(imageSource);
  
  return {
    text: data.text.trim(),
    confidence: data.confidence,
    provider: 'tesseract_local',
    processingTimeMs: Math.round(performance.now() - start),
  };
}

export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
