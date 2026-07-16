// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const signatureUpload = require('../middleware/userSignatureUpload');
const photoUpload = require('../middleware/profilePhotoUpload');

router.get('/me/signature', authenticateToken, userController.getMySignature);
router.get('/me/signature/preview', authenticateToken, userController.getMySignaturePreview);
router.post('/me/signature', authenticateToken, signatureUpload.single('signature'), userController.uploadMySignature);
router.delete('/me/signature', authenticateToken, userController.deleteMySignature);

router.get('/me/photo', authenticateToken, userController.getMyProfilePhoto);
router.get('/me/photo/preview', authenticateToken, userController.getMyProfilePhotoPreview);
router.post('/me/photo', authenticateToken, photoUpload.single('photo'), userController.uploadMyProfilePhoto);
router.delete('/me/photo', authenticateToken, userController.deleteMyProfilePhoto);

router.get('/:id/signature', authenticateToken, authorizeRoles('Admin'), userController.adminGetUserSignature);
router.get('/:id/signature/preview', authenticateToken, authorizeRoles('Admin'), userController.adminGetUserSignaturePreview);
router.post('/:id/signature', authenticateToken, authorizeRoles('Admin'), signatureUpload.single('signature'), userController.adminUploadUserSignature);
router.delete('/:id/signature', authenticateToken, authorizeRoles('Admin'), userController.adminDeleteUserSignature);

router.get('/:id/photo/preview', authenticateToken, authorizeRoles('Admin'), userController.adminGetUserProfilePhotoPreview);
router.post('/:id/photo', authenticateToken, authorizeRoles('Admin'), photoUpload.single('photo'), userController.adminUploadUserProfilePhoto);
router.delete('/:id/photo', authenticateToken, authorizeRoles('Admin'), userController.adminDeleteUserProfilePhoto);

router.get('/', userController.getAll);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/role', userController.updateRole);

module.exports = router;
