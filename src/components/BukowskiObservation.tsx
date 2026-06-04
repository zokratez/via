import { Link } from "@/i18n/navigation";

type BukowskiObservationTranslationKey =
  | "bukowski_observation_eyebrow"
  | "bukowski_observation_title";

type BukowskiObservationT = (key: BukowskiObservationTranslationKey) => string;

export function BukowskiObservation({
  observation,
  t,
}: {
  observation: string;
  t: BukowskiObservationT;
}) {
  return (
    <Link
      href="/coach"
      className="pp-bukowski-observation pp-glass-edge-content"
      aria-label={t("bukowski_observation_title")}
    >
      <span className="pp-bukowski-mark" aria-hidden="true">
        ¶
      </span>
      <span>
        <span className="pp-bukowski-eyebrow">
          {t("bukowski_observation_eyebrow")}
        </span>
        <span className="pp-bukowski-text">{observation}</span>
      </span>
    </Link>
  );
}
