// Convert a string to Title Case
export function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

export const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];
export const TIME_SLOTS = [
    "09:00 - 11:00",
    "11:00 - 13:00",
    "14:00 - 16:00",
    "16:00 - 18:00",
];
export const SUPPORTED_CONSTRAINTS = [
    {
        tag: "max_daily_hours",
        name: "Limite ore giornaliere classe",
        desc: "Evita che una classe abbia più di 6 ore di lezione al giorno.",
    },
    {
        tag: "consecutive_slots",
        name: "Compattezza orario",
        desc: "Cerca di mettere le lezioni in slot consecutivi per evitare buchi.",
    },
    {
        tag: "preferred_mornings",
        name: "Priorità Mattina",
        desc: "Tenta di inserire le lezioni preferibilmente nelle fasce mattutine.",
    },
    {
        tag: "max_consecutive_subject_hours",
        name: "Limite ore consecutive materia (Max 4h)",
        desc: "Impedisce che una singola materia occupi più di 2 slot (4 ore) consecutivi nello stesso giorno.",
    },
    {
        tag: "teacher_day_off",
        name: "Giorno Libero Docente",
        desc: "Garantisce che ogni docente abbia almeno un giorno feriale completamente privo di lezioni.",
    },
];

// Generate an unauthorized access message for a given section
export function getUnauthorizedMessage(section) {
    return `
        <div class="content-card p-5 text-center">
            <span class="fas fa-ban fs-1 mb-3 d-block text-danger"></span>
            <h3 class="h4 fw-bold text-danger mb-2">Accesso Negato</h3>
            <p class="h6 text-secondary">Non hai i permessi necessari per accedere alla sezione: <strong>${section}</strong>.</p>
            <p class="text-muted mt-3">Torna alla dashboard o effettua il logout.</p>
        </div>
    `;
}

// Close a Bootstrap modal and clean up backdrops
function closeModalAndClean(modalElement) {
    const bsModal = bootstrap.Modal.getInstance(modalElement);
    if (bsModal) {
        bsModal.hide();
    }
    document.body.classList.remove("modal-open");
    const backdrops = document.querySelectorAll(".modal-backdrop");
    if (backdrops) {
        backdrops.forEach((backdrop) => backdrop.remove());
    }
}
window.closeModalAndClean = closeModalAndClean;

// Generate a usage bar (progress bar) for a given name and percentage
export function getUsageBar(name, percent) {
    return `
        <div class="mb-4">
            <div class="d-flex justify-content-between text-sm fw-medium text-secondary">
                <span>${name}</span>
                <span>${percent}%</span>
            </div>
            <div class="progress mt-1" style="height: 10px;">
                <div class="progress-bar bg-primary" role="progressbar" style="width: ${percent}%;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
        </div>
    `;
}

// Generate the HTML for the lesson action modal
export function getModalHtml() {
    return `
        <!-- Modal per Modifica/Eliminazione Lezione -->
        <div class="modal fade" id="lessonActionModal" tabindex="-1" aria-labelledby="lessonActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="modal-title-text">Azioni Lezione</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="lesson-action-choice-section">
                            <p class="mb-4">Seleziona l'azione da eseguire per la lezione di <strong id="lesson-name-to-delete">Nome Lezione</strong>:</p>
                            <input type="hidden" id="lesson-id-to-delete">
                            
                            <div class="d-flex justify-content-center gap-2">
                                <button type="button" class="btn btn-lg btn-primary" onclick="window.openEditForm(document.getElementById('lesson-id-to-delete').value)">
                                    <i class="fas fa-edit me-2"></i> Modifica Dati Lezione
                                </button>
                                <button type="button" class="btn btn-lg btn-danger" onclick="window.showDeleteConfirmationScreen(document.getElementById('lesson-id-to-delete').value, document.getElementById('lesson-name-to-delete').textContent)">
                                    <i class="fas fa-trash-alt me-2"></i> Elimina Lezione
                                </button>
                            </div>
                        </div>

                        <div id="lesson-action-form-section" class="p-3 d-none">
                            <!-- Contenuto dinamico iniettato da openEditForm -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <script>
            (function() {
                const modalElement = document.getElementById('lessonActionModal');
                modalElement.addEventListener('hidden.bs.modal', function () {
                    document.body.classList.remove('modal-open');
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    if (backdrops) {
                        backdrops.forEach(backdrop => backdrop.remove());
                    }
                    const formSection = document.getElementById('lesson-action-form-section');
                    const choiceSection = document.getElementById('lesson-action-choice-section');
                    if(formSection && choiceSection) {
                         formSection.classList.add('d-none');
                         choiceSection.classList.remove('d-none');
                    }
                });
            })();
        </script>
    `;
}

// Generate a trend indicator (up/down/unchanged) for a value
export function getTrendHtml(value, isConflict = false) {
    if (value === 0 || value === undefined) {
        return `<div class="text-xs text-muted mt-2"><i class="fas fa-minus me-1"></i> Invariato</div>`;
    }

    const isPositiveChange = value > 0;
    let colorClass;

    if (isConflict) {
        colorClass = isPositiveChange ? 'text-danger' : 'text-success';
    } else {
        colorClass = isPositiveChange ? 'text-success' : 'text-danger';
    }

    const iconClass = isPositiveChange ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const label = isPositiveChange ? '+' : '-';

    return `
        <div class="text-xs ${colorClass} mt-2 fw-medium">
            <i class="fas ${iconClass} me-1"></i> 
            ${label}${Math.abs(value)}%
        </div>
    `;
}

// Generate a status badge for a given status string
export function getStatusBadge(status) {
    const colors = {
        'Ottimale': 'bg-success',
        'Buono': 'bg-primary',
        'Sotto carico': 'bg-warning text-dark',
        'Sovraccarico': 'bg-danger'
    };
    return `<span class="badge ${colors[status] || 'bg-secondary'}">${status}</span>`;
}

// Generate a difference message (hours or percent) for reporting
export function getDiffMessageHtml(diffValue, type = 'hours') {
    if (diffValue === 0 || diffValue === undefined) {
        return `<div class="text-xs text-muted mt-2"><i class="fas fa-minus me-1"></i> Invariato</div>`;
    }

    const isIncrease = diffValue > 0;
    let colorClass, iconClass, message;

    if (type === 'hours') {
        colorClass = isIncrease ? 'text-success' : 'text-danger';
        iconClass = isIncrease ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        message = isIncrease ? `+${diffValue} ore` : `${diffValue} ore`;
    } else {
        colorClass = isIncrease ? 'text-danger' : 'text-success';
        iconClass = isIncrease ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        message = isIncrease ? `+${diffValue} conflitti` : `${Math.abs(diffValue)} conflitti`;
    }

    return `
        <div class="text-xs ${colorClass} mt-2">
            <i class="fas ${iconClass} me-1"></i> ${message}
        </div>
    `;
}