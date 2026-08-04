function buildAllowedOrigins(rawOrigins = '') {
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://0.0.0.0:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://0.0.0.0:5000',
  ];

  const fromEnv = String(rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const combined = [...defaults, ...fromEnv];
  const seen = new Set();
  const origins = [];

  combined.forEach((origin) => {
    if (!origin || seen.has(origin)) {
      return;
    }

    seen.add(origin);
    origins.push(origin);
  });

  return origins;
}

module.exports = { buildAllowedOrigins };
