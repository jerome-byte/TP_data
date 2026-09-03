import React, { useState, useMemo, useRef, useCallback } from "react";
import * as Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Plus,
  Menu,
  CheckCircle2,
  X,
  Layers,
  Tag,
  BarChart2,
  LayoutGrid,
  FlaskConical,
  Info,
  TrendingUp,
  Users,
  CreditCard,
  Clock,
  ShoppingBag,
  Target,
  ArrowRightLeft,
  Eye,
} from "lucide-react";

// ============================================================
// Types & Constantes
// ============================================================
interface Segment {
  id: number;
  nom: string;
  effectif: number;
  pctClients: number;
  pctCA: number;
  recence: number;
  frequence: number;
  montant: number;
  caTotal: number;
  recommandation: string;
  bgColor: string;
  badgeColor: string;
}

type RawRow = Record<string, string | number | undefined>;

const REAL_SEGMENTS: Segment[] = [
  {
    id: 0,
    nom: "Champions",
    effectif: 1182,
    pctClients: 20.2,
    pctCA: 73.3,
    recence: 27.6,
    frequence: 19.2,
    montant: 10590,
    caTotal: 12517347,
    recommandation: "Programme VIP dédié, accès anticipé aux nouveautés, pas de remise agressive.",
    bgColor: "bg-[#2C3832] text-white",
    badgeColor: "bg-emerald-500 text-white",
  },
  {
    id: 1,
    nom: "Clients à risque",
    effectif: 1455,
    pctClients: 24.9,
    pctCA: 16.9,
    recence: 227.4,
    frequence: 5.1,
    montant: 1978,
    caTotal: 2878426,
    recommandation: "Cross-selling ciblé, programme de fidélité par points.",
    bgColor: "bg-[#3A4E42] text-white",
    badgeColor: "bg-emerald-600 text-white",
  },
  {
    id: 2,
    nom: " Clients réguliers",
    effectif: 1246,
    pctClients: 21.3,
    pctCA: 6.1,
    recence: 28.2,
    frequence: 3.0,
    montant: 841,
    caTotal: 1048419,
    recommandation: "Offres personnalisées à forte valeur perçue avant décrochage définitif.",
    bgColor: "bg-[#4D6454] text-white",
    badgeColor: "bg-amber-600 text-white",
  },
  {
    id: 3,
    nom: "Clients endormis",
    effectif: 1969,
    pctClients: 33.6,
    pctCA: 3.7,
    recence: 392.6,
    frequence: 1.4,
    montant: 317,
    caTotal: 624376,
    recommandation: "Campagnes automatiques de réactivation à bas coût (e-mail / SMS).",
    bgColor: "bg-[#68826F] text-white",
    badgeColor: "bg-slate-500 text-white",
  },
];

const ELBOW_DATA = [
  { k: 2, inertie: 8500, silhouette: 0.44 },
  { k: 3, inertie: 6300, silhouette: 0.35 },
  { k: 4, inertie: 4850, silhouette: 0.365 },
  { k: 5, inertie: 4050, silhouette: 0.345 },
  { k: 6, inertie: 3480, silhouette: 0.34 },
  { k: 7, inertie: 3120, silhouette: 0.305 },
  { k: 8, inertie: 2820, silhouette: 0.298 },
  { k: 9, inertie: 2570, silhouette: 0.29 },
];
const K_RETENU = 4;

const ALIASES: Record<string, string[]> = {
  segment: ["nom_segment", "Segment", "segment", "cluster", "Cluster", "nom", "Nom"],
  effectif: ["Effectif", "effectif", "count", "Count"],
  recence: ["Recence", "recence", "Recence_moy", "Recency"],
  frequence: ["Frequence", "frequence", "Frequence_moy", "Frequency"],
  montant: ["Montant", "montant", "Montant_moy", "Monetary"],
  caTotal: ["CA_total", "CATotal", "ca_total", "Total_CA"],
};

function findValue(row: RawRow, field: string): string | number | undefined {
  const keys = Object.keys(row);
  for (const alias of ALIASES[field] || []) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
    if (match !== undefined && row[match] !== undefined && row[match] !== "") return row[match];
  }
  return undefined;
}

function toNumber(v: string | number | undefined, fallback = 0): number {
  if (v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function buildSegmentsFromRows(rows: RawRow[]): Segment[] {
  const hasEffectif = rows.length > 0 && findValue(rows[0], "effectif") !== undefined;
  let grouped: { nom: string; rows: RawRow[] }[];

  if (hasEffectif) {
    grouped = rows.map((r) => ({ nom: String(findValue(r, "segment") ?? "Segment"), rows: [r] }));
  } else {
    const map = new Map<string, RawRow[]>();
    rows.forEach((r) => {
      const key = String(findValue(r, "segment") ?? "Segment inconnu");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    grouped = Array.from(map.entries()).map(([nom, rs]) => ({ nom, rows: rs }));
  }

  const totalClients = hasEffectif
    ? grouped.reduce((a, g) => a + toNumber(findValue(g.rows[0], "effectif")), 0)
    : rows.length;

  const prelim = grouped.map((g, idx) => {
    const effectif = hasEffectif ? toNumber(findValue(g.rows[0], "effectif")) : g.rows.length;
    const mean = (f: string) => g.rows.reduce((a, r) => a + toNumber(findValue(r, f)), 0) / g.rows.length;
    const explicitCA = hasEffectif ? findValue(g.rows[0], "caTotal") : undefined;
    const caTotal = explicitCA !== undefined ? toNumber(explicitCA) : g.rows.reduce((a, r) => a + toNumber(findValue(r, "montant")), 0);

    return {
      id: idx,
      nom: g.nom,
      effectif,
      pctClients: totalClients > 0 ? +((effectif / totalClients) * 100).toFixed(1) : 0,
      recence: +mean("recence").toFixed(1),
      frequence: +mean("frequence").toFixed(1),
      montant: +mean("montant").toFixed(0),
      caTotal,
      recommandation: "Stratégie spécifique à définir pour ce segment.",
      bgColor: REAL_SEGMENTS[idx % REAL_SEGMENTS.length].bgColor,
      badgeColor: REAL_SEGMENTS[idx % REAL_SEGMENTS.length].badgeColor,
    };
  });

  const totalCA = prelim.reduce((a, s) => a + s.caTotal, 0);

  return prelim
    .map((s) => ({ ...s, pctCA: totalCA > 0 ? +((s.caTotal / totalCA) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.caTotal - a.caTotal)
    .map((s, idx) => ({ ...s, id: idx }));
}

function extractField(rows: RawRow[], field: string): number[] {
  return rows.map((r) => toNumber(findValue(r, field))).filter((v) => Number.isFinite(v));
}

function histogram(values: number[], bins = 8) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx]++;
  });
  return counts.map((c, i) => ({
    label: Math.round(min + i * width).toString(),
    count: c,
  }));
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function formatGBP(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

function corrCellColor(v: number) {
  const alpha = Math.min(1, Math.abs(v)) * 0.85 + 0.1;
  return `rgba(44,56,50,${alpha})`;
}

// ============================================================
// Composant Principal
// ============================================================
export default function RFMApp() {
  const [segments, setSegments] = useState<Segment[]>(REAL_SEGMENTS);
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  
  const [activeTab, setActiveTab] = useState<"global" | "detail">("global");
  const [globalViewMode, setGlobalViewMode] = useState<"charts" | "treemap" | "methodo">("charts");
  
  const [selectedSegmentId, setSelectedSegmentId] = useState<number>(0);
  const [logScale, setLogScale] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [fileName, setFileName] = useState<string | null>("clients_segmentes.csv");

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    Papa.parse<RawRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) return;
        const hasEffectif = findValue(result.data[0], "effectif") !== undefined;
        const built = buildSegmentsFromRows(result.data);
        if (built.length) {
          setSegments(built);
          setSelectedSegmentId(0);
        }
        setRawRows(hasEffectif ? null : result.data);
        setFileName(file.name);
      },
    });
  }, []);

  const totalCA = useMemo(() => segments.reduce((a, s) => a + s.caTotal, 0), [segments]);
  const totalClients = useMemo(() => segments.reduce((a, s) => a + s.effectif, 0), [segments]);
  const arpuGlobal = useMemo(() => (totalClients > 0 ? totalCA / totalClients : 0), [totalCA, totalClients]);
  const recenceMoyenneGlobal = useMemo(() => {
    if (!totalClients) return 0;
    const sum = segments.reduce((a, s) => a + s.recence * s.effectif, 0);
    return Math.round(sum / totalClients);
  }, [segments, totalClients]);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === selectedSegmentId) ?? segments[0],
    [segments, selectedSegmentId]
  );

  const comparisonData = useMemo(() => {
    return segments.map((s) => ({
      nom: s.nom,
      "CA Total (£)": s.caTotal,
      "Part CA (%)": s.pctCA,
      "Part Clients (%)": s.pctClients,
      "Effectif Clients": s.effectif,
      "Récence Moy. (j)": s.recence,
      "Fréquence Moy.": s.frequence,
      "ARPU (£)": s.effectif > 0 ? Math.round(s.caTotal / s.effectif) : 0,
    }));
  }, [segments]);

  const averageOtherSegments = useMemo(() => {
    const others = segments.filter((s) => s.id !== selectedSegment.id);
    if (!others.length) return { ca: 0, recence: 0, frequence: 0, arpu: 0, panier: 0 };
    const count = others.length;
    return {
      ca: Math.round(others.reduce((a, s) => a + s.caTotal, 0) / count),
      recence: +(others.reduce((a, s) => a + s.recence, 0) / count).toFixed(1),
      frequence: +(others.reduce((a, s) => a + s.frequence, 0) / count).toFixed(1),
      arpu: Math.round(others.reduce((a, s) => a + (s.effectif > 0 ? s.caTotal / s.effectif : 0), 0) / count),
      panier: Math.round(others.reduce((a, s) => a + (s.frequence > 0 ? s.montant / s.frequence : 0), 0) / count),
    };
  }, [segments, selectedSegment]);

  const benchmarkData = useMemo(() => {
    const segArpu = selectedSegment.effectif > 0 ? Math.round(selectedSegment.caTotal / selectedSegment.effectif) : 0;
    const segPanier = selectedSegment.frequence > 0 ? Math.round(selectedSegment.montant / selectedSegment.frequence) : 0;

    return [
      {
        indicateur: "Récence (Jours)",
        [selectedSegment.nom]: selectedSegment.recence,
        "Moyenne autres segments": averageOtherSegments.recence,
      },
      {
        indicateur: "Fréquence (Achats)",
        [selectedSegment.nom]: selectedSegment.frequence,
        "Moyenne autres segments": averageOtherSegments.frequence,
      },
      {
        indicateur: "Panier Moyen (£)",
        [selectedSegment.nom]: segPanier,
        "Moyenne autres segments": averageOtherSegments.panier,
      },
      {
        indicateur: "ARPU / Client (£)",
        [selectedSegment.nom]: segArpu,
        "Moyenne autres segments": averageOtherSegments.arpu,
      },
    ];
  }, [selectedSegment, averageOtherSegments]);

  const isRealMethodo = !!(rawRows && rawRows.length > 5);
  const recenceVals = rawRows ? extractField(rawRows, logScale ? "Recence_log" : "recence") : null;
  const frequenceVals = rawRows ? extractField(rawRows, logScale ? "Frequence_log" : "frequence") : null;
  const montantVals = rawRows ? extractField(rawRows, logScale ? "Montant_log" : "montant") : null;

  const histRecence = isRealMethodo
    ? histogram(recenceVals!)
    : histogram(logScale ? [1.1, 2.3, 3.4, 4.1, 4.8, 5.2, 5.7, 6.1] : [27, 45, 120, 220, 280, 350, 410]);
  const histFrequence = isRealMethodo
    ? histogram(frequenceVals!)
    : histogram(logScale ? [0.7, 1.2, 1.6, 2.1, 2.5, 3.0, 3.4] : [1, 2, 4, 8, 12, 19, 25]);
  const histMontant = isRealMethodo
    ? histogram(montantVals!)
    : histogram(logScale ? [5.7, 6.4, 7.2, 8.1, 8.9, 9.5, 10.2, 11.2] : [317, 841, 1978, 5000, 10590, 25000]);

  const corrRF = isRealMethodo ? pearson(extractField(rawRows, "recence"), extractField(rawRows, "frequence")) : logScale ? -0.56 : -0.26;
  const corrRM = isRealMethodo ? pearson(extractField(rawRows, "recence"), extractField(rawRows, "montant")) : logScale ? -0.50 : -0.12;
  const corrFM = isRealMethodo ? pearson(extractField(rawRows, "frequence"), extractField(rawRows, "montant")) : logScale ? 0.85 : 0.62;

  const navToDetail = (id: number) => {
    setSelectedSegmentId(id);
    setActiveTab("detail");
  };

  return (
    <div className="min-h-screen bg-[#E5E7E2] text-slate-800 p-4 md:p-8 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-5">

        {/* BANNIÈRE SUPÉRIEURE */}
        <div className="relative bg-[#23352B] text-white rounded-3xl p-6 md:p-8 overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xl font-bold tracking-tight text-emerald-300">TP_SEGMENTATION_RFM</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl transition flex items-center gap-2 font-medium"
              >
                <Plus size={14} /> Importer un CSV
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
            </div>
          </div>
        </div>

      

        {/* BARRE DE NAVIGATION PRINCIPALE */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("global")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition flex items-center gap-2 ${
                activeTab === "global"
                  ? "bg-[#2C3832] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BarChart2 size={16} /> Vue Globale des Segments
            </button>
            <button
              onClick={() => setActiveTab("detail")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition flex items-center gap-2 ${
                activeTab === "detail"
                  ? "bg-[#2C3832] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Eye size={16} /> Navigation Détail par Segment
            </button>
          </div>

          <span className="text-xs font-semibold text-slate-400 px-3 hidden md:inline">
            {activeTab === "global" ? "Vue d'ensemble stratégique" : `Exploration : ${selectedSegment.nom}`}
          </span>
        </div>

        {/* BANNIÈRE D'ALERTE */}
        {showAlert && (
          <div className="bg-[#CFDAC8] text-[#283B32] rounded-2xl p-3.5 px-5 flex items-center justify-between text-xs md:text-sm font-medium">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-[#283B32]" />
              <span>
                {activeTab === "global"
                  ? `Le segment ${segments[0]?.nom || "Champions"} génère ${segments[0]?.pctCA || 0}% du CA total.`
                  : `Vous analysez actuellement le segment "${selectedSegment.nom}". Basculez entre les segments ci-dessous.`}
              </span>
            </div>
            <button onClick={() => setShowAlert(false)} className="text-[#283B32]/60 hover:text-[#283B32]">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* PAGE 1 : VUE GLOBALE ET COMPARATIVE DES SEGMENTS */}
        {/* ============================================================ */}
        {activeTab === "global" && (
          <div className="space-y-6">
            
            {/* KPI GLOBAUX */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#23352B]/10 text-[#23352B] flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chiffre d'Affaires</span>
                  <span className="text-lg font-extrabold text-slate-900">{formatGBP(totalCA)}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#23352B]/10 text-[#23352B] flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Clients</span>
                  <span className="text-lg font-extrabold text-slate-900">{formatNumber(totalClients)}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#23352B]/10 text-[#23352B] flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CA Moyen / Client</span>
                  <span className="text-lg font-extrabold text-slate-900">{formatGBP(arpuGlobal)}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#23352B]/10 text-[#23352B] flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Récence Moyenne</span>
                  <span className="text-lg font-extrabold text-slate-900">{recenceMoyenneGlobal} jours</span>
                </div>
              </div>
            </div>

            {/* SECTION PRINCIPALE GLOBALE */}
            <div className="bg-[#F4F5F2] rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-6">
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Tag size={20} className="text-slate-700" />
                  <h2 className="text-xl font-bold text-slate-800">Analyse Comparative Globale</h2>
              
                </div>

                <div className="bg-white border border-slate-200 p-1 rounded-xl flex gap-1 text-xs font-medium">
                  <button
                    onClick={() => setGlobalViewMode("charts")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${globalViewMode === "charts" ? "bg-[#2C3832] text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    <BarChart2 size={14} /> Graphiques
                  </button>
                  <button
                    onClick={() => setGlobalViewMode("treemap")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${globalViewMode === "treemap" ? "bg-[#2C3832] text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    <LayoutGrid size={14} /> Treemap
                  </button>
                  <button
                    onClick={() => setGlobalViewMode("methodo")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${globalViewMode === "methodo" ? "bg-[#2C3832] text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    <FlaskConical size={14} /> Méthodologie
                  </button>
                </div>
              </div>

              {/* VUE 1 : GRAPHIQUES COMPARATIFS SÉPARÉS AVEC VALEURS VISIBLES */}
              {globalViewMode === "charts" && (
                <div className="space-y-6">

                  {/* DEUX GRAPHIQUES DISTINCTS AVEC ÉTIQUETTES INTÉGRÉES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* GRAPHIQUE 1 : REPARTITION DU CA */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <CreditCard size={16} className="text-[#2C3832]" />
                        Répartition du Chiffre d'Affaires (%)
                      </span>
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="nom" tick={{ fontSize: 10, fontWeight: 600 }} />
                            <YAxis unit="%" tick={{ fontSize: 10 }} domain={[0, 85]} />
                            <Tooltip formatter={(val: number) => [`${val}%`, "Part du CA"]} />
                            <Bar dataKey="Part CA (%)" fill="#2C3832" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="Part CA (%)" position="top" formatter={(val: number) => `${val}%`} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#2C3832' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* GRAPHIQUE 2 : REPARTITION BASE CLIENTS */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Users size={16} className="text-[#68826F]" />
                        Répartition de la Base Clients (%)
                      </span>
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="nom" tick={{ fontSize: 10, fontWeight: 600 }} />
                            <YAxis unit="%" tick={{ fontSize: 10 }} domain={[0, 45]} />
                            <Tooltip formatter={(val: number) => [`${val}%`, "Part Clients"]} />
                            <Bar dataKey="Part Clients (%)" fill="#68826F" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="Part Clients (%)" position="top" formatter={(val: number) => `${val}%`} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#68826F' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>

                  {/* AUTRES INDICATEURS COMPARATIFS AVEC ÉTIQUETTES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-xs font-bold text-slate-700 block mb-3">
                        Valeur Moyenne d'un Client (ARPU) par Segment
                      </span>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 55, left: 40, bottom: 5 }}>
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis dataKey="nom" type="category" tick={{ fontSize: 10 }} width={90} />
                            <Tooltip formatter={(val: number) => formatGBP(val)} />
                            <Bar dataKey="ARPU (£)" fill="#3A4E42" radius={[0, 4, 4, 0]}>
                              <LabelList dataKey="ARPU (£)" position="right" formatter={(val: number) => `£${formatNumber(val)}`} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#3A4E42' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-xs font-bold text-slate-700 block mb-3">
                        Récence Moyenne (Jours sans achat) par Segment
                      </span>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                            <XAxis dataKey="nom" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(val: number) => [`${val} jours`, "Récence"]} />
                            <Bar dataKey="Récence Moy. (j)" fill="#4D6454" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="Récence Moy. (j)" position="top" formatter={(val: number) => `${val}j`} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#4D6454' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* VUE 2 : TREEMAP */}
              {globalViewMode === "treemap" && (
                <div className="grid grid-cols-12 gap-2 h-72">
                  {segments[0] && (
                    <button onClick={() => navToDetail(segments[0].id)} className={`${segments[0].bgColor} col-span-5 rounded-2xl p-4 flex flex-col justify-between shadow-sm text-left transition hover:opacity-95`}>
                      <span className="text-xs text-slate-300 font-medium">{segments[0].nom}</span>
                      <div>
                        <span className="text-2xl font-extrabold text-white">{segments[0].pctCA}%</span>
                        <p className="text-[10px] text-slate-300 mt-0.5">{formatGBP(segments[0].caTotal)}</p>
                      </div>
                    </button>
                  )}
                  <div className="col-span-4 grid grid-rows-2 gap-2">
                    {segments.slice(1, 3).map((s) => (
                      <button key={s.id} onClick={() => navToDetail(s.id)} className={`${s.bgColor} rounded-2xl p-4 flex flex-col justify-between shadow-sm text-left transition hover:opacity-95`}>
                        <span className="text-xs text-slate-300 font-medium">{s.nom}</span>
                        <span className="text-xl font-bold text-white">{s.pctCA}%</span>
                      </button>
                    ))}
                  </div>
                  <div className="col-span-3 grid grid-rows-2 gap-2">
                    {segments.slice(3).map((s) => (
                      <button key={s.id} onClick={() => navToDetail(s.id)} className={`${s.bgColor} rounded-2xl p-4 flex flex-col justify-between shadow-sm text-left transition hover:opacity-95`}>
                        <span className="text-xs text-slate-300 font-medium">{s.nom}</span>
                        <span className="text-lg font-bold text-white">{s.pctCA}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* VUE 3 : MÉTHODOLOGIE */}
              {globalViewMode === "methodo" && (
                <div className="space-y-4">
                  {!isRealMethodo && (
                    <div className="flex items-start gap-2 bg-[#E3E8E0] border border-[#BAC3B4] text-[#2C3832] text-xs rounded-xl px-3.5 py-2.5">
                      <Info size={14} className="mt-0.5 flex-shrink-0 text-[#2C3832]" />
                      <span>Affichage calibré sur les données de référence (5 852 clients).</span>
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Distributions Récence / Fréquence / Montant</span>
                      <button
                        onClick={() => setLogScale((v) => !v)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition ${logScale ? "bg-[#2C3832] text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Échelle log {logScale ? "activée" : "désactivée"}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 h-36">
                      {[
                        { label: "Récence", data: histRecence },
                        { label: "Fréquence", data: histFrequence },
                        { label: "Montant", data: histMontant },
                      ].map((d) => (
                        <div key={d.label} className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-semibold mb-1">{d.label}</span>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={d.data}>
                              <Bar dataKey="count" fill="#4D6454" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-xs font-bold text-slate-600">Corrélation entre R, F, M</span>
                      <div className="mt-3 grid grid-cols-4 gap-1 text-[10px]">
                        <div />
                        {["Réc.", "Fréq.", "Mont."].map((l) => (
                          <div key={l} className="text-center font-semibold text-slate-500">{l}</div>
                        ))}
                        {["Récence", "Fréquence", "Montant"].map((rowLabel, ri) => {
                          const vals = [
                            ri === 0 ? 1 : ri === 1 ? corrRF : corrRM,
                            ri === 1 ? 1 : ri === 0 ? corrRF : corrFM,
                            ri === 2 ? 1 : ri === 0 ? corrRM : corrFM,
                          ];
                          return (
                            <React.Fragment key={rowLabel}>
                              <div className="text-slate-500 font-semibold flex items-center">{rowLabel.slice(0, 4)}.</div>
                              {vals.map((v, ci) => (
                                <div key={ci} className="rounded-lg h-9 flex items-center justify-center text-white font-bold" style={{ background: corrCellColor(v) }}>
                                  {v.toFixed(2)}
                                </div>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                      <span className="text-xs font-bold text-slate-600">Choix de k : coude &amp; silhouette</span>
                      <div className="h-28 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ELBOW_DATA} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                            <XAxis dataKey="k" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <ReferenceLine x={K_RETENU} stroke="#68826F" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="silhouette" stroke="#2C3832" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLEAU RÉSUMÉ DES SEGMENTS */}
              <div className="pt-2">
                <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2">
                  <span className="col-span-4">Segment</span>
                  <span className="col-span-2 text-right">Effectif</span>
                  <span className="col-span-2 text-right">Récence</span>
                  <span className="col-span-2 text-right">Fréquence</span>
                  <span className="col-span-2 text-right">CA total</span>
                </div>
                <div className="space-y-1">
                  {segments.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navToDetail(s.id)}
                      className="w-full grid grid-cols-12 items-center text-xs font-medium p-3 rounded-xl transition text-left bg-white/70 hover:bg-white shadow-xs"
                    >
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#2C3832] text-white flex items-center justify-center text-xs font-bold">
                          {s.nom.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800">{s.nom}</span>
                      </div>
                      <div className="col-span-2 text-right text-slate-600">{formatNumber(s.effectif)}</div>
                      <div className="col-span-2 text-right text-slate-600">{s.recence} j</div>
                      <div className="col-span-2 text-right text-slate-600">{s.frequence}</div>
                      <div className="col-span-2 text-right font-bold text-slate-800">{formatGBP(s.caTotal)}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PAGE 2 : PAGE NAVIGATION DÉTAILLÉE DU SEGMENT */}
        {/* ============================================================ */}
        {activeTab === "detail" && (
          <div className="space-y-6">

            {/* SÉLECTEUR D'ONGLETS POUR LES 4 SEGMENTS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {segments.map((seg) => {
                const isSelected = seg.id === selectedSegment.id;
                return (
                  <button
                    key={seg.id}
                    onClick={() => setSelectedSegmentId(seg.id)}
                    className={`p-4 rounded-2xl text-left transition-all duration-200 border flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#2C3832] text-white border-[#2C3832] shadow-md scale-[1.02]"
                        : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? "bg-emerald-400 text-[#1A2821]" : "bg-slate-100 text-slate-600"}`}>
                        Segment {seg.id + 1}
                      </span>
                      <span className={`text-[10px] font-extrabold ${isSelected ? "text-emerald-300" : "text-slate-400"}`}>
                        {seg.pctCA}% CA
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm md:text-base leading-tight mb-1">{seg.nom}</h3>
                      <p className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        {formatNumber(seg.effectif)} clients ({seg.pctClients}%)
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* FICHES DÉTAILLÉES ET GRAPHIQUE BENCHMARK DU SEGMENT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* CÔTÉ GAUCHE : INDICATEURS & GRAPHIQUE BENCHMARK AVEC VALEURS VISIBLES */}
              <div className="lg:col-span-7 bg-[#F4F5F2] rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-6">

                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fiche Détaillée</span>
                    <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
                      {selectedSegment.nom}
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${selectedSegment.badgeColor}`}>
                        {selectedSegment.pctCA}% du CA
                      </span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chiffre d'Affaires</span>
                    <span className="text-xl font-extrabold text-[#23352B]">{formatGBP(selectedSegment.caTotal)}</span>
                  </div>
                </div>

                {/* CARTES KPI */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase mb-1">
                      <Users size={12} /> Clients
                    </div>
                    <span className="text-base font-extrabold text-slate-900 block">{formatNumber(selectedSegment.effectif)}</span>
                    <span className="text-[10px] text-slate-500">{selectedSegment.pctClients}% du total</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase mb-1">
                      <Clock size={12} /> Récence
                    </div>
                    <span className="text-base font-extrabold text-slate-900 block">{selectedSegment.recence} j</span>
                    <span className="text-[10px] text-slate-500">Dernier achat</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase mb-1">
                      <ShoppingBag size={12} /> Fréquence
                    </div>
                    <span className="text-base font-extrabold text-slate-900 block">{selectedSegment.frequence}</span>
                    <span className="text-[10px] text-slate-500">Achats moy.</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase mb-1">
                      <CreditCard size={12} /> ARPU
                    </div>
                    <span className="text-base font-extrabold text-slate-900 block">
                      {formatGBP(selectedSegment.effectif > 0 ? selectedSegment.caTotal / selectedSegment.effectif : 0)}
                    </span>
                    <span className="text-[10px] text-slate-500">Dépense / client</span>
                  </div>
                </div>

                {/* GRAPHIQUE BENCHMARK AVEC ÉTIQUETTES DE VALEURS */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <ArrowRightLeft size={16} className="text-[#2C3832]" />
                    Positionnement : {selectedSegment.nom} vs Moyenne des autres segments
                  </span>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={benchmarkData} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="indicateur" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey={selectedSegment.nom} fill="#2C3832" radius={[4, 4, 0, 0]}>
                          <LabelList position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#2C3832' }} />
                        </Bar>
                        <Bar dataKey="Moyenne autres segments" fill="#A3B19B" radius={[4, 4, 0, 0]}>
                          <LabelList position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#72826A' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* CÔTÉ DROIT : ACTIONS STRATÉGIQUES ET GAUGES RFM */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-2 text-[#23352B]">
                    <Target size={20} />
                    <h3 className="text-lg font-extrabold">Plan d'Action Recommandé</h3>
                  </div>

                  <div className="bg-[#23352B] text-white p-4 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Stratégie Marketing</span>
                    <p className="text-xs leading-relaxed text-slate-200">
                      {selectedSegment.recommandation}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold text-slate-700 block">Jauges de Profil RFM</span>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-500 font-medium">Récence (Jours)</span>
                          <span className="font-bold text-slate-800">{selectedSegment.recence} j</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#2C3832] h-full" style={{ width: `${Math.min(100, (selectedSegment.recence / 400) * 100)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-500 font-medium">Fréquence (Achats)</span>
                          <span className="font-bold text-slate-800">{selectedSegment.frequence}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#3A4E42] h-full" style={{ width: `${Math.min(100, (selectedSegment.frequence / 20) * 100)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-500 font-medium">Dépense Moyenne Cumulée</span>
                          <span className="font-bold text-slate-800">{formatGBP(selectedSegment.montant)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#4D6454] h-full" style={{ width: `${Math.min(100, (selectedSegment.montant / 11000) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
