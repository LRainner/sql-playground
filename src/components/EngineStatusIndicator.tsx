import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Translate } from "../lib/i18n";

type EngineStatusIndicatorProps = {
  engineId: string;
  active?: boolean;
  ready: boolean;
  loadError: boolean;
  t: Translate;
  delayMs?: number;
};

export function EngineStatusIndicator({
  engineId,
  active = true,
  ready,
  loadError,
  t,
  delayMs = 180,
}: EngineStatusIndicatorProps) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    setShowLoading(false);
    if (!active || ready || loadError) return;
    if (delayMs === 0) {
      setShowLoading(true);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs, engineId, loadError, ready]);

  const statusLabel = !active
    ? undefined
    : ready
      ? t("engine.ready")
      : loadError
        ? t("engine.loadFailed")
        : t("engine.loading");

  return (
    <span className="engine-status-slot" title={statusLabel} aria-label={statusLabel}>
      {active && ready ? (
        <span className="engine-row-dot ready" />
      ) : active && loadError ? (
        <CircleAlert className="engine-error-icon" size={14} />
      ) : active && showLoading ? (
        <LoaderCircle className="engine-loading-icon" size={14} />
      ) : (
        <span className="engine-row-dot" />
      )}
    </span>
  );
}
