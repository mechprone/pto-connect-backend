import express from 'express';
import { canViewReports } from './middleware/roleBasedAccess.js';
import { supabase } from '../utils/supabaseClient.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = express.Router();

// Helper to get report data
async function getReportData(startDate, endDate) {
  // Get summary data
  const { data: summaryData, error: summaryError } = await supabase
    .from('events')
    .select('revenue, attendance')
    .gte('date', startDate)
    .lte('date', endDate);
  if (summaryError) throw summaryError;

  const totalEvents = summaryData.length;
  const totalRevenue = summaryData.reduce((sum, row) => sum + (row.revenue || 0), 0);
  const averageAttendance = summaryData.length > 0 ? Math.round(summaryData.reduce((sum, row) => sum + (row.attendance || 0), 0) / summaryData.length) : 0;

  // Get time series data
  const { data: timeSeriesData, error: timeSeriesError } = await supabase
    .from('events')
    .select('date, revenue, attendance')
    .gte('date', startDate)
    .lte('date', endDate);
  if (timeSeriesError) throw timeSeriesError;

  // Group by date
  const timeSeries = Object.values(timeSeriesData.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = { date: row.date, events: 0, revenue: 0, attendance: 0 };
    acc[row.date].events += 1;
    acc[row.date].revenue += row.revenue || 0;
    acc[row.date].attendance += row.attendance || 0;
    return acc;
  }, {}));
  timeSeries.forEach(row => {
    row.attendance = Math.round(row.attendance / row.events);
  });

  // Get detailed data
  const { data: details, error: detailsError } = await supabase
    .from('events')
    .select('date, event_name, attendance, revenue, status')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });
  if (detailsError) throw detailsError;

  return {
    summary: {
      totalEvents,
      totalRevenue,
      averageAttendance
    },
    timeSeries,
    details: details.map(row => ({
      date: row.date,
      eventName: row.event_name,
      attendance: row.attendance,
      revenue: row.revenue,
      status: row.status
    }))
  };
}

// Generate report
router.post('/generate', canViewReports, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const reportData = await getReportData(startDate, endDate);
    res.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// PDF download endpoint
router.post('/download/pdf', canViewReports, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    const reportData = await getReportData(startDate, endDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(20).text('PTO Connect Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date Range: ${startDate} to ${endDate}`);
    doc.moveDown();
    doc.fontSize(14).text('Summary');
    doc.fontSize(12).text(`Total Events: ${reportData.summary.totalEvents}`);
    doc.text(`Total Revenue: $${reportData.summary.totalRevenue.toLocaleString()}`);
    doc.text(`Average Attendance: ${reportData.summary.averageAttendance}`);
    doc.moveDown();
    doc.fontSize(14).text('Event Details');
    reportData.details.forEach(row => {
      doc.fontSize(10).text(`${row.date} | ${row.eventName} | Attendance: ${row.attendance} | Revenue: $${row.revenue.toLocaleString()} | Status: ${row.status}`);
    });
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// XLSX download endpoint
router.post('/download/xlsx', canViewReports, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    const reportData = await getReportData(startDate, endDate);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    // Summary
    sheet.addRow(['Summary']);
    sheet.addRow(['Total Events', reportData.summary.totalEvents]);
    sheet.addRow(['Total Revenue', reportData.summary.totalRevenue]);
    sheet.addRow(['Average Attendance', reportData.summary.averageAttendance]);
    sheet.addRow([]);
    // Details
    sheet.addRow(['Date', 'Event Name', 'Attendance', 'Revenue', 'Status']);
    reportData.details.forEach(row => {
      sheet.addRow([
        row.date,
        row.eventName,
        row.attendance,
        row.revenue,
        row.status
      ]);
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating XLSX report:', error);
    res.status(500).json({ error: 'Failed to generate XLSX report' });
  }
});

export default router; 