# Software Requirements Specification (SRS)
## Project Name: CryptGuard File Vault Core
*A Secure, Cryptographically Auditable File Storage Backend*

### 1. Introduction
#### 1.1 Purpose
The purpose of this document is to define the software requirements for the "CryptGuard File Vault Core" project. This system is a high-security backend designed to securely store, manage, and audit files using advanced cryptographic techniques. Unlike standard file storage systems, this platform guarantees data confidentiality via strong symmetric encryption, ensures data integrity via digital signatures, and enforces strict, role-based access control.

#### 1.2 Scope
The software is a headless backend API built with Node.js and PostgreSQL. The core capabilities include:
- Generating and securely managing symmetric encryption keys (Key Encryption Keys & Data Encryption Keys).
- Encrypting file streams on-the-fly during upload.
- Digitally signing uploaded files to create a provable cryptographic chain of custody.
- Enforcing Role-Based Access Control (RBAC) to restrict decryption capabilities.
- Maintaining an immutable, cryptographically verifiable audit log of all system interactions.

#### 1.3 Intended Audience
This document is intended for backend engineers, security auditors, and developers seeking to understand or extend the cryptographic architecture of the platform.

### 2. Overall Description
#### 2.1 Product Perspective
The application serves as the foundational secure storage layer for any ecosystem requiring tamper-proof data retention. It exposes RESTful APIs for client applications to interact with, while completely abstracting the complex cryptographic operations (encryption, hashing, digital signing) away from the end user.

#### 2.2 User Classes
- **Master Admin:** Has ultimate decryption privileges and can generate system-wide reports or audit logs.
- **Team Member:** Can upload documents and decrypt/download documents explicitly shared with their department.
- **Guest / Standard User:** Can upload documents into the secure vault but has zero read/decryption access.

#### 2.3 Operating Environment
- **Server:** Node.js (v18+) runtime environment.
- **Database:** PostgreSQL (v14+) for relational data and metadata storage.
- **Storage:** Local file system (initially) or AWS S3 for storing encrypted binary blobs.

### 3. System Features
#### 3.1 Secure Upload (Confidentiality)
- **Description:** Files must be encrypted immediately upon upload. The backend must not store any plain-text file data.
- **Functional Requirements:**
  - **SR-U1:** The system shall generate a unique 256-bit AES Data Encryption Key (DEK) for every uploaded file.
  - **SR-U2:** The system shall encrypt the file stream in-transit to disk using AES-256-GCM.
  - **SR-U3:** The unique DEK must be encrypted using a central Master Key Encryption Key (KEK) before being stored in the PostgreSQL database.

#### 3.2 Digital Chain of Custody (Integrity)
- **Description:** The system must cryptographically prove that a stored file has not been altered since the moment of upload.
- **Functional Requirements:**
  - **SR-I1:** The system shall calculate the SHA-256 hash of the fully encrypted file upon successful storage.
  - **SR-I2:** The system shall use an asymmetric Private Key (e.g., ECDSA or RSA-4096) to digitally sign the SHA-256 hash.
  - **SR-I3:** Both the hash and the digital signature must be stored as immutable records in the database.

#### 3.3 Authenticated Retrieval (Access Control & Decryption)
- **Description:** Only authorized personnel may retrieve the plain-text file.
- **Functional Requirements:**
  - **SR-R1:** The system shall verify the user's role before attempting decryption. Guests must be rejected.
  - **SR-R2:** Prior to decryption, the system must recalculate the SHA-256 hash of the encrypted file on disk and verify it against the stored digital signature using the Public Key. If the signature is invalid, decrytion must immediately abort.
  - **SR-R3:** The system shall decrypt the file's DEK, use it to decrypt the file stream, and securely pipe the plain-text back to the authorized client.

#### 3.4 Cryptographic Audit Logging (Non-Repudiation)
- **Description:** Every sensitive action must be logged to prevent deniability.
- **Functional Requirements:**
  - **SR-A1:** Any decryption attempt (successful or failed) must create an audit log entry detailing the User ID, File ID, Timestamp, and Outcome.
  - **SR-A2:** (Optional Phase 4) The system may embed a steganographic watermark indicating the downloader's User ID into supported file types during the decryption phase.

### 4. Database Architecture (High Level)
- **Users Table:** Stores user credentials (hashed via Argon2) and Role IDs.
- **Roles Table:** Defines permission sets for Master, Team Member, and Guest constraints.
- **Documents Table:** Stores filename, on-disk file path, the *encrypted* DEK, the SHA-256 file hash, and the ECDSA Digital Signature.
- **Audit_Logs Table:** Immutable ledger of all system activity.

### 5. Non-Functional Requirements
#### 5.1 Security constraints
- **SR-S1:** The Master Key Encryption Key (KEK) and the Server's Private Key MUST NOT be stored in the database. They must be injected securely via environment variables (`.env`).
- **SR-S2:** All passwords must be salted and hashed locally; plain-text passwords must never touch the database.

#### 5.2 Performance constraints
- **SR-P1:** The system must utilize Node.js native `crypto` streams to ensure files are encrypted/decrypted in chunks, maintaining a low memory footprint regardless of file size.
