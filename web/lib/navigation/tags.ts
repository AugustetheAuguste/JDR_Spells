/**
 * The three states of a tag filter, and the cycle between them.
 *
 * A tag answers three different questions, not two: « only spells that do this »,
 * « no spell that does this », and « I do not care ». A checkbox can only ask the
 * first and the third, so « hide every mind-affecting spell » — the single most
 * useful thing to ask of this taxonomy at the table — was not expressible at all.
 *
 * The cycle is neutral → required → excluded → neutral. Required comes first
 * because it is the common intent, and the third click returns to neutral rather
 * than to required so that every state is reachable and leavable with the same
 * control. There is no fourth state and no modifier key: a filter you can only
 * clear by knowing that shift-click exists is a filter you cannot clear.
 */

export type EtatTag = 'neutre' | 'inclus' | 'exclu'

export const PROCHAIN_ETAT_TAG: Readonly<Record<EtatTag, EtatTag>> = {
  neutre: 'inclus',
  inclus: 'exclu',
  exclu: 'neutre',
}

/** Spoken and tooltip wording. Each names the state AND what a click does next:
 * a three-state control whose next step is invisible is a guessing game. */
export const LIBELLES_ETATS_TAG: Readonly<Record<EtatTag, string>> = {
  neutre: 'non filtré — cliquez pour n’afficher que ces sorts',
  inclus: 'exigé — cliquez pour exclure ces sorts',
  exclu: 'exclu — cliquez pour ne plus filtrer',
}

export function etatDuTag(
  tag: string,
  tags: readonly string[],
  tagsExclus: readonly string[],
): EtatTag {
  if (tags.includes(tag)) return 'inclus'
  if (tagsExclus.includes(tag)) return 'exclu'
  return 'neutre'
}

/**
 * Move one tag to the next state, leaving the others alone.
 *
 * Both lists are re-derived from `connus` rather than appended to, so the order is
 * the index's own and one URL is one state — two users who clicked the same tags
 * in a different order share the same link. The two lists cannot overlap: a tag is
 * removed from both before being placed in one.
 */
export function basculerTag(
  tag: string,
  tags: readonly string[],
  tagsExclus: readonly string[],
  connus: readonly string[],
): { readonly tags: readonly string[]; readonly tagsExclus: readonly string[] } {
  const suivant = PROCHAIN_ETAT_TAG[etatDuTag(tag, tags, tagsExclus)]
  const inclus = new Set(tags)
  const exclus = new Set(tagsExclus)
  inclus.delete(tag)
  exclus.delete(tag)
  if (suivant === 'inclus') inclus.add(tag)
  if (suivant === 'exclu') exclus.add(tag)
  return {
    tags: connus.filter((connu) => inclus.has(connu)),
    tagsExclus: connus.filter((connu) => exclus.has(connu)),
  }
}
