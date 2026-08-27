"""API de segmentation clients RFM (TP 2 F1 - TAISS 2026).

Expose le modele KMeans entraine par train_model.py pour predire le segment
de clients reels, soit a partir de leurs valeurs RFM deja calculees, soit
a partir de leurs transactions brutes.

Lancement : uvicorn api:app --reload
Documentation interactive : http://127.0.0.1:8000/docs
"""

from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

CHEMIN_MODELE = Path(__file__).parent / "modele" / "modele_rfm.joblib"
DOSSIER_STATIC = Path(__file__).parent / "static"

if not CHEMIN_MODELE.exists():
    raise RuntimeError(
        f"Modele introuvable ({CHEMIN_MODELE}). Lancer d'abord : python train_model.py"
    )

artefacts = joblib.load(CHEMIN_MODELE)
scaler = artefacts["scaler"]
kmeans = artefacts["kmeans"]
correspondance_noms = artefacts["correspondance_noms"]
recommandations = artefacts["recommandations"]
colonnes_rfm = artefacts["colonnes_rfm"]
date_reference_modele = artefacts["date_reference"]
nuage_reference = artefacts.get("nuage_reference", [])

app = FastAPI(
    title="API Segmentation clients RFM",
    description="Segmente des clients en 4 groupes (Champions, réguliers, à risque, endormis).",
    version="1.0.0",
)


# ---------------------------------------------------------------- schemas


class ClientRFM(BaseModel):
    """Un client dont la Recence / Frequence / Montant sont deja calculees."""

    customer_id: Optional[str] = Field(None, description="Identifiant du client (optionnel)")
    recence: float = Field(..., ge=0, description="Jours depuis le dernier achat")
    frequence: float = Field(..., ge=0, description="Nombre de factures distinctes")
    montant: float = Field(..., description="Montant total depense")


class Transaction(BaseModel):
    """Une ligne de transaction brute, au format Online Retail II."""

    customer_id: str
    invoice: str
    invoice_date: datetime
    quantity: float
    price: float
    stock_code: Optional[str] = None


class Prediction(BaseModel):
    customer_id: Optional[str]
    recence: float
    frequence: float
    montant: float
    cluster: int
    segment: str
    recommandation: str


class ReponsePrediction(BaseModel):
    nb_clients: int
    predictions: List[Prediction]


# ---------------------------------------------------------------- coeur


def predire_depuis_rfm(donnees: pd.DataFrame) -> List[Prediction]:
    """donnees : DataFrame avec colonnes customer_id, recence, frequence, montant."""
    logs = np.column_stack([
        np.log1p(donnees["recence"].clip(lower=0)),
        np.log1p(donnees["frequence"].clip(lower=0)),
        np.log1p(donnees["montant"].clip(lower=0)),
    ])
    X = scaler.transform(pd.DataFrame(logs, columns=colonnes_rfm))
    clusters = kmeans.predict(X)

    resultats = []
    for ligne, cluster in zip(donnees.itertuples(index=False), clusters):
        segment = correspondance_noms[int(cluster)]
        resultats.append(
            Prediction(
                customer_id=getattr(ligne, "customer_id", None),
                recence=float(ligne.recence),
                frequence=float(ligne.frequence),
                montant=float(ligne.montant),
                cluster=int(cluster),
                segment=segment,
                recommandation=recommandations[segment],
            )
        )
    return resultats


def rfm_depuis_transactions(df: pd.DataFrame, date_reference: pd.Timestamp) -> pd.DataFrame:
    """Applique le nettoyage strict du notebook puis agrege en RFM."""
    df = df.drop_duplicates()
    if "stock_code" in df.columns and df["stock_code"].notna().any():
        df = df[df["stock_code"].astype(str).str.match(r"^\d")]
    df = df[~df["invoice"].astype(str).str.startswith("C")]
    df = df[(df["quantity"] > 0) & (df["price"] > 0) & (df["customer_id"].notna())].copy()

    if df.empty:
        raise HTTPException(400, "Aucune transaction valide apres nettoyage.")

    df["montant_ligne"] = df["quantity"] * df["price"]
    df["invoice_date"] = pd.to_datetime(df["invoice_date"])

    rfm = df.groupby("customer_id").agg(
        recence=("invoice_date", lambda d: (date_reference - d.max()).days),
        frequence=("invoice", "nunique"),
        montant=("montant_ligne", "sum"),
    ).reset_index()
    rfm["recence"] = rfm["recence"].clip(lower=0)
    return rfm


# ---------------------------------------------------------------- routes


@app.get("/", include_in_schema=False)
def interface():
    """Sert l'interface web de segmentation."""
    return FileResponse(DOSSIER_STATIC / "index.html")


@app.get("/api")
def racine():
    return {
        "message": "API de segmentation clients RFM",
        "interface": "/",
        "documentation": "/docs",
        "endpoints": ["/sante", "/segments", "/predire", "/predire/transactions", "/predire/fichier"],
    }


@app.get("/sante")
def sante():
    return {
        "statut": "ok",
        "modele_charge": True,
        "nb_clusters": int(kmeans.n_clusters),
        "clients_entrainement": artefacts["nb_clients_entrainement"],
        "date_reference_modele": date_reference_modele.date().isoformat(),
    }


@app.get("/segments")
def segments():
    """Liste les segments du modele et leur recommandation marketing."""
    return [
        {"cluster": cluster, "segment": nom, "recommandation": recommandations[nom]}
        for cluster, nom in sorted(correspondance_noms.items(), key=lambda kv: kv[0])
    ]


@app.get("/nuage")
def nuage():
    """Echantillon des clients d'entrainement, pour situer un client sur le graphe."""
    return nuage_reference


@app.post("/predire", response_model=ReponsePrediction)
def predire(clients: List[ClientRFM]):
    """Segmente des clients dont les valeurs RFM sont deja connues."""
    if not clients:
        raise HTTPException(400, "La liste de clients est vide.")
    donnees = pd.DataFrame([c.model_dump() for c in clients])
    predictions = predire_depuis_rfm(donnees)
    return ReponsePrediction(nb_clients=len(predictions), predictions=predictions)


@app.post("/predire/transactions", response_model=ReponsePrediction)
def predire_transactions(
    transactions: List[Transaction],
    date_reference: Optional[date] = None,
):
    """Segmente des clients a partir de leurs transactions brutes.

    La Recence est calculee par rapport a `date_reference` (par defaut :
    le lendemain de la transaction la plus recente recue).
    """
    if not transactions:
        raise HTTPException(400, "La liste de transactions est vide.")

    df = pd.DataFrame([t.model_dump() for t in transactions])
    if date_reference is None:
        ref = pd.to_datetime(df["invoice_date"]).max() + pd.Timedelta(days=1)
    else:
        ref = pd.Timestamp(date_reference)
    ref = ref.tz_localize(None) if ref.tzinfo else ref

    rfm = rfm_depuis_transactions(df, ref)
    predictions = predire_depuis_rfm(rfm)
    return ReponsePrediction(nb_clients=len(predictions), predictions=predictions)


@app.post("/predire/fichier", response_model=ReponsePrediction)
async def predire_fichier(fichier: UploadFile = File(...)):
    """Segmente un lot de clients depuis un CSV.

    Deux formats acceptes :
    - colonnes RFM : customer_id, recence, frequence, montant
    - transactions : customer_id, invoice, invoice_date, quantity, price [, stock_code]
    """
    contenu = await fichier.read()
    from io import BytesIO

    try:
        df = pd.read_csv(BytesIO(contenu))
    except Exception as erreur:
        raise HTTPException(400, f"CSV illisible : {erreur}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    # Tolere les variantes de nommage : anglais, et le format exporte par le
    # notebook du TP (Customer ID, Recence, Frequence, Montant).
    df = df.rename(columns={"recency": "recence", "frequency": "frequence",
                            "monetary": "montant", "customerid": "customer_id",
                            "invoicedate": "invoice_date", "stockcode": "stock_code",
                            "unitprice": "price"})

    if {"recence", "frequence", "montant"}.issubset(df.columns):
        if "customer_id" not in df.columns:
            df["customer_id"] = df.index.astype(str)
        df["customer_id"] = df["customer_id"].astype(str)
        rfm = df[["customer_id", "recence", "frequence", "montant"]]
    elif {"invoice", "invoice_date", "quantity", "price"}.issubset(df.columns):
        df["customer_id"] = df["customer_id"].astype(str)
        ref = pd.to_datetime(df["invoice_date"]).max() + pd.Timedelta(days=1)
        rfm = rfm_depuis_transactions(df, ref)
    else:
        raise HTTPException(
            400,
            "Colonnes attendues : (customer_id, recence, frequence, montant) "
            "ou (customer_id, invoice, invoice_date, quantity, price).",
        )

    predictions = predire_depuis_rfm(rfm)
    return ReponsePrediction(nb_clients=len(predictions), predictions=predictions)


app.mount("/static", StaticFiles(directory=DOSSIER_STATIC), name="static")
