import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generateDEK, encryptDEK } from './crypto.service';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface SecureFile extends Express.Multer.File {
    dek: Buffer;
    encryptedDekString: string;
    diskPath: string;
    iv: Buffer;
}

const secureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate random filename to prevent collisions and info disclosure
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '.enc');
    }
});

// We're going to intercept the stream using a custom storage approach
class CryptoStorageEngine implements multer.StorageEngine {
    private destination: string;

    constructor(opts: { destination: string }) {
        this.destination = opts.destination;
        if (!fs.existsSync(this.destination)) {
            fs.mkdirSync(this.destination, { recursive: true });
        }
    }

    _handleFile(
        req: any,
        file: Express.Multer.File,
        cb: (error?: any, info?: Partial<SecureFile>) => void
    ): void {
        const filename = Date.now() + '-' + crypto.randomUUID() + '.enc';
        const finalPath = path.join(this.destination, filename);

        // 1. Generate DEK
        const dek = generateDEK();
        const encryptedDekString = encryptDEK(dek);

        // 2. Setup AES-256-GCM stream
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

        const outStream = fs.createWriteStream(finalPath);

        // 3. Pipe the incoming file stream through the cipher, then to disk

        // We must prepend the IV to the file so we can reconstruct the decipher later, 
        // OR just save the IV in the DB. Saving in DB is slightly cleaner or we prepend IV and AuthTag.
        // For simplicity, let's prepend the IV (12 bytes) to the file blob.
        outStream.write(iv);

        // We must wait for the stream to finish to get the AuthTag
        file.stream.pipe(cipher).pipe(outStream, { end: false });

        file.stream.on('error', (err) => cb(err));
        cipher.on('error', (err) => cb(err));

        cipher.on('end', () => {
            // Append AuthTag (16 bytes) at the very end of the file
            const authTag = cipher.getAuthTag();
            outStream.end(authTag);
        });

        outStream.on('finish', () => {
            cb(null, {
                dek,
                encryptedDekString,
                diskPath: finalPath,
                iv,
            });
        });

        outStream.on('error', (err) => cb(err));
    }

    _removeFile(
        req: any,
        file: Express.Multer.File & { diskPath?: string },
        cb: (error: Error | null) => void
    ): void {
        const filePath = file.diskPath;
        if (filePath) {
            fs.unlink(filePath, cb);
        } else {
            cb(null);
        }
    }
}

export const secureUpload = multer({
    storage: new CryptoStorageEngine({ destination: UPLOAD_DIR })
});
