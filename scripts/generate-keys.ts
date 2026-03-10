import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const envPath = path.join(__dirname, '../.env');

const generateKeys = () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const masterKek = crypto.randomBytes(32).toString('hex');
    const jwtSecret = crypto.randomBytes(32).toString('hex');

    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // Replace or add env variables
    const updateEnv = (key: string, value: string) => {
        // Escape newlines for .env
        const escapedValue = value.replace(/\n/g, '\\n');
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${escapedValue}`);
        } else {
            envContent += `\n${key}=${escapedValue}`;
        }
    };

    updateEnv('MASTER_KEK', masterKek);
    updateEnv('JWT_SECRET', jwtSecret);
    updateEnv('ECDSA_PRIVATE_KEY', privateKey);
    updateEnv('ECDSA_PUBLIC_KEY', publicKey);

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('✅ Cryptographic keys successfully generated and updated in .env');
};

generateKeys();
