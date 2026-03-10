# 🛡️ CryptGuard File Vault Core
**A High-Security, Cryptographically Auditable File Storage System**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CryptGuard is a professional-grade backend specialized in the **Confidentiality, Integrity, and Availability** of digital assets. It performs on-the-fly streaming encryption using AES-256-GCM and creates an immutable chain of custody using ECDSA digital signatures.

---

## 🚀 The "Security Proof" Demo
This repository features a **Vanilla JS Demo Mode** designed to prove the security of data at rest. Authenticated users can decrypt their files, while unauthorized users are served raw, encrypted binary blobs.

### **Demo Personas:**
- **👤 Pranav (Team Member):** Uploads sensitive files. Can download and decrypt his own files instantly using signature verification.
- **👤 Akshit (Team Member):** Tries to access Pranav's files. The system refuses decryption and instead serves him a raw, garbled `.txt` file containing the AES cipher-text.
- **🛡️ Saad (Master Admin):** Has global oversight. Can download and decrypt any file in the vault and view the full audit ledger.

---

## 🛠️ Tech Stack
- **Backend:** Node.js (Express), TypeScript, Multer, Crypto.
- **Database:** PostgreSQL (Relational metadata + Audit Ledger).
- **Frontend:** Vanilla HTML5, CSS3, and JavaScript (Zero dependencies).
- **Security:** AES-256-GCM (Cipher), ECDSA (Signatures), SHA-256 (Hashing), Argon2 (Passwords).

---

## ⚙️ Setup & Installation

### 1. Prerequisite
Ensure you have **PostgreSQL** running and create a database named `cryptdoc`.

### 2. Environment Configuration
Create a `.env` file in the root:
```env
PORT=3000
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=cryptdoc

# Cryptographic Master Keys
MASTER_KEK=generating...
JWT_SECRET=generating...
ECDSA_PRIVATE_KEY=generating...
ECDSA_PUBLIC_KEY=generating...
```

### 3. Install & Initialize
```bash
npm install
npm run migrate      # Create database tables
npm run dev          # Start the backend server
```

### 4. Generate Keys & Seed Demo
```bash
npx tsx scripts/generate-keys.ts   # Populates .env with secure keys
npx tsx src/db/seed-demo.ts        # Creates Pranav, Akshit, and Saad
```

---

## 🖥️ Running the Demo
1. Start the backend: `npm run dev` (Port 3000).
2. Start the demo frontend:
   ```bash
   cd demo
   python3 -m http.server 8000
   ```
3. Open **`http://localhost:8000`** in your browser.

---

## 🔒 Cryptographic Architecture

### **Confidentiality (AES-256-GCM)**
Every file is encrypted with a unique **Data Encryption Key (DEK)**. The DEK itself is never stored in plaintext; it is wrapped (encrypted) by a **Master Key Encryption Key (KEK)** before being saved to the database.

### **Integrity (ECDSA + SHA-256)**
Upon upload, the backend calculates a SHA-256 fingerprint of the encrypted file and signs it with the server's Private Key. During download, the server verifies the signature with its Public Key to ensure the file hasn't been tampered with on disk.

### **Non-Repudiation (Audit Ledger)**
Every interaction—whether a successful vaulting or a failed decryption attempt—is recorded in a permanent, auditable ledger within PostgreSQL.

---

## 📄 Documentation
For the full technical breakdown, see the [Software Requirements Specification (SRS)](/SRS.md).

---
*Created for secure-first environments.*
