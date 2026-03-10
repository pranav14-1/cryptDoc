import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import { pipeline } from 'stream/promises';

dotenv.config();

const MASTER_KEK = Buffer.from(process.env.MASTER_KEK || '', 'hex');
const ECDSA_PRIVATE_KEY = process.env.ECDSA_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
const ECDSA_PUBLIC_KEY = process.env.ECDSA_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';

if (MASTER_KEK.length !== 32) {
    console.warn('WARNING: MASTER_KEK length is not 32 bytes. Ensure you have set a proper KEK in .env');
}

/**
 * Generates a random 256-bit (32 byte) Data Encryption Key
 */
export const generateDEK = (): Buffer => {
    return crypto.randomBytes(32);
};

/**
 * Encrypts the DEK using the Master KEK (AES-256-GCM)
 */
export const encryptDEK = (dek: Buffer): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEK, iv);

    let encryptedDek = cipher.update(dek);
    encryptedDek = Buffer.concat([encryptedDek, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: base64(iv):base64(authTag):base64(encryptedDek)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encryptedDek.toString('base64')}`;
};

/**
 * Decrypts the DEK using the Master KEK
 */
export const decryptDEK = (encryptedDekString: string): Buffer => {
    const [ivStr, authTagStr, encryptedDekStr] = encryptedDekString.split(':');

    const iv = Buffer.from(ivStr, 'base64');
    const authTag = Buffer.from(authTagStr, 'base64');
    const encryptedDek = Buffer.from(encryptedDekStr, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEK, iv);
    decipher.setAuthTag(authTag);

    let dek = decipher.update(encryptedDek);
    dek = Buffer.concat([dek, decipher.final()]);

    return dek;
};

/**
 * Generates a SHA-256 Hash and ECDSA Signature for a given file
 */
export const signFile = async (filePath: string): Promise<{ hash: string; signature: string }> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => {
            hash.update(chunk);
        });

        stream.on('end', () => {
            const fileHash = hash.digest('hex');
            const sign = crypto.createSign('SHA256');
            sign.update(fileHash);
            sign.end();
            const signature = sign.sign(ECDSA_PRIVATE_KEY, 'base64');
            resolve({ hash: fileHash, signature });
        });

        stream.on('error', (err) => reject(err));
    });
};

/**
 * Verifies the ECDSA Signature of a file hash
 */
export const verifySignature = (fileHash: string, signature: string): boolean => {
    const verify = crypto.createVerify('SHA256');
    verify.update(fileHash);
    verify.end();
    return verify.verify(ECDSA_PUBLIC_KEY, signature, 'base64');
};

/**
 * Calculates simply the SHA256 of the file (used during verification)
 */
export const calculateFileHash = async (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => {
            hash.update(chunk);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', (err) => reject(err));
    });
};
