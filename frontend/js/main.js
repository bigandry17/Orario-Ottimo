import { attemptLogin, isAuthenticated } from './auth.js';
import { initRouter } from './router.js';
import { renderDashboard } from './ui/dashboard.js';

const contentDiv = document.getElementById('content');
const loginView = document.getElementById('login-view');
const loginForm = document.getElementById('loginForm');

// Show a toast notification
export function showToast(message, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');

    toastEl.classList.remove('bg-success', 'bg-danger', 'text-white');
    if (type === 'success') {
        toastEl.classList.add('bg-success', 'text-white');
    } else {
        toastEl.classList.add('bg-danger', 'text-white');
    }

    toastMessage.textContent = message;

    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
}

window.showToast = showToast;

// Handle error/info messages
function handleMessage(title, content) {
    console.log(`[AVVISO - ${title}]: ${content}`);
    if (title === 'Errore di Login') {
        alert(content);
    }
}

// Switch to dashboard view
function showAppView() {
    loginView.classList.remove('d-flex', 'flex-grow-1');
    loginView.classList.add('d-none');
    contentDiv.classList.remove('d-none');
    contentDiv.classList.add('d-flex', 'flex-column');
    renderDashboard();
}

// Switch to login view
function showLoginView() {
    contentDiv.classList.remove('d-flex', 'flex-column');
    contentDiv.classList.add('d-none');
    loginView.classList.remove('d-none');
    loginView.classList.add('d-flex', 'flex-grow-1');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

// App initialization
function init() {

    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('login-password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            eyeIcon.classList.toggle('fa-eye');
            eyeIcon.classList.toggle('fa-eye-slash');
        });
    }

    initRouter();

    if (isAuthenticated()) {
        showAppView();
    } else {
        showLoginView();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const remember = document.getElementById('rememberMe').checked;

        const result = await attemptLogin(username, password, remember);

        if (result.success) {
            showAppView();
        } else {
            handleMessage('Errore di Login', result.message);
        }
    });
}


// Initialize app on load
init();

// Exported for dashboard.js logout
export { showLoginView };