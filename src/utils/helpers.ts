export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const sanitizeString = (str: string): string => {
  return str.trim().toLowerCase();
};

export const isValidPostcode = (postcode: string): boolean => {
  // UK postcode validation regex
  const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
  return postcodeRegex.test(postcode);
};
