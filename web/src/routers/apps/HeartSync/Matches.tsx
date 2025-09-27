import React, { useState, useEffect } from 'react';
import { fetchNui } from '../../../hooks/fetchNui';
import ConfirmationDialog from '../../../components/ConfirmationDialog';

interface UserProfile {
    _id: string;
    citizenId: string;
    name: string;
    age: number;
    gender: string;
    bio: string;
    photos: string[];
    interests: string[];
    verified: boolean;
    premium: boolean;
    lastActive: string;
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
    unreadCount?: number;
}

interface MatchesProps {
    matches: Match[];
    onMatchSelect: (match: Match) => void;
    onRefresh: () => void;
}

export default function Matches({ matches, onMatchSelect, onRefresh }: MatchesProps) {
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'new' | 'messages' | 'super'>('all');
    const [showUnmatchDialog, setShowUnmatchDialog] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    const filteredMatches = matches.filter(match => {
        const nameMatch = match.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        switch (filterTab) {
            case 'new':
                return nameMatch && match.isNewMatch;
            case 'messages':
                return nameMatch && match.lastMessage;
            case 'super':
                return nameMatch && match.isSuperLike;
            default:
                return nameMatch;
        }
    });

    const handleUnmatch = async (match: Match, event: React.MouseEvent) => {
        event.stopPropagation();
        setSelectedMatch(match);
        setShowUnmatchDialog(true);
    };

    const confirmUnmatch = async () => {
        if (!selectedMatch) return;

        try {
            await fetchNui('heartsync_unmatch', { matchId: selectedMatch._id });
            onRefresh();
        } catch (error) {
            console.error('Error unmatching:', error);
        } finally {
            setShowUnmatchDialog(false);
            setSelectedMatch(null);
        }
    };

    const cancelUnmatch = () => {
        setShowUnmatchDialog(false);
        setSelectedMatch(null);
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await onRefresh();
        } finally {
            setLoading(false);
        }
    };

    if (matches.length === 0) {
        return (
            <div className="matches-container">
                <div className="matches-header">
                    <h2>Messages</h2>
                    <button 
                        className="refresh-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        {loading ? '↻' : '🔄'}
                    </button>
                </div>
                
                <div className="matches-empty">
                    <div className="empty-animation">
                        <div className="floating-hearts">
                            <span className="heart">💖</span>
                            <span className="heart">💕</span>
                            <span className="heart">💗</span>
                        </div>
                    </div>
                    <div className="empty-icon">💬</div>
                    <h3>No matches yet</h3>
                    <p>Start swiping to find your perfect match! When you both like each other, you'll see them here.</p>
                    <button 
                        className="start-swiping-btn"
                        onClick={() => {/* Navigate to explore */}}
                    >
                        Start Exploring 🔥
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="matches-container">

            <div className="matches-filters">
                <button 
                    className={`filter-btn ${filterTab === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterTab('all')}
                >
                    All ({matches.length})
                </button>
                <button 
                    className={`filter-btn ${filterTab === 'new' ? 'active' : ''}`}
                    onClick={() => setFilterTab('new')}
                >
                    New ({matches.filter(m => m.isNewMatch).length})
                </button>
                <button 
                    className={`filter-btn ${filterTab === 'messages' ? 'active' : ''}`}
                    onClick={() => setFilterTab('messages')}
                >
                    Messages ({matches.filter(m => m.lastMessage).length})
                </button>
                <button 
                    className={`filter-btn ${filterTab === 'super' ? 'active' : ''}`}
                    onClick={() => setFilterTab('super')}
                >
                    ⭐ Super ({matches.filter(m => m.isSuperLike).length})
                </button>
            </div>

            <div className="matches-list">
                {filteredMatches.map((match) => (
                    <div 
                        key={match._id}
                        className={`match-item ${match.isNewMatch ? 'new-match' : ''}`}
                        onClick={() => onMatchSelect(match)}
                    >
                        <div className="match-photo">
                            {match.otherUser.photos && match.otherUser.photos.length > 0 ? (
                                <img 
                                    src={match.otherUser.photos[0]} 
                                    alt={match.otherUser.name} 
                                />
                            ) : (
                                <div className="no-photo-small">📷</div>
                            )}
                            
                            
                            
                            
                            {match.otherUser.verified && (
                                <div className="verified-indicator">✓</div>
                            )}
                        </div>

                        <div className="match-info">
                            <div className="match-name">
                                <h4>{match.otherUser.name}</h4>
                                <span className="match-age">{match.otherUser.age}</span>
                                {match.otherUser.premium && (
                                    <span className="premium-icon">✨</span>
                                )}
                            </div>
                            
                            <div className="last-message">
                                {match.lastMessage ? (
                                    <p className={match.unreadCount ? 'unread' : ''}>
                                        {match.lastMessage.length > 50 
                                            ? `${match.lastMessage.substring(0, 50)}...` 
                                            : match.lastMessage
                                        }
                                    </p>
                                ) : match.isNewMatch ? (
                                    <p className="new-match-text">You have a new match! 💖</p>
                                ) : (
                                    <p className="no-messages">Say hello! 👋</p>
                                )}
                            </div>
                        </div>

                        <div className="match-meta">
                            <div className="match-time">
                               
                            </div>
                            
                            <div className="match-actions">
                                <button 
                                    className="action-btn unmatch-btn"
                                    onClick={(e) => handleUnmatch(match, e)}
                                    title="Unmatch"
                                >
                                    ⋯
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredMatches.length === 0 && searchQuery && (
                    <div className="no-search-results">
                        <div className="search-empty-icon">🔍</div>
                        <h3>No matches found</h3>
                        <p>Try searching with a different name</p>
                    </div>
                )}
            </div>

            <div className="matches-footer">
                <p>
                    {filteredMatches.length} of {matches.length} matches shown
                </p>
            </div>

            <ConfirmationDialog
                isOpen={showUnmatchDialog}
                title="Unmatch Confirmation"
                message={`Are you sure you want to unmatch with ${selectedMatch?.otherUser.name}? This action cannot be undone.`}
                confirmText="Yes, Unmatch"
                cancelText="Cancel"
                onConfirm={confirmUnmatch}
                onCancel={cancelUnmatch}
            />
        </div>
    );
}

function getOnlineStatus(lastActive: string): 'online' | 'away' | 'offline' {
    const now = new Date();
    const lastActiveDate = new Date(lastActive);
    const diffMinutes = (now.getTime() - lastActiveDate.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return 'online';
    if (diffMinutes < 60) return 'away';
    return 'offline';
}
