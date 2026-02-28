"use client";

// Diagnostic code types
export type DiagnosticSeverity = "Error" | "Warning";

// Diagnostic message translations
export interface DiagnosticMessage {
  code: string;
  en: string;
  es: string;
  severity: DiagnosticSeverity;
}

// All diagnostic codes and their translations
export const DIAGNOSTIC_MESSAGES: DiagnosticMessage[] = [
  // Field Required Diagnostics
  {
    code: "FIELD_REQUIRED",
    en: "This field is required",
    es: "Este campo es requerido",
    severity: "Error",
  },
  {
    code: "MISSING_REQUIRED_FIELD",
    en: "Required field is missing",
    es: "Falta campo requerido",
    severity: "Error",
  },
  {
    code: "REQUIRED_BUT_EMPTY",
    en: "This required field cannot be empty",
    es: "Este campo requerido no puede estar vacío",
    severity: "Error",
  },

  // Value Validation Diagnostics
  {
    code: "INVALID_VALUE",
    en: "Invalid value entered",
    es: "Valor inválido ingresado",
    severity: "Error",
  },
  {
    code: "INVALID_FORMAT",
    en: "Invalid format",
    es: "Formato inválido",
    severity: "Error",
  },
  {
    code: "VALUE_TOO_HIGH",
    en: "Value exceeds maximum allowed",
    es: "El valor excede el máximo permitido",
    severity: "Warning",
  },
  {
    code: "VALUE_TOO_LOW",
    en: "Value below minimum required",
    es: "El valor está por debajo del mínimo requerido",
    severity: "Warning",
  },
  {
    code: "NEGATIVE_VALUE",
    en: "Value cannot be negative",
    es: "El valor no puede ser negativo",
    severity: "Error",
  },
  {
    code: "INVALID_SSN",
    en: "Invalid Social Security Number format",
    es: "Formato de Número de Seguro Social inválido",
    severity: "Error",
  },
  {
    code: "INVALID_EIN",
    en: "Invalid Employer Identification Number format",
    es: "Formato de Número de Identificación del Empleador inválido",
    severity: "Error",
  },
  {
    code: "INVALID_EMAIL",
    en: "Invalid email address format",
    es: "Formato de correo electrónico inválido",
    severity: "Error",
  },
  {
    code: "INVALID_PHONE",
    en: "Invalid phone number format",
    es: "Formato de número de teléfono inválido",
    severity: "Error",
  },
  {
    code: "INVALID_ZIP",
    en: "Invalid ZIP code format",
    es: "Formato de código postal inválido",
    severity: "Error",
  },
  {
    code: "INVALID_DATE",
    en: "Invalid date format",
    es: "Formato de fecha inválido",
    severity: "Error",
  },

  // Calculation Diagnostics
  {
    code: "CALCULATION_ERROR",
    en: "Calculation error",
    es: "Error de cálculo",
    severity: "Error",
  },
  {
    code: "DEPENDENCY_ERROR",
    en: "Dependency calculation error",
    es: "Error de cálculo de dependencia",
    severity: "Error",
  },
  {
    code: "CIRCULAR_DEPENDENCY",
    en: "Circular dependency detected in calculation",
    es: "Dependencia circular detectada en el cálculo",
    severity: "Error",
  },
  {
    code: "OVERFLOW_ERROR",
    en: "Number overflow in calculation",
    es: "Desbordamiento de número en el cálculo",
    severity: "Error",
  },

  // Income/Expense Diagnostics
  {
    code: "NEGATIVE_INCOME",
    en: "Income cannot be negative",
    es: "El ingreso no puede ser negativo",
    severity: "Error",
  },
  {
    code: "UNREPORTED_INCOME",
    en: "Income reported but source not specified",
    es: "Ingreso reportado pero fuente no especificada",
    severity: "Warning",
  },
  {
    code: "EXCESSIVE_DEDUCTION",
    en: "Deduction exceeds allowable limit",
    es: "La deducción excede el límite permitido",
    severity: "Warning",
  },
  {
    code: "MISSING_W2",
    en: "W-2 expected but not found",
    es: "Se esperaba W-2 pero no se encontró",
    severity: "Warning",
  },

  // Filing Status Diagnostics
  {
    code: "INVALID_FILING_STATUS",
    en: "Invalid filing status",
    es: "Estado civil fiscal inválido",
    severity: "Error",
  },
  {
    code: "MARRIED_SPLIT",
    en: "Married filing separately requires both spouses",
    es: "Casado declarando por separado requiere ambos esposos",
    severity: "Warning",
  },

  // Cross-Form Diagnostics
  {
    code: "W2_1040_MISMATCH",
    en: "W-2 wages don't match Form 1040",
    es: "Los salarios del W-2 no coinciden con el Formulario 1040",
    severity: "Warning",
  },
  {
    code: "SCHC_1040_MISMATCH",
    en: "Schedule C profit doesn't match Form 1040",
    es: "La ganancia del Anexo C no coincide con el Formulario 1040",
    severity: "Warning",
  },
  {
    code: "1099_1040_MISMATCH",
    en: "1099 income doesn't match Form 1040",
    es: "Ingreso del 1099 no coincide con el Formulario 1040",
    severity: "Warning",
  },

  // Tax Calculation Diagnostics
  {
    code: "TAX_LIABILITY_MISMATCH",
    en: "Calculated tax doesn't match expected value",
    es: "El impuesto calculado no coincide con el valor esperado",
    severity: "Error",
  },
  {
    code: "REFUND_TOO_HIGH",
    en: "Refund amount exceeds normal limits",
    es: "El monto del reembolso excede los límites normales",
    severity: "Warning",
  },
  {
    code: "TAX_DUE_TOO_HIGH",
    en: "Tax due seems unusually high",
    es: "El impuesto a pagar parece inusualmente alto",
    severity: "Warning",
  },

  // Compliance Diagnostics
  {
    code: "MISSING_SIGNATURE",
    en: "Return is missing required signature",
    es: "Falta la firma requerida en la declaración",
    severity: "Error",
  },
  {
    code: "MISSING_DATE",
    en: "Return is missing preparation date",
    es: "Falta la fecha de preparación en la declaración",
    severity: "Warning",
  },
  {
    code: "LATE_FILING",
    en: "Return filed after deadline",
    es: "Declaración presentada después de la fecha límite",
    severity: "Warning",
  },

  // General Diagnostics
  {
    code: "DATA_MISSING",
    en: "Required data is missing",
    es: "Faltan datos requeridos",
    severity: "Error",
  },
  {
    code: "INCONSISTENT_DATA",
    en: "Data inconsistency detected",
    es: "Inconsistencia de datos detectada",
    severity: "Warning",
  },
  {
    code: "SUSPICIOUS_VALUE",
    en: "Value appears unusual",
    es: "El valor parece inusual",
    severity: "Warning",
  },
  {
    code: "ROUNDING_ERROR",
    en: "Rounding discrepancy detected",
    es: "Discrepancia de redondeo detectada",
    severity: "Warning",
  },
];

// Map diagnostic codes to their translations
const diagnosticCodeMap: Record<string, DiagnosticMessage> = {};
for (const msg of DIAGNOSTIC_MESSAGES) {
  diagnosticCodeMap[msg.code] = msg;
}

// Get diagnostic message by code
export function getDiagnosticMessage(
  code: string,
  locale: "en" | "es" = "en"
): string {
  const msg = diagnosticCodeMap[code];
  if (!msg) {
    // Try to find by code containing the key (case-insensitive)
    const found = DIAGNOSTIC_MESSAGES.find(
      (m) => m.code.toLowerCase() === code.toLowerCase()
    );
    return found ? found[locale] : code;
  }
  return msg[locale];
}

// Get diagnostic severity
export function getDiagnosticSeverity(code: string): DiagnosticSeverity {
  const msg = diagnosticCodeMap[code];
  if (!msg) {
    const found = DIAGNOSTIC_MESSAGES.find(
      (m) => m.code.toLowerCase() === code.toLowerCase()
    );
    return found?.severity || "Warning";
  }
  return msg.severity;
}

// Check if diagnostic is an error
export function isError(code: string): boolean {
  return getDiagnosticSeverity(code) === "Error";
}

// Check if diagnostic is a warning
export function isWarning(code: string): boolean {
  return getDiagnosticSeverity(code) === "Warning";
}

// Get all diagnostic codes
export function getAllDiagnosticCodes(): string[] {
  return DIAGNOSTIC_MESSAGES.map((m) => m.code);
}

// Translate raw diagnostic message if it's a code, otherwise return as-is
export function translateDiagnosticMessage(
  message: string,
  locale: "en" | "es" = "en"
): string {
  // Check if message is a known diagnostic code
  if (diagnosticCodeMap[message]) {
    return diagnosticCodeMap[message][locale];
  }

  // Try to match code in message (e.g., "ERROR: FIELD_REQUIRED")
  const codeMatch = message.match(/:\s*([A-Z_]+)$/);
  if (codeMatch) {
    const code = codeMatch[1];
    if (diagnosticCodeMap[code]) {
      return message.replace(codeMatch[0], `: ${diagnosticCodeMap[code][locale]}`);
    }
  }

  // Return original message if no translation found
  return message;
}

export default {
  DIAGNOSTIC_MESSAGES,
  getDiagnosticMessage,
  getDiagnosticSeverity,
  isError,
  isWarning,
  getAllDiagnosticCodes,
  translateDiagnosticMessage,
};
