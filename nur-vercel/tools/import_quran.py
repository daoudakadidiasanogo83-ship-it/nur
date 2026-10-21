"""Importe les 114 sourates (arabe + français) dans data/quran.json.
Nécessite Internet. Lancer UNE fois : python tools/import_quran.py
Sources : api.alquran.cloud (texte uthmani + traduction fr.hamidullah).
VÉRIFIE le résultat (6236 versets) avant toute publication."""
import json, urllib.request
from pathlib import Path

def get(ed):
    with urllib.request.urlopen(f"https://api.alquran.cloud/v1/quran/{ed}", timeout=60) as r:
        return json.load(r)["data"]["surahs"]

ar, fr = get("quran-uthmani"), get("fr.hamidullah")
out = []
for a, f in zip(ar, fr):
    assert a["number"] == f["number"] and len(a["ayahs"]) == len(f["ayahs"])
    out.append({"n": a["number"], "ar": a["name"], "fr": f["englishName"],
                "verses": [{"ar": x["text"], "fr": y["text"]} for x, y in zip(a["ayahs"], f["ayahs"])]})
total = sum(len(s["verses"]) for s in out)
assert len(out) == 114 and total == 6236, (len(out), total)
(Path(__file__).parent.parent / "public" / "data" / "quran.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
print("OK :", len(out), "sourates,", total, "versets")
