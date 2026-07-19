#!/usr/bin/env bash
# Render the /screenshot-demo/ app mockups → public/images/product/*.jpg for the
# how-it-works product tour. Serve dist/ (or public/) first, then run this.
# Usage: python3 -m http.server 8899 --directory dist &  then  bash scripts/shoot-product-screens.sh
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="${1:-http://localhost:8899}"
mkdir -p /tmp/shots public/images/product
for d in consent visitors integrations dashboard; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.5 \
    --window-size=1440,900 --virtual-time-budget=2500 \
    --screenshot="/tmp/shots/$d.png" "$BASE/screenshot-demo/$d.html"
done
python3 - <<'PY'
from PIL import Image; import glob, os
for p in glob.glob("/tmp/shots/*.png"):
    im=Image.open(p).convert("RGB"); w=1280; h=int(im.height*w/im.width)
    im.resize((w,h), Image.LANCZOS).save(f"public/images/product/{os.path.basename(p)[:-4]}.jpg","JPEG",quality=82,optimize=True)
print("wrote public/images/product/*.jpg")
PY
