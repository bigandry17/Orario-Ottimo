import { getCurrentUser, logoutUser, } from '../auth.js';
import { getContentView } from './views.js';
import { showLoginView } from '../main.js';

const adminTabs = [
    { id: 'orario', icon: 'fas fa-calendar-alt', name: 'Orario' },
    { id: 'genera', icon: 'fas fa-cogs', name: 'Genera' },
    { id: 'docenti', icon: 'fas fa-chalkboard-teacher', name: 'Docenti' },
    { id: 'materie', icon: 'fas fa-book', name: 'Materie' },
    { id: 'corsi', icon: 'fas fa-graduation-cap', name: 'Corsi' },
    { id: 'aule', icon: 'fas fa-chalkboard', name: 'Aule' },
    { id: 'vincoli', icon: 'fas fa-link', name: 'Vincoli' },
    { id: 'notifiche', icon: 'fas fa-bell', name: 'Notifiche' },
    { id: 'report', icon: 'fas fa-chart-bar', name: 'Report' },
];
const docenteTabs = [
    { id: 'orario', icon: 'fas fa-calendar-alt', name: 'Il mio Orario' },
    { id: 'preferenze', icon: 'fas fa-clock', name: 'Preferenze' },
    { id: 'notifiche', icon: 'fas fa-bell', name: 'Notifiche' }
];

// Navigate to a specific view and update the UI
export function navigate(view) {
    sessionStorage.setItem('current_view', view); 
    const contentDiv = document.getElementById('content');
    const dashboardContent = contentDiv.querySelector('#dashboard-content');

    document.querySelectorAll('.nav-link-item').forEach(link => {
        link.classList.remove('active', 'border-primary');
    });
    const activeLink = document.getElementById(`nav-${view}`);
    if (activeLink) {
        activeLink.classList.add('active', 'border-primary');
    }

    if (dashboardContent) {
        dashboardContent.innerHTML = `
            <div class="d-flex align-items-center justify-content-center" style="height: 80vh;">
                <div class="text-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Caricamento...</span>
                    </div>
                    <p class="mt-3 text-secondary">Caricamento dati. Attendere prego...</p>
                </div>
            </div>
        `;
    }

    loadContentAsync(view, dashboardContent);
}

// Load view content asynchronously and handle loading spinner
async function loadContentAsync(view, targetElement) {
    try {
        const contentHtml = await getContentView(view);

        if (targetElement) {
            targetElement.innerHTML = contentHtml;
        }
        switch (view) {
            case 'docenti':
                window.updateTeacherList('');
                break;
        }
    } catch (error) {
        console.error("Errore nel caricamento della vista:", error);
        if (targetElement) {
            targetElement.innerHTML = `
                <div class="alert alert-danger p-4" role="alert">
                    <h5 class="alert-heading">Errore di Caricamento Dati!</h5>
                    Impossibile caricare i dati della sezione. Controlla la console per i dettagli sull'API.
                </div>
            `;
        }
    }
}

// Returns the HTML for the navbar based on user role
function getNavbar() {
    const { role, name } = getCurrentUser();
    let tabs = [];
    let dashboardTitle = 'Sistema Gestione Orari - ';

    if (role === 'admin') {
        tabs = adminTabs;
        dashboardTitle += 'Pannello Amministratore';
    } else if (role === 'docente') {
        tabs = docenteTabs;
        dashboardTitle += 'Area Docente';
    }

    const tabsHtml = tabs.map(tab => {
        const badgeHtml = tab.id === 'notifiche' 
            ? `<span id="notification-badge" class="badge rounded-pill bg-danger ms-2 d-none">0</span>` 
            : '';

        return `
            <a href="/${tab.id}" 
               id="nav-${tab.id}" 
               class="nav-link nav-link-item d-flex align-items-center" 
               data-link>
                <i class="${tab.icon}"></i> 
                <span class="ms-2">${tab.name}</span>
                ${badgeHtml}
            </a>
        `;
    }).join('');

    return `
        <header class="bg-white shadow-sm">
            <div class="d-flex align-items-center justify-content-between p-3 border-bottom">
                <div class="d-flex align-items-center">
                    <img src="/assets/logo.png" alt="Logo Orario Ottimo" class="me-2" style="height:50px;"/>
                    <h2 class="h5 fw-semibold text-dark mb-0">${dashboardTitle}</h2>
                </div>
                <div class="d-flex align-items-center space-x-3">
                    <span class="d-sm-block text-dark">${name}</span>
                    <button class="btn btn-lg hover-danger" onclick="window.logout()" title="Logout">
                        <i class="fa-solid fa-arrow-right-from-bracket text-dark"></i>
                    </button>
                </div>
            </div>
            <nav class="admin-nav">
                <div class="d-flex space-x-2 space-lg-x-4 px-3">
                    ${tabsHtml}
                </div>
            </nav>
        </header>
        <div id="dashboard-content" class="p-3 p-lg-4 flex-grow-1">
            </div>
    `;
}

// Update unread notification badge in navbar
window.updateNotificationCount = (count) => {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }
};

// Initialize dashboard, load navbar and default view
export function renderDashboard() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = getNavbar();

    window.navigate = navigate;

    window.logout = () => {
        logoutUser();
        sessionStorage.removeItem('current_view');

        history.replaceState(null, null, '/');

        showLoginView();
    };

    const lastView = sessionStorage.getItem('current_view') || 'orario';
    navigate(lastView);

    if (window.loadNotificationCount) {
        window.loadNotificationCount();
    }
}