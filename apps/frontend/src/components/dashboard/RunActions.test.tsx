import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RunActions } from '@/components/dashboard/RunActions';

const labels = {
  saveRun: 'Save',
  savingRun: 'Saving',
  replay: 'Replay',
  copyCitations: 'Copy',
  share: 'Share',
};

describe('RunActions', () => {
  it('disables save when run cannot be saved', () => {
    render(
      <RunActions
        canSave={false}
        onSave={() => {}}
        onReplay={() => {}}
        onCopyCitations={() => {}}
        onShare={() => {}}
        saving={false}
        labels={labels}
      />
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('triggers action callbacks', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onReplay = vi.fn();
    const onCopy = vi.fn();
    const onShare = vi.fn();

    render(
      <RunActions
        canSave
        onSave={onSave}
        onReplay={onReplay}
        onCopyCitations={onCopy}
        onShare={onShare}
        saving={false}
        labels={labels}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
