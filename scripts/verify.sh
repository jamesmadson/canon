#!/usr/bin/env bash
# One command before saying anything is done: tests, build and the standing
# rules. Prints about ten lines. Full logs go to a temp folder it names.
#   scripts/verify.sh
set -u
cd "$(dirname "$0")/.."
LOGS="$(mktemp -d "${TMPDIR:-/tmp}/canon-verify.XXXXXX")"
BASE="${VERIFY_BASE:-npm-package}"
fail=0
line() { printf '%-5s %-10s %s\n' "$1" "$2" "$3"; }
step() { # name, summary command, the command to run
  local name="$1" summary="$2"; shift 2
  if "$@" >"$LOGS/$name.log" 2>&1; then line ok "$name" "$(eval "$summary")"; else line FAIL "$name" "see $LOGS/$name.log"; fail=1; fi
}

step tests "grep -E '^ +Tests ' '$LOGS/tests.log' | sed 's/^ *Tests *//'" npx vitest run
step build "echo 'site and app built'" npm run build

# No runtime dependencies in the package.
deps="$(node -e "console.log(Object.keys(require('./cli/package.json').dependencies ?? {}).length)")"
if [ "$deps" = "0" ]; then line ok deps "cli has no runtime dependencies"; else line FAIL deps "cli has $deps runtime dependencies"; fail=1; fi

# The package imports Node built-ins and its own files only.
foreign="$(grep -rhoE "from '[^']+'" cli/src/mcp cli/bin | grep -vE "from '(node:|\.)" | sort -u | tr '\n' ' ')"
if [ -z "$foreign" ]; then line ok imports "cli imports only node: and its own files"; else line FAIL imports "$foreign"; fail=1; fi

# No em or en dashes in files this branch changed.
DASH="$(printf '\342\200\224|\342\200\223')"
changed="$(git diff --name-only --diff-filter=AM "$BASE"... -- . ':!package-lock.json' 2>/dev/null; git ls-files --others --exclude-standard)"
dashes="$(printf '%s\n' "$changed" | sort -u | while read -r f; do [ -f "$f" ] && grep -lE "$DASH" "$f"; done | tr '\n' ' ')"
if [ -z "$dashes" ]; then line ok dashes "no em or en dashes in changed files"; else line FAIL dashes "$dashes"; fail=1; fi

# No tool attribution on this branch's commits.
attributed="$(git log "$BASE"..HEAD --format=%B | grep -ciE 'co-authored-by|generated with' || true)"
if [ "$attributed" = "0" ]; then line ok commits "no attribution lines since $BASE"; else line FAIL commits "$attributed attribution lines since $BASE"; fail=1; fi

if [ "$fail" = "0" ]; then echo "ALL PASSED"; else echo "FAILED"; fi
exit "$fail"
