/**
 * Strip every sensitive field from a user row before it is sent to a client.
 * A bare `delete user.password` repeatedly missed security tokens (email
 * verification, password reset, 2FA secret/backup codes, FCM token), so this
 * single allow-list is the source of truth for all auth responses.
 */
const SENSITIVE_USER_FIELDS = [
  'password', 'twoFactorSecret', 'twoFactorBackupCodes',
  'emailVerifyToken', 'emailVerifyExpires',
  'resetPasswordToken', 'resetPasswordExpires',
  // The push token column is fcmToken; this list only ever named the legacy
  // snake_case fcm_token, so the live token went out in every guide search.
  'fcm_token', 'fcmToken',
  'googleId',
];

function publicUser(user) {
  if (!user) return user;
  const safe = { ...user };
  for (const f of SENSITIVE_USER_FIELDS) delete safe[f];
  return safe;
}

module.exports = { publicUser, SENSITIVE_USER_FIELDS };
