/**
 * MeF (Modernized e-File) Transmitter
 * Handles SOAP/WSDL transmission to IRS MeF gateway
 * Based on IRS Publication 4163 and 4164
 */

// Environment configuration
const MEF_CONFIG = {
  isTestMode: process.env.MEF_IS_TEST_MODE === 'true',
  transmissionUrl: process.env.MEF_TRANSMISSION_URL || 'https://mefmt-efile.web.irs.gov/MEF/1040/PCK/1040',
  soapAction: process.env.MEF_SOAP_ACTION || 'http://www.irs.gov/efile/Submit',
  timeout: parseInt(process.env.MEF_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.MEF_MAX_RETRIES || '3', 10),
};

// ============================================================================
// Types
// ============================================================================

import {
  SubmissionBundle,
  TransmissionResult,
  IRSAcknowledgment,
  MeFError,
  FilingSubmission,
  FilingStatusEnum,
} from './mefTypes';
import { ERROR_CODES } from './mefTypes';

// ============================================================================
// Main Transmission Function
// ============================================================================

/**
 * Transmit a submission bundle to the IRS MeF gateway
 * @param bundle - The submission bundle to transmit
 * @param options - Transmission options
 * @returns TransmissionResult with success status and any errors
 */
export async function transmitSubmission(
  bundle: SubmissionBundle,
  options: {
    testMode?: boolean;
    onProgress?: (status: string) => void;
  } = {}
): Promise<TransmissionResult> {
  const { testMode = MEF_CONFIG.isTestMode, onProgress } = options;

  const errors: MeFError[] = [];
  let submissionId: string | undefined;
  let acknowledgment: IRSAcknowledgment | undefined;

  try {
    onProgress?.('Generating XML payload...');

    // Import the generator dynamically to avoid circular dependencies
    const { generateSubmissionXML } = await import('./mefGenerator');
    const xmlPayload = generateSubmissionXML(bundle);

    onProgress?.('Validating XML structure...');

    // Import the validator
    const { validateSubmission } = await import('./mefValidator');
    const validation = validateSubmission(bundle);

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    onProgress?.('Preparing SOAP envelope...');

    // Create SOAP envelope
    const soapEnvelope = createSOAPEnvelope(xmlPayload);

    if (testMode) {
      onProgress?.('Running in TEST mode - simulating IRS response...');
      
      // Simulate IRS response in test mode
      acknowledgment = await simulateIRSResponse(bundle, xmlPayload);
    } else {
      onProgress?.('Transmitting to IRS MeF gateway...');

      // Send to IRS
      const response = await sendToIRS(soapEnvelope);

      onProgress?.('Processing IRS response...');

      // Process acknowledgment
      acknowledgment = handleAcknowledgment(response);
    }

    // Check if accepted
    if (acknowledgment?.status === 'Accepted') {
      onProgress?.('Filing ACCEPTED by IRS');
      return {
        success: true,
        submissionId: bundle.submissionId,
        acknowledgment,
        transmittedAt: new Date(),
      };
    } else {
      // Filing rejected
      onProgress?.('Filing REJECTED by IRS');
      
      const rejectionErrors: MeFError[] = acknowledgment?.businessErrors || [];
      rejectionErrors.push(...(acknowledgment?.schemaErrors || []));

      return {
        success: false,
        submissionId: bundle.submissionId,
        acknowledgment,
        errors: rejectionErrors,
        transmittedAt: new Date(),
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    errors.push({
      code: ERROR_CODES.TRANSMISSION_FAILED,
      message: `Transmission failed: ${errorMessage}`,
      severity: 'error',
      actionable: true,
      suggestedFix: 'Check network connection and try again',
    });

    return {
      success: false,
      errors,
    };
  }
}

// ============================================================================
// SOAP Envelope Creation
// ============================================================================

/**
 * Create a SOAP envelope for IRS transmission
 */
function createSOAPEnvelope(xmlPayload: string): string {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:efile="http://www.irs.gov/efile">
  <soap:Header>
    <efile:TransmitterInfo>
      <efile:SubmissionId>${generateTransmissionId()}</efile:SubmissionId>
      <efile:Timestamp>${new Date().toISOString()}</efile:Timestamp>
    </efile:TransmitterInfo>
  </soap:Header>
  <soap:Body>
    ${xmlPayload}
  </soap:Body>
</soap:Envelope>`;

  return soapEnvelope;
}

/**
 * Generate unique transmission ID
 */
function generateTransmissionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `TX${timestamp}${random}`.toUpperCase();
}

// ============================================================================
// IRS Gateway Communication
// ============================================================================

/**
 * Send SOAP envelope to IRS MeF gateway
 */
async function sendToIRS(soapEnvelope: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEF_CONFIG.timeout);

  try {
    const response = await fetch(MEF_CONFIG.transmissionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': MEF_CONFIG.soapAction,
        'Accept': 'application/xml',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`IRS gateway returned status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    throw error;
  }
}

// ============================================================================
// Acknowledgment Processing
// ============================================================================

/**
 * Parse IRS acknowledgment response
 */
function handleAcknowledgment(xmlResponse: string): IRSAcknowledgment {
  // Parse XML response (simplified - real implementation would use proper XML parsing)
  const acknowledgment: IRSAcknowledgment = {
    status: 'Rejected', // Default to rejected
    timestamp: new Date().toISOString(),
    messages: [],
  };

  // Check for acceptance
  if (xmlResponse.includes('Status>Accepted</Status') || xmlResponse.includes('Status>ACCEPTED</Status')) {
    acknowledgment.status = 'Accepted';
    
    // Extract receipt number
    const receiptMatch = xmlResponse.match(/<ReceiptNumber>([^<]+)<\/ReceiptNumber>/i);
    if (receiptMatch) {
      acknowledgment.receiptNumber = receiptMatch[1];
    }
  } else if (xmlResponse.includes('Status>Error</Status') || xmlResponse.includes('Status>ERROR</Status')) {
    acknowledgment.status = 'Error';
  }

  // Extract business errors
  const businessErrorMatches = xmlResponse.matchAll(/<BusinessError[^>]*>([^<]+)<\/BusinessError>/gi);
  for (const match of businessErrorMatches) {
    acknowledgment.businessErrors = acknowledgment.businessErrors || [];
    acknowledgment.businessErrors.push({
      code: 'BUSINESS_ERROR',
      message: match[1],
      severity: 'error',
      actionable: true,
    });
  }

  // Extract schema errors
  const schemaErrorMatches = xmlResponse.matchAll(/<SchemaError[^>]*>([^<]+)<\/SchemaError>/gi);
  for (const match of schemaErrorMatches) {
    acknowledgment.schemaErrors = acknowledgment.schemaErrors || [];
    acknowledgment.schemaErrors.push({
      code: 'SCHEMA_ERROR',
      message: match[1],
      severity: 'error',
      actionable: true,
    });
  }

  return acknowledgment;
}

// ============================================================================
// Test Mode Simulation
// ============================================================================

/**
 * Simulate IRS response for testing
 */
async function simulateIRSResponse(
  bundle: SubmissionBundle,
  xmlPayload: string
): Promise<IRSAcknowledgment> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Check for intentional test errors
  const testError = xmlPayload.includes('TEST_ERROR_REJECT');
  const testSchemaError = xmlPayload.includes('TEST_SCHEMA_ERROR');

  if (testError) {
    return {
      status: 'Rejected',
      timestamp: new Date().toISOString(),
      businessErrors: [
        {
          code: ERROR_CODES.IRS_REJECTED,
          message: 'Test rejection - TEST_ERROR_REJECT found in payload',
          severity: 'error',
          actionable: true,
          suggestedFix: 'Remove TEST_ERROR_REJECT from payload',
        },
      ],
    };
  }

  if (testSchemaError) {
    return {
      status: 'Error',
      timestamp: new Date().toISOString(),
      schemaErrors: [
        {
          code: ERROR_CODES.SCHEMA_INVALID,
          message: 'Test schema error - TEST_SCHEMA_ERROR found',
          severity: 'error',
          actionable: true,
          suggestedFix: 'Fix XML schema validation',
        },
      ],
    };
  }

  // Successful acceptance in test mode
  return {
    status: 'Accepted',
    receiptNumber: `TEST-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    messages: ['Test filing accepted - This is a simulation'],
  };
}

// ============================================================================
// Filing Status Management
// ============================================================================

/**
 * Create initial filing submission record
 */
export function createFilingSubmission(
  returnId: string,
  taxYear: number,
  options: { testMode?: boolean } = {}
): FilingSubmission {
  const now = new Date();
  
  return {
    filingId: `FIL${Date.now().toString(36).toUpperCase()}`,
    returnId,
    taxYear,
    status: 'pending',
    testMode: options.testMode || MEF_CONFIG.isTestMode,
    retryCount: 0,
    createdAt: now,
  };
}

/**
 * Update filing submission status
 */
export function updateFilingStatus(
  submission: FilingSubmission,
  status: FilingStatusEnum,
  options: {
    acknowledgmentNumber?: string;
    irsMessage?: string;
    errors?: MeFError[];
    xmlResponse?: string;
  } = {}
): FilingSubmission {
  return {
    ...submission,
    status,
    acknowledgmentNumber: options.acknowledgmentNumber,
    irsMessage: options.irsMessage,
    errors: options.errors,
    xmlResponse: options.xmlResponse,
    statusChangedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Check if filing can be retried
 */
export function canRetry(submission: FilingSubmission): boolean {
  if (submission.status === 'accepted') {
    return false;
  }

  if (submission.status === 'rejected' || submission.status === 'error') {
    return (submission.retryCount || 0) < MEF_CONFIG.maxRetries;
  }

  return false;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Get current MeF configuration
 */
export function getMeFConfig() {
  return {
    ...MEF_CONFIG,
    isTestMode: MEF_CONFIG.isTestMode,
  };
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return MEF_CONFIG.isTestMode;
}

export default {
  transmitSubmission,
  createFilingSubmission,
  updateFilingStatus,
  canRetry,
  getMeFConfig,
  isTestMode,
};
