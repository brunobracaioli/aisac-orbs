# Security policy

## Supported versions

Only the current `main` branch and the latest reviewed release are supported
for security fixes. This project is pre-release and does not yet promise a
stable release support window.

## Disclosure channel status

GitHub private vulnerability reporting is the intended private disclosure
channel, but the repository setting was observed disabled on 2026-09-14. It
is therefore **pending activation** and must not be described as an active
submission channel until a maintainer enables it and records the setting in
`docs/reference/branch-protection.md`.

Until activation, do not publish vulnerability details in an issue. Contact
the maintainer through a private channel already provided to you, or request
one without including exploit details. Never include credentials, tokens,
private user data, or provider payloads in a report.

## Scope

Please report vulnerabilities in the SVG parser, provider gateway, event and
approval boundaries, environment handling, security headers, CI workflows,
dependency supply chain, or browser bundle.

The credential-free mock playground, intentionally fake provider data, and
visual differences that do not expose data or privilege are outside the
security report scope.

## Response process

Maintainers will acknowledge a private report, reproduce it with a minimal
fixture, assess impact, and coordinate a fix and disclosure timeline. The
target coordinated disclosure window is 90 days when circumstances allow.

Do not claim that a local test, a merged pull request, or a successful CodeQL
analysis proves that the hosted repository settings or production deployment
are secure. Those are separate G0 evidence items.
