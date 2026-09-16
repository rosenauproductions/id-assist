#!/bin/bash
# Rebuild Finder-safe app that opens ID Assist in an embedded Electron window.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/ID Assist.app"
TMP_SCRIPT="$(mktemp /tmp/id-assist-launcher.XXXXXX.applescript)"
ELECTRON="$ROOT/node_modules/.bin/electron"
LOG="$ROOT/launcher/launcher.log"

if [ ! -x "$ELECTRON" ]; then
  echo "Electron is not installed. Run: npm install"
  exit 1
fi

ROOT_AS=${ROOT//\\/\\\\}
ROOT_AS=${ROOT_AS//\"/\\\"}

cat > "$TMP_SCRIPT" <<APPLESCRIPT
on run
	set projectRoot to "$ROOT_AS"
	set electronBin to projectRoot & "/node_modules/.bin/electron"
	set logFile to projectRoot & "/launcher/launcher.log"
	
	set shellCmd to "mkdir -p " & quoted form of (projectRoot & "/launcher") & " && export PATH=/usr/local/bin:/opt/homebrew/bin:\$PATH && cd " & quoted form of projectRoot & " && nohup " & quoted form of electronBin & " . >> " & quoted form of logFile & " 2>&1 &"
	
	try
		do shell script shellCmd
	on error errMsg number errNum
		display dialog "ID Assist could not start (" & errNum & "):" & return & return & errMsg buttons {"OK"} default button 1 with icon stop
	end try
end run
APPLESCRIPT

rm -rf "$APP"
osacompile -o "$APP" "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"

/usr/libexec/PlistBuddy -c "Set :CFBundleName ID Assist" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ID Assist" "$APP/Contents/Info.plist" 2>/dev/null || true

xattr -cr "$APP" 2>/dev/null || true
xattr -cr "$ROOT/Launch ID Assist.command" 2>/dev/null || true
chmod +x "$ROOT/Launch ID Assist.command"

# Refresh Desktop shortcut if present
if [ -L "$HOME/Desktop/ID Assist.app" ] || [ -e "$HOME/Desktop/ID Assist.app" ]; then
  rm -f "$HOME/Desktop/ID Assist.app"
  ln -sf "$APP" "$HOME/Desktop/ID Assist.app"
fi

echo "Created: $APP"
echo "Double-click “ID Assist.app” — it opens with a built-in browser window."
echo "Or run: npm run desktop"
