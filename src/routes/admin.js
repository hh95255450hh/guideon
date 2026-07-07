const router = require('express').Router();
const admin = require('../controllers/adminController');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// All /admin routes require admin OR staff
router.use(requireAdmin);

// Current user's permissions (any admin/staff)
router.get('/me/permissions', admin.myPermissions);

// View-only — open to all staff
router.get('/stats', admin.stats);
router.get('/activity', admin.recentActivity);
router.get('/email-test', admin.emailTest);
router.get('/whatsapp-test', admin.whatsappTest);
router.get('/reminder-test', admin.reminderTest);
router.get('/compress-storage',        admin.compressStorage);
router.get('/compress-storage/status', admin.compressStorageStatus);
router.get('/stats/extended',     requirePermission('view_analytics'), admin.extendedStats);
router.get('/revenue',            requirePermission('view_analytics'), admin.revenue);

// Financial management — expense ledger (salaries / discounts / costs)
router.get('/expenses',           requirePermission('view_analytics'), admin.listExpenses);
router.post('/expenses',          requirePermission('manage_finance'), admin.createExpense);
router.patch('/expenses/:id',     requirePermission('manage_finance'), admin.updateExpense);
router.delete('/expenses/:id',    requirePermission('manage_finance'), admin.deleteExpense);

// Provider payouts — what the platform owes guides/companies, and settling it
router.get('/payouts',                 requirePermission('view_analytics'), admin.listPayouts);
router.post('/payouts/:providerId/settle', requirePermission('manage_finance'), admin.settlePayout);

// Treasury — the company's main vault (running balance + manual ledger)
router.get('/treasury',           requirePermission('view_analytics'), admin.treasury);
router.post('/treasury',          requirePermission('manage_finance'), admin.addTreasuryTxn);
router.delete('/treasury/:id',    requirePermission('manage_finance'), admin.deleteTreasuryTxn);
router.get('/treasury/:id/voucher', requirePermission('view_analytics'), admin.treasuryVoucher);
router.get('/providers',          requirePermission('view_analytics'), admin.providersByType);

// Invoices — admin-issued invoices for providers
router.get('/invoices',           requirePermission('view_analytics'), admin.listInvoices);
router.post('/invoices',          requirePermission('manage_finance'), admin.createInvoice);
router.get('/invoices/:id/pdf',   requirePermission('view_analytics'), admin.invoicePdf);
router.post('/invoices/:id/settle', requirePermission('manage_finance'), admin.settleInvoice);
router.delete('/invoices/:id',    requirePermission('manage_finance'), admin.deleteInvoice);
router.get('/guides/pending',     requirePermission('view_users'), admin.pendingGuides);
router.get('/guides',             requirePermission('view_users'), admin.allGuides);
router.get('/tourists',           requirePermission('view_users'), admin.allTourists);
router.get('/companies/pending',  requirePermission('view_users'), admin.pendingCompanies);
router.get('/companies',          requirePermission('view_users'), admin.allCompanies);
router.get('/teams',              requirePermission('view_users'), admin.allTeams);
router.get('/teams/pending',      requirePermission('view_users'), admin.pendingTeams);
router.patch('/teams/:id/verify', requirePermission('verify_companies'), admin.verifyTeam);
router.get('/bookings',           requirePermission('view_bookings'), admin.allBookings);

// Verification
router.patch('/guides/:id/verify',    requirePermission('verify_guides'),    admin.verifyGuide);
router.patch('/companies/:id/verify', requirePermission('verify_companies'), admin.verifyCompany);

// Suspension
router.patch('/users/:id/suspend',   requirePermission('suspend_users'), admin.suspendUser);
router.patch('/users/:id/unsuspend', requirePermission('suspend_users'), admin.unsuspendUser);

// User editing
router.get('/users/:id/packages',           requirePermission('edit_users'),     admin.userPackages);
router.post('/users/:id/packages',          requirePermission('edit_users'),     admin.createUserPackage);
router.patch('/users/:id',                  requirePermission('edit_users'),     admin.editUser);
router.post('/users/:id/reset-password',    requirePermission('reset_passwords'), admin.adminResetPassword);
router.delete('/users/:id',                 requirePermission('delete_users'),   admin.deleteUser);

// Booking control
router.patch('/bookings/:id/complete', requirePermission('complete_bookings'), admin.markBookingComplete);
router.post('/bookings/:id/cancel',    requirePermission('cancel_bookings'),   admin.adminCancelBooking);

// Moderation
router.delete('/reviews/:id',  requirePermission('delete_reviews'),  admin.deleteReview);
router.delete('/messages/:id', requirePermission('delete_messages'), admin.deleteMessage);

// Communication
router.post('/broadcast', requirePermission('broadcast_email'), admin.broadcastEmail);

// Reports & audit
router.get('/audit-log',          requirePermission('view_audit_log'), admin.getAuditLog);
router.get('/export/:resource',   requirePermission('export_data'),    admin.exportCSV);

// Admins management (super-admin only — never delegated)
router.get('/admins',             requireSuperAdmin, admin.allAdmins);
router.post('/create-admin',      requireSuperAdmin, admin.createAdmin);

// Staff management (super-admin only)
router.get('/staff',              requireSuperAdmin, admin.allStaff);
router.get('/staff/roles',        requireSuperAdmin, admin.staffRoles);
router.post('/staff',             requireSuperAdmin, admin.createStaff);
router.patch('/staff/:id',        requireSuperAdmin, admin.updateStaff);
router.delete('/staff/:id',       requireSuperAdmin, admin.deleteStaff);

// Messages moderation — list all conversations + view any thread.
// Reading users' private threads is a moderation power → gate by the same
// permission as deleting messages (not open to every staff role).
const { adminListConversations, adminViewThread } = require('../controllers/messagesController');
router.get('/messages/conversations', requirePermission('delete_messages'), adminListConversations);
router.get('/messages/thread',        requirePermission('delete_messages'), adminViewThread);

// Content management — regions / trails / blog (admin or staff)
const content = require('../controllers/contentController');
router.get('/content/:key',        content.get);
router.put('/content/:key',        content.save);
router.post('/content/:key/reset', content.reset);

module.exports = router;
