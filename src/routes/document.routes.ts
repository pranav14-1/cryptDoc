import { Router } from 'express';
import { uploadDocument, downloadDocument, getUserDocuments, getAuditLogs } from '../controllers/document.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { secureUpload } from '../services/multer.service';

const router = Router();

// POST /documents/upload
// Only allowed for 'Team Member' and 'Master Admin' (or 'Guest' if SRS specifies Guests can upload)
// Let's allow Guests, Team Members, and Admins to upload based on SRS "SR-R1: Guests must be rejected" (for decryption only)
router.post(
    '/upload',
    authenticateToken,
    secureUpload.single('file'),
    uploadDocument as any // as any to quiet TS complaining about async handler
);

// GET /documents/:id/download
// Guests explicitly denied
router.get(
    '/:id/download',
    authenticateToken,
    requireRole(['Team Member', 'Master Admin']),
    downloadDocument as any
);

// GET /documents
router.get('/', authenticateToken, getUserDocuments as any);

// GET /documents/audit
router.get('/audit', authenticateToken, getAuditLogs as any);

export default router;
