import React, { useState, useEffect, useRef } from 'react';
import { usePhone } from '../../../store/store';
import { fetchNui } from '../../../hooks/fetchNui';
import SwipeExplore from './SwipeExplore';
import Matches from './Matches';
import Profile from './Profile';
import Chat from './Chat';
import Settings from './Settings';
import './HeartSync.scss';
import { CSSTransition } from 'react-transition-group';

interface HeartSyncProps {
    onEnter: () => void;
    onExit: () => void;
}

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
    prompts?: {
        question: string;
        answer: string;
    }[];
    verified: boolean;
    premium: boolean;
    superLikesRemaining: number;
    likesRemaining: number;
    createdAt: string;
    lastActive: string;
    isActive: boolean;
}

interface Match {
    _id: string;
    user1Id: string;
    user2Id: string;
    matchedAt: string;
    isActive: boolean;
    otherUser: UserProfile;
    lastMessage?: string;
    lastMessageTime: string;
    isNewMatch: boolean;
    isSuperLike: boolean;
}

export default function HeartSync({ onEnter, onExit }: HeartSyncProps) {
    const { location, setLocation } = usePhone();
    const nodeRef = useRef(null);
    const [currentView, setCurrentView] = useState<'explore' | 'discovery' | 'matches' | 'profile' | 'chat' | 'settings' | 'superlikes'>('explore');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [hasProfile, setHasProfile] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState({
        newMatches: 0,
        newMessages: 0,
        superLikes: 0,
    });

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            console.log('Loading profile...');
            const profile = await fetchNui('heartsync_getProfile') as UserProfile | null;
            console.log('Profile loaded:', profile);
            if (profile) {
                setUserProfile(profile);
                setHasProfile(true);
                loadMatches();
            } else {
                setHasProfile(false);
                setCurrentView('profile');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            setHasProfile(false);
        } finally {
            setLoading(false);
        }
    };

    const loadMatches = async () => {
        try {
            const matchesData = await fetchNui('heartsync_getMatches', "Ok") as Match[];
            setMatches(matchesData || []);
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const notificationData = await fetchNui('heartsync_getNotifications') as any;
            setNotifications(notificationData || { newMatches: 0, newMessages: 0, superLikes: 0 });
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    };

    const handleProfileCreated = (profile: UserProfile) => {
        setUserProfile(profile);
        setHasProfile(true);
        setCurrentView('explore');
    };

    const handleMatchSelected = (match: Match) => {
        setSelectedMatch(match);
        setCurrentView('chat');
    };

    const handleBackToMatches = () => {
        setSelectedMatch(null);
        setCurrentView('matches');
        loadMatches(); // Refresh matches
    };

    const handleNewMatch = () => {
        loadMatches(); // Refresh matches when new match is made
        loadNotifications(); // Update notifications
    };

    const handleViewChange = (view: string) => {
        setCurrentView(view as any);
        if (view === 'matches') {
            loadMatches();
        }
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'heartsync'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                onEnter();
                await loadUserProfile();
                await loadNotifications();
            }}
            onExited={() => {
                onExit();
            }}
        >
            <div className="heartsync-app" ref={nodeRef}>
                {loading ? <div className="heartsync-loading">
                    <div className="loading-animation">
                        <div className="loading-heart">💖</div>
                        <div className="loading-pulse"></div>
                    </div>
                    <div className="loading-text">Connecting Hearts...</div>
                    <div className="loading-subtitle">Preparing your perfect matches</div>
                </div> : <>
                    <div className="heartsync-header" style={{ padding: '0' }}>
                        <div className="header-logo" style={{ marginTop: '1.2rem' }}>
                            <span className="logo-gradient">💖</span>
                            <span className="logo-text">HeartSync</span>
                            {userProfile?.premium && (
                                <span className="premium-badge">✨</span>
                            )}
                        </div>
                    </div>
                    <div className="heartsync-content">
                        {currentView === 'explore' && hasProfile && (
                            <SwipeExplore
                                onNewMatch={handleNewMatch}
                                userProfile={userProfile}
                            />
                        )}

                        {currentView === 'matches' && hasProfile && (
                            <Matches
                                matches={matches}
                                onMatchSelect={handleMatchSelected}
                                onRefresh={loadMatches}
                            />
                        )}

                        {currentView === 'profile' && (
                            <Profile
                                userProfile={userProfile}
                                onProfileCreated={handleProfileCreated}
                                //@ts-ignore
                                onProfileUpdated={setUserProfile}
                            />
                        )}

                        {currentView === 'chat' && selectedMatch && (
                            <Chat
                                match={selectedMatch}
                                onBack={handleBackToMatches}
                                userProfile={userProfile}
                            />
                        )}

                        {currentView === 'settings' && hasProfile && (
                            <Settings
                                userProfile={userProfile}
                                //@ts-ignore
                                onProfileUpdated={setUserProfile}
                            />
                        )}
                    </div>
                    <div className="heartsync-header">
                        {hasProfile && (
                            <div className="header-nav">
                                <button
                                    className={`nav-btn ${currentView === 'explore' ? 'active' : ''}`}
                                    onClick={() => handleViewChange('explore')}
                                >
                                    <span className="nav-icon">🔥</span>
                                    <span className="nav-label">Explore</span>
                                </button>
                                <button
                                    className={`nav-btn ${currentView === 'matches' ? 'active' : ''}`}
                                    onClick={() => handleViewChange('matches')}
                                >
                                    <span className="nav-icon">💬</span>
                                    <span className="nav-label">Messages</span>
                                </button>
                                <button
                                    className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                                    onClick={() => handleViewChange('profile')}
                                >
                                    <span className="nav-icon">👤</span>
                                    <span className="nav-label">Profile</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>}
            </div>
        </CSSTransition>
    );
}
