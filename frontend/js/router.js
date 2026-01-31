import { renderDashboard, navigate } from './ui/dashboard.js';
import { isAuthenticated, getCurrentUser } from './auth.js';
import { showLoginView } from './main.js';

// Route definitions and allowed roles
const routes = {
    '/orario': { roles: ['admin', 'docente'] },
    '/genera': { roles: ['admin'] },
    '/docenti': { roles: ['admin'] },
    '/materie': { roles: ['admin'] },
    '/corsi': { roles: ['admin'] },
    '/aule': { roles: ['admin'] },
    '/vincoli': { roles: ['admin'] },
    '/notifiche': { roles: ['admin', 'docente'] },
    '/report': { roles: ['admin'] },
    '/preferenze': { roles: ['docente'] }
};

// Initialize router and handle navigation events
export function initRouter() {
    document.addEventListener('click', e => {
        const link = e.target.closest('[data-link]');
        if (link) {
            e.preventDefault();
            const href = link.getAttribute('href');
            navigateTo(href);
        }
    });

    window.addEventListener('popstate', handleLocation);
    handleLocation();
}

// Navigate to a new URL and update the view
export function navigateTo(url) {
    history.pushState(null, null, url);
    handleLocation();
}

// Handle route changes and access control
function handleLocation() {
    const path = window.location.pathname;
    const view = path === '/' ? 'orario' : path.substring(1);
    
    if (!isAuthenticated()) {
        showLoginView();
        return; 
    }

    const user = getCurrentUser();
    const route = routes[path];

    if (route && route.roles.includes(user.role)) {
        if (document.getElementById('content').classList.contains('d-none')) {
            renderDashboard();
        }
        navigate(view);
    } else {
        navigateTo('/orario');
    }
}