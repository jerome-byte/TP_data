"""Entraine et sauvegarde le modele de segmentation RFM du TP.

Rejoue exactement le pipeline du notebook Tp_segmentation.ipynb (nettoyage,
RFM, log1p, StandardScaler, KMeans k=4, nommage par score d'engagement) puis
exporte les objets necessaires a l'API dans le dossier modele/.

Usage : python train_model.py [chemin_vers_online_retail_II.xlsx]
"""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

GRAINE = 42
K = 4
COLONNES_RFM = ["Recence_log", "Frequence_log", "Montant_log"]
NOMS_ORDONNES = ["Champions", "Clients réguliers", "Clients à risque", "Clients endormis"]

RECOMMANDATIONS = {
    "Champions": "Programme VIP, avant-premieres, parrainage : ce sont eux qui portent le CA.",
    "Clients réguliers": "Montee en gamme et ventes croisees pour augmenter le panier moyen.",
    "Clients à risque": "Relance ciblee rapide (email + offre) avant qu'ils ne basculent en endormis.",
    "Clients endormis": "Campagne de reactivation ponctuelle, a faible cout : rentabilite incertaine.",
}

DOSSIER_MODELE = Path(__file__).parent / "modele"


def charger_donnees(chemin_fichier):
    feuille_2009 = pd.read_excel(chemin_fichier, sheet_name="Year 2009-2010")
    feuille_2010 = pd.read_excel(chemin_fichier, sheet_name="Year 2010-2011")
    return pd.concat([feuille_2009, feuille_2010], ignore_index=True)


def nettoyer(df_brut):
    """Nettoyage strict, identique aux cellules 16-17 du notebook."""
    df = df_brut.drop_duplicates()
    df = df[df["StockCode"].astype(str).str.match(r"^\d")]
    est_annulation = df["Invoice"].astype(str).str.startswith("C")
    df_clean = df[
        (~est_annulation)
        & (df["Quantity"] > 0)
        & (df["Price"] > 0)
        & (df["Customer ID"].notna())
    ].copy()
    df_clean["Montant"] = df_clean["Quantity"] * df_clean["Price"]
    return df_clean


def calculer_rfm(transactions, date_reference=None):
    """Calcule Recence / Frequence / Montant par client (cellule 21)."""
    if date_reference is None:
        date_reference = transactions["InvoiceDate"].max() + pd.Timedelta(days=1)
    rfm = transactions.groupby("Customer ID").agg(
        Recence=("InvoiceDate", lambda dates: (date_reference - dates.max()).days),
        Frequence=("Invoice", "nunique"),
        Montant=("Montant", "sum"),
    ).reset_index()
    return rfm


def ajouter_logs(rfm):
    for col, col_log in zip(["Recence", "Frequence", "Montant"], COLONNES_RFM):
        rfm[col_log] = np.log1p(rfm[col].clip(lower=0))
    return rfm


def entrainer(chemin_fichier="online_retail_II.xlsx"):
    print("Chargement des donnees...")
    df_brut = charger_donnees(chemin_fichier)
    df_clean = nettoyer(df_brut)
    date_reference = df_clean["InvoiceDate"].max() + pd.Timedelta(days=1)
    print(f"{len(df_clean)} lignes propres, date de reference : {date_reference.date()}")

    rfm = ajouter_logs(calculer_rfm(df_clean, date_reference))
    print(f"{len(rfm)} clients")

    scaler = StandardScaler()
    X = scaler.fit_transform(rfm[COLONNES_RFM])

    kmeans = KMeans(n_clusters=K, random_state=GRAINE, n_init=50)
    rfm["cluster"] = kmeans.fit_predict(X)

    # Nommage par score d'engagement (cellule 56) : Recence inversee +
    # Frequence + Montant, a poids egal sur les colonnes standardisees.
    Z = pd.DataFrame(X, columns=COLONNES_RFM, index=rfm.index)
    rfm["engagement"] = -Z["Recence_log"] + Z["Frequence_log"] + Z["Montant_log"]
    ordre = rfm.groupby("cluster")["engagement"].mean().sort_values(ascending=False)
    correspondance_noms = {int(c): n for c, n in zip(ordre.index, NOMS_ORDONNES)}
    print("Correspondance cluster -> segment :", correspondance_noms)

    # Nuage de reference : un echantillon des clients d'entrainement, pour que
    # l'interface puisse situer un client par rapport a la base existante.
    echantillon = rfm.sample(min(2000, len(rfm)), random_state=GRAINE)
    nuage = [
        {
            "r": int(l.Recence),
            "m": round(float(l.Montant), 2),
            "s": correspondance_noms[int(l.cluster)],
        }
        for l in echantillon.itertuples(index=False)
    ]

    DOSSIER_MODELE.mkdir(exist_ok=True)
    joblib.dump(
        {
            "nuage_reference": nuage,
            "scaler": scaler,
            "kmeans": kmeans,
            "correspondance_noms": correspondance_noms,
            "recommandations": RECOMMANDATIONS,
            "colonnes_rfm": COLONNES_RFM,
            "date_reference": date_reference,
            "nb_clients_entrainement": len(rfm),
        },
        DOSSIER_MODELE / "modele_rfm.joblib",
    )
    print(f"Modele sauvegarde dans {DOSSIER_MODELE / 'modele_rfm.joblib'}")
    return rfm


if __name__ == "__main__":
    chemin = sys.argv[1] if len(sys.argv) > 1 else "online_retail_II.xlsx"
    entrainer(chemin)
