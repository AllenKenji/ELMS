// committeeWorkflowController.js
const service = require('../services/committeeWorkflowService');

exports.createWorkflow = async (req, res) => {
  try {
    const workflow = await service.createWorkflow(req.body);
    res.status(201).json(workflow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getWorkflowsForItem = async (req, res) => {
  try {
    const { item_type, item_id } = req.params;
    const workflows = await service.getWorkflowsForItem(item_type, item_id);
    res.json(workflows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateWorkflowStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    await service.updateWorkflowStatus(id, status, remarks);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getCommitteeWorkflows = async (req, res) => {
  try {
    const { committee_id } = req.params;
    const workflows = await service.getCommitteeWorkflows(committee_id);
    res.json(workflows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
