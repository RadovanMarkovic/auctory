# Roadmap

## Certificates & digital passport (in progress)

- [ ] Migration: `blockchain_certificates` table, immutability guard, RLS/grants, auction-insert certificate check
- [ ] Public `certificate-metadata` storage bucket (write-once, public read)
- [ ] Canonical manifest + keccak256 hashing helpers (`productRef`, image hashes, `serialNumberHash`)
- [ ] Server-only chain module (ABI copy, preflight, mint, reconcile)
- [ ] Server functions: registerCertificate, refreshCertificateOwner, verifyCertificateIntegrity
- [ ] Seller "Register certificate" UI + auction eligibility gating
- [ ] Digital passport UI + EN/SR strings
- [ ] Tests, app build, blockchain tests
