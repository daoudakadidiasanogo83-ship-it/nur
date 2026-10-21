"""Télécharge GSAP 3.12.5 dans static/vendor/ (une fois, avec Internet) pour que NUR l'utilise hors connexion."""
import urllib.request
from pathlib import Path

URL = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
dest = Path(__file__).parent.parent / "public" / "static" / "vendor" / "gsap.min.js"
data = urllib.request.urlopen(URL, timeout=60).read()
assert len(data) > 50_000 and b"GreenSock" in data[:400], "fichier inattendu"
dest.write_bytes(data)
print("OK :", dest, len(data) // 1024, "Ko")
