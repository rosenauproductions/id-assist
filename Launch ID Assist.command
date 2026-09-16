#!/bin/bash
# Double-click in Finder — launches ID Assist in its own embedded browser window.

cd "$(dirname "$0")" || {
  osascript -e 'display dialog "Could not find the ID Assist folder." buttons {"OK"} default button 1 with icon stop'
  exit 1
}

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if [ ! -x "node_modules/.bin/electron" ]; then
  echo "Installing Electron (first run)…"
  npm install
fi

echo "Starting ID Assist desktop app…"
exec node_modules/.bin/electron .
