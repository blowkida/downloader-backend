#!/bin/bash
set -e

echo "🔧 Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
mv yt-dlp /opt/render/project/src/yt-dlp

echo "✅ yt-dlp installed at /opt/render/project/src/yt-dlp"

# Download cookies file from Google Drive
# Extract file ID from the Google Drive URL
FILE_ID="13_F3sWRws8XHFH-SQCmhBDdJNk9cP1gX"
COOKIES_FILE="youtube-cookies.txt"

echo "Downloading YouTube cookies file..."
curl -L "https://drive.google.com/uc?export=download&id=<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mrow><mi>F</mi><mi>I</mi><mi>L</mi><msub><mi>E</mi><mi>I</mi></msub><mi>D</mi></mrow><mi mathvariant="normal">&quot;</mi><mo>−</mo><mi>o</mi></mrow><annotation encoding="application/x-tex">{FILE_ID}&quot; -o </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.8444em;vertical-align:-0.15em;"></span><span class="mord"><span class="mord mathnormal" style="margin-right:0.13889em;">F</span><span class="mord mathnormal" style="margin-right:0.07847em;">I</span><span class="mord mathnormal">L</span><span class="mord"><span class="mord mathnormal" style="margin-right:0.05764em;">E</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.3283em;"><span style="top:-2.55em;margin-left:-0.0576em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mathnormal mtight" style="margin-right:0.07847em;">I</span></span></span></span><span class="vlist-s">​</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span></span><span class="mord mathnormal" style="margin-right:0.02778em;">D</span></span><span class="mord">&quot;</span><span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">−</span><span class="mspace" style="margin-right:0.2222em;"></span></span><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">o</span></span></span></span>{COOKIES_FILE}

# Set proper permissions
chmod 600 ${COOKIES_FILE}

echo "Cookies file downloaded and ready to use!"

echo "📦 Installing npm dependencies..."
npm install

echo "✅ Build script completed successfully."
