#!/usr/bin/env bash
# Screenshots of the running dev server (ng serve on :4200) with demo data, phone and desktop sizes,
# light and dark. Output: screens/<name>.png. Uses the Microsoft Edge that ships with Windows.
# Headless Edge will not shrink its window to phone width, so phone shots render inside a 390px iframe.
cd "$(dirname "$0")/.."
mkdir -p screens
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
FRAME="$PWD/screens/frame.html"
cat > "$FRAME" <<'HTML'
<!doctype html><body style="margin:0"><iframe id="f" style="border:0;display:block"></iframe>
<script>const q=new URLSearchParams(location.search);const f=document.getElementById('f');
f.width=q.get('w');f.height=q.get('h');f.src='http://localhost:4200'+q.get('src');</script></body>
HTML
shoot() { # name path width height scheme(1=light,0=dark)
  local url="file:///$(cygpath -m "$FRAME")?w=$3&h=$4&src=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$2")"
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=15000 \
    --blink-settings=preferredColorScheme=$5 --window-size="$(( $3 > 500 ? $3 : 500 )),$4" \
    --screenshot="$(cygpath -w "$PWD/screens/$1.png")" "$url" 2>/dev/null
}
for route in "home:/" "quran:/quran" "stats:/stats" "awrad:/awrad"; do
  name="${route%%:*}"; path="${route#*:}"
  shoot "$name-phone" "$path?demo" 390 844 1
  shoot "$name-desktop" "$path?demo" 1440 900 1
done
shoot "home-phone-dark" "/?demo" 390 844 0
shoot "quran-phone-dark" "/quran?demo" 390 844 0
shoot "home-empty-phone" "/" 390 844 1
ls screens
