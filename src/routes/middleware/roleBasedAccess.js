import { supabase } from '../../utils/supabaseClient.js';

export const canViewReports = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has admin or reports_viewer role
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', userId)
      .in('roles.name', ['admin', 'reports_viewer']);
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(403).json({ error: 'Insufficient permissions to view reports' });
    }
    next();
  } catch (error) {
    console.error('Error checking report permissions:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
}; 