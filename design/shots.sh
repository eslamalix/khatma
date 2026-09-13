#!/usr/bin/env bash
# Regenerates preview pages and PNG screenshots of every artboard (needs the preview server on :4321 and Microsoft Edge).
cd "$(dirname "$0")"
node -e "const fs=require('fs');for(const f of fs.readdirSync('.').filter(f=>f.endsWith('.dc.html'))){fs.writeFileSync('preview/'+f.replace('.dc.html','.html'),fs.readFileSync(f,'utf8').replace('<script src=\"./support.js\"></script>','').replace(/<\/?x-dc>/g,'').replace(/<\/?helmet>/g,''))}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
for f in *.dc.html; do
  p="${f%.dc.html}"; size=390,844; [[ $p == Web* ]] && size=1440,900
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=4000 --window-size=$size --screenshot="$(cygpath -w "$PWD/shots/$p.png")" "http://localhost:4321/$p.html" 2>/dev/null
done
