# Fault Log Collection

Fault logs can contain crash, freeze, resource-limit, and system diagnostic
records. Location and visibility depend on device image, API level, privilege,
and vendor configuration.

1. Discover fault-log locations through supported device commands.
2. Copy only relevant files for the requested time window when timestamps exist.
3. Record paths and copy failures in the manifest.
4. Do not assume an empty result means the application was healthy.
5. Redact copied text before sharing.

When `/data/log/faultlog` is not readable, use supported read-only commands such
as `hidumper -e --print <package> -n 5` or `hidumper -e --list -n 20`. If
available, collect `devecocli log --crash` as supplemental evidence. Route
signatures to the specialized crash/freeze/memory analysis workflow; this skill
does not diagnose them.
