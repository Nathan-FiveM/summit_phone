import React, { useState, useEffect } from 'react';
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
    prompts?: {
        question: string;
        answer: string;
    }[];
    verified: boolean;
    premium: boolean;
    createdAt: string;
    lastActive: string;
}

interface SwipeExploreProps {
    onNewMatch: () => void;
    userProfile: UserProfile | null;
}

export default function SwipeExplore({ onNewMatch, userProfile }: SwipeExploreProps) {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [swiping, setSwiping] = useState(false);
    const [matchModal, setMatchModal] = useState(false);
    const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);

    useEffect(() => {
        loadProfiles();
    }, []);

    // Reset photo index when profile changes
    useEffect(() => {
        setCurrentPhotoIndex(0);
    }, [currentIndex]);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            const potentialMatches = await fetchNui('heartsync_getPotentialMatches') as UserProfile[];
            setProfiles(potentialMatches || []);
            setCurrentIndex(0);
            setCurrentPhotoIndex(0);
        } catch (error) {
            console.error('Error loading profiles:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleSwipe = async (isLike: boolean, isSuperLike: boolean = false) => {
        if (swiping || currentIndex >= profiles.length) return;

        setSwiping(true);
        const currentProfile = profiles[currentIndex];

        try {
            const result = await fetchNui('heartsync_swipeProfile', {
                targetUserId: currentProfile.citizenId,
                isLike,
                isSuperLike
            }) as { success: boolean; isMatch: boolean };

            if (result.success && result.isMatch && isLike) {
                setMatchedUser(currentProfile);
                setMatchModal(true);
                onNewMatch();

                setTimeout(() => {
                    setMatchModal(false);
                    setMatchedUser(null);
                }, 4000);
            }

            setCurrentIndex(prev => prev + 1);

            // Load more profiles if running low
            if (currentIndex >= profiles.length - 3) {
                setTimeout(loadProfiles, 1000);
            }
        } catch (error) {
            console.error('Error swiping:', error);
        } finally {
            setSwiping(false);
        }
    };

    const calculateDistance = (profile: UserProfile) => {
        if (!profile.location || !userProfile?.location) return "Unknown distance";

        // Simple distance calculation (you'd implement actual geolocation logic)
        const distance = Math.floor(Math.random() * 25) + 1; // Mock distance
        return distance < 2 ? "Less than 1km" : `${distance}km away`;
    };

    const getZodiacEmoji = (sign: string) => {
        const zodiacEmojis: { [key: string]: string } = {
            'aries': '♈', 'taurus': '♉', 'gemini': '♊', 'cancer': '♋',
            'leo': '♌', 'virgo': '♍', 'libra': '♎', 'scorpio': '♏',
            'sagittarius': '♐', 'capricorn': '♑', 'aquarius': '♒', 'pisces': '♓'
        };
        return zodiacEmojis[sign?.toLowerCase()] || '✨';
    };

    const nextPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentProfile = profiles[currentIndex];
        if (currentProfile?.photos && currentPhotoIndex < currentProfile.photos.length - 1) {
            setCurrentPhotoIndex(prev => prev + 1);
        }
    };

    const prevPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPhotoIndex > 0) {
            setCurrentPhotoIndex(prev => prev - 1);
        }
    };

    const goToPhoto = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex(index);
    };

    if (loading) {
        return (
            <div className="swipe-explore">
                <div className="swipe-loading">
                    <div className="loading-heart">💖</div>
                    <div>Finding your perfect matches...</div>
                </div>
            </div>
        );
    }

    if (profiles.length === 0 || currentIndex >= profiles.length) {
        return (
            <div className="swipe-explore">
                <div className="no-more-profiles">
                    <div className="empty-stack">
                        <div className="empty-icon">💝</div>
                        <h3>You've seen everyone!</h3>
                        <p>Check back later for fresh faces, or expand your discovery settings to meet more people.</p>
                        <button
                            className="refresh-btn"
                            onClick={loadProfiles}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="swipe-explore">
            <div className="card-stack">
                {profiles.slice(currentIndex, currentIndex + 3).map((profile, index) => {
                    console.log(profile.photos.length);
                    return (
                        <div
                            key={profile._id}
                            className={`profile-card ${index === 0 ? '' : ''}`}
                            style={{
                                position: 'relative'
                            }}
                        >
                            <div className="card-image">
                                {profile.verified && (
                                    <div className="verification-badge">
                                        ✓ Verified
                                    </div>
                                )}
                                {profile.premium && (
                                    <div className="premium-badge">
                                        ✨ Premium
                                    </div>
                                )}

                                {profile.photos && profile.photos.length > 1 ? (
                                    <>
                                        {/* Photo Navigation */}
                                        {profile.photos.length > 0 && (
                                            <>
                                                {/* Previous Photo Button */}
                                                {currentPhotoIndex > 0 && (
                                                    <button
                                                        className="photo-nav-btn photo-prev"
                                                        style={{
                                                            width: '2.5rem',
                                                            height: '2.5rem',
                                                            fontSize: '2rem',
                                                            position: 'absolute',
                                                            top: '0.5rem',
                                                            left: '10px',
                                                            zIndex: 10000000,
                                                            backgroundColor: 'rgba(255, 255, 255, 0.0)',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                        }}
                                                        onClick={prevPhoto}
                                                    >
                                                        ‹
                                                    </button>
                                                )}

                                                {currentPhotoIndex < profile.photos.length - 1 && (
                                                    <button
                                                        className=""
                                                        onClick={nextPhoto}
                                                        style={{
                                                            width: '2.5rem',
                                                            height: '2.5rem',
                                                            fontSize: '2rem',
                                                            position: 'absolute',
                                                            top: '0.5rem',
                                                            right: '10px',
                                                            zIndex: 10000000,
                                                            backgroundColor: 'rgba(255, 255, 255, 0.0)',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                        }}
                                                    >
                                                        ›
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <img
                                            src={profile.photos[currentPhotoIndex]}
                                            alt={profile.name}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = '<div class="no-photo">📷</div>';
                                            }}
                                        />
                                    </>
                                ) : (
                                    <div className="no-photo">📷</div>
                                )}

                                <div className="card-overlay">
                                    <div className="profile-info">
                                        <div className="name-age">
                                            <h2>{profile.name}</h2>
                                            <span className="age">{profile.age}</span>
                                        </div>

                                        <div className="location-work">
                                            {profile.work && (
                                                <div className="work-info">
                                                    💼 {profile.work}
                                                </div>
                                            )}
                                            {profile.school && !profile.work && (
                                                <div className="work-info">
                                                    🎓 {profile.school}
                                                </div>
                                            )}
                                        </div>

                                        <div className="scrollable-content">
                                            {profile.bio && (
                                                <p className="bio">{profile.bio}</p>
                                            )}

                                            <div className="quick-stats">
                                                {profile.height && (
                                                    <div className="stat-item">
                                                        📏 {Math.floor(profile.height / 30.48)}'{Math.round((profile.height % 30.48) / 2.54)}"
                                                    </div>
                                                )}
                                                {profile.zodiacSign && (
                                                    <div className="stat-item">
                                                        {getZodiacEmoji(profile.zodiacSign)} {profile.zodiacSign}
                                                    </div>
                                                )}
                                                {profile.lifestyle?.exercise && (
                                                    <div className="stat-item">
                                                        💪 {profile.lifestyle.exercise}
                                                    </div>
                                                )}
                                                {profile.lifestyle?.pets && profile.lifestyle.pets !== 'none' && (
                                                    <div className="stat-item">
                                                        🐾 {profile.lifestyle.pets}
                                                    </div>
                                                )}
                                            </div>

                                            {profile.interests && profile.interests.length > 0 && (
                                                <div className="interests">
                                                    {profile.interests.map((interest, idx) => (
                                                        <span key={idx} className="interest-tag">
                                                            {interest}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="swipe-actions">
                <button
                    className="action-btn reject-btn"
                    onClick={() => handleSwipe(false)}
                    disabled={swiping}
                    title="Pass"
                >
                    ❌
                </button>

                <button
                    className="action-btn super-like-btn"
                    onClick={() => handleSwipe(true, true)}
                    disabled={swiping}
                    title="Super Like"
                >
                    ⭐
                </button>

                <button
                    className="action-btn like-btn"
                    onClick={() => handleSwipe(true)}
                    disabled={swiping}
                    title="Like"
                >
                    💖
                </button>
            </div>

            {matchModal && matchedUser && (
                <div className="match-modal">
                    <div className="match-content">
                        <div className="confetti-animation">
                            <div className="confetti">🎉</div>
                            <div className="confetti">💖</div>
                            <div className="confetti">✨</div>
                            <div className="confetti">🎊</div>
                            <div className="confetti">💫</div>
                            <div className="confetti">🌟</div>
                            <div className="confetti">💝</div>
                            <div className="confetti">🎈</div>
                            <div className="confetti">🦋</div>
                        </div>

                        <div className="match-celebration">
                            <div className="hearts-explosion">
                                <span className="heart">💖</span>
                                <span className="heart">💕</span>
                                <span className="heart">💗</span>
                                <span className="heart">💓</span>
                                <span className="heart">💝</span>
                            </div>
                        </div>

                        <div className="match-header">
                            <h2>It's a Match!</h2>
                            <p className="match-subtitle">You both swiped right ✨</p>
                        </div>

                        <div className="match-profiles">
                            <div className="match-photos-container">
                                <div className="match-photo user-photo">
                                    {userProfile?.photos?.[0] ? (
                                        <img src={userProfile.photos[0]} alt={userProfile.name} />
                                    ) : (
                                        <div className="photo-placeholder">👤</div>
                                    )}
                                </div>
                                <div className="heart-center">💖</div>
                                <div className="match-photo matched-user-photo">
                                    {matchedUser.photos && matchedUser.photos.length > 0 ? (
                                        <img src={matchedUser.photos[0]} alt={matchedUser.name} />
                                    ) : (
                                        <div className="photo-placeholder">📷</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="match-message">
                            <h3>You and {matchedUser.name} liked each other!</h3>
                            <p>Start a conversation and make a genuine connection 💬</p>
                        </div>

                        <div className="match-actions">
                            <button
                                className="continue-swiping"
                                onClick={() => {
                                    setMatchModal(false);
                                    setMatchedUser(null);
                                }}
                            >
                                Keep Exploring
                            </button>
                            <button
                                className="send-message"
                                onClick={() => {
                                    setMatchModal(false);
                                    setMatchedUser(null);
                                    // Navigation to chat would go here
                                }}
                            >
                                Say Hello 👋
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
