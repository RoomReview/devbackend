export const normalizePostcodeCode = (code: string): string => {
  return code.trim().toUpperCase().replace(/\s+/g, '');
};

export const getPostcodeLookupCandidates = (code: string): string[] => {
  const trimmed = code.trim().toUpperCase();
  const normalized = normalizePostcodeCode(code);

  const candidates = [trimmed, normalized];

  if (normalized.length >= 5 && !trimmed.includes(' ')) {

    const spacedFormat = normalized.slice(0, -3) + ' ' + normalized.slice(-3);
    candidates.push(spacedFormat);
  }

  return Array.from(new Set(candidates));
};
