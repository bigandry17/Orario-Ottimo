import { getToken } from '../auth.js';

// API base URLs
const ADMIN_API_BASE = '/api/admin';
const TEACHER_API_BASE = '/api/teacher';
const SCHEDULE_API_BASE = '/api/schedule';
const NOTIFICATIONS_API_BASE = '/api/notifications';

// Generic GET request
async function fetchData(endpoint, params = {}) {
    try {
        let url;
        const queryString = new URLSearchParams(params).toString();

        if (endpoint === 'schedule') {
            url = `${SCHEDULE_API_BASE}?${queryString}`;
        } else if (endpoint === 'notifications') {
            url = `${NOTIFICATIONS_API_BASE}?${queryString}`;
        } else if (endpoint.startsWith('teacher/')) {
            url = `${TEACHER_API_BASE}/${endpoint.substring(8)}`;
        } else {
            url = `${ADMIN_API_BASE}/${endpoint}${queryString ? '?' + queryString : ''}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: `Server error (${response.status})` }));
            throw new Error(errorBody.message);
        }
        return await response.json();
    } catch (error) {
        console.error(`Errore nel servizio dati per ${endpoint}:`, error);
        return [];
    }
}

// Generic POST request
async function postData(endpoint, data) {
    try {
        let url;
        if (endpoint.startsWith('teacher/')) {
            url = `${TEACHER_API_BASE}/${endpoint.substring(8)}`;
        } else {
            url = `${ADMIN_API_BASE}/${endpoint}`;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `Server error (${response.status})`);
        }
        return result;
    } catch (error) {
        console.error(`Errore nel servizio dati POST per ${endpoint}:`, error);
        throw error;
    }
}

// Generic PUT request
async function putData(endpoint, data) {
    try {
        let url;
        if (endpoint.startsWith('notifications/')) {
            url = `${NOTIFICATIONS_API_BASE}/${endpoint.substring(14)}`;
        } else if (endpoint.startsWith('teacher/')) {
            url = `${TEACHER_API_BASE}/${endpoint.substring(8)}`;
        } else {
            url = `${ADMIN_API_BASE}/${endpoint}`;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `Server error (${response.status})`);
        }
        return result.data;
    } catch (error) {
        console.error(`Errore nel servizio dati PUT per ${endpoint}:`, error);
        throw error;
    }
}

// Generic DELETE request
async function deleteData(endpoint, params = {}) {
    try {
        let url;
        const queryString = new URLSearchParams(params).toString();

        if (endpoint.startsWith('notifications/')) {
            url = `${NOTIFICATIONS_API_BASE}/${endpoint.substring(14)}`;
        } else if (endpoint.startsWith('teacher/')) {
            url = `${TEACHER_API_BASE}/${endpoint.substring(8)}`;
        } else {
            url = `${ADMIN_API_BASE}/${endpoint}`;
        }

        if (queryString) {
            url = `${url}?${queryString}`;
        }

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `Server error (${response.status})`);
        }
        return result;
    } catch (error) {
        console.error(`Errore nel servizio dati DELETE per ${endpoint}:`, error);
        throw error;
    }
}

// Data service API
export const dataService = {
    getCourses: (searchQuery = '') => {
        const params = {};
        if (searchQuery && searchQuery.trim() !== '') {
            params.search = searchQuery.trim();
        }
        return fetchData('courses', params);
    },
    addCourse: (data) => postData('courses', data),
    updateCourse: (id, data) => putData(`courses/${id}`, data),
    deleteCourse: (id) => deleteData(`courses/${id}`),

    getSubjects: (searchQuery = '') => {
        const params = {};
        if (searchQuery && searchQuery.trim() !== '') {
            params.search = searchQuery.trim();
        }
        return fetchData('subjects', params);
    },
    addSubject: (data) => postData('subjects', data),
    updateSubject: (id, data) => putData(`subjects/${id}`, data),
    deleteSubject: (id) => deleteData(`subjects/${id}`),

    getClassrooms: (searchQuery = '') => {
        const params = {};
        if (searchQuery && searchQuery.trim() !== '') {
            params.search = searchQuery.trim();
        }
        return fetchData('classrooms', params);
    },
    addClassroom: (data) => postData('classrooms', data),
    updateClassroom: (id, data) => putData(`classrooms/${id}`, data),
    deleteClassroom: (id) => deleteData(`classrooms/${id}`),

    getTeachers: (searchQuery = '') => {
        const params = {};
        if (searchQuery && searchQuery.trim() !== '') {
            params.search = searchQuery.trim();
        }
        return fetchData('teachers', params);
    },
    addTeacher: (data) => postData('teachers', data),
    updateTeacher: (id, data) => putData(`teachers/${id}`, data),
    deleteTeacher: (id) => deleteData(`teachers/${id}`),

    getConstraints: () => fetchData('constraints'),
    addConstraint: (data) => postData('constraints', data),
    updateConstraint: (id, data) => putData(`constraints/${id}`, data),
    deleteConstraint: (id) => deleteData(`constraints/${id}`),

    getSchedule: (course, year) => fetchData('schedule', { course: course || '', year: year || '' }),
    updateLessonStatus: (id, status) => putData(`teacher/schedule/status/${id}`, { status }),
    generateSchedule: (data) => postData('generate-schedule', data),

    getNotifications: (userId) => fetchData('notifications', { userId }),
    markAllNotificationsRead: (userId) => putData(`notifications/mark-all-read`, { userId }),
    markNotificationRead: (id) => putData(`notifications/${id}`, {}),
    deleteNotification: (id) => deleteData(`notifications/${id}`),
    deleteAllNotifications: (userId) => deleteData(`notifications/all`, { userId }),

    getFullReport: () => fetchData('report-data'),

    getTeacherPreferences: (teacherId) => fetchData(`teacher/preferences/${teacherId}`),
    addPreference: (data) => postData('teacher/preferences', data),
    deletePreference: (id) => deleteData(`teacher/preferences/${id}`),
};