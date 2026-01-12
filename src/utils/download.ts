export function sanitizeLayerId(layerId: string): string {
  const trimmed = layerId.trim();
  const sanitized = trimmed.replace(/[^a-z0-9._-]+/gi, '_');
  return sanitized.length > 0 ? sanitized : 'layer';
}

export function downloadJson(filename: string, payload: unknown): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
