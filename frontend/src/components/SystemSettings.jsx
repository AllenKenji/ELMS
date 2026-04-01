// components/SystemSettings.jsx
import { useState } from 'react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    barangayName: 'Barangay Example',
    notificationsEnabled: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    // TODO: call API to persist settings
    console.log('Saving settings:', settings);
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>System Settings</h3>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
        <label>
          Barangay Name:
          <input
            type="text"
            name="barangayName"
            value={settings.barangayName}
            onChange={handleChange}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="notificationsEnabled"
            checked={settings.notificationsEnabled}
            onChange={handleChange}
          />
          Enable Notifications
        </label>
        <button type="button" onClick={handleSave}>
          Save Settings
        </button>
      </form>
    </div>
  );
}
