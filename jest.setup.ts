import '@testing-library/jest-dom';

// Polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

if (typeof crypto === 'undefined') {
  // @ts-ignore
  global.crypto = require('crypto').webcrypto;
}
