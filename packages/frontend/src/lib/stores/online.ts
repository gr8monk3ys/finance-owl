import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const isOnline = writable(true);

if (browser) {
	isOnline.set(navigator.onLine);

	window.addEventListener('online', () => isOnline.set(true));
	window.addEventListener('offline', () => isOnline.set(false));
}
