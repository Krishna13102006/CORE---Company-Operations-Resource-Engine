import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Regex detecting emojis, pictographs, decorative symbols, and invisible unicode characters
export const EMOJI_AND_SYMBOLS_REGEX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Symbol}\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F]/u;

export function sanitizeName(name: string): string {
  if (!name) return '';
  return name.replace(/[^\p{L}\s\-'.]/gu, '').replace(/\s+/g, ' ').trim();
}

export function getInitials(first: string = '', last: string = ''): string {
  const cleanFirst = (first || '').replace(/[^\p{L}0-9]/gu, '');
  const cleanLast = (last || '').replace(/[^\p{L}0-9]/gu, '');
  if (cleanFirst && cleanLast) {
    return `${cleanFirst.charAt(0)}${cleanLast.charAt(0)}`.toUpperCase();
  }
  if (cleanFirst) {
    return cleanFirst.slice(0, 2).toUpperCase();
  }
  return 'U';
}
