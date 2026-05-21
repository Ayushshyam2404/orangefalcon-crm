/**
 * API Key middleware for the external data API.
 * Clients must send either:
 *   Header:  x-api-key: <key>
 *   Query:   ?apiKey=<key>
 *
 * Set EXTERNAL_API_KEY in .env to control access.
 */
module.exports = function apiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;

  if (!process.env.EXTERNAL_API_KEY) {
    return res.status(503).json({ error: 'External API is not configured (EXTERNAL_API_KEY not set).' });
  }

  if (!key || key !== process.env.EXTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' });
  }

  next();
};
