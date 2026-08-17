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

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', MODEL_ID),
    );
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
