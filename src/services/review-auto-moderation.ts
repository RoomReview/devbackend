import profanityFilter from 'leo-profanity';

profanityFilter.add(profanityFilter.getDictionary('ru'));

const normalizeForProfanityCheck = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/(?<=\p{L})!(?=\p{L})/gu, 'i')
    .replace(/[\p{P}\p{S}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');

const containsProfanity = (text: string): boolean => {
  const normalized = normalizeForProfanityCheck(text);
  const collapsedRepeats = normalized.replace(/([\p{L}])\1+/gu, '$1');
  return (
    profanityFilter.check(normalized) || profanityFilter.check(collapsedRepeats)
  );
};

export const isEligibleForAutomaticApproval = (
  title: string,
  content: string,
  additionalText: string[] = [],
): boolean => {
  const text = [title, content, ...additionalText].join(' ');
  return (
    Array.from(content.trim().normalize('NFC')).length > 50 &&
    !containsProfanity(text)
  );
};
