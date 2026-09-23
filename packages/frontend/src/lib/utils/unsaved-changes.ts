import { onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';

const MESSAGE = 'Leave this page? Changes you haven’t saved will be lost.';

/**
 * Warn before leaving a page with a half-filled form (web-design-guidelines:
 * warn before navigation with unsaved changes). Call once from a layout.
 *
 * Typing into any POST form marks that form dirty; submitting it clears it.
 * A form that has left the DOM (a modal the user cancelled) no longer
 * counts, and changing only the query string on the same page (filters,
 * tabs) never prompts.
 */
export function guardUnsavedForms(): void {
  const dirty = new Set<HTMLFormElement>();

  const postFormOf = (target: EventTarget | null): HTMLFormElement | null =>
    target instanceof Element ? target.closest<HTMLFormElement>('form[method="POST" i]') : null;

  const hasUnsaved = (): boolean => {
    for (const form of dirty) if (!form.isConnected) dirty.delete(form);
    return dirty.size > 0;
  };

  onMount(() => {
    const onInput = (event: Event) => {
      const form = postFormOf(event.target);
      if (form) dirty.add(form);
    };
    const onSubmit = (event: Event) => {
      if (event.target instanceof HTMLFormElement) dirty.delete(event.target);
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  });

  beforeNavigate((navigation) => {
    if (!hasUnsaved()) return;
    if (navigation.to?.url.pathname === navigation.from?.url.pathname) return;
    // Closing the tab or leaving the app: cancelling shows the browser's own prompt.
    if (navigation.type === 'leave') {
      navigation.cancel();
      return;
    }
    if (window.confirm(MESSAGE)) dirty.clear();
    else navigation.cancel();
  });
}
