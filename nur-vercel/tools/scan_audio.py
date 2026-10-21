"""Déclare un récitateur dans data/audio.json et vérifie quelles sourates sont jouables.

Les MP3 sont sur ton stockage https externe, nommés 001.mp3 ... 114.mp3 :
  python tools/scan_audio.py --id fahd-1 --name "Nom" --base https://stockage.exemple.com/fahd-1/
Autres récitateurs du CDN Islamic Network (à vérifier, tous n'ont pas l'audio par sourate) :
  python tools/scan_audio.py --id husary --name "Al-Husary" --nopad --base https://cdn.islamic.network/quran/audio-surah/128/ar.husary/ \
    --source https://alquran.cloud/cdn --licence "Islamic Network : redistribution gratuite non commerciale"
Source libre vérifiée : Complexe du Roi Fahd, https://qurancomplex.gov.sa/en/?p=3979 (usage libre dans applis et sites).
Pour une autre source, passer --source et --licence avec le texte exact de la licence."""
import argparse, json, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--nopad", action="store_true", help="fichiers 1.mp3 au lieu de 001.mp3")
ap.add_argument("--id", required=True); ap.add_argument("--name", required=True); ap.add_argument("--base", required=True)
ap.add_argument("--source", default="https://qurancomplex.gov.sa/en/?p=3979")
ap.add_argument("--licence", default="Usage libre dans applications et sites web (Complexe du Roi Fahd)")
a = ap.parse_args()
root = Path(__file__).parent.parent

assert a.base.startswith("https://") and a.base.endswith("/"), "base : https://.../ (avec / final)"
def ok(n):
    try:
        return n if urllib.request.urlopen(urllib.request.Request(f"{a.base}{n if a.nopad else format(n, '03d')}.mp3", method="HEAD"), timeout=15).status == 200 else None
    except Exception:
        return None
with ThreadPoolExecutor(12) as ex:
    avail = [n for n in ex.map(ok, range(1, 115)) if n]
base = a.base

f = root / "public" / "data" / "audio.json"
items = [x for x in json.loads(f.read_text("utf-8")) if x["id"] != a.id]
items.append({"id": a.id, "name": a.name, "base": base, **({"pad": False} if a.nopad else {}), "source": a.source, "licence": a.licence, "available": avail})
f.write_text(json.dumps(items, ensure_ascii=False, indent=1), "utf-8")
print(f"{a.name} : {len(avail)}/114 sourates jouables")
