import { useState, useEffect } from "react";
import { fetchNui } from "../../../hooks/fetchNui";
import { usePhone } from "../../../store/store";
import { TweetProfileData } from "../../../../../types/types";
import { Avatar } from "@mantine/core";
import Profile from "./Profile";

export default function FollowersFollowing(props: {
    show: boolean;
    type: 'followers' | 'following';
    userEmail: string;
    onClose: () => void;
    onUserClick: (user: TweetProfileData) => void;
}) {
    const { phoneSettings } = usePhone();
    const [users, setUsers] = useState<TweetProfileData[]>([]);
    const [loading, setLoading] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState('');

    useEffect(() => {
        if (props.show) {
            loadUsers();
        }
    }, [props.show, props.type, props.userEmail]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const callbackName = props.type === 'followers' ? 'pigeon:getFollowers' : 'pigeon:getFollowing';
            const res = await fetchNui(callbackName, props.userEmail);

            if (res && typeof res === 'string') {
                setUsers(JSON.parse(res));
            }
        } catch (error) {
            console.error(`Error loading ${props.type}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (targetUser: TweetProfileData) => {
        try {
            const isFollowing = targetUser.followers.includes(phoneSettings.pigeonIdAttached);
            await fetchNui('followUser', JSON.stringify({
                targetEmail: targetUser.email,
                currentEmail: phoneSettings.pigeonIdAttached,
                follow: !isFollowing
            }));

            // Update local state
            setUsers(prevUsers =>
                prevUsers.map(user =>
                    user.email === targetUser.email
                        ? {
                            ...user,
                            followers: isFollowing
                                ? user.followers.filter(email => email !== phoneSettings.pigeonIdAttached)
                                : [...user.followers, phoneSettings.pigeonIdAttached]
                        }
                        : user
                )
            );
        } catch (error) {
            console.error('Error toggling follow:', error);
        }
    };

    return (
        <div style={{
            display: props.show ? 'flex' : 'none',
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'absolute',
            zIndex: 1,
            backgroundColor: 'black',
        }}>
            {/* Header */}
            <div style={{
                width: '90%',
                display: 'flex',
                alignItems: 'center',
                marginTop: '3.20vh',
                marginBottom: '1.78vh'
            }}>
                <svg onClick={props.onClose} style={{ cursor: 'pointer' }} width="3.89vh" height="1.57vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.7809 1.62449L2.28066 8.49979L7.7809 15.3751C8.12591 15.8064 8.05599 16.4357 7.62473 16.7807C7.19347 17.1257 6.56417 17.0557 6.21916 16.6245L0.568995 9.56178C0.0722991 8.9409 0.0722966 8.05868 0.568995 7.43781L6.21917 0.375098C6.56418 -0.0561646 7.19347 -0.126086 7.62473 0.218925C8.05599 0.563934 8.12591 1.19323 7.7809 1.62449Z" fill="#0A84FF" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M12.7032 12.9998H16.4473C18.252 12.9998 19.3711 12.0682 19.3711 10.5799C19.3711 9.46073 18.5274 8.62284 17.3789 8.53495V8.48807C18.2754 8.35331 18.9668 7.57987 18.9668 6.65409C18.9668 5.35917 17.9707 4.54471 16.3828 4.54471H12.7032V12.9998ZM14.4727 8.06034V5.86307H15.9258C16.752 5.86307 17.2266 6.24979 17.2266 6.92948C17.2266 7.64432 16.6875 8.06034 15.7442 8.06034H14.4727ZM15.9961 11.6814H14.4727V9.22636H15.9551C16.9981 9.22636 17.5664 9.64823 17.5664 10.4392C17.5664 11.2478 17.0157 11.6814 15.9961 11.6814Z" fill="#0A84FF" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M20.5922 11.1951C20.5922 12.326 21.5004 13.0994 22.6957 13.0994C23.4809 13.0994 24.2602 12.7068 24.6118 12.0389H24.6469V12.9998H26.2993V8.68143C26.2993 7.41581 25.2504 6.58378 23.6391 6.58378C21.975 6.58378 20.9379 7.42167 20.8735 8.64042H22.4379C22.52 8.17753 22.9243 7.86112 23.5629 7.86112C24.2075 7.86112 24.6176 8.20096 24.6176 8.7869V9.20292L23.0356 9.29667C21.4711 9.39042 20.5922 10.0525 20.5922 11.1951ZM24.6176 10.6971C24.6176 11.3767 24.0024 11.8631 23.2582 11.8631C22.6782 11.8631 22.2914 11.5701 22.2914 11.1014C22.2914 10.656 22.6547 10.3689 23.2934 10.3221L24.6176 10.24V10.6971Z" fill="#0A84FF" />
                    <path d="M32.1258 9.05643H33.7137C33.6375 7.63261 32.5594 6.58378 30.8602 6.58378C28.9793 6.58378 27.7782 7.83768 27.7782 9.85331C27.7782 11.9041 28.9793 13.1346 30.8719 13.1346C32.5243 13.1346 33.6317 12.1795 33.7196 10.6971H32.1258C32.0203 11.3826 31.575 11.7928 30.8895 11.7928C30.0399 11.7928 29.5125 11.0896 29.5125 9.85331C29.5125 8.64042 30.0399 7.92557 30.8836 7.92557C31.5868 7.92557 32.0262 8.39432 32.1258 9.05643Z" fill="#0A84FF" />
                    <path d="M39.0539 6.71854L36.9211 9.23807H36.8977V4.54471H35.1868V12.9998H36.8977V10.9256L37.343 10.4451L39.1418 12.9998H41.1106L38.5969 9.41386L40.9934 6.71854H39.0539Z" fill="#0A84FF" />
                </svg>
                <div style={{
                    fontSize: '1.42vh',
                    fontWeight: 500,
                    marginLeft: '6.22vh',
                    textTransform: 'capitalize'
                }}>
                    {props.type}
                </div>
            </div>

            {/* Users List */}
            <div style={{
                width: '100%',
                height: '70%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflowY: 'scroll',
                overflowX: 'hidden',
            }}>
                {loading ? (
                    <div style={{ color: 'white', marginTop: '2vh' }}>Loading...</div>
                ) : users.length === 0 ? (
                    <div style={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginTop: '4vh',
                        textAlign: 'center',
                        fontSize: '1.2vh'
                    }}>
                        No {props.type} found
                    </div>
                ) : (
                    users.map((user) => (
                        <div
                            key={user.email}
                            style={{
                                width: '98%',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '1.5vh',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                borderRadius: '0.89vh',
                                marginBottom: '0.89vh',
                                cursor: 'pointer',
                            }}
                            className="clickanimation"
                            onClick={() => {
                                props.onUserClick(user);
                                setShowProfile(true);
                                setSelectedEmail(user.email);
                            }}
                        >
                            <Avatar
                                src={user.avatar || 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'}
                                size="4vh"
                            />
                            <div style={{
                                marginLeft: '1.0vh',
                                flex: 1,
                                minWidth: 0
                            }}>
                                <div style={{
                                    fontSize: '1.3vh',
                                    fontWeight: 500,
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5vh',
                                    marginBottom: '0.3vh'
                                }}>
                                    {user.displayName}
                                    {user.verified && (
                                        <svg width="1.2vh" height="1.2vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                            <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                                        </svg>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '1.1vh',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {user.email}
                                </div>
                                {user.bio && (
                                    <div style={{
                                        fontSize: '1vh',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        marginTop: '0.3vh',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {user.bio}
                                    </div>
                                )}
                            </div>

                            {user.email !== phoneSettings.pigeonIdAttached && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFollowToggle(user);
                                    }}
                                    style={{
                                        backgroundColor: user.followers.includes(phoneSettings.pigeonIdAttached)
                                            ? 'rgba(255, 255, 255, 0.2)'
                                            : '#0A84FF',
                                        border: 'none',
                                        borderRadius: '1.5vh',
                                        padding: '0.5vh 1vh',
                                        color: 'white',
                                        fontSize: '1.1vh',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        minWidth: '6vh',
                                        textAlign: 'center'
                                    }}
                                >
                                    {user.followers.includes(phoneSettings.pigeonIdAttached) ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
            <Profile show={showProfile} email={selectedEmail} onClose={() => {
                setShowProfile(false);
            }} onError={() => {
                setShowProfile(false);
            }} onRetweetClick={() => { }} onLikeClick={() => { }} onReplyClick={() => { }} />
        </div>
    );
}
