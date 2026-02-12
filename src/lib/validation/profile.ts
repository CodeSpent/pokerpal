import { COUNTRIES } from '@/lib/data/countries';

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export function validateUsername(value: string): string | null {
  if (!value) return 'Username is required';
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (value.length > 20) return 'Username must be at most 20 characters';
  if (!USERNAME_REGEX.test(value)) {
    return 'Username must start with a letter and contain only letters, numbers, and underscores';
  }
  return null;
}

export function validateCountry(value: string): string | null {
  if (!value) return 'Country is required';
  if (!COUNTRIES.some((c) => c.code === value)) return 'Invalid country';
  return null;
}

export function validateState(value: string): string | null {
  if (!value) return 'State/province is required';
  if (value.trim().length < 1 || value.trim().length > 100) {
    return 'State/province must be 1-100 characters';
  }
  return null;
}
