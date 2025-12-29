/**
 * Input Validation Utilities
 *
 * Provides validation functions to ensure secure input handling across the application.
 * Prevents NaN injection, invalid account names, and malformed data.
 */

/**
 * Validates a WAX account name
 * Rules: 1-12 characters, lowercase a-z, digits 1-5, and dots only
 * Must not start or end with a dot
 *
 * @param {string} account - Account name to validate
 * @returns {boolean} - True if valid
 */
function isValidWaxAccount(account) {
  if (typeof account !== 'string') return false;

  // WAX account rules
  const accountRegex = /^[a-z1-5.]{1,12}$/;

  // Check format
  if (!accountRegex.test(account)) return false;

  // Cannot start or end with dot
  if (account.startsWith('.') || account.endsWith('.')) return false;

  // Cannot have consecutive dots
  if (account.includes('..')) return false;

  return true;
}

/**
 * Validates and parses an integer, ensuring it's a valid positive number
 *
 * @param {any} value - Value to validate and parse
 * @param {object} options - Validation options
 * @param {number} options.min - Minimum allowed value (default: 0)
 * @param {number} options.max - Maximum allowed value (default: Number.MAX_SAFE_INTEGER)
 * @param {boolean} options.allowZero - Whether to allow zero (default: false)
 * @returns {number|null} - Parsed integer or null if invalid
 */
function validateInteger(value, options = {}) {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    allowZero = false
  } = options;

  // Try to parse as integer
  const parsed = parseInt(value, 10);

  // Check if valid number
  if (isNaN(parsed)) return null;
  if (!Number.isFinite(parsed)) return null;

  // Check range
  if (!allowZero && parsed === 0) return null;
  if (parsed < min) return null;
  if (parsed > max) return null;

  return parsed;
}

/**
 * Validates a template ID (must be positive integer)
 *
 * @param {any} templateId - Template ID to validate
 * @returns {number|null} - Parsed template ID or null if invalid
 */
function validateTemplateId(templateId) {
  return validateInteger(templateId, { min: 1, max: 999999999 });
}

/**
 * Validates cooldown hours (must be positive integer, reasonable range)
 *
 * @param {any} hours - Cooldown hours to validate
 * @returns {number|null} - Parsed hours or null if invalid
 */
function validateCooldownHours(hours) {
  return validateInteger(hours, { min: 1, max: 8760, allowZero: true }); // Max 1 year
}

/**
 * Validates a string field with length constraints
 *
 * @param {any} value - Value to validate
 * @param {object} options - Validation options
 * @param {number} options.minLength - Minimum length (default: 0)
 * @param {number} options.maxLength - Maximum length (default: 1000)
 * @param {boolean} options.required - Whether field is required (default: false)
 * @param {RegExp} options.pattern - Optional regex pattern to match
 * @returns {string|null} - Validated string or null if invalid
 */
function validateString(value, options = {}) {
  const {
    minLength = 0,
    maxLength = 1000,
    required = false,
    pattern = null
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return required ? null : '';
  }

  // Convert to string
  const str = String(value).trim();

  // Check required
  if (required && str.length === 0) return null;

  // Check length
  if (str.length < minLength) return null;
  if (str.length > maxLength) return null;

  // Check pattern
  if (pattern && !pattern.test(str)) return null;

  return str;
}

/**
 * Validates a hex color code
 *
 * @param {string} color - Color code to validate
 * @returns {string|null} - Validated color or null if invalid
 */
function validateHexColor(color) {
  if (typeof color !== 'string') return null;

  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(color)) return null;

  return color.toLowerCase();
}

/**
 * Validates a URL
 *
 * @param {string} url - URL to validate
 * @param {object} options - Validation options
 * @param {string[]} options.protocols - Allowed protocols (default: ['http:', 'https:'])
 * @returns {string|null} - Validated URL or null if invalid
 */
function validateUrl(url, options = {}) {
  const { protocols = ['http:', 'https:'] } = options;

  if (typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    // Check protocol
    if (!protocols.includes(parsed.protocol)) return null;

    return url;
  } catch (error) {
    return null;
  }
}

/**
 * Validates IPFS hash (CID)
 *
 * @param {string} hash - IPFS hash to validate
 * @returns {string|null} - Validated hash or null if invalid
 */
function validateIpfsHash(hash) {
  if (typeof hash !== 'string') return null;

  // IPFS CIDv0 (46 chars starting with Qm) or CIDv1 (variable length)
  const cidV0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const cidV1Regex = /^[a-z2-7]{59}$/;

  if (cidV0Regex.test(hash) || cidV1Regex.test(hash)) {
    return hash;
  }

  return null;
}

/**
 * Validates a boolean value
 *
 * @param {any} value - Value to validate as boolean
 * @returns {boolean} - Parsed boolean
 */
function validateBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return false; // Default to false for invalid values
}

/**
 * Sanitizes HTML to prevent XSS attacks
 *
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  isValidWaxAccount,
  validateInteger,
  validateTemplateId,
  validateCooldownHours,
  validateString,
  validateHexColor,
  validateUrl,
  validateIpfsHash,
  validateBoolean,
  sanitizeHtml
};
