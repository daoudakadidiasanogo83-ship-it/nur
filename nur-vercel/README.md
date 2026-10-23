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

## Coran : les 114 sourates
Les 114 noms sont intégrés (aucun texte n'est embarqué dans le ZIP). Le texte d'une sourate se charge à la première ouverture depuis Al Quran Cloud (api.alquran.cloud, texte uthmani + traduction Hamidullah), puis reste disponible sans connexion sur l'appareil. Pour avoir tout le texte dans l'application sans dépendre de ce service : `python tools/import_quran.py` (le fichier importé est prioritaire). Dans les deux cas, fais relire le texte avant la publication.

## Heures de la mosquée et ajustements
Paramètres > « Heures de ma mosquée » : heure fixe par prière (ex. Dhuhr 14:00, Asr 16:00), qui remplace l'heure calculée dans l'application et dans les rappels. Par défaut, les nouveaux utilisateurs de **Bamako** reçoivent Dhuhr 14:00 et Asr 16:00 (voir `LOCAL_DEFAULTS` dans `public/static/app.js` pour modifier ou retirer). « Ajuster les horaires » : décalage en minutes (de -120 à +120) pour les prières laissées en calcul.

## Livraison
Toujours décompresser `nur-vercel.zip` entièrement avant de lancer ou de publier. Le lien d'aperçu bloque l'écoute en ligne et le téléchargement (restriction de l'hébergeur de l'aperçu) : tester l'audio sur le site déployé.

## Logo
Basé sur l'image du dôme vert fournie, recadrée, agrandie, nettoyée (netteté, bords propres) : `public/static/logo.png` (fond transparent, utilisé en haut de l'accueil) et `public/static/icon-192.png` / `icon-512.png` (icône de l'application : dôme sur dégradé violet avec halo, dans la zone sûre des icônes rondes). Les versions grand format sont fournies à part (`logo-nur.png`, `icon-nur.png`). Pour changer l'image, remplacer ces fichiers.

## Tasbih, Qibla, invocations
- Tasbih : 5 dhikr au choix (couleurs propres), anneau de progression, messages d'encouragement, effet à chaque cycle, vibration et son discret en option, compteurs du jour, cycles et jours de suite (conservés sur l'appareil).
- Qibla : cadran qui tourne avec le téléphone, Kaaba repérée sur le cadran, distance en km, signal vert et vibration quand on fait face à la Qibla. Sans capteur : direction depuis le nord.
- Invocations : afficher ou masquer arabe, phonétique et traduction ; bouton 🔊 de lecture par la voix de synthèse arabe de l'appareil (si installée). Ce n'est pas une récitation humaine : la prononciation peut être imparfaite.

## Invocations (20)
Catégories : matin, soir, sommeil, repas, sorties, prière, quotidien, favoris. Fichier : `public/data/invocations.json` (champs : id, cat, t = titre, ar, ph = phonétique, fr = traduction, src = source). Les textes, la phonétique et les attributions de sources ont été saisis sans relecture savante : **à faire relire par une personne qualifiée avant publication**. Pour en ajouter, copier une entrée et changer l'id.

## Installation de l'application (toujours visible)
Bouton « ⬇ Installer » en haut de chaque page, et carte « Installer NUR sur votre appareil » sur l'accueil (onglets iPhone / Android / Ordinateur, l'appareil détecté est présélectionné, bouton « Installer maintenant » quand le navigateur le permet). Un message prévient quand NUR est ouverte dans le navigateur intégré de TikTok, Facebook ou Instagram, qui ne permet pas l'installation. Pour que l'installation soit proposée : site en https (Vercel), `manifest.webmanifest` et `sw.js` accessibles. La tuile « Audio » est sur le tableau de bord (accueil).

## Dons (facultatifs)
Tuile « ♥ Soutenir NUR » permanente sur l'accueil et page dédiée. Un rappel discret apparaît à partir de la 3e visite, au plus tous les 10 jours, avec « Faire un don » et « Pas maintenant » : il ne bloque jamais l'utilisation. Le don n'est pas obligatoire et ne doit pas le devenir : la source audio d'Islamic Network n'autorise la redistribution que gratuite et non commerciale. Bouton « Partager NUR avec un proche » sur la page de don (partage natif du téléphone, sinon copie du lien).

## Audio : directement depuis le CDN (aucun stockage, aucun relais)
- **Rien n'est stocké sur ton site et rien ne passe par ton compte Vercel :** le téléphone lit et télécharge les sourates directement depuis le CDN d'Al Quran Cloud / Islamic Network (`https://cdn.islamic.network/...`). Ton quota Vercel n'est donc pas consommé par l'audio.
- **Lecteur** (visible sur toutes les pages) : lecture/pause, précédent/suivant, ±10 s, barre de progression, répétition (non / cette sourate / tout), vitesse (0,75× à 1,5×), minuteur d'arrêt, bouton Enregistrer. Commandes de l'écran verrouillé, des notifications et des écouteurs Bluetooth.
- **Téléchargement ⬇ :** le téléphone récupère le fichier depuis le CDN. Si le navigateur le bloque (le CDN doit autoriser la copie par une page web), un lien « Ouvrir le fichier » apparaît (menu ⋮ ou Partager > Enregistrer).
- **Enregistrement automatique (désactivé par défaut) :** à activer dans Paramètres, par chaque utilisateur. Une sourate écoutée est alors copiée dans SON téléphone (jamais sur ton site), limitée à 100 Mo, 300 Mo ou 1 Go. Il utilise des données mobiles en plus de l'écoute.
- **Où vont les fichiers ?** Une application web ne peut pas écrire dans le dossier Musique : les téléchargements vont dans Téléchargements / Fichiers, d'où VLC ou un lecteur de musique peuvent les ouvrir.

## 99 Noms d'Allah
Page « 99 Noms d'Allah » (recherche par nom, sens ou numéro) : `public/data/noms.json`. Liste la plus répandue, qui varie légèrement selon les sources. **À faire relire par une personne qualifiée.**

## Suggestions des utilisateurs
Page « Une idée pour NUR ? » : les messages (600 caractères, anonymes, 1 par minute et par appareil) sont stockés dans Upstash. Lecture par le propriétaire : `https://TON-SITE/api/suggestions?token=ADMIN_TOKEN` (ajouter la variable `ADMIN_TOKEN` dans Vercel). Sans Upstash, l'envoi échoue proprement.

## Numéro de don
Le numéro n'est plus affiché : bouton « Donner » (ouvre le numéro dans le téléphone, `tel:`) et bouton « Copier ». Il reste présent dans `public/data/don.json` : il est masqué à l'écran, pas secret. Pour un vrai masquage, utiliser un lien de paiement (`url`) fourni par un service de paiement.
