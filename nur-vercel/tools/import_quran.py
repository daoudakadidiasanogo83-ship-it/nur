"""Importe les 114 sourates (arabe + français + phonétique) dans public/data/quran.json.
Nécessite Internet. Lancer UNE fois : python tools/import_quran.py
Sources : api.alquran.cloud (texte uthmani, traduction fr.hamidullah, édition de translittération).
VÉRIFIE le résultat (6236 versets) avant toute publication. Le fichier importé est prioritaire dans l'application."""
import json, urllib.request
from pathlib import Path

API = "https://api.alquran.cloud/v1"

def load(path):
    with urllib.request.urlopen(f"{API}/{path}", timeout=60) as r:
        return json.load(r)["data"]

def get(ed):
    return load(f"quran/{ed}")["surahs"]

try:
    ph_id = load("edition?type=transliteration&language=en")[0]["identifier"]
except Exception:
    ph_id = "en.transliteration"
print("édition de phonétique :", ph_id)
ar, fr, ph = get("quran-uthmani"), get("fr.hamidullah"), get(ph_id)
out = []
for a, f, p in zip(ar, fr, ph):
    assert a["number"] == f["number"] == p["number"] and len(a["ayahs"]) == len(f["ayahs"]) == len(p["ayahs"])
    out.append({"n": a["number"], "ar": a["name"], "fr": f["englishName"],
                "verses": [{"ar": x["text"], "fr": y["text"], "ph": z["text"].strip()} for x, y, z in zip(a["ayahs"], f["ayahs"], p["ayahs"])]})
total = sum(len(s["verses"]) for s in out)
assert len(out) == 114 and total == 6236, (len(out), total)
(Path(__file__).parent.parent / "public" / "data" / "quran.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
print("OK :", len(out), "sourates,", total, "versets")
