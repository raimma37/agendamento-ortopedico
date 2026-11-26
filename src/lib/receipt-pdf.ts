import { jsPDF } from "jspdf";

export interface ReceiptPdfData {
  clinicName: string;
  protocol: string;
  patientName: string;
  whatsappDisplay: string;
  dateBR: string;
  weekdayLabel: string;
  shiftLabel: string;
  location: string | null;
  locationAddress: string | null;
  insurance: string;
  visitType: string;
  kneeOption: string;
  statusLabel: string;
  protocolInstructions: string;
}

/**
 * Normaliza caracteres fora da faixa Latin-1 suportada pelas fontes padrão do PDF
 * (ex: travessões e bullets Unicode) preservando todos os acentos do português.
 */
function pdfSafeText(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ");
}

export function downloadAppointmentReceiptPdf(data: ReceiptPdfData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Faixa superior (Midnight Indigo / Violeta)
  doc.setFillColor(35, 29, 89);
  doc.rect(0, 0, pageWidth, 44, "F");

  // Detalhe de acento inferior na faixa
  doc.setFillColor(108, 76, 255);
  doc.rect(0, 42, pageWidth, 2, "F");

  // Título da Clínica
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const clinicTitleLines = doc.splitTextToSize(
    pdfSafeText(data.clinicName),
    contentWidth - 46
  );
  doc.text(clinicTitleLines, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(205, 202, 240);
  doc.text(
    pdfSafeText("Comprovante de Agendamento - Ordem de Chegada"),
    margin,
    16 + clinicTitleLines.length * 6 + 2
  );

  // Badge de Protocolo no canto superior direito
  const protoBoxW = 42;
  const protoBoxH = 22;
  const protoBoxX = pageWidth - margin - protoBoxW;
  const protoBoxY = 11;
  doc.setFillColor(18, 16, 43);
  doc.setDrawColor(149, 123, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(protoBoxX, protoBoxY, protoBoxW, protoBoxH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(179, 158, 255);
  doc.text("PROTOCOLO", protoBoxX + protoBoxW / 2, protoBoxY + 7, {
    align: "center",
  });

  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafeText(data.protocol), protoBoxX + protoBoxW / 2, protoBoxY + 16, {
    align: "center",
  });

  y = 54;

  // Cartão destacado de Data e Turno
  doc.setFillColor(245, 244, 255);
  doc.setDrawColor(209, 204, 242);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "FD");

  const halfW = contentWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 95, 145);
  doc.text("DATA DA CONSULTA", margin + 5, y + 7);
  doc.text("TURNO (ORDEM DE CHEGADA)", margin + halfW + 5, y + 7);

  doc.setFontSize(12);
  doc.setTextColor(24, 21, 56);
  doc.text(
    pdfSafeText(`${data.dateBR} (${data.weekdayLabel})`),
    margin + 5,
    y + 15.5
  );
  doc.text(pdfSafeText(data.shiftLabel), margin + halfW + 5, y + 15.5);

  y += 28;

  // Cartão de Local de Atendimento (quando configurado)
  if (data.location) {
    const addressLines = data.locationAddress
      ? doc.splitTextToSize(pdfSafeText(data.locationAddress), contentWidth - 10)
      : [];
    const locBoxH = 19 + (addressLines.length > 0 ? addressLines.length * 4.8 + 2 : 0);

    doc.setFillColor(238, 247, 255);
    doc.setDrawColor(125, 190, 245);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, locBoxH, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(29, 108, 184);
    doc.text("LOCAL DE ATENDIMENTO", margin + 5, y + 7);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(data.location), margin + 5, y + 14.5);

    if (addressLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(addressLines, margin + 5, y + 20.5);
    }

    y += locBoxH + 6;
  }

  // Seção: Dados do Paciente e Consulta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(35, 29, 89);
  doc.text("DADOS DO AGENDAMENTO", margin, y + 4);
  y += 8;

  const rows: Array<[string, string]> = [
    ["Paciente", data.patientName],
    ["WhatsApp", data.whatsappDisplay],
    ["Convênio / Atendimento", data.insurance],
    ["Tipo de Consulta", data.visitType],
    ["Avaliação", data.kneeOption],
    ["Status", data.statusLabel],
  ];

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);

  for (const [label, value] of rows) {
    doc.line(margin, y, pageWidth - margin, y);
    y += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafeText(label), margin + 2, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const valLines = doc.splitTextToSize(pdfSafeText(value), contentWidth - 62);
    doc.text(valLines, pageWidth - margin - 2, y, { align: "right" });
    y += Math.max(4, (valLines.length - 1) * 5 + 4);
  }
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Bloco de Confirmação via WhatsApp
  const waText =
    "Você receberá uma mensagem no WhatsApp informado antes da consulta para confirmar sua presença.";
  const waLines = doc.splitTextToSize(pdfSafeText(waText), contentWidth - 10);
  const waBoxH = 12 + waLines.length * 4.8;

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, contentWidth, waBoxH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text("CONFIRMAÇÃO VIA WHATSAPP", margin + 5, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(6, 78, 59);
  doc.text(waLines, margin + 5, y + 12);

  y += waBoxH + 6;

  // Bloco de Orientações do Consultório
  const instrLines = doc.splitTextToSize(
    pdfSafeText(data.protocolInstructions),
    contentWidth - 10
  );
  const instrBoxH = 12 + instrLines.length * 4.8;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, instrBoxH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 29, 89);
  doc.text("ORIENTAÇÕES DO CONSULTÓRIO", margin + 5, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(instrLines, margin + 5, y + 12);

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  const emittedAt = new Date().toLocaleString("pt-BR");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfSafeText("Apresente este comprovante (digital ou impresso) na recepção."),
    margin,
    pageHeight - 14
  );
  doc.text(pdfSafeText(`Emitido em: ${emittedAt}`), pageWidth - margin, pageHeight - 14, {
    align: "right",
  });

  const safeProtocol = data.protocol.replace(/[^a-zA-Z0-9_-]/g, "");
  doc.save(`comprovante-${safeProtocol || "agendamento"}.pdf`);
}
