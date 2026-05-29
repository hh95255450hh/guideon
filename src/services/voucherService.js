const PDFDocument = require('pdfkit');

const GREEN = '#0f7b6c';
const DARK  = '#1a1a1a';
const GREY  = '#666666';

/**
 * Generate a PDF voucher for a confirmed booking.
 * Returns a Buffer with the PDF bytes.
 */
function generateVoucher(booking, guide, tourist) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header band
      doc.rect(0, 0, doc.page.width, 110).fill(GREEN);
      doc.fillColor('white').fontSize(28).font('Helvetica-Bold').text('Guideon', 50, 40);
      doc.fontSize(11).font('Helvetica').fillColor('#cfe7e1').text('Discover Oman with a local guide', 50, 75);

      const right = doc.page.width - 50;
      doc.fontSize(11).fillColor('white').text('BOOKING VOUCHER', right - 130, 45, { width: 130, align: 'right' });
      doc.fontSize(9).text(`#${booking.id}`, right - 130, 65, { width: 130, align: 'right' });
      doc.text(new Date().toLocaleDateString('en-GB'), right - 130, 80, { width: 130, align: 'right' });

      // Body
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(20).text('Confirmed', 50, 140);
      doc.fillColor(GREY).font('Helvetica').fontSize(11)
         .text('Show this voucher to your guide on the tour day.', 50, 168);

      // Big info card
      let y = 210;
      doc.roundedRect(50, y, doc.page.width - 100, 200, 8).strokeColor('#e0e7e4').stroke();

      const drawRow = (label, value, yPos) => {
        doc.fillColor(GREY).font('Helvetica').fontSize(10).text(label, 70, yPos);
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text(value, 200, yPos, { width: 320 });
      };

      drawRow('Tourist',     tourist?.fullName || 'Unknown', y + 20);
      drawRow('Guide',       guide?.fullName || 'Unknown',   y + 50);
      drawRow('Destination', booking.destination,            y + 80);
      drawRow('Date',        new Date(booking.tourDate).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }), y + 110);
      drawRow('Duration',    booking.duration === 'half' ? 'Half Day' : 'Full Day', y + 140);
      drawRow('Participants',String(booking.participants || 1), y + 170);

      // Total
      y = 430;
      doc.roundedRect(50, y, doc.page.width - 100, 60, 8).fill(GREEN);
      doc.fillColor('white').font('Helvetica').fontSize(11).text('Total Paid', 70, y + 18);
      doc.font('Helvetica-Bold').fontSize(22)
         .text(`${parseFloat(booking.totalAmount || 0).toFixed(2)} OMR`,
               doc.page.width - 230, y + 16, { width: 160, align: 'right' });

      // Guide contact
      if (guide) {
        y = 520;
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text('Guide Contact', 50, y);
        doc.fillColor(GREY).font('Helvetica').fontSize(10)
           .text(`📧 ${guide.email || '—'}`, 50, y + 22)
           .text(`📱 ${guide.phone || '—'}`, 50, y + 38);
      }

      // Important info
      y = 600;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text('Important', 50, y);
      doc.fillColor(GREY).font('Helvetica').fontSize(10)
         .text('• Be at the meeting point 15 minutes before the tour starts.', 50, y + 24)
         .text('• Bring water, sunscreen and comfortable shoes.', 50, y + 38)
         .text('• Cancellations within 48 hours of the tour are non-refundable.', 50, y + 52)
         .text('• Contact your guide directly for last-minute adjustments.', 50, y + 66);

      // Footer
      const footerY = doc.page.height - 60;
      doc.fontSize(8).fillColor(GREY)
         .text('Guideon — www.guideon.om · Find Your Certified Local Guide in Oman', 50, footerY, {
           width: doc.page.width - 100, align: 'center'
         })
         .text(`Generated ${new Date().toISOString()}`, 50, footerY + 14, {
           width: doc.page.width - 100, align: 'center'
         });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateVoucher };
