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
}

export {};
