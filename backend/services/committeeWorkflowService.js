// committeeWorkflowService.js
const CommitteeWorkflow = require('../models/CommitteeWorkflow');

const createWorkflow = async (data) => {
  return CommitteeWorkflow.create(data);
};

const getWorkflowsForItem = async (item_type, item_id) => {
  return CommitteeWorkflow.findAll({ where: { item_type, item_id } });
};

const updateWorkflowStatus = async (id, status, remarks) => {
  return CommitteeWorkflow.update(
    { status, remarks, last_action_date: new Date() },
    { where: { id } }
  );
};

const getCommitteeWorkflows = async (committee_id) => {
  return CommitteeWorkflow.findAll({ where: { committee_id } });
};

module.exports = {
  createWorkflow,
  getWorkflowsForItem,
  updateWorkflowStatus,
  getCommitteeWorkflows,
};
