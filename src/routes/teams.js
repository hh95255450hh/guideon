const router = require('express').Router();
const team = require('../controllers/teamController');
const { requireTeam } = require('../middleware/auth');

// Public
router.get('/', team.listTeams);
router.get('/events', team.listEvents);                 // before /:id

// Team self-management (must come before /:id)
router.put('/me/profile',      requireTeam, team.updateProfile);
router.get('/me/events',       requireTeam, team.myEvents);
router.post('/me/events',      requireTeam, team.createEvent);
router.put('/me/events/:id',   requireTeam, team.updateEvent);
router.delete('/me/events/:id',requireTeam, team.deleteEvent);

// Public single team (+ its events)
router.get('/:id', team.getTeam);

module.exports = router;
