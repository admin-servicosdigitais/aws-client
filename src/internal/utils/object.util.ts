export function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}
