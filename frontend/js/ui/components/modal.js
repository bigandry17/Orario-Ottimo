// Generate the modal for adding/editing a preference
export function getPreferenceModalHtml() {
    return `
        <div class="modal fade" id="preferenceActionModal" tabindex="-1" aria-labelledby="preferenceActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="preference-modal-title">Aggiungi Preferenza</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="preference-modal-body">
                        </div>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for adding/editing a constraint
export function getConstraintModalHtml() {
    return `
        <div class="modal fade" id="constraintActionModal" tabindex="-1" aria-labelledby="constraintActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="constraint-modal-title">Aggiungi/Modifica Vincolo</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="constraint-modal-body">
                        </div>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for adding a new teacher
export function getAddTeacherModalHtml(subjects = []) {
    const subjectDatalistOptions = subjects
        .map((s) => `<option value="${s.name}"></option>`)
        .join("");

    return `
        <div class="modal fade" id="addTeacherModal" tabindex="-1" aria-labelledby="addTeacherModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="addTeacherModalLabel">Aggiungi Nuovo Docente</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="addTeacherForm" onsubmit="event.preventDefault(); window.saveNewTeacher()">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="teacher-name" class="form-label">Nome Completo:</label>
                                <input type="text" class="form-control" id="teacher-name" required>
                            </div>
                            <div class="mb-3">
                                <label for="teacher-email" class="form-label">Email (Unica):</label>
                                <input type="email" class="form-control" id="teacher-email" required>
                            </div>
                            <div class="mb-3">
                                <label for="teacher-subjects-input" class="form-label">Materie (Seleziona o digita, separate da virgola):</label>
                                
                                <input list="subject-options-list" 
                                       type="text" 
                                       class="form-control" 
                                       id="teacher-subjects-input" 
                                       placeholder="Es: Analisi Matematica I, Programmazione I">
                                
                                <datalist id="subject-options-list">
                                    ${subjectDatalistOptions}
                                </datalist>
                                <small class="form-text text-muted">Suggerimenti: ${subjects
            .map((s) => s.name)
            .slice(0, 3)
            .join(", ")}...</small>
                                </div>
                            <div class="mb-3">
                                <label for="teacher-max-hours" class="form-label">Ore Settimanali Massime:</label>
                                <input type="number" class="form-control" id="teacher-max-hours" value="18" required min="1">
                            </div>
                        </div>
                        <div class="d-flex modal-footer justify-content-center">
                            <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Annulla</button>
                            <button type="submit" class="btn btn-primary">Salva Docente</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for adding/editing a subject
export function getSubjectModalHtml() {
    return `
        <div class="modal fade" id="subjectActionModal" tabindex="-1" aria-labelledby="subjectActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="subject-modal-title">Aggiungi/Modifica Materia</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="subject-modal-body">
                        </div>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for adding/editing a course
export function getCourseModalHtml() {
    return `
        <div class="modal fade" id="courseActionModal" tabindex="-1" aria-labelledby="courseActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="course-modal-title">Aggiungi/Modifica Corso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="course-modal-body"></div>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for adding/editing a classroom
export function getClassroomModalHtml() {
    return `
        <div class="modal fade" id="classroomActionModal" tabindex="-1" aria-labelledby="classroomActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="classroom-modal-title">Aggiungi/Modifica Aula</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="classroom-modal-body">
                        </div>
                </div>
            </div>
        </div>
    `;
}

// Generate the modal for teacher actions
export function getTeacherModalHtml() {
    return `
        <div class="modal fade" id="teacherActionModal" tabindex="-1" aria-labelledby="teacherActionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="teacher-modal-title">Azioni Docente</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="teacher-modal-body">
                        </div>
                </div>
            </div>
        </div>
    `;
}