const mongoose = require('mongoose');

function toTitleCase(str) {
    if (!str) return '';

    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'docente'], required: true },
    name: { type: String, required: true }
});


const CourseSchema = new mongoose.Schema({
    name: String,
    year: Number,
    students_count: Number,
});

const SubjectSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        set: v => toTitleCase(v.trim()),
        required: true
    },
    code: {
        type: String,
        unique: true,
        set: v => v.trim().toUpperCase(),
        required: true
    },
    is_lab: { type: Boolean, default: false },
    weekly_hours: Number,
    course_ref: String
});

const ClassroomSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    floor: Number,
    capacity: Number,
    has_projector: { type: Boolean, default: true },
    has_pc: { type: Boolean, default: false }
});

const ConstraintSchema = new mongoose.Schema({
    name: String,
    description: String,
    type: { type: String, enum: ['Rigido', 'Flessibile'] },
    tag: String
});

const PreferenceSchema = new mongoose.Schema({
    teacher_id: mongoose.Schema.Types.ObjectId,
    day: String,
    time_slot: { type: String, enum: ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00'] },
    type: { type: String, enum: ['Evitare', 'Preferito', 'Non Disponibile'] }
});

const TeacherSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    subjects: [String],
    max_weekly_hours: { type: Number, default: 18 }
});

const ScheduleEntrySchema = new mongoose.Schema({
    course_name: String,
    course_year: Number,
    day: { type: String, enum: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'N/A'] },
    time_slot: { type: String, enum: ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00', 'N/A'] },
    subject_name: String,
    teacher_name: String,
    classroom_name: String,
    status: { type: String, enum: ['Confermato', 'In Attesa', 'Conflitto'], default: 'Confermato' }
});

const NotificationSchema = new mongoose.Schema({
    target_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    target_role: {
        type: String,
        enum: ['admin', 'docente', 'all'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['success', 'warning', 'info', 'error'],
        default: 'info'
    },
    is_read: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    ref_id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'ref_model',
        required: false
    },
    ref_model: {
        type: String,
        enum: ['ScheduleEntry', 'Teacher', 'Course', null],
        required: false
    }
});

const ReportHistorySchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    metrics: {
        efficiency: Number,
        satisfaction: Number,
        totalHours: Number,
        totalRequired: Number,
        coveragePercent: Number,
        conflicts: Number
    }
});

module.exports = {
    User: mongoose.model('User', UserSchema),
    Teacher: mongoose.model('Teacher', TeacherSchema),
    Course: mongoose.model('Course', CourseSchema),
    Subject: mongoose.model('Subject', SubjectSchema),
    Classroom: mongoose.model('Classroom', ClassroomSchema),
    Constraint: mongoose.model('Constraint', ConstraintSchema),
    Preference: mongoose.model('Preference', PreferenceSchema),
    ScheduleEntry: mongoose.model('ScheduleEntry', ScheduleEntrySchema),
    Notification: mongoose.model('Notification', NotificationSchema),
    ReportHistory: mongoose.model('ReportHistory', ReportHistorySchema)
};