import { Decimal } from "@prisma/client/runtime/library";

/**
 * Robustly serializes Prisma objects for Next.js Server Components.
 * Handles Date objects and Prisma Decimal types which cause "Unexpected Error"
 * or digest errors in Next.js 15 when passed to Client Components.
 */
export function serializePrisma<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      // Handle Prisma Decimal
      if (value instanceof Decimal || (value && typeof value === 'object' && value.constructor?.name === 'Decimal')) {
        return value.toString();
      }
      // Handle BigInt if any
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    })
  );
}
