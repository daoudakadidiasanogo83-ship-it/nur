"""Génère les clés VAPID (une seule fois). Copier les 2 lignes dans les variables d'environnement Render."""
import base64
from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid

v = Vapid(); v.generate_keys()
pub = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print("VAPID_PUBLIC=" + base64.urlsafe_b64encode(pub).rstrip(b"=").decode())
print("VAPID_PRIVATE_PEM=" + v.private_pem().decode().strip().replace("\n", "\\n"))
