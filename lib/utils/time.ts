export function formatUtc(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function formatRelativeMs(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}
