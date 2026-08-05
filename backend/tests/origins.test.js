const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAllowedOrigins } = require('../utils/origins');

test('buildAllowedOrigins preserves explicit origins and adds common local dev origins', () => {
  const origins = buildAllowedOrigins('https://example.test');

  assert.ok(origins.includes('https://example.test'));
  assert.ok(origins.includes('http://localhost:5173'));
  assert.ok(origins.includes('http://127.0.0.1:5173'));
  assert.ok(origins.includes('http://localhost:3000'));
  assert.ok(origins.includes('http://127.0.0.1:3000'));
});

test('buildAllowedOrigins removes duplicates and keeps a stable order', () => {
  const origins = buildAllowedOrigins('http://localhost:5173, http://localhost:5173, https://app.example.test');

  assert.deepEqual(origins, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://0.0.0.0:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://0.0.0.0:5000',
    'https://app.example.test',
    'https://www.app.example.test',
  ]);
});
