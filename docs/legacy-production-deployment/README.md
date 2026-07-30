# Legacy production deployment snapshot

These files preserve the two production-Docker commits that already existed on
`origin/develop` when the certified iframe-only pilot branch was merged.

They are reference inputs only. They are intentionally outside the active
deployment path and are excluded from runtime images. Do not execute or promote
them without a separately reviewed production-release plan that regenerates
the production runtime config, parent-origin policy, immutable image reference,
rollback metadata, and release evidence.
