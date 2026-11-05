import latestZipRates from '../data/latestZipRates.json';

export function resolveWorkerHourlyRate(data: { standardHourlyRate?: unknown; hourlyRate?: unknown; dailyRate?: unknown }, id?: string): number {
  for (const candidate of [data.standardHourlyRate, data.hourlyRate]) {
    if (isValidHourlyRate(candidate)) return Number(candidate);
  }
  const daily = Number(data.dailyRate);
  if (Number.isFinite(daily) && daily > 0) return Number((daily / 8).toFixed(2));
  return (latestZipRates as Record<string, number>)[id ?? ''] ?? 18;
}

export function isValidHourlyRate(value: unknown): boolean {
  return (typeof value === 'number' || (typeof value === 'string' && !!value.trim())) &&
    Number.isFinite(Number(value)) && Number(value) > 0;
}
