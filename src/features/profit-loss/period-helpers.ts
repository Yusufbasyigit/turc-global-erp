import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";

export type Quarter = 1 | 2 | 3 | 4;

export type PeriodBucket = {
  key: string;
  label: string;
  months: string[];
  isInProgress: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function monthsInQuarter(year: number, quarter: Quarter): string[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((d) => `${year}-${pad2(startMonth + d)}`);
}

export function monthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`);
}

export function currentYear(): number {
  const ym = istanbulYearMonth(new Date());
  return Number(ym.slice(0, 4));
}

export function currentQuarter(): Quarter {
  const ym = istanbulYearMonth(new Date());
  const m = Number(ym.slice(5, 7));
  return (Math.ceil(m / 3) as Quarter);
}

export function quartersOfYear(year: number): PeriodBucket[] {
  const cy = currentYear();
  const cq = currentQuarter();
  return ([1, 2, 3, 4] as Quarter[]).map((q) => ({
    key: `${year}-Q${q}`,
    label: `Q${q} ${year}`,
    months: monthsInQuarter(year, q),
    isInProgress: year === cy && q === cq,
  }));
}

export function trailingYears(count: number): PeriodBucket[] {
  const cy = currentYear();
  const start = cy - count + 1;
  return Array.from({ length: count }, (_, i) => {
    const y = start + i;
    return {
      key: `${y}`,
      label: `${y}`,
      months: monthsInYear(y),
      isInProgress: y === cy,
    };
  });
}

export function selectableYears(count: number): number[] {
  const cy = currentYear();
  return Array.from({ length: count }, (_, i) => cy - i);
}
