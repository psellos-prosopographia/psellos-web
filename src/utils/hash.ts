function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fallbackHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export async function computeSha256Hex(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return fallbackHash(value);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}
