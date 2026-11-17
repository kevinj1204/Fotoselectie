import ExcelJS from 'exceljs';
import { handler } from '@/lib/api';
import { listSubmissions, listShootsWithProgress } from '@/lib/service';
import { formatShort } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUBMISSION_COLUMNS = [
  { header: 'Shoot', key: 'shoot', width: 24 },
  { header: 'Deelnemernummer', key: 'participant_number', width: 16 },
  { header: 'Voornaam', key: 'first_name', width: 18 },
  { header: 'Achternaam', key: 'last_name', width: 22 },
  { header: 'Categorie', key: 'category', width: 10 },
  { header: 'Provincie/regio', key: 'province', width: 18 },
  { header: 'Hoofd-fotonummer', key: 'photo_code', width: 16 },
  { header: 'Extra fotonummers', key: 'extra_codes', width: 30 },
  { header: "Aantal extra foto's", key: 'extra_count', width: 16 },
  { header: 'Prijs per extra foto (EUR)', key: 'price_each', width: 18 },
  { header: 'Extra fotokosten (EUR)', key: 'extra_total', width: 18 },
  { header: 'Datum/tijd inzending', key: 'submitted_at', width: 20 },
  { header: 'Laatst gewijzigd', key: 'updated_at', width: 20 },
  { header: 'Status', key: 'status', width: 22 },
  { header: 'Notitie beheerder', key: 'note', width: 30 },
];

const PROGRESS_COLUMNS = [
  { header: 'Provincie/regio', key: 'province', width: 18 },
  { header: 'Shoot', key: 'shoot', width: 24 },
  { header: 'Gearchiveerd', key: 'archived', width: 12 },
  { header: 'Verwacht', key: 'expected', width: 10 },
  { header: 'Ontvangen', key: 'received', width: 10 },
  { header: 'Nog te ontvangen', key: 'remaining', width: 16 },
  { header: 'Percentage', key: 'percent', width: 11 },
  { header: 'Status', key: 'status', width: 28 },
  { header: 'Verwacht Teens', key: 'expected_teens', width: 14 },
  { header: 'Ontvangen Teens', key: 'received_teens', width: 15 },
  { header: 'Verwacht Missen', key: 'expected_misses', width: 15 },
  { header: 'Ontvangen Missen', key: 'received_misses', width: 16 },
  { header: 'Deadline (NL-tijd)', key: 'deadline', width: 20 },
  { header: 'Deadline verstreken', key: 'deadline_passed', width: 18 },
  { header: 'Inzenden na deadline', key: 'after_deadline', width: 18 },
  { header: "Extra foto's", key: 'extra_count', width: 12 },
  { header: 'Extra fotokosten (EUR)', key: 'extra_total', width: 18 },
];

function submissionRows(list) {
  return list.map((s) => ({
    shoot: s.shoot_name,
    participant_number: s.participant_number || '',
    first_name: s.first_name,
    last_name: s.last_name,
    category: s.category,
    province: s.province,
    photo_code: s.photo_code,
    extra_codes: (s.extra_photo_codes || []).join(', '),
    extra_count: s.extra_photo_count,
    price_each: s.extra_photo_price_each,
    extra_total: s.extra_photo_total,
    submitted_at: formatShort(s.submitted_at),
    updated_at: s.updated_at ? formatShort(s.updated_at) : '',
    status: s.review_status === 'possible_duplicate' ? `Te beoordelen: ${s.duplicate_reason || 'mogelijk dubbel'}` : 'OK',
    note: s.admin_note || '',
  }));
}

function progressRows(list) {
  return list.map((s) => ({
    province: s.province,
    shoot: s.name,
    archived: s.archived_at ? 'Ja' : 'Nee',
    expected: s.expected_participants ?? '',
    received: s.received,
    remaining: s.remaining ?? '',
    percent: s.percent === null ? '' : `${s.percent}%`,
    status: s.status.label,
    expected_teens: s.expected_teens ?? '',
    received_teens: s.received_teens,
    expected_misses: s.expected_misses ?? '',
    received_misses: s.received_misses,
    deadline: s.deadline_at ? formatShort(s.deadline_at) : '',
    deadline_passed: s.deadline_passed ? 'Ja' : 'Nee',
    after_deadline: s.allow_submissions_after_deadline ? 'Toegestaan' : 'Geblokkeerd',
    extra_count: s.extra_count,
    extra_total: s.extra_total,
  }));
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  // Voorkom formule-injectie in Excel
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')];
  rows.forEach((r) => lines.push(columns.map((c) => csvCell(r[c.key])).join(';')));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

async function toXlsx(sheetName, columns, rows, textKeys, moneyKeys) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Miss Nederland fotoselectie';
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  textKeys.forEach((k) => { ws.getColumn(k).numFmt = '@'; });
  moneyKeys.forEach((k) => { ws.getColumn(k).numFmt = '€ #,##0.00'; });
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return wb.xlsx.writeBuffer();
}

export const GET = handler(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const format = params.format === 'xlsx' ? 'xlsx' : 'csv';
  const type = params.type === 'progress' ? 'progress' : 'submissions';
  const stamp = new Date().toISOString().slice(0, 10);

  let columns, rows, sheet, textKeys, moneyKeys;
  if (type === 'progress') {
    columns = PROGRESS_COLUMNS;
    rows = progressRows(await listShootsWithProgress());
    sheet = 'Voortgang';
    textKeys = [];
    moneyKeys = ['extra_total'];
  } else {
    columns = SUBMISSION_COLUMNS;
    rows = submissionRows(await listSubmissions(params));
    sheet = 'Inzendingen';
    textKeys = ['participant_number', 'photo_code', 'extra_codes'];
    moneyKeys = ['price_each', 'extra_total'];
  }

  const filename = `fotoselectie-${type === 'progress' ? 'voortgang' : 'inzendingen'}-${stamp}.${format}`;
  const body = format === 'xlsx'
    ? Buffer.from(await toXlsx(sheet, columns, rows, textKeys, moneyKeys))
    : toCsv(columns, rows);

  return new Response(body, {
    headers: {
      'Content-Type': format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}, { admin: true });
