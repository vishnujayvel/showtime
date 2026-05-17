#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Installs Node dependencies so vitest, eslint, and (when the network policy
# allows it) the Playwright/Electron E2E suite can run in a fresh container.
# Skipped on local runs — developers manage their own env there.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "==> Installing Node dependencies..."
# Skip the package's postinstall first — electron-builder install-app-deps
# fetches Electron headers from electronjs.org, which most network policies
# block. We try a best-effort rebuild against Electron afterwards.
npm install --no-audit --no-fund --ignore-scripts

echo "==> Rebuilding better-sqlite3 for system Node (vitest)..."
if npm rebuild better-sqlite3 --silent; then
  echo "    better-sqlite3 rebuilt successfully."
else
  rc=$?
  echo "    ⚠ better-sqlite3 rebuild failed (exit $rc); vitest may fail for sqlite-backed tests. Try: npm rebuild better-sqlite3" >&2
fi

echo "==> Attempting Electron native rebuild (needed for E2E tests)..."
if npm run postinstall --silent; then
  echo "    Electron native modules rebuilt successfully."

  # `npm install --ignore-scripts` above skipped the `electron` package's own
  # postinstall, which downloads the Electron binary into
  # node_modules/electron/dist. Without that binary, `_electron.launch()` in
  # Playwright fails with "Electron failed to install correctly". Trigger it
  # explicitly here (idempotent — the installer no-ops if dist/ already exists).
  if [ ! -x node_modules/electron/dist/electron ]; then
    echo "==> Downloading Electron binary..."
    if node node_modules/electron/install.js; then
      echo "    Electron binary downloaded."
    else
      echo "    ⚠ Electron binary download failed; Playwright E2E tests will not run." >&2
    fi
  fi
else
  cat <<'EOF'
    ⚠ Electron native rebuild skipped (network policy likely blocks
      electronjs.org — node-gyp can't fetch Electron headers). Vitest and
      ESLint will still work. To unlock Playwright/Electron E2E tests, widen
      the environment's network policy to allow electronjs.org, then re-run:
        npm run postinstall
EOF
fi

# Showtime is a macOS product, but its Electron binary runs on Linux under
# Xvfb (xvfb-run is preinstalled in the container). Persist DISPLAY so
# Playwright's _electron.launch() inherits a working X display when the
# agent wraps test commands with `xvfb-run -a`.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  grep -qxF "export DISPLAY=:99" "$CLAUDE_ENV_FILE" 2>/dev/null \
    || echo "export DISPLAY=:99" >> "$CLAUDE_ENV_FILE"
fi

echo "==> Setup complete."
