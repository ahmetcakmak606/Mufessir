"use client";

interface RunActionsProps {
  canSave: boolean;
  onSave: () => void;
  onReplay: () => void;
  onCopyCitations: () => void;
  onShare: () => void;
  saving: boolean;
  labels: {
    saveRun: string;
    savingRun: string;
    replay: string;
    copyCitations: string;
    share: string;
  };
}

export function RunActions({
  canSave,
  onSave,
  onReplay,
  onCopyCitations,
  onShare,
  saving,
  labels,
}: RunActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        data-testid="save-run-button"
        className="ui-link font-semibold text-[var(--ink)]"
      >
        {saving ? labels.savingRun : labels.saveRun}
      </button>
      <button
        type="button"
        onClick={onReplay}
        data-testid="replay-run-button"
        className="ui-link"
      >
        {labels.replay}
      </button>
      <button
        type="button"
        onClick={onCopyCitations}
        data-testid="copy-citations-button"
        className="ui-link"
      >
        {labels.copyCitations}
      </button>
      <button
        type="button"
        onClick={onShare}
        data-testid="share-run-button"
        className="ui-link"
      >
        {labels.share}
      </button>
    </div>
  );
}
