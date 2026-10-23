"""NUR sur Vercel : le contenu est statique (public/), Flask ne gère que les rappels push."""
import hashlib, hmac, json, os, re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import available_timezones
from flask import Flask, abort, render_template, request, send_from_directory
import push

BASE = Path(__file__).parent
app = Flask(__name__, static_folder=None)


@app.get("/")
def index():
    return render_template("index.html")


if not os.environ.get("VERCEL"):  # en local seulement : Vercel sert public/ lui-même
    @app.get("/<path:p>")
    def local_public(p):
        return send_from_directory(BASE / "public", p)


@app.get("/api/push/key")
def push_key():
    return {"key": os.environ.get("VAPID_PUBLIC", "")}


@app.post("/api/push/subscribe")
def push_subscribe():
    j = request.get_json(silent=True) or {}
    sub = j.get("sub") or {}
    k = sub.get("keys") or {}
    try:
        lat, lng, asr = float(j["lat"]), float(j["lng"]), int(j.get("asr", 1))
        adj = [int(x) for x in j.get("adj", [0] * 5)]
        fixed = [str(x) for x in j.get("fixed", [""] * 5)]
        ok = (str(sub.get("endpoint", "")).startswith("https://") and k.get("p256dh") and k.get("auth")
              and -90 <= lat <= 90 and -180 <= lng <= 180 and asr in (1, 2)
              and len(adj) == 5 and all(-120 <= x <= 120 for x in adj) and len(fixed) == 5 and all(re.fullmatch(r"|([01]\d|2[0-3]):[0-5]\d", f) for f in fixed) and j.get("method") in push.METHODS and j.get("tz") in available_timezones())
    except (KeyError, TypeError, ValueError):
        ok = False
    if not ok:
        abort(400)
    try:
        push.save(sub["endpoint"], k["p256dh"], k["auth"], lat, lng, j["tz"], j["method"], asr, adj, fixed)
    except Exception:
        abort(503)
    return {"ok": True}


@app.post("/api/push/unsubscribe")
def push_unsubscribe():
    try:
        push.remove(str((request.get_json(silent=True) or {}).get("endpoint", "")))
    except Exception:
        abort(503)
    return {"ok": True}


@app.route("/api/cron/push", methods=["GET", "POST"])
def push_task():
    """À appeler chaque minute avec l'en-tête Authorization: Bearer CRON_TOKEN (ou ?token=)."""
    exp = os.environ.get("CRON_TOKEN", "")
    given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip() or request.args.get("token", "")
    if not exp or not hmac.compare_digest(exp, given):
        abort(404)
    return {"sent": push.send_due(datetime.now(timezone.utc))}


@app.post("/api/suggest")
def suggest():
    """Suggestions des utilisateurs, stockées dans Upstash (liste de 500 messages maximum)."""
    j = request.get_json(silent=True) or {}
    t = str(j.get("t", "")).strip()
    if j.get("website"):          # champ piège pour les robots
        return {"ok": True}
    if not 5 <= len(t) <= 600:
        abort(400)
    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.remote_addr or "?")
    ip = hashlib.sha256(ip.encode()).hexdigest()[:16]
    try:
        first = push.kv("SET", "nur:rl:" + ip, "1", "EX", "60", "NX")
        if first:
            push.kv("LPUSH", "nur:suggestions", json.dumps({"t": t, "c": str(j.get("c", ""))[:60], "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, ensure_ascii=False))
            push.kv("LTRIM", "nur:suggestions", 0, 499)
    except Exception:
        abort(503)
    if not first:
        abort(429)
    return {"ok": True}


@app.get("/api/suggestions")
def suggestions():
    """Lecture par le propriétaire : /api/suggestions?token=ADMIN_TOKEN (ou en-tête Authorization: Bearer)."""
    exp = os.environ.get("ADMIN_TOKEN", "")
    given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip() or request.args.get("token", "")
    if not exp or not hmac.compare_digest(exp, given):
        abort(404)
    try:
        rows = push.kv("LRANGE", "nur:suggestions", 0, 199) or []
    except Exception:
        abort(503)
    return {"suggestions": [json.loads(x) for x in rows]}


if __name__ == "__main__":
    app.run(debug=True)
