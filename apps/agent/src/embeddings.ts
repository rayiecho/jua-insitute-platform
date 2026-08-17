import type { FeatureExtractionPipeline } from '@huggingface/transformers';

// Section 4.4 long-term memory needs an embeddings provider. OpenAI's credits
// are exhausted and no Anthropic key is configured (see README "Known
// temporary substitutions"), so this runs a small model in-process instead —
// free, no API key, no billing to run out of. 384 dims (matches the
// `lesson_memory_vectors.embedding` column — see migration 0004).
//
// Imported dynamically (not at module top-level) so nothing from this
// package — including its native onnxruntime-node addon — loads during the
// LiveKit Agents SDK's job-process spawn, only on first actual embedText()
// call. A crash/incompatibility here should surface as a caught error at
// that point, not take down job dispatch itself.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBED_TIMEOUT_MS = 4000;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', MODEL_ID),
    );
  }
  return extractorPromise;
}

// Timeout lives here, not at call sites — the first-ever call in a process
// downloads/initializes the model and can hang rather than throw (confirmed
// live 2026-08-17: a hang here blocked buildOpeningContext() from ever
// finishing, which left tutor sessions stuck on "Connecting…" forever). The
// underlying download isn't cancelled on timeout, so a later call still
// benefits from it once it finishes.
export async function embedText(text: string): Promise<number[]> {
  return withTimeout(embedTextInner(text), EMBED_TIMEOUT_MS);
}

async function embedTextInner(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`embedText timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
