import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';


export interface ChatStats {
  totalMessages: number;
  totalWords: number;
  totalMedia: number;
  totalLinks: number;
}

export async function exportToPDF(
  selectedUser: string,
  stats: { totalMessages: number; totalWords: number; mediaCount: number; links: number },
  busiestUsers: [string, number][],
  commonWords: [string, number][],
  emojis: [string, number][],
  activityByDay: any[],
  activityByMonth: any[]
) {
  try {
    toast.info('Generating PDF... This may take a moment');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Header
    pdf.setFillColor(37, 211, 102); // WhatsApp green
    pdf.rect(0, 0, pageWidth, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.text('WhatsApp Chat Analysis', pageWidth / 2, 18, { align: 'center' });
    
    // User info
    yPosition = 40;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text(`Analysis for: ${selectedUser}`, 20, yPosition);
    
    yPosition += 15;
    pdf.setFontSize(12);
    
    // Stats
    pdf.text(`Total Messages: ${stats.totalMessages}`, 20, yPosition);
    yPosition += 8;
    pdf.text(`Total Words: ${stats.totalWords}`, 20, yPosition);
    yPosition += 8;
    pdf.text(`Media Shared: ${stats.mediaCount}`, 20, yPosition);
    yPosition += 8;
    pdf.text(`Links Shared: ${stats.links}`, 20, yPosition);
    yPosition += 15;

    // Busiest Users (if overall)
    if (selectedUser === 'Overall' && busiestUsers.length > 0) {
      pdf.setFontSize(14);
      pdf.text('Most Active Users:', 20, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      
      busiestUsers.slice(0, 5).forEach(([user, count]) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(`${user}: ${count} messages`, 25, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Common Words
    if (commonWords.length > 0) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.text('Most Common Words:', 20, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      
      commonWords.slice(0, 10).forEach(([word, count]) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(`${word}: ${count} times`, 25, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Emojis
    if (emojis.length > 0) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.text('Top Emojis:', 20, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      
      const total = emojis.reduce((sum, [, count]) => sum + count, 0);
      emojis.slice(0, 5).forEach(([emoji, count]) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        const percentage = ((count / total) * 100).toFixed(1);
        pdf.text(`${emoji} - ${count} times (${percentage}%)`, 25, yPosition);
        yPosition += 6;
      });
    }

    // Save PDF
    pdf.save(`whatsapp-analysis-${selectedUser.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    toast.success('PDF exported successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('Failed to generate PDF. Please try again.');
  }
}
