import React, { useState } from 'react';
import { fetchNui } from '../../../hooks/fetchNui';

interface UserProfile {
    _id: string;
    citizenId: string;
    name: string;
    age: number;
    gender: string;
    bio: string;
    photos: string[];
    interests: string[];
    lookingFor: string;
    interestedInGenders: string[];
    ageRangeMin: number;
    ageRangeMax: number;
    maxDistance: number;
    showOnline: boolean;
    location?: {
        lat: number;
        lng: number;
        city: string;
    };
    work?: string;
    school?: string;
    height?: number;
    zodiacSign?: string;
    lifestyle?: {
        smoking: string;
        drinking: string;
        exercise: string;
        pets: string;
    };
    verified: boolean;
    premium: boolean;
    createdAt: string;
    lastActive: string;
    isActive: boolean;
}

interface ProfileProps {
    userProfile: UserProfile | null;
    onProfileCreated: (profile: UserProfile) => void;
    onProfileUpdated: (profile: UserProfile) => void;
}

export default function Profile({ userProfile, onProfileCreated, onProfileUpdated }: ProfileProps) {
    const [isEditing, setIsEditing] = useState(!userProfile);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: userProfile?.name || '',
        age: userProfile?.age || 18,
        gender: userProfile?.gender || '',
        bio: userProfile?.bio || '',
        photos: userProfile?.photos || [''],
        interests: userProfile?.interests || [],
        lookingFor: userProfile?.lookingFor || '',
        interestedInGenders: userProfile?.interestedInGenders || [],
        work: userProfile?.work || '',
        school: userProfile?.school || '',
        height: userProfile?.height || 170,
        zodiacSign: userProfile?.zodiacSign || '',
        lifestyle: {
            smoking: userProfile?.lifestyle?.smoking || '',
            drinking: userProfile?.lifestyle?.drinking || '',
            exercise: userProfile?.lifestyle?.exercise || '',
            pets: userProfile?.lifestyle?.pets || ''
        }
    });

    const availableInterests = [
        'Music', 'Travel', 'Food', 'Sports', 'Movies', 'Books', 'Art', 'Gaming',
        'Photography', 'Hiking', 'Cooking', 'Dancing', 'Fitness', 'Animals',
        'Technology', 'Fashion', 'Cars', 'Nature', 'Comedy', 'Beach'
    ];

    const zodiacSigns = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const profileData = {
                ...formData,
                photos: formData.photos.filter(photo => photo.trim() !== '')
            };

            const result = await fetchNui(
                userProfile ? 'heartsync_updateProfile' : 'heartsync_createProfile',
                profileData
            ) as UserProfile;

            if (result) {
                if (userProfile) {
                    onProfileUpdated(result);
                } else {
                    onProfileCreated(result);
                }
                setIsEditing(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    const handleInterestToggle = (interest: string) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    const addPhotoField = () => {
        if (formData.photos.length < 6) {
            setFormData(prev => ({
                ...prev,
                photos: [...prev.photos, '']
            }));
        }
    };

    const removePhotoField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const updatePhoto = (index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.map((photo, i) => i === index ? value : photo)
        }));
    };

    if (!isEditing && userProfile) {
        return (
            <div className="profile-view">
                <div className="profile-header">
                    <h2>Your Profile</h2>
                    <button 
                        className="edit-profile-btn"
                        onClick={() => setIsEditing(true)}
                    >
                        Edit Profile
                    </button>
                </div>

                <div className="profile-photos">
                    {userProfile.photos && userProfile.photos.length > 0 ? (
                        <div className="photo-grid">
                            {userProfile.photos.map((photo, index) => (
                                <div key={index} className="photo-item">
                                    <img src={photo} alt={`Photo ${index + 1}`} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-photos">
                            <div className="no-photo-icon">📷</div>
                            <p>Add some photos to get more matches!</p>
                        </div>
                    )}
                </div>

                <div className="profile-info">
                    <div className="basic-info">
                        <h2>{userProfile.name}, {userProfile.age}</h2>
                        <div className="gender-info">
                            {userProfile.gender} • Looking for {userProfile.lookingFor}
                        </div>
                        {userProfile.verified && (
                            <div className="verification-status">
                                ✓ Verified Profile
                            </div>
                        )}
                    </div>

                    {userProfile.bio && (
                        <div className="bio-section">
                            <h3>About Me</h3>
                            <p>{userProfile.bio}</p>
                        </div>
                    )}

                    {userProfile.work && (
                        <div className="work-section">
                            <h3>Work</h3>
                            <p>💼 {userProfile.work}</p>
                        </div>
                    )}

                    {userProfile.school && (
                        <div className="school-section">
                            <h3>Education</h3>
                            <p>🎓 {userProfile.school}</p>
                        </div>
                    )}

                    {userProfile.interests && userProfile.interests.length > 0 && (
                        <div className="interests-section">
                            <h3>Interests</h3>
                            <div className="interests-display">
                                {userProfile.interests.map((interest, index) => (
                                    <span key={index} className="interest-tag">
                                        {interest}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="lifestyle-section">
                        <h3>Lifestyle</h3>
                        <div className="lifestyle-grid">
                            {userProfile.height && (
                                <div className="lifestyle-item">
                                    <span className="label">Height:</span>
                                    <span className="value">{Math.floor(userProfile.height/30.48)}'{Math.round((userProfile.height%30.48)/2.54)}"</span>
                                </div>
                            )}
                            {userProfile.zodiacSign && (
                                <div className="lifestyle-item">
                                    <span className="label">Zodiac:</span>
                                    <span className="value">{userProfile.zodiacSign}</span>
                                </div>
                            )}
                            {userProfile.lifestyle?.exercise && (
                                <div className="lifestyle-item">
                                    <span className="label">Exercise:</span>
                                    <span className="value">{userProfile.lifestyle.exercise}</span>
                                </div>
                            )}
                            {userProfile.lifestyle?.smoking && (
                                <div className="lifestyle-item">
                                    <span className="label">Smoking:</span>
                                    <span className="value">{userProfile.lifestyle.smoking}</span>
                                </div>
                            )}
                            {userProfile.lifestyle?.drinking && (
                                <div className="lifestyle-item">
                                    <span className="label">Drinking:</span>
                                    <span className="value">{userProfile.lifestyle.drinking}</span>
                                </div>
                            )}
                            {userProfile.lifestyle?.pets && (
                                <div className="lifestyle-item">
                                    <span className="label">Pets:</span>
                                    <span className="value">{userProfile.lifestyle.pets}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-edit">
            <div className="edit-header">
                <h2>{userProfile ? 'Edit Profile' : 'Create Your Profile'}</h2>
                <p>Show the world who you are</p>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="edit-form">
                <div className="form-group">
                    <label>Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        maxLength={50}
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                </div>

                <div className="form-group">
                    <label>Age *</label>
                    <input
                        type="number"
                        value={formData.age}
                        onChange={(e) => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) }))}
                        min={18}
                        max={100}
                        required
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                </div>

                <div className="form-group">
                    <label>Gender *</label>
                    <div className="gender-selector">
                        {['Man', 'Woman', 'Non-binary', 'Other'].map(gender => (
                            <button
                                key={gender}
                                type="button"
                                className={`gender-btn ${formData.gender === gender ? 'selected' : ''}`}
                                onClick={() => setFormData(prev => ({ ...prev, gender }))}
                            >
                                {gender}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Looking For *</label>
                    <div className="gender-selector">
                        {['Men', 'Women', 'Everyone'].map(looking => (
                            <button
                                key={looking}
                                type="button"
                                className={`gender-btn ${formData.lookingFor === looking ? 'selected' : ''}`}
                                onClick={() => setFormData(prev => ({ ...prev, lookingFor: looking }))}
                            >
                                {looking}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Bio</label>
                    <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Tell people about yourself..."
                        maxLength={500}
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                    <small>{formData.bio.length}/500 characters</small>
                </div>

                <div className="form-group">
                    <label>Photos (up to 6)</label>
                    <div className="photos-edit">
                        {formData.photos.map((photo, index) => (
                            <div key={index} className="photo-input">
                                <input
                                    type="url"
                                    value={photo}
                                    onChange={(e) => updatePhoto(index, e.target.value)}
                                    placeholder="Enter photo URL..."
                                    onFocus={() => fetchNui("disableControls", true)}
                                    onBlur={() => fetchNui("disableControls", false)}
                                />
                                {formData.photos.length > 1 && (
                                    <button
                                        type="button"
                                        className="remove-photo"
                                        onClick={() => removePhotoField(index)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                        {formData.photos.length < 6 && (
                            <button
                                type="button"
                                className="add-photo"
                                onClick={addPhotoField}
                            >
                                + Add Photo
                            </button>
                        )}
                    </div>
                </div>

                <div className="form-group">
                    <label>Work</label>
                    <input
                        type="text"
                        value={formData.work}
                        onChange={(e) => setFormData(prev => ({ ...prev, work: e.target.value }))}
                        placeholder="Your job or company"
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                </div>

                <div className="form-group">
                    <label>School</label>
                    <input
                        type="text"
                        value={formData.school}
                        onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                        placeholder="Your school or university"
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                </div>

                <div className="form-group">
                    <label>Height (cm)</label>
                    <input
                        type="number"
                        value={formData.height}
                        onChange={(e) => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                        min={100}
                        max={250}
                        onFocus={() => fetchNui("disableControls", true)}
                        onBlur={() => fetchNui("disableControls", false)}
                    />
                </div>

                <div className="form-group">
                    <label>Zodiac Sign</label>
                    <select
                        value={formData.zodiacSign}
                        onChange={(e) => setFormData(prev => ({ ...prev, zodiacSign: e.target.value }))}
                    >
                        <option value="">Select your sign</option>
                        {zodiacSigns.map(sign => (
                            <option key={sign} value={sign}>{sign}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Interests (select up to 10)</label>
                    <div className="interests-selector">
                        {availableInterests.map(interest => (
                            <button
                                key={interest}
                                type="button"
                                className={`interest-btn ${formData.interests.includes(interest) ? 'selected' : ''}`}
                                onClick={() => handleInterestToggle(interest)}
                                disabled={!formData.interests.includes(interest) && formData.interests.length >= 10}
                            >
                                {interest}
                            </button>
                        ))}
                    </div>
                    <small>{formData.interests.length}/10 interests selected</small>
                </div>

                <div className="lifestyle-group">
                    <h3>Lifestyle</h3>
                    
                    <div className="form-group">
                        <label>Exercise</label>
                        <select
                            value={formData.lifestyle.exercise}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                lifestyle: { ...prev.lifestyle, exercise: e.target.value }
                            }))}
                        >
                            <option value="">Prefer not to say</option>
                            <option value="Active">Active</option>
                            <option value="Sometimes">Sometimes</option>
                            <option value="Rarely">Rarely</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Smoking</label>
                        <select
                            value={formData.lifestyle.smoking}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                lifestyle: { ...prev.lifestyle, smoking: e.target.value }
                            }))}
                        >
                            <option value="">Prefer not to say</option>
                            <option value="Non-smoker">Non-smoker</option>
                            <option value="Social smoker">Social smoker</option>
                            <option value="Smoker">Smoker</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Drinking</label>
                        <select
                            value={formData.lifestyle.drinking}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                lifestyle: { ...prev.lifestyle, drinking: e.target.value }
                            }))}
                        >
                            <option value="">Prefer not to say</option>
                            <option value="Don't drink">Don't drink</option>
                            <option value="Social drinker">Social drinker</option>
                            <option value="Regular drinker">Regular drinker</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Pets</label>
                        <select
                            value={formData.lifestyle.pets}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                lifestyle: { ...prev.lifestyle, pets: e.target.value }
                            }))}
                        >
                            <option value="">Prefer not to say</option>
                            <option value="Dog lover">Dog lover</option>
                            <option value="Cat lover">Cat lover</option>
                            <option value="Pet lover">Pet lover</option>
                            <option value="No pets">No pets</option>
                        </select>
                    </div>
                </div>

                <div className="form-actions">
                    {userProfile && (
                        <button 
                            type="button" 
                            className="cancel-btn"
                            onClick={() => setIsEditing(false)}
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        type="submit" 
                        className="save-btn"
                        disabled={loading || !formData.name || !formData.gender || !formData.lookingFor}
                    >
                        {loading ? 'Saving...' : userProfile ? 'Update Profile' : 'Create Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
}
