/**
 * The four states of a tag filter, and the cycle between them.
 *
 * A tag answers three different questions, not two: « only spells that do this »
 * (OR), « no spell that does this » (NOT), and « every spell shown must do this »
 * (AND) — on top of « I do not care ». A checkbox can only ask the first and the
 * last, so « hide every mind-affecting spell » — the single most useful thing to
 * ask of this taxonomy at the table — was not expressible at all, and neither was
 * « only spells that are both area AND persistent ».
 *
 * The cycle is neutral → inclus (OR) → exclu (NOT) → oblige (AND) → neutral.
 * Inclus comes first because it is the common intent — « I want spells with this
 * tag » — and the last click always returns to neutral so that every state is
 * reachable and leavable with the same control. There is no fifth state and no
 * modifier key: a filter you can only clear by knowing that shift-click exists is
 * a filter you cannot clear.
 */

export type EtatTag = 'neutre' | 'inclus' | 'exclu' | 'oblige'

export const PROCHAIN_ETAT_TAG: Readonly<Record<EtatTag, EtatTag>> = {
  neutre: 'inclus',
  inclus: 'exclu',
  exclu: 'oblige',
  oblige: 'neutre',
}

/** Spoken and tooltip wording. Each names the state AND what a click does next:
 * a four-state control whose next step is invisible is a guessing game. */
export const LIBELLES_ETATS_TAG: Readonly<Record<EtatTag, string>> = {
  neutre: 'non filtré, cliquez pour vouloir ce tag',
  inclus: 'voulu, au moins un tag voulu suffit, cliquez pour l’exclure',
  exclu: 'exclu, aucun sort exclu toléré, cliquez pour l’exiger',
  oblige: 'exigé, tous les tags exigés sont obligatoires, cliquez pour relâcher',
}

export function etatDuTag(
  tag: string,
  tags: readonly string[],
  tagsExclus: readonly string[],
  tagsObliges: readonly string[] = [],
): EtatTag {
  if (tags.includes(tag)) return 'inclus'
  if (tagsExclus.includes(tag)) return 'exclu'
  if (tagsObliges.includes(tag)) return 'oblige'
  return 'neutre'
}

/**
 * Move one tag to the next state, leaving the others alone.
 *
 * All three lists are re-derived from `connus` rather than appended to, so the
 * order is the index's own and one URL is one state — two users who clicked the
 * same tags in a different order share the same link. The three lists cannot
 * overlap: a tag is removed from all three before being placed in one.
 */
export function basculerTag(
  tag: string,
  tags: readonly string[],
  tagsExclus: readonly string[],
  connus: readonly string[],
  tagsObliges: readonly string[] = [],
): {
  readonly tags: readonly string[]
  readonly tagsExclus: readonly string[]
  readonly tagsObliges: readonly string[]
} {
  const suivant = PROCHAIN_ETAT_TAG[etatDuTag(tag, tags, tagsExclus, tagsObliges)]
  const inclus = new Set(tags)
  const exclus = new Set(tagsExclus)
  const obliges = new Set(tagsObliges)
  inclus.delete(tag)
  exclus.delete(tag)
  obliges.delete(tag)
  if (suivant === 'inclus') inclus.add(tag)
  if (suivant === 'exclu') exclus.add(tag)
  if (suivant === 'oblige') obliges.add(tag)
  return {
    tags: connus.filter((connu) => inclus.has(connu)),
    tagsExclus: connus.filter((connu) => exclus.has(connu)),
    tagsObliges: connus.filter((connu) => obliges.has(connu)),
  }
}
