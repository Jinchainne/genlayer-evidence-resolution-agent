export function logInfo(scope: string, message: string) {
  console.log(`[${scope}] ${message}`);
}

export function logWarn(scope: string, message: string) {
  console.warn(`[${scope}] ${message}`);
}
