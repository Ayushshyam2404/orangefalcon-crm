import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Modal } from '../components/Modal';
import styles from './Groups.module.css';
import { exportToExcel, formatGroups } from '../utils/exportToExcel';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterHotel, setFilterHotel] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [formData, setFormData] = useState({
    groupName: '',
    hotel: '',
    checkIn: '',
    checkOut: '',
    rate: '',
    numRooms: '',
    type: 'pickup',
    creditCardNumber: '',
    cardExpDate: '',
    roomBanquet: 'R',
    banquetCheckInTime: '',
    banquetCheckOutTime: '',
    notes: '',
  });

  // Fetch groups and hotels
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsRes, hotelsRes] = await Promise.all([
          api.get('/groups'),
          api.get('/hotels', { params: { category: 'sales' } }),
        ]);
        setGroups(groupsRes.data);
        setHotels(hotelsRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.groupName || !formData.hotel || !formData.checkIn || !formData.checkOut || !formData.type || !formData.roomBanquet) {
      alert('Please fill in required fields: Group Name, Hotel, Check-in, Check-out, Type, and Room/Banquet');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/groups/${editingId}`, formData);
      } else {
        await api.post('/groups', formData);
      }

      // Refetch groups
      const res = await api.get('/groups');
      setGroups(res.data);
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving group:', err);
      alert('Failed to save group');
    }
  };

  // Handle edit
  const handleEdit = (group) => {
    setFormData({
      groupName: group.groupName,
      hotel: group.hotel ? group.hotel._id : '',
      checkIn: group.checkIn.split('T')[0],
      checkOut: group.checkOut.split('T')[0],
      rate: group.rate || '',
      numRooms: group.numRooms || '',
      type: group.type,
      creditCardNumber: group.creditCardNumber,
      cardExpDate: group.cardExpDate,
      roomBanquet: group.roomBanquet,
      banquetCheckInTime: group.banquetCheckInTime,
      banquetCheckOutTime: group.banquetCheckOutTime,
      notes: group.notes,
    });
    setEditingId(group._id);
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await api.delete(`/groups/${id}`);
        setGroups(groups.filter((g) => g._id !== id));
      } catch (err) {
        console.error('Error deleting group:', err);
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      groupName: '',
      hotel: '',
      checkIn: '',
      checkOut: '',
      rate: '',
      numRooms: '',
      type: 'pickup',
      creditCardNumber: '',
      cardExpDate: '',
      roomBanquet: 'R',
      banquetCheckInTime: '',
      banquetCheckOutTime: '',
      notes: '',
    });
    setEditingId(null);
  };

  // Filter groups
  const filteredGroups = groups.filter((g) => {
    const matchType = filterType === 'all' || g.type === filterType;
    const matchHotel = filterHotel === 'all' || (g.hotel && g.hotel._id === filterHotel);
    const matchSearch = g.groupName.toLowerCase().includes(searchText.toLowerCase());
    return matchType && matchHotel && matchSearch;
  });

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Upcoming Groups</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => exportToExcel('groups-export', 'Groups', formatGroups(groups))}
            style={{ background: 'var(--surface)', color: 'var(--text1)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Export Excel
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }} className={styles.addBtn}>+ Add Group</button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search group name..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={styles.searchInput}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Types</option>
          <option value="pickup">Pickup</option>
          <option value="guaranteed">Guaranteed</option>
        </select>
        <select value={filterHotel} onChange={(e) => setFilterHotel(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Hotels</option>
          {hotels.map((hotel) => (
            <option key={hotel._id} value={hotel._id}>
              {hotel.name}
            </option>
          ))}
        </select>
      </div>

      {/* Groups Table */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Hotel</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Type</th>
            <th>Rooms</th>
            <th>Room Nights</th>
            <th>Rate</th>
            <th>Revenue</th>
            <th>R/B</th>
            <th>Owner</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredGroups.map((group) => (
            <tr key={group._id}>
              <td>{group.groupName}</td>
              <td>{group.hotel ? group.hotel.name : 'N/A'}</td>
              <td>{new Date(group.checkIn).toLocaleDateString()}</td>
              <td>{new Date(group.checkOut).toLocaleDateString()}</td>
              <td><span className={styles.badge} style={{ background: group.type === 'guaranteed' ? '#ff6b6b' : '#51cf66' }}>{group.type}</span></td>
              <td>{group.numRooms || 'N/A'}</td>
              <td>{group.numRoomNights || 'N/A'}</td>
              <td>${group.rate || 'N/A'}</td>
              <td>
                {group.numRoomNights && group.rate
                  ? <span className={styles.revenueCell}>${(group.numRoomNights * group.rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  : <span style={{ color: 'var(--text3)' }}>—</span>
                }
              </td>
              <td>{group.roomBanquet}</td>
              <td style={{ color: 'var(--text2)', fontSize: 12 }}>{group.loggedBy?.name || '—'}</td>
              <td>
                <button onClick={() => handleEdit(group)} className={styles.editBtn}>Edit</button>
                <button onClick={() => handleDelete(group._id)} className={styles.deleteBtn}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => { setShowModal(false); resetForm(); }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>{editingId ? 'Edit Group' : 'Add New Group'}</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <input
                type="text"
                name="groupName"
                placeholder="Group Name *"
                value={formData.groupName}
                onChange={handleFormChange}
                required
              />
              <select name="hotel" value={formData.hotel} onChange={handleFormChange} required>
                <option value="">Select Hotel *</option>
                {hotels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <input
                type="date"
                name="checkIn"
                value={formData.checkIn}
                onChange={handleFormChange}
                required
              />
              <input
                type="date"
                name="checkOut"
                value={formData.checkOut}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className={styles.formRow}>
              <input
                type="number"
                name="numRooms"
                placeholder="Number of Rooms"
                value={formData.numRooms}
                onChange={handleFormChange}
              />
              <input
                type="number"
                name="rate"
                placeholder="Rate per night"
                value={formData.rate}
                onChange={handleFormChange}
              />
            </div>

            {/* Live revenue preview */}
            {(() => {
              const ci = formData.checkIn ? new Date(formData.checkIn) : null
              const co = formData.checkOut ? new Date(formData.checkOut) : null
              const nights = ci && co && co > ci ? Math.ceil((co - ci) / 86400000) : 0
              const rooms = parseFloat(formData.numRooms) || 0
              const rate = parseFloat(formData.rate) || 0
              const revenue = nights * rooms * rate
              if (!nights || !rooms || !rate) return null
              return (
                <div className={styles.revenuePreview}>
                  <span className={styles.revenuePreviewLabel}>Estimated Revenue</span>
                  <span className={styles.revenuePreviewValue}>
                    ${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={styles.revenuePreviewBreakdown}>
                    {nights} night{nights !== 1 ? 's' : ''} × {rooms} room{rooms !== 1 ? 's' : ''} × ${rate}/night
                  </span>
                </div>
              )
            })()}

            <div className={styles.formRow}>
              <select name="type" value={formData.type} onChange={handleFormChange} required>
                <option value="pickup">Pickup Based</option>
                <option value="guaranteed">Guaranteed</option>
              </select>
              <select name="roomBanquet" value={formData.roomBanquet} onChange={handleFormChange} required>
                <option value="R">Room (R)</option>
                <option value="B">Banquet (B)</option>
              </select>
            </div>

            {/* Guaranteed Payment Info */}
            {formData.type === 'guaranteed' && (
              <div className={styles.formRow}>
                <input
                  type="text"
                  name="creditCardNumber"
                  placeholder="Credit Card Number"
                  value={formData.creditCardNumber}
                  onChange={handleFormChange}
                />
                <input
                  type="text"
                  name="cardExpDate"
                  placeholder="Exp Date (MM/YY)"
                  value={formData.cardExpDate}
                  onChange={handleFormChange}
                />
              </div>
            )}

            {/* Banquet Times */}
            {formData.roomBanquet === 'B' && (
              <div className={styles.formRow}>
                <input
                  type="time"
                  name="banquetCheckInTime"
                  value={formData.banquetCheckInTime}
                  onChange={handleFormChange}
                />
                <input
                  type="time"
                  name="banquetCheckOutTime"
                  value={formData.banquetCheckOutTime}
                  onChange={handleFormChange}
                />
              </div>
            )}

            <textarea
              name="notes"
              placeholder="Notes"
              value={formData.notes}
              onChange={handleFormChange}
              rows="3"
            />

            <button type="submit" className={styles.submitBtn}>
              {editingId ? 'Update Group' : 'Add Group'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Groups;
