import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Deliberately minimal for the first real deploy — default (in-memory)
// caching, no R2 binding yet. R2 incremental caching is a real refinement
// worth adding once this basic migration is verified actually working; not
// worth the extra moving part before that.
export default defineCloudflareConfig({});
