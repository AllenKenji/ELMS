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

  combined.forEach((originValue) => {
    const origin = String(originValue || '').trim().replace(/\/+$/, '');
    if (!origin) {
      return;
    }

    let url = null;
    try {
      url = new URL(origin);
    } catch {
      return;
    }

    const variants = [origin];
    const hostname = String(url.hostname || '').trim();
    const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

    // Support common production host variants such as www/non-www.
    if (hostname && hostname !== 'localhost' && !isIpAddress) {
      const alternateHostname = hostname.startsWith('www.')
        ? hostname.slice(4)
        : `www.${hostname}`;

      if (alternateHostname && alternateHostname !== hostname) {
        variants.push(`${url.protocol}//${alternateHostname}${url.port ? `:${url.port}` : ''}`);
      }
    }

    variants.forEach((candidate) => {
      if (!candidate || seen.has(candidate)) {
        return;
      }

      seen.add(candidate);
      origins.push(candidate);
    });
  });

  return origins;
}

module.exports = { buildAllowedOrigins };
