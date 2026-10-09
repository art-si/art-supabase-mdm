/** Shelf positions are fixed-width coordinates, independent of document sequences. */
export function formatWarehouseBinCode(
  shelfCode: string,
  level: number,
  column: number,
  separator: string
): string {
  return [
    shelfCode.trim().toUpperCase(),
    String(level).padStart(2, '0'),
    String(column).padStart(2, '0')
  ].join(separator)
}
