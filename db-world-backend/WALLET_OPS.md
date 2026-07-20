# Document Wallet — Runtime Ops Note

## `WALLET_ENCRYPTION_KEY`

The wallet feature encrypts every stored document blob at rest with AES-256-GCM
(`WalletFileCryptor`). The key is read from the `WALLET_ENCRYPTION_KEY` env var
(wired via `wallet.encryption-key` in `application.yml`, set in
`runtime/backend.env` for local/prod deployments):

```
WALLET_ENCRYPTION_KEY=<base64 of 32 random bytes>
```

Generate one with:

```bash
openssl rand -base64 32
```

- **If unset**, the key is derived from `JASYPT_PASSWORD` via PBKDF2 (dev
  convenience only) and a `WARN` is logged at startup. Do not rely on this in
  production — set a dedicated key.
- This key is intentionally **separate** from `JASYPT_PASSWORD` (used for
  encrypted config properties) and the CDN signing secret — do not reuse one
  master secret across subsystems.

> **WARNING: losing this key makes all stored wallet documents
> unrecoverable — back it up** (e.g. alongside `JWT_PRIVATE_KEY` /
> `JASYPT_PASSWORD` in your secrets vault). There is no recovery path without
> it; document blobs are encrypted, not just access-controlled.
