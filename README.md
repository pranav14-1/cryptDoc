# CryptGuard File Vault Core
A high-security Node.js backend for cryptographically storing, verifying, and tracking sensitive documents using PostgreSQL. 

This project demonstrates the practical implementation of Confidentiality, Integrity, Authentication, and Non-Repudiation in a modern web service.

## Core Architecture Overview
This backend does not rely on third-party cloud storage encryption. Instead, it securely encrypts documents locally in-flight before they are saved to disk. It uses strong Cryptography at every stage of the file's lifecycle.

The system relies on a **Node.js (Express/NestJS)** API and a **PostgreSQL** database. The database never stores raw files; it stores the cryptographic keys and metadata necessary to manage the encrypted blobs.

---

## The Cryptographic Lifecycle

### Phase 1: Authentication (Argon2 / bcrypt)
Before any file operations can occur, users must authenticate. 
*   **The Technique:** We use a Key Derivation Function (KDF) like **Argon2** (or bcrypt) to hash user passwords before storing them in PostgreSQL. 
*   **Why?** Cryptographically hashing with a random "salt" prevents attackers from guessing passwords using precomputed rainbow tables, even if the database is leaked.

### Phase 2: File Upload & Confidentiality (AES-256-GCM)
When an authorized user uploads a file, it must be protected from unauthorized reading.
*   **The Technique:** **Symmetric Encryption (AES-GCM)**. 
*   **How it works:** 
    1. The server generates a unique, 256-bit random string (the **DEK** - Data Encryption Key).
    2. Using Node's native `crypto.createCipheriv()`, the uploaded file stream is encrypted chunk-by-chunk using AES-256 in Galois/Counter Mode (GCM).
    3. The encrypted file is saved to the disk.
*   **Key Protection (The KEK):** We cannot store the DEK in plain text in the database! We use a master **Key Encryption Key (KEK)** stored in the `.env` file to encrypt the unique DEK before saving it to PostgreSQL.

### Phase 3: Integrity & Tamper-Proofing (SHA-256 & ECDSA)
We must mathematically prove the file has not been altered since it was uploaded.
*   **The Technique:** **Cryptographic Hashing** and **Digital Signatures**.
*   **How it works:**
    1. After the file is fully encrypted and saved, the server calculates its **SHA-256 Hash** (producing a unique 64-character fingerprint of the encrypted file).
    2. The server possesses a master Private/Public Key pair (using **ECDSA** - Elliptic Curve Digital Signature Algorithm).
    3. The server uses its Private Key to "sign" the SHA-256 hash. 
    4. This Digital Signature is stored within PostgreSQL.

### Phase 4: Secure Download & Verification
When a user requests to download a file, the system must authenticate them and verify the file's integrity before decryption.
*   **How it works:**
    1. **RBAC Check:** The database checks the user's `role_id`. If they are a "Guest", the request is immediately rejected (HTTP 403).
    2. **Integrity Check:** The server recalculates the SHA-256 hash of the encrypted file sitting on the hard drive. It uses its **Public Key** to verify the Digital Signature in the database against this newly calculated hash. If they don't match, the file has been tampered with (HTTP 500/Alert).
    3. **Decryption:** If verified, the server fetches the encrypted DEK from the database, decrypts it using the `.env` KEK, and then streams the file back through `crypto.createDecipheriv()` to the authorized user.

### Phase 5: Tracking & Non-Repudiation (Steganography - Optional)
To track leaks, we must know exactly who downloaded the file last.
*   **The Technique:** **Cryptographic Watermarking / Steganography**.
*   **How it works:** Before serving the decrypted file (e.g., a PDF) to the user, the server takes their User ID and a timestamp, encrypts that payload with a secondary AES key, and injects the encrypted payload into the PDF metadata or as hidden text. If the file leaks online, the admin can extract and decrypt the watermark to find the leaker.

---

## Starting Fresh

If you are building this from scratch, here is your implementation roadmap:

1.  **Initialize Project:** `npm init -y` and install Express, PostgreSQL driver (`pg`), and `multer` (for file uploads).
2.  **Database Design:** Set up your PostgreSQL tables: `users`, `roles`, `documents` (storing `encrypted_dek`, `file_hash`, `signature`), and `audit_logs`.
3.  **Authentication Layer:** Build the Argon2 login flow and JWT/Session generation.
4.  **Encryption Pipeline:** Build an `/upload` endpoint that completely implements the AES-256-GCM streaming logic.
5.  **Signature Pipeline:** Add the SHA-256 hashing and ECDSA signing logic immediately after the upload finishes.
6.  **Decryption Pipeline:** Build the `/download` endpoint that verifies the signature, performs RBAC checks, decrypts the DEK, and streams the decrypted file to the user.
7.  **(Optional) Watermarking Pipeline:** Implement PDF manipulation to inject encrypted user tracking metadata upon download.

## Requirements
* Node.js v18+
* PostgreSQL v14+