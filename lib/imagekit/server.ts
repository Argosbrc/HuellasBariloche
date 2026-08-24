import ImageKit from "@imagekit/nodejs";

export function hasImageKitEnv() {
  return Boolean(
    process.env.IMAGEKIT_PRIVATE_KEY?.trim()
    && process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim(),
  );
}

export function getImageKitClient() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("Falta IMAGEKIT_PRIVATE_KEY.");
  return new ImageKit({ privateKey, maxRetries: 1, timeout: 30_000 });
}

export function imageKitEndpoint() {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim().replace(/\/+$/, "");
  if (!endpoint || !endpoint.startsWith("https://")) {
    throw new Error("Falta NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.");
  }
  return endpoint;
}
