/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IataTaxDefinition {
  code: string;
  name: string;
  category: "Security" | "Airport/Passenger" | "Government/Solidarity" | "Airlines Surcharge" | "Infrastructure" | "Other";
  description: string;
}

export const IATA_TAXES_DICTIONARY: Record<string, IataTaxDefinition> = {
  YQF: {
    code: "YQF",
    name: "Fuel and Carrier Service Surcharge (YQ/YQF)",
    category: "Airlines Surcharge",
    description: "Surcharge imposed by the air carrier to offset fluctuations in aviation fuel costs and fund flight services."
  },
  YQ: {
    code: "YQ",
    name: "Fuel Surcharge",
    category: "Airlines Surcharge",
    description: "Surcharges applied by the airline to offset volatile variations in aviation fuel prices."
  },
  YR: {
    code: "YR",
    name: "Company Security and Service Surcharge",
    category: "Airlines Surcharge",
    description: "Overhead fees imposed by the carrier for security, fleet insurance, or CRS distribution services."
  },
  YRF: {
    code: "YRF",
    name: "Additional Insurance and Security Fee",
    category: "Airlines Surcharge",
    description: "Surcharges for commercial security and insurance against risks associated with major events."
  },
  YH: {
    code: "YH",
    name: "National Tourism Promotion Tax",
    category: "Government/Solidarity",
    description: "Government contribution levied on international tickets to fund tourism development offices."
  },
  YL: {
    code: "YL",
    name: "Solidarity and Environmental Protection Tax",
    category: "Government/Solidarity",
    description: "Funding for development aid programs or civil aviation ecological transition fees."
  },
  CF: {
    code: "CF",
    name: "Passenger Service Charge / Central Africa Airport Tax",
    category: "Airport/Passenger",
    description: "Tax collected on behalf of the Central African airport authority for the use of departure terminals."
  },
  CI: {
    code: "CI",
    name: "National Solidarity Tax (Côte d'Ivoire)",
    category: "Government/Solidarity",
    description: "Special Ivorian solidarity fund applied to every airline ticket issued departing from Côte d'Ivoire."
  },
  CI3: {
    code: "CI3",
    name: "Airport Security Fee (Côte d'Ivoire)",
    category: "Security",
    description: "Tax for funding passenger and baggage inspection and screening systems at Abidjan airport."
  },
  CI5: {
    code: "CI5",
    name: "Road and Air Development Passenger Tax (CI)",
    category: "Infrastructure",
    description: "Contribution to the structural development of airport links and national aeronautical infrastructure."
  },
  CV: {
    code: "CV",
    name: "Surtaxe de l'Aviation Civile Nationale",
    category: "Government/Solidarity",
    description: "Redevance de supervision de la sécurité des vols collectée pour l'Autorité Nationale de l'Aviation Civile."
  },
  DF: {
    code: "DF",
    name: "Taxe de Développement d'Infrastructure Aéroportuaire",
    category: "Infrastructure",
    description: "Prélèvement destiné au financement des nouvelles pistes, extensions de terminaux et équipements de navigation modernes."
  },
  EB: {
    code: "EB",
    name: "Taxe d'Embarquement et Sûreté Passagers",
    category: "Security",
    description: "Prélèvement pour la gestion des terminaux d'embarquement et de l'inspection de sûreté électronique."
  },
  G5: {
    code: "G5",
    name: "Redevance d'Utilisation des Terminaux Terrestres",
    category: "Airport/Passenger",
    description: "Frais pour le maintien opérationnel des halls d'accueil, climatisation, signalétique et systèmes d'information."
  },
  G53: {
    code: "G53",
    name: "Redevance Passager Vol Régional - Communauté Économique",
    category: "Airport/Passenger",
    description: "Taxe d'aéroport spécifique simplifiée s'appliquant aux vols circulant dans une zone économique régionale."
  },
  GA: {
    code: "GA",
    name: "Taxe de Sûreté de l'aviation civile du Gabon",
    category: "Security",
    description: "Taxe de contrôle et de protection des a aérodromes et aéroports de transit gabonais."
  },
  AJ: {
    code: "AJ",
    name: "Redevance d'Assistance en Escale (Handling)",
    category: "Infrastructure",
    description: "Frais concédés pour l'assistance fournie au sol aux aéronefs (embarquement, passerelles, bagages)."
  },
  AJ2: {
    code: "AJ2",
    name: "Frais d'émission d'agence / Surtaxe administrative",
    category: "Other",
    description: "Frais de gestion administrative agréés IATA liés au traitement logistique des transactions en agence."
  },
  CD: {
    code: "CD",
    name: "Redevance de Développement de l'Aviation Civile",
    category: "Infrastructure",
    description: "Fonds réservés à la formation et à la modernisation des contrôles aériens de l'autorité de tutelle civile."
  },
  CD8: {
    code: "CD8",
    name: "Taxe Passager de Départ Régional de la RDC",
    category: "Airport/Passenger",
    description: "Perception officielle sur les vols intra-RDC et régionaux à destination de l'Afrique Centrale et de l'Est."
  },
  CDB: {
    code: "CDB",
    name: "Taxe d'Infrastructure de Piste de la RDC (IATA)",
    category: "Infrastructure",
    description: "Frais direct d'utilisation des pistes d'atterrissage nationaux pour la réfection des infrastructures d'envergure."
  },
  GM: {
    code: "GM",
    name: "Taxe Passager de l'Aéroport International de Banjul",
    category: "Airport/Passenger",
    description: "Redevance de service passager au départ de la Gambie."
  },
  GM2: {
    code: "GM2",
    name: "Taxe de Sûreté Technologique de Banjul (Gambie)",
    category: "Security",
    description: "Financement des systèmes de contrôle biométrique et de screening avancé en Gambie."
  },
  HP: {
    code: "HP",
    name: "Taxe de Service Passager Logistique (Aéroportuaire)",
    category: "Airport/Passenger",
    description: "Participation financière pour l'utilisation générale des halls, comptoirs d'enregistrement et tapis bagages."
  },
  J8: {
    code: "J8",
    name: "Taxe de Sûreté et de Solidarité de l'aviation",
    category: "Security",
    description: "Prélèvement solidaire reversé pour couvrir l'aide médicale urgente ou l'assistance technique de sûreté."
  },
  J82: {
    code: "J82",
    name: "Redevance Passager de Transit Aéroportuaire",
    category: "Airport/Passenger",
    description: "Tarif dégressif s'appliquant aux usagers de l'aéroport effectuant une escale sans changement de compagnie."
  },
  CM3: {
    code: "CM3",
    name: "Taxe de Développement Aérien Gouvernementale (Cameroun)",
    category: "Infrastructure",
    description: "Taxe d'État camerounaise pour favoriser la modernisation technologique et la conformité internationale des escales."
  },
  D7: {
    code: "D7",
    name: "Taxe Gouvernementale de l'Aviation Civile et Surveillance",
    category: "Government/Solidarity",
    description: "Redevance nationale collectée par les douanes et l'aviation civile pour réguler le trafic commercial."
  },
  FQ3: {
    code: "FQ3",
    name: "Redevance d'Aménagement et d'Inspection Aéroportuaire",
    category: "Security",
    description: "Fonds dédiés aux mises aux normes OACI pour les clôtures de périmètre et le contrôle anti-terroriste."
  },
  AO: {
    code: "AO",
    name: "Frais Gouvernementaux d'Entrée-Sortie Passager (Angola)",
    category: "Government/Solidarity",
    description: "Droits de visa douanier ou de police de l'air prélevés directement lors de l'achat électronique du titre de transport."
  },
  BX: {
    code: "BX",
    name: "Redevance Aéroportuaire Locale Passagers au Départ",
    category: "Airport/Passenger",
    description: "Consacrée à la maintenance des services d'urgence incendie et de secourisme aéroportuaire (SSIAE)."
  },
  JZ: {
    code: "JZ",
    name: "Taxe de Régulation du Secteur Aérien Civil",
    category: "Government/Solidarity",
    description: "Prélèvement régulateur des autorités nationales de supervision des contrats de concession de gestion terrestre."
  },
  M2: {
    code: "M2",
    name: "Redevance de Sûreté du Secrétariat Général",
    category: "Security",
    description: "Financement opérationnel de l'agence supra-nationale de l'aviation civile africaine."
  },
  BF: {
    code: "BF",
    name: "Taxe Passager d'Aéroport du Burkina Faso",
    category: "Airport/Passenger",
    description: "Redevance de mise à niveau de l'escale internationale d'Ouagadougou concédée."
  },
  BF2: {
    code: "BF2",
    name: "Taxe d'Infrastructure Aéronautique (Burkina Faso)",
    category: "Infrastructure",
    description: "Destinée aux travaux routiers et d'infrastructures de liaison aérienne intérieures."
  },
  BF3: {
    code: "BF3",
    name: "Redevance de Sûreté Embarquement (Burkina Faso)",
    category: "Security",
    description: "Collectée par l'Agence Nationale ANAC pour financer le corps spécialisé de sécurité des frontières."
  },
  BFJ: {
    code: "BFJ",
    name: "Taxe de Solidarité Régionale d'Afrique de l'Ouest (BF)",
    category: "Government/Solidarity",
    description: "Fonds de développement régional mis en commun pour réduire les disparités d'équipements aériens entre états membres."
  },
  GH: {
    code: "GH",
    name: "Taxe de Sûreté Aérodrome passager du Ghana",
    category: "Security",
    description: "Redevance ghanaenne affectée pour l'administration gérant la défense et la sécurité des pistes."
  },
  GN3: {
    code: "GN3",
    name: "Frais de Sûreté Embarquement Conakry (Guinée)",
    category: "Security",
    description: "Financement des brigades de police aéroportuaires et équipements de scannage par rayon X de l'aéroport Gbessia."
  },
  SL: {
    code: "SL",
    name: "Taxe Spéciale de Sûreté Passager (Sierra Leone)",
    category: "Security",
    description: "Redevance instituée par décret pour la lutte anti-piraterie aérienne à l'aéroport de Freetown Lungi."
  },
  SL5: {
    code: "SL5",
    name: "Frais de Développement d'Infrastructure Routière (SL)",
    category: "Infrastructure",
    description: "Financement du raccordement urbain et du franchissement d'estuaire vers le centre urbain."
  },
  W5: {
    code: "W5",
    name: "Taxe de Sûreté d'Embarquement Commerciale (Sénégal)",
    category: "Security",
    description: "Redevance appliquée aux passagers au départ de l'aéroport Blaise Diagne (AIBD) de Dakar."
  },
  W52: {
    code: "W52",
    name: "Redevance de Développement Aéroportuaire AIBD (Sénégal)",
    category: "Infrastructure",
    description: "Taxe spéciale affectée au remboursement de l'emprunt ayant financé la construction de l'aéroport moderne de Dakar."
  },
  Z42: {
    code: "Z42",
    name: "Taxe Spéciale d'Aide Humanitaire d'Urgence",
    category: "Government/Solidarity",
    description: "Prélèvement d'aide internationale institué pour les urgences médicales et sanitaires mondiales."
  },
  BJ2: {
    code: "BJ2",
    name: "Taxe de Sûreté Aéroportuaire de Cotonou (Bénin)",
    category: "Security",
    description: "Perception sur le contrôle et la sécurisation physique des terminaux internationaux béninois."
  },
  BJ3: {
    code: "BJ3",
    name: "Taxe d'Amélioration Durable du Service Passager (Bénin)",
    category: "Airport/Passenger",
    description: "Fonds destinés à l'introduction du wifi public, espaces lounge et fluidité douanière."
  },
  CT: {
    code: "CT",
    name: "Taxe Locale de Solidarité Provinciale",
    category: "Government/Solidarity",
    description: "Redevance municipale redistribuée pour la compensation environnementale riveraine."
  },
  E1: {
    code: "E1",
    name: "Frais de Traitement Informatique et Émissions de Sûreté",
    category: "Other",
    description: "Soutien aux réseaux d'échanges d'informations sécurisés de passagers (APIS/PNR)."
  },
  E12: {
    code: "E12",
    name: "Redevance d'Inspection Automatique des Bagages de Soute",
    category: "Security",
    description: "Frais d'exploitation des systèmes automatisés EDS d'analyse de soute pour la détection d'explosifs."
  },
  EF: {
    code: "EF",
    name: "Redevance Douanière Électronique de Billetterie",
    category: "Government/Solidarity",
    description: "Droit d'enregistrement fiscal dématérialisé pour la vérification automatisée de l'OACI."
  },
  JR: {
    code: "JR",
    name: "Taxe du Fonds d'Assurance Solidarité Sociale",
    category: "Government/Solidarity",
    description: "Taxe à but social prélevée pour les populations défavorisées et la santé communautaire."
  },
  CN: {
    code: "CN",
    name: "Redevance d'Aviation Civile du Cameroun (CCAA)",
    category: "Government/Solidarity",
    description: "Surcharge de sécurité de la CCAA pour assurer la conformité d'audit OACI du Cameroun."
  },
  CG6: {
    code: "CG6",
    name: "Taxe de Développement d'Infrastructure Aérienne du Congo",
    category: "Infrastructure",
    description: "Affectée aux chantiers d'amélioration des pistes d'atterrissage du Congo-Brazzaville."
  },
  AX: {
    code: "AX",
    name: "Taxe fédérale sur le transport aérien",
    category: "Airport/Passenger",
    description: "Taxe collectée pour un large éventail d'améliorations structurelles des corridors de transit."
  },
  AY: {
    code: "AY",
    name: "Taxe américaine de Sécurité Passager (9/11 Fee)",
    category: "Security",
    description: "Surcharge civile d'accompagnement de la TSA américaine pour la protection aéronautique."
  },
  US: {
    code: "US",
    name: "Taxe sur les transports internationaux gouvernementaux USA",
    category: "Government/Solidarity",
    description: "Perception sur l'arrivée ou le départ des transports transfrontaliers des territoires américains."
  }
};

/**
 * Fallback generator for unknown IATA codes or customized variations
 */
export function getIataTaxDefinition(code: string): IataTaxDefinition {
  const normalized = code.toUpperCase().trim();
  if (IATA_TAXES_DICTIONARY[normalized]) {
    return IATA_TAXES_DICTIONARY[normalized];
  }
  
  // Custom smart fallbacks for sub-codes or derivatives (e.g., YH2 -> YH)
  const rootCode2 = normalized.substring(0, 2);
  const rootCode3 = normalized.substring(0, 3);
  if (IATA_TAXES_DICTIONARY[rootCode3]) {
    return {
      ...IATA_TAXES_DICTIONARY[rootCode3],
      code: normalized
    };
  }
  if (IATA_TAXES_DICTIONARY[rootCode2]) {
    return {
      ...IATA_TAXES_DICTIONARY[rootCode2],
      code: normalized
    };
  }

  // General fallback by prefixes
  if (normalized.startsWith("YQ") || normalized.startsWith("YR")) {
    return {
      code: normalized,
      name: `Carrier Surcharge (${normalized})`,
      category: "Airlines Surcharge",
      description: "Fuel surcharge or operational fees applied directly by the air carrier."
    };
  }
  if (normalized.startsWith("CI") || normalized.startsWith("BF") || normalized.startsWith("BJ") || normalized.startsWith("SL") || normalized.startsWith("W")) {
    return {
      code: normalized,
      name: `Country Specific Charge (${normalized})`,
      category: "Airport/Passenger",
      description: "National tax or regulatory fee applicable in Sub-Saharan and West African territories."
    };
  }

  return {
    code: normalized,
    name: `Regulatory Aviation Tax (${normalized})`,
    category: "Other",
    description: "International civil aviation fee or specific IATA-listed airport tax."
  };
}
