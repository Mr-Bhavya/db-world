const BATCH_SIZE = 4;

export async function settleFileOperations(items, operation) {
  const results = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    results.push(...await Promise.allSettled(batch.map((item) => Promise.resolve().then(() => operation(item)))));
  }
  return results;
}
