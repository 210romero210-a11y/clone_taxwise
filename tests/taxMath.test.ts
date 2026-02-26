import { standardDeduction, DEFAULT_2025_CONFIG } from "../lib/taxMath";

// AAA pattern: Arrange, Act, Assert

describe("standardDeduction (2025)", () => {
  test("Single taxpayer age 65 gets base + one additional", () => {
    // Arrange
    const filingStatus = "single" as const;
    const opts = { age65OrOlder: true };
    const expected = DEFAULT_2025_CONFIG.base.single + DEFAULT_2025_CONFIG.additionalAgeOrBlind;

    // Act
    const actual = standardDeduction(filingStatus, opts, DEFAULT_2025_CONFIG);

    // Assert
    expect(actual).toBe(expected);
  });

  test("Married filing jointly with both spouses 65+ gets base + two additionals", () => {
    // Arrange
    const filingStatus = "married_filing_jointly" as const;
    const opts = { extraQualifiers: 2 };
    const expected = DEFAULT_2025_CONFIG.base.married_filing_jointly + 2 * DEFAULT_2025_CONFIG.additionalAgeOrBlind;

    // Act
    const actual = standardDeduction(filingStatus, opts, DEFAULT_2025_CONFIG);

    // Assert
    expect(actual).toBe(expected);
  });
});
