import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration for storage.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REQUIRED_STORAGE_BUCKETS = [
  {
    id: "intel-docs",
    options: {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    },
  },
] as const;

export async function ensureStorageBuckets() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to inspect Supabase Storage: ${listError.message}`);
  }

  const existingIds = new Set(buckets.map((bucket) => bucket.id));
  for (const bucket of REQUIRED_STORAGE_BUCKETS) {
    if (existingIds.has(bucket.id)) continue;

    const { error: createError } = await supabase.storage.createBucket(
      bucket.id,
      bucket.options,
    );
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(
        `Failed to create Supabase Storage bucket "${bucket.id}": ${createError.message}`,
      );
    }
  }
}
