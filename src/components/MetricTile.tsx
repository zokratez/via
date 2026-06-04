import { Link } from "@/i18n/navigation";

export type MetricTileProps = {
  metric:
    | "protein"
    | "water"
    | "steps"
    | "calories"
    | "sleep"
    | "weight"
    | "dose"
    | "symptom";
  icon: string;
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  href?: string;
  comingSoon?: boolean;
  emptyState?: "loggable" | "source-gated";
  emptySublabel?: string;
  tapCue?: string;
};

function splitValue(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([+-]?\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return { main: trimmed, suffix: "" };
  return { main: match[1], suffix: match[2].trim() };
}

function MetricIcon({ icon }: { icon: string }) {
  if (icon === "droplet") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3C8 8 6 11 6 15a6 6 0 0 0 12 0c0-4-2-7-6-12Z" />
      </svg>
    );
  }
  if (icon === "walk") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 8l-2 5-3 2M11 8l4 2 3-1M10 14l3 3 1 5M9 13l-1 4-3 4" />
      </svg>
    );
  }
  if (icon === "flame") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 3c1 4-4 5-4 10a4 4 0 0 0 8 0c0-2-1-4-4-10ZM9 15a3 3 0 0 0 6 0" />
      </svg>
    );
  }
  if (icon === "moon-stars") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 3a7 7 0 1 0 5 12 8 8 0 0 1-5-12ZM5 4h2M6 3v2M19 7h2M20 6v2" />
      </svg>
    );
  }
  if (icon === "scale") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 9a4 4 0 0 1 6 0M12 9l2-2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8h7a4 4 0 1 1 0 8H8a5 5 0 0 1-1-8ZM15 8l3-3M18 5l1 3" />
    </svg>
  );
}

export function MetricTile({
  metric,
  icon,
  value,
  label,
  sublabel,
  badge,
  href,
  comingSoon = false,
  emptyState,
  emptySublabel,
  tapCue,
}: MetricTileProps) {
  const isLoggableEmpty = emptyState === "loggable";
  const isSourceGated = comingSoon || emptyState === "source-gated";
  const showTapCue = Boolean(href) && !isSourceGated && !isLoggableEmpty;
  const displayValue = isLoggableEmpty ? "—" : value;
  const displaySublabel =
    isLoggableEmpty && emptySublabel ? emptySublabel : sublabel;
  const { main, suffix } = splitValue(displayValue);
  const valueStyle =
    isLoggableEmpty
      ? {
          color: "color-mix(in srgb, var(--pp-metric-copy) 70%, transparent)",
          fontFamily: "var(--pp-font-sans)",
          fontSize: "20px",
          fontStyle: "normal",
          fontWeight: 600,
          letterSpacing: "0.04em",
          opacity: 0.72,
        }
      : undefined;
  const content = (
    <span className="pp-metric-tile-content">
      <div className="pp-metric-tile-topline">
        <i className={`ti ti-${icon} pp-metric-tile-icon`} aria-hidden="true">
          <MetricIcon icon={icon} />
        </i>
        {badge && <span className="pp-metric-tile-badge">{badge}</span>}
      </div>
      <p className="pp-metric-tile-value" style={valueStyle}>
        <span>{main}</span>
        {suffix && <span className="pp-metric-tile-unit"> {suffix}</span>}
      </p>
      <p className="pp-metric-tile-label">{label}</p>
      {displaySublabel && (
        <p className="pp-metric-tile-sublabel">{displaySublabel}</p>
      )}
      {showTapCue && tapCue && (
        <span className="pp-metric-tile-cue">+ {tapCue}</span>
      )}
    </span>
  );

  if (href && !isSourceGated) {
    return (
      <Link href={href} className="pp-metric-tile" data-metric={metric}>
        {content}
      </Link>
    );
  }

  return (
    <div
      className="pp-metric-tile"
      data-metric={metric}
      data-coming-soon={isSourceGated ? "true" : undefined}
    >
      {content}
    </div>
  );
}
