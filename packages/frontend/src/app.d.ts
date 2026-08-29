declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				name: string;
			} | null;
			accessToken: string | null;
		}
		interface Error {
			message: string;
			code?: string;
		}
	}

	interface Window {
		/**
		 * Set by the inline bootstrap in app.html. Calling it cancels the failsafe
		 * that removes the `js` class when the app fails to hydrate.
		 */
		__foHydrated?: () => void;
	}
}

export {};
