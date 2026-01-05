import { getEncoding } from 'js-tiktoken';

export const countTokens = (text: string): number => {
  try {
    const enc = getEncoding('cl100k_base');
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn('Failed to count tokens:', error);
    return 0;
  }
};
