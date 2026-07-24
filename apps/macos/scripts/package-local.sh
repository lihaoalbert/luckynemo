#!/bin/bash
# Local packaging: build release, assemble dist/LuckyNemo.app, sign, create DMG.
# Usage: macos/scripts/package-local.sh [identity]
#   identity defaults to "LuckyNemo Local Dev"; pass "-" for ad-hoc.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # macos/
REPO="$(cd "$ROOT/.." && pwd)"                   # repo root
BUILD="$ROOT/.build/release"
DIST="$ROOT/dist"
APP="$DIST/LuckyNemo.app"
IDENTITY="${1:-LuckyNemo Local Dev}"
TOOLCHAIN="${TOOLCHAIN:-org.swift.624202602241a}"

# Prefer the toolchain's swift directly: xcrun refuses to run when the Xcode
# license has not been accepted, while the standalone toolchain works fine.
SWIFT_BIN="${SWIFT_BIN:-$HOME/Library/Developer/Toolchains/$TOOLCHAIN.xctoolchain/usr/bin/swift}"
# swift build shells out to `xcrun --show-sdk-path`, which is also gated by the
# Xcode license check; point SDKROOT at the SDK directly to bypass it.
export SDKROOT="${SDKROOT:-$(xcode-select -p)/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk}"
echo "==> swift build -c release ($SWIFT_BIN)"
(cd "$ROOT" && "$SWIFT_BIN" build -c release --product LuckyNemo)

echo "==> assemble $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"

cp "$BUILD/LuckyNemo" "$APP/Contents/MacOS/LuckyNemo"
cp -R "$BUILD/LuckyNemo_LuckyNemo.bundle/" "$APP/Contents/Resources/"
cp "$ROOT/Sources/LuckyNemo/Resources/Localizable.xcstrings" "$APP/Contents/Resources/" 2>/dev/null || true
cp "$ROOT/Sources/LuckyNemo/Resources/Info.plist" "$APP/Contents/Info.plist"

# Frameworks: Sparkle + bundled Swift runtime (same set as previous bundle).
rm -rf "$APP/Contents/Frameworks/Sparkle.framework"
cp -R "$BUILD/Sparkle.framework" "$APP/Contents/Frameworks/"
TCLIB=""
for base in "$HOME/Library/Developer/Toolchains" "/Library/Developer/Toolchains"; do
    cand="$base/$TOOLCHAIN.xctoolchain/usr/lib"
    [ -d "$cand/swift/macosx" ] && TCLIB="$cand" && break
done
if [ -n "$TCLIB" ]; then
    for lib in libswiftCompatibilitySpan libswiftCore libswiftDistributed libswiftObservation \
               libswiftRegexBuilder libswiftRemoteMirror libswiftRuntime libswiftSwiftOnoneSupport \
               libswiftSynchronization libswift_Builtin_float libswift_Concurrency \
               libswift_Differentiation libswift_RegexParser libswift_StringProcessing libswift_Volatile; do
        for dir in "$TCLIB/swift-6.2/macosx" "$TCLIB/swift/macosx"; do
            if [ -f "$dir/$lib.dylib" ]; then cp "$dir/$lib.dylib" "$APP/Contents/Frameworks/"; break; fi
        done
    done
fi

# Point @rpath at the bundled Frameworks; drop the absolute toolchain rpath.
install_name_tool -add_rpath @executable_path/../Frameworks "$APP/Contents/MacOS/LuckyNemo" 2>/dev/null || true
while read -r rp; do
    case "$rp" in *Toolchains*) install_name_tool -delete_rpath "$rp" "$APP/Contents/MacOS/LuckyNemo" || true ;; esac
done < <(otool -l "$APP/Contents/MacOS/LuckyNemo" | awk '/LC_RPATH/{f=1} f&&/path /{print $2; f=0}')

# Stamp build metadata.
COMMIT="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
/usr/libexec/PlistBuddy -c "Set :LuckyNemoGitCommit $COMMIT" "$APP/Contents/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :LuckyNemoGitCommit string $COMMIT" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :LuckyNemoBuildTimestamp $NOW" "$APP/Contents/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :LuckyNemoBuildTimestamp string $NOW" "$APP/Contents/Info.plist"

echo "==> sign ($IDENTITY)"
ENT="$DIST/entitlements.plist"
cat > "$ENT" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
EOF

sign() { codesign --force --options runtime --timestamp=none --entitlements "$ENT" --sign "$IDENTITY" "$1"; }

# Inside-out: Sparkle helpers, framework, swift dylibs, then the app.
SPARKLE="$APP/Contents/Frameworks/Sparkle.framework/Versions/B"
[ -d "$SPARKLE" ] && find "$SPARKLE/XPCServices" -name '*.xpc' -maxdepth 1 2>/dev/null | while read -r x; do sign "$x"; done
[ -d "$SPARKLE/Updater.app" ] && sign "$SPARKLE/Updater.app"
[ -f "$SPARKLE/Autoupdate" ] && sign "$SPARKLE/Autoupdate"
[ -d "$SPARKLE" ] && sign "$APP/Contents/Frameworks/Sparkle.framework"
for d in "$APP/Contents/Frameworks/"*.dylib; do [ -e "$d" ] && sign "$d"; done
sign "$APP"

echo "==> verify"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "==> DMG"
DMG="$DIST/LuckyNemo.dmg"
STAGE="$DIST/dmg-stage"
rm -rf "$STAGE" "$DMG"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname LuckyNemo -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

echo "==> done"
echo "App: $APP"
echo "DMG: $DMG"
