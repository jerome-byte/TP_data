# TP 2 (F1) — Segmentation clients RFM


« Comprendre ses clients pour mieux les servir » — TAISS 2026

## Le contexte, en gros

On a un e-commerce de cadeaux basé au Royaume-Uni, plus d'un million de transactions sur deux ans, et personne ne sait vraiment qui sont ses clients. L'idée du TP c'est de segmenter les clients avec la méthode RFM (Récence, Fréquence, Montant) + K-means, pour pouvoir sortir des recommandations marketing par groupe (relance, fidélisation, réactivation...).

Le notebook `Tp_segmentation.ipynb` fait tout le boulot, de la donnée brute jusqu'aux segments nommés et caractérisés.

## Les données

<table>
  <thead>
    <tr>
      <th>Élément</th>
      <th>Détail</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Source</td>
      <td>UCI Online Retail II</td>
    </tr>
    <tr>
      <td>Lien</td>
      <td>https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip</td>
    </tr>
    <tr>
      <td>Fichier attendu</td>
      <td><code>online_retail_II.xlsx</code> (à la racine du projet, ou adapter le chemin dans la 1ère cellule)</td>
    </tr>
    <tr>
      <td>Feuilles</td>
      <td>« Year 2009-2010 » et « Year 2010-2011 », concaténées au début du notebook</td>
    </tr>
    <tr>
      <td>Colonnes principales</td>
      <td>Invoice, StockCode, Description, Quantity, InvoiceDate, Price, Customer ID, Country</td>
    </tr>
  </tbody>
</table>

## Comment faire tourner le notebook

1. Télécharger le fichier `online_retail_II.xlsx` depuis le lien ci-dessus et le mettre dans le même dossier que le notebook (ou changer la variable `chemin_fichier` dans la première cellule).
2. Installer les dépendances : `pandas`, `numpy`, `matplotlib`, `seaborn`, `scikit-learn`.
3. Exécuter le notebook du début à la fin, dans l'ordre — certaines cellules réutilisent des variables construites plus haut (`rfm`, `X`, `colonnes_rfm`...), donc ne pas sauter de cellules.
4. À la fin, deux fichiers sont générés automatiquement : `clients_segmentes.csv` et `tableau_segments.csv`.

Le tout tourne avec une graine fixée (`GRAINE = 42`), donc les résultats sont reproductibles d'une exécution à l'autre.

## Ce que fait le notebook, étape par étape

<table>
  <thead>
    <tr>
      <th>Section du notebook</th>
      <th>Ce qui est fait</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>EDA</td>
      <td>types de colonnes, valeurs manquantes, période couverte, repérage des annulations, des StockCode non-produits (POST, D, M, BANK CHARGES...), comparaison clients avec/sans Customer ID</td>
    </tr>
    <tr>
      <td>Nettoyage (Partie 1)</td>
      <td>retrait des doublons exacts, des lignes non-produits, des annulations, des Customer ID manquants, des quantités/prix négatifs ou nuls. Une version « annulations nettes » est gardée en parallèle pour comparer plus tard.</td>
    </tr>
    <tr>
      <td>Construction RFM (Partie 2)</td>
      <td>Récence / Fréquence / Montant par client, transformation log(1+x) + StandardScaler pour corriger l'asymétrie et mettre les variables à la même échelle</td>
    </tr>
    <tr>
      <td>Baseline</td>
      <td>segmentation manuelle par quartiles RFM (sans machine learning), pour avoir un point de comparaison au clustering</td>
    </tr>
    <tr>
      <td>Clustering (Partie 3)</td>
      <td>choix de k avec la méthode du coude, le score de silhouette et un test de stabilité (ARI sur ré-échantillonnage à 80%). K-means final avec k=4.</td>
    </tr>
    <tr>
      <td>Évaluation</td>
      <td>silhouette du clustering retenu, tableau croisé baseline vs K-means pour voir si les deux approches se recoupent</td>
    </tr>
    <tr>
      <td>Robustesse (Partie 4/5)</td>
      <td>impact du retrait des clients extrêmes (top 1% du Montant) et impact du traitement des annulations, mesurés en ARI</td>
    </tr>
    <tr>
      <td>Caractérisation (Partie 4)</td>
      <td>tableau de synthèse par segment (effectif, %CA, moyennes R/F/M, pays et produit dominants), nommage des segments (Champions, Clients réguliers, À risque, Endormis), recommandations marketing</td>
    </tr>
    <tr>
      <td>Discussion critique et éthique (Partie 5)</td>
      <td>impact des annulations, pourquoi log+standardisation, redondance Fréquence/Montant, limites de la silhouette, comment défendre la qualité des segments sans vérité terrain, garde-fous éthiques sur la tarification différenciée</td>
    </tr>
  </tbody>
</table>

## Réponses aux questions du rapport

Toutes les questions demandées dans le sujet sont traitées directement dans le notebook (pas besoin d'aller chercher ailleurs) :

<table>
  <thead>
    <tr>
      <th>Question du sujet</th>
      <th>Où et comment c'est traité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Le traitement des annulations change-t-il les segments ?</td>
      <td>Clustering refait sur la version « annulations nettes », comparé en ARI à la version sans annulations (section « Impact du traitement des annulations »)</td>
    </tr>
    <tr>
      <td>Pourquoi pas K-means sur les RFM bruts ? Qu'apporte log + standardisation ?</td>
      <td>Expliqué dans la section Normalisation : sans ça, le Montant (échelle beaucoup plus large) écrase les autres variables dans le calcul de distance</td>
    </tr>
    <tr>
      <td>Fréquence et Montant sont corrélés, comment traiter cette redondance ?</td>
      <td>Corrélation calculée, puis comparaison entre garder les 3 variables et réduire Fréquence+Montant en une composante ACP (silhouette + ARI entre les deux options)</td>
    </tr>
    <tr>
      <td>Pourquoi la silhouette seule ne suffit pas pour choisir k ?</td>
      <td>k=2 a la meilleure silhouette mais ne sert à rien niveau marketing — discuté et croisé avec la stabilité et le sens métier avant de retenir k=4</td>
    </tr>
    <tr>
      <td>Comment défendre la qualité des segments sans vérité terrain ?</td>
      <td>Stabilité par ré-échantillonnage, sensibilité aux valeurs extrêmes, cohérence avec la baseline par règles</td>
    </tr>
    <tr>
      <td>Quels garde-fous pour la tarification différenciée ?</td>
      <td>Paragraphe dédié en fin de notebook (transparence, pas de proxy de caractéristiques protégées, plafond d'écart de prix, conformité RGPD)</td>
    </tr>
  </tbody>
</table>

## Segments obtenus

<table>
  <thead>
    <tr>
      <th>Segment</th>
      <th>Profil</th>
      <th>Action marketing</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Champions</td>
      <td>achète souvent, récemment, gros montants</td>
      <td>programme de fidélité, avant-premières, pas de remise agressive</td>
    </tr>
    <tr>
      <td>Clients réguliers</td>
      <td>engagement correct mais pas au top</td>
      <td>cross-sell, programme de points, communication régulière</td>
    </tr>
    <tr>
      <td>Clients à risque</td>
      <td>commence à s'éloigner</td>
      <td>relance ciblée avec offre limitée dans le temps</td>
    </tr>
    <tr>
      <td>Clients endormis</td>
      <td>n'a plus acheté depuis longtemps</td>
      <td>campagne de réactivation à faible coût, sinon réduire la pression marketing</td>
    </tr>
  </tbody>
</table>

Les chiffres exacts (effectifs, %CA, pays/produit dominants) sont dans `tableau_segments.csv` généré à la fin du notebook.

## Livrables

- `Tp_segmentation.ipynb` — notebook complet, exécutable de bout en bout
- `clients_segmentes.csv` — chaque client avec son cluster et ses features RFM
- `tableau_segments.csv` — tableau de synthèse par segment
- ce README

Le rapport de 2 à 3 pages demandé dans le sujet est un document à part, à rédiger en s'appuyant sur les chiffres et les décisions déjà argumentées dans le notebook (choix de k, ARI, recommandations...).

## Limites (à mettre aussi dans le rapport)

- Pas de vérité terrain : on ne peut pas prouver formellement que ces 4 segments sont "les bons", seulement qu'ils sont stables et cohérents avec une baseline simple.
- Le choix de k=4 est un compromis assumé entre le résultat statistique (k=2 a une meilleure silhouette) et l'utilité métier — pas un optimum pur.
- Le dataset couvre surtout le Royaume-Uni (~91% des lignes), donc les segments et surtout le "top pays hors UK" restent à prendre avec prudence si on veut généraliser à d'autres marchés.
- Rien n'est fait ici sur les enjeux de discrimination indirecte si la segmentation servait à la tarification — c'est discuté dans le notebook mais pas mis en œuvre techniquement (pas de garde-fou codé, juste des principes).

## Bonus (non traité)

La couche d'interrogation en langage naturel (base vectorielle + assistant répondant aux questions marketing) mentionnée en bonus dans le sujet n'a pas été faite.
