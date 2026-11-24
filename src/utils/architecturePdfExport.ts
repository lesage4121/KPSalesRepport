/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ASKY_DARK: [number, number, number] = [50, 27, 10]; // #321B0A
const ASKY_GOLD: [number, number, number] = [232, 156, 29]; // #E89C1D
const ASKY_LIGHT_GOLD: [number, number, number] = [247, 186, 66]; // #F7BA42
const ASKY_CREAM: [number, number, number] = [250, 247, 242]; // #FAF7F2
const TEXT_DARK: [number, number, number] = [38, 22, 12];
const TEXT_MUTED: [number, number, number] = [110, 71, 43];

type TableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

function getLastY(doc: jsPDF, fallbackY: number): number {
  return (doc as TableDoc).lastAutoTable?.finalY ?? fallbackY;
}

function drawPageBanner(
  doc: jsPDF,
  sectionTag: string,
  title: string,
  subtitle: string,
  dateLabel: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ASKY_DARK);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setFillColor(...ASKY_GOLD);
  doc.rect(0, 30, pageWidth, 1.8, "F");

  doc.setTextColor(...ASKY_LIGHT_GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(sectionTag.toUpperCase(), 14, 10);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.text(title, 14, 18.5);

  doc.setTextColor(243, 233, 216);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, 14, 25.5);
  doc.text(dateLabel, pageWidth - 14, 25.5, { align: "right" });
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - 18) {
    doc.addPage();
    return 18;
  }
  return currentY;
}

function drawSectionHeading(
  doc: jsPDF,
  y: number,
  numberLabel: string,
  title: string
): number {
  const nextY = ensureSpace(doc, y, 16);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(253, 244, 227);
  doc.roundedRect(14, nextY, pageWidth - 28, 9, 1.5, 1.5, "F");
  doc.setFillColor(...ASKY_GOLD);
  doc.rect(14, nextY, 2.5, 9, "F");

  doc.setTextColor(...ASKY_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${numberLabel}. ${title}`, 19, nextY + 6);

  return nextY + 13;
}

function drawParagraph(
  doc: jsPDF,
  y: number,
  text: string,
  fontSize = 9.2
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const lines = doc.splitTextToSize(text, pageWidth - 28) as string[];
  const blockHeight = lines.length * (fontSize * 0.44) + 3;
  const startY = ensureSpace(doc, y, blockHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...TEXT_DARK);
  doc.text(lines, 14, startY);

  return startY + blockHeight;
}

function drawBulletList(
  doc: jsPDF,
  y: number,
  items: { label: string; detail: string }[]
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let curY = y;

  for (const item of items) {
    const fullText = `- ${item.label} : ${item.detail}`;
    const lines = doc.splitTextToSize(fullText, pageWidth - 32) as string[];
    const needed = lines.length * 4.1 + 1.8;
    curY = ensureSpace(doc, curY, needed);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...ASKY_DARK);
    doc.text(`- ${item.label} :`, 16, curY);

    const labelWidth = doc.getTextWidth(`- ${item.label} : `);
    const firstLineMax = pageWidth - 14 - (16 + labelWidth);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    if (firstLineMax > 45) {
      const wrappedFirst = doc.splitTextToSize(item.detail, firstLineMax) as string[];
      if (wrappedFirst.length === 1) {
        doc.text(wrappedFirst[0], 16 + labelWidth, curY);
        curY += 4.6;
        continue;
      }
    }

    const detailLines = doc.splitTextToSize(item.detail, pageWidth - 35) as string[];
    curY += 4.1;
    doc.text(detailLines, 20, curY);
    curY += detailLines.length * 4.0 + 1.5;
  }

  return curY + 1;
}

function addPageFooters(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(230, 215, 195);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      "ASKY Airlines · Documentation d'Architecture & Conception Technique (v5.0)",
      14,
      pageHeight - 8
    );
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - 14, pageHeight - 8, {
      align: "right",
    });
  }
}

export function buildApplicationArchitecturePdfDoc(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // =========================================================================
  // PAGE 1 : COUVERTURE / SYNTHESE EXECUTIVE
  // =========================================================================
  doc.setFillColor(...ASKY_DARK);
  doc.rect(0, 0, pageWidth, 68, "F");
  doc.setFillColor(...ASKY_GOLD);
  doc.rect(0, 68, pageWidth, 3, "F");

  doc.setTextColor(...ASKY_LIGHT_GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ASKY AIRLINES · DOCUMENT D'ARCHITECTURE LOGICIELLE", 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Rapport de Conception de Bout en Bout", 14, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(243, 233, 216);
  doc.text("Sales, Flight & Manifest Manager — Audit Stations, Programmes & BI Vols", 14, 41);

  doc.setFontSize(9);
  doc.text(
    `Version applicative : v5.0   |   Date d'edition : ${todayStr}   |   Architecture : React SPA Client-First`,
    14,
    58
  );

  // Executive KPI Summary Cards
  const cardW = (pageWidth - 28 - 9) / 4;
  const cards = [
    { title: "POLES METIERS", value: "3 Modules", sub: "Stations, Online, Vols" },
    { title: "PARSEURS DCS/VDS", value: "4 Moteurs", sub: "STA, VDS, PTRG*, G*L" },
    { title: "STOCKAGE LOCAL", value: "100% Client", sub: "IndexedDB + Storage" },
    { title: "ANALYTIQUE & BI", value: "7 Vues BI", sub: "Carte D3, Sieges, LF%" },
  ];
  cards.forEach((c, idx) => {
    const x = 14 + idx * (cardW + 3);
    doc.setFillColor(...ASKY_CREAM);
    doc.setDrawColor(230, 215, 195);
    doc.roundedRect(x, 78, cardW, 24, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(c.title, x + 3, 84);
    doc.setFontSize(12);
    doc.setTextColor(...ASKY_DARK);
    doc.text(c.value, x + 3, 92);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(c.sub, x + 3, 98.5);
  });

  let y = 112;
  y = drawSectionHeading(doc, y, "1", "Vision & Objectifs de la Plateforme");
  y = drawParagraph(
    doc,
    y,
    "L'application ASKY Sales, Flight & Manifest Manager a ete concue comme un poste de pilotage unifie dedie aux equipes financieres, commerciales et operationnelles d'ASKY Airlines. Elle transforme des journaux bruts issus des systemes aeroportuaires et de vente (fichiers texte WY*T#STA, programmes VDS, statuts PTRG* et manifestes DCS G*L...) en tableaux d'audit interactifs, rapprochements automatises, cartes de flux et exports institutionnels."
  );
  y = drawParagraph(
    doc,
    y,
    "Un choix architectural structurant guide l'ensemble de la solution : le traitement 100% cote client (Client-First). Les donnees sensibles (listes passagers, numeros de billets, recettes de stations) sont parsees, normalisees et persistees localement dans le navigateur de l'utilisateur via IndexedDB et LocalStorage, sans aucun transit vers un serveur tiers ni latence reseau."
  );

  y = drawSectionHeading(doc, y + 2, "2", "Architecture Technique & Stack Technologique");
  autoTable(doc, {
    startY: y,
    head: [["Couche Technique", "Technologies & Librairies", "Role dans l'Application"]],
    body: [
      [
        "Coeur UI & Typage",
        "React 19, TypeScript 5.8, Vite 6",
        "Application SPA modulaire fortement typee, compilation rapide et bundles optimises.",
      ],
      [
        "Routage & Historique",
        "React Router DOM v7 (BrowserRouter + URLSearchParams)",
        "Navigation multi-pages et synchronisation des sous-onglets, vols, modules BI et plein ecran dans l'historique navigateur.",
      ],
      [
        "Design System & Themes",
        "Tailwind CSS v4, Lucide React, Motion (Framer)",
        "Interface adaptative, charte ASKY (Chocolat/Or), mode Clair & mode Sombre, animations fluides.",
      ],
      [
        "Visualisation BI",
        "Recharts (Bar, Line, Composed, 3D Donut custom)",
        "Graphiques interactifs d'utilisation flotte, trafic journalier, previsions, cabines, bagages et no-show.",
      ],
      [
        "Cartographie Reseau",
        "D3-Geo, TopoJSON Client, World-Atlas (110m)",
        "Carte vectorielle interactive (projection Mercator), zoom/pan, troncons fleches colores par Load Factor, mode plein ecran.",
      ],
      [
        "Persistance Locale",
        "IndexedDB (kp_manifest_archive_db) & LocalStorage",
        "Archivage multi-jours des manifestes, sauvegarde des programmes VDS, statuts PTRG* et modifications manuelles d'equipement.",
      ],
      [
        "Exports Documentaires",
        "jsPDF, jspdf-autotable, SheetJS (XLSX)",
        "Generation de rapports PDF chartes ASKY, classeurs Excel multi-onglets, CSV UTF-8 BOM et scripts WINCMD ANSI.",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2.3, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 34 }, 1: { cellWidth: 58 } },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // PAGE 2 : PIPELINE DE BOUT EN BOUT & ROUTAGE
  // =========================================================================
  doc.addPage();
  drawPageBanner(
    doc,
    "ARCHITECTURE DE DONNEES & NAVIGATION",
    "Flux de Traitement de Bout en Bout & Structure des Routes",
    "De l'ingestion des logs bruts jusqu'aux modules decisionnels et exports",
    todayStr
  );

  y = 40;
  y = drawSectionHeading(doc, y, "3", "Pipeline de Bout en Bout (End-to-End Data Flow)");
  autoTable(doc, {
    startY: y,
    head: [["Etape", "Entrees / Composants", "Transformations & Regles Appliquees", "Sorties / Consommateurs"]],
    body: [
      [
        "1. Ingestion",
        "Drag & Drop ou selection de fichiers (.txt, .pnl, .pgl, .prl, .csv, .dat, .log)",
        "Lecture asynchrone File.text(), detection automatique d'encodage et decoupage des blocs par sauts de page ou commandes DCS.",
        "Flux texte brut transmis aux parseurs metier.",
      ],
      [
        "2. Parsing & Validation",
        "parser.ts, flightParser.ts, flightStatusParser.ts, manifestParser.ts",
        "Extraction regex/positionnelle des stations, segments VDS, details PTRG*, passagers, cabines, bagages, EMD et codes d'edition.",
        "Objets structures types (StationReport, FlightSegment, ManifestFlight).",
      ],
      [
        "3. Normalisation & Fusion",
        "aggregateManifestFlights(), normalizeDcsFlightDate(), normalizeStatusFlightNumber()",
        "Cle unique [Cie|NumVol|DateNormalisee|Origine], fusion sans doublon multi-fichiers, tri chronologique DCS.",
        "Jeu de donnees consolide multi-jours sans redondance.",
      ],
      [
        "4. Persistance Locale",
        "manifestDb.ts (IndexedDB), LocalStorage",
        "Stockage par journee (dateKey) dans IndexedDB; conservation des programmes, PTRG* et editions manuelles d'appareils.",
        "Rechargement instantane, historique multi-dates et hors-ligne.",
      ],
      [
        "5. Rapprochement & BI",
        "manifestReconciliation.ts, flightAnalytics.ts, airportCoordinates.ts",
        "Croisement Programme <-> Manifeste, chainage physique des escales, calcul LF%, No-Show, heatmap sieges et flux carte.",
        "KPIs unifies, alertes d'ecarts, tableaux croises et traces cartographiques.",
      ],
      [
        "6. Restitution & Exports",
        "Dashboards React, jsPDF, XLSX, CSV, ANSI",
        "Filtrage dynamique multi-criteres, affichage plein ecran, generation de rapports PDF/Excel/CSV et WINCMD ANSI.",
        "Decisionnel interactif et livrables prets a diffuser.",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.2 },
    styles: { fontSize: 7.8, cellPadding: 2.2, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 26 }, 1: { cellWidth: 42 } },
    margin: { left: 14, right: 14 },
  });

  y = getLastY(doc, y + 60) + 8;
  y = drawSectionHeading(doc, y, "4", "Architecture de Navigation, Contextes & Historique Navigateur");
  y = drawParagraph(
    doc,
    y,
    "L'application repose sur trois contextes React globaux (LanguageContext pour la bascule FR/EN instantanee via la fonction pick(), ThemeContext pour le mode Clair/ASKY Sombre persiste, et AuditContext pour la session d'audit stations) encapsules dans AppLayout."
  );

  autoTable(doc, {
    startY: y,
    head: [["Route / Parametre URL", "Page / Vue Associee", "Comportement & Historique Navigateur"]],
    body: [
      ["/", "Landing (Menu Principal)", "Portail d'entree donnant acces aux 3 poles : Stations Reports, Online Reports et Vols & Manifestes ASKY."],
      ["/import-station", "StationImporterPage", "Zone d'import des journaux de cloture de caisse WY*T#STA."],
      ["/audit", "AuditRegistry", "Registre d'audit financier des stations : anomalies, taxes IATA et soldes par devise."],
      ["/analytics", "Analytics (Stations)", "Graphiques financiers, ventilation par devise/mode de paiement et comparateur entre deux periodes."],
      ["/import-online", "OnlineImporterPage", "Espace dedie aux flux digitaux et auxiliaires (Limo, Cargo, Kiosques self-service)."],
      ["/flight-operations?tab=...", "FlightOperationsPage", "Onglets principaux : schedule (Programme), manifest (Manifestes) et analytics (BI & Carte)."],
      ["?tab=manifest&sub=...&flight=...", "Sous-vues Manifestes", "Navigation historisee : OVERVIEW, FLIGHT_DETAIL (+ ID vol), ALL_PASSENGERS, AUDIT, RECONCILIATION."],
      ["?tab=analytics&lens=...&mapfs=1", "Modules BI & Plein Ecran", "Navigation historisee entre les 7 vues BI et le plein ecran de la carte. Bouton Precedent revient etape par etape."],
    ],
    theme: "striped",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.2 },
    styles: { fontSize: 7.8, cellPadding: 2.1, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { cellWidth: 38 } },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // PAGE 3 : POLES METIERS - STATIONS & PROGRAMME DES VOLS
  // =========================================================================
  doc.addPage();
  drawPageBanner(
    doc,
    "CONCEPTION DES MODULES METIERS (1/2)",
    "Audit des Ventes Stations & Gestion du Programme des Vols",
    "Regles de parsing financier, generation WINCMD ANSI et surcharge equipement",
    todayStr
  );

  y = 40;
  y = drawSectionHeading(doc, y, "5", "Pole 1 : Stations Reports — Audit des Clotures ATO/CTO");
  y = drawBulletList(doc, y, [
    {
      label: "Base referentielle STATION_DB",
      detail: "Identification automatique de ~50 agences ville, aeroports et call centers ASKY (codes 8 chiffres vers code station LFWAP, ABJCT, NSIAP, DSSAP, etc., ville et pays).",
    },
    {
      label: "Parsing multidevise (WY*T#STA)",
      detail: "Decoupage des rapports de cloture, extraction des blocs devises (XOF, XAF, USD, EUR, GHS, NGN, GNF, etc.), ventiles entre ventes nettes, remboursements, commissions, modes de paiement (Cash, Carte, Cheque) et details de taxes (iata_taxes.ts).",
    },
    {
      label: "Consolidation & Controles",
      detail: "Conversion normalisee vers le Franc CFA (XOF via EXCHANGE_RATES_TO_XOF), detection des rapports vides ou en ecart d'equilibre comptable, filtrage croise et comparaison multi-periodes.",
    },
  ]);

  y = drawSectionHeading(doc, y + 2, "6", "Pole 3 (Etape 1) : Programme des Vols (VDS & PTRG*)");
  y = drawBulletList(doc, y, [
    {
      label: "Parsing VDS / Scheduled Flights",
      detail: "Lecture des programmes quotidiens : numero de vol, paire origine/destination (ex. LFW/ABJ), horaires ETD/ETA, type d'avion, ajustements operationnels et distinction stricte entre vols operes KP et vols en partage de codes (Codeshare).",
    },
    {
      label: "Generation de commandes WINCMD ANSI",
      detail: "Production en 1 clic des fichiers texte ANSI prets a coller/executer dans le terminal DCS : commandes d'extraction des manifestes (G*L...) et commandes de details operationnels (PTRG*/KPxx/DDMMMORG/D).",
    },
    {
      label: "Parsing PTRG* & Donnees Flotte",
      detail: "Extraction des immatriculations appareils (ex. ET-..., 5V-...), types avion (737, 738, B38M, etc.), capacites cabines reelles (C/Y), heures reels ATD/ATA et calcul des temps de vol et temps d'escale au sol.",
    },
    {
      label: "Modification Manuelle d'Equipement",
      detail: "Possibilite pour l'utilisateur de modifier ou surcharger l'immatriculation, le type d'appareil (737, 738, ...) et la capacite (Business/Eco) pour n'importe quel vol via FlightEquipmentEditModal. Ces surcharges persistent localement et priment sur les donnees par defaut.",
    },
  ]);

  // =========================================================================
  // PAGE 4 : PARSING MANIFESTES & REGLES METIER DCS
  // =========================================================================
  doc.addPage();
  drawPageBanner(
    doc,
    "CONCEPTION DES MODULES METIERS (2/2)",
    "Moteur de Parsing DCS (G*L...), Regles Bagages, No-Show & Rapprochement",
    "Logique d'extraction passagers, audit d'integrite et deduplication multi-troncons",
    todayStr
  );

  y = 40;
  y = drawSectionHeading(doc, y, "7", "Pole 3 (Etape 2) : Manifestes de Tous les Vols (manifestParser.ts)");
  y = drawParagraph(
    doc,
    y,
    "Le parseur de manifestes constitue le coeur analytique de la plateforme. Il analyse les sorties brutes G*L... pour reconstituer chaque vol (compagnie, numero, date, origine, porte, ETD, type appareil, configuration C/Y) ainsi que la fiche complete de chaque passager."
  );

  autoTable(doc, {
    startY: y,
    head: [["Domaine Metier", "Logique & Regles Implementees"]],
    body: [
      [
        "Cabines & Classes",
        "Classification Business (classes C, J, D, Z, I, R) vs Economie (Y), avec gestion des vols configures en pure economie (Yxx) et controle vs l'entete du vol.",
      ],
      [
        "Codes d'Edition DCS",
        "Dictionnaire complet interprete pour chaque passager : OB/IB/EIB (correspondances), ET/ETI/ETO (synchronisation billet), DOCV/DOCS/APP (documents/APIS), WB (web check-in), CS (codeshare), OFL (debarque).",
      ],
      [
        "Detection No-Show",
        "Un passager liste sans siege attribue ou marque OFL (Offloaded) est identifie automatiquement comme No-Show (isPassengerNoShow) et isole des passagers effectivement assis/transportes.",
      ],
      [
        "Audit & Conformite Bagages",
        "Extraction du nombre de pieces et du poids total (kg), detection des poids manquants (baggageMissingWeightCount), calcul des franchises autorisees par cabine et verification de la couverture des excedents par EMD (baggageUncoveredDeviationsCount vs baggageCoveredDeviationsCount).",
      ],
      [
        "Deduplication Passagers",
        "Lorsqu'un meme passager apparait sur plusieurs troncons d'un meme vol ou d'une meme journee, computeTransportedPassengerReport() distingue le volume brut d'embarquements et le comptage deduplique par billet/nom avec ventilation H/F/Enfant/Bebe.",
      ],
      [
        "5 Sous-Vues Specialisees",
        "1. Vue d'ensemble (filtres Date, Vol, Origine, Destination, Type, Immatriculation, Audit) | 2. Manifeste par Vol (fiche detaillee + Enhanced Manifest .TXT) | 3. Passagers Multi-Vols | 4. Ecarts & Audit | 5. Rapprochement Programme.",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2.3, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42 } },
    margin: { left: 14, right: 14 },
  });

  y = getLastY(doc, y + 60) + 8;
  y = drawSectionHeading(doc, y, "8", "Rapprochement Programme <-> Manifeste (manifestReconciliation.ts)");
  y = drawParagraph(
    doc,
    y,
    "Ce module compare automatiquement les troncons KP prevus au Programme des Vols avec les manifestes effectivement importes en utilisant la cle normalisee [NumeroVol | StationDepart]. Il classe chaque vol en 4 statuts : IMPORTED (rapproche), MISSING_IN_MANIFEST (prevu mais manquant, avec generation directe de la commande WINCMD de recuperation), EXTRA_IN_MANIFEST (present dans le manifeste hors programme), et CODESHARE_INFO."
  );

  // =========================================================================
  // PAGE 5 : MOTEUR BI, CHAINAGE DES VOLS & CARTOGRAPHIE
  // =========================================================================
  doc.addPage();
  drawPageBanner(
    doc,
    "INTELLIGENCE DECISIONNELLE & CARTOGRAPHIE",
    "Statistiques, Analyses BI & Carte Interactive du Reseau",
    "Source unique Manifeste, resolution des troncons physiques et modules separes",
    todayStr
  );

  y = 40;
  y = drawSectionHeading(doc, y, "9", "Source Unique de Verite & Resolution des Troncons Physiques");
  y = drawParagraph(
    doc,
    y,
    "Dans la vue Statistiques & Analyses (flightAnalytics.ts), tous les indicateurs (nombre total de vols, passagers transportes, Load Factor, taux de No-Show, bagages) sont calcules strictement a partir des donnees des manifestes afin de garantir une coherence absolue avec l'onglet Manifeste de Tous les Vols."
  );
  y = drawParagraph(
    doc,
    y,
    "Pour eviter les faux trajets sur les vols multi-escales (exemple : un vol KP15 operant NKC -> CKY -> LFW ou des passagers montent a NKC pour CKY et LFW), chaque vol du manifeste est resolu vers son unique troncon physique reel (prochaine escale physique) grace a une cascade de priorites :"
  );

  y = drawBulletList(doc, y, [
    {
      label: "Priorite 1 (Programme VDS meme date)",
      detail: "Correspondance exacte sur [NumeroVol | Origine | Date] dans les segments operes du Programme des Vols.",
    },
    {
      label: "Priorite 2 (Details PTRG* meme date)",
      detail: "Extraction de la station suivante dans la chaine d'escales (legs) issue des statuts PTRG*.",
    },
    {
      label: "Priorite 3 (Chainage entre manifestes pairs)",
      detail: "Si KPxx part de NKC puis de CKY le meme jour avec intersection de destinations passagers, NKC est chaine physiquement vers CKY.",
    },
    {
      label: "Priorite 4 (Destination majoritaire du manifeste)",
      detail: "Utilisation de primaryDestination lorsqu'aucune escale intermediaire n'est detectee.",
    },
    {
      label: "Priorite 5 (Repli inter-dates pour vols a 0 pax)",
      detail: "Si un troncon est vide (0 passager), recherche sur les autres dates disponibles du Programme, PTRG* ou manifestes pairs pour eviter toute perte de vol sur la carte.",
    },
  ]);

  y = drawSectionHeading(doc, y + 2, "10", "Architecture Modulaire des 6 Vues BI & Carte Plein Ecran");
  autoTable(doc, {
    startY: y,
    head: [["Module BI", "Visualisations & Indicateurs Cles", "Specificites d'Ergonomie"]],
    body: [
      [
        "1. Trafic & O&D",
        "Evolution journaliere Pax & LF%, Prevision 7/14/30j (Lineaire / Moyenne Mobile), Top Destinations O&D, Matrice Vols/Secteurs.",
        "Suppression des KPIs redondants pour maximiser la lisibilite des tendances et previsions.",
      ],
      [
        "2. Reseau & Carte",
        "Carte D3-Geo interactive, lignes courbes flechees, epaisseur Pax/Frequence, couleur par tranche LF% (>=85% Vert, 65-84% Bleu, 45-64% Ambre, <45% Rose).",
        "Mode Plein Ecran integral (100% ecran sans aucun panneau parasite) + bandeau diagnostic si un vol manque de coordonnees IATA.",
      ],
      [
        "3. Flotte & Vols",
        "Utilisation par Immatriculation (Sieges & LF%) pleine largeur pour 16+ appareils, temps de vol/sol (Cumul, Journalier, Gantt), Donut 3D types avion.",
        "Tri dynamique par volume Pax ou LF% et prise en compte instantanee des equipements modifies manuellement.",
      ],
      [
        "4. Cabines & Sièges",
        "Repartition Business/Eco, classes tarifaires, module d'occupation sieges (Hublot/Milieu/Couloir, Zones A 1-4 / B 11-29 / C 30+, Heatmap par rangee).",
        "Filtre interactif Toutes cabines / Eco / Business sur la carte thermique des sieges.",
      ],
      [
        "5. Bagages",
        "Poids total, moyenne kg/pax & kg/bagage, compteurs EMD, ecarts non couverts, poids manquants et tableau d'audit par vol.",
        "Filtre 'Anomalies uniquement' et recherche directe par vol, escale ou immatriculation.",
      ],
      [
        "6. No-Show",
        "Taux d'attrition global et par vol, listes detaillees des passagers non embarques/sans siege, exports PDF/Excel/CSV dedies.",
        "Bascule instantanee Vue par Vol <-> Vue Passagers No-Show.",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.2 },
    styles: { fontSize: 7.7, cellPadding: 2.1, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 32 }, 1: { cellWidth: 80 } },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // PAGE 6 : PERSISTANCE, SECURITE & CARTOGRAPHIE DES FICHIERS
  // =========================================================================
  doc.addPage();
  drawPageBanner(
    doc,
    "PERSISTANCE, SECURITE & INVENTAIRE TECHNIQUE",
    "Stockage Local, Regles de Securite & Cartographie du Codebase",
    "Garanties de confidentialite, integrite des calculs et organisation modulaire",
    todayStr
  );

  y = 40;
  y = drawSectionHeading(doc, y, "11", "Persistance, Confidentialite & Qualite Logicielle");
  y = drawBulletList(doc, y, [
    {
      label: "Base locale IndexedDB (manifestDb.ts)",
      detail: "Stocke chaque journee sous la base kp_manifest_archive_db (store daily_manifests indexe par dateKey). Permet de combiner a la volee plusieurs jours pour les analyses mensuelles ou pluri-hebdomadaires.",
    },
    {
      label: "Stockage LocalStorage",
      detail: "Conserve le dernier programme des vols actif, l'historique des segments VDS, les statuts PTRG*, les surcharges manuelles d'equipement et les preferences utilisateur (langue FR/EN, theme Clair/ASKY Sombre).",
    },
    {
      label: "Confidentialite & Securite Client-First",
      detail: "Aucune donnee passager (noms, passeports APIS, numeros de billets) ni recette financiere n'est transmise a une API externe. Echappement strict des formules et separateurs dans les exports CSV/Excel et absence d'injection HTML brute.",
    },
    {
      label: "Reconciliation Carte <-> Manifeste",
      detail: "Base airportCoordinates.ts etendue a l'ensemble du reseau Afrique Ouest/Centrale/Est/Sud, Europe, Moyen-Orient et Amerique du Nord, avec affichage explicite en pied de carte de tout vol exclu pour absence de coordonnees ou de destination distincte.",
    },
  ]);

  y = drawSectionHeading(doc, y + 2, "12", "Cartographie Principale des Modules Source (src/)");
  autoTable(doc, {
    startY: y,
    head: [["Repertoire / Fichier", "Responsabilite Architecturale"]],
    body: [
      ["src/App.tsx, src/pages/*", "Point d'entree Router, Landing, StationImporterPage, AuditRegistry, Analytics, OnlineImporterPage, FlightOperationsPage."],
      ["src/context/*", "AuditContext (etat financier stations), LanguageContext (FR/EN), ThemeContext (Clair/Sombre)."],
      ["src/parser.ts, src/iata_taxes.ts", "Parseur des journaux de ventes stations WY*T#STA, dictionnaire STATION_DB et referentiel des taxes IATA."],
      ["src/utils/flightParser.ts", "Parseur des programmes VDS, normalisation des horaires et persistance multi-dates des segments."],
      ["src/utils/flightStatusParser.ts", "Generateur WINCMD PTRG*, parseur statuts operationnels, gestion des immatriculations et surcharges equipement."],
      ["src/utils/manifestParser.ts", "Parseur DCS G*L..., regles cabines/bagages/No-Show, deduplication passagers et export Enhanced Manifest .TXT."],
      ["src/utils/manifestDb.ts", "Couche d'abstraction IndexedDB pour l'archivage quotidien et l'agregation multi-dates des manifestes."],
      ["src/utils/manifestReconciliation.ts", "Moteur de rapprochement Programme des Vols <-> Manifestes et generation WINCMD des vols manquants."],
      ["src/utils/flightAnalytics.ts", "Moteur BI unifie : resolution des troncons physiques, KPIs, serie temporelle, previsions, heatmap sieges et flux carte."],
      ["src/utils/airportCoordinates.ts", "Referentiel geographique IATA (lat/lng, ville, pays, hub) alimentant la carte vectorielle D3-Geo."],
      ["src/utils/flightStatsExport.ts & pdfExport.ts", "Generateurs PDF (jsPDF), Excel multi-onglets (XLSX) et CSV UTF-8 pour rapports operationnels, No-Show et Audit."],
      ["src/components/flights/*", "Composants metier : ScheduledFlightsViewer, FlightManifestUploader, FlightAnalyticsDashboardView, FlightRouteMapModule, FlightSeatOccupancyModule, FlightBiMatrices, Modales & Drawers."],
    ],
    theme: "grid",
    headStyles: { fillColor: ASKY_DARK, textColor: ASKY_LIGHT_GOLD, fontStyle: "bold", fontSize: 8.2 },
    styles: { fontSize: 7.7, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 58 } },
    margin: { left: 14, right: 14 },
  });

  addPageFooters(doc);
  return doc;
}

export function exportApplicationArchitecturePDF(
  filename = "ASKY_Rapport_Conception_Application.pdf"
) {
  const doc = buildApplicationArchitecturePdfDoc();
  doc.save(filename);
}
