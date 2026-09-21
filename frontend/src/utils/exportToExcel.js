import * as XLSX from 'xlsx'
import { formatEasternDateTime } from './easternTime'

/**
 * Export an array of row objects to a styled .xlsx file.
 * @param {string} filename  - without extension
 * @param {string} sheetName
 * @param {Object[]} rows    - plain objects, keys become column headers
 */
export function exportToExcel(filename, sheetName, rows) {
  if (!rows || rows.length === 0) {
    alert('No data to export.')
    return
  }

  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-fit column widths
  const colWidths = {}
  rows.forEach(row => {
    Object.entries(row).forEach(([key, val]) => {
      const len = Math.max(String(key).length, String(val ?? '').length)
      colWidths[key] = Math.max(colWidths[key] || 0, len)
    })
  })
  ws['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.min(colWidths[key] + 2, 50) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── Per-feature formatters ──────────────────────────────────────────────────

export function formatRFPs(rfps) {
  return rfps.map(r => ({
    'Client': r.client || '',
    'Check-In': r.checkin || '',
    'Check-Out': r.checkout || '',
    'Rooms': r.numRooms || '',
    'Status': r.status || '',
    'In Consideration': r.inConsideration ? 'Yes' : 'No',
    'Priority': r.priority ? 'Yes' : 'No',
    'Notes': r.notes || '',
    'Emails Sent': r.emailsSent || '',
    'Follow-Ups Done': r.followUpsDone || '',
    'Trade Given': r.tradeGiven || '',
    'Rank': r.rank || '',
    'Days of Week': Array.isArray(r.daysOfWeek) ? r.daysOfWeek.join(', ') : '',
    'Logged By': r.loggedBy?.name || '',
    'Created': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
  }))
}

export function formatHotelScores(scores) {
  return scores.map(s => ({
    'Hotel': s.hotel?.name || '',
    'City': s.hotel?.city || '',
    'Date': s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    'Score': s.score || '',
    'Notes': s.notes || '',
    'Logged By': s.createdBy?.name || '',
  }))
}

export function formatCalls(calls) {
  return calls.map(c => ({
    'Name': c.name || '',
    'Phone': c.phone || '',
    'Hotel': c.hotel?.name || '',
    'Status': c.status === 'pending' ? 'Ready to call' : 'Completed',
    'Outcome': c.outcome || '',
    'Notes': c.notes || '',
    'Follow-Up Done': c.status === 'completed' ? (c.followUpDone === true ? 'Yes' : c.followUpDone === false ? 'No' : 'Not recorded') : '',
    'Logged By': c.loggedBy?.name || '',
    'Called At (Eastern Time)': c.calledAt ? formatEasternDateTime(c.calledAt) : '',
    'Imported By': c.importedBy?.name || '',
    'Added (Eastern Time)': c.createdAt ? formatEasternDateTime(c.createdAt) : '',
  }))
}

/** Download one hotel-specific workbook so staff only enter name and phone. */
export function downloadLeadTemplate(category, hotel) {
  if (!hotel) throw new Error('Choose a hotel before downloading its template.')
  const label = category === 'reputation' ? 'Reputation' : 'Sales'
  const leads = XLSX.utils.aoa_to_sheet([
    ['Lead Name', 'Phone Number'],
  ])
  leads['!cols'] = [{ wch: 32 }, { wch: 22 }]
  leads['!autofilter'] = { ref: 'A1:B1' }

  const instructions = XLSX.utils.aoa_to_sheet([
    [`${label} Call Lead Import — ${hotel.name}`],
    ['How to use'],
    ['1. Enter one lead per row on the Leads sheet.'],
    ['2. Enter only the lead name and phone number; the hotel is already locked into this workbook.'],
    ['3. Keep phone numbers as text so leading zeroes and + country codes are preserved.'],
    ['4. Return to the CRM, click Import leads, and select this completed file.'],
    ['Required fields'],
    ['Lead Name, Phone Number'],
  ])
  instructions['!cols'] = [{ wch: 88 }]

  const templateInfo = XLSX.utils.aoa_to_sheet([
    ['Hotel Name', hotel.name],
    ['Hotel ID', hotel._id || ''],
    ['City', hotel.city || ''],
    ['Category', category],
  ])
  templateInfo['!cols'] = [{ wch: 18 }, { wch: 48 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, leads, 'Leads')
  XLSX.utils.book_append_sheet(workbook, templateInfo, 'Template Info')
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions')
  const safeHotel = hotel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hotel'
  XLSX.writeFile(workbook, `${safeHotel}-${category}-call-leads.xlsx`)
}

const HEADER_ALIASES = {
  name: ['leadname', 'name', 'prospectname', 'contactname'],
  phone: ['phonenumber', 'phone', 'telephone', 'mobile', 'mobilenumber'],
  hotel: ['hotel', 'hotelname', 'property', 'propertyname'],
}

const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Read .xlsx/.xls/.csv rows and normalize common header names for the API. */
export async function readLeadImportFile(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'leads') || workbook.SheetNames[0]
  if (!sheetName) throw new Error('This workbook does not contain a sheet.')

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  })
  if (!matrix.length) throw new Error('The spreadsheet is empty.')

  const infoSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'template info')
  const infoRows = infoSheetName
    ? XLSX.utils.sheet_to_json(workbook.Sheets[infoSheetName], { header: 1, defval: '', raw: false })
    : []
  const templateHotel = String(infoRows.find(row => normalizeHeader(row[0]) === 'hotelname')?.[1] || '').trim()

  const headers = matrix[0].map(normalizeHeader)
  const indexes = {}
  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    indexes[key] = headers.findIndex(header => aliases.includes(header))
  })
  const missingHeaders = Object.entries(indexes)
    .filter(([key, index]) => index < 0 && (key !== 'hotel' || !templateHotel))
    .map(([key]) => key)
  if (missingHeaders.length) {
    throw new Error(`Missing required column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}.`)
  }

  const rows = matrix.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    name: String(values[indexes.name] ?? '').trim(),
    phone: String(values[indexes.phone] ?? '').trim(),
    hotel: indexes.hotel >= 0 ? String(values[indexes.hotel] ?? '').trim() || templateHotel : templateHotel,
  })).filter(row => row.name || row.phone)

  if (!rows.length) throw new Error('No lead rows were found on the Leads sheet.')
  return { rows, templateHotel }
}

export function formatGroups(groups) {
  return groups.map(g => {
    const nights = g.numRoomNights || 0
    const revenue = nights && g.rate ? nights * g.rate : 0
    return {
      'Group Name': g.groupName || '',
      'Hotel': g.hotel?.name || '',
      'Check-In': g.checkIn ? new Date(g.checkIn).toLocaleDateString() : '',
      'Check-Out': g.checkOut ? new Date(g.checkOut).toLocaleDateString() : '',
      'Rooms': g.numRooms || '',
      'Room Nights': nights || '',
      'Rate/Night ($)': g.rate || '',
      'Est. Revenue ($)': revenue || '',
      'Type': g.type || '',
      'Room/Banquet': g.roomBanquet === 'R' ? 'Room' : 'Banquet',
      'Banquet Check-In': g.banquetCheckIn ? new Date(g.banquetCheckIn).toLocaleDateString() : '',
      'Banquet Check-Out': g.banquetCheckOut ? new Date(g.banquetCheckOut).toLocaleDateString() : '',
      'Notes': g.notes || '',
      'Created': g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '',
    }
  })
}

export function formatLeads(leads) {
  return leads.map(l => {
    const nights = l.checkIn && l.checkOut
      ? Math.ceil((new Date(l.checkOut) - new Date(l.checkIn)) / 86400000)
      : 0
    const revenue = nights && l.numRooms && l.rateOffered ? nights * l.numRooms * l.rateOffered : 0
    return {
      'Contact Name': l.contactName || '',
      'Company': l.company || '',
      'Phone': l.phone || '',
      'Email': l.email || '',
      'Room Type': l.roomType || '',
      'Rooms': l.numRooms || '',
      'Check-In': l.checkIn ? new Date(l.checkIn).toLocaleDateString() : '',
      'Check-Out': l.checkOut ? new Date(l.checkOut).toLocaleDateString() : '',
      'Nights': nights || '',
      'Rate/Night ($)': l.rateOffered || '',
      'Est. Revenue ($)': revenue || '',
      'Status': l.status || '',
      'Source': l.source || '',
      'Notes': l.notes || '',
      'Created': l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '',
    }
  })
}

export function formatCorporateProfiles(profiles) {
  return profiles.map(p => ({
    'Name': p.name || '',
    'Company': p.company || '',
    'Phone': p.phone || '',
    'Email': p.email || '',
    'Card Last 4': p.ccNumber ? p.ccNumber.slice(-4) : '',
    'Card Expiry': p.ccExpiry || '',
    'Notes': p.notes || '',
    'Created': p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
  }))
}

export function formatEvents(events) {
  return events.map(e => ({
    'Event Name': e.name || '',
    'Date': e.date ? new Date(e.date).toLocaleDateString() : '',
    'External Notes': e.notes || '',
    'Created By': e.createdBy?.name || '',
    'Created': e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '',
  }))
}

export function formatTasks(tasks) {
  return tasks.map(t => ({
    'Task Name': t.taskName || '',
    'Status': t.status || '',
    'Priority': t.priority || '',
    'Deadline': t.deadline ? new Date(t.deadline).toLocaleString() : '',
    'Assigned To': t.assignedTo?.name || '',
    'Notes': t.notes || '',
    'Created': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
  }))
}

export function formatUsers(users) {
  return users.map(u => ({
    'Name': u.name || '',
    'Username': u.username || '',
    'Role': u.role || '',
    'Title': u.title || '',
    'Email': u.email || '',
    'Phone': u.phone || '',
    'Last Login': u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '',
  }))
}
