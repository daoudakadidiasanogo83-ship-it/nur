# NUR - version Vercel (sans base de données propre)
Contenu statique dans `public/` (servi par le CDN Vercel). Flask ne gère que les rappels push.
Abonnements aux rappels : Upstash Redis. Aucun fichier audio sur le serveur.

## Avant de publier
1. `python tools/import_quran.py` : charge les 114 sourates dans `public/data/quran.json` (Internet requis). Faire relire le texte.
2. `python tools/fetch_gsap.py` (facultatif) : GSAP en local pour le hors connexion. Sinon cdnjs, ou aucune animation.
3. Audio, trois voies (aucun MP3 sur ton serveur) :
   - **En ligne (par défaut)** : Mishary Alafasy, lu depuis le CDN ouvert d'Al Quran Cloud / Islamic Network (https://alquran.cloud/cdn). Le son marche dès que l'appareil est connecté. Conditions publiées : redistribution gratuite non commerciale. **Si tu ajoutes de la publicité ou un abonnement payant plus tard, relis https://alquran.cloud/terms-and-conditions** : les droits restent aux récitateurs, qui peuvent demander un retrait.
   - **Hors connexion** : bouton ⬇ sur une sourate (garde le fichier sur l'appareil), si le serveur autorise la copie.
   - **Mes fichiers** : l'utilisateur ajoute ses MP3 (001.mp3 ... 114.mp3), gardés sur son appareil.
   Autres récitateurs : `python tools/scan_audio.py` (voir l'en-tête du script) teste chaque fichier avant de les proposer.
4. Logo : `public/static/icon.svg` (croissant et lumière). Pour régénérer les PNG, reprendre l'export 192 et 512 px.

## Déployer
1. Pousser le dossier sur GitHub, l'importer dans Vercel (Flask détecté automatiquement via `app.py`).
2. Vercel > Storage / Marketplace : ajouter **Upstash Redis** au projet (les variables de connexion sont ajoutées seules).
3. `pip install pywebpush` puis `python tools/gen_vapid.py` : ajouter dans Vercel > Environment Variables
   `VAPID_PUBLIC`, `VAPID_PRIVATE_PEM`, `VAPID_SUBJECT` (ex. mailto:toi@email.com) et `CRON_TOKEN` (texte secret long). Redéployer.
4. Le cron Vercel gratuit (Hobby) ne tourne qu'une fois par jour. Créer sur **cron-job.org** (gratuit) une tâche **chaque minute** :
   `https://TON-APP.vercel.app/api/cron/push` avec l'en-tête `Authorization: Bearer <CRON_TOKEN>`.
   Si Vercel bloque l'appel (Deployment Protection), utiliser le domaine de production.
5. iPhone : c'est une règle d'Apple, impossible à contourner : les rappels exigent NUR installée sur l'écran d'accueil (iOS 16.4 minimum). NUR affiche un bandeau d'aide (Partager > Sur l'écran d'accueil) et refuse d'activer les rappels tant qu'elle n'est pas installée.

## Quotas Upstash (vérifiés sur upstash.com/pricing/redis)
Plan gratuit : 256 Mo de données, 500 000 commandes par mois, 10 Go de transfert par mois, une base gratuite.
Les abonnés sont regroupés par zone de 0,1° (~11 km) : le cron lit un seul petit enregistrement par minute (~43 200 commandes/mois, estimation) puis ne lit que les groupes concernés. Le plan gratuit suffit donc largement au départ ; surveiller le tableau de bord Upstash après le lancement.
Précision des rappels : jusqu'à environ 15 secondes d'écart avec l'heure affichée (regroupement par zone).

## Local
    pip install -r requirements.txt
    python app.py     # http://127.0.0.1:5000 (rappels : variables Upstash et VAPID requises)

## Dons
Texte dans `templates/index.html` (section « Soutenir NUR »), à adapter à ta voix. Les moyens de don sont dans `public/data/don.json` :
    {"methods":[{"label":"Orange Money","value":"+223 00 00 00 00"},{"label":"Lien de don","value":"","url":"https://..."}],
     "transparence":"Chaque trimestre, nous publierons ici le total reçu et son usage."}
Avec `url` (https) : bouton « Donner ». Sans `url` : bouton « Copier » le numéro. Ne promets dans le texte que ce que tu tiendras (part pour les démunis, compte rendu).
Collecter des fonds pour des personnes dans le besoin peut demander un cadre légal (association) selon ton pays : renseigne-toi avant le lancement.
