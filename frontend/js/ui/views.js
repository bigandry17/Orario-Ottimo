import { getCurrentUser } from "../auth.js";
import { dataService } from "../services/dataService.js";
import { getToken } from "../auth.js";
import { getPreferenceModalHtml, getAddTeacherModalHtml, getClassroomModalHtml, getConstraintModalHtml, getCourseModalHtml, getTeacherModalHtml, getSubjectModalHtml } from "./components/modal.js";
import { toTitleCase, DAYS, TIME_SLOTS, SUPPORTED_CONSTRAINTS, getUnauthorizedMessage, getStatusBadge, getDiffMessageHtml, getModalHtml, getTrendHtml, getUsageBar } from "./components/utils.js";

// Data caches
let SCHEDULE_CACHE = [];
let TEACHER_CACHE = [];
let CLASSROOM_CACHE = [];
let SUBJECT_CACHE = [];
let COURSE_CACHE = [];
let CONSTRAINT_CACHE = [];
let NOTIFICATION_CACHE = [];
let REPORT_METRICS_CACHE = [];
let PREFERENCE_CACHE = [];

/**
 * Returns the HTML for the requested view section
 * @param {string} view - The view identifier
 * @returns {Promise<string>} HTML content for the view
 */
export async function getContentView(view) {
    const { role } = getCurrentUser();
    const allowedDocenteViews = ["orario", "preferenze", "notifiche"];
    if (role === "docente" && !allowedDocenteViews.includes(view)) {
        return getUnauthorizedMessage(view);
    }
    switch (view) {
        case "orario":
            return await getOrarioContent();
        case "genera":
            return await getGeneraContent();
        case "docenti":
            return await getDocentiContent();
        case "materie":
            return await getMaterieContent();
        case "corsi":
            return await getCorsiContent();
        case "aule":
            return await getAuleContent();
        case "vincoli":
            return await getVincoliContent();
        case "notifiche":
            return await getNotificheContent();
        case "report":
            return await getReportContent();
        case "preferenze":
            return await getPreferenzeContent();
        default:
            return `<div class=\"p-4 text-center text-secondary\">Section not found.</div>`;
    }
}

// =======================================================
// === PREFERENCE ===
// =======================================================

/**
 * Opens the modal to add a new teacher preference
 */
async function openAddPreferenceModal() {
    const modalId = "preferenceActionModal";
    let modalElement = document.getElementById(modalId);
    const user = getCurrentUser();

    if (user.role !== "docente") return;

    const allTeachers = await dataService.getTeachers();
    const currentTeacher = allTeachers.find((t) => t.name === user.name);

    if (!currentTeacher) {
        alert("Errore: Profilo docente non trovato per questo account utente.");
        return;
    }

    const teacherId = currentTeacher._id;

    const dayOptions = DAYS.map((d) => `<option value="${d}">${d}</option>`).join(
        ""
    );
    const timeSlotOptions = TIME_SLOTS.map(
        (t) => `<option value="${t}">${t}</option>`
    ).join("");

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveNewPreference('${teacherId}')">
            <div class="mb-3">
                <label for="preference-day" class="form-label">Giorno:</label>
                <select class="form-select" id="preference-day" required>
                    ${dayOptions}
                </select>
            </div>
            <div class="mb-3">
                <label for="preference-time-slot" class="form-label">Slot Orario:</label>
                <select class="form-select" id="preference-time-slot" required>
                    ${timeSlotOptions}
                </select>
            </div>
            <div class="mb-3">
                <label for="preference-type" class="form-label">Tipo di Preferenza:</label>
                <select class="form-select" id="preference-type" required>
                    <option value="Preferito">Preferito (Flessibile)</option>
                    <option value="Evitare">Evitare (Flessibile)</option>
                    <option value="Non Disponibile">Non Disponibile (Rigido)</option>
                </select>
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-primary">Aggiungi Preferenza</button>
            </div>
        </form>
    `;

    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getPreferenceModalHtml());
        modalElement = document.getElementById(modalId);
    }

    document.getElementById("preference-modal-title").textContent =
        "Aggiungi Nuova Preferenza Oraria";
    document.getElementById("preference-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
window.openAddPreferenceModal = openAddPreferenceModal;

/**
 * Saves a new teacher preference
 * @param {string} teacherId - The teacher's ID
 */
async function saveNewPreference(teacherId) {
    const payload = {
        teacher_id: teacherId,
        day: document.getElementById("preference-day").value,
        time_slot: document.getElementById("preference-time-slot").value,
        type: document.getElementById("preference-type").value,
    };

    try {
        await dataService.addPreference(payload);
        closeModalAndClean(document.getElementById("preferenceActionModal"));
        window.navigate("preferenze");
    } catch (error) {
        console.error("Errore POST Preferenza:", error);
        alert(`Errore nell'aggiunta della preferenza: ${error.message}`);
    }
}
window.saveNewPreference = saveNewPreference;

/**
 * Shows confirmation dialog before deleting a preference
 * @param {string} preferenceId - The preference ID to delete
 * @param {string} description - The preference description for display
 */
window.deletePreferenceConfirmation = (preferenceId, description) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare la preferenza per <strong class="text-dark">${description}</strong>?</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deletePreference('${preferenceId}', '${description}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "preference-modal-title"
    ).textContent = `Elimina Preferenza`;
    document.getElementById("preference-modal-body").innerHTML = confirmationHtml;

    let modalElement = document.getElementById("preferenceActionModal");
    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getPreferenceModalHtml());
        modalElement = document.getElementById("preferenceActionModal");
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Deletes a teacher preference
 * @param {string} preferenceId - The preference ID to delete
 * @param {string} description - The preference description for feedback
 */
window.deletePreference = async (preferenceId, description) => {
    try {
        await dataService.deletePreference(preferenceId);
        alert(`Preferenza eliminata con successo.`);
        closeModalAndClean(document.getElementById("preferenceActionModal"));
        window.navigate("preferenze");
    } catch (error) {
        console.error("Errore DELETE Preferenza:", error);
        alert(`Errore durante l'eliminazione: ${error.message}`);
    }
};

/**
 * Updates the preference list for the current teacher
 */
async function updatePreferenceList() {
    const user = getCurrentUser();
    const listContainer = document.getElementById("preferences-list-container");
    if (!listContainer || user.role !== "docente") return;

    listContainer.innerHTML = `<div class="p-4 text-center text-secondary content-card">Caricamento preferenze...</div>`;

    try {
        const allTeachers = await dataService.getTeachers();

        const currentTeacher = allTeachers.find((t) => t.name === user.name);

        if (!currentTeacher) {
            listContainer.innerHTML =
                '<div class="alert alert-warning p-4 content-card">Profilo docente non trovato per questo account.</div>';
            return;
        }

        const preferences = await dataService.getTeacherPreferences(
            currentTeacher._id
        );
        PREFERENCE_CACHE = preferences;

        const preferenceCards = preferences
            .map((p) => getPreferenzaCard(p))
            .join("");

        listContainer.innerHTML =
            preferenceCards.length > 0
                ? preferenceCards
                : '<div class="p-4 text-center text-secondary content-card">Nessuna preferenza oraria definita.</div>';
    } catch (error) {
        console.error("Errore nel caricamento delle preferenze:", error);
        listContainer.innerHTML =
            '<div class="alert alert-danger p-4 content-card">Errore nel caricamento delle preferenze.</div>';
    }
}
window.updatePreferenceList = updatePreferenceList;

// =======================================================
// === NOTIFICATION ===
// =======================================================

/**
 * Updates the notifications list for the current user
 */
async function updateNotificationList() {
    const container = document.getElementById("notifications-list-container");
    const user = getCurrentUser();

    if (!container) return;

    if (!user.id) {
        container.innerHTML = `<div class="p-4 text-center text-secondary content-card">Impossibile caricare le notifiche: Utente non identificato.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="p-4 text-center text-secondary content-card">
            <div class="spinner-border text-primary spinner-border-sm" role="status"></div> Caricamento notifiche...
        </div>
    `;

    try {

        const notifications = await dataService.getNotifications(user.id);
        NOTIFICATION_CACHE = notifications;

        const notificationCards = notifications
            .map((notification) => getNotificaCard(notification))
            .join("");
        const unreadCount = notifications.filter((n) => !n.is_read).length;

        container.innerHTML =
            notificationCards.length > 0
                ? notificationCards
                : '<div class="p-4 text-center text-secondary content-card">Nessuna notifica presente.</div>';

        if (window.updateNotificationCount) {
            window.updateNotificationCount(unreadCount);
        }

        const infoText = document.getElementById("notification-info-text");
        if (infoText) {
            infoText.textContent = `Visualizza le notifiche del sistema destinate al ruolo di ${user.role}. Trovate ${notifications.length} notifiche.`;
        }
    } catch (error) {
        console.error("Errore nel caricamento delle notifiche:", error);
        container.innerHTML =
            '<div class="alert alert-danger p-4 content-card">Errore nel caricamento delle notifiche.</div>';
    }
}
window.updateNotificationList = updateNotificationList;

/**
 * Marks all notifications as read for the current user
 */
window.markAllRead = async () => {
    const user = getCurrentUser();

    if (!user.id) {
        alert("Impossibile contrassegnare: ID utente non disponibile.");
        return;
    }

    try {
        await dataService.markAllNotificationsRead(user.id);
        window.updateNotificationList();
    } catch (error) {
        console.error("Errore nel marcare tutto come letto:", error);
        alert(`Errore: ${error.message}`);
    }
};

/**
 * Marks a single notification as read
 * @param {string} id - The notification ID
 */
window.markNotificationRead = async (id) => {
    try {
        await dataService.markNotificationRead(id);
        // Reload the list
        window.updateNotificationList();
    } catch (error) {
        console.error("Errore nel marcare come letto:", error);
        alert(`Errore: ${error.message}`);
    }
};

/**
 * Deletes a single notification
 * @param {string} id - The notification ID
 * @param {string} title - The notification title for confirmation
 */
window.deleteNotification = async (id, title) => {
    if (!confirm(`Sei sicuro di voler eliminare la notifica: "${title}"?`)) {
        return;
    }

    try {
        await dataService.deleteNotification(id);

        // Reload the list
        window.updateNotificationList();
    } catch (error) {
        console.error("Errore nell'eliminazione della notifica:", error);
        alert(`Errore nell'eliminazione: ${error.message}`);
    }
};

/**
 * Deletes all notifications for the current user
 */
window.deleteAllNotifications = async () => {
    const user = getCurrentUser();

    if (!user.id) {
        alert("Impossibile eliminare: ID utente non disponibile.");
        return;
    }

    if (
        !confirm(
            "ATTENZIONE: Sei sicuro di voler ELIMINARE DEFINITIVAMENTE TUTTE le tue notifiche? Questa azione è irreversibile."
        )
    ) {
        return;
    }

    try {
        await dataService.deleteAllNotifications(user.id);

        window.updateNotificationList();
    } catch (error) {
        console.error("Errore nell'eliminazione di tutte le notifiche:", error);
        alert(`Errore nell'eliminazione di tutte le notifiche: ${error.message}`);
    }
};

/**
 * Loads only the count of unread notifications and updates the navbar badge
 */
window.loadNotificationCount = async () => {
    const user = getCurrentUser();
    if (!user.id) return; // Do not proceed without user ID

    try {
        const notifications = await dataService.getNotifications(user.id);
        const unreadCount = notifications.filter((n) => !n.is_read).length;

        if (window.updateNotificationCount) {
            window.updateNotificationCount(unreadCount);
        }
    } catch (error) {
        console.error("Errore nel caricamento del conteggio notifiche:", error);
    }
};
window.loadNotificationCount = window.loadNotificationCount;

// =======================================================
// === CONSTRAINTS ===
// =======================================================

/**
 * Opens the modal to add a new constraint
 */
window.openAddConstraintModal = async function () {
    const modalId = "constraintActionModal";
    const constraintsInDb = await dataService.getConstraints();
    const tagsInDb = constraintsInDb.map((c) => c.tag);

    // Filter out already existing constraints
    const availableOptions = SUPPORTED_CONSTRAINTS.filter(
        (c) => !tagsInDb.includes(c.tag)
    );

    if (availableOptions.length === 0) {
        alert("Tutti i vincoli logici supportati sono già attivi.");
        return;
    }

    const tagOptions = availableOptions
        .map((c) => `<option value="${c.tag}">${c.name}</option>`)
        .join("");

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveNewConstraint()">
            <div class="alert alert-info py-2 mb-3" style="font-size: 0.85rem;">
                <i class="bi bi-info-circle me-2"></i>
                Tutti i vincoli aggiunti verranno trattati come <strong>Rigidi</strong> (obbligatori).
            </div>

            <div class="mb-3">
                <label class="form-label fw-bold">Logica Algoritmo:</label>
                <select class="form-select" id="constraint-tag" required onchange="window.updateConstraintHelpText(this.value)">
                    <option value="">-- Seleziona un vincolo da attivare --</option>
                    ${tagOptions}
                </select>
            </div>

            <div id="constraint-help-box" class="mb-3 p-3 bg-light border rounded d-none">
                <small class="text-uppercase fw-bold text-muted d-block mb-1" style="font-size: 0.7rem;">Funzionamento tecnico:</small>
                <div id="constraint-desc-text" class="text-secondary small italic"></div>
            </div>

            <div class="mb-3">
                <label class="form-label fw-bold">Nome Etichetta:</label>
                <input type="text" class="form-control" id="constraint-description" required 
                       placeholder="Es: Orario Compatto">
            </div>

            <div class="mt-4 d-flex justify-content-center gap-2">
                <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success">Attiva Vincolo</button>
            </div>
        </form>
    `;

    document.getElementById("constraint-modal-title").textContent =
        "Attiva Nuovo Vincolo Rigido";
    document.getElementById("constraint-modal-body").innerHTML = formHtml;

    const modalElement = document.getElementById(modalId);
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Helper function to show dynamic constraint description
 * @param {string} tag - The constraint tag
 */
window.updateConstraintHelpText = (tag) => {
    const infoBox = document.getElementById("constraint-help-box");
    const descText = document.getElementById("constraint-desc-text");
    const selected = SUPPORTED_CONSTRAINTS.find((c) => c.tag === tag);

    if (selected) {
        infoBox.classList.remove("d-none");
        descText.textContent = selected.desc;
        document.getElementById("constraint-description").value = selected.name;
    } else {
        infoBox.classList.add("d-none");
    }
};

/**
 * Saves a new constraint
 */
window.saveNewConstraint = async () => {
    const tag = document.getElementById("constraint-tag").value;
    const customName = document.getElementById("constraint-description").value;

    const techInfo = SUPPORTED_CONSTRAINTS.find((c) => c.tag === tag);

    const payload = {
        tag: tag,
        name: customName,
        description: techInfo ? techInfo.desc : "",
        type: "Rigido",
    };

    try {
        await dataService.addConstraint(payload);
        const modalElement = document.getElementById("constraintActionModal");
        bootstrap.Modal.getInstance(modalElement).hide();

        const content = await getVincoliContent();
        document.getElementById("dashboard-content").innerHTML = content;
        alert("Vincolo attivato con successo!");
    } catch (error) {
        alert("Errore nel salvataggio: " + error.message);
    }
};

/**
 * Saves an edited constraint
 * @param {string} constraintId - The constraint ID to update
 */
async function saveEditedConstraint(constraintId) {
    const payload = {
        description: document
            .getElementById("edit-constraint-description")
            .value.trim(),
        type: document.getElementById("edit-constraint-type").value,
        priority: parseInt(
            document.getElementById("edit-constraint-priority").value,
            10
        ),
        tag: document.getElementById("edit-constraint-tag").value.trim(),
    };

    if (payload.priority < 1 || payload.priority > 5) {
        alert("La priorità deve essere compresa tra 1 e 5.");
        return;
    }

    try {
        await dataService.updateConstraint(constraintId, payload);
        alert(`Vincolo "${payload.description}" aggiornato con successo!`);
        closeModalAndClean(document.getElementById("constraintActionModal"));
        window.navigate("vincoli");
    } catch (error) {
        console.error("Errore PUT Vincolo:", error);
        alert(`Errore nell'aggiornamento del vincolo: ${error.message}`);
    }
}
window.saveEditedConstraint = saveEditedConstraint;

/**
 * Shows confirmation dialog before deleting a constraint
 * @param {string} constraintId - The constraint ID to delete
 * @param {string} constraintDescription - The constraint description for display
 */
window.deleteConstraintConfirmation = (constraintId, constraintDescription) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare il vincolo <strong class="text-dark">${constraintDescription}</strong>? Questa azione è irreversibile.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteConstraint('${constraintId}', '${constraintDescription}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "constraint-modal-title"
    ).textContent = `Elimina Vincolo: ${constraintDescription}`;
    document.getElementById("constraint-modal-body").innerHTML = confirmationHtml;

    let modalElement = document.getElementById("constraintActionModal");
    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getConstraintModalHtml());
        modalElement = document.getElementById("constraintActionModal");
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Deletes a constraint
 * @param {string} constraintId - The constraint ID to delete
 * @param {string} constraintDescription - The constraint description for feedback
 */
window.deleteConstraint = async (constraintId, constraintDescription) => {
    try {
        await dataService.deleteConstraint(constraintId);
        alert(`Vincolo "${constraintDescription}" eliminato con successo.`);
        closeModalAndClean(document.getElementById("constraintActionModal"));
        window.navigate("vincoli");
    } catch (error) {
        console.error("Errore DELETE Vincolo:", error);
        alert(
            `Errore durante l'eliminazione di ${constraintDescription}: ${error.message}`
        );
    }
};

// =======================================================
// === SCHEDULE ===
// =======================================================

/**
 * Simulates the DELETE call to remove a lesson from the DB
 * @param {string} entryId - The lesson ID to delete
 * @param {string} subjectName - The subject name for feedback
 */
async function deleteScheduleEntry(entryId, subjectName) {
    // NOTE: Confirmation now happens via modal before calling this function

    console.log(`[API CALL] Attempting DELETE for lesson ID: ${entryId}`);

    try {
        const response = await fetch(`/api/schedule/${entryId}`, {
            method: "DELETE",
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Eliminazione fallita: ${errorText}`);
        }

        alert(`Lezione "${subjectName}" eliminata con successo!`);

        if (window.loadNotificationCount) {
            window.loadNotificationCount();
        }
    } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        alert(`Errore durante l'eliminazione di ${subjectName}. Vedi console.`);
    }

    const modalElement = document.getElementById("lessonActionModal");
    closeModalAndClean(modalElement);

    window.updateScheduleTable(
        document.getElementById("corso-select").value,
        document.getElementById("anno-select").value
    );
}
window.deleteScheduleEntry = deleteScheduleEntry;

/**
 * Function to switch to the DELETE CONFIRMATION screen in the modal
 * @param {string} entryId - The lesson ID to delete
 * @param {string} subjectName - The subject name for display
 */
window.showDeleteConfirmationScreen = (entryId, subjectName) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare la lezione di <strong class="text-dark">${subjectName}</strong>? Questa azione è irreversibile.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteScheduleEntry('${entryId}', '${subjectName}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById("lesson-action-form-section").innerHTML =
        confirmationHtml;
    document
        .getElementById("lesson-action-form-section")
        .classList.remove("d-none");
    document
        .getElementById("lesson-action-choice-section")
        .classList.add("d-none");
    document.getElementById(
        "modal-title-text"
    ).textContent = `Conferma Eliminazione`;
};
window.showDeleteConfirmationScreen = showDeleteConfirmationScreen;

/**
 * Validates if the value in the Subject input is a valid value from the datalist
 * @returns {boolean} True if valid, false otherwise
 */
function validateSubjectSelection() {
    const subjectInput = document.getElementById("edit-lesson-subject");
    const datalist = document.getElementById("subject-list");
    const currentValue = subjectInput.value;

    const isValid = Array.from(datalist.options).some(
        (option) => option.value === currentValue
    );

    if (!isValid && currentValue !== "") {
        alert("Per favor, seleziona una materia valida dall'elenco suggerito.");
        subjectInput.value = "";
        subjectInput.focus();
        return false;
    }
    return true;
}
window.validateSubjectSelection = validateSubjectSelection;

/**
 * Function to dynamically update the Teacher field based on the selected Subject
 * @param {string} subjectName - The selected subject name
 */
window.updateTeacherAvailability = (subjectName) => {
    const teacherSelect = document.getElementById("edit-lesson-teacher");
    if (!teacherSelect) return;


    const relevantTeachers = TEACHER_CACHE.filter(
        (t) => t.subjects && t.subjects.includes(subjectName)
    );

    let teacherOptions = "";
    let autoSelectTeacher = null;
    let isDisabled = false;

    const currentSelection = teacherSelect.value;

    // CASE 1: Valid subject found
    if (subjectName !== "" && relevantTeachers.length > 0) {
        if (relevantTeachers.length === 1) {
            autoSelectTeacher = relevantTeachers[0].name;
            isDisabled = true;
        }

        // Populate the select with relevant teachers
        teacherOptions = relevantTeachers
            .map(
                (t) =>
                    `<option value="${t.name}" ${t.name === (autoSelectTeacher || currentSelection) ? "selected" : ""
                    }>${t.name}</option>`
            )
            .join("");
    } else {
        // CASE 2: Subject not selected or invalid (including empty string)
        teacherOptions =
            '<option value="">-- Seleziona prima la Materia --</option>';
        isDisabled = true;
    }

    teacherSelect.innerHTML = teacherOptions;
    teacherSelect.disabled = isDisabled;

    // Force selection or reset of value after updating options
    if (isDisabled && autoSelectTeacher) {
        teacherSelect.value = autoSelectTeacher;
    } else if (
        isDisabled &&
        (subjectName === "" || relevantTeachers.length === 0)
    ) {
        // If disabled and there's no unique teacher to auto-select, empty the value.
        teacherSelect.value = "";
    } else if (teacherSelect.selectedIndex === -1) {
        // If selection is lost (and not disabled), select the first element.
        teacherSelect.selectedIndex = 0;
    }
};
window.updateTeacherAvailability = updateTeacherAvailability;

/**
 * Populates the edit form with current lesson data and shows it
 * @param {string} entryId - The ID of the lesson to edit
 * @param {boolean} isAdd - If true, prepares the form for adding, not editing
 */
async function openEditForm(entryId, isAdd = false) {
    let currentEntry = {};
    const defaultCourseName =
        document.getElementById("corso-select")?.value || "";
    const defaultCourseYear = document.getElementById("anno-select")?.value || "";

    if (!isAdd) {
        // 1. Find the complete lesson object from cache
        currentEntry = SCHEDULE_CACHE.find((entry) => entry._id === entryId);
        if (!currentEntry) {
            alert("Errore: Dati lezione non trovati in cache.");
            return;
        }
    } else {
        // Logic for adding
        currentEntry = {
            _id: "new",
            subject_name: "",
            course_name: defaultCourseName,
            course_year: defaultCourseYear,
            day: entryId,
            time_slot: "",
            teacher_name: "",
            classroom_name: CLASSROOM_CACHE[0]?.name || "",
            status: "In Attesa",
        };
        const [day, time_slot] = entryId.split("_");
        currentEntry.day = day;
        currentEntry.time_slot = time_slot;
    }

    // 2. Populate selects with all available data
    if (TEACHER_CACHE.length === 0) {
        TEACHER_CACHE = await dataService.getTeachers();
    }
    if (CLASSROOM_CACHE.length === 0) {
        CLASSROOM_CACHE = await dataService.getClassrooms();
    }
    if (SUBJECT_CACHE.length === 0) {
        SUBJECT_CACHE = await dataService.getSubjects();
    }
    if (COURSE_CACHE.length === 0) {
        COURSE_CACHE = await dataService.getCourses();
    }

    // Generate options
    // Teacher options are initially all loaded
    const teacherOptions = TEACHER_CACHE.map(
        (t) =>
            `<option value="${t.name}" ${t.name === currentEntry.teacher_name ? "selected" : ""
            }>${t.name}</option>`
    ).join("");

    const classroomOptions = CLASSROOM_CACHE.map(
        (c) =>
            `<option value="${c.name}" ${c.name === currentEntry.classroom_name ? "selected" : ""
            }>${c.name}</option>`
    ).join("");

    // Filter subjects by course/year 
    const currentCourseFilter = `${currentEntry.course_name} - ${currentEntry.course_year}`;
    const filteredSubjects = SUBJECT_CACHE.filter(
        (s) => s.course_ref === currentCourseFilter
    );

    // Subject DATALIST options
    const subjectDatalistOptions = filteredSubjects
        .map((s) => `<option value="${s.name}"></option>`)
        .join("");

    // Course/Year Select
    const courseYearOptions = COURSE_CACHE.map((c) => {
        const fullCourse = `${c.name} - ${c.year}`;
        const currentCourse = `${currentEntry.course_name} - ${currentEntry.course_year}`;

        // Add selected attribute only if it matches current selection
        const selectedAttr = fullCourse === currentCourse ? "selected" : "";

        return `<option value="${fullCourse}" ${selectedAttr}>${fullCourse}</option>`;
    }).join("");

    // Generate options for Day and Time Slot
    const dayOptions = DAYS.map(
        (d) =>
            `<option value="${d}" ${d === currentEntry.day ? "selected" : ""
            }>${d}</option>`
    ).join("");

    const timeSlotOptions = TIME_SLOTS.map(
        (ts) =>
            `<option value="${ts}" ${ts === currentEntry.time_slot ? "selected" : ""
            }>${ts}</option>`
    ).join("");

    const submitAction = isAdd
        ? "window.saveLessonAdd()"
        : "window.saveLessonEdit()";
    const modalTitle = isAdd
        ? "Aggiungi Nuova Lezione"
        : `Modifica Lezione: ${currentEntry.subject_name}`;

    const fixedFieldsDisabled = isAdd ? "disabled" : "";

    // 3. Generate dynamic form
    const formHtml = `
        <form onsubmit="event.preventDefault(); ${submitAction}">
            <input type="hidden" id="edit-lesson-id" value="${currentEntry._id
        }">

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label fw-bold">Materia:</label>
                    <input list="subject-list" 
                           id="edit-lesson-subject" 
                           class="form-control" 
                           value="${currentEntry.subject_name}"
                           placeholder="Cerca o seleziona materia"
                           onchange="window.updateTeacherAvailability(this.value);"
                           required>
                    <datalist id="subject-list">
                        ${subjectDatalistOptions}
                    </datalist>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label fw-bold">Corso/Anno:</label>
                    <select id="edit-lesson-courseyear" class="form-select" disabled>
                        ${courseYearOptions}
                    </select>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Giorno:</label>
                    <select id="edit-lesson-day" class="form-select" ${fixedFieldsDisabled}>
                        ${dayOptions}
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Slot Orario:</label>
                    <select id="edit-lesson-timeslot" class="form-select" ${fixedFieldsDisabled}>
                        ${timeSlotOptions}
                    </select>
                </div>
            </div>
            <div class="mb-3 row">
                <div class="col-md-6">
                    <label class="form-label">Aula:</label>
                    <select id="edit-lesson-classroom" class="form-select">
                        ${classroomOptions}
                    </select>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Status:</label>
                    <select id="edit-lesson-status" class="form-select">
                        <option value="Confermato" ${currentEntry.status === "Confermato" ? "selected" : ""
        }>Confermato</option>
                        <option value="In Attesa" ${currentEntry.status === "In Attesa" ? "selected" : ""
        }>In Attesa</option>
                        <option value="Conflitto" ${currentEntry.status === "Conflitto" ? "selected" : ""
        }>Conflitto</option>
                    </select>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Docente:</label>
                <select id="edit-lesson-teacher" class="form-select">
                    ${teacherOptions}
                </select>
            </div>

            <div class="mt-4 d-flex justify-content-center gap-3">
                <button type="button" class="btn btn-danger action-btn" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success action-btn">${isAdd ? "Aggiungi Lezione" : "Salva Modifiche"
        }</button>
            </div>
        </form>
    `;

    // 4. Inject form into modal
    document.getElementById("lesson-action-form-section").innerHTML = formHtml;

    // 5. Update titles and sections
    document
        .getElementById("lesson-action-form-section")
        .classList.remove("d-none");
    document
        .getElementById("lesson-action-choice-section")
        .classList.add("d-none");
    document.getElementById("modal-title-text").textContent = modalTitle;

    // 6. Perform initial teacher availability update
    window.updateTeacherAvailability(currentEntry.subject_name);

    // 7. Show modal
    const modalElement = document.getElementById("lessonActionModal");
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();
}
window.openEditForm = openEditForm;

/**
 * Handles saving a NEW lesson (POST call)
 */
window.saveLessonAdd = async () => {
    if (!window.validateSubjectSelection()) return;

    const newSubject = document.getElementById("edit-lesson-subject").value;
    const newCourseYear = document.getElementById("edit-lesson-courseyear").value;
    const newDay = document.getElementById("edit-lesson-day").value;
    const newTimeSlot = document.getElementById("edit-lesson-timeslot").value;
    const newTeacher = document.getElementById("edit-lesson-teacher").value;
    const newClassroom = document.getElementById("edit-lesson-classroom").value;
    const newStatus = document.getElementById("edit-lesson-status").value;

    const [course_name, course_year] = newCourseYear.split(" - ");

    const payload = {
        subject_name: newSubject,
        course_name: course_name,
        course_year: course_year,
        day: newDay,
        time_slot: newTimeSlot,
        teacher_name: newTeacher,
        classroom_name: newClassroom,
        status: newStatus,
    };

    try {
        const response = await fetch(`/api/schedule`, {
            method: "POST",
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Aggiunta fallita: ${errorText}`);
        }

        if (window.loadNotificationCount) {
            window.loadNotificationCount();
        }
    } catch (error) {
        console.error("Errore durante l'aggiunta:", error);
        alert(`Errore durante l'aggiunta. Vedi console.`);
    }

    // Close modal and clean backdrop
    const modalElement = document.getElementById("lessonActionModal");
    closeModalAndClean(modalElement);

    window.scheduleViewHandler.handleSelectionChange();
};

/**
 * Retrieves current values from selects and updates the table
 */
window.scheduleViewHandler = {
    handleSelectionChange: function () {
        const corsoSelect = document.getElementById("corso-select");
        const annoSelect = document.getElementById("anno-select");

        if (corsoSelect && annoSelect) {
            const corso = corsoSelect.value;
            const anno = annoSelect.value;

            window.updateScheduleTable(corso, anno);
        }
    },
};

/**
 * Handles saving modified data (PUT call)
 */
window.saveLessonEdit = async () => {
    if (!window.validateSubjectSelection()) return;

    const entryId = document.getElementById("edit-lesson-id").value;

    // New fields
    const newSubject = document.getElementById("edit-lesson-subject").value;
    const newCourseYear = document.getElementById("edit-lesson-courseyear").value;
    const newDay = document.getElementById("edit-lesson-day").value;
    const newTimeSlot = document.getElementById("edit-lesson-timeslot").value;
    const newTeacher = document.getElementById("edit-lesson-teacher").value;
    const newClassroom = document.getElementById("edit-lesson-classroom").value;
    const newStatus = document.getElementById("edit-lesson-status").value;

    // Course/Year decomposition
    const [course_name, course_year] = newCourseYear.split(" - ");

    const payload = {
        subject_name: newSubject,
        course_name: course_name,
        course_year: course_year,
        day: newDay,
        time_slot: newTimeSlot,
        teacher_name: newTeacher,
        classroom_name: newClassroom,
        status: newStatus,
    };

    try {
        const response = await fetch(`/api/schedule/${entryId}`, {
            method: "PUT",
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Aggiornamento fallito: ${errorText}`);
        }

        alert(`Lezione ID ${entryId} salvata con successo.`);

        if (window.loadNotificationCount) {
            window.loadNotificationCount();
        }
    } catch (error) {
        console.error("Errore durante l'aggiornamento:", error);
        alert(`Errore durante l'aggiornamento. Vedi console.`);
    }

    // Close modal and clean backdrop
    const modalElement = document.getElementById("lessonActionModal");
    closeModalAndClean(modalElement);

    window.scheduleViewHandler.handleSelectionChange();
};

/**
 * Handles initial click on time slot to show choice modal
 * @param {string} entryId - The lesson ID
 * @param {string} subjectName - The subject name for display
 */
window.handleLessonClick = (entryId, subjectName) => {
    if (getCurrentUser().role !== "admin") {
        console.log(
            `[WARNING] Access denied: Only administrators can modify lessons.`
        );
        return;
    }

    // Set default values for modal
    document.getElementById("lesson-id-to-delete").value = entryId;
    document.getElementById("lesson-name-to-delete").textContent = subjectName;

    // Reset modal to show choice section
    document.getElementById("lesson-action-form-section").classList.add("d-none");
    document
        .getElementById("lesson-action-choice-section")
        .classList.remove("d-none");
    document.getElementById(
        "modal-title-text"
    ).textContent = `Azioni per: ${subjectName}`;

    // Use Bootstrap Modal object to open the dialog
    const modalElement = document.getElementById("lessonActionModal");
    // Need to initialize Modal object if not already done
    if (
        typeof bootstrap === "undefined" ||
        typeof bootstrap.Modal === "undefined"
    ) {
        alert(
            "Errore: Libreria Bootstrap JS non caricata. Impossibile aprire la modale."
        );
        console.error("Bootstrap JS Modal object not found.");
        return;
    }
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();
};

/**
 * Opens status management modal for teacher
 * @param {string} entryId - The lesson ID
 * @param {string} subjectName - The subject name for display
 */
window.openStatusModal = function (entryId, subjectName) {
    const container = document.getElementById("status-modal-container");
    if (!container) return;

    const modalHtml = `
        <div class="modal fade" id="statusActionModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content shadow-lg border-0">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title fw-bold">Gestione Lezione: ${subjectName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center p-4">
                        <p class="mb-4">Conferma la tua disponibilità per questa lezione o segnala un conflitto all'amministratore.</p>
                        <div class="d-grid gap-3">
                            <button class="btn btn-success py-2 fw-bold" onclick="window.processStatusUpdate('${entryId}', 'Confermato')">
                                <i class="fas fa-check-circle me-2"></i> Conferma Lezione
                            </button>
                            <button class="btn btn-danger py-2 fw-bold" onclick="window.processStatusUpdate('${entryId}', 'Conflitto')">
                                <i class="fas fa-exclamation-triangle me-2"></i> Segnala Conflitto
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = modalHtml;
    const modal = new bootstrap.Modal(
        document.getElementById("statusActionModal")
    );
    modal.show();
};

/**
 * Sends status update to server
 * @param {string} id - The lesson ID
 * @param {string} status - The new status
 */
window.processStatusUpdate = async function (id, status) {
    try {
        const modalElement = document.getElementById("statusActionModal");
        const modalInstance = bootstrap.Modal.getInstance(modalElement);

        await dataService.updateLessonStatus(id, status);

        if (modalInstance) {
            modalInstance.hide();
        }

        const user = getCurrentUser();
        window.updateScheduleTable(null, null, user.name);
    } catch (error) {
        console.error("Errore durante l'aggiornamento dello stato:", error);
        alert("Impossibile aggiornare lo stato: " + error.message);
    }
};

/**
 * Creates a schedule block HTML element
 * @param {Object} entry - The lesson entry object
 * @returns {string} HTML for the schedule block
 */
export function createScheduleBlock(entry) {
    const {
        _id,
        subject_name,
        teacher_name,
        classroom_name,
        status,
        course_name,
        course_year,
    } = entry;
    const user = getCurrentUser();

    let blockClass = "block-green";
    let statusBadge = `<span class="badge bg-success me-2">Confermato</span>`;

    if (status === "In Attesa") {
        blockClass = "block-yellow";
        statusBadge = `<span class="badge bg-warning me-2">In Attesa</span>`;
    } else if (status === "Conflitto") {
        blockClass = "block-red";
        statusBadge = `<span class="badge bg-danger me-2">Conflitto</span>`;
    }

    const isRestrictedUser = ["docente"].includes(user.role);

    const teacherDisplay =
        user.role === "docente"
            ? ""
            : `<p class="text-xs m-0">Docente: ${teacher_name}</p>`;

    const detailsHtml = isRestrictedUser
        ? `
        <div class="fw-bold">${subject_name}</div>
        ${user.role === "docente"
            ? ""
            : `<p class="text-xs m-0">${teacher_name}</p>`
        }
        <p class="text-xs m-0">Aula: ${classroom_name}</p>
    `
        : `
        <div class="fw-bold">${subject_name}</div>
        <p class="text-xs m-0">Corso: ${course_name} - ${course_year}</p>
        ${teacherDisplay}
        <p class="text-xs m-0">Aula: ${classroom_name}</p>
    `;

    let onClickAction = `console.log('Dettagli Lezione: ${subject_name}')`;

    if (user.role === "admin") {
        onClickAction = `window.handleLessonClick('${_id}', '${subject_name}')`;
    } else if (user.role === "docente") {
        onClickAction = `window.openStatusModal('${_id}', '${subject_name}')`;
    }

    return `
        <div class="schedule-block ${blockClass}" onclick="${onClickAction}">
            ${statusBadge}
            ${detailsHtml}
        </div>
    `;
}

/**
 * Updates only the schedule table
 * @param {string} course - Course name filter
 * @param {string} year - Year filter
 * @param {string} teacherFilter - Optional teacher name filter
 */
async function updateScheduleTable(course, year, teacherFilter = null) {
    const scheduleTableBody = document.getElementById("schedule-table-body");
    const infoText = document.getElementById("current-schedule-info");
    const user = getCurrentUser();

    if (!scheduleTableBody) return;

    scheduleTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="spinner-border text-primary spinner-border-sm" role="status"></div> Caricamento orario...
            </td>
        </tr>
    `;

    try {
        let allEntries = [];

        if (teacherFilter) {
            allEntries = await dataService.getSchedule("", "");
            SCHEDULE_CACHE = allEntries.filter(
                (entry) => entry.teacher_name === teacherFilter
            );
        } else {
            SCHEDULE_CACHE = await dataService.getSchedule(course, year);
        }

        // 2. Map schedule for quick access
        const scheduleMap = new Map();
        SCHEDULE_CACHE.forEach((entry) => {
            if (!scheduleMap.has(entry.day)) {
                scheduleMap.set(entry.day, new Map());
            }
            if (!scheduleMap.get(entry.day).has(entry.time_slot)) {
                scheduleMap.get(entry.day).set(entry.time_slot, []);
            }
            scheduleMap.get(entry.day).get(entry.time_slot).push(entry);
        });

        // 3. Generate table HTML
        const tableBodyHtml = TIME_SLOTS.map((timeSlot) => {
            const rowData = DAYS.map((day) => {
                const entries = scheduleMap.get(day)?.get(timeSlot) || [];

                if (entries.length > 0) {
                    return `<td>${entries
                        .map((entry) => createScheduleBlock(entry))
                        .join("")}</td>`;
                } else {
                    const isAddAction = user.role === "admin";
                    const dayTimeSlotId = `${day}_${timeSlot}`;

                    return isAddAction
                        ? `
                        <td onclick="window.openAddLessonForm('${dayTimeSlotId}')" class="add-lesson-cell">
                            <div class="add-lesson-wrapper">
                                <span class="fas fa-plus"></span>
                            </div>
                        </td>
                    `
                        : `<td></td>`;
                }
            }).join("");

            return `
                <tr>
                    <td class="time-slot">${timeSlot}</td>
                    ${rowData}
                </tr>
            `;
        }).join("");

        scheduleTableBody.innerHTML = tableBodyHtml;

        // Update info label
        if (infoText) {
            infoText.textContent = teacherFilter
                ? `Orario personale: ${teacherFilter}`
                : `Orario visualizzato: ${course} - Anno ${year}`;
        }
    } catch (error) {
        console.error("Errore nel caricamento della tabella:", error);
        scheduleTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Errore nel caricamento dei dati.</td></tr>`;
    }
}
window.updateScheduleTable = updateScheduleTable;

/**
 * Starts the schedule generation process
 */
window.startScheduleGeneration = async () => {
    const courseYearValue = document.getElementById("generation-course-year").value;
    const generateButton = document.getElementById("generate-button");

    if (!courseYearValue) {
        window.showToast("Seleziona un corso e un anno", "error");
        return;
    }

    generateButton.disabled = true;
    generateButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Generazione...`;

    const [course, year] = courseYearValue.split(" - ");

    try {
        const result = await dataService.generateSchedule({
            course,
            year: Number(year),
            optimizationType: document.getElementById("generation-type").value,
            respectPreferences: document.getElementById("opt-teacher-preferences").checked
        });

        sessionStorage.setItem('auto_load_course', course);
        sessionStorage.setItem('auto_load_year', year);

        window.showToast("Orario generato con successo!");

        window.navigate("orario");

    } catch (error) {
        window.showToast(error.message || "Errore di generazione", "error");
    } finally {
        generateButton.disabled = false;
        generateButton.innerHTML = `<i class="fas fa-magic me-2"></i> Avvia Generazione`;
    }
    if (window.loadNotificationCount) {
        window.loadNotificationCount();
    }
};
window.startScheduleGeneration = window.startScheduleGeneration;

/**
 * Opens the add lesson form
 * @param {string} dayTimeSlot - Combined day and time slot identifier
 */
window.openAddLessonForm = (dayTimeSlot) => {
    window.openEditForm(dayTimeSlot, true);
};

// =======================================================
// === TEACHER ===
// =======================================================

/**
 * Opens modal to add a new teacher
 */
async function openAddTeacherModal() {
    const modalId = "addTeacherModal";
    let modalElement = document.getElementById(modalId);

    if (SUBJECT_CACHE.length === 0) {
        SUBJECT_CACHE = await dataService.getSubjects();
    }

    if (!modalElement) {
        document.body.insertAdjacentHTML(
            "beforeend",
            getAddTeacherModalHtml(SUBJECT_CACHE)
        );
        modalElement = document.getElementById(modalId);

        modalElement.addEventListener("shown.bs.modal", function () {
            document.getElementById("addTeacherForm").reset();
            document.getElementById("teacher-max-hours").value = "18";
        });
        modalElement.addEventListener("hidden.bs.modal", function () {
            document.body.classList.remove("modal-open");
            document
                .querySelectorAll(".modal-backdrop")
                .forEach((backdrop) => backdrop.remove());
        });
    }

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();
}
window.openAddTeacherModal = openAddTeacherModal;

/**
 * Handles saving a NEW teacher
 */
async function saveNewTeacher() {
    const name = document.getElementById("teacher-name").value.trim();
    const email = document.getElementById("teacher-email").value.trim();
    const subjectsRaw = document
        .getElementById("teacher-subjects-input")
        .value.trim();
    const max_weekly_hours = parseInt(
        document.getElementById("teacher-max-hours").value,
        10
    );

    // Convert subject string to array
    const subjects = subjectsRaw
        ? subjectsRaw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

    if (!name || !email || isNaN(max_weekly_hours) || max_weekly_hours < 1) {
        alert("Per favore, compila tutti i campi richiesti correttamente.");
        return;
    }

    try {
        const payload = { name, email, subjects, max_weekly_hours };

        await dataService.addTeacher(payload);

        alert(`Docente "${name}" aggiunto con successo!`);

        const modalElement = document.getElementById("addTeacherModal");
        const bsModal = bootstrap.Modal.getInstance(modalElement);
        if (bsModal) bsModal.hide();

        window.navigate("docenti");
    } catch (error) {
        console.error("Errore durante l'aggiunta del Docente:", error);

        const errorMessage = error.message.includes("email")
            ? "Errore: L'indirizzo email è probabilmente già registrato o non valido."
            : error.message;

        alert(`Errore nell'aggiunta del docente: ${errorMessage}`);
    }
}
window.saveNewTeacher = saveNewTeacher;

/**
 * Validates if a single selected/typed subject exists in the subjects cache
 * @param {string} subjectName - The subject name to validate
 * @returns {boolean} True if valid or empty string, false otherwise
 */
function isSubjectValid(subjectName) {
    if (subjectName === "") {
        return true;
    }

    return SUBJECT_CACHE.some((subject) => subject.name === subjectName);
}
window.isSubjectValid = isSubjectValid;

/**
 * Performs strict validation for all subjects in the multiple input field
 * Returns false if any single subject is invalid
 * @returns {boolean} True if all subjects are valid, false otherwise
 */
function validateNewTeacherSubjects() {
    const subjectsInput = document.getElementById("teacher-subjects-input");
    const subjectsRaw = subjectsInput.value.trim();

    if (subjectsRaw === "") {
        return true;
    }

    // 1. Convert string to array of clean subjects
    const subjectsArray = subjectsRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // 2. Iterate and validate each subject
    const invalidSubjects = subjectsArray.filter((name) => !isSubjectValid(name));

    if (invalidSubjects.length > 0) {
        alert(
            `Le seguenti materie non sono state trovate nel database: ${invalidSubjects.join(
                ", "
            )}.\nPer favore, seleziona una materia dall'elenco suggerito o correggi l'ortografia.`
        );
        subjectsInput.focus();
        return false;
    }

    return true;
}
window.validateNewTeacherSubjects = validateNewTeacherSubjects;

/**
 * Handles teacher search input
 * @param {string} query - The search query
 */
window.handleTeacherSearch = (query) => {
    updateTeacherList(query);
};

/**
 * Updates only the teachers container based on search query
 * @param {string} searchQuery - The search text
 */
async function updateTeacherList(searchQuery) {
    const listContainer = document.getElementById("teachers-list-container");
    const countInfo = document.getElementById("teacher-count-info");
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="p-4 text-center text-secondary col-12">
            <div class="spinner-border text-primary spinner-border-sm" role="status"></div> Ricerca docenti...
        </div>
    `;

    try {
        // Load filtered data from API
        const teachers = await dataService.getTeachers(searchQuery);

        TEACHER_CACHE = teachers;

        const teacherCards = teachers
            .map((teacher) => getDocenteCard(teacher))
            .join("");

        listContainer.innerHTML =
            teacherCards.length > 0
                ? teacherCards
                : '<div class="p-4 text-center text-secondary col-12">Nessun docente trovato con i criteri di ricerca specificati.</div>';

        if (countInfo) {
            countInfo.textContent = `Gestisci i docenti e le loro informazioni. Trovati ${teachers.length} docenti.`;
        }
    } catch (error) {
        console.error("Errore durante l'aggiornamento della lista docenti:", error);
        listContainer.innerHTML =
            '<div class="alert alert-danger p-4 col-12">Errore nel caricamento della lista docenti.</div>';
    }
}
window.updateTeacherList = updateTeacherList;

/**
 * Populates edit form with current teacher data and shows it
 * @param {string} teacherId - The ID of the teacher to edit
 */
async function openEditTeacherModal(teacherId) {
    if (SUBJECT_CACHE.length === 0) {
        SUBJECT_CACHE = await dataService.getSubjects();
    }
    if (TEACHER_CACHE.length === 0) {
        TEACHER_CACHE = await dataService.getTeachers();
    }

    const currentTeacher = TEACHER_CACHE.find((t) => t._id === teacherId);
    if (!currentTeacher) {
        alert("Errore: Dati docente non trovati in cache.");
        return;
    }

    const subjectDatalistOptions = SUBJECT_CACHE.map(
        (s) => `<option value="${s.name}"></option>`
    ).join("");

    const subjectsString = currentTeacher.subjects.join(", ");

    const editFormHtml = `
        <form onsubmit="event.preventDefault(); window.saveEditedTeacher('${currentTeacher._id}')">
            <div class="mb-3">
                <label for="edit-teacher-name" class="form-label">Nome Completo:</label>
                <input type="text" class="form-control" id="edit-teacher-name" value="${currentTeacher.name}" required>
            </div>
            <div class="mb-3">
                <label for="edit-teacher-email" class="form-label">Email (Unica):</label>
                <input type="email" class="form-control" id="edit-teacher-email" value="${currentTeacher.email}" required>
            </div>
            <div class="mb-3">
                <label for="edit-teacher-subjects" class="form-label">Materie (Seleziona o digita, separate da virgola):</label>
                <input list="subject-options-list-edit" 
                       type="text" 
                       class="form-control" 
                       id="edit-teacher-subjects" 
                       value="${subjectsString}"
                       placeholder="Es: Analisi Matematica I, Programmazione I">
                
                <datalist id="subject-options-list-edit">
                    ${subjectDatalistOptions}
                </datalist>

                <small class="form-text text-muted">Solo le materie esistenti saranno accettate.</small>
            </div>
            <div class="mb-3">
                <label for="edit-teacher-max-hours" class="form-label">Ore Settimanali Massime:</label>
                <input type="number" class="form-control" id="edit-teacher-max-hours" value="${currentTeacher.max_weekly_hours}" required min="1">
            </div>
            
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success">Salva Modifiche</button>
            </div>
        </form>
    `;

    document.getElementById("teacher-modal-title").textContent = `Modifica Docente: ${currentTeacher.name}`;
    document.getElementById("teacher-modal-body").innerHTML = editFormHtml;

    const modalElement = document.getElementById("teacherActionModal");
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();
}
window.openEditTeacherModal = openEditTeacherModal;

/**
 * Handles saving edited teacher data (PUT call)
 * Must redo validation for uniqueness and subjects
 * @param {string} teacherId - The teacher ID to update
 */
window.saveEditedTeacher = async (teacherId) => {
    const name = document.getElementById("edit-teacher-name").value.trim();
    const email = document.getElementById("edit-teacher-email").value.trim();
    const subjectsRaw = document
        .getElementById("edit-teacher-subjects")
        .value.trim();
    const max_weekly_hours = parseInt(
        document.getElementById("edit-teacher-max-hours").value,
        10
    );

    const subjects = subjectsRaw
        ? subjectsRaw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

    // --- VALIDATION ---

    // 1. Subject Validation 
    const isSubjectValidEdit = (subjectName) => {
        if (subjectName === "") return true;
        return SUBJECT_CACHE.some((subject) => subject.name === subjectName);
    };

    const invalidSubjects = subjects.filter((name) => !isSubjectValidEdit(name));
    if (invalidSubjects.length > 0) {
        alert(
            `Le seguenti materie non sono state trovate nel database: ${invalidSubjects.join(
                ", "
            )}.`
        );
        return;
    }

    // 2. Uniqueness Validation for Name/Email
    const isDuplicate = TEACHER_CACHE.some(
        (t) =>
            (t._id !== teacherId && t.email.toLowerCase() === email.toLowerCase()) ||
            (t._id !== teacherId && t.name.toLowerCase() === name.toLowerCase())
    );

    if (isDuplicate) {
        alert(
            "Errore: Il nome o l'email inseriti sono già in uso da un altro docente."
        );
        return;
    }
    // --- END VALIDATION ---

    try {
        const payload = { name, email, subjects, max_weekly_hours };

        await dataService.updateTeacher(teacherId, payload);

        alert(`Docente "${name}" aggiornato con successo.`);

        const modalElement = document.getElementById("teacherActionModal");
        closeModalAndClean(modalElement);
        window.navigate("docenti");
    } catch (error) {
        console.error("Errore durante l'aggiornamento:", error);
        alert(`Errore durante l'aggiornamento: ${error.message}`);
    }
};

/**
 * Shows delete confirmation screen in modal
 * @param {string} teacherId - The teacher ID to delete
 * @param {string} teacherName - The teacher name for display
 */
window.deleteTeacherConfirmation = (teacherId, teacherName) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare il docente <strong class="text-dark">${teacherName}</strong>? Questa azione è irreversibile e disassocierà il docente da tutte le lezioni a cui è assegnato.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteTeacher('${teacherId}', '${teacherName}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "teacher-modal-title"
    ).textContent = `Elimina Docente: ${teacherName}`;
    document.getElementById("teacher-modal-body").innerHTML = confirmationHtml;

    const modalElement = document.getElementById("teacherActionModal");
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();
};

/**
 * Executes DELETE call to remove teacher
 * @param {string} teacherId - The teacher ID to delete
 * @param {string} teacherName - The teacher name for feedback
 */
window.deleteTeacher = async (teacherId, teacherName) => {
    try {
        await dataService.deleteTeacher(teacherId);

        // Close and reload list
        const modalElement = document.getElementById("teacherActionModal");
        closeModalAndClean(modalElement);
        window.navigate("docenti");
    } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        alert(`Errore durante l'eliminazione di ${teacherName}. Vedi console.`);
    }
};


// =======================================================
// === SUBJECTS ===
// =======================================================

/**
 * Opens modal to add a new subject
 */
async function openAddSubjectModal() {
    const modalId = "subjectActionModal";
    let modalElement = document.getElementById(modalId);

    if (COURSE_CACHE.length === 0) {
        COURSE_CACHE = await dataService.getCourses();
    }

    const courseOptions = COURSE_CACHE.map(
        (c) =>
            `<option value="${c.name} - ${c.year}">${c.name} - ${c.year}</option>`
    ).join("");

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveNewSubject()">
            <div class="mb-3">
                <label for="subject-name" class="form-label">Nome Materia:</label>
                <input type="text" class="form-control" id="subject-name" required>
            </div>
            <div class="mb-3">
                <label for="subject-code" class="form-label">Codice:</label>
                <input type="text" class="form-control" id="subject-code" required>
            </div>
            <div class="mb-3">
                <label for="subject-course-ref" class="form-label">Corso/Anno di Riferimento:</label>
                <select class="form-select" id="subject-course-ref" required>
                    <option value="">-- Seleziona Corso --</option>
                    ${courseOptions}
                </select>
            </div>
            <div class="mb-3">
                <label for="subject-weekly-hours" class="form-label">Ore Settimanali:</label>
                <input type="number" class="form-control" id="subject-weekly-hours" value="4" required min="2" step="2">
            </div>
            <div class="form-check mb-4">
                <input type="checkbox" class="form-check-input" id="subject-is-lab">
                <label class="form-check-label" for="subject-is-lab">Materia richiede laboratorio</label>
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-primary">Aggiungi Materia</button>
            </div>
        </form>
    `;

    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getSubjectModalHtml());
        modalElement = document.getElementById(modalId);
    }

    document.getElementById("subject-modal-title").textContent =
        "Aggiungi Nuova Materia";
    document.getElementById("subject-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
window.openAddSubjectModal = openAddSubjectModal;

/**
 * Opens modal to edit an existing subject
 * @param {string} subjectId - The subject ID to edit
 */
async function openEditSubjectModal(subjectId) {
    if (SUBJECT_CACHE.length === 0)
        SUBJECT_CACHE = await dataService.getSubjects();
    if (COURSE_CACHE.length === 0) COURSE_CACHE = await dataService.getCourses();

    const currentSubject = SUBJECT_CACHE.find((s) => s._id === subjectId);
    if (!currentSubject) {
        alert("Dati materia non trovati.");
        return;
    }

    const courseOptions = COURSE_CACHE.map((c) => {
        const fullCourse = `${c.name} - ${c.year}`;
        const selected = fullCourse === currentSubject.course_ref ? "selected" : "";
        return `<option value="${fullCourse}" ${selected}>${fullCourse}</option>`;
    }).join("");

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveEditedSubject('${currentSubject._id
        }')">
            <div class="mb-3">
                <label for="edit-subject-name" class="form-label">Nome Materia:</label>
                <input type="text" class="form-control" id="edit-subject-name" value="${currentSubject.name
        }" required>
            </div>
            <div class="mb-3">
                <label for="edit-subject-code" class="form-label">Codice:</label>
                <input type="text" class="form-control" id="edit-subject-code" value="${currentSubject.code
        }" required>
            </div>
            <div class="mb-3">
                <label for="edit-subject-course-ref" class="form-label">Corso/Anno di Riferimento:</label>
                <select class="form-select" id="edit-subject-course-ref" required>
                    ${courseOptions}
                </select>
            </div>
            <div class="mb-3">
                <label for="edit-subject-weekly-hours" class="form-label">Ore Settimanali:</label>
                <input type="number" class="form-control" id="edit-subject-weekly-hours" value="${currentSubject.weekly_hours
        }" required min="2" step="2">
            </div>
            <div class="form-check mb-4">
                <input type="checkbox" class="form-check-input" id="edit-subject-is-lab" ${currentSubject.is_lab ? "checked" : ""
        }>
                <label class="form-check-label" for="edit-subject-is-lab">Materia richiede laboratorio</label>
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success">Salva Modifiche</button>
            </div>
        </form>
    `;

    document.getElementById(
        "subject-modal-title"
    ).textContent = `Modifica Materia: ${currentSubject.name}`;
    document.getElementById("subject-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("subjectActionModal")
    ).show();
}
window.openEditSubjectModal = openEditSubjectModal;

/**
 * Saves a new subject
 */
async function saveNewSubject() {
    const hours = parseInt(
        document.getElementById("subject-weekly-hours").value,
        10
    );

    if (hours % 2 !== 0 || hours < 2) {
        alert(
            "Errore: Le ore settimanali devono essere un numero PARI e maggiore o uguale a 2 (multiplo di 2, poiché ogni slot è 2 ore)."
        );
        return;
    }

    const payload = {
        name: document.getElementById("subject-name").value.trim(),
        code: document.getElementById("subject-code").value.trim(),
        course_ref: document.getElementById("subject-course-ref").value,
        weekly_hours: parseInt(
            document.getElementById("subject-weekly-hours").value,
            10
        ),
        is_lab: document.getElementById("subject-is-lab").checked,
    };

    try {
        await dataService.addSubject(payload);
        closeModalAndClean(document.getElementById("subjectActionModal"));
        window.navigate("materie");
    } catch (error) {
        console.error("Errore POST Materia:", error);
        alert(`Errore nella creazione della materia: ${error.message}`);
    }
}
window.saveNewSubject = saveNewSubject;

/**
 * Saves an edited subject
 * @param {string} subjectId - The subject ID to update
 */
async function saveEditedSubject(subjectId) {
    const hours = parseInt(
        document.getElementById("edit-subject-weekly-hours").value,
        10
    );

    if (hours % 2 !== 0 || hours < 2) {
        alert(
            "Errore: Le ore settimanali devono essere un numero PARI e maggiore o uguale a 2 (multiplo di 2, poiché ogni slot è 2 ore)."
        );
        return;
    }

    const payload = {
        name: document.getElementById("edit-subject-name").value.trim(),
        code: document.getElementById("edit-subject-code").value.trim(),
        course_ref: document.getElementById("edit-subject-course-ref").value,
        weekly_hours: parseInt(
            document.getElementById("edit-subject-weekly-hours").value,
            10
        ),
        is_lab: document.getElementById("edit-subject-is-lab").checked,
    };

    try {
        await dataService.updateSubject(subjectId, payload);
        alert(`Materia "${payload.name}" aggiornata con successo!`);
        closeModalAndClean(document.getElementById("subjectActionModal"));
        window.navigate("materie");
    } catch (error) {
        console.error("Errore PUT Materia:", error);
        alert(`Errore nell'aggiornamento della materia: ${error.message}`);
    }
}
window.saveEditedSubject = saveEditedSubject;

/**
 * Shows confirmation dialog before deleting a subject
 * @param {string} subjectId - The subject ID to delete
 * @param {string} subjectName - The subject name for display
 */
window.deleteSubjectConfirmation = (subjectId, subjectName) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare la materia <strong class="text-dark">${subjectName}</strong>? Questa azione è irreversibile.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteSubject('${subjectId}', '${subjectName}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "subject-modal-title"
    ).textContent = `Elimina Materia: ${subjectName}`;
    document.getElementById("subject-modal-body").innerHTML = confirmationHtml;

    let modalElement = document.getElementById("subjectActionModal");
    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getSubjectModalHtml());
        modalElement = document.getElementById("subjectActionModal");
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Deletes a subject
 * @param {string} subjectId - The subject ID to delete
 * @param {string} subjectName - The subject name for feedback
 */
window.deleteSubject = async (subjectId, subjectName) => {
    try {
        await dataService.deleteSubject(subjectId);
        alert(`Materia "${subjectName}" eliminata con successo.`);
        closeModalAndClean(document.getElementById("subjectActionModal"));
        window.navigate("materie");
    } catch (error) {
        console.error("Errore DELETE Materia:", error);
        alert(`Errore durante l'eliminazione di ${subjectName}: ${error.message}`);
    }
};

/**
 * Updates the subjects list based on search query
 * @param {string} searchQuery - The search query string
 */
async function updateSubjectList(searchQuery) {
    const listContainer = document.getElementById("subjects-list-container");
    const countInfo = document.getElementById("subject-count-info");
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="p-4 text-center text-secondary col-12"><div class="spinner-border text-primary spinner-border-sm" role="status"></div> Ricerca materie...</div>`;

    try {
        // Load ALL subjects 
        const allSubjects = await dataService.getSubjects();
        SUBJECT_CACHE = allSubjects;

        const filteredSubjects = allSubjects.filter(
            (s) =>
                searchQuery === "" ||
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.course_ref.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const subjectCards = filteredSubjects
            .map((subject) => getMateriaCard(subject))
            .join("");

        listContainer.innerHTML =
            subjectCards.length > 0
                ? subjectCards
                : '<div class="p-4 text-center text-secondary col-12">Nessuna materia trovata con i criteri di ricerca specificati.</div>';

        if (countInfo) {
            countInfo.textContent = `Gestisci le materie e i requisiti didattici. Trovate ${filteredSubjects.length} materie.`;
        }
    } catch (error) {
        console.error("Errore durante l'aggiornamento della lista materie:", error);
        listContainer.innerHTML =
            '<div class="alert alert-danger p-4 col-12">Errore nel caricamento della lista materie.</div>';
    }
}
window.updateSubjectList = updateSubjectList;

// =======================================================
// === COURSES ===
// =======================================================

/**
 * Opens modal to add a new course
 */
async function openAddCourseModal() {
    const modalId = "courseActionModal";
    let modalElement = document.getElementById(modalId);

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveNewCourse()">
            <div class="mb-3">
                <label for="course-name" class="form-label">Nome Corso di Laurea:</label>
                <input type="text" class="form-control" id="course-name" required>
            </div>
            <div class="mb-3">
                <label for="course-year" class="form-label">Anno:</label>
                <input type="number" class="form-control" id="course-year" placeholder="Es: 1" min="1" max="3" required>
            </div>
            <div class="mb-3">
                <label for="course-students-count" class="form-label">Numero Studenti:</label>
                <input type="number" class="form-control" id="course-students-count" value="50" required min="1">
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-primary">Aggiungi Corso</button>
            </div>
        </form>
    `;

    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getCourseModalHtml());
        modalElement = document.getElementById(modalId);
    }

    document.getElementById("course-modal-title").textContent =
        "Aggiungi Nuovo Corso";
    document.getElementById("course-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
window.openAddCourseModal = openAddCourseModal;

/**
 * Opens modal to edit an existing course
 * @param {string} courseId - The course ID to edit
 */
async function openEditCourseModal(courseId) {
    if (COURSE_CACHE.length === 0) COURSE_CACHE = await dataService.getCourses();

    const currentCourse = COURSE_CACHE.find((c) => c._id === courseId);
    if (!currentCourse) {
        alert("Dati corso non trovati.");
        return;
    }

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveEditedCourse('${currentCourse._id}')">
            <div class="mb-3">
                <label for="edit-course-name" class="form-label">Nome Corso di Laurea:</label>
                <input type="text" class="form-control" id="edit-course-name" value="${currentCourse.name}" required>
            </div>
            <div class="mb-3">
                <label for="edit-course-year" class="form-label">Anno:</label>
                <input type="number" class="form-control" id="edit-course-year" value="${currentCourse.year}" min="1" max="3" required>
            </div>
            <div class="mb-3">
                <label for="edit-course-students-count" class="form-label">Numero Studenti:</label>
                <input type="number" class="form-control" id="edit-course-students-count" value="${currentCourse.students_count}" required min="1">
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success">Salva Modifiche</button>
            </div>
        </form>
    `;

    document.getElementById(
        "course-modal-title"
    ).textContent = `Modifica Corso: ${currentCourse.name} - ${currentCourse.year}`;
    document.getElementById("course-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("courseActionModal")
    ).show();
}
window.openEditCourseModal = openEditCourseModal;

/**
 * Saves a new course
 */
async function saveNewCourse() {
    const payload = {
        name: toTitleCase(document.getElementById("course-name").value.trim()),
        year: document.getElementById("course-year").value.trim(),
        students_count: parseInt(
            document.getElementById("course-students-count").value,
            10
        ),
    };

    try {
        await dataService.addCourse(payload);
        alert(`Corso "${payload.name} - ${payload.year}" creato con successo!`);
        closeModalAndClean(document.getElementById("courseActionModal"));
        window.navigate("corsi");
    } catch (error) {
        console.error("Errore POST Corso:", error);
        alert(`Errore nella creazione del corso: ${error.message}`);
    }
}
window.saveNewCourse = saveNewCourse;

/**
 * Saves an edited course
 * @param {string} courseId - The course ID to update
 */
async function saveEditedCourse(courseId) {
    const payload = {
        name: document.getElementById("edit-course-name").value.trim(),
        year: document.getElementById("edit-course-year").value.trim(),
        students_count: parseInt(
            document.getElementById("edit-course-students-count").value,
            10
        ),
    };

    try {
        await dataService.updateCourse(courseId, payload);
        alert(`Corso "${payload.name} - ${payload.year}" aggiornato con successo!`);
        closeModalAndClean(document.getElementById("courseActionModal"));
        window.navigate("corsi");
    } catch (error) {
        console.error("Errore PUT Corso:", error);
        alert(`Errore nell'aggiornamento del corso: ${error.message}`);
    }
}
window.saveEditedCourse = saveEditedCourse;

/**
 * Shows confirmation dialog before deleting a course
 * @param {string} courseId - The course ID to delete
 * @param {string} courseName - The course name for display
 */
window.deleteCourseConfirmation = (courseId, courseName) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare il corso <strong class="text-dark">${courseName}</strong>? Questa azione è irreversibile.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteCourse('${courseId}', '${courseName}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "course-modal-title"
    ).textContent = `Elimina Corso: ${courseName}`;
    document.getElementById("course-modal-body").innerHTML = confirmationHtml;

    let modalElement = document.getElementById("courseActionModal");
    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getCourseModalHtml());
        modalElement = document.getElementById("courseActionModal");
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Deletes a course
 * @param {string} courseId - The course ID to delete
 * @param {string} courseName - The course name for feedback
 */
window.deleteCourse = async (courseId, courseName) => {
    try {
        await dataService.deleteCourse(courseId);
        alert(`Corso "${courseName}" eliminato con successo.`);
        closeModalAndClean(document.getElementById("courseActionModal"));
        window.navigate("corsi");
    } catch (error) {
        console.error("Errore DELETE Corso:", error);
        alert(`Errore durante l'eliminazione di ${courseName}: ${error.message}`);
    }
};

/**
 * Updates the courses list based on search query
 * @param {string} searchQuery - The search query string
 */
async function updateCourseList(searchQuery) {
    const listContainer = document.getElementById("courses-list-container");
    const countInfo = document.getElementById("course-count-info");
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="p-4 text-center text-secondary col-12"><div class="spinner-border text-primary spinner-border-sm" role="status"></div> Ricerca corsi...</div>`;

    try {
        const allCourses = await dataService.getCourses();
        COURSE_CACHE = allCourses;

        const filteredCourses = allCourses.filter(
            (c) =>
                searchQuery === "" ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.year.toString().includes(searchQuery.toLowerCase())
        );

        const courseCards = filteredCourses
            .map((course) => getCorsoCard(course))
            .join("");

        listContainer.innerHTML =
            courseCards.length > 0
                ? courseCards
                : '<div class="p-4 text-center text-secondary col-12">Nessun corso trovato con i criteri di ricerca specificati.</div>';

        if (countInfo) {
            countInfo.textContent = `Gestisci i corsi di laurea e gli anni accademici. Trovati ${filteredCourses.length} corsi.`;
        }
    } catch (error) {
        console.error("Errore durante l'aggiornamento della lista corsi:", error);
        listContainer.innerHTML =
            '<div class="alert alert-danger p-4 col-12">Errore nel caricamento della lista corsi.</div>';
    }
}
window.updateCourseList = updateCourseList;

// =======================================================
// === CLASSROOMS ===
// =======================================================

/**
 * Opens modal to add a new classroom
 */
async function openAddClassroomModal() {
    const modalId = "classroomActionModal";
    let modalElement = document.getElementById(modalId);

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveNewClassroom()">
            <div class="mb-3">
                <label for="classroom-name" class="form-label">Nome Aula:</label>
                <input type="text" class="form-control" id="classroom-name" required>
            </div>
            <div class="mb-3">
                <label for="classroom-floor" class="form-label">Piano:</label>
                <input type="number" class="form-control" id="classroom-floor" placeholder="Es: 1" required>
            </div>
            <div class="mb-3">
                <label for="classroom-capacity" class="form-label">Capacità:</label>
                <input type="number" class="form-control" id="classroom-capacity" value="30" required min="1">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="classroom-has-projector" checked>
                <label class="form-check-label" for="classroom-has-projector">Dispone di Proiettore</label>
            </div>
            <div class="form-check mb-4">
                <input type="checkbox" class="form-check-input" id="classroom-has-pc">
                <label class="form-check-label" for="classroom-has-pc">Dispone di Postazioni PC</label>
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-primary">Aggiungi Aula</button>
            </div>
        </form>
    `;

    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getClassroomModalHtml());
        modalElement = document.getElementById(modalId);
    }

    document.getElementById("classroom-modal-title").textContent =
        "Aggiungi Nuova Aula";
    document.getElementById("classroom-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
window.openAddClassroomModal = openAddClassroomModal;

/**
 * Opens modal to edit an existing classroom
 * @param {string} classroomId - The classroom ID to edit
 */
async function openEditClassroomModal(classroomId) {
    if (CLASSROOM_CACHE.length === 0)
        CLASSROOM_CACHE = await dataService.getClassrooms();

    const currentClassroom = CLASSROOM_CACHE.find((c) => c._id === classroomId);
    if (!currentClassroom) {
        alert("Dati aula non trovati.");
        return;
    }

    const formHtml = `
        <form onsubmit="event.preventDefault(); window.saveEditedClassroom('${currentClassroom._id
        }')">
            <div class="mb-3">
                <label for="edit-classroom-name" class="form-label">Nome Aula:</label>
                <input type="text" class="form-control" id="edit-classroom-name" value="${currentClassroom.name
        }" required>
            </div>
            <div class="mb-3">
                <label for="edit-classroom-floor" class="form-label">Piano:</label>
                <input type="text" class="form-control" id="edit-classroom-floor" value="${currentClassroom.floor
        }" required>
            </div>
            <div class="mb-3">
                <label for="edit-classroom-capacity" class="form-label">Capacità:</label>
                <input type="number" class="form-control" id="edit-classroom-capacity" value="${currentClassroom.capacity
        }" required min="1">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="edit-classroom-has-projector" ${currentClassroom.has_projector ? "checked" : ""
        }>
                <label class="form-check-label" for="edit-classroom-has-projector">Dispone di Proiettore</label>
            </div>
            <div class="form-check mb-4">
                <input type="checkbox" class="form-check-input" id="edit-classroom-has-pc" ${currentClassroom.has_pc ? "checked" : ""
        }>
                <label class="form-check-label" for="edit-classroom-has-pc">Dispone di Postazioni PC</label>
            </div>
            <div class="mt-4 d-flex justify-content-center">
                <button type="button" class="btn btn-danger me-2" data-bs-dismiss="modal">Annulla</button>
                <button type="submit" class="btn btn-success">Salva Modifiche</button>
            </div>
        </form>
    `;

    document.getElementById(
        "classroom-modal-title"
    ).textContent = `Modifica Aula: ${currentClassroom.name}`;
    document.getElementById("classroom-modal-body").innerHTML = formHtml;
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("classroomActionModal")
    ).show();
}
window.openEditClassroomModal = openEditClassroomModal;

/**
 * Saves a new classroom
 */
async function saveNewClassroom() {
    const payload = {
        name: document.getElementById("classroom-name").value.trim(),
        floor: document.getElementById("classroom-floor").value.trim(),
        capacity: parseInt(document.getElementById("classroom-capacity").value, 10),
        has_projector: document.getElementById("classroom-has-projector").checked,
        has_pc: document.getElementById("classroom-has-pc").checked,
    };

    try {
        await dataService.addClassroom(payload);
        alert(`Aula "${payload.name}" creata con successo!`);
        closeModalAndClean(document.getElementById("classroomActionModal"));
        window.navigate("aule");
    } catch (error) {
        console.error("Errore POST Aula:", error);
        const errorMessage = error.message.includes("nome dell'aula")
            ? "Errore: Il nome dell'aula è già in uso."
            : error.message;
        alert(`Errore nella creazione dell'aula: ${errorMessage}`);
    }
}
window.saveNewClassroom = saveNewClassroom;

/**
 * Saves an edited classroom
 * @param {string} classroomId - The classroom ID to update
 */
async function saveEditedClassroom(classroomId) {
    const payload = {
        name: document.getElementById("edit-classroom-name").value.trim(),
        floor: document.getElementById("edit-classroom-floor").value.trim(),
        capacity: parseInt(
            document.getElementById("edit-classroom-capacity").value,
            10
        ),
        has_projector: document.getElementById("edit-classroom-has-projector")
            .checked,
        has_pc: document.getElementById("edit-classroom-has-pc").checked,
    };

    try {
        await dataService.updateClassroom(classroomId, payload);
        alert(`Aula "${payload.name}" aggiornata con successo!`);
        closeModalAndClean(document.getElementById("classroomActionModal"));
        window.navigate("aule");
    } catch (error) {
        console.error("Errore PUT Aula:", error);
        const errorMessage = error.message.includes("nome dell'aula")
            ? "Errore: Il nome dell'aula è già in uso."
            : error.message;
        alert(`Errore nell'aggiornamento dell'aula: ${errorMessage}`);
    }
}
window.saveEditedClassroom = saveEditedClassroom;

/**
 * Shows confirmation dialog before deleting a classroom
 * @param {string} classroomId - The classroom ID to delete
 * @param {string} classroomName - The classroom name for display
 */
window.deleteClassroomConfirmation = (classroomId, classroomName) => {
    const confirmationHtml = `
        <div class="p-4 text-center">
            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
            <h4 class="text-danger fw-bold">Conferma Eliminazione</h4>
            <p class="mb-4">Sei sicuro di voler eliminare l'aula <strong class="text-dark">${classroomName}</strong>? Questa azione è irreversibile.</p>
            
            <div class="d-flex justify-content-center gap-3 mt-4">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
                <button type="button" class="btn btn-danger" onclick="window.deleteClassroom('${classroomId}', '${classroomName}')">
                    SÌ, ELIMINA DEFINITIVAMENTE
                </button>
            </div>
        </div>
    `;

    document.getElementById(
        "classroom-modal-title"
    ).textContent = `Elimina Aula: ${classroomName}`;
    document.getElementById("classroom-modal-body").innerHTML = confirmationHtml;

    let modalElement = document.getElementById("classroomActionModal");
    if (!modalElement) {
        document.body.insertAdjacentHTML("beforeend", getClassroomModalHtml());
        modalElement = document.getElementById("classroomActionModal");
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Deletes a classroom
 * @param {string} classroomId - The classroom ID to delete
 * @param {string} classroomName - The classroom name for feedback
 */
window.deleteClassroom = async (classroomId, classroomName) => {
    try {
        await dataService.deleteClassroom(classroomId);
        alert(`Aula "${classroomName}" eliminata con successo.`);
        closeModalAndClean(document.getElementById("classroomActionModal"));
        window.navigate("aule");
    } catch (error) {
        console.error("Errore DELETE Aula:", error);
        alert(
            `Errore durante l'eliminazione di ${classroomName}: ${error.message}`
        );
    }
};

/**
 * Updates the classrooms list based on search query
 * @param {string} searchQuery - The search query string
 */
async function updateClassroomList(searchQuery) {
    const listContainer = document.getElementById("classrooms-list-container");
    const countInfo = document.getElementById("classroom-count-info");
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="p-4 text-center text-secondary col-12"><div class="spinner-border text-primary spinner-border-sm" role="status"></div> Ricerca aule...</div>`;

    try {
        const allClassrooms = await dataService.getClassrooms();
        CLASSROOM_CACHE = allClassrooms;

        const filteredClassrooms = allClassrooms.filter(
            (c) =>
                searchQuery === "" ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.floor.toString().includes(searchQuery.toLowerCase()) ||
                c.capacity.toString().includes(searchQuery.toLowerCase())
        );

        const classroomCards = filteredClassrooms
            .map((classroom) => getAulaCard(classroom))
            .join("");

        listContainer.innerHTML =
            classroomCards.length > 0
                ? classroomCards
                : '<div class="p-4 text-center text-secondary col-12">Nessuna aula trovata con i criteri di ricerca specificati.</div>';

        if (countInfo) {
            countInfo.textContent = `Gestisci le aule e le loro caratteristiche. Trovate ${filteredClassrooms.length} aule.`;
        }
    } catch (error) {
        console.error("Errore durante l'aggiornamento della lista aule:", error);
        listContainer.innerHTML =
            '<div class="alert alert-danger p-4 col-12">Errore nel caricamento della lista aule.</div>';
    }
}
window.updateClassroomList = updateClassroomList;

// =======================================================

/**
 * Generates content for the Subjects section
 * @returns {Promise<string>} HTML content for subjects view
 */
async function getMaterieContent() {
    const baseHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Materie</h3>
            <button class="btn btn-primary" onclick="window.openAddSubjectModal()">
                <i class="fas fa-plus me-2"></i> Aggiungi Materia
            </button>
        </div>
        <p class="text-secondary mb-4" id="subject-count-info">Gestisci le materie e i requisiti didattici.</p>

        <div class="mb-4">
            <input type="text" 
                   id="subject-search-input"
                   placeholder="Cerca materia per nome, codice o programma di laurea..." 
                   class="form-control form-control-lg"
                   onkeyup="window.updateSubjectList(this.value)">
        </div>

        <div class="grid-3" id="subjects-list-container">
            <div class="p-4 text-center text-secondary col-12">
                <div class="spinner-border text-primary spinner-border-sm"></div>
                Caricamento materie...
            </div>
        </div>

        ${getSubjectModalHtml()}
    `;

    setTimeout(() => window.updateSubjectList(""), 0);
    return baseHtml;
}

// =======================================================

/**
 * Generates content for the Courses section
 * @returns {Promise<string>} HTML content for courses view
 */
async function getCorsiContent() {
    const baseHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Corsi di Laurea</h3>
            <button class="btn btn-primary" onclick="window.openAddCourseModal()">
                <i class="fas fa-plus me-2"></i> Aggiungi Corso
            </button>
        </div>
        <p class="text-secondary mb-4" id="course-count-info">Gestisci i corsi di laurea e gli anni accademici.</p>

        <div class="mb-4">
            <input type="text" 
                   id="course-search-input"
                   placeholder="Cerca corso per nome o anno..." 
                   class="form-control form-control-lg"
                   onkeyup="window.updateCourseList(this.value)">
        </div>

        <div class="grid-3" id="courses-list-container">
             <div class="p-4 text-center text-secondary col-12">
                <div class="spinner-border text-primary spinner-border-sm"></div>
                Caricamento corsi...
            </div>
        </div>

        ${getCourseModalHtml()}
    `;

    setTimeout(() => window.updateCourseList(""), 0);
    return baseHtml;
}

// =======================================================

/**
 * Generates content for the Classrooms section
 * @returns {Promise<string>} HTML content for classrooms view
 */
async function getAuleContent() {
    const baseHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Aule</h3>
            <button class="btn btn-primary" onclick="window.openAddClassroomModal()">
                <i class="fas fa-plus me-2"></i> Aggiungi Aula
            </button>
        </div>
        <p class="text-secondary mb-4" id="classroom-count-info">Gestisci le aule e le loro caratteristiche.</p>

        <div class="mb-4">
            <input type="text" 
                   id="classroom-search-input"
                   placeholder="Cerca aula per nome, piano o capacità..." 
                   class="form-control form-control-lg"
                   onkeyup="window.updateClassroomList(this.value)">
        </div>

        <div class="grid-3" id="classrooms-list-container">
             <div class="p-4 text-center text-secondary col-12">
                <div class="spinner-border text-primary spinner-border-sm"></div>
                Caricamento aule...
            </div>
        </div>

        ${getClassroomModalHtml()}
    `;

    setTimeout(() => window.updateClassroomList(""), 0);
    return baseHtml;
}

// =======================================================

/**
 * Generates content for the Schedule section
 * Supports filtered view for Admin and personal schedule for Teacher
 * @returns {Promise<string>} HTML content for schedule view
 */
async function getOrarioContent() {
    const user = getCurrentUser();
    const role = user.role;

    const courses = await dataService.getCourses();

    if (courses.length === 0) {
        return `<div class="alert alert-warning p-4">Nessun corso trovato nel database.</div>`;
    }

    let finalHtml = "";

    if (role === "docente") {
        finalHtml = `
            <h3 class="h4 fw-bold text-dark mb-4">Il Tuo Orario Docente</h3>
            <p class="text-secondary mb-4">Gestisci lo stato delle tue lezioni assegnate.</p>
            
            <div class="d-flex space-x-3 mb-4">
                <span class="status-pill status-confirmed">Confermato</span>
                <span class="status-pill bg-warning text-white">In Attesa</span>
                <span class="status-pill status-rejected">Conflitto</span>
            </div>

            <div class="content-card table-responsive">
                <table class="schedule-table table table-sm table-bordered w-100 mb-0">
                    <thead>
                        <tr>
                            <th class="time-slot">Ora</th>
                            ${DAYS.map((day) => `<th>${day}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody id="schedule-table-body">
                        <tr>
                            <td colspan="6" class="text-center py-4">
                                <div class="spinner-border text-primary spinner-border-sm" role="status"></div> Caricamento...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="alert alert-info mt-4">
                <span class="fw-bold"><i class="fas fa-info-circle"></i> Istruzioni</span><br>
                Clicca su una lezione <span class="badge bg-warning text-white">In Attesa</span> per confermarla o segnalare un conflitto.
            </div>
            
            <div id="status-modal-container"></div>
        `;
    } else {
        const savedCourse = sessionStorage.getItem('auto_load_course');
        const savedYear = sessionStorage.getItem('auto_load_year');

        const defaultCourse = savedCourse
            ? (courses.find(c => c.name === savedCourse && c.year == savedYear) || courses[0])
            : (courses.find(c => c.name === "Informatica" && c.year === 1) || courses[0]);

        sessionStorage.removeItem('auto_load_course');
        sessionStorage.removeItem('auto_load_year');

        const uniqueCourseNames = [...new Set(courses.map((c) => c.name))];
        const uniqueYears = [...new Set(courses.map((c) => c.year))];

        const courseOptions = uniqueCourseNames
            .map(
                (name) =>
                    `<option ${name === defaultCourse.name ? "selected" : ""}>${name}</option>`
            )
            .join("");

        const yearOptions = uniqueYears
            .map(
                (year) =>
                    `<option ${year === defaultCourse.year ? "selected" : ""}>${year}</option>`
            )
            .join("");

        finalHtml = `
            <h3 class="h4 fw-bold text-dark mb-4">Visualizzazione Orario Globale</h3>
            <p class="text-secondary mb-4" id="current-schedule-info">
                Orario visualizzato: ${defaultCourse.name} - Anno ${defaultCourse.year}
            </p>
            
            <div class="d-flex space-x-3 mb-4">
                <span class="status-pill status-confirmed">Confermato</span>
                <span class="status-pill bg-warning text-white">In Attesa</span>
                <span class="status-pill status-rejected">Conflitto</span>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-md-auto">
                    <div class="d-flex align-items-center">
                        <label for="corso-select" class="form-label mb-0 me-2 text-nowrap">Corso di Laurea:</label>
                        <select id="corso-select" class="form-select form-select-sm" 
                                onchange="window.scheduleViewHandler.handleSelectionChange()">
                            ${courseOptions}
                        </select>
                    </div>
                </div>
                <div class="col-md-auto">
                    <div class="d-flex align-items-center">
                        <label for="anno-select" class="form-label mb-0 me-2">Anno:</label>
                        <select id="anno-select" class="form-select form-select-sm"
                                onchange="window.scheduleViewHandler.handleSelectionChange()">
                            ${yearOptions}
                        </select>
                    </div>
                </div>
            </div>

            <div class="content-card table-responsive">
                <table class="schedule-table table table-sm table-bordered w-100 mb-0">
                    <thead>
                        <tr>
                            <th class="time-slot">Ora</th>
                            ${DAYS.map((day) => `<th>${day}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody id="schedule-table-body">
                        </tbody>
                </table>
            </div>
            ${getModalHtml()}
        `;
    }

    setTimeout(() => {
        if (role === "docente") {
            updateScheduleTable(null, null, user.name);
        } else {
            const courseSelect = document.getElementById("corso-select");
            const yearSelect = document.getElementById("anno-select");
            updateScheduleTable(courseSelect.value, yearSelect.value);
        }
    }, 0);

    return finalHtml;
}

// =======================================================

/**
 * Generates content for the Generate section
 * @returns {Promise<string>} HTML content for generation view
 */
async function getGeneraContent() {
    const courses = await dataService.getCourses();

    if (CONSTRAINT_CACHE.length === 0) CONSTRAINT_CACHE = await dataService.getConstraints();

    // Filter for rigid constraints
    const rigidConstraintCount = CONSTRAINT_CACHE.filter(
        (c) => c.type === "Rigido"
    ).length;

    if (TEACHER_CACHE.length === 0) TEACHER_CACHE = await dataService.getTeachers();
    const teachers = TEACHER_CACHE;

    if (SUBJECT_CACHE.length === 0) SUBJECT_CACHE = await dataService.getSubjects();
    const subjects = SUBJECT_CACHE;

    if (CLASSROOM_CACHE.length === 0) CLASSROOM_CACHE = await dataService.getClassrooms();
    const classrooms = CLASSROOM_CACHE;

    const courseYearOptions = courses
        .map(
            (c) =>
                `<option value="${c.name} - ${c.year}">${c.name} - Anno ${c.year}</option>`
        )
        .join("");

    return `
        <h3 class="h4 fw-bold text-dark mb-4">Generazione Automatica Orario</h3>
        <p class="text-secondary mb-4">Utilizza l'algoritmo di ottimizzazione per creare l'orario accademico.</p>

        <div class="grid-5 mb-4">
            ${getMetricCard(
        "Numero Docenti",
        teachers.length,
        "fa-solid fa-people-group",
        "bg-white",
        "text-primary",
    )}
            ${getMetricCard(
        "Numero Materie",
        subjects.length,
        "fa-solid fa-book-open",
        "bg-white",
        "text-orange"
    )}
            ${getMetricCard(
        "Corsi di Laurea Presenti",
        courses.length,
        "fas fa-graduation-cap",
        "bg-white",
        "text-danger"
    )}
            ${getMetricCard(
        "Numero Aule",
        classrooms.length,
        "fas fa-door-open",
        "bg-white",
        "text-warning"
    )}
            ${getMetricCard(
        "Vincoli Attivi",
        rigidConstraintCount,
        "fas fa-check-circle",
        "bg-white",
        "text-success"
    )}
        </div>

        <div class="content-card p-4">
            <h4 class="h5 fw-semibold text-dark mb-4">Configurazione Generazione</h4>
            
            <form id="schedule-generation-form" onsubmit="event.preventDefault(); window.startScheduleGeneration()">
                <div class="row g-4">
                    <div class="col-md-6">
                        <label class="form-label fw-bold small text-uppercase">Corso di Laurea e Anno</label>
                        <select id="generation-course-year" class="form-select" required>
                             <option value="">-- Seleziona Corso --</option>
                            ${courseYearOptions}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-bold small text-uppercase">Tipo Ottimizzazione</label>
                        <input id="generation-type" class="form-control" value="Massima Efficienza (Casuale)" disabled/>
                    </div>
                </div>

                <div class="mt-4 pt-3 border-top mb-3">
                    <p class="fw-bold text-dark mb-2">Opzione di Ottimizzazione:</p>
                    <div class="form-check mb-2">
                        <input type="checkbox" checked class="form-check-input" id="opt-teacher-preferences">
                        <label class="form-check-label" for="opt-teacher-preferences">
                            Rispetta preferenze orarie docenti (Preferito / Evitare)
                        </label>
                    </div>
                    <div class="p-3 bg-light rounded border">
                        <small class="text-muted d-block">
                            <i class="fas fa-info-circle me-1"></i> 
                            <strong>Nota sui Vincoli:</strong> L'algoritmo darà sempre la precedenza assoluta ai vincoli rigidi (sovrapposizioni, ore consecutive, etc.) impostati nella sezione "Vincoli" prima di valutare le preferenze flessibili.
                        </small>
                    </div>
                </div>

                <div class="mt-4 text-center">
                    <button class="btn btn-lg btn-primary px-5 shadow-sm" type="submit" id="generate-button">
                        <i class="fas fa-magic me-2"></i> Avvia Generazione
                    </button>
                </div>
            </form>
        </div>
    `;
}

// =======================================================

/**
 * Generates content for the Teachers section
 * @returns {Promise<string>} HTML content for teachers view
 */
async function getDocentiContent() {
    return `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Docenti</h3>
            <button class="btn btn-primary" onclick="window.openAddTeacherModal()">
                <i class="fas fa-user-plus me-2"></i> Aggiungi Docente
            </button>
        </div>

        <p class="text-secondary mb-4" id="teacher-count-info">
            Gestisci i docenti e le loro informazioni.
        </p>

        <div class="mb-4">
            <input type="text"
                   id="teacher-search-input"
                   placeholder="Cerca docente per nome, email o materia..."
                   class="form-control form-control-lg"
                   onkeyup="window.handleTeacherSearch(this.value)">
        </div>

        <div class="grid-3" id="teachers-list-container">
            <div class="p-4 text-center text-secondary col-12">
                <div class="spinner-border text-primary spinner-border-sm"></div>
                Caricamento docenti...
            </div>
        </div>

        ${getTeacherModalHtml()}
    `;
}

// =======================================================

/**
 * Generates the content for the Constraints section
 * @returns {Promise<string>} HTML content for constraints view
 */
async function getVincoliContent() {
    // Load data from DB
    const constraints = await dataService.getConstraints();
    CONSTRAINT_CACHE = constraints; // Populate the cache

    const constraintCards = constraints
        .map((constraint) => getVincoloCard(constraint))
        .join("");

    return `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Vincoli</h3>
            <button class="btn btn-primary" onclick="window.openAddConstraintModal()">
                <i class="fas fa-plus me-2"></i> Aggiungi Vincolo
            </button>
        </div>
        <p class="text-secondary mb-4">Configura i vincoli temporali e le regole di schedulazione. Trovati ${constraints.length
        } vincoli.</p>

        <div class="d-flex flex-column mb-3" id="constraints-list-container">
            ${constraintCards.length > 0
            ? constraintCards
            : '<div class="p-4 text-center text-secondary content-card">Nessun vincolo trovato. Aggiungine uno per configurare l\'ottimizzatore.</div>'
        }
        </div>

        <div class="content-card mt-4 p-3 bg-light border border-primary-subtle">
            <div class="d-flex align-items-start">
                <span class="text-primary me-3 mt-1"><i class="fas fa-info-circle"></i></span>
                <p class="text-sm text-primary mb-0">
                    <strong class="fw-bold">Informazioni sui Vincoli:</strong>
                    I vincoli rigidi devono essere sempre soddisfatti (es. nessuna sovrapposizione). I vincoli flessibili sono preferenze che il sistema cerca di rispettare dove possibile.
                </p>
            </div>
        </div>
        
        ${getConstraintModalHtml()} 
    `;
}

// =======================================================

/**
 * Generates content for the Notifications section
 * @returns {Promise<string>} HTML content for notifications view
 */
async function getNotificheContent() {
    const { role } = getCurrentUser();

    const baseHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Centro Notifiche</h3>
            <div class="d-flex gap-2">
                <button class="btn btn-danger btn-sm" onclick="window.deleteAllNotifications()">
                    <i class="fas fa-trash-alt me-2"></i> Elimina Tutte
                </button>
                <button class="btn btn-success btn-sm" onclick="window.markAllRead()">
                    <i class="fa-regular fa-envelope-open"></i> Segna tutte come lette
                </button>
            </div>
        </div>
        <p class="text-secondary mb-4" id="notification-info-text">Visualizza le notifiche del sistema destinate al ruolo di ${role}.</p>

        <div id="notifications-list-container">
            </div>
    `;

    // Execute initial load after HTML is in DOM
    setTimeout(() => window.updateNotificationList(), 0);
    return baseHtml;
}

// =======================================================

/**
 * Generates content for the Report section
 * @returns {Promise<string>} HTML content for report view
 */
async function getReportContent() {
    const { role } = getCurrentUser();
    if (role !== 'admin') return getUnauthorizedMessage('Report');

    const data = await dataService.getFullReport();
    if (!data || !data.metrics) {
        return `<div class="p-4 text-center text-secondary">Nessun dato disponibile. Genera un orario per vedere le statistiche.</div>`;
    }

    const { metrics: m, trends: t, classroomUsage, teacherWorkload } = data;

    return `
        <h3 class="h4 fw-bold text-dark mb-1">Analytics e Reportistica</h3>
        <p class="text-secondary mb-4 small">Analisi dell'efficienza e soddisfazione del sistema basata sui dati attuali.</p>
        
        <div class="row g-4 mb-4">
            <div class="col-md-3">
                <div class="content-card bg-white p-4 h-100">
                    <p class="text-xs text-uppercase fw-bold text-muted mb-2">Efficienza Orario</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fs-2 fw-bold text-dark">${m.efficiency}%</span>
                        <span class="fs-3 text-primary"><i class="fas fa-chart-line"></i></span>
                    </div>
                    ${getTrendHtml(t.efficiency)}
                </div>
            </div>

            <div class="col-md-3">
                <div class="content-card bg-white p-4 h-100">
                    <p class="text-xs text-uppercase fw-bold text-muted mb-2">Soddisfazione Docenti</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fs-2 fw-bold text-dark">${m.satisfaction}%</span>
                        <span class="fs-3 text-success"><i class="fas fa-users"></i></span>
                    </div>
                    ${getTrendHtml(t.satisfaction)}
                </div>
            </div>

            <div class="col-md-3">
                <div class="content-card bg-white p-4 h-100">
                    <p class="text-xs text-uppercase fw-bold text-muted mb-2">Ore Totali</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fs-2 fw-bold text-dark">${m.totalHours}/${m.totalRequired}</span>
                        <span class="fs-3 text-info"><i class="fas fa-clock"></i></span>
                    </div>
                    ${getDiffMessageHtml(t.hoursDiff, 'hours')}
                </div>
            </div>

            <div class="col-md-3">
                <div class="content-card bg-white p-4 h-100">
                    <p class="text-xs text-uppercase fw-bold text-muted mb-2">Conflitti Rilevati</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fs-2 fw-bold text-dark">${m.conflicts}</span>
                        <span class="fs-3 text-danger"><i class="fas fa-exclamation-triangle"></i></span>
                    </div>
                    ${getDiffMessageHtml(t.conflictsDiff, 'conflicts')}
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-6">
                <div class="content-card h-100">
                    <h5 class="fw-bold text-dark mb-1">Utilizzo Aule</h5>
                    <p class="text-muted text-xs mb-4">Percentuale di utilizzo per ogni aula (su 20 slot settimanali)</p>
                    <div class="mt-2">
                        ${classroomUsage.map(c => getUsageBar(c.name, c.percent)).join('')}
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="content-card h-100">
                    <h5 class="fw-bold text-dark mb-1">Carico di Lavoro Docenti</h5>
                    <p class="text-muted text-xs mb-4">Distribuzione ore settimanali assegnate rispetto al massimale</p>
                    <div class="mt-2">
                        ${teacherWorkload.map(t => `
                            <div class="d-flex justify-content-between align-items-center mb-3 p-2 border-bottom hover-light">
                                <span class="fw-medium text-dark">${t.name}</span>
                                <div class="d-flex align-items-center gap-3">
                                    <span class="text-secondary small">${t.hours}/${t.maxHours} ore</span>
                                    ${getStatusBadge(t.status)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =======================================================

/**
 * Generates content for the Preferences section
 * @returns {Promise<string>} HTML content for preferences view
 */
async function getPreferenzeContent() {
    const { role } = getCurrentUser();
    if (role !== "docente") return getUnauthorizedMessage("Preferenze");

    const baseHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="h4 fw-bold text-dark mb-0">Gestione Preferenze Orarie</h3>
            <button class="btn btn-primary" onclick="window.openAddPreferenceModal()">
                <i class="fas fa-plus me-2"></i> Aggiungi Preferenza
            </button>
        </div>
        <p class="text-secondary mb-4">Configura i tuoi slot orari preferiti, da evitare o non disponibili. Questi dati saranno usati dall'algoritmo di schedulazione.</p>

        <div class="d-flex flex-column mb-3" id="preferences-list-container">
            </div>
        ${getPreferenceModalHtml()}
    `;

    setTimeout(() => window.updatePreferenceList(), 0);
    return baseHtml;
}

// Generate a notification card HTML
function getNotificaCard(notification) {
    const { _id, title, message, type, is_read, created_at } = notification;

    let icon = "fas fa-info-circle";
    let iconColor = "text-primary";
    let newTagHtml = !is_read
        ? `<span class="badge bg-primary bg-gradient text-white me-2 align-content-center">Nuovo</span>`
        : "";

    if (type === "success") {
        icon = "fas fa-check-circle";
        iconColor = "text-success";
    } else if (type === "warning") {
        icon = "fas fa-exclamation-triangle";
        iconColor = "text-warning";
    } else if (type === "error") {
        icon = "fas fa-times-circle";
        iconColor = "text-danger";
    } else if (type === "info") {
        icon = "fas fa-info-circle";
        iconColor = "text-info";
    }

    const formattedDate =
        new Date(created_at).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }) +
        ", " +
        new Date(created_at).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
        });

    return `
        <div class="content-card bg-white border p-3 d-flex justify-content-between align-items-start mb-3" data-id="${_id}" style="${is_read ? "opacity: 0.7;" : ""
        }">
            <div class="d-flex align-items-start">
                <span class="fs-4 me-3"><i class="${icon} ${iconColor}"></i></span>
                <div>
                    <p class="fw-bold text-dark mb-1">${title}</p>
                    <p class="text-sm text-secondary mb-1">${message}</p>
                    <p class="text-xs text-muted mt-1">${formattedDate}</p>
                </div>
            </div>
            <div class="d-flex space-x-2">
                ${newTagHtml}
                <button class="btn btn-sm text-secondary hover-primary" 
                    onclick="window.markNotificationRead('${_id}')" 
                    title="Segna come letto" 
                    style="${is_read ? "display:none;" : ""}">
                    <i class="fas fa-eye text-dark"></i>
                </button>
                <button class="btn btn-sm text-danger hover-danger" 
                    onclick="window.deleteNotification('${_id}', '${title}')" 
                    title="Elimina">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

// Generate a preference card HTML
function getPreferenzaCard(preference) {
    const { _id, day, time_slot, type } = preference;
    let tagClass = "";
    let tagText = type;

    switch (type) {
        case "Evitare":
            tagClass = "bg-warning text-dark";
            break;
        case "Preferito":
            tagClass = "bg-success text-white";
            break;
        case "Non Disponibile":
            tagClass = "bg-danger text-white";
            break;
        default:
            tagClass = "bg-secondary text-white";
            tagText = "Non specificato";
    }

    return `
        <div class="content-card d-flex justify-content-between align-items-center p-3 mb-3">
            <div class="d-flex align-items-center">
                <i class="fas fa-clock fs-4 me-3 text-secondary"></i>
                <div>
                    <p class="fw-bold mb-0">${day} - ${time_slot}</p>
                    <span class="badge ${tagClass}">${tagText}</span>
                </div>
            </div>
            <button class="btn btn-sm text-danger" onclick="window.deletePreferenceConfirmation('${_id}', '${day} ${time_slot}')"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
}

// Generate a teacher card HTML
function getDocenteCard(teacher) {
    const { _id, name, email, subjects, max_weekly_hours } = teacher;
    const subjectTags = subjects
        .map(
            (mat) =>
                `<span class="badge bg-primary-subtle text-primary">${mat}</span>`
        )
        .join("");

    return `
        <div class="content-card d-flex flex-column justify-content-between mb-4">
            <div>
                <h4 class="h5 fw-bold text-dark mb-2">${name}</h4>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${subjectTags}
                </div>
                <p class="text-sm text-secondary">${email}</p>
                <p class="text-xs text-muted mt-1">Max ${max_weekly_hours} ore/settimana</p>
            </div>
            <div class="mt-3 pt-3 border-top d-flex justify-content-end space-x-2">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.openEditTeacherModal('${_id}')">Modifica</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTeacherConfirmation('${_id}', '${name}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
}

// Generate a subject card HTML
function getMateriaCard(subject) {
    const { _id, name, code, course_ref, weekly_hours, is_lab } = subject;
    const labTag = is_lab
        ? `<span class="badge bg-success text-white ms-2">Laboratorio</span>`
        : "";

    return `
        <div class="content-card d-flex flex-column justify-content-between mb-4">
            <div>
                <h4 class="h5 fw-bold text-dark mb-2">${name}</h4>
                <div class="d-flex align-items-center space-x-2 mb-3">
                    <span class="text-sm text-secondary">${code}</span>
                    ${labTag}
                </div>
                <p class="text-sm text-secondary"><i class="fa-solid fa-graduation-cap text-dark"></i> <strong>Corso/anno:</strong> ${course_ref}</p>
                <p class="text-sm text-secondary"><i class="fa-solid fa-stopwatch text-dark"></i> ${weekly_hours} ore settimanali</p>
            </div>
            <div class="mt-3 pt-3 border-top d-flex justify-content-end space-x-2">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.openEditSubjectModal('${_id}')">Modifica</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteSubjectConfirmation('${_id}', '${name}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
}

// Generate a course card HTML
function getCorsoCard(course) {
    const { _id, name, year, students_count } = course;
    return `
        <div class="content-card d-flex flex-column justify-content-between mb-4">
            <div>
                <h4 class="h5 fw-bold text-dark mb-2">${name}</h4>
                <span class="badge bg-primary-subtle text-primary">Anno ${year}</span>
                <p class="text-sm text-secondary mt-3"><i class="fa-solid fa-people-group text-dark"></i> ${students_count} studenti</p>
            </div>
            <div class="mt-3 pt-3 border-top d-flex justify-content-end space-x-2">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.openEditCourseModal('${_id}')">Modifica</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteCourseConfirmation('${_id}', '${name} - ${year}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
}

// Generate a classroom card HTML
function getAulaCard(classroom) {
    const { _id, name, floor, capacity, has_pc } = classroom;
    const pcTag = has_pc
        ? `<span class="badge bg-success text-white">PC</span>`
        : "";
    return `
        <div class="content-card d-flex flex-column justify-content-between mb-4">
            <div>
                <h4 class="h5 fw-bold text-dark mb-2">${name}</h4>
                <p class="text-sm text-secondary"><i class="fa-solid fa-map-pin text-danger"></i> Piano ${floor}</p>
                <p class="text-sm text-secondary"><i class="fa-solid fa-people-group text-body"></i> Capacità: ${capacity} studenti</p>
                <div class="d-flex space-x-2 mt-2">
                    ${pcTag}
                    <span class="badge bg-primary text-white ms-1">Proiettore</span>
                </div>
            </div>
            <div class="mt-3 pt-3 border-top d-flex justify-content-end space-x-2">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.openEditClassroomModal('${_id}')">Modifica</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteClassroomConfirmation('${_id}', '${name}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
}

// Generate a metric/statistics card HTML
function getMetricCard(title, value, icon, bgColor, iconColor) {
    return `
        <div class="content-card ${bgColor} p-4 h-100">
            <p class="text-sm text-muted">${title}</p>
            <div class="d-flex justify-content-between align-items-center mt-1">
                <span class="fs-2 fw-bold">${value}</span>
                <span class="fs-1"><i class="${icon} ${iconColor}"></i></span>
            </div>
        </div>
    `;
}

// Generate a constraint card HTML
function getVincoloCard(constraint) {
    const sistemaTags = [
        "no_overlap_teacher",
        "no_overlap_classroom",
        "max_consecutive_subject_hours",
    ];
    const isSistema = sistemaTags.includes(constraint.tag);

    return `
        <div class="content-card mb-3 p-3 border-start border-4 ${isSistema ? "border-primary" : "border-info"
        }">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-1">
                        <h5 class="h6 mb-0 fw-bold">${constraint.name}</h5> 
                        ${isSistema
            ? '<span class="badge bg-light text-primary border ms-2"><i class="fas fa-lock me-1"></i> Sistema</span>'
            : ""
        }
                    </div>
                    <p class="text-sm text-secondary mb-2 italic">
                        ${constraint.description ||
        "Nessuna spiegazione disponibile."
        }
                    </p>
                </div>
                <div>
                    ${!isSistema
            ? `<button class="btn btn-sm btn-outline-danger" onclick="window.deleteConstraint('${constraint._id}', '${constraint.name}')">
                             <i class="fas fa-trash"></i>
                           </button>`
            : ""
        }
                </div>
            </div>
        </div>
    `;
}

export {
    getOrarioContent,
    getGeneraContent,
    getDocentiContent,
    getMaterieContent,
    getCorsiContent,
    getAuleContent,
    getVincoliContent,
    getNotificheContent,
    getReportContent,
    getPreferenzeContent,
};