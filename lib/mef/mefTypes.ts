/**
 * MeF (Modernized e-File) Type Definitions
 * Based on IRS Publication 4163 and 4164
 * Supports Form 1040 (Individual) electronic filing
 */

// ============================================================================
// Core Submission Types
// ============================================================================

/** IRS MeF Submission Bundle - root container for transmission */
export interface SubmissionBundle {
  submissionId: string;
  taxYear: number;
  submissionType: SubmissionType;
  createdAt: Date;
  returns: ReturnData[];
}

/** Types of MeF submissions supported */
export type SubmissionType = '1040' | '1120' | '1120S' | '1065';

/** Return data with header and forms */
export interface ReturnData {
  returnId: string;
  returnHeader: ReturnHeader;
  forms: TaxForm[];
  attachments?: Attachment[];
}

// ============================================================================
// Header Types (IRS Publication 4163)
// ============================================================================

/** Return Header - contains taxpayer and filing information */
export interface ReturnHeader {
  /** Tax Year (YYYY format) */
  taxYear: string;
  /** Tax Period End Date (MMDDYYYY format) */
  taxPeriodEnd?: string;
  /** Originator information */
  originator: Originator;
  /** Software information */
  software: SoftwareInfo;
  /** Electronic filing identifier */
  efileId?: string;
  /**Filing status */
  filingStatus: FilingStatus;
  /** Primary taxpayer */
  taxpayer: Taxpayer;
  /** Spouse information (if married filing jointly) */
  spouse?: Taxpayer;
  /** Third party designee */
  thirdPartyDesignee?: ThirdPartyDesignee;
  /** Self-select PIN or practitioner PIN */
  pin: PinInfo;
}

/** Originator of the return */
export interface Originator {
  /** EFIN - Electronic Filing Identification Number */
  efin: string;
  /** EFIN type: 'SO' Self-Owner or 'SP' Satellite Location */
  efinType: 'SO' | 'SP';
  /** SSN or EIN of originator */
  originatorSSN?: string;
  /** Name of firm or individual */
  firmName?: string;
  /** Firm EIN */
  firmEIN?: string;
}

/** Software information */
export interface Software {
  /** Software ID assigned by IRS */
  softwareId: string;
  /** Software version */
  version: string;
  /** Package name */
  packageName?: string;
}

export interface SoftwareInfo {
  softwareId: string;
  version: string;
  packageName?: string;
  developmentMode?: boolean;
}

/** Filing Status - IRS enumeration */
export type FilingStatus = 
  | 'Single'
  | 'MarriedFilingJointly'
  | 'MarriedFilingSeparately'
  | 'HeadOfHousehold'
  | 'QualifyingWidower';

/** Taxpayer information */
export interface Taxpayer {
  /** SSN or ITIN */
  ssn: string;
  /** First name */
  firstName: string;
  /** Middle initial */
  middleName?: string;
  /** Last name */
  lastName: string;
  /** Suffix */
  suffix?: string;
  /** Date of birth (MMDDYYYY) */
  dateOfBirth?: string;
  /** Occupation */
  occupation?: string;
  /** Address */
  address: Address;
  /** Phone number */
  phone?: string;
  /** Email */
  email?: string;
  /** Filing username */
  filingUsername?: string;
}

/** US Address */
export interface Address {
  /** Street address line 1 */
  addressLine1: string;
  /** Street address line 2 */
  addressLine2?: string;
  /** City */
  city: string;
  /** State abbreviation */
  state: string;
  /** ZIP code (5 or 9 digit) */
  zipCode: string;
  /** Country (default US) */
  country?: string;
}

/** Third party designee authorization */
export interface ThirdPartyDesignee {
  /** Designee name */
  name: string;
  /** Phone number */
  phone: string;
  /** PIN for authorization */
  pin: string;
}

/** PIN selection for electronic signature */
export interface PinInfo {
  /** Type of PIN: 'Self-Select' or 'Practitioner' */
  pinType: 'Self-Select' | 'Practitioner';
  /** Primary taxpayer PIN (5 digits) */
  primaryPin: string;
  /** Spouse PIN (5 digits), if applicable */
  spousePin?: string;
  /** OR Practitioner PIN (10+ characters) */
  practitionerPin?: string;
}

// ============================================================================
// Form Types
// ============================================================================

/** Base interface for all tax forms */
export interface TaxForm {
  formId: string;
  formName: string;
  fields: FormField[];
  /** For nested schedules/subschedules */
  supportingForms?: TaxForm[];
}

/** Individual field on a tax form */
export interface FormField {
  fieldId: string;
  /** IRS line number (e.g., "1", "8b", "12") */
  lineId?: string;
  value: FieldValue;
  /** Whether field has overridden value */
  overridden?: boolean;
}

/** Supported field value types */
export type FieldValue = string | number | boolean | null;

// ============================================================================
// Attachment Types
// ============================================================================

/** Supporting document attachment */
export interface Attachment {
  /** Attachment ID */
  attachmentId: string;
  /** Document type */
  documentType: string;
  /** File name */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** Base64-encoded content */
  content: string;
  /** Description */
  description?: string;
}

// ============================================================================
// MeF Error Types
// ============================================================================

/** MeF-specific error */
export interface MeFError {
  /** Error code (IRS error code or internal) */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: MeFErrorSeverity;
  /** Related form ID */
  formId?: string;
  /** Related field ID */
  fieldId?: string;
  /** Line number in XML */
  xmlLine?: number;
  /** Whether this error can be fixed */
  actionable: boolean;
  /** Suggested fix */
  suggestedFix?: string;
}

export type MeFErrorSeverity = 'error' | 'warning' | 'information';

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** List of errors/warnings */
  errors: MeFError[];
  /** Timestamp of validation */
  validatedAt: Date;
}

// ============================================================================
// Filing Status Types
// ============================================================================

/** Filing submission status */
export type FilingStatusEnum = 
  | 'pending'
  | 'prepared'
  | 'transmitted'
  | 'accepted'
  | 'rejected'
  | 'error';

/** Filing submission record */
export interface FilingSubmission {
  _id?: string;
  filingId: string;
  returnId: string;
  submissionId?: string;
  taxYear: number;
  status: FilingStatusEnum;
  /** Whether this is a test filing */
  testMode?: boolean;
  /** IRS Acceptance/Receipt number */
  acknowledgmentNumber?: string;
  /** Timestamp when submitted */
  submittedAt?: Date;
  /** Timestamp when status changed */
  statusChangedAt?: Date;
  /** IRS response message */
  irsMessage?: string;
  /** List of errors if rejected */
  errors?: MeFError[];
  /** XML payload sent */
  xmlPayload?: string;
  /** XML response received */
  xmlResponse?: string;
  /** Number of retry attempts */
  retryCount?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt?: Date;
}

// ============================================================================
// Transmission Types
// ============================================================================

/** SOAP envelope for IRS transmission */
export interface SOAPEnvelope {
  soapAction: string;
  contentType: string;
  body: string;
}

/** IRS acknowledgment response */
export interface IRSAcknowledgment {
  /** Status: 'Accepted' | 'Rejected' | 'Error' */
  status: 'Accepted' | 'Rejected' | 'Error';
  /** IRS receipt/acceptance number */
  receiptNumber?: string;
  /** Timestamp of acknowledgment */
  timestamp: string;
  /** Business rules errors */
  businessErrors?: MeFError[];
  /** Schema validation errors */
  schemaErrors?: MeFError[];
  /** Additional messages */
  messages?: string[];
}

/** Transmission result */
export interface TransmissionResult {
  success: boolean;
  submissionId?: string;
  acknowledgment?: IRSAcknowledgment;
  errors?: MeFError[];
  transmissionId?: string;
  transmittedAt?: Date;
}

// ============================================================================
// XML Generation Options
// ============================================================================

/** Options for XML generation */
export interface XMLGenerationOptions {
  /** Include XML declaration */
  includeXmlDeclaration?: boolean;
  /** Include schema location */
  includeSchemaLocation?: boolean;
  /** Pretty print output */
  prettyPrint?: boolean;
  /** MeF schema version */
  schemaVersion?: string;
  /** Encoding (default UTF-8) */
  encoding?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** IRS MeF namespace constants */
export const MEF_NAMESPACES = {
  efi: 'http://www.irs.gov/efile',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  sch: 'http://purl.oclc.org/dsdl/schematron',
} as const;

/** Form ID constants */
export const FORM_IDS = {
  FORM_1040: '1040',
  SCHEDULE_1: 'Schedule1',
  SCHEDULE_2: 'Schedule2',
  SCHEDULE_3: 'Schedule3',
  SCHEDULE_A: 'ScheduleA',
  SCHEDULE_B: 'ScheduleB',
  SCHEDULE_C: 'ScheduleC',
  SCHEDULE_D: 'ScheduleD',
  SCHEDULE_E: 'ScheduleE',
  SCHEDULE_F: 'ScheduleF',
  SCHEDULE_SE: 'ScheduleSE',
  FORM_8949: 'Form8949',
  FORM_W2: 'FormW2',
  FORM_1099: 'Form1099',
} as const;

/** Required fields for 1040 filing */
export const REQUIRED_1040_FIELDS = [
  'FilingStatus',
  'SSN',
  'LastName',
  'Address',
  'City',
  'State',
  'ZIPCode',
] as const;

/** Business rules error codes */
export const ERROR_CODES = {
  // Schema validation errors (1xxx)
  SCHEMA_INVALID: '1001',
  SCHEMA_MISSING_REQUIRED: '1002',
  SCHEMA_INVALID_VALUE: '1003',
  
  // Business rules errors (2xxx)
  BUSINESS_RULE_FAILED: '2001',
  MISSING_REQUIRED_FIELD: '2002',
  INVALID_FILING_STATUS: '2003',
  SSN_FORMAT_INVALID: '2004',
  EIN_FORMAT_INVALID: '2005',
  
  // Transmission errors (3xxx)
  TRANSMISSION_FAILED: '3001',
  IRS_REJECTED: '3002',
  TIMEOUT: '3003',
  
  // Authentication errors (4xxx)
  INVALID_EFIN: '4001',
  INVALID_PIN: '4002',
} as const;
