
// Storage keys for user and JWT token
const STORAGE_KEY = 'orario_ottimo_user';
const TOKEN_KEY = 'jwt_token';


// Cached user info
let { role: currentRole, name: currentUserName, id: currentUserId } = loadUserState() || {};


// Loads user state from localStorage or sessionStorage
function loadUserState() {
    const serializedUser = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (serializedUser) {
        try {
            return JSON.parse(serializedUser);
        } catch (e) {
            console.error("Error parsing saved user state:", e);
            return null;
        }
    }
    return null;
}

// Removes user and token from storage
export function clearUserState() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    currentRole = null;
    currentUserName = '';
    currentUserId = null;
}

/**
 * Attempts login via backend API
 * @returns { success: boolean, user: object | null, message: string }
*/
export async function attemptLogin(username, password, remember = false) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            saveAuth(result.user, result.token, remember);
            history.replaceState(null, null, '/orario');
            return { success: true };
        } else {
            return { success: false, message: result.message || 'Credenziali non valide.' };
        }
    } catch (e) {
        return { success: false, message: 'Impossibile connettersi al server.' };
    }
}

// Saves user and token to storage
export function saveAuth(userData, token, remember = false) {
    const storage = remember ? localStorage : sessionStorage;
    
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);

    storage.setItem(TOKEN_KEY, token);
    storage.setItem(STORAGE_KEY, JSON.stringify(userData));
}

// Returns JWT token from storage
export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

// Clears all authentication data from storage
export function clearAuth() {
    localStorage.clear();
    sessionStorage.clear();
}

// Logs out the user
export function logoutUser() {
    clearUserState();
}

/**
 * Returns the current user
 * @returns { role: string, name: string, id: string }
 */
export function getCurrentUser() {
    const user = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return user ? JSON.parse(user) : { role: null, name: '', id: null };
}


export function isAuthenticated() {
    return !!getToken();
}