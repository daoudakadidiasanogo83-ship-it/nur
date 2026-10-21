"""Rappels push : abonnements stockés dans Upstash Redis (REST), envoi déclenché par un appel chaque minute."""
import calendar, json, math, os, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

GROUPS, EP, G = "nur:groups", "nur:ep", "nur:g:"
METHODS = {"MWL": (18, 17), "UOIF": (12, 12), "ISNA": (15, 15), "Egypt": (19.5, 17.5), "Karachi": (18, 18), "UmmAlQura": (18.5, "90")}
LABELS = {"fajr": "Fajr", "dhuhr": "Dhuhr", "asr": "Asr", "maghrib": "Maghrib", "isha": "Isha"}
R = math.pi / 180


def kv(*cmd):
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    tok = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not url or not tok:
        raise RuntimeError("Upstash non configuré")
    req = urllib.request.Request(url, data=json.dumps(list(cmd)).encode(),
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        out = json.load(r)
    if out.get("error"):
        raise RuntimeError(out["error"])
    return out["result"]


def gid_of(lat, lng, tz, method, asr):
    """Les abonnés d'une même zone (0,1°, soit ~11 km) partagent un groupe : 1 calcul et 1 lecture par minute pour tous."""
    return f"{lat:.1f}:{lng:.1f}:{tz}:{method}:{asr}"


def save(endpoint, p256dh, auth, lat, lng, tz, method, asr):
    gid = gid_of(lat, lng, tz, method, asr)
    old = kv("HGET", EP, endpoint)
    if old and old != gid:
        kv("HDEL", G + old, endpoint)
    if not kv("HGET", GROUPS, gid):
        kv("HSET", GROUPS, gid, json.dumps({"lat": round(lat, 1), "lng": round(lng, 1), "tz": tz, "method": method, "asr": asr, "last": []}))
    kv("HSET", G + gid, endpoint, json.dumps({"p256dh": p256dh, "auth": auth}))
    kv("HSET", EP, endpoint, gid)


def remove(endpoint):
    gid = kv("HGET", EP, endpoint)
    if gid:
        kv("HDEL", G + gid, endpoint)
    kv("HDEL", EP, endpoint)


def prayer_times(day, lat, lng, method="MWL", asr=1):
    """Même algorithme que public/static/app.js. Retourne des datetimes UTC."""
    jd = calendar.timegm((day.year, day.month, day.day, 12, 0, 0)) / 86400 + 2440587.5
    n = jd - 2451545
    g = (357.529 + 0.98560028 * n) % 360
    q = (280.459 + 0.98564736 * n) % 360
    L = (q + 1.915 * math.sin(g * R) + 0.02 * math.sin(2 * g * R)) % 360
    e = 23.439 - 3.6e-7 * n
    ra = (math.atan2(math.cos(e * R) * math.sin(L * R), math.cos(L * R)) / R / 15) % 24
    decl = math.asin(math.sin(e * R) * math.sin(L * R)) / R
    eqt = q / 15 - ra
    eqt = eqt - 24 if eqt > 12 else eqt + 24 if eqt < -12 else eqt
    noon = 12 - lng / 15 - eqt

    def T(a):
        c = (-math.sin(a * R) - math.sin(decl * R) * math.sin(lat * R)) / (math.cos(decl * R) * math.cos(lat * R))
        return math.acos(max(-1, min(1, c))) / R / 15

    fa, ia = METHODS.get(method, METHODS["MWL"])
    asr_alt = math.atan(1 / (asr + math.tan(abs(lat - decl) * R))) / R
    h = {"fajr": noon - T(fa), "dhuhr": noon, "asr": noon + T(-asr_alt), "maghrib": noon + T(0.833)}
    h["isha"] = h["maghrib"] + 1.5 if ia == "90" else noon + T(ia)
    base = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    return {k: base + timedelta(hours=v) for k, v in h.items()}


def due(now, window=150):
    """[(gid, méta, prière, clé)] : groupes dont une prière est passée depuis moins de `window` secondes. 1 seule commande."""
    flat = kv("HGETALL", GROUPS) or []
    out = []
    for gid, raw in zip(flat[::2], flat[1::2]):
        meta = json.loads(raw)
        day = now.astimezone(ZoneInfo(meta["tz"])).date()
        for name, t in prayer_times(day, meta["lat"], meta["lng"], meta["method"], meta["asr"]).items():
            key = f"{day}:{name}"
            if 0 <= (now - t).total_seconds() < window and key not in meta.get("last", []):
                out.append((gid, meta, name, key))
    return out


def send_due(now=None):
    """Retourne le nombre de notifications envoyées."""
    from pywebpush import WebPushException, webpush
    from py_vapid import Vapid
    now = now or datetime.now(timezone.utc)
    vapid = Vapid.from_pem(os.environ["VAPID_PRIVATE_PEM"].replace("\\n", "\n").encode())
    claims = {"sub": os.environ.get("VAPID_SUBJECT", "mailto:contact@example.com")}
    sent = 0
    for gid, meta, name, key in due(now):
        meta["last"] = (meta.get("last", []) + [key])[-8:]
        kv("HSET", GROUPS, gid, json.dumps(meta))          # marqué avant l'envoi : jamais de doublon
        flat = kv("HGETALL", G + gid) or []
        if not flat:
            kv("HDEL", GROUPS, gid)                        # groupe vide : nettoyage
            continue
        payload = json.dumps({"title": "NUR", "body": f"C'est l'heure de {LABELS[name]}", "tag": name})

        def one(pair):
            ep, rec = pair[0], json.loads(pair[1])
            try:
                webpush({"endpoint": ep, "keys": {"p256dh": rec["p256dh"], "auth": rec["auth"]}}, payload,
                        vapid_private_key=vapid, vapid_claims=dict(claims), ttl=300)
                return ep, "ok"
            except WebPushException as e:
                return ep, "gone" if e.response is not None and e.response.status_code in (404, 410) else "err"

        with ThreadPoolExecutor(10) as ex:
            for ep, st in ex.map(one, zip(flat[::2], flat[1::2])):
                if st == "ok":
                    sent += 1
                elif st == "gone":
                    remove(ep)
    return sent
