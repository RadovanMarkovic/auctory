# Roadmap

## Certificates & digital passport (done)

- [x] Migration: `blockchain_certificates` table, immutability guard, RLS/grants, auction-insert certificate check
- [x] `certificate-metadata` storage bucket (write-once) + public read route
- [x] Canonical manifest + keccak256 hashing helpers (`productRef`, image hashes, `serialNumberHash`)
- [x] Server-only chain module (ABI copy, preflight, mint, reconcile)
- [x] Server functions: registerCertificate, refreshCertificateOwner, verifyCertificateIntegrity
- [x] Seller "Register certificate" UI + auction eligibility gating
- [x] Digital passport UI + EN/SR strings
- [x] Tests, app build, blockchain tests

Not in scope yet: certificate transfer to the winning buyer after a completed sale.
