/**
 * Ollama Cloud Client for AI Document Extraction
 * 
 * Provides:
 * - Vision model integration (Llama 3.2 Vision) for W-2/1099 extraction
 * - ID model (Gemma 3) for demographics extraction
 * - Rate limiting for cost control (caller-managed via pre-check)
 * - Fault tolerance with exponential backoff retries
 * 
 * NOTE: Rate limiting is managed by the caller (Convex action) via pre-check.
 * This allows database-backed rate limiting in Convex while keeping this
 * library testable without Convex runtime.
 */

// ============================================
// Types
// ============================================

export interface OllamaConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  rateLimitPerHour: number;
}

export type DocumentType = 'W2' | '1099' | 'ID' | 'SSN' | 'OTHER';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExtractedField {
  fieldId: string;      // Canonical field ID (e.g., "W2.box1", "1040.totalIncome")
  value: string | number | boolean | null;
  confidence: number;   // 0-1 confidence score
  source: string;       // Where on the document this was found
}

export interface ExtractionResult {
  success: boolean;
  documentType: DocumentType;
  extractedFields: ExtractedField[];
  rawResponse?: string;
  errorMessage?: string;
  processingTimeMs: number;
  modelUsed: string;
  confidence: number;   // Overall confidence score
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'https://api.ollama.com',
  apiKey: process.env.OLLAMA_API_KEY || '',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '3', 10),
  rateLimitPerHour: parseInt(process.env.OLLAMA_RATE_LIMIT_PER_HOUR || '20', 10),
};

// ============================================
// Rate Limiter (In-Memory)
// ============================================

class RateLimiter {
  private requests: Map<string, { count: number; windowStart: number; resetAt: number }> = new Map();
  private limit: number;

  constructor(limitPerHour: number) {
    this.limit = limitPerHour;
  }

  check(userId: string): RateLimitInfo {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const key = userId;

    let requestData = this.requests.get(key);

    // Create new window if needed
    if (!requestData || now >= requestData.resetAt) {
      requestData = {
        count: 0,
        windowStart: now,
        resetAt: now + hour,
      };
      this.requests.set(key, requestData);
    }

    const remaining = Math.max(0, this.limit - requestData.count);
    const allowed = remaining > 0;

    return {
      allowed,
      remaining,
      resetAt: requestData.resetAt,
      retryAfter: allowed ? undefined : requestData.resetAt - now,
    };
  }

  consume(userId: string): boolean {
    const info = this.check(userId);
    if (!info.allowed) return false;

    const requestData = this.requests.get(userId);
    if (requestData) {
      requestData.count++;
    }
    return true;
  }

  getRemaining(userId: string): number {
    return this.check(userId).remaining;
  }

  getResetTime(userId: string): number {
    return this.check(userId).resetAt;
  }
}

// Global rate limiter instance
let globalRateLimiter: RateLimiter | null = null;

function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(DEFAULT_CONFIG.rateLimitPerHour);
  }
  return globalRateLimiter;
}

// ============================================
// Retry Logic with Exponential Backoff
// ============================================

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on final attempt
      if (attempt === maxRetries) break;

      // Check if error is retryable (only retry on 5xx, network errors, timeouts)
      // Skip retry for 4xx client errors (400, 401, 403, 422, 429)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable = 
        // Server errors (500-599)
        (errorMessage.includes('500') || errorMessage.includes('501') ||
         errorMessage.includes('502') || errorMessage.includes('503') ||
         errorMessage.includes('504') || errorMessage.includes('5')) ||
        // Network errors
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Rate limited');
      
      if (!isRetryable) {
        throw lastError; // Don't retry non-retryable errors
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

// ============================================
// Ollama API Client
// ============================================

export class OllamaClient {
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check rate limit status for a user (DEPRECATED - use Convex action for DB-backed rate limiting)
   * @deprecated Use database-backed rate limiting in Convex action instead
   */
  checkRateLimit(userId: string): RateLimitInfo {
    return getRateLimiter().check(userId);
  }

  /**
   * Consume a rate limit slot (DEPRECATED - use Convex action for DB-backed rate limiting)
   * @deprecated Use database-backed rate limiting in Convex action instead
   */
  consumeRateLimit(userId: string): boolean {
    return getRateLimiter().consume(userId);
  }

  /**
   * Extract data from W-2 or 1099 document using vision model
   * NOTE: Rate limiting is handled by the caller (Convex action)
   */
  async extractFromW2(imageBase64: string, userId: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    return withRetry(async () => {
      const prompt = `You are a tax document extraction expert. Analyze this W-2 form and extract the following fields in JSON format:

{
  "employer": {
    "name": "Employer name (Box c)",
    "address": "Employer address (Box c)",
    "ein": "Employer EIN (Box b)"
  },
  "employee": {
    "firstName": "Employee first name (Box a)",
    "lastName": "Employee last name (Box a)", 
    "ssn": "Employee SSN (Box a)",
    "address": "Employee address (Box a)"
  },
  "wages": {
    "box1": "Wages, tips, other compensation (Box 1)",
    "box2": "Federal income tax withheld (Box 2)",
    "box3": "Social Security wages (Box 3)",
    "box4": "Social Security tax withheld (Box 4)",
    "box5": "Medicare wages and tips (Box 5)",
    "box6": "Medicare tax withheld (Box 6)",
    "box7": "Social Security tips (Box 7)",
    "box8": "Allocated tips (Box 8)",
    "box10": "Dependent care benefits (Box 10)",
    "box11": "Nonqualified plans (Box 11)",
    "box12": "Box 12 entries (as array)",
    "box13": "Statutory employee / Retirement plan / Third party sick pay (Box 13)",
    "box14": "Other (Box 14)"
  },
  "state": {
    "box1": "State wages (1st state)",
    "box2": "State income tax (1st state)",
    "employerStateId": "Employer state ID (1st state)"
  },
  "local": {
    "box1": "Local wages",
    "box2": "Local income tax",
    "localityName": "Locality name"
  }
}

Return ONLY valid JSON, no other text. Extract exact numeric values where possible.`;

      const response = await this.makeRequest('/api/chat', {
        model: 'llama-3.2-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        format: 'json',
      }, userId);

      const processingTimeMs = Date.now() - startTime;
      const content = response.message?.content || '';
      
      try {
        const extractedData = JSON.parse(content);
        const extractedFields = this.mapW2ToFields(extractedData);
        
        return {
          success: true,
          documentType: 'W2' as DocumentType,
          extractedFields,
          rawResponse: content,
          processingTimeMs,
          modelUsed: 'llama-3.2-vision',
          confidence: this.calculateConfidence(extractedFields),
        };
      } catch (parseError) {
        return {
          success: false,
          documentType: 'W2' as DocumentType,
          extractedFields: [],
          errorMessage: `Failed to parse AI response: ${content}`,
          processingTimeMs,
          modelUsed: 'llama-3.2-vision',
          confidence: 0,
        };
      }
    }, { maxRetries: this.config.maxRetries });
  }

  /**
   * Extract data from 1099 document using vision model
   * NOTE: Rate limiting is handled by the caller (Convex action)
   */
  async extractFrom1099(imageBase64: string, userId: string, formType: string = '1099-MISC'): Promise<ExtractionResult> {
    const startTime = Date.now();

    return withRetry(async () => {
      const prompt = `You are a tax document extraction expert. Analyze this ${formType} form and extract the following fields in JSON format:

{
  "payer": {
    "name": "Payer name",
    "address": "Payer address",
    "tin": "Payer TIN (EIN)"
  },
  "recipient": {
    "name": "Recipient name",
    "tin": "Recipient TIN/SSN",
    "address": "Recipient address",
    "accountNumber": "Account number"
  },
  "amounts": {
    "box1": "Rents (Box 1)",
    "box2": "Royalties (Box 2)",
    "box3": "Other income (Box 3)",
    "box4": "Federal income tax withheld (Box 4)",
    "box5": "Fishing boat proceeds (Box 5)",
    "box6": "Medical and health care payments (Box 6)",
    "box7": "Nonemployee compensation (Box 7)",
    "box8": "Substitute payments (Box 8)",
    "box9": "Direct sales indicator (Box 9)",
    "box10": "Crop insurance proceeds (Box 10)",
    "box11": "Section 409A deferrals (Box 11)",
    "box12": "Box 12 entries (as array)",
    "box13": "Excess golden parachute payments (Box 13)",
    "box14": "Gross proceeds paid to attorney (Box 14)"
  },
  "state": {
    "stateTaxWithheld": "State tax withheld",
    "stateIncome": "State income"
  }
}

Return ONLY valid JSON, no other text. Extract exact numeric values where possible.`;

      const response = await this.makeRequest('/api/chat', {
        model: 'llama-3.2-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        format: 'json',
      }, userId);

      const processingTimeMs = Date.now() - startTime;
      const content = response.message?.content || '';
      
      try {
        const extractedData = JSON.parse(content);
        const extractedFields = this.map1099ToFields(extractedData, formType);
        
        return {
          success: true,
          documentType: '1099' as DocumentType,
          extractedFields,
          rawResponse: content,
          processingTimeMs,
          modelUsed: 'llama-3.2-vision',
          confidence: this.calculateConfidence(extractedFields),
        };
      } catch (parseError) {
        return {
          success: false,
          documentType: '1099' as DocumentType,
          extractedFields: [],
          errorMessage: `Failed to parse AI response: ${content}`,
          processingTimeMs,
          modelUsed: 'llama-3.2-vision',
          confidence: 0,
        };
      }
    }, { maxRetries: this.config.maxRetries });
  }

  /**
   * Extract demographics from ID/Driver's License using ID model
   * NOTE: Rate limiting is handled by the caller (Convex action)
   */
  async extractFromID(imageBase64: string, userId: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    return withRetry(async () => {
      const prompt = `You are an ID document extraction expert. Analyze this driver's license or ID card and extract the following fields in JSON format:

{
  "documentInfo": {
    "documentType": "Type of ID (Driver's License, State ID, Passport, etc.)",
    "issuingState": "Issuing state/country",
    "expirationDate": "Expiration date (MM/DD/YYYY)",
    "issueDate": "Issue date (MM/DD/YYYY)"
  },
  "personalInfo": {
    "firstName": "First name",
    "middleName": "Middle name",
    "lastName": "Last name",
    "dateOfBirth": "Date of birth (MM/DD/YYYY)",
    "sex": "Sex/Gender",
    "height": "Height",
    "weight": "Weight",
    "eyeColor": "Eye color",
    "hairColor": "Hair color"
  },
  "address": {
    "street": "Street address",
    "city": "City",
    "state": "State",
    "zipCode": "ZIP code",
    "country": "Country"
  },
  "identification": {
    "licenseNumber": "License/ID number",
    "ssn": "SSN (if visible)",
    "realIdNumber": "Real ID number (if applicable)"
  },
  "restrictions": "Any restrictions",
  "endorsements": "Any endorsements"
}

Return ONLY valid JSON, no other text. Be precise with dates and numbers.`;

      const response = await this.makeRequest('/api/chat', {
        model: 'gemma-3',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        format: 'json',
      }, userId);

      const processingTimeMs = Date.now() - startTime;
      const content = response.message?.content || '';
      
      try {
        const extractedData = JSON.parse(content);
        const extractedFields = this.mapIDToFields(extractedData);
        
        return {
          success: true,
          documentType: 'ID' as DocumentType,
          extractedFields,
          rawResponse: content,
          processingTimeMs,
          modelUsed: 'gemma-3',
          confidence: this.calculateConfidence(extractedFields),
        };
      } catch (parseError) {
        return {
          success: false,
          documentType: 'ID' as DocumentType,
          extractedFields: [],
          errorMessage: `Failed to parse AI response: ${content}`,
          processingTimeMs,
          modelUsed: 'gemma-3',
          confidence: 0,
        };
      }
    }, { maxRetries: this.config.maxRetries });
  }

  /**
   * Extract SSN from SSN card image
   * NOTE: Rate limiting is handled by the caller (Convex action)
   */
  async extractFromSSN(imageBase64: string, userId: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    return withRetry(async () => {
      const prompt = `You are an SSN card extraction expert. Analyze this Social Security card and extract the following fields in JSON format:

{
  "ssn": "Full Social Security Number (XXX-XX-XXXX)",
  "name": "Name on card (First Last)",
  "dateOfBirth": "Date of birth if visible (MM/DD/YYYY)",
  "parentName": "Parent name if minor"
}

Return ONLY valid JSON, no other text. Be extremely careful with the SSN format.`;

      const response = await this.makeRequest('/api/chat', {
        model: 'gemma-3',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        format: 'json',
      }, userId);

      const processingTimeMs = Date.now() - startTime;
      const content = response.message?.content || '';
      
      try {
        const extractedData = JSON.parse(content);
        const extractedFields = this.mapSSNToFields(extractedData);
        
        return {
          success: true,
          documentType: 'SSN' as DocumentType,
          extractedFields,
          rawResponse: content,
          processingTimeMs,
          modelUsed: 'gemma-3',
          confidence: this.calculateConfidence(extractedFields),
        };
      } catch (parseError) {
        return {
          success: false,
          documentType: 'SSN' as DocumentType,
          extractedFields: [],
          errorMessage: `Failed to parse AI response: ${content}`,
          processingTimeMs,
          modelUsed: 'gemma-3',
          confidence: 0,
        };
      }
    }, { maxRetries: this.config.maxRetries });
  }

  /**
   * Make API request to Ollama
   */
  private async makeRequest(endpoint: string, body: any, userId: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle rate limiting (429)
        if (response.status === 429) {
          throw new Error(`Rate limited by Ollama: ${errorText}`);
        }
        
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map W-2 extraction to canonical field IDs
   */
  private mapW2ToFields(data: any): ExtractedField[] {
    const fields: ExtractedField[] = [];

    // Map employer info
    if (data.employer) {
      if (data.employer.name) fields.push({ fieldId: 'W2.employerName', value: data.employer.name, confidence: 0.9, source: 'W2 Box c' });
      if (data.employer.address) fields.push({ fieldId: 'W2.employerAddress', value: data.employer.address, confidence: 0.9, source: 'W2 Box c' });
      if (data.employer.ein) fields.push({ fieldId: 'W2.employerEIN', value: data.employer.ein, confidence: 0.95, source: 'W2 Box b' });
    }

    // Map employee info
    if (data.employee) {
      if (data.employee.ssn) fields.push({ fieldId: 'W2.employeeSSN', value: data.employee.ssn, confidence: 0.95, source: 'W2 Box a' });
    }

    // Map wages (Box numbers use dot notation)
    if (data.wages) {
      if (data.wages.box1) {
        const parsed = this.parseCurrency(data.wages.box1);
        if (parsed.valid) fields.push({ fieldId: 'W2.box1', value: parsed.value, confidence: 0.95, source: 'W2 Box 1' });
      }
      if (data.wages.box2) {
        const parsed = this.parseCurrency(data.wages.box2);
        if (parsed.valid) fields.push({ fieldId: 'W2.box2', value: parsed.value, confidence: 0.95, source: 'W2 Box 2' });
      }
      if (data.wages.box3) {
        const parsed = this.parseCurrency(data.wages.box3);
        if (parsed.valid) fields.push({ fieldId: 'W2.box3', value: parsed.value, confidence: 0.95, source: 'W2 Box 3' });
      }
      if (data.wages.box4) {
        const parsed = this.parseCurrency(data.wages.box4);
        if (parsed.valid) fields.push({ fieldId: 'W2.box4', value: parsed.value, confidence: 0.95, source: 'W2 Box 4' });
      }
      if (data.wages.box5) {
        const parsed = this.parseCurrency(data.wages.box5);
        if (parsed.valid) fields.push({ fieldId: 'W2.box5', value: parsed.value, confidence: 0.95, source: 'W2 Box 5' });
      }
      if (data.wages.box6) {
        const parsed = this.parseCurrency(data.wages.box6);
        if (parsed.valid) fields.push({ fieldId: 'W2.box6', value: parsed.value, confidence: 0.95, source: 'W2 Box 6' });
      }
    }

    // Map state info
    if (data.state) {
      if (data.state.box1) {
        const parsed = this.parseCurrency(data.state.box1);
        if (parsed.valid) fields.push({ fieldId: 'W2.stateWages', value: parsed.value, confidence: 0.9, source: 'W2 State 1' });
      }
      if (data.state.box2) {
        const parsed = this.parseCurrency(data.state.box2);
        if (parsed.valid) fields.push({ fieldId: 'W2.stateTax', value: parsed.value, confidence: 0.9, source: 'W2 State 2' });
      }
    }

    return fields;
  }

  /**
   * Map 1099 extraction to canonical field IDs
   */
  private map1099ToFields(data: any, formType: string): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const prefix = formType.replace('-', '_');

    // Map payer info
    if (data.payer) {
      if (data.payer.name) fields.push({ fieldId: `${prefix}.payerName`, value: data.payer.name, confidence: 0.9, source: `${formType} Payer` });
      if (data.payer.tin) fields.push({ fieldId: `${prefix}.payerTIN`, value: data.payer.tin, confidence: 0.95, source: `${formType} Payer TIN` });
    }

    // Map recipient info
    if (data.recipient) {
      if (data.recipient.name) fields.push({ fieldId: `${prefix}.recipientName`, value: data.recipient.name, confidence: 0.9, source: `${formType} Recipient` });
      if (data.recipient.tin) fields.push({ fieldId: `${prefix}.recipientTIN`, value: data.recipient.tin, confidence: 0.95, source: `${formType} Recipient TIN` });
    }

    // Map amounts
    if (data.amounts) {
      for (const box of ['box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'box7', 'box8', 'box10', 'box11', 'box13', 'box14']) {
        if (data.amounts[box]) {
          const parsed = this.parseCurrency(data.amounts[box]);
          if (parsed.valid) {
            fields.push({ 
              fieldId: `${prefix}.${box}`, 
              value: parsed.value, 
              confidence: 0.9, 
              source: `${formType} Box ${box.replace('box', '')}` 
            });
          }
        }
      }
    }

    return fields;
  }

  /**
   * Map ID extraction to canonical field IDs
   */
  private mapIDToFields(data: any): ExtractedField[] {
    const fields: ExtractedField[] = [];

    // Map document info
    if (data.documentInfo) {
      if (data.documentInfo.documentType) fields.push({ fieldId: 'ID.documentType', value: data.documentInfo.documentType, confidence: 0.9, source: 'ID Document' });
      if (data.documentInfo.issuingState) fields.push({ fieldId: 'ID.issuingState', value: data.documentInfo.issuingState, confidence: 0.9, source: 'ID Document' });
      if (data.documentInfo.expirationDate) fields.push({ fieldId: 'ID.expirationDate', value: data.documentInfo.expirationDate, confidence: 0.95, source: 'ID Document' });
    }

    // Map personal info
    if (data.personalInfo) {
      if (data.personalInfo.firstName) fields.push({ fieldId: 'ID.firstName', value: data.personalInfo.firstName, confidence: 0.9, source: 'ID Document' });
      if (data.personalInfo.lastName) fields.push({ fieldId: 'ID.lastName', value: data.personalInfo.lastName, confidence: 0.9, source: 'ID Document' });
      if (data.personalInfo.dateOfBirth) fields.push({ fieldId: 'ID.dateOfBirth', value: data.personalInfo.dateOfBirth, confidence: 0.95, source: 'ID Document' });
      if (data.personalInfo.sex) fields.push({ fieldId: 'ID.sex', value: data.personalInfo.sex, confidence: 0.9, source: 'ID Document' });
    }

    // Map identification
    if (data.identification) {
      if (data.identification.licenseNumber) fields.push({ fieldId: 'ID.licenseNumber', value: data.identification.licenseNumber, confidence: 0.95, source: 'ID Document' });
      if (data.identification.ssn) fields.push({ fieldId: 'ID.ssn', value: data.identification.ssn, confidence: 0.9, source: 'ID Document' });
    }

    // Map address
    if (data.address) {
      const fullAddress = [data.address.street, data.address.city, data.address.state, data.address.zipCode]
        .filter(Boolean)
        .join(', ');
      if (fullAddress) fields.push({ fieldId: 'ID.address', value: fullAddress, confidence: 0.85, source: 'ID Document' });
    }

    return fields;
  }

  /**
   * Map SSN extraction to canonical field IDs
   */
  private mapSSNToFields(data: any): ExtractedField[] {
    const fields: ExtractedField[] = [];

    if (data.ssn) fields.push({ fieldId: 'SSN.number', value: data.ssn, confidence: 0.95, source: 'SSN Card' });
    if (data.name) fields.push({ fieldId: 'SSN.name', value: data.name, confidence: 0.9, source: 'SSN Card' });
    if (data.dateOfBirth) fields.push({ fieldId: 'SSN.dateOfBirth', value: data.dateOfBirth, confidence: 0.9, source: 'SSN Card' });

    return fields;
  }

  /**
   * Parse currency string to number
   * Returns { valid: true, value: number } or { valid: false, value: 0 }
   */
  private parseCurrency(value: string | number): { valid: boolean; value: number } {
    if (typeof value === 'number') {
      // Check for valid finite numbers
      if (!isNaN(value) && isFinite(value)) {
        return { valid: true, value };
      }
      return { valid: false, value: 0 };
    }
    
    // Remove currency symbols, commas, and whitespace
    const cleaned = String(value).replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    // Return invalid if not a valid number
    if (isNaN(parsed) || !isFinite(parsed)) {
      return { valid: false, value: 0 };
    }
    
    return { valid: true, value: parsed };
  }

  /**
   * Calculate overall confidence from individual fields
   */
  private calculateConfidence(fields: ExtractedField[]): number {
    if (fields.length === 0) return 0;
    
    const totalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0);
    return Math.round((totalConfidence / fields.length) * 100) / 100;
  }
}

// ============================================
// Default Export - Singleton Client
// ============================================

let defaultClient: OllamaClient | null = null;

export function getOllamaClient(config?: Partial<OllamaConfig>): OllamaClient {
  if (!defaultClient) {
    defaultClient = new OllamaClient(config);
  }
  return defaultClient;
}

export default OllamaClient;
