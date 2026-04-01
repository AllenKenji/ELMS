// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAll);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/role', userController.updateRole);

module.exports = router;
