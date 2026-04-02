const ALLOWED_EMAILS = ['maiduydungvn@gmail.com', 'vuthibichtrang@gmail.com'];

interface GoogleUser {
	email: string;
	name: string;
	picture: string;
}

function createAuthState() {
	let user: GoogleUser | null = $state(null);
	let status: 'loading' | 'logged-out' | 'authorized' | 'denied' = $state('loading');

	function init() {
		const saved = sessionStorage.getItem('auth_user');
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as GoogleUser;
				if (ALLOWED_EMAILS.includes(parsed.email)) {
					user = parsed;
					status = 'authorized';
				} else {
					sessionStorage.removeItem('auth_user');
					status = 'logged-out';
				}
			} catch {
				sessionStorage.removeItem('auth_user');
				status = 'logged-out';
			}
		} else {
			status = 'logged-out';
		}
	}

	function handleCredentialResponse(response: { credential: string }) {
		const payload = JSON.parse(atob(response.credential.split('.')[1]));
		const googleUser: GoogleUser = {
			email: payload.email,
			name: payload.name,
			picture: payload.picture,
		};

		if (ALLOWED_EMAILS.includes(googleUser.email)) {
			user = googleUser;
			status = 'authorized';
			sessionStorage.setItem('auth_user', JSON.stringify(googleUser));
		} else {
			user = googleUser;
			status = 'denied';
		}
	}

	function logout() {
		user = null;
		status = 'logged-out';
		sessionStorage.removeItem('auth_user');
	}

	return {
		get user() { return user; },
		get status() { return status; },
		init,
		handleCredentialResponse,
		logout,
	};
}

export const auth = createAuthState();
