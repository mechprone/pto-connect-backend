import { pool } from '../../db.js';

export const canViewReports = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has admin role or report viewing permissions
    const query = `
      SELECT r.name as role_name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1 AND (r.name = 'admin' OR r.name = 'reports_viewer')
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Insufficient permissions to view reports' });
    }

    next();
  } catch (error) {
    console.error('Error checking report permissions:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
}; 