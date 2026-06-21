/**
 * Strip every sensitive field from a user row before it is sent to a client.
 * A bare `delete user.password` repeatedly missed security tokens (email
 * verification, password reset, 2FA secret/backup codes, FCM token), so this
 * single allow-list is the source of truth for all auth responses.
 */
const SENSITIVE_USER_FIELDS = [
  'password', 'twoFactorSecret', 'twoFactorBackupCodes',
  'emailVerifyToken', 'emailVerifyExpires',
  'resetPasswordToken', 'resetPasswordExpires', 'fcm_token',
];

function publicUser(user) {
  if (!user) return user;
  const safe = { ...user };
  for (const f of SENSITIVE_USER_FIELDS) delete safe[f];
  return safe;
}

module.exports = { publicUser, SENSITIVE_USER_FIELDS };
