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


## Mise en production : l'API de segmentation

Le modèle entraîné dans le notebook est exposé via une API REST (FastAPI) pour
pouvoir segmenter des clients réels sans réexécuter le notebook.

### Fichiers

- `train_model.py` — rejoue le pipeline du notebook (nettoyage strict, RFM,
  log1p, StandardScaler, K-means k=4, nommage par score d'engagement) et
  sauvegarde le scaler, le K-means et la correspondance cluster → segment
  dans `modele/modele_rfm.joblib`.
- `api.py` l'API qui charge ces objets et prédit le segment de nouveaux clients.
- `static/index.html`  l'interface web, servie par l'API.
- `requirements.txt`  les dépendances.


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

**Un client** on saisit Récence, Fréquence et Montant, et le modèle renvoie le
segment avec sa recommandation. Un nuage de points situe le client parmi les
clients de référence (récence en abscisse, montant en ordonnée, échelles
logarithmiques vu l'étendue des valeurs) : on voit ainsi où il se place dans la
base, pas seulement l'étiquette qui lui est attribuée. Deux boutons chargent un
profil actif et un profil inactif pris dans les données réelles.

**Fichier CSV**  glisser-déposer d'un fichier, puis les indicateurs clés, la
répartition par segment en effectif et en chiffre d'affaires, le tableau
détaillé triable en cliquant sur les en-têtes, et l'export du CSV segmenté.

Le fichier `clients_segmentes.csv` produit par le notebook fonctionne
directement : l'API reconnaît aussi bien `customer_id, recence, frequence,
montant` que les colonnes `Customer ID, Recence, Frequence, Montant` du TP.

**Segments**  les quatre segments avec leur recommandation, et un rappel de la
date de référence du modèle.


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


### Fichiers de déploiement

- `render.yaml` la configuration du service (build, démarrage, health check).
- `requirements.txt`  les versions figées, identiques à celles testées en local.
- `.dockerignore` exclut les données lourdes si vous passez par une image.


