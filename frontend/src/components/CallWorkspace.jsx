import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Badge, statusColor } from './Badge'
import { Button } from './Button'
import { Modal, ModalActions } from './Modal'
import api from '../utils/api'
import { formatEasternDateTime } from '../utils/easternTime'
import dataStyles from '../pages/DataPage.module.css'
import styles from './CallWorkspace.module.css'
import {
  downloadLeadTemplate,
  exportToExcel,
  formatCalls,
  readLeadImportFile,
} from '../utils/exportToExcel'

const OUTCOMES = ['Connected', 'Voicemail', 'No Answer', 'Interested', 'Not Interested']

function LeadForm({ hotels, initialHotel = '', onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', phone: '', hotel: initialHotel })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try { await onSave(form) }
    catch (err) { setError(err.response?.data?.message || 'Could not add this lead.') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit}>
      <p className={styles.modalIntro}>Add the contact once. The caller will log the result later.</p>
      {error && <div className={dataStyles.formError}>{error}</div>}
      <div className={dataStyles.formGroup}>
        <label>Lead name</label>
        <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. John Smith — GM" required autoFocus />
      </div>
      <div className={dataStyles.formGroup}>
        <label>Phone number</label>
        <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="(555) 000-0000" required />
      </div>
      <div className={dataStyles.formGroup}>
        <label>Hotel</label>
        <select value={form.hotel} onChange={event => setForm({ ...form, hotel: event.target.value })} required>
          <option value="">Select hotel</option>
          {hotels.map(hotel => <option key={hotel._id} value={hotel._id}>{hotel.name}{hotel.city ? ` — ${hotel.city}` : ''}</option>)}
        </select>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add to queue'}</Button>
      </ModalActions>
    </form>
  )
}

function OutcomeForm({ lead, onSave, onCancel }) {
  const [outcome, setOutcome] = useState(lead.status === 'completed' ? lead.outcome : '')
  const [notes, setNotes] = useState(lead.notes || '')
  const [followUpDone, setFollowUpDone] = useState(Boolean(lead.followUpDone))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    if (!outcome) return
    setSaving(true)
    setError('')
    try { await onSave({ outcome, notes, followUpDone }) }
    catch (err) { setError(err.response?.data?.message || 'Could not save the call result.') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit}>
      <div className={styles.leadSnapshot}>
        <div className={styles.snapshotIcon}><Icon name="phone" size={18} /></div>
        <div><strong>{lead.name}</strong><div>{lead.phone || 'No phone'}{lead.hotel?.name ? ` · ${lead.hotel.name}` : ''}</div></div>
        {lead.phone && <a className={styles.callLink} href={`tel:${lead.phone}`}>Call now</a>}
      </div>
      {error && <div className={dataStyles.formError}>{error}</div>}
      <div className={dataStyles.formGroup}>
        <label>Call outcome</label>
        <div className={styles.outcomeGrid}>
          {OUTCOMES.map(option => (
            <button key={option} type="button" className={`${styles.outcomeChoice} ${outcome === option ? styles.outcomeChoiceActive : ''}`} onClick={() => setOutcome(option)}>
              <span className={styles.choiceDot} />{option}
            </button>
          ))}
        </div>
      </div>
      <div className={dataStyles.formGroup}>
        <label>Notes</label>
        <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="What happened on the call?" rows={4} />
      </div>
      <div className={dataStyles.formGroup}>
        <label>Follow-up status</label>
        <div className={styles.segmented}>
          <button type="button" className={!followUpDone ? styles.segmentActive : ''} onClick={() => setFollowUpDone(false)}>Not done</button>
          <button type="button" className={followUpDone ? styles.segmentActive : ''} onClick={() => setFollowUpDone(true)}>Done</button>
        </div>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !outcome}>{saving ? 'Saving…' : lead.status === 'pending' ? 'Save result' : 'Update result'}</Button>
      </ModalActions>
    </form>
  )
}

function TemplateForm({ category, hotels, initialHotel, onClose }) {
  const [hotelId, setHotelId] = useState(initialHotel || hotels[0]?._id || '')
  const hotel = hotels.find(item => item._id === hotelId)
  return (
    <div>
      <p className={styles.modalIntro}>Each workbook belongs to one hotel. The property is stored inside it, so your team enters only lead names and phone numbers.</p>
      <div className={dataStyles.formGroup}>
        <label>Hotel template</label>
        <select value={hotelId} onChange={event => setHotelId(event.target.value)}>
          <option value="">Select hotel</option>
          {hotels.map(item => <option key={item._id} value={item._id}>{item.name}{item.city ? ` — ${item.city}` : ''}</option>)}
        </select>
      </div>
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onClose}>Close</Button>
        <Button type="button" disabled={!hotel} onClick={() => downloadLeadTemplate(category, hotel)}><Icon name="doc" size={13} /> Download template</Button>
      </ModalActions>
    </div>
  )
}

function ImportForm({ category, hotels, initialHotel, onImported, onCancel }) {
  const inputRef = useRef(null)
  const [templateHotelId, setTemplateHotelId] = useState(initialHotel || hotels[0]?._id || '')
  const [fileName, setFileName] = useState('')
  const [detectedHotel, setDetectedHotel] = useState('')
  const [rows, setRows] = useState([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const templateHotel = hotels.find(hotel => hotel._id === templateHotelId)

  const hotelNames = useMemo(() => new Set(hotels.map(hotel => hotel.name.trim().toLowerCase())), [hotels])
  const reviewed = useMemo(() => rows.map(row => {
    const missing = [!row.name && 'lead name', !row.phone && 'phone number', !row.hotel && 'hotel'].filter(Boolean)
    let issue = missing.length ? `Missing ${missing.join(', ')}` : ''
    if (!issue && !hotelNames.has(row.hotel.toLowerCase())) issue = `Hotel “${row.hotel}” is not in this CRM list`
    return { ...row, issue }
  }), [rows, hotelNames])
  const validRows = reviewed.filter(row => !row.issue)
  const invalidRows = reviewed.filter(row => row.issue)

  const chooseFile = async file => {
    if (!file) return
    setFileName(file.name)
    setRows([])
    setDetectedHotel('')
    setResult(null)
    setError('')
    setReading(true)
    try {
      const parsed = await readLeadImportFile(file)
      setRows(parsed.rows)
      setDetectedHotel(parsed.templateHotel || parsed.rows[0]?.hotel || '')
    } catch (err) {
      setError(err.message || 'Could not read this spreadsheet.')
    } finally {
      setReading(false)
    }
  }

  const importRows = async () => {
    if (!validRows.length) return
    setImporting(true)
    setImportProgress('')
    setError('')
    try {
      const batches = []
      for (let index = 0; index < validRows.length; index += 5000) batches.push(validRows.slice(index, index + 5000))
      const summary = { imported: 0, duplicates: 0, rejected: 0, errors: [], batchIds: [] }
      for (let index = 0; index < batches.length; index += 1) {
        setImportProgress(batches.length > 1 ? `Batch ${index + 1} of ${batches.length}` : '')
        const { data } = await api.post('/calls/import', { category, rows: batches[index] })
        summary.imported += data.imported || 0
        summary.duplicates += data.duplicates || 0
        summary.rejected += data.rejected || 0
        summary.errors.push(...(data.errors || []))
        if (data.batchId) summary.batchIds.push(data.batchId)
      }
      setResult(summary)
      await onImported(summary)
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed. Please try again.')
    } finally {
      setImporting(false)
      setImportProgress('')
    }
  }

  return (
    <div>
      <div className={styles.importSteps}><span><b>1</b> Hotel template</span><span><b>2</b> Add contacts</span><span><b>3</b> Upload</span></div>
      <div className={styles.templatePanel}>
        <select value={templateHotelId} onChange={event => setTemplateHotelId(event.target.value)}>
          <option value="">Choose hotel for template</option>
          {hotels.map(hotel => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
        </select>
        <Button variant="secondary" type="button" disabled={!templateHotel} onClick={() => downloadLeadTemplate(category, templateHotel)}><Icon name="doc" size={13} /> Download</Button>
      </div>

      {!result && (
        <button className={`${styles.dropzone} ${rows.length ? styles.dropzoneReady : ''}`} type="button" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]) }}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={event => chooseFile(event.target.files?.[0])} hidden />
          <Icon name={rows.length ? 'check' : 'arrowIn'} size={24} />
          <strong>{reading ? 'Reading file…' : fileName || 'Drop the completed hotel template here'}</strong>
          <span>{rows.length ? `${detectedHotel || 'Hotel'} detected · click to replace` : 'or click to choose .xlsx, .xls, or .csv'}</span>
        </button>
      )}

      {error && <div className={dataStyles.formError}>{error}</div>}
      {rows.length > 0 && !result && (
        <>
          <div className={styles.reviewSummary}>
            <div><strong>{rows.length}</strong><span>Rows found</span></div>
            <div className={styles.goodCount}><strong>{validRows.length}</strong><span>Ready</span></div>
            <div className={invalidRows.length ? styles.badCount : ''}><strong>{invalidRows.length}</strong><span>Need fixing</span></div>
          </div>
          <div className={styles.previewWrap}>
            <table className={styles.previewTable}>
              <thead><tr><th>Row</th><th>Lead</th><th>Phone</th><th>Hotel</th><th>Check</th></tr></thead>
              <tbody>{reviewed.slice(0, 8).map(row => <tr key={row.rowNumber} className={row.issue ? styles.invalidRow : ''}><td>{row.rowNumber}</td><td>{row.name || '—'}</td><td>{row.phone || '—'}</td><td>{row.hotel || '—'}</td><td>{row.issue || 'Ready'}</td></tr>)}</tbody>
            </table>
            {reviewed.length > 8 && <div className={styles.previewMore}>Plus {reviewed.length - 8} more rows</div>}
          </div>
          {invalidRows.length > 0 && <p className={styles.importHint}>Rows that need fixing will not be imported.</p>}
        </>
      )}

      {result && <div className={styles.importResult}><div className={styles.resultCheck}>✓</div><h3>{result.imported} lead{result.imported === 1 ? '' : 's'} added</h3><p>{result.duplicates ? `${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped. ` : ''}{result.rejected ? `${result.rejected} row${result.rejected === 1 ? '' : 's'} rejected.` : 'The property queue is ready.'}</p></div>}
      <ModalActions>
        <Button variant="secondary" type="button" onClick={onCancel}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && <Button type="button" disabled={importing || !validRows.length} onClick={importRows}>{importing ? `Importing…${importProgress ? ` ${importProgress}` : ''}` : `Import ${validRows.length || ''} lead${validRows.length === 1 ? '' : 's'}`}</Button>}
      </ModalActions>
    </div>
  )
}

export default function CallWorkspace({ category }) {
  const isReputation = category === 'reputation'
  const query = new URLSearchParams(window.location.search).get('q') || ''
  const storageKey = `call-workspace-hotel-${category}`
  const [calls, setCalls] = useState([])
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(query ? 'all' : 'pending')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [search, setSearch] = useState(query)
  const [selectedHotelId, setSelectedHotelId] = useState(query ? 'all' : localStorage.getItem(storageKey) || 'all')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')

  const fetchData = async () => {
    try {
      const [{ data: callRows }, { data: hotelRows }] = await Promise.all([
        api.get('/calls', { params: { category } }),
        api.get('/hotels', { params: { category } }),
      ])
      setCalls(callRows)
      setHotels(hotelRows)
      if (selectedHotelId !== 'all' && !hotelRows.some(hotel => hotel._id === selectedHotelId)) setSelectedHotelId('all')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [category])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 4200)
    return () => clearTimeout(timer)
  }, [notice])

  const selectHotel = hotelId => {
    setSelectedHotelId(hotelId)
    localStorage.setItem(storageKey, hotelId)
  }
  const selectedHotel = hotels.find(hotel => hotel._id === selectedHotelId)
  const scopedCalls = useMemo(() => selectedHotelId === 'all' ? calls : calls.filter(call => call.hotel?._id === selectedHotelId), [calls, selectedHotelId])
  const counts = useMemo(() => ({
    all: scopedCalls.length,
    pending: scopedCalls.filter(call => call.status === 'pending').length,
    completed: scopedCalls.filter(call => call.status !== 'pending').length,
    followupsOpen: scopedCalls.filter(call => call.status !== 'pending' && call.followUpDone === false).length,
    followupsDone: scopedCalls.filter(call => call.status !== 'pending' && call.followUpDone === true).length,
  }), [scopedCalls])

  const filteredCalls = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return scopedCalls.filter(call => {
      const matchesView = view === 'all'
        || (view === 'pending' && call.status === 'pending')
        || (view === 'completed' && call.status !== 'pending')
        || (view === 'followup-open' && call.status !== 'pending' && call.followUpDone === false)
        || (view === 'followup-done' && call.status !== 'pending' && call.followUpDone === true)
      const matchesOutcome = outcomeFilter === 'all' || (call.status !== 'pending' && call.outcome === outcomeFilter)
      const matchesSearch = !needle || [call.name, call.phone, call.hotel?.name, call.notes].some(value => String(value || '').toLowerCase().includes(needle))
      return matchesView && matchesOutcome && matchesSearch
    }).sort((a, b) => new Date(b.calledAt || b.createdAt) - new Date(a.calledAt || a.createdAt))
  }, [scopedCalls, view, outcomeFilter, search])

  const addLead = async form => {
    await api.post('/calls/leads', { ...form, category })
    setModal(null)
    setNotice('Lead added to this property queue.')
    await fetchData()
  }
  const saveOutcome = async (lead, form) => {
    await api.patch(`/calls/${lead._id}/outcome`, form)
    setModal(null)
    setNotice('Result saved. Caller and time were recorded automatically.')
    await fetchData()
  }
  const removeCall = async lead => {
    if (!confirm(`Delete ${lead.name} from the call log?`)) return
    await api.delete(`/calls/${lead._id}`)
    setCalls(current => current.filter(call => call._id !== lead._id))
  }
  const formatDate = value => formatEasternDateTime(value, { year: undefined })

  return (
    <div>
      <div className={dataStyles.pageHeader}>
        <div><h1 className={dataStyles.pageTitle}>{isReputation ? 'Reputation Calls' : 'Sales Calls'}</h1><p className={dataStyles.pageSubtitle}>Choose a property, work its queue, and log only the result.</p></div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => selectedHotel ? downloadLeadTemplate(category, selectedHotel) : setModal({ type: 'template' })}><Icon name="doc" size={14} /> Hotel template</Button>
          <Button variant="secondary" onClick={() => setModal({ type: 'import' })}><Icon name="arrowIn" size={14} /> Import leads</Button>
          <Button onClick={() => setModal({ type: 'add' })}><Icon name="plus" size={14} /> Add lead</Button>
        </div>
      </div>

      {notice && <div className={styles.notice}><span>✓</span>{notice}</div>}

      <div className={styles.propertyBar}>
        <div className={styles.propertyIcon}><Icon name="building" size={18} /></div>
        <div className={styles.propertyCopy}><span>Working property</span><small>{selectedHotel ? `${selectedHotel.city || 'Hotel'} · ${counts.all} records` : 'Choose one hotel to focus its queue'}</small></div>
        <select value={selectedHotelId} onChange={event => selectHotel(event.target.value)}>
          <option value="all">All hotels</option>
          {hotels.map(hotel => <option key={hotel._id} value={hotel._id}>{hotel.name}{hotel.city ? ` — ${hotel.city}` : ''}</option>)}
        </select>
      </div>

      <div className={styles.metrics}>
        <button className={view === 'pending' ? styles.metricActive : ''} onClick={() => { setView('pending'); setOutcomeFilter('all') }}><span>Ready to call</span><strong>{counts.pending}</strong></button>
        <button className={view === 'completed' ? styles.metricActive : ''} onClick={() => { setView('completed'); setOutcomeFilter('all') }}><span>Completed</span><strong>{counts.completed}</strong></button>
        <button className={view === 'followup-open' ? styles.metricActive : ''} onClick={() => { setView('followup-open'); setOutcomeFilter('all') }}><span>Follow-ups open</span><strong>{counts.followupsOpen}</strong></button>
        <button className={view === 'followup-done' ? styles.metricActive : ''} onClick={() => { setView('followup-done'); setOutcomeFilter('all') }}><span>Follow-ups done</span><strong>{counts.followupsDone}</strong></button>
      </div>

      <div className={dataStyles.card}>
        <div className={styles.toolbar}>
          <div className={dataStyles.searchWrap}><Icon name="search" size={13} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} /><input className={dataStyles.searchInput} placeholder="Search this property…" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select className={styles.compactSelect} value={view} onChange={event => setView(event.target.value)}>
            <option value="pending">To call ({counts.pending})</option><option value="followup-open">Follow-up open ({counts.followupsOpen})</option><option value="followup-done">Follow-up done ({counts.followupsDone})</option><option value="completed">Completed ({counts.completed})</option><option value="all">All records ({counts.all})</option>
          </select>
          <select className={styles.compactSelect} value={outcomeFilter} onChange={event => { setOutcomeFilter(event.target.value); if (event.target.value !== 'all' && view === 'pending') setView('completed') }}>
            <option value="all">All outcomes</option>{OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}
          </select>
          <span className={styles.resultCount}>{filteredCalls.length} shown</span>
          <Button variant="ghost" size="sm" onClick={() => exportToExcel(`${category}-${selectedHotel?.name || 'all'}-calls`, `${isReputation ? 'Reputation' : 'Sales'} Calls`, formatCalls(scopedCalls))}>Export</Button>
        </div>

        <div className={styles.desktopTable}>
          <table className={`${dataStyles.table} ${styles.compactTable} ${selectedHotel ? styles.singleProperty : ''}`}>
            <thead><tr><th>Contact</th><th>Property</th><th>Result</th><th>Follow-up</th><th>Notes & activity</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className={dataStyles.emptyCell}>Loading queue…</td></tr> : filteredCalls.length === 0 ? <tr><td colSpan={6} className={dataStyles.emptyCell}>{view === 'pending' ? 'This property queue is clear.' : 'No calls match these filters.'}</td></tr> : filteredCalls.map(call => (
                <tr key={call._id} className={call.status === 'pending' ? styles.pendingRow : ''}>
                  <td><strong className={styles.leadName}>{call.name}</strong>{call.phone ? <a className={styles.phoneLink} href={`tel:${call.phone}`}>{call.phone}</a> : <span className={styles.phoneLink}>No phone</span>}{call.source === 'import' && <span className={styles.importedTag}>Imported</span>}</td>
                  <td><span className={styles.hotelName}>{call.hotel?.name || '—'}</span>{call.hotel?.city && <small className={styles.cellSub}>{call.hotel.city}</small>}</td>
                  <td><Badge label={call.status === 'pending' ? 'Ready to call' : call.outcome} /></td>
                  <td>{call.status === 'pending' ? <span className={dataStyles.mutedText}>—</span> : call.followUpDone == null ? <span className={dataStyles.mutedText}>Not recorded</span> : <span className={call.followUpDone ? styles.followDone : styles.followOpen}>{call.followUpDone ? 'Done' : 'Not done'}</span>}</td>
                  <td><span className={styles.noteText}>{call.notes || 'No notes'}</span><small className={styles.cellSub}>{call.status === 'pending' ? `Added ${formatDate(call.createdAt)} by ${call.importedBy?.name || '—'}` : `${formatDate(call.calledAt || call.createdAt)} by ${call.loggedBy?.name || '—'}`}</small></td>
                  <td><div className={styles.rowActions}><Button size="sm" onClick={() => setModal({ type: 'outcome', lead: call })}><Icon name={call.status === 'pending' ? 'phone' : 'pen'} size={11} /> {call.status === 'pending' ? 'Log result' : 'Edit'}</Button><Button variant="danger" size="sm" aria-label={`Delete ${call.name}`} onClick={() => removeCall(call)}><Icon name="trash" size={11} /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${dataStyles.mobileCards} ${styles.compactCards}`}>
          {loading ? <div className={dataStyles.mCardEmpty}>Loading queue…</div> : filteredCalls.length === 0 ? <div className={dataStyles.mCardEmpty}>No calls match this view.</div> : filteredCalls.map(call => (
            <div key={call._id} className={dataStyles.mCard} style={{ '--accentColor': call.status === 'pending' ? 'var(--accent)' : statusColor(call.outcome) }}>
              <div className={dataStyles.mCardTop}><div><div className={dataStyles.mCardName}>{call.name}</div><div className={dataStyles.mCardSub}>{call.hotel?.name || 'No hotel'}</div></div><Badge label={call.status === 'pending' ? 'Ready to call' : call.outcome} /></div>
              <div className={dataStyles.mCardBody}><div className={dataStyles.mCardRow}><Icon name="phone" size={13} />{call.phone ? <a href={`tel:${call.phone}`}>{call.phone}</a> : <span>—</span>}</div>{call.status !== 'pending' && <div className={dataStyles.mCardRow}><Icon name="check" size={13} /><span>Follow-up {call.followUpDone === true ? 'done' : call.followUpDone === false ? 'not done' : 'not recorded'}</span></div>}</div>
              {call.notes && <div className={dataStyles.mCardNote}>{call.notes}</div>}
              <div className={dataStyles.mCardActions}><Button size="sm" onClick={() => setModal({ type: 'outcome', lead: call })}><Icon name={call.status === 'pending' ? 'phone' : 'pen'} size={11} /> {call.status === 'pending' ? 'Log result' : 'Edit'}</Button><Button variant="danger" size="sm" onClick={() => removeCall(call)}><Icon name="trash" size={11} /> Delete</Button></div>
            </div>
          ))}
        </div>
      </div>

      {modal?.type === 'add' && <Modal title="Add lead" onClose={() => setModal(null)}><LeadForm hotels={hotels} initialHotel={selectedHotel?._id || ''} onSave={addLead} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === 'outcome' && <Modal title={modal.lead.status === 'pending' ? 'Log call result' : 'Edit call result'} onClose={() => setModal(null)}><OutcomeForm lead={modal.lead} onSave={form => saveOutcome(modal.lead, form)} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === 'template' && <Modal title="Download hotel template" onClose={() => setModal(null)}><TemplateForm category={category} hotels={hotels} initialHotel={selectedHotel?._id || ''} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'import' && <Modal title="Import hotel leads" onClose={() => setModal(null)}><ImportForm category={category} hotels={hotels} initialHotel={selectedHotel?._id || ''} onImported={async result => { await fetchData(); setNotice(`${result.imported} lead${result.imported === 1 ? '' : 's'} added.`) }} onCancel={() => setModal(null)} /></Modal>}
    </div>
  )
}
