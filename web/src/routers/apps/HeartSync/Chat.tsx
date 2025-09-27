import React, { useState, useEffect, useRef } from 'react';
import { fetchNui } from '../../../hooks/fetchNui';
import { useNuiEvent } from '../../../hooks/useNuiEvent';

interface UserProfile {
    _id: string;
    citizenId: string;
    name: string;
    age: number;
    photos: string[];
    verified: boolean;
    premium: boolean;
}

interface Match {
    _id: string;
    otherUser: UserProfile;
    matchedAt: string;
    isNewMatch: boolean;
    isSuperLike: boolean;
}

interface Message {
    _id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
}

interface ChatProps {
    match: Match;
    onBack: () => void;
    userProfile: UserProfile | null;
}

export default function Chat({ match, onBack, userProfile }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom function
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'end'
            });
        }
    };

    // Auto-scroll when messages change
    useEffect(() => {
        if (!loading && messages.length > 0) {
            // Small delay to ensure DOM is updated
            setTimeout(scrollToBottom, 100);
        }
    }, [messages, loading]);

    useEffect(() => {
        loadMessages();
    }, [match._id]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const messageData = await fetchNui('heartsync_getMessages', { matchId: match._id }) as Message[];
            setMessages(messageData || []);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const message = await fetchNui('heartsync_sendMessage', {
                matchId: match._id,
                content: newMessage.trim()
            }) as Message;

            if (message) {
                setMessages(prev => [...prev, message]);
                setNewMessage('');
                // Auto-scroll after sending message
                setTimeout(scrollToBottom, 100);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    useNuiEvent('updateHeartSyncMessages', (data: any) => {
        const parsedData = JSON.parse(data);
        setMessages(prev => [...prev, parsedData]);
        // Auto-scroll when receiving new message
        setTimeout(scrollToBottom, 100);
    });

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                }}>
                    <div className="chat-user-info">
                        <div className="chat-avatar">
                            {match.otherUser.photos && match.otherUser.photos.length > 0 ? (
                                <img src={match.otherUser.photos[0]} alt={match.otherUser.name} />
                            ) : (
                                <div className="no-photo-chat">📷</div>
                            )}
                        </div>
                        <div className="user-details">
                            <h3>{match.otherUser.name}</h3>
                            <div className="user-age">{match.otherUser.age} years old</div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                        <button className="back-btn" onClick={onBack}>
                            ← Back
                        </button>
                    </div>
                </div>
            </div>

            <div className="messages-container" ref={messagesContainerRef}>
                {loading ? (
                    <div className="loading-messages">
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="no-messages">
                        <div className="match-celebration">
                            <h3>🎉 You matched with {match.otherUser.name}!</h3>
                            <p>Start the conversation and see where it goes.</p>
                        </div>
                    </div>
                ) : (
                    <div className="messages-list">
                        {messages.map((message, index) => {
                            const isOwn = message.senderId === userProfile?.citizenId;
                            const showDate = index === 0 ||
                                new Date(messages[index - 1].timestamp).toDateString() !==
                                new Date(message.timestamp).toDateString();

                            return (
                                <React.Fragment key={message._id}>
                                    {showDate && (
                                        <div className="date-separator">
                                            <span>
                                                {new Date(message.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`message ${isOwn ? 'own' : 'other'}`}>
                                        <div className="message-content">
                                            <p>{message.content}</p>
                                            <div className="message-time">
                                                {formatTime(message.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        {/* Invisible element for auto-scroll target */}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="message-input-container">
                <form onSubmit={sendMessage} className="message-input">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={`Message ${match.otherUser.name}...`}
                        disabled={sending}
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        className="send-btn"
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? '⏳' : '➤'}
                    </button>
                </form>
            </div>
        </div>
    );
}
