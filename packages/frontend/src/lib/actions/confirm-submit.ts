import type { Action } from 'svelte/action';

/**
 * Ask before a destructive form submits. Destructive actions need a
 * confirmation step, never an immediate delete (web-design-guidelines).
 *
 * The listener runs in the capture phase, so at the form itself it fires
 * before `use:enhance`'s submit handler; cancelling stops that handler and
 * the native submission alike.
 */
export const confirmSubmit: Action<HTMLFormElement, string> = (node, message) => {
  let text = message;
  const onSubmit = (event: SubmitEvent) => {
    if (window.confirm(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  node.addEventListener('submit', onSubmit, { capture: true });
  return {
    update(next) {
      text = next;
    },
    destroy() {
      node.removeEventListener('submit', onSubmit, { capture: true });
    },
  };
};
