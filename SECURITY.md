# Security Policy

## Supported Versions

Security updates (if any) are applied to the `main` branch only. No long‑term maintenance branches are currently supported.

## Reporting a Vulnerability

If you discover a security vulnerability:
1. **Do not** open a public GitHub Issue with exploit details.
2. Instead, create a private security advisory via the GitHub repository Security tab **or** email the maintainer (add your preferred contact email here).
3. Provide a clear description, reproduction steps, affected version/commit, and impact assessment.
4. Please allow a reasonable disclosure window (e.g. 30–60 days) for investigation and remediation before public disclosure.

## Scope

In scope:
- Code in this repository (`manifest.json`, all source under `background/`, `content/`, `options/`, `popup/`, `src/`).
- Handling of API keys, OCR image region submission, translation text submission.

Out of scope:
- Issues caused by misconfiguration of third‑party Azure or Google services.
- Rate limit or quota exhaustion behaviors from external APIs.
- User‑supplied API key compromise outside the browser environment.

## Handling of API Keys

API keys are stored in `chrome.storage.sync` by default (synchronized across signed‑in browser instances). For higher security you may fork and migrate to `chrome.storage.local` or a proxy token design.

## Best Practices for Users
- Restrict Azure / Google keys to least privileges and consider usage quotas.
- Revoke or rotate keys if you suspect compromise.
- Avoid OCR on sensitive personal, regulated, or confidential data.

## Planned Improvements
- Optional local-only storage mode for keys.
- User toggle to disable last-result persistence.
- Lightweight rate limiting / backoff warnings.

## Disclosure Attribution
Contributors who responsibly disclose security issues may be acknowledged in the project README (opt‑in, if desired).
