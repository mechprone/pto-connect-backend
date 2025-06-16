import express from 'express';
import { canViewReports } from './middleware/roleBasedAccess.js';
import { pool } from '../db.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = express.Router();

// Helper to get report data
async function getReportData(startDate, endDate) {
  // Get summary data
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_events,
      SUM(revenue) as total_revenue,
      AVG(attendance) as average_attendance
    FROM events
    WHERE date BETWEEN $1 AND $2
  `;
  const summaryResult = await pool.query(summaryQuery, [startDate, endDate]);
  const summary = summaryResult.rows[0];

  // Get time series data
  const timeSeriesQuery = `
    SELECT 
      date,
      COUNT(*) as events,
      SUM(revenue) as revenue,
      AVG(attendance) as attendance
    FROM events
    WHERE date BETWEEN $1 AND $2
    GROUP BY date
    ORDER BY date
  `;
  const timeSeriesResult = await pool.query(timeSeriesQuery, [startDate, endDate]);
  const timeSeries = timeSeriesResult.rows;

  // Get detailed data
  const detailsQuery = `
    SELECT 
      date,
      event_name,
      attendance,
      revenue,
      status
    FROM events
    WHERE date BETWEEN $1 AND $2
    ORDER BY date DESC
  `;
  const detailsResult = await pool.query(detailsQuery, [startDate, endDate]);
  const details = detailsResult.rows;

  return {
    summary: {
      totalEvents: parseInt(summary.total_events) || 0,
      totalRevenue: parseFloat(summary.total_revenue) || 0,
      averageAttendance: Math.round(parseFloat(summary.average_attendance)) || 0
    },
    timeSeries: timeSeries.map(row => ({
      date: row.date,
      events: parseInt(row.events),
      revenue: parseFloat(row.revenue),
      attendance: Math.round(parseFloat(row.attendance))
    })),
    details: details.map(row => ({
      date: row.date,
      eventName: row.event_name,
      attendance: parseInt(row.attendance),
      revenue: parseFloat(row.revenue),
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