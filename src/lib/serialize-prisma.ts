/**
 * Robustly serializes Prisma objects for Next.js Server Components.
 * Handles Date objects and Prisma Decimal types which cause "Unexpected Error"
 * or digest errors in Next.js 15 when passed to Client Components.
 */
export function serializePrisma<T>(data: T): T {
  if (data === null || data === undefined) return data;

  try {
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        // Safe check for Decimal types (including minified names)
        if (value && typeof value === 'object') {
          const protoName = value.constructor?.name;
          if (protoName === 'Decimal' || protoName === 'n' || protoName === 'd') {
            return value.toString();
          }
        }
        // Handle BigInt
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      })
    );
  } catch (error) {
    console.error("Serialization Error:", error);
    return data; // Fallback to original data if serialization fails
  }
}
