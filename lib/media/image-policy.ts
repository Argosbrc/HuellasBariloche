export const IMAGE_POLICY = {
  maxBytes: 1_048_576,
  targetBytes: 990_000,
  maxDimension: 1_600,
  maxImages: 4,
  maxSourceBytes: 20 * 1_048_576,
  outputMimeType: "image/webp",
  acceptedInputTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
} as const;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}
