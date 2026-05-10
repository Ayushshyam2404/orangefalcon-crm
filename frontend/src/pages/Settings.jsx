import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Modal } from '../components/Modal';
import styles from './Settings.module.css';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return { theme, toggle }
}

const Settings = () => {
  const [activeTab, setActiveTab] = useState('hotels');
  const { theme, toggle: toggleTheme } = useTheme();
  const [hotels, setHotels] = useState([]);
  const [repHotels, setRepHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [hotelForm, setHotelForm] = useState({ name: '', city: '', category: 'sales' });
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'staff', title: '' });
  const [credentialsInfo, setCredentialsInfo] = useState(null); // { username, tempPassword }

  // Company settings state
  const [companyForm, setCompanyForm] = useState({
    companyName: 'Orange Falcon',
    logo: '',
    expectedClockIn: '09:00',
    expectedHoursPerDay: 8,
    expectedDaysPerWeek: 5,
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  // Report recipients state
  const [reportRecipients, setReportRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [recipientSaving, setRecipientSaving] = useState(false);
  const [recipientSaved, setRecipientSaved] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  // Backup & Restore state
  const [exporting, setExporting] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { ok, message, results, warnings }

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hotelsRes, usersRes, companyRes, repHotelsRes] = await Promise.all([
          api.get('/hotels', { params: { category: 'sales' } }),
          api.get('/users'),
          api.get('/company-settings'),
          api.get('/hotels', { params: { category: 'reputation' } }),
        ]);
        setHotels(hotelsRes.data);
        setRepHotels(repHotelsRes.data);
        setUsers(usersRes.data);
        const cs = companyRes.data;
        setCompanyForm({
          companyName:         cs.companyName         || 'Orange Falcon',
          logo:                cs.logo                || '',
          expectedClockIn:     cs.expectedClockIn     || '09:00',
          expectedHoursPerDay: cs.expectedHoursPerDay || 8,
          expectedDaysPerWeek: cs.expectedDaysPerWeek || 5,
        });
        setLogoPreview(cs.logo || '');
        setReportRecipients(cs.reportRecipients || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target.result);
      setCompanyForm(f => ({ ...f, logo: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleCompanySave = async (e) => {
    e.preventDefault();
    setCompanySaving(true);
    try {
      await api.put('/company-settings', companyForm);
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
    } catch (err) {
      console.error('Error saving company settings:', err);
      alert('Failed to save company settings');
    } finally {
      setCompanySaving(false);
    }
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address');
      return;
    }
    if (reportRecipients.includes(email)) {
      alert('This email is already in the list');
      return;
    }
    setReportRecipients(r => [...r, email]);
    setNewRecipient('');
  };

  const handleRemoveRecipient = (email) => {
    setReportRecipients(r => r.filter(e => e !== email));
  };

  const handleSaveRecipients = async () => {
    setRecipientSaving(true);
    try {
      await api.put('/company-settings', { reportRecipients });
      setRecipientSaved(true);
      setTimeout(() => setRecipientSaved(false), 3000);
    } catch (err) {
      console.error('Error saving recipients:', err);
      alert('Failed to save recipients');
    } finally {
      setRecipientSaving(false);
    }
  };

  const handleSendReport = async () => {
    if (!window.confirm('Send the full backup report now?')) return;
    setSendingReport(true);
    try {
      await api.post('/report/send');
      alert('Report sent successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send report');
    } finally {
      setSendingReport(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `crm-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    const confirmed = window.confirm(
      '⚠️ DANGER: This will ERASE all current data and replace it with the contents of this backup file.\n\nThis cannot be undone. Are you absolutely sure?'
    );
    if (!confirmed) return;
    const doubleConfirmed = window.confirm(
      'Final confirmation — all existing data will be permanently deleted and replaced. Proceed?'
    );
    if (!doubleConfirmed) return;

    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const res = await api.post('/backup/restore', parsed, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      setRestoreResult({ ok: true, message: res.data.message, results: res.data.results, warnings: res.data.warnings });
      setRestoreFile(null);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Restore failed';
      setRestoreResult({ ok: false, message: msg });
    } finally {
      setRestoring(false);
    }
  };

  // Handle hotel submit
  const handleHotelSubmit = async (e) => {
    e.preventDefault();
    if (!hotelForm.name || !hotelForm.city) {
      alert('Hotel name and city are required');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/hotels/${editingId}`, hotelForm);
      } else {
        await api.post('/hotels', hotelForm);
      }
      const [salesRes, repRes] = await Promise.all([
        api.get('/hotels', { params: { category: 'sales' } }),
        api.get('/hotels', { params: { category: 'reputation' } }),
      ]);
      setHotels(salesRes.data);
      setRepHotels(repRes.data);
      setShowModal(false);
      setHotelForm({ name: '', city: '', category: 'sales' });
      setEditingId(null);
    } catch (err) {
      console.error('Error saving hotel:', err);
      alert('Failed to save hotel');
    }
  };

  // Handle user submit
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.username) {
      alert('Name and username are required');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, userForm);
      } else {
        // Password is optional — backend auto-generates if blank
        const res = await api.post('/users', userForm);
        if (res.data.tempPassword) {
          setCredentialsInfo({
            username: res.data.username,
            tempPassword: res.data.tempPassword,
          });
        }
      }
      const res = await api.get('/users');
      setUsers(res.data);
      setShowModal(false);
      setUserForm({ name: '', username: '', password: '', role: 'staff', title: '' });
      setEditingId(null);
    } catch (err) {
      console.error('Error saving user:', err);
      alert(err.response?.data?.message || 'Failed to save user');
    }
  };

  // Handle edit hotel
  const handleEditHotel = (hotel) => {
    setHotelForm({ name: hotel.name, city: hotel.city, category: hotel.category || 'sales' });
    setEditingId(hotel._id);
    setModalType('hotel');
    setShowModal(true);
  };

  // Handle edit user
  const handleEditUser = (user) => {
    setUserForm({ name: user.name, username: user.username, password: '', role: user.role, title: user.title || '' });
    setEditingId(user._id);
    setModalType('user');
    setShowModal(true);
  };

  // Handle delete hotel
  const handleDeleteHotel = async (id) => {
    if (window.confirm('Delete this hotel?')) {
      try {
        await api.delete(`/hotels/${id}`);
        setHotels(hotels.filter((h) => h._id !== id));
        setRepHotels(repHotels.filter((h) => h._id !== id));
      } catch (err) {
        console.error('Error deleting hotel:', err);
      }
    }
  };

  // Handle delete user
  const handleDeleteUser = async (id) => {
    if (window.confirm('Delete this user?')) {
      try {
        await api.delete(`/users/${id}`);
        setUsers(users.filter((u) => u._id !== id));
      } catch (err) {
        console.error('Error deleting user:', err);
      }
    }
  };

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Settings</h2>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'hotels' ? styles.active : ''}`}
          onClick={() => setActiveTab('hotels')}
        >
          Sales Hotels
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'rephotels' ? styles.active : ''}`}
          onClick={() => setActiveTab('rephotels')}
        >
          Reputation Hotels
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'appearance' ? styles.active : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          Appearance
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'company' ? styles.active : ''}`}
          onClick={() => setActiveTab('company')}
        >
          Company
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report Recipients
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'backup' ? styles.active : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          Backup &amp; Restore
        </button>
      </div>

      {/* Hotels Tab */}
      {activeTab === 'hotels' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Manage Sales Hotels</h3>
            <button
              onClick={() => {
                setHotelForm({ name: '', city: '', category: 'sales' });
                setEditingId(null);
                setModalType('hotel');
                setShowModal(true);
              }}
              className={styles.addBtn}
            >
              + Add Hotel
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hotel Name</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel._id}>
                  <td>{hotel.name}</td>
                  <td>{hotel.city}</td>
                  <td>
                    <button onClick={() => handleEditHotel(hotel)} className={styles.editBtn}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteHotel(hotel._id)} className={styles.deleteBtn}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reputation Hotels Tab */}
      {activeTab === 'rephotels' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Manage Reputation Hotels</h3>
            <button
              onClick={() => {
                setHotelForm({ name: '', city: '', category: 'reputation' });
                setEditingId(null);
                setModalType('hotel');
                setShowModal(true);
              }}
              className={styles.addBtn}
            >
              + Add Hotel
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hotel Name</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {repHotels.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No reputation hotels added yet.</td></tr>
              ) : repHotels.map((hotel) => (
                <tr key={hotel._id}>
                  <td>{hotel.name}</td>
                  <td>{hotel.city}</td>
                  <td>
                    <button onClick={() => handleEditHotel(hotel)} className={styles.editBtn}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteHotel(hotel._id)} className={styles.deleteBtn}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Manage Users</h3>
            <button
              onClick={() => {
                setUserForm({ name: '', username: '', password: '', role: 'staff' });
                setEditingId(null);
                setModalType('user');
                setShowModal(true);
              }}
              className={styles.addBtn}
            >
              + Add User
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Title</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.title || '—'}</td>
                  <td>
                    <span className={styles.role} data-role={user.role}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleEditUser(user)} className={styles.editBtn}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteUser(user._id)} className={styles.deleteBtn}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Appearance</h3>
          </div>
          <div className={styles.appearanceCard}>
            <div className={styles.appearanceRow}>
              <div>
                <div className={styles.appearanceLabel}>Theme</div>
                <div className={styles.appearanceHint}>
                  {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
                </div>
              </div>
              <button
                className={`${styles.themeToggle} ${theme === 'light' ? styles.themeToggleLight : ''}`}
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                <span className={styles.themeToggleThumb} />
              </button>
            </div>
            <div className={styles.themePreviews}>
              <div
                className={`${styles.themePreview} ${styles.themePreviewDark} ${theme === 'dark' ? styles.themePreviewActive : ''}`}
                onClick={() => { if (theme !== 'dark') toggleTheme() }}
              >
                <div className={styles.previewDots}>
                  <span /><span /><span />
                </div>
                <div className={styles.previewLines}>
                  <span style={{ width: '70%' }} />
                  <span style={{ width: '50%' }} />
                  <span style={{ width: '60%' }} />
                </div>
                <div className={styles.previewLabel}>Dark</div>
              </div>
              <div
                className={`${styles.themePreview} ${styles.themePreviewLight} ${theme === 'light' ? styles.themePreviewActive : ''}`}
                onClick={() => { if (theme !== 'light') toggleTheme() }}
              >
                <div className={styles.previewDots}>
                  <span /><span /><span />
                </div>
                <div className={styles.previewLines}>
                  <span style={{ width: '70%' }} />
                  <span style={{ width: '50%' }} />
                  <span style={{ width: '60%' }} />
                </div>
                <div className={styles.previewLabel}>Light</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Company Settings</h3>
          </div>
          <form onSubmit={handleCompanySave} className={styles.companyForm}>

            {/* Logo Section */}
            <div className={styles.companySection}>
              <div className={styles.companySectionTitle}>CRM Logo</div>
              <div className={styles.logoUploadRow}>
                <div className={styles.logoPreviewBox}>
                  {logoPreview
                    ? <img src={logoPreview} alt="Company logo" className={styles.logoPreviewImg} />
                    : <span className={styles.logoPlaceholder}>No logo set</span>
                  }
                </div>
                <div className={styles.logoUploadRight}>
                  <p className={styles.logoHint}>Upload a logo image (PNG, JPG, SVG). Recommended 256×256 px. Max 2 MB.</p>
                  <label className={styles.logoUploadBtn}>
                    Choose File
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.hiddenInput}
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      className={styles.logoRemoveBtn}
                      onClick={() => { setLogoPreview(''); setCompanyForm(f => ({ ...f, logo: '' })); }}
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Company Name */}
            <div className={styles.companySection}>
              <div className={styles.companySectionTitle}>Company Name</div>
              <input
                type="text"
                className={styles.companyInput}
                value={companyForm.companyName}
                onChange={e => setCompanyForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="e.g. Orange Falcon"
                maxLength={60}
              />
            </div>

            {/* Work Timings */}
            <div className={styles.companySection}>
              <div className={styles.companySectionTitle}>Work Timings</div>
              <p className={styles.companySectionHint}>Used to calculate attendance rates and punctuality in behaviour reports.</p>
              <div className={styles.timingGrid}>
                <div className={styles.timingItem}>
                  <label className={styles.timingLabel}>Expected Clock-In</label>
                  <input
                    type="time"
                    className={styles.companyInput}
                    value={companyForm.expectedClockIn}
                    onChange={e => setCompanyForm(f => ({ ...f, expectedClockIn: e.target.value }))}
                  />
                </div>
                <div className={styles.timingItem}>
                  <label className={styles.timingLabel}>Expected Hours / Day</label>
                  <input
                    type="number"
                    className={styles.companyInput}
                    min={1} max={24} step={0.5}
                    value={companyForm.expectedHoursPerDay}
                    onChange={e => setCompanyForm(f => ({ ...f, expectedHoursPerDay: parseFloat(e.target.value) || 8 }))}
                  />
                </div>
                <div className={styles.timingItem}>
                  <label className={styles.timingLabel}>Working Days / Week</label>
                  <input
                    type="number"
                    className={styles.companyInput}
                    min={1} max={7} step={1}
                    value={companyForm.expectedDaysPerWeek}
                    onChange={e => setCompanyForm(f => ({ ...f, expectedDaysPerWeek: parseInt(e.target.value, 10) || 5 }))}
                  />
                </div>
              </div>
            </div>

            <div className={styles.companySaveRow}>
              <button type="submit" className={styles.submitBtn} disabled={companySaving}>
                {companySaving ? 'Saving…' : 'Save Company Settings'}
              </button>
              {companySaved && <span className={styles.savedMsg}>✓ Saved successfully</span>}
            </div>
          </form>
        </div>
      )}

      {/* Report Recipients Tab */}
      {activeTab === 'report' && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h3>Report Recipients</h3>
          </div>
          <p className={styles.companySectionHint} style={{ marginBottom: '20px' }}>
            The nightly full backup report is emailed to everyone on this list at 11 PM ET. You can also trigger it manually below.
          </p>

          {/* Recipient list */}
          <div className={styles.recipientList}>
            {reportRecipients.length === 0 && (
              <div className={styles.recipientEmpty}>
                No recipients configured. Add at least one email below.
              </div>
            )}
            {reportRecipients.map(email => (
              <div key={email} className={styles.recipientRow}>
                <span className={styles.recipientEmail}>{email}</span>
                <button
                  type="button"
                  className={styles.recipientRemove}
                  onClick={() => handleRemoveRecipient(email)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add new recipient */}
          <div className={styles.recipientAddRow}>
            <input
              type="email"
              className={styles.companyInput}
              placeholder="name@example.com"
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
            />
            <button type="button" className={styles.addBtn} onClick={handleAddRecipient}>
              + Add
            </button>
          </div>

          <div className={styles.companySaveRow} style={{ marginTop: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSaveRecipients}
              disabled={recipientSaving}
            >
              {recipientSaving ? 'Saving…' : 'Save Recipients'}
            </button>
            {recipientSaved && <span className={styles.savedMsg}>✓ Saved</span>}
            <button
              type="button"
              className={styles.sendReportBtnSettings}
              onClick={handleSendReport}
              disabled={sendingReport}
            >
              {sendingReport ? 'Sending…' : 'Send Report Now'}
            </button>
          </div>
        </div>
      )}

      {/* Backup & Restore Tab */}
      {activeTab === 'backup' && (
        <div className={styles.content}>
          {/* ── Export ── */}
          <div className={styles.backupSection}>
            <div className={styles.backupSectionHeader}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: 'var(--accent)' }}>
                <path d="M10 2v10M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Download Backup</h3>
            </div>
            <p className={styles.backupHint}>
              Exports every collection — users, hotels, RFPs, calls, leads, tasks, attendance logs, and more — into a single human-readable <code>.json</code> file.
              Keep this file somewhere safe. You can use it to restore the entire database at any time.
            </p>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Preparing download…' : 'Download Backup (.json)'}
            </button>
          </div>

          <div className={styles.backupDivider} />

          {/* ── Restore ── */}
          <div className={styles.backupSection}>
            <div className={styles.backupSectionHeader}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#ef4444' }}>
                <path d="M3 10a7 7 0 107-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M3 4v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 style={{ color: '#ef4444' }}>Restore from Backup</h3>
            </div>
            <div className={styles.restoreWarning}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10 2L2 17h16L10 2z" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
                <path d="M10 8v4M10 13v1" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>
                <strong>Danger zone.</strong> Uploading a backup will <strong>permanently erase all current data</strong> and replace it with the backup contents.
                This cannot be undone. Only proceed if you are recovering from data loss.
              </span>
            </div>

            {/* File drop zone */}
            <label className={styles.dropZone}>
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={e => { setRestoreFile(e.target.files[0] || null); setRestoreResult(null); }}
              />
              {restoreFile ? (
                <div className={styles.dropZoneSelected}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4a2 2 0 012-2h6l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                    <path d="M12 2v4h4" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                  </svg>
                  <span>{restoreFile.name}</span>
                  <button
                    type="button"
                    className={styles.dropZoneClear}
                    onClick={e => { e.preventDefault(); setRestoreFile(null); setRestoreResult(null); }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className={styles.dropZoneEmpty}>
                  <svg width="28" height="28" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                    <path d="M4 4a2 2 0 012-2h6l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    <path d="M12 2v4h4M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                  </svg>
                  <span>Click to select backup <code>.json</code> file</span>
                </div>
              )}
            </label>

            <button
              type="button"
              className={styles.resetBtn}
              onClick={handleRestore}
              disabled={!restoreFile || restoring}
            >
              {restoring ? 'Restoring…' : 'RESET — Restore from Backup'}
            </button>

            {/* Result feedback */}
            {restoreResult && (
              <div className={restoreResult.ok ? styles.restoreSuccess : styles.restoreError}>
                <strong>{restoreResult.ok ? '✓ ' : '✕ '}{restoreResult.message}</strong>
                {restoreResult.ok && restoreResult.results && (
                  <div className={styles.restoreResults}>
                    {Object.entries(restoreResult.results).map(([col, msg]) => (
                      <div key={col} className={styles.restoreResultRow}>
                        <span className={styles.restoreCol}>{col}</span>
                        <span>{msg}</span>
                      </div>
                    ))}
                    {restoreResult.warnings?.length > 0 && (
                      <div className={styles.restoreResultRow} style={{ marginTop: 8, color: '#f59e0b' }}>
                        {restoreResult.warnings.map((w, i) => <div key={i}>{w}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h3>{modalType === 'hotel' ? (editingId ? 'Edit Hotel' : 'Add Hotel') : editingId ? 'Edit User' : 'Add User'}</h3>
          <form onSubmit={modalType === 'hotel' ? handleHotelSubmit : handleUserSubmit} className={styles.form}>
            {modalType === 'hotel' ? (
              <>
                <input
                  type="text"
                  placeholder="Hotel Name *"
                  value={hotelForm.name}
                  onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="City *"
                  value={hotelForm.city}
                  onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })}
                  required
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Name *"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Username *"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Job Title / Position"
                  value={userForm.title}
                  onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Password *"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!editingId}
                />
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </>
            )}
            <button type="submit" className={styles.submitBtn}>
              {editingId ? 'Update' : 'Add'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Credentials dialog — shown once after user creation ── */}
      {credentialsInfo && (
        <Modal onClose={() => setCredentialsInfo(null)}>
          <div className={styles.credHeader}>
            <div className={styles.credIcon}>✓</div>
            <h3 className={styles.credTitle}>User Created Successfully</h3>
            <p className={styles.credHint}>
              Share these one-time credentials with <strong>{credentialsInfo.username}</strong>.
              They will be asked to set a new password on first login.
            </p>
          </div>
          <div className={styles.credField}>
            <span className={styles.credLabel}>Username</span>
            <div className={styles.credValue}>
              <code>{credentialsInfo.username}</code>
              <button
                className={styles.credCopy}
                onClick={() => { navigator.clipboard.writeText(credentialsInfo.username); }}
                title="Copy username"
              >
                Copy
              </button>
            </div>
          </div>
          <div className={styles.credField}>
            <span className={styles.credLabel}>Temporary Password</span>
            <div className={styles.credValue}>
              <code>{credentialsInfo.tempPassword}</code>
              <button
                className={styles.credCopy}
                onClick={() => { navigator.clipboard.writeText(credentialsInfo.tempPassword); }}
                title="Copy password"
              >
                Copy
              </button>
            </div>
          </div>
          <div className={styles.credBoth}>
            <button
              className={styles.credCopyBoth}
              onClick={() => {
                navigator.clipboard.writeText(
                  `Username: ${credentialsInfo.username}\nPassword: ${credentialsInfo.tempPassword}`
                );
              }}
            >
              Copy Both
            </button>
            <span className={styles.credWarning}>⚠ This password won't be shown again</span>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Settings;
