/** İstemci tarafında üretilen varlık id'si (UUID). */
export function generateId(): string {
  return crypto.randomUUID()
}
