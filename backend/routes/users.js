// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const signatureUpload = require('../middleware/userSignatureUpload');

router.get('/me/signature', authenticateToken, userController.getMySignature);
router.post('/me/signature', authenticateToken, signatureUpload.single('signature'), userController.uploadMySignature);
router.delete('/me/signature', authenticateToken, userController.deleteMySignature);

router.get('/:id/signature', authenticateToken, authorizeRoles('Admin'), userController.adminGetUserSignature);
router.post('/:id/signature', authenticateToken, authorizeRoles('Admin'), signatureUpload.single('signature'), userController.adminUploadUserSignature);
router.delete('/:id/signature', authenticateToken, authorizeRoles('Admin'), userController.adminDeleteUserSignature);

router.get('/', userController.getAll);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/role', userController.updateRole);

module.exports = router;
