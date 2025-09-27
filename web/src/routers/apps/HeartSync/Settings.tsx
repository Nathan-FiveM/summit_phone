import React, { useState } from 'react';
import { fetchNui } from '../../../hooks/fetchNui';

interface UserProfile {
    _id: string;
    citizenId: string;
    name: string;
    age: number;
    ageRangeMin: number;
    ageRangeMax: number;
    maxDistance: number;
    showOnline: boolean;
    premium: boolean;
}

interface SettingsProps {
    userProfile: UserProfile | null;
    onProfileUpdated: (profile: UserProfile) => void;
}

export default function Settings({ userProfile, onProfileUpdated }: SettingsProps) {
    const [settings, setSettings] = useState({
        ageRangeMin: userProfile?.ageRangeMin || 18,
        ageRangeMax: userProfile?.ageRangeMax || 35,
        maxDistance: userProfile?.maxDistance || 25,
        showOnline: userProfile?.showOnline ?? true,
        pushNotifications: true,
        emailNotifications: false
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            const updatedProfile = await fetchNui('heartsync_updateSettings', settings) as UserProfile;
            if (updatedProfile) {
                onProfileUpdated(updatedProfile);
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setLoading(false);
        }
    };

    if (!userProfile) {
        return (
            <div className="settings-container">
                <div className="settings-loading">
                    Loading settings...
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h2>Settings</h2>
                <p>Customize your HeartSync experience</p>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="settings-sections">
                <div className="settings-section">
                    <h3>Discovery Preferences</h3>
                    
                    <div className="setting-item">
                        <label>Age Range</label>
                        <div className="age-range-inputs">
                            <div className="age-input">
                                <label>Min Age</label>
                                <input
                                    type="number"
                                    value={settings.ageRangeMin}
                                    onChange={(e) => setSettings(prev => ({ 
                                        ...prev, 
                                        ageRangeMin: parseInt(e.target.value) 
                                    }))}
                                    min={18}
                                    max={100}
                                />
                            </div>
                            <span className="age-separator">-</span>
                            <div className="age-input">
                                <label>Max Age</label>
                                <input
                                    type="number"
                                    value={settings.ageRangeMax}
                                    onChange={(e) => setSettings(prev => ({ 
                                        ...prev, 
                                        ageRangeMax: parseInt(e.target.value) 
                                    }))}
                                    min={18}
                                    max={100}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="setting-item">
                        <label>Maximum Distance</label>
                        <div className="distance-setting">
                            <input
                                type="range"
                                className="distance-slider"
                                min={1}
                                max={100}
                                value={settings.maxDistance}
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    maxDistance: parseInt(e.target.value) 
                                }))}
                            />
                            <div className="distance-value">
                                {settings.maxDistance}km
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Privacy & Visibility</h3>
                    
                    <div className="setting-item">
                        <div className="toggle-setting">
                            <div className="toggle-info">
                                <label>Show Online Status</label>
                                <p>Let others see when you're active on HeartSync</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={settings.showOnline}
                                    onChange={(e) => setSettings(prev => ({ 
                                        ...prev, 
                                        showOnline: e.target.checked 
                                    }))}
                                />
                                <span className="toggle-slider"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Notifications</h3>
                    
                    <div className="setting-item">
                        <div className="toggle-setting">
                            <div className="toggle-info">
                                <label>Push Notifications</label>
                                <p>Get notified about new matches and messages</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={settings.pushNotifications}
                                    onChange={(e) => setSettings(prev => ({ 
                                        ...prev, 
                                        pushNotifications: e.target.checked 
                                    }))}
                                />
                                <span className="toggle-slider"></span>
                            </div>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="toggle-setting">
                            <div className="toggle-info">
                                <label>Email Notifications</label>
                                <p>Receive weekly match summaries via email</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={settings.emailNotifications}
                                    onChange={(e) => setSettings(prev => ({ 
                                        ...prev, 
                                        emailNotifications: e.target.checked 
                                    }))}
                                />
                                <span className="toggle-slider"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Account Stats</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-number">47</div>
                            <div className="stat-label">Total Matches</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-number">12</div>
                            <div className="stat-label">Conversations</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-number">3</div>
                            <div className="stat-label">Super Likes</div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Support</h3>
                    <div className="support-links">
                        <button className="support-btn">
                            📞 Contact Support
                        </button>
                        <button className="support-btn">
                            ❓ Help Center
                        </button>
                        <button className="support-btn">
                            🔒 Privacy Policy
                        </button>
                        <button className="support-btn">
                            📋 Terms of Service
                        </button>
                    </div>
                </div>

                <div className="settings-section danger-zone">
                    <h3>Danger Zone</h3>
                    <div className="danger-actions">
                        <button className="danger-btn">
                            🗑️ Delete Account
                        </button>
                        <p className="danger-warning">
                            This action cannot be undone. All your matches, messages, and profile data will be permanently deleted.
                        </p>
                    </div>
                </div>
            </div>

            <div className="settings-footer">
                <button 
                    className="save-settings-btn"
                    onClick={handleSaveSettings}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
