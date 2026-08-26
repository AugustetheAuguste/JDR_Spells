/**
 * The tag taxonomy, as the filter panel presents it.
 *
 * The enrichment layer carries 35 closed tags in one flat list
 * (`conventions/vocabulaires/tags.json`). Thirty-five checkboxes in one column is
 * not a filter, it is an inventory: nothing tells the reader that
 * `charme_ou_coercition` and `effet_mental` answer the same question, so the only
 * way to use it is to read all thirty-five every time. Grouping them by the
 * question they answer is what makes the panel scannable.
 *
 * This is presentation only. The groups exist nowhere in the corpus and carry no
 * authority: the closed list stays the closed list, and a tag's key is unchanged.
 * A tag the corpus exports and this table does not know lands in « Autres » —
 * never dropped, because a silently missing filter is a filter the reader looks
 * for and cannot find (CLAUDE.md § 3, nothing is discarded silently).
 *
 * Labels are written out with their accents: `duree_prolongee` shown raw reads as
 * a database column, and the panel is read by players, not by the pipeline.
 */

export interface GroupeTags {
  readonly titre: string
  readonly tags: readonly string[]
}

/** Display labels. A tag absent from here falls back to its key, spaces for `_`. */
export const LIBELLES_TAGS: Readonly<Record<string, string>> = {
  degats_directs: 'Dégâts directs',
  soin_ou_guerison: 'Soin ou guérison',
  amelioration_de_capacite: 'Amélioration de capacité',
  affaiblissement_de_capacite: 'Affaiblissement de capacité',
  transformation_du_sujet: 'Transformation du sujet',
  entrave_ou_immobilisation: 'Entrave ou immobilisation',
  plusieurs_cibles: 'Plusieurs cibles',
  zone_d_effet: 'Zone d’effet',
  rayon_ou_projectile: 'Rayon ou projectile',
  attaque_de_contact: 'Attaque de contact',
  effet_mental: 'Effet mental',
  charme_ou_coercition: 'Charme ou coercition',
  confusion_ou_desorientation: 'Confusion ou désorientation',
  protection_defensive: 'Protection défensive',
  immunite_ou_resistance_element: 'Immunité ou résistance à un élément',
  dissipation_ou_contresort: 'Dissipation ou contresort',
  resistance_a_la_magie: 'Résistance à la magie',
  detection_ou_revelation: 'Détection ou révélation',
  divination_information: 'Divination',
  perception_amelioree: 'Perception améliorée',
  communication_ou_langage: 'Communication ou langage',
  invocation_ou_creation: 'Invocation ou création',
  illusion_visuelle_ou_sonore: 'Illusion visuelle ou sonore',
  invisibilite_ou_dissimulation: 'Invisibilité ou dissimulation',
  duree_instantanee: 'Durée instantanée',
  duree_prolongee: 'Durée prolongée',
  bonus_chiffre: 'Bonus chiffré',
  malus_chiffre: 'Malus chiffré',
  jet_de_sauvegarde: 'Jet de sauvegarde',
  arme_ou_munition: 'Arme ou munition',
  objet_ou_equipement: 'Objet ou équipement',
  terrain_ou_environnement: 'Terrain ou environnement',
  deplacement_ou_teleportation: 'Déplacement ou téléportation',
  alignement_ou_divin: 'Alignement ou divin',
  metamagie_ou_sort_cible: 'Métamagie ou sort ciblé',
}

export function libelleTag(tag: string): string {
  return LIBELLES_TAGS[tag] ?? tag.replaceAll('_', ' ')
}

/**
 * The groups, in panel order.
 *
 * Ordered by how a spell is looked for at the table: what it does first, then who
 * it hits, then the narrower families. « Chiffres » and « Durée » sit low because
 * they qualify a spell already found rather than help find one.
 */
export const GROUPES_TAGS: readonly GroupeTags[] = [
  {
    titre: 'Effet sur la cible',
    tags: [
      'degats_directs',
      'soin_ou_guerison',
      'amelioration_de_capacite',
      'affaiblissement_de_capacite',
      'transformation_du_sujet',
      'entrave_ou_immobilisation',
    ],
  },
  {
    titre: 'Cible et portée',
    tags: ['plusieurs_cibles', 'zone_d_effet', 'rayon_ou_projectile', 'attaque_de_contact'],
  },
  {
    titre: 'Esprit',
    tags: ['effet_mental', 'charme_ou_coercition', 'confusion_ou_desorientation'],
  },
  {
    titre: 'Défense',
    tags: [
      'protection_defensive',
      'immunite_ou_resistance_element',
      'dissipation_ou_contresort',
      'resistance_a_la_magie',
    ],
  },
  {
    titre: 'Information',
    tags: [
      'detection_ou_revelation',
      'divination_information',
      'perception_amelioree',
      'communication_ou_langage',
    ],
  },
  {
    titre: 'Invocation et illusion',
    tags: [
      'invocation_ou_creation',
      'illusion_visuelle_ou_sonore',
      'invisibilite_ou_dissimulation',
    ],
  },
  {
    titre: 'Équipement et terrain',
    tags: [
      'arme_ou_munition',
      'objet_ou_equipement',
      'terrain_ou_environnement',
      'deplacement_ou_teleportation',
    ],
  },
  {
    titre: 'Durée',
    tags: ['duree_instantanee', 'duree_prolongee'],
  },
  {
    titre: 'Chiffres et jets',
    tags: ['bonus_chiffre', 'malus_chiffre', 'jet_de_sauvegarde'],
  },
  {
    titre: 'Divers',
    tags: ['alignement_ou_divin', 'metamagie_ou_sort_cible'],
  },
]

/** The group title for tags the table above does not place. */
export const TITRE_AUTRES = 'Autres'

/**
 * Project the index's tag list onto the groups.
 *
 * Only tags actually present in the export are listed — the panel must not offer a
 * filter that can only ever return nothing — and a group left with no tag is
 * dropped whole, for the same reason the tag section itself disappears when the
 * enrichment layer is absent.
 */
export function grouperTags(tags: readonly string[]): readonly GroupeTags[] {
  const disponibles = new Set(tags)
  const places = new Set<string>()
  const groupes: GroupeTags[] = []

  for (const groupe of GROUPES_TAGS) {
    const presents = groupe.tags.filter((tag) => disponibles.has(tag))
    for (const tag of presents) places.add(tag)
    if (presents.length > 0) groupes.push({ titre: groupe.titre, tags: presents })
  }

  // The closed list can grow without this file being told. An unplaced tag is
  // still a usable filter, so it is shown rather than lost.
  const restants = tags.filter((tag) => !places.has(tag))
  if (restants.length > 0) groupes.push({ titre: TITRE_AUTRES, tags: restants })

  return groupes
}
