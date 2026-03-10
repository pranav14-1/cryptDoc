import { Request, Response } from 'express';
import { SecureFile } from '../services/multer.service';
import { signFile } from '../services/crypto.service';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const secureFile = req.file as unknown as SecureFile;
        const originalFilename = req.file.originalname;
        const uploaderId = req.user?.id;

        // 1. Digital Signature: Hash the encrypted file and sign it
        const { hash, signature } = await signFile(secureFile.diskPath);

        // 2. Persist Metadata in DB
        const result = await query(`
            INSERT INTO documents (
                original_filename, 
                disk_path, 
                encrypted_dek, 
                file_hash, 
                digital_signature, 
                uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id, original_filename, created_at
        `, [
            originalFilename,
            secureFile.diskPath,
            secureFile.encryptedDekString,
            hash,
            signature,
            uploaderId
        ]);

        res.status(201).json({
            message: 'Document uploaded and securely vaulted successfully',
            document: result.rows[0]
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Internal server error during upload sequence' });
    }
};

// Download Document function
import { decryptDEK, calculateFileHash, verifySignature } from '../services/crypto.service';
import fs from 'fs';
import crypto from 'crypto';

export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const documentId = req.params.id;
        const userId = req.user?.id;

        // 1. Fetch metadata
        const result = await query('SELECT * FROM documents WHERE id = $1', [documentId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        const document = result.rows[0];

        // DEMO MODE: CHECK AUTHORIZATION
        // If the user did not upload the file, and is not a Master Admin, they are UNAUTHORIZED.
        // Instead of throwing a 403, we intentionally stream down the **RAW ENCRYPTED BLOB** to prove security.
        const isAuthorized = document.uploaded_by === userId || req.user?.role === 'Master Admin';

        if (!isAuthorized) {
            // Log the unauthorized attempt
            await query('INSERT INTO audit_logs (user_id, document_id, action, status) VALUES ($1, $2, $3, $4)',
                [userId, documentId, 'DOWNLOAD_UNAUTHORIZED', 'ENCRYPTED_BLOB_STREAMED']);

            // Stream the raw, encrypted `.vault` AES blob directly from disk without decryption
            // We append .txt so the user can easily open it in a text editor to see the "gibberish"
            res.setHeader('Content-Disposition', `attachment; filename="ENCRYPTED_${document.original_filename}.txt"`);
            res.setHeader('Content-Type', 'text/plain');

            const rawStream = fs.createReadStream(document.disk_path);
            rawStream.pipe(res);
            return;
        }

        // 2. Integrity Check (For Authorized users)
        const currentHash = await calculateFileHash(document.disk_path);

        if (currentHash !== document.file_hash) {
            console.error(`INTEGRITY VIOLATION DETECTED: File hash changed for document ${documentId}`);
            // Log to Audit
            await query('INSERT INTO audit_logs (user_id, document_id, action, status) VALUES ($1, $2, $3, $4)',
                [userId, documentId, 'DOWNLOAD', 'INTEGRITY_VIOLATION']);

            res.status(500).json({ error: 'Data integrity violation. The file has been tampered with.' });
            return;
        }

        const isSignatureValid = verifySignature(currentHash, document.digital_signature);
        if (!isSignatureValid) {
            // Log to Audit
            await query('INSERT INTO audit_logs (user_id, document_id, action, status) VALUES ($1, $2, $3, $4)',
                [userId, documentId, 'DOWNLOAD', 'SIGNATURE_INVALID']);
            res.status(500).json({ error: 'Cryptographic signature verification failed.' });
            return;
        }

        // 3. Decrypt the DEK
        const dek = decryptDEK(document.encrypted_dek);

        // 4. Decrypt File Stream
        // Our custom Multer prepended the IV (12 bytes) and AuthTag (16 bytes) at the end.
        const fileSize = fs.statSync(document.disk_path).size;

        // Read IV from the first 12 bytes
        const ivBuffer = Buffer.alloc(12);
        const fd = fs.openSync(document.disk_path, 'r');
        fs.readSync(fd, ivBuffer, 0, 12, 0);

        // Read AuthTag from the last 16 bytes
        const authTagBuffer = Buffer.alloc(16);
        fs.readSync(fd, authTagBuffer, 0, 16, fileSize - 16);
        fs.closeSync(fd);

        const decipher = crypto.createDecipheriv('aes-256-gcm', dek, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        // Stream from byte 12 to (fileSize - 16)
        const readStream = fs.createReadStream(document.disk_path, {
            start: 12,
            end: fileSize - 17 // inclusive end
        });

        // 5. Log Success to Audit (Before we start streaming)
        await query('INSERT INTO audit_logs (user_id, document_id, action, status) VALUES ($1, $2, $3, $4)',
            [userId, documentId, 'DOWNLOAD', 'SUCCESS_DECRYPTED']);

        res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        readStream.pipe(decipher).pipe(res);

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ error: 'Internal server error during decryption sequence' });
    }
};

export const getUserDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // DEMO MODE: Return the entire vault to any connected user to demonstrate global state
        const result = await query(
            'SELECT id, original_filename, file_hash, uploaded_by, created_at FROM documents ORDER BY created_at DESC'
        );
        res.status(200).json({ documents: result.rows });
    } catch (error) {
        console.error('Fetch Documents Error:', error);
        res.status(500).json({ error: 'Internal server error fetching documents' });
    }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        let result;
        if (role === 'Master Admin') {
            result = await query(`
                SELECT a.id, a.action, a.status, a.created_at, u.username, d.original_filename
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN documents d ON a.document_id = d.id
                ORDER BY a.created_at DESC
            `);
        } else {
            result = await query(`
                SELECT a.id, a.action, a.status, a.created_at, u.username, d.original_filename
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN documents d ON a.document_id = d.id
                WHERE d.uploaded_by = $1 OR (a.user_id = $1 AND d.id IS NULL)
                ORDER BY a.created_at DESC
            `, [userId]);
        }
        res.status(200).json({ logs: result.rows });
    } catch (error) {
        console.error('Fetch Audit Logs Error:', error);
        res.status(500).json({ error: 'Internal server error fetching logs' });
    }
};
