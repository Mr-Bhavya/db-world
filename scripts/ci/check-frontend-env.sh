#!/usr/bin/env bash
#
# Verify the production frontend env has every key the app expects.
#
# WHY THIS EXISTS
#
# The frontend env reaches CI as a single secret (FRONTEND_ENV_PRODUCTION) holding
# the whole file. Add a new VITE_* var to the app and the secret does not update
# itself, so the build quietly produces a bundle with that value missing.
#
# Vite inlines `import.meta.env.VITE_X` at build time. A missing var becomes
# undefined, our `?? ''` turns it into an empty string, and everything compiles,
# deploys and serves without a single error or warning. The only symptom is a
# feature that silently does nothing.
#
# That is exactly what happened with the AdSense slot ids: seven ad units shipped
# to production as empty strings, rendering nothing, for a build that looked
# completely healthy from the outside.
#
# runtime/.env.example is tracked in git and lists every key the app reads, so it
# is the contract. This compares the secret against it and fails loudly on a gap.
#
# Only KEY PRESENCE is checked, never values. An intentionally empty value is
# fine -- an unset ad slot is how a placement is disabled -- but a key that is
# absent entirely means the secret has drifted from the code.
#
# Usage: scripts/ci/check-frontend-env.sh <env-file> <example-file>

set -euo pipefail

ENV_FILE="${1:-runtime/.env.production}"
EXAMPLE_FILE="${2:-runtime/.env.example}"

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo "::error::Contract file not found: $EXAMPLE_FILE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "::error::Env file not found: $ENV_FILE"
    exit 1
fi

keys_of() {
    # Leading VAR= on a non-comment line. Blank values are still keys.
    grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$1" | tr -d '=' | sort -u
}

missing="$(comm -23 <(keys_of "$EXAMPLE_FILE") <(keys_of "$ENV_FILE") || true)"

if [ -n "$missing" ]; then
    echo "::error::The production env is missing keys that the app reads."
    echo ""
    echo "Missing from $ENV_FILE:"
    echo "$missing" | sed 's/^/  - /'
    echo ""
    echo "The FRONTEND_ENV_PRODUCTION secret has drifted from the code."
    echo "Fix: copy db-world-config/frontend/.env.production over the secret at"
    echo "Settings > Secrets and variables > Actions > FRONTEND_ENV_PRODUCTION,"
    echo "then re-run this workflow."
    exit 1
fi

echo "Frontend env OK -- all $(keys_of "$EXAMPLE_FILE" | wc -l) expected keys present."

# Surface keys the secret has but the contract does not. Not an error (the secret
# may legitimately lead the code during a rollout), but worth seeing in the log.
extra="$(comm -13 <(keys_of "$EXAMPLE_FILE") <(keys_of "$ENV_FILE") || true)"
if [ -n "$extra" ]; then
    echo "Note: present in the secret but not in $EXAMPLE_FILE:"
    echo "$extra" | sed 's/^/  - /'
fi
