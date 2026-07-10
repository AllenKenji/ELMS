const templateService = require('../services/templateService');
const ocrService = require('../services/ocrService');

exports.getTemplates = async (req, res) => {
  try {
    const templates = await templateService.getTemplates({
      measureType: req.params.measureType,
      userId: req.user.id,
      favoritesOnly: String(req.query.favoritesOnly || '').toLowerCase() === 'true',
      historyOnly: String(req.query.historyOnly || '').toLowerCase() === 'true',
      limit: req.query.limit,
    });

    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching templates' });
  }
};

exports.markTemplateUsed = async (req, res) => {
  try {
    const result = await templateService.markUsed({
      measureType: req.params.measureType,
      measureId: req.params.id,
      userId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    console.error('Mark template used error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Error updating template usage' });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const result = await templateService.toggleFavorite({
      measureType: req.params.measureType,
      measureId: req.params.id,
      userId: req.user.id,
      isFavorite: req.body?.is_favorite,
    });
    res.json(result);
  } catch (err) {
    console.error('Toggle template favorite error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Error updating template favorite' });
  }
};

exports.scanTemplateDocument = async (req, res) => {
  try {
    const result = await ocrService.scanDocument(req.file, req.params.measureType);
    res.json(result);
  } catch (err) {
    console.error('Scan template document error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Error scanning document' });
  }
};
