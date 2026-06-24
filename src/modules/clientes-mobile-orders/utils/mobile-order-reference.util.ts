export function normalizeMobileReference(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized || null;
}

export function extractMobileReference(note: string | null | undefined) {
  const normalizedNote = (note ?? '').trim();
  if (!normalizedNote) {
    return null;
  }

  const match = normalizedNote.match(/APP:MOBILE\|REF:([^|]+)/i);
  if (!match?.[1]) {
    return null;
  }

  return normalizeMobileReference(match[1]);
}

export function buildLegacyDocumentFolio(
  serie: string | number | null | undefined,
  numero: string | number | null | undefined,
) {
  const cleanSerie = String(serie ?? '').trim();
  const cleanNumero = String(numero ?? '').trim();

  if (cleanSerie && cleanNumero) {
    return `${cleanSerie}-${cleanNumero}`;
  }

  return cleanSerie || cleanNumero || null;
}
