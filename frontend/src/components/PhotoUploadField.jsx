import { useRef } from 'react'
import { Icon } from './Icon'

// Small reusable "upload a photo, preview it, remove it" field — used
// wherever a hotel/property photo can be attached (RFPs' Manage Hotels
// modal, Settings' hotel forms). Stores the image as a base64 data URI,
// same pattern as the company logo upload in Settings.
export function PhotoUploadField({ value, onChange, label = 'Property Photo' }) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      alert('Photo must be under 3 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)',
        letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 7,
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: 72, height: 72, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
            background: 'var(--surface2)', border: '1px dashed var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', transition: 'border-color 0.15s',
          }}
        >
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="building" size={22} color="var(--text3)" />
          }
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', padding: '7px 12px',
              fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer',
            }}
          >
            {value ? 'Change photo' : 'Upload photo'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: 11, fontWeight: 600, color: 'var(--red)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              Remove photo
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
