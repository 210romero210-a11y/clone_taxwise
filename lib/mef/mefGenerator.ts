/**
 * MeF (Modernized e-File) XML Generator
 * Generates IRS-compliant XML for electronic filing
 * Based on IRS Publication 4163 and 4164
 */

import {
  SubmissionBundle,
  ReturnData,
  ReturnHeader,
  TaxForm,
  FormField,
  Taxpayer,
  Address,
  FilingStatus,
  SoftwareInfo,
  Originator,
  ThirdPartyDesignee,
  PinInfo,
  Attachment,
  XMLGenerationOptions,
} from './mefTypes';

// ============================================================================
// Constants
// ============================================================================

const MEF_SCHEMA_VERSION = '2025v1.0';
const DEFAULT_ENCODING = 'UTF-8';

/** IRS MeF endpoint identifiers */
const SUBMISSION_TYPES: Record<string, string> = {
  '1040': 'IRS1040',
  '1120': 'IRS1120',
  '1120S': 'IRS1120S',
  '1065': 'IRS1065',
};

// ============================================================================
// XML Character Escaping
// ============================================================================

/**
 * Escape special XML characters
 */
function escapeXml(s: string): string {
  if (typeof s !== 'string') {
    return '';
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function unescapeXml(s: string): string {
  if (typeof s !== 'string') {
    return '';
  }
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Generate complete MeF submission XML
 * @param bundle - Complete submission bundle
 * @param options - XML generation options
 * @returns Complete XML string ready for transmission
 */
export function generateSubmissionXML(
  bundle: SubmissionBundle,
  options: XMLGenerationOptions = {}
): string {
  const {
    includeXmlDeclaration = true,
    includeSchemaLocation = true,
    prettyPrint = true,
    encoding = DEFAULT_ENCODING,
  } = options;

  const parts: string[] = [];

  // XML Declaration
  if (includeXmlDeclaration) {
    parts.push(`<?xml version="1.0" encoding="${encoding}"?>`);
  }

  // Root Submission element
  const submissionAttrs: string[] = [
    'xmlns="http://www.irs.gov/efile"',
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  ];

  if (includeSchemaLocation) {
    const schemaLocation = `xsi:schemaLocation="http://www.irs.gov/efile ${getSchemaLocation(bundle.submissionType)}"`;
    submissionAttrs.push(schemaLocation);
  }

  const submissionOpen = `<Submission ${submissionAttrs.join(' ')}>`;

  // Submission Header
  parts.push(submissionOpen);
  parts.push(generateSubmissionHeader(bundle));

  // Returns
  for (const returnData of bundle.returns) {
    parts.push(generateReturn(returnData));
  }

  // Submission Footer
  parts.push('</Submission>');

  // Join with newlines if pretty print
  if (prettyPrint) {
    return parts.join('\n');
  }

  return parts.join('');
}

/**
 * Generate XML for a single return
 */
export function generateReturn(returnData: ReturnData): string {
  const parts: string[] = [];

  // ReturnData root
  parts.push('<ReturnData>');

  // Return Header
  parts.push(generateReturnHeader(returnData.returnHeader));

  // Forms
  for (const form of returnData.forms) {
    parts.push(generateForm(form));
  }

  // Attachments (if any)
  if (returnData.attachments && returnData.attachments.length > 0) {
    parts.push(generateAttachments(returnData.attachments));
  }

  parts.push('</ReturnData>');

  return parts.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the IRS schema location for a submission type
 */
function getSchemaLocation(submissionType: string): string {
  const schemaLocations: Record<string, string> = {
    '1040': 'https://www.irs.gov/efile/2025/AFD/IRS1040/IRS1040.xsd',
    '1120': 'https://www.irs.gov/efile/2025/AFD/IRS1120/IRS1120.xsd',
    '1120S': 'https://www.irs.gov/efile/2025/AFD/IRS1120S/IRS1120S.xsd',
    '1065': 'https://www.irs.gov/efile/2025/AFD/IRS1065/IRS1065.xsd',
  };
  return schemaLocations[submissionType] || schemaLocations['1040'];
}

/**
 * Format field value for XML output
 */
function formatFieldValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return String(value);
}

// ============================================================================
// Header Generation
// ============================================================================

/**
 * Generate Submission-level header
 */
function generateSubmissionHeader(bundle: SubmissionBundle): string {
  const timestamp = new Date().toISOString();
  
  return `
  <SubmissionHeader>
    <SubmissionId>${escapeXml(bundle.submissionId)}</SubmissionId>
    <SubmissionType>${SUBMISSION_TYPES[bundle.submissionType] || bundle.submissionType}</SubmissionType>
    <TaxYear>${escapeXml(String(bundle.taxYear))}</TaxYear>
    <GeneratedTimestamp>${escapeXml(timestamp)}</GeneratedTimestamp>
  </SubmissionHeader>`.trim();
}

/**
 * Generate Return Header (IRS Form 1040 Section)
 */
function generateReturnHeader(header: ReturnHeader): string {
  const parts: string[] = [];

  parts.push('<ReturnHeader>');
  
  // Filing Information
  parts.push(`
    <FilingInfo>
      <TaxYear>${escapeXml(header.taxYear)}</TaxYear>
      ${header.taxPeriodEnd ? `<TaxPeriodEnd>${escapeXml(header.taxPeriodEnd)}</TaxPeriodEnd>` : ''}
      <FilingStatus>${generateFilingStatus(header.filingStatus)}</FilingStatus>
    </FilingInfo>
  `.trim());

  // Originator
  parts.push(generateOriginator(header.originator));

  // Software
  parts.push(generateSoftware(header.software));

  // E-file ID (if available)
  if (header.efileId) {
    parts.push(`<EFileId>${escapeXml(header.efileId)}</EFileId>`);
  }

  // Primary Taxpayer
  parts.push(generateTaxpayer(header.taxpayer, 'Primary'));

  // Spouse (if applicable)
  if (header.spouse) {
    parts.push(generateTaxpayer(header.spouse, 'Spouse'));
  }

  // Third Party Designee (if applicable)
  if (header.thirdPartyDesignee) {
    parts.push(generateThirdPartyDesignee(header.thirdPartyDesignee));
  }

  // PIN/Signature
  parts.push(generatePIN(header.pin));

  parts.push('</ReturnHeader>');

  return parts.join('\n');
}

function generateFilingStatus(status: FilingStatus): string {
  const statusMap: Record<FilingStatus, string> = {
    'Single': '1',
    'MarriedFilingJointly': '2',
    'MarriedFilingSeparately': '3',
    'HeadOfHousehold': '4',
    'QualifyingWidower': '5',
  };
  return statusMap[status] || '1';
}

function generateOriginator(originator: Originator): string {
  return `
    <Originator>
      <EFIN>${escapeXml(originator.efin)}</EFIN>
      <EFINType>${escapeXml(originator.efinType)}</EFINType>
      ${originator.originatorSSN ? `<OriginatorSSN>${escapeXml(originator.originatorSSN)}</OriginatorSSN>` : ''}
      ${originator.firmName ? `<FirmName>${escapeXml(originator.firmName)}</FirmName>` : ''}
      ${originator.firmEIN ? `<FirmEIN>${escapeXml(originator.firmEIN)}</FirmEIN>` : ''}
    </Originator>`.trim();
}

function generateSoftware(software: SoftwareInfo): string {
  return `
    <Software>
      <SoftwareId>${escapeXml(software.softwareId)}</SoftwareId>
      <SoftwareVersion>${escapeXml(software.version)}</SoftwareVersion>
      ${software.packageName ? `<PackageName>${escapeXml(software.packageName)}</PackageName>` : ''}
      ${software.developmentMode ? '<DevelopmentMode>1</DevelopmentMode>' : ''}
    </Software>`.trim();
}

function generateTaxpayer(taxpayer: Taxpayer, type: 'Primary' | 'Spouse'): string {
  const tag = type === 'Primary' ? 'PrimaryTaxpayer' : 'Spouse';
  
  return `
    <${tag}>
      <SSN>${escapeXml(taxpayer.ssn)}</SSN>
      <FirstName>${escapeXml(taxpayer.firstName)}</FirstName>
      ${taxpayer.middleName ? `<MiddleName>${escapeXml(taxpayer.middleName)}</MiddleName>` : ''}
      <LastName>${escapeXml(taxpayer.lastName)}</LastName>
      ${taxpayer.suffix ? `<Suffix>${escapeXml(taxpayer.suffix)}</Suffix>` : ''}
      ${taxpayer.dateOfBirth ? `<DateOfBirth>${escapeXml(taxpayer.dateOfBirth)}</DateOfBirth>` : ''}
      ${taxpayer.occupation ? `<Occupation>${escapeXml(taxpayer.occupation)}</Occupation>` : ''}
      ${generateAddress(taxpayer.address, type)}
      ${taxpayer.phone ? `<Phone>${escapeXml(taxpayer.phone)}</Phone>` : ''}
      ${taxpayer.email ? `<Email>${escapeXml(taxpayer.email)}</Email>` : ''}
    </${tag}>`.trim();
}

function generateAddress(address: Address, type: string): string {
  const tag = type === 'Primary' ? 'PrimaryAddress' : 'SpouseAddress';
  
  return `
    <${tag}>
      <AddressLine1>${escapeXml(address.addressLine1)}</AddressLine1>
      ${address.addressLine2 ? `<AddressLine2>${escapeXml(address.addressLine2)}</AddressLine2>` : ''}
      <City>${escapeXml(address.city)}</City>
      <State>${escapeXml(address.state)}</State>
      <ZIPCode>${escapeXml(address.zipCode)}</ZIPCode>
      ${address.country && address.country !== 'US' ? `<Country>${escapeXml(address.country)}</Country>` : ''}
    </${tag}>`.trim();
}

function generateThirdPartyDesignee(designee: ThirdPartyDesignee): string {
  return `
    <ThirdPartyDesignee>
      <Name>${escapeXml(designee.name)}</Name>
      <Phone>${escapeXml(designee.phone)}</Phone>
      <PIN>${escapeXml(designee.pin)}</PIN>
    </ThirdPartyDesignee>`.trim();
}

function generatePIN(pin: PinInfo): string {
  return `
    <PIN>
      <PINType>${escapeXml(pin.pinType)}</PINType>
      <PrimaryPIN>${escapeXml(pin.primaryPin)}</PrimaryPIN>
      ${pin.spousePin ? `<SpousePIN>${escapeXml(pin.spousePin)}</SpousePIN>` : ''}
      ${pin.practitionerPin ? `<PractitionerPIN>${escapeXml(pin.practitionerPin)}</PractitionerPIN>` : ''}
    </PIN>`.trim();
}

// ============================================================================
// Form Generation
// ============================================================================

/**
 * Generate XML for a tax form
 */
export function generateForm(form: TaxForm): string {
  const parts: string[] = [];

  // Form wrapper
  parts.push(`<${form.formId}>`);
  parts.push(`<FormId>${escapeXml(form.formId)}</FormId>`);
  parts.push(`<FormName>${escapeXml(form.formName)}</FormName>`);

  // Fields
  parts.push('<Fields>');
  for (const field of form.fields) {
    parts.push(generateFormField(field));
  }
  parts.push('</Fields>');

  // Supporting forms (nested schedules)
  if (form.supportingForms && form.supportingForms.length > 0) {
    parts.push('<SupportingForms>');
    for (const supportingForm of form.supportingForms) {
      parts.push(generateForm(supportingForm));
    }
    parts.push('</SupportingForms>');
  }

  // Form footer
  parts.push(`</${form.formId}>`);

  return parts.join('\n');
}

function generateFormField(field: FormField): string {
  const value = formatFieldValue(field.value);
  
  if (value === '') {
    return `<Field id="${escapeXml(field.fieldId)}"/>`;
  }

  return `<Field id="${escapeXml(field.fieldId)}">${escapeXml(value)}</Field>`;
}

// ============================================================================
// Attachments Generation
// ============================================================================

function generateAttachments(attachments: Attachment[]): string {
  const parts: string[] = [];

  parts.push('<Attachments>');
  for (const attachment of attachments) {
    parts.push(`
      <Attachment>
        <AttachmentId>${escapeXml(attachment.attachmentId)}</AttachmentId>
        <DocumentType>${escapeXml(attachment.documentType)}</DocumentType>
        <FileName>${escapeXml(attachment.fileName)}</FileName>
        <MimeType>${escapeXml(attachment.mimeType)}</MimeType>
        <Description>${escapeXml(attachment.description || '')}</Description>
        <Content>${escapeXml(attachment.content)}</Content>
      </Attachment>`.trim());
  }
  parts.push('</Attachments>');

  return parts.join('\n');
}

// ============================================================================
// Utility Functions for Converting Return Data
// ============================================================================

/**
 * Convert internal return data to MeF submission format
 * This is the main integration point with the existing tax engine
 */
export interface InternalReturnData {
  returnId: string;
  year: number;
  taxpayerId?: string;
  fields: Array<{
    formId: string;
    fieldId: string;
    value: unknown;
    overridden?: boolean;
  }>;
}

/**
 * Convert internal return data to MeF ReturnData
 */
export function convertToMeFReturn(
  internalData: InternalReturnData,
  header: ReturnHeader,
  options: { includeAllFields?: boolean } = {}
): ReturnData {
  const { includeAllFields = false } = options;

  // Group fields by form
  const formMap = new Map<string, TaxForm>();

  for (const field of internalData.fields) {
    // Skip overridden fields if not including all
    if (!includeAllFields && field.overridden) {
      continue;
    }

    let form = formMap.get(field.formId);
    if (!form) {
      form = {
        formId: field.formId,
        formName: getFormName(field.formId),
        fields: [],
      };
      formMap.set(field.formId, form);
    }

    form.fields.push({
      fieldId: field.fieldId,
      value: field.value as string | number | boolean | null,
      overridden: field.overridden,
    });
  }

  return {
    returnId: internalData.returnId,
    returnHeader: header,
    forms: Array.from(formMap.values()),
  };
}

function getFormName(formId: string): string {
  const formNames: Record<string, string> = {
    '1040': 'U.S. Individual Income Tax Return',
    'Schedule1': 'Additional Income and Adjustments',
    'Schedule2': 'Additional Taxes',
    'Schedule3': 'Additional Credits and Payments',
    'ScheduleA': 'Itemized Deductions',
    'ScheduleB': 'Interest and Ordinary Dividends',
    'ScheduleC': 'Profit or Loss From Business',
    'ScheduleD': 'Capital Gains and Losses',
    'ScheduleE': 'Supplemental Income and Loss',
    'ScheduleF': 'Profit or Loss From Farming',
    'ScheduleSE': 'Self-Employment Tax',
    'FormW2': 'Wage and Tax Statement',
    'Form1099': 'Miscellaneous Income',
    'Form8949': 'Sales and Dispositions of Capital Assets',
  };
  return formNames[formId] || formId;
}

/**
 * Create a submission bundle from return data
 */
export function createSubmissionBundle(
  returnData: ReturnData,
  submissionId: string,
  taxYear: number,
  submissionType: '1040' | '1120' | '1120S' | '1065' = '1040'
): SubmissionBundle {
  return {
    submissionId,
    taxYear,
    submissionType,
    createdAt: new Date(),
    returns: [returnData],
  };
}
