const User = require('./User');
const Role = require('./role');
const Session = require('./session');
const Ordinance = require('./Ordinance');
const Resolution = require('./resolution');
const MeetingMinutes = require('./MeetingMinutes');
const Notification = require('./notification');
const AuditLog = require('./audit_log');

// User ↔ Role
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

// Session ↔ Ordinance/Resolution
Session.hasMany(Ordinance, { foreignKey: 'session_id' });
Ordinance.belongsTo(Session, { foreignKey: 'session_id' });

Session.hasMany(Resolution, { foreignKey: 'session_id' });
Resolution.belongsTo(Session, { foreignKey: 'session_id' });

// Session ↔ MeetingMinutes
Session.hasMany(MeetingMinutes, { foreignKey: 'session_id' });
MeetingMinutes.belongsTo(Session, { foreignKey: 'session_id' });

// User ↔ Ordinance/Resolution
User.hasMany(Ordinance, { foreignKey: 'author_id' });
Ordinance.belongsTo(User, { foreignKey: 'author_id' });

User.hasMany(Resolution, { foreignKey: 'author_id' });
Resolution.belongsTo(User, { foreignKey: 'author_id' });

// User ↔ Notification
User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// User ↔ AuditLog
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { User, Role, Session, Ordinance, Resolution, MeetingMinutes, Notification, AuditLog };
