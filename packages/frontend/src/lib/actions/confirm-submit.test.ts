import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmSubmit } from './confirm-submit';

// Node's EventTarget/Event are enough to exercise the listener logic.
function setup(answer: boolean) {
  const confirm = vi.fn(() => answer);
  vi.stubGlobal('window', { confirm });
  const form = new EventTarget() as unknown as HTMLFormElement;
  confirmSubmit(form, 'Delete this budget?');
  const enhance = vi.fn((e: Event) => e.preventDefault());
  form.addEventListener('submit', enhance);
  const event = new Event('submit', { cancelable: true });
  form.dispatchEvent(event);
  return { confirm, enhance, event };
}

describe('confirmSubmit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets the submit through when the user confirms', () => {
    const { confirm, enhance } = setup(true);
    expect(confirm).toHaveBeenCalledWith('Delete this budget?');
    expect(enhance).toHaveBeenCalledOnce();
  });

  it('stops the submit and the enhance handler when the user cancels', () => {
    const { enhance, event } = setup(false);
    expect(event.defaultPrevented).toBe(true);
    expect(enhance).not.toHaveBeenCalled();
  });
});
