# TP 2 (F1) Segmentation clients RFM

« Comprendre ses clients pour mieux les servir » — TAISS 2026

## Le contexte

On a un e-commerce de cadeaux basé au Royaume-Uni, plus d'un million de transactions sur deux ans, et personne ne sait vraiment qui sont ses clients. Le but du notebook c'est de les segmenter avec la méthode RFM (Récence, Fréquence, Montant) combinée à un K-means, pour pouvoir sortir des recommandations marketing par groupe (fidélisation, relance, réactivation...).

## La méthode

Le notebook part des données brutes UCI Online Retail II (deux feuilles Excel, 2009-2010 et 2010-2011, concaténées) et enchaîne les étapes suivantes :

D'abord une exploration rapide des données pour voir ce qu'il y a dedans : types de colonnes, valeurs manquantes, période couverte, et repérage des problèmes (annulations, StockCode qui ne sont pas de vrais produits comme les frais de port ou les remises, clients sans identifiant).

Ensuite le nettoyage : on retire les doublons exacts, les lignes non-produits, les annulations, les clients sans Customer ID, et les quantités ou prix négatifs/nuls. Une version parallèle avec les annulations nettes est gardée de côté pour pouvoir comparer plus tard.

À partir des données propres, on calcule pour chaque client sa Récence, sa Fréquence et son Montant total dépensé. Comme ces trois variables sont très asymétriques (beaucoup de petits clients, quelques très gros), elles passent par une transformation log(1+x) puis un StandardScaler, sinon le Montant écraserait tout dans le calcul de distance du K-means.

Avant de lancer le clustering, une baseline simple par quartiles RFM (sans aucun algorithme) est construite, pour avoir un point de comparaison.

Pour choisir le nombre de clusters k, on croise trois indicateurs : la méthode du coude, le score de silhouette, et un test de stabilité (ARI en ré-échantillonnant les données à 80%). k=2 donne la meilleure silhouette mais ne sépare que deux groupes trop pauvres pour du marketing différencié, donc k=4 est retenu comme compromis entre performance statistique et utilité métier.

Une fois le K-means final tourné (k=4), les segments sont caractérisés : effectif, chiffre d'affaires, moyennes RFM, pays et produit dominants par segment. Ils sont ensuite nommés (Champions, Clients réguliers, Clients à risque, Clients endormis) et associés à une recommandation marketing chacun.

Le notebook teste aussi la robustesse des résultats : impact du retrait des clients extrêmes, et impact du traitement des annulations, les deux mesurés en ARI. Il se termine par une discussion critique sur les limites de la méthode et les enjeux éthiques d'une segmentation utilisée pour personnaliser des offres ou des prix.

## Procédure d'exécution

1. Télécharger le fichier `online_retail_II.xlsx` depuis https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip et le placer dans le même dossier que le notebook (ou modifier la variable `chemin_fichier` dans la première cellule si le fichier est ailleurs).
2. Installer les dépendances nécessaires : `pandas`, `numpy`, `matplotlib`, `seaborn`, `scikit-learn`.
3. Exécuter le notebook dans l'ordre, cellule par cellule, du début à la fin. Certaines cellules réutilisent des variables construites plus haut (`rfm`, `X`, `colonnes_rfm`...), donc il ne faut pas sauter de cellules ni les exécuter dans le désordre.
4. Une graine aléatoire est fixée (`GRAINE = 42`) pour que les résultats soient les mêmes à chaque exécution.
5. À la fin, le notebook génère automatiquement deux fichiers : `clients_segmentes.csv` (chaque client avec son cluster) et `tableau_segments.csv` (le tableau de synthèse par segment).


# TP 2 (F1) — Segmentation clients RFM

« Comprendre ses clients pour mieux les servir » — TAISS 2026

## Le contexte

On a un e-commerce de cadeaux basé au Royaume-Uni, plus d'un million de transactions sur deux ans, et personne ne sait vraiment qui sont ses clients. Le but du notebook c'est de les segmenter avec la méthode RFM (Récence, Fréquence, Montant) combinée à un K-means, pour pouvoir sortir des recommandations marketing par groupe (fidélisation, relance, réactivation...).

## La méthode

Le notebook part des données brutes UCI Online Retail II (deux feuilles Excel, 2009-2010 et 2010-2011, concaténées) et enchaîne les étapes suivantes :

D'abord une exploration rapide des données pour voir ce qu'il y a dedans : types de colonnes, valeurs manquantes, période couverte, et repérage des problèmes (annulations, StockCode qui ne sont pas de vrais produits comme les frais de port ou les remises, clients sans identifiant).

Ensuite le nettoyage : on retire les doublons exacts, les lignes non-produits, les annulations, les clients sans Customer ID, et les quantités ou prix négatifs/nuls. Une version parallèle avec les annulations nettes est gardée de côté pour pouvoir comparer plus tard.

À partir des données propres, on calcule pour chaque client sa Récence, sa Fréquence et son Montant total dépensé. Comme ces trois variables sont très asymétriques (beaucoup de petits clients, quelques très gros), elles passent par une transformation log(1+x) puis un StandardScaler, sinon le Montant écraserait tout dans le calcul de distance du K-means.

Avant de lancer le clustering, une baseline simple par quartiles RFM (sans aucun algorithme) est construite, pour avoir un point de comparaison.

Pour choisir le nombre de clusters k, on croise trois indicateurs : la méthode du coude, le score de silhouette, et un test de stabilité (ARI en ré-échantillonnant les données à 80%). k=2 donne la meilleure silhouette mais ne sépare que deux groupes trop pauvres pour du marketing différencié, donc k=4 est retenu comme compromis entre performance statistique et utilité métier.

Une fois le K-means final tourné (k=4), les segments sont caractérisés : effectif, chiffre d'affaires, moyennes RFM, pays et produit dominants par segment. Ils sont ensuite nommés (Champions, Clients réguliers, Clients à risque, Clients endormis) et associés à une recommandation marketing chacun.

Le notebook teste aussi la robustesse des résultats : impact du retrait des clients extrêmes, et impact du traitement des annulations, les deux mesurés en ARI. Il se termine par une discussion critique sur les limites de la méthode et les enjeux éthiques d'une segmentation utilisée pour personnaliser des offres ou des prix.

## Procédure d'exécution

1. Télécharger le fichier `online_retail_II.xlsx` depuis https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip et le placer dans le même dossier que le notebook (ou modifier la variable `chemin_fichier` dans la première cellule si le fichier est ailleurs).
2. Installer les dépendances nécessaires : `pandas`, `numpy`, `matplotlib`, `seaborn`, `scikit-learn`.
3. Exécuter le notebook dans l'ordre, cellule par cellule, du début à la fin. Certaines cellules réutilisent des variables construites plus haut (`rfm`, `X`, `colonnes_rfm`...), donc il ne faut pas sauter de cellules ni les exécuter dans le désordre.
4. Une graine aléatoire est fixée (`GRAINE = 42`) pour que les résultats soient les mêmes à chaque exécution.
5. À la fin, le notebook génère automatiquement deux fichiers : `clients_segmentes.csv` (chaque client avec son cluster) et `tableau_segments.csv` (le tableau de synthèse par segment).

## Mise en production : l'API de segmentation

Le modèle entraîné dans le notebook est exposé via une API REST (FastAPI) pour
pouvoir segmenter des clients réels sans réexécuter le notebook.

### Fichiers

- `train_model.py` — rejoue le pipeline du notebook (nettoyage strict, RFM,
  log1p, StandardScaler, K-means k=4, nommage par score d'engagement) et
  sauvegarde le scaler, le K-means et la correspondance cluster → segment
  dans `modele/modele_rfm.joblib`.
- `api.py` — l'API qui charge ces objets et prédit le segment de nouveaux clients.
- `static/index.html` — l'interface web, servie par l'API.
- `requirements.txt` — les dépendances.

Point important : le scaler et le K-means sont **réutilisés tels quels** (on
appelle `transform` et `predict`, jamais `fit`). Un nouveau client est donc
positionné par rapport aux 5852 clients d'entraînement, et les segments
restent comparables d'un appel à l'autre.

### Installation et lancement

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python train_model.py          # à faire une seule fois : crée modele/modele_rfm.joblib
uvicorn api:app --reload       # lance l'API sur http://127.0.0.1:8000
```

Puis ouvrir **http://127.0.0.1:8000** dans le navigateur : c'est l'interface
graphique. La documentation interactive (Swagger) reste disponible sur
http://127.0.0.1:8000/docs pour tester les endpoints un par un.

### L'interface web

Servie directement par FastAPI à la racine, donc il n'y a qu'un seul serveur à
lancer. Volontairement sobre : trois onglets, pas de fioritures.

**Un client** — on saisit Récence, Fréquence et Montant, et le modèle renvoie le
segment avec sa recommandation. Un nuage de points situe le client parmi les
clients de référence (récence en abscisse, montant en ordonnée, échelles
logarithmiques vu l'étendue des valeurs) : on voit ainsi où il se place dans la
base, pas seulement l'étiquette qui lui est attribuée. Deux boutons chargent un
profil actif et un profil inactif pris dans les données réelles.

**Fichier CSV** — glisser-déposer d'un fichier, puis les indicateurs clés, la
répartition par segment en effectif et en chiffre d'affaires, le tableau
détaillé triable en cliquant sur les en-têtes, et l'export du CSV segmenté.

Le fichier `clients_segmentes.csv` produit par le notebook fonctionne
directement : l'API reconnaît aussi bien `customer_id, recence, frequence,
montant` que les colonnes `Customer ID, Recence, Frequence, Montant` du TP.

**Segments** — les quatre segments avec leur recommandation, et un rappel de la
date de référence du modèle.

Le nuage de référence est échantillonné à l'entraînement et servi par
`GET /nuage` : l'interface n'a pas besoin des données brutes.

### Les endpoints

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/` | L'interface web |
| GET | `/nuage` | Échantillon des clients d'entraînement (pour le graphe) |
| GET | `/sante` | Vérifie que le modèle est chargé |
| GET | `/segments` | Liste les 4 segments et leur recommandation marketing |
| POST | `/predire` | Segmente des clients dont le RFM est déjà calculé |
| POST | `/predire/transactions` | Segmente à partir de transactions brutes |
| POST | `/predire/fichier` | Segmente un lot de clients depuis un CSV |

**`/predire`** — quand la Récence, la Fréquence et le Montant sont déjà connus :

```bash
curl -X POST http://127.0.0.1:8000/predire \
  -H "Content-Type: application/json" \
  -d '[{"customer_id":"A1","recence":3,"frequence":25,"montant":15000}]'
```

Réponse : le cluster, le nom du segment et la recommandation marketing associée.

**`/predire/transactions`** — quand on part des données brutes. L'API applique
le même nettoyage que le notebook (retrait des doublons, des StockCode
non-produits, des annulations `C...`, des quantités et prix négatifs) puis
agrège en RFM avant de prédire :

```bash
curl -X POST http://127.0.0.1:8000/predire/transactions \
  -H "Content-Type: application/json" \
  -d '[{"customer_id":"NEW001","invoice":"600001","invoice_date":"2011-12-05T10:00:00","quantity":12,"price":25.5,"stock_code":"85123A"}]'
```

La Récence est calculée par rapport au paramètre optionnel `date_reference`
(par défaut, le lendemain de la transaction la plus récente reçue).

**`/predire/fichier`** — pour traiter un lot. Le CSV doit contenir soit les
colonnes `customer_id, recence, frequence, montant`, soit les colonnes
`customer_id, invoice, invoice_date, quantity, price` (+ `stock_code` optionnel) :

```bash
curl -X POST http://127.0.0.1:8000/predire/fichier -F "fichier=@mes_clients.csv"
```

### Vérification

L'API a été testée sur 500 clients tirés au hasard dans `clients_segmentes.csv` :
elle retrouve **100 % des segments** attribués par le notebook, ce qui confirme
que le pipeline exporté est bien identique à celui du TP.

L'interface a été testée dans un navigateur (formulaire, upload, tri, export,
rendu mobile à 390 px) : les segments affichés correspondent à ceux du notebook,
il n'y a pas de défilement horizontal et aucune erreur JavaScript n'est remontée.

### Limites

La Récence dépend de la date à laquelle on interroge le modèle. Les données
d'entraînement s'arrêtent au 09/12/2011 : sur des transactions récentes, tous
les clients paraîtraient « endormis » si on calculait la Récence par rapport à
aujourd'hui. C'est pourquoi `/predire/transactions` accepte une
`date_reference` explicite. Sur de vraies données d'exploitation, il faut
réentraîner le modèle périodiquement (`python train_model.py`) pour que les
frontières entre segments suivent l'évolution de la base clients.

## Déploiement

L'API est déployable en l'état sur Render (offre gratuite). Le principe : le
modèle entraîné (`modele/modele_rfm.joblib`, 71 Ko) est versionné dans le dépôt,
donc **aucun entraînement n'a lieu au démarrage** — le serveur charge simplement
les objets et répond. Le fichier `online_retail_II.xlsx` (44 Mo) n'est pas
nécessaire en production : il ne sert qu'à `train_model.py`.

### Fichiers de déploiement

- `render.yaml` — la configuration du service (build, démarrage, health check).
- `requirements.txt` — les versions figées, identiques à celles testées en local.
- `.dockerignore` — exclut les données lourdes si vous passez par une image.

### Mise en ligne

1. Pousser le dépôt sur GitHub, en vérifiant que `modele/modele_rfm.joblib` est
   bien inclus (c'est lui qui fait tourner l'API) :
   ```bash
   git add api.py train_model.py requirements.txt render.yaml .gitignore \
           .dockerignore static/ modele/ README.md
   git commit -m "API de segmentation RFM + interface + déploiement"
   git push
   ```
2. Sur [render.com](https://render.com), *New → Web Service*, connecter le dépôt.
   Render lit `render.yaml` et pré-remplit la configuration.
3. Laisser le plan **Free**, puis *Create Web Service*.

L'URL publique est de la forme `https://segmentation-rfm.onrender.com`, avec
l'interface à la racine et la documentation Swagger sur `/docs`.

### Ce qu'il faut savoir sur l'offre gratuite

Le service **se met en veille au bout de 15 minutes d'inactivité**. La première
requête après une veille prend alors 30 à 60 secondes, le temps que l'instance
redémarre : c'est normal, ce n'est pas une panne. Pour une démonstration, il vaut
mieux ouvrir la page quelques minutes avant de présenter.

La mémoire est limitée à 512 Mo, d'où la borne de 10 Mo sur les fichiers envoyés
à `/predire/fichier` (au-delà, l'API répond `413` plutôt que de tomber).

### Réentraîner et redéployer

Le modèle est figé au moment de l'entraînement. Pour le rafraîchir :

```bash
python train_model.py        # régénère modele/modele_rfm.joblib
git add modele/ && git commit -m "Réentraînement" && git push
```

Render redéploie automatiquement à chaque push.

### Vérification

Le déploiement a été testé sur un dossier ne contenant que les fichiers
réellement envoyés (**132 Ko** en tout, sans le `.xlsx` ni le notebook) :
l'API démarre, charge le modèle, sert l'interface, prédit correctement et
accepte les uploads. La limite de taille a été vérifiée : un fichier de 14,7 Mo
est refusé avec un code `413`.

Attention en revanche : `online_retail_II.xlsx` est **déjà présent dans
l'historique Git**, ce qui fait un dépôt de 44 Mo que Render clonera à chaque
build. Le déploiement fonctionne, mais si vous voulez alléger, il faut purger
ce fichier de l'historique (`git filter-repo`) — une opération qui réécrit
l'historique et doit être décidée en connaissance de cause.
