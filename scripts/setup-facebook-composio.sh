#!/bin/sh
set -eu

TEB_REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 or newer, then run this script again.' >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Node.js 24 or newer is required."); process.exit(1); }'

if [ -n "${TEB_COMPOSIO_CLI:-}" ]; then
  TEB_COMPOSIO_BIN=$TEB_COMPOSIO_CLI
elif command -v composio >/dev/null 2>&1; then
  TEB_COMPOSIO_BIN=$(command -v composio)
elif [ -x "$HOME/.local/bin/composio" ]; then
  TEB_COMPOSIO_BIN="$HOME/.local/bin/composio"
else
  TEB_INSTALL_FILE=$(mktemp -t teb-composio-install)
  trap 'rm -f "$TEB_INSTALL_FILE"' EXIT HUP INT TERM
  curl --fail --silent --show-error --location --retry 3 https://composio.dev/install -o "$TEB_INSTALL_FILE"
  COMPOSIO_INSTALL_PLUGINS=0 COMPOSIO_INSTALL_SHELL=none COMPOSIO_INSTALL_HELP=0 sh "$TEB_INSTALL_FILE"
  rm -f "$TEB_INSTALL_FILE"
  trap - EXIT HUP INT TERM
  TEB_COMPOSIO_BIN="$HOME/.local/bin/composio"
fi

export COMPOSIO_CLI_TELEMETRY_DISABLED=1
if ! "$TEB_COMPOSIO_BIN" whoami >/dev/null 2>&1; then
  "$TEB_COMPOSIO_BIN" login --no-skill-install --yes
fi
"$TEB_COMPOSIO_BIN" whoami

TEB_ACTIVE_ACCOUNTS=$(
  "$TEB_COMPOSIO_BIN" connections list --toolkit facebook |
  node -e 'let data=""; process.stdin.on("data", chunk => data += chunk); process.stdin.on("end", () => { const rows = JSON.parse(data).facebook || []; console.log(rows.filter(row => row.status === "ACTIVE").length); });'
)
if [ "$TEB_ACTIVE_ACCOUNTS" -eq 0 ]; then
  "$TEB_COMPOSIO_BIN" link facebook
fi

TEB_COMPOSIO_CLI="$TEB_COMPOSIO_BIN" node "$TEB_REPO_ROOT/scripts/facebook-composio.mjs" setup "$@"
echo 'Setup complete. From the repository, collect data and build both reports with:'
echo 'node scripts/facebook-composio.mjs pull'
