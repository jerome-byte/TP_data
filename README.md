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
