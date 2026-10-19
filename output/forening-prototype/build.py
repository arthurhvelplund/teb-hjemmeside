"""Package the buildless prototype as one portable HTML file."""
from pathlib import Path
import base64
import json
import sys

root = Path(__file__).resolve().parent
inline = "--inline-source" in sys.argv
assets = {}
for file in (root / "assets").iterdir():
    mime = "image/png" if file.suffix == ".png" else "image/webp"
    assets[file.name] = (
        str(file) if inline else
        "data:" + mime + ";base64," + base64.b64encode(file.read_bytes()).decode()
    )

html = (root / "index.html").read_text()
css = (root / "style.css").read_text()
app = (root / "app.js").read_text()
app = app.replace(
    "'teb-forening-klikprototype-v1'",
    "'teb-forening-klikprototype-" + ("inline" if inline else "standalone") + "-v1'",
)
app = app.replace("'assets/'+imageMap[a.key]", "PACKAGED_ASSETS[imageMap[a.key]]")
for name, value in assets.items():
    html = html.replace('"assets/' + name + '"', '"' + value + '"')
    app = app.replace("'assets/" + name + "'", json.dumps(value))
html = html.replace('<link rel="stylesheet" href="style.css">', "<style>" + css + "</style>")
html = html.replace(
    '<script src="catalogue.js"></script>',
    "<script>" + (root / "catalogue.js").read_text() + "</script>",
)
html = html.replace(
    '<script src="app.js"></script>',
    "<script>const PACKAGED_ASSETS=" + json.dumps(assets) + ";\n" + app + "</script>",
)
target = root / ("inline-preview.html" if inline else "prototype.html")
target.write_text(html)
print(target)
