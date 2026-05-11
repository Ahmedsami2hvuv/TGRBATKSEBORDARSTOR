/**
 * Robustly serializes Prisma objects for Next.js Server Components.
 * Handles Date objects and Prisma Decimal types which cause "Unexpected Error"
 * or digest errors in Next.js 15 when passed to Client Components.
 */
export function serializePrisma<T>(data: T): T {
  if (data === null || data === undefined) return data;

  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      // Handle Prisma Decimal safely
      if (value && typeof value === 'object' && value.constructor && (value.constructor.name === 'Decimal' || value.constructor.name === 'n')) {
        return value.toString();
      }
      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    })
  );
}
