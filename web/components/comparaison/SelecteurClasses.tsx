import { MAX_CLASSES } from "@/lib/comparaison/ensembles";
import type { IndexWeb } from "@/lib/donnees/index-web";
import { grouperClasses } from "@/lib/navigation/groupes-classes";

/**
 * Pick two or three classes.
 *
 * The three-class ceiling is stated in words and the fourth checkbox is disabled,
 * rather than the click being swallowed: a selector that ignores an interaction
 * looks broken, and the user is left clicking harder. The limit is about
 * readability — the table gains a level column per class and the partial
 * intersections multiply — so the sentence says that, not "maximum 3".
 *
 * Checkboxes and not a multi-select: a `<select multiple>` requires ctrl-clicking
 * to deselect, which is discoverable by nobody.
 */
export function SelecteurClasses({
  choisies,
  index,
  surChangement,
}: {
  readonly choisies: readonly string[];
  readonly index: IndexWeb;
  readonly surChangement: (classes: readonly string[]) => void;
}) {
  const plein = choisies.length >= MAX_CLASSES;

  function basculer(slug: string): void {
    if (choisies.includes(slug)) {
      surChangement(choisies.filter((autre) => autre !== slug));
      return;
    }
    if (plein) return;
    // Appended, not re-sorted: this is the order the columns appear in, and
    // sorting it would make the URL and the table disagree on which is first.
    surChangement([...choisies, slug]);
  }

  return (
    <fieldset className="m-0 rounded-panneau border border-bord bg-surface p-3">
      <legend className="px-1 text-petit font-semibold text-encre-douce">
        Classes à comparer
      </legend>
      <p className="mt-0 mb-2 max-w-[52ch] text-petit text-encre-douce">
        Deux ou trois classes. Au-delà de trois, la table gagne une colonne de
        niveau par classe et les recoupements partiels se multiplient, elle
        cesse d&apos;être lisible.
      </p>
      {/* Two groups, the familiar classes first: alphabetical is the right order
          for a machine and the wrong one for a player, who reaches for the core
          classes and found them scattered between `Alchimiste` and `Spirite`. */}
      {grouperClasses(index).map((groupe) => (
        <div key={groupe.titre}>
          <p className="mt-2 mb-1 text-micro font-semibold text-encre-faible">
            {groupe.titre}
          </p>
          <ul className="m-0 grid list-none grid-cols-1 gap-y-1 p-0 sm:grid-cols-2">
            {groupe.classes.map((classe) => {
              const coche = choisies.includes(classe.slug);
              const bloque = plein && !coche;
              return (
                <li key={classe.slug}>
                  <label
                    className={[
                      "flex min-h-cible items-center gap-1.5 text-corps",
                      bloque
                        ? "cursor-not-allowed text-encre-faible"
                        : "cursor-pointer",
                    ].join(" ")}
                    {...(bloque
                      ? {
                          title: `Trois classes au plus. Décochez-en une pour changer.`,
                        }
                      : {})}
                  >
                    <input
                      checked={coche}
                      className="size-4 accent-[var(--color-accent)]"
                      disabled={bloque}
                      onChange={() => basculer(classe.slug)}
                      type="checkbox"
                    />
                    {classe.nom}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {plein ? (
        <p aria-live="polite" className="mt-2 mb-0 text-petit text-encre-douce">
          Trois classes sélectionnées, le maximum. Décochez-en une pour en
          choisir une autre.
        </p>
      ) : null}
    </fieldset>
  );
}
