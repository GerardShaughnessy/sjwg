/** Simulated network latency so pending states are real and reviewable. */
export function simulateLatency(minMs = 400, maxMs = 900): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
