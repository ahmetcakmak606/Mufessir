'use client';

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
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        data-testid="save-run-button"
        className="ui-button px-3 py-2 text-xs"
      >
        {saving ? labels.savingRun : labels.saveRun}
      </button>
      <button type="button" onClick={onReplay} data-testid="replay-run-button" className="ui-button-secondary px-3 py-2 text-xs">
        {labels.replay}
      </button>
      <button type="button" onClick={onCopyCitations} data-testid="copy-citations-button" className="ui-button-secondary px-3 py-2 text-xs">
        {labels.copyCitations}
      </button>
      <button type="button" onClick={onShare} data-testid="share-run-button" className="ui-button-secondary px-3 py-2 text-xs">
        {labels.share}
      </button>
    </div>
  );
}
