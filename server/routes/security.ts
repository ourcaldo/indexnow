import { Router } from 'express';
import { DatabaseSecurityLogger } from '../services/security-logger';
import { requireAdmin } from '../middleware/authorization';

const router = Router();

// Get security events (admin only)
router.get('/events', requireAdmin, async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      userId, 
      eventType, 
      severity,
      startDate,
      endDate 
    } = req.query;

    const events = await DatabaseSecurityLogger.getSecurityEvents({
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      userId: userId as string,
      eventType: eventType as string,
      severity: severity as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      events,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: events.length === parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get security statistics (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await DatabaseSecurityLogger.getSecurityStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ error: 'Failed to fetch security stats' });
  }
});

// Manual security event logging (admin only, for testing)
router.post('/events', requireAdmin, async (req, res) => {
  try {
    const { eventType, userId, severity, message, details } = req.body;
    
    await DatabaseSecurityLogger.logSecurityEvent(eventType, {
      userId,
      severity,
      message,
      details
    }, req);
    
    res.json({ message: 'Security event logged successfully' });
  } catch (error) {
    console.error('Error logging security event:', error);
    res.status(500).json({ error: 'Failed to log security event' });
  }
});

export { router as securityRouter };