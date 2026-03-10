import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3000/api';
const TIMEOUT = 5000;

const testFileContent = crypto.randomBytes(1024 * 1024); // 1MB random file
const testFilePath = path.join(__dirname, 'test-upload.bin');
const downloadFilePath = path.join(__dirname, 'test-download.bin');

const username = `testuser_${Date.now()}`;
const password = 'securepassword123';
let token = '';
let documentId = '';

const runTests = async () => {
    try {
        console.log('--- Starting Integration Lifecycle Tests ---');

        // 1. Setup - Create Test File
        fs.writeFileSync(testFilePath, testFileContent);
        const originalHash = crypto.createHash('sha256').update(fs.readFileSync(testFilePath)).digest('hex');
        console.log(`[+] Created test file (1MB). SHA-256: ${originalHash}`);

        // Wait a small moment to ensure server is running
        await new Promise(r => setTimeout(r, 1000));

        // 2. Register User (Team Member to allow upload/download)
        console.log('\n[+] Registering User...');
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            username,
            password,
            role_name: 'Team Member'
        });
        console.log(`User created with ID: ${regRes.data.user.id}`);

        // 3. Login
        console.log('\n[+] Logging In...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, { username, password });
        token = loginRes.data.token;
        console.log(`Received JWT Token: ${token.substring(0, 20)}...`);

        // 4. Upload File
        console.log('\n[+] Uploading File (AES-GCM Encryption & ECDSA Signature)...');
        const form = new FormData();
        form.append('file', fs.createReadStream(testFilePath));

        const uploadRes = await axios.post(`${BASE_URL}/documents/upload`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });
        documentId = uploadRes.data.document.id;
        console.log(`File Uploaded and Vaulted! Document ID: ${documentId}`);

        // 5. Download File
        console.log('\n[+] Downloading File (Signature Verification & AES-GCM Decryption)...');
        const downloadRes = await axios.get(`${BASE_URL}/documents/${documentId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(downloadFilePath);
        downloadRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.log(`File Downloaded and saved.`);

        // 6. Verify Correctness
        const downloadedHash = crypto.createHash('sha256').update(fs.readFileSync(downloadFilePath)).digest('hex');
        console.log(`[+] Original Hash:   ${originalHash}`);
        console.log(`[+] Downloaded Hash: ${downloadedHash}`);

        if (originalHash === downloadedHash) {
            console.log('\n✅ SUCCESS: The encrypted file was successfully stored, cryptographically verified, and cleanly decrypted without data loss!');
        } else {
            console.error('\n❌ FAILURE: The hashes do not match. Decryption or streaming failed.');
            process.exit(1);
        }

    } catch (error: any) {
        console.error('\n❌ TEST FAILED');
        if (error.response) {
            console.error('API Error:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    } finally {
        // Cleanup phase
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
        if (fs.existsSync(downloadFilePath)) fs.unlinkSync(downloadFilePath);
        console.log('--- Tests Finished and Cleaned Up ---');
    }
};

runTests();
