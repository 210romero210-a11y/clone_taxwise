export type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household"
  | "qualifying_widow";

export interface StandardDeductionConfig {
  base: Record<FilingStatus, number>;
  // additional amount per qualifying condition (age 65+ or blind). For married
  // filing jointly this should be applied per qualifying spouse.
  additionalAgeOrBlind: number;
}

export const DEFAULT_2025_CONFIG: StandardDeductionConfig = {
  base: {
    single: 14600,
    married_filing_jointly: 29200,
    married_filing_separately: 14600,
    head_of_household: 21900,
    qualifying_widow: 29200,
  },
  additionalAgeOrBlind: 1550,
};

export interface DeductionOptions {
  age65OrOlder?: boolean; // taxpayer
  blind?: boolean; // taxpayer
  // For married filing jointly allow specifying number of additional qualifiers
  // (e.g., if both spouses are 65+)
  extraQualifiers?: number;
}

export function standardDeduction(
  filingStatus: FilingStatus,
  opts: DeductionOptions = {},
  config: StandardDeductionConfig = DEFAULT_2025_CONFIG
): number {
  const base = config.base[filingStatus];
  if (typeof base !== "number") throw new Error("Unknown filing status");

  // Count qualifiers: age and blindness each count separately for the primary taxpayer.
  let qualifiers = 0;
  if (opts.age65OrOlder) qualifiers += 1;
  if (opts.blind) qualifiers += 1;
  if (opts.extraQualifiers && Number.isFinite(opts.extraQualifiers)) {
    qualifiers += opts.extraQualifiers;
  }

  return base + qualifiers * config.additionalAgeOrBlind;
}
