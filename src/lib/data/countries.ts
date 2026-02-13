import { Country, State, type IState } from 'country-state-city';

export const COUNTRIES: Array<{ code: string; name: string }> = Country.getAllCountries()
  .map((c) => ({ code: c.isoCode, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const SUBDIVISION_LABELS: Record<string, string> = {
  US: 'State',
  AU: 'State',
  BR: 'State',
  MX: 'State',
  IN: 'State',
  MY: 'State',
  NG: 'State',
  DE: 'State',
  CA: 'Province',
  AR: 'Province',
  CN: 'Province',
  ZA: 'Province',
  VN: 'Province',
  BE: 'Province',
  NL: 'Province',
  JP: 'Prefecture',
  GB: 'County',
  IE: 'County',
  KE: 'County',
  CH: 'Canton',
  AE: 'Emirate',
  FR: 'Region',
  IT: 'Region',
  ES: 'Community',
};

let subdivisionCache: Record<string, Array<{ code: string; name: string }>> = {};

export function getSubdivisions(countryCode: string): Array<{ code: string; name: string }> {
  if (countryCode in subdivisionCache) return subdivisionCache[countryCode];

  const states: IState[] = State.getStatesOfCountry(countryCode);
  const result = states
    .map((s) => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  subdivisionCache[countryCode] = result;
  return result;
}

export function hasSubdivisions(countryCode: string): boolean {
  return getSubdivisions(countryCode).length > 0;
}

export function getSubdivisionLabel(countryCode: string): string {
  return SUBDIVISION_LABELS[countryCode] ?? 'Region';
}
