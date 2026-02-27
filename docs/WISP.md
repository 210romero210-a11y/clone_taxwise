# Written Information Security Plan (WISP) - Clone TaxWise

This WISP is a living document describing how Clone TaxWise protects taxpayer data.

Core components:

- Data classification: PII (SSN, EIN, DOB), Financial data, Non-sensitive.
- Access controls: principle of least privilege; RBAC for staff; MFA required for preparers.
- Encryption: AES-256 for PII at rest; TLS 1.2+ for in-transit.
- Audit logging: immutable audit table recording return edits, file uploads, and exports.
- Incident response: predefined contacts, breach notification timeline, and recovery steps.

Checklist (minimum):

1. Inventory systems storing PII
2. Ensure MFA is enforced on all preparer accounts
3. Ensure database backups are encrypted
4. Maintain an audit trail for all changes (insert/patch/delete)
5. Periodic review of user access and least-privilege enforcement
6. Data retention & secure deletion policies

For formal compliance with IRS Publication 1345 consult the official IRS guidance and maintain records of:
- Policies and procedures
- Annual risk assessments
- Personnel training logs

This file is an operational artifact and not a legal substitute — consult counsel for audited compliance.
