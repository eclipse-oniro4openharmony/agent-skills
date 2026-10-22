# Log Redaction Policy

Collected logs are sensitive. Redaction reduces accidental exposure but does
not guarantee that a bundle is safe to publish.

The redactor masks likely bearer/basic credentials, cookies, email addresses,
phone numbers, IPv4 addresses, user paths, and common assignments such as
`token=`, `password=`, and `secret=`.

Review filenames, manifest values, binary files, application/account IDs, URLs
with query secrets, and device serials separately. Never upload the original
unredacted directory. If redaction fails or is uncertain, mark the bundle unsafe
to share and retain/delete the original according to incident policy.
