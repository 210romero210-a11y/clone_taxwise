/**
 * Internationalization (i18n) Translator Module
 * 
 * Provides translation and formatting utilities for the TaxWise application.
 * This is a pure utility module that can be used in both client and server contexts.
 */
// Note: This file intentionally does NOT use "use client" directive
// as it exports pure functions that work in both client and server contexts

import en from "../../locales/en.json";
import es from "../../locales/es.json";

// Locale type definition
export type Locale = "en" | "es";

// Supported locales map
export const SUPPORTED_LOCALES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

// Default locale
export const DEFAULT_LOCALE: Locale = "en";

// Locale translations map
const translations: Record<Locale, typeof en> = {
  en,
  es,
};

// Nested key getter type
type GetNestedValue<T, K extends string> = K extends `${infer P}.${infer R}`
  ? P extends keyof T
    ? GetNestedValue<T[P], R>
    : undefined
  : K extends keyof T
  ? T[K]
  : undefined;

// Get nested value from object using dot notation
function getNestedValue<T>(obj: T, path: string): unknown {
  const keys = path.split(".");
  let result: unknown = obj;
  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return result;
}

// Translation function type
export type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

// Create translator for a specific locale
export function createTranslator(locale: Locale): TranslateFunction {
  const localeTranslations = translations[locale] || translations.en;

  return (key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(localeTranslations, key);

    if (typeof value !== "string") {
      // Fallback to English if key not found
      if (locale !== "en") {
        const fallbackValue = getNestedValue(translations.en, key);
        if (typeof fallbackValue === "string") {
          return interpolateParams(fallbackValue, params);
        }
      }
      // Return key if not found in any locale
      return key;
    }

    return interpolateParams(value, params);
  };
}

// Interpolate parameters into translation string
function interpolateParams(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;

  return text.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey]?.toString() ?? match;
  });
}

// Currency formatting by locale
export function formatCurrency(
  amount: number,
  locale: Locale = "en",
  currency: string = "USD"
): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
  };

  return new Intl.NumberFormat(localeMap[locale], {
    style: "currency",
    currency,
  }).format(amount);
}

// Date formatting by locale
export function formatDate(
  date: Date | string | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions
): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
  };

  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return new Intl.DateTimeFormat(localeMap[locale], options || defaultOptions).format(dateObj);
}

// Number formatting by locale
export function formatNumber(
  value: number,
  locale: Locale = "en",
  options?: Intl.NumberFormatOptions
): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
  };

  return new Intl.NumberFormat(localeMap[locale], options).format(value);
}

// Percentage formatting by locale
export function formatPercent(
  value: number,
  locale: Locale = "en",
  decimals: number = 2
): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
  };

  return new Intl.NumberFormat(localeMap[locale], {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Spanish form titles mapping (60+ forms)
export const SPANISH_FORM_TITLES: Record<string, string> = {
  "1040": "Declaración de Impuestos sobre el Ingreso Individual (Formulario 1040)",
  "1040-SR": "Declaración de Impuestos para Personas Mayores de 65 años (Formulario 1040-SR)",
  "1040-NR": "Declaración de Impuestos de No Residentes Extranjeros (Formulario 1040-NR)",
  "1040-X": "Declaración Enmiendada de Impuestos sobre el Ingreso (Formulario 1040-X)",
  "W-2": "Declaración de Salarios e Impuestos (Formulario W-2)",
  "W-3": "Transmisión de Declaraciones de Salarios (Formulario W-3)",
  "W-4": "Certificado de Retención del Empleado (Formulario W-4)",
  "W-7": "Solicitud de Número de Identificación del Contribuyente (Formulario W-7)",
  "1099-NEC": "Resumen de Compensación de No-empleados (Formulario 1099-NEC)",
  "1099-MISC": "Resumen de Ingresos Varios (Formulario 1099-MISC)",
  "1099-INT": "Resumen de Ingresos de Intereses (Formulario 1099-INT)",
  "1099-DIV": "Resumen de Dividendos y Distribuciones (Formulario 1099-DIV)",
  "1099-B": "Resumen de Transacciones de Corretaje (Formulario 1099-B)",
  "1099-OID": "Resumen de Descuento Original de Emisión (Formulario 1099-OID)",
  "1099-R": "Resumen de Distribuciones de Pensiones, Anualidades, Jubilación o Participación en Ganancias (Formulario 1099-R)",
  "1098": "Resumen de Intereses Hipotecarios (Formulario 1098)",
  "1098-E": "Resumen de Intereses de Préstamos Estudiantiles (Formulario 1098-E)",
  "1098-T": "Resumen de Cuotas Educativas (Formulario 1098-T)",
  "Schedule 1": "Ingresos y Ajustes Adicionales (Anexo 1)",
  "Schedule 2": "Impuesto Adicional y Crédito de Seguro Médico (Anexo 2)",
  "Schedule 3": "Créditos y Pagos Adicionales (Anexo 3)",
  "Schedule A": "Deducciones Detalladas (Anexo A)",
  "Schedule B": "Intereses y Dividendos Extraordinarios (Anexo B)",
  "Schedule C": "Ganancia o Pérdida de Negocio (Anexo C)",
  "Schedule D": "Ganancias y Pérdidas de Capital (Anexo D)",
  "Schedule E": "Renta Extraordinaria y Pérdidas (Anexo E)",
  "Schedule EIC": "Crédito por Ingreso del Trabajo (Anexo EIC)",
  "Schedule F": "Ganancia o Pérdida de Granja (Anexo F)",
  "Schedule H": "Impuesto sobre Empleados Domésticos (Anexo H)",
  "Schedule M": "conciliación de Créditos No Refundables (Anexo M)",
  "Schedule R": "Crédito para Personas de la Tercera Edad o Discapacitadas (Anexo R)",
  "Schedule SE": "Impuesto de Trabajo por Cuenta Propia (Anexo SE)",
  "Form 8863": "Créditos Educativos (Formulario 8863)",
  "Form 8865": "Declaración de Información de Extranjeros Relacionados (Formulario 8865)",
  "Form 8880": "Crédito por Contribuciones de Ahorro para la Jubilación (Formulario 8880)",
  "Form 8885": "Crédito de Seguro de Salud - Cobertura de Salud de Empleador Calificada (Formulario 8885)",
  "Form 8888": "Asignación de Depósito de Remesa Directa (Formulario 8888)",
  "Form 8912": "Crédito de Tarifa de Matrícula (Formulario 8912)",
  "Form 8941": "Crédito por Cobertura de Seguro de Salud para Pequeños Empleadores (Formulario 8941)",
  "Form 9465": "Solicitud de Plan de Pagos a Plazos (Formulario 9465)",
  "Form 5329": "Impuesto Adicional sobre Planes Calificados (Formulario 5329)",
  "Form 6251": "Impuesto Mínimo Alternativo - Individuos (Formulario 6251)",
  "Form 8615": "Impuesto sobre la Ganancia Neta de Inversión para Menores de 18 Años (Formulario 8615)",
  "Form 8862": "Solicitud de Crédito por Hijos e Hijos Dependientes (Formulario 8862)",
  "Form 2106": "Gastos de Empleado de Negocio (Formulario 2106)",
  "Form 2119": "Venta de Residencia Principal (Formulario 2119)",
  "Form 2441": "Créditos de Cuidado de Menores y Dependientes (Formulario 2441)",
  "Form 3903": "Gastos de Mudanza (Formulario 3903)",
  "Form 4506": "Solicitud de Copia de Declaración de Impuestos (Formulario 4506)",
  "Form 4506-T": "Solicitud de Transcripción de Declaración de Impuestos (Formulario 4506-T)",
  "Form 4868": "Solicitud de Prórroga Automática de Tiempo para Presentar (Formulario 4868)",
  "Form 5305": "Declaración de Saldo de Cuenta de Ahorro para la Jubilación Individual Tradicional (Formulario 5305)",
  "Form 5305-R": "Declaración de Cuenta de Ahorro para la Jubilación Individual Roth (Formulario 5305-R)",
  "Form 5305-SEP": "Acuerdo de Plan de Simplificación de Pago de Pensiones para Empleadores (Formulario 5305-SEP)",
  "Form 5305-ESA": "Declaración de Cuenta de Ahorro para Gastos Médicos Educativos (Formulario 5305-ESA)",
  "Form 8332": "Liberación de Reclamación de Exención de Hijos (Formulario 8332)",
  "Form 8812": "Créditos Adicionales por Hijos Dependientes (Formulario 8812)",
  "Form 8814": "Declaración de Ingresos para Menores con certain Child and Dependent Earned Income (Formulario 8814)",
  "Form 8822": "Cambio de Dirección (Formulario 8822)",
  "Form 8829": "Gastos de Oficina en el Hogar (Formulario 8829)",
  "Form 8834": "Vehículo Cualificado de Baja Emisión (Formulario 8834)",
  "Form 8859": "Crédito Fiscal por Deducción de Hipoteca (Formulario 8859)",
  "Form 8910": "Vehículo de Tecnología Alternativa (Formulario 8910)",
  "Form 8911": "Vehículo Cualificado de Combustible Alternativo (Formulario 8911)",
  "Form 8917": "Deducción de Matrícula Calificada y Cuotas (Formulario 8917)",
  "Form 8936": "Vehículo Cualificado de Cero Emisiones (Formulario 8936)",
};

// Get Spanish form title
export function getSpanishFormTitle(formId: string): string {
  return SPANISH_FORM_TITLES[formId] || formId;
}

// Export singleton translator creators for convenience
export const t = createTranslator(DEFAULT_LOCALE);

export default {
  createTranslator,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  getSpanishFormTitle,
  t,
};
