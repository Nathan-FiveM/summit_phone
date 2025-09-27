import { Avatar, Button, Textarea, TextInput, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { usePhone } from "../../../store/store";
import { useEffect, useState } from "react";
import { TweetData, TweetProfileData } from "../../../../../types/types";
import InputDialog from "../DarkChat/InputDialog";
import dayjs from "dayjs";
import InfiniteScroll from "react-infinite-scroll-component";
import 'react-responsive-modal/styles.css';
import { Modal } from 'react-responsive-modal';

export default function Profile(props: {
    show: boolean,
    email: string,
    onClose: () => void,
    onError: () => void,
    onReplyClick: (tweet: TweetData) => void,
    onRetweetClick: (tweet: TweetData) => void,
    onLikeClick: (tweet: TweetData) => void,
    onFollowersClick?: (userEmail: string) => void,
    onFollowingClick?: (userEmail: string) => void,
    onMessageClick?: (user: TweetProfileData) => void
}) {
    const { phoneSettings, location, setLocation, setPhoneSettings } = usePhone();
    const [profileData, setProfileData] = useState<TweetProfileData>({
        _id: '',
        email: '',
        password: '',
        displayName: '',
        avatar: '',
        banner: '',
        verified: false,
        notificationsEnabled: false,
        createdAt: '',
        bio: '',
        followers: [],
        following: [],
    });
    const [imgContainer, setOpenImgContainer] = useState(false);
    const [selectedImg, setSelectedImg] = useState<string | null>(null);
    const onCloseModal = () => {
        setOpenImgContainer(false);
        setSelectedImg(null);
    };
    const [tweets, setTweets] = useState<TweetData[]>([]);
    const [hasMore] = useState(true);
    function formatedDate(date: string) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const newDate = new Date(date);
        const timeDiff = today.getTime() - newDate.getTime();
        if (newDate > yesterday && timeDiff < 900000) {
            return 'Just Now';
        } else if (newDate > yesterday && timeDiff < 3600000) {
            return `${Math.floor(timeDiff / 60000)} minutes ago`;
        } else if (newDate > yesterday && timeDiff < 7200000) {
            return '1 hour ago';
        } else if (newDate > yesterday && timeDiff < 86400000) {
            return `${Math.floor(timeDiff / 3600000)} hours ago`;
        } else if (newDate > yesterday) {
            return 'Yesterday';
        } else {
            return `${newDate.getDate().toString().padStart(2, '0')}/${(newDate.getMonth() + 1).toString().padStart(2, '0')}/${newDate.getFullYear()}`;
        }
    };

    const [filter, setFilter] = useState('post');

    useEffect(() => {
        async function fetUserTweets() {
            const res = await fetchNui('getUserTweets', props.email);
            setTweets(JSON.parse(res as string));
        }
        async function fetUserReplies() {
            const res = await fetchNui('getRepliesX', props.email);
            setTweets(JSON.parse(res as string));
        }
        async function fetUserLikes() {
            const res = await fetchNui('getAllLikedTweets', props.email);
            setTweets(JSON.parse(res as string));
        }
        if (filter === 'post') {
            fetUserTweets();
        } else if (filter === 'replies') {
            fetUserReplies();
        } else if (filter === 'liked') {
            fetUserLikes();
        }

        return () => {
            setTweets([]);
        }
    }, [filter, props.email, props.show]);

    const [editProfile, setEditProfile] = useState(false);
    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);
    const [duplicateProfiledata, setDuplicateProfileData] = useState<TweetProfileData>({ ...profileData });
    const handleDeleteTweet = async (tweet: TweetData) => {
        if (tweet.email === phoneSettings.pigeonIdAttached) {
            if (tweet.isRetweet && tweet.originalTweetId) {
                setTweets(prevTweets => {
                    return prevTweets.map(t => {
                        if (t._id === tweet.originalTweetId) {
                            return {
                                ...t,
                                retweetCount: t.retweetCount.filter(id => id !== phoneSettings._id)
                            };
                        }
                        return t;
                    }).filter(t => t._id !== tweet._id);
                });

                await fetchNui('retweetTweet', JSON.stringify({
                    ogTweetId: tweet.originalTweetId,
                    tweetId: tweet._id,
                    retweet: false,
                    pigeonId: phoneSettings.pigeonIdAttached
                }));
            }

            await fetchNui('deleteTweet', tweet._id);
            setTweets(prev => prev.filter(t => t._id !== tweet._id));
        }
    };
    return (
        <Transition
            mounted={props.show}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                const res = await fetchNui('getProfile', props.email);
                if (res === 'User not found') {
                    fetchNui('showNoti', { app: 'pigeon', title: 'Pigeon', description: 'Something Went Wrong, User Can\'t be fetched' })
                    props.onError();
                    return;
                }
                setProfileData(JSON.parse(res as string))
            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'absolute',
                zIndex: 1,
                backgroundColor: 'black',
            }}>
                <div style={{
                    marginTop: '3.91vh',
                    width: '90%',
                }}>
                    <svg onClick={() => {
                        props.onClose();
                    }} style={{ cursor: 'pointer' }} width="3.89vh" height="1.57vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.7809 1.62449L2.28066 8.49979L7.7809 15.3751C8.12591 15.8064 8.05599 16.4357 7.62473 16.7807C7.19347 17.1257 6.56417 17.0557 6.21916 16.6245L0.568995 9.56178C0.0722991 8.9409 0.0722966 8.05868 0.568995 7.43781L6.21917 0.375098C6.56418 -0.0561646 7.19347 -0.126086 7.62473 0.218925C8.05599 0.563934 8.12591 1.19323 7.7809 1.62449Z" fill="#0A84FF" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M12.7032 12.9998H16.4473C18.252 12.9998 19.3711 12.0682 19.3711 10.5799C19.3711 9.46073 18.5274 8.62284 17.3789 8.53495V8.48807C18.2754 8.35331 18.9668 7.57987 18.9668 6.65409C18.9668 5.35917 17.9707 4.54471 16.3828 4.54471H12.7032V12.9998ZM14.4727 8.06034V5.86307H15.9258C16.752 5.86307 17.2266 6.24979 17.2266 6.92948C17.2266 7.64432 16.6875 8.06034 15.7442 8.06034H14.4727ZM15.9961 11.6814H14.4727V9.22636H15.9551C16.9981 9.22636 17.5664 9.64823 17.5664 10.4392C17.5664 11.2478 17.0157 11.6814 15.9961 11.6814Z" fill="#0A84FF" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M20.5922 11.1951C20.5922 12.326 21.5004 13.0994 22.6957 13.0994C23.4809 13.0994 24.2602 12.7068 24.6118 12.0389H24.6469V12.9998H26.2993V8.68143C26.2993 7.41581 25.2504 6.58378 23.6391 6.58378C21.975 6.58378 20.9379 7.42167 20.8735 8.64042H22.4379C22.52 8.17753 22.9243 7.86112 23.5629 7.86112C24.2075 7.86112 24.6176 8.20096 24.6176 8.7869V9.20292L23.0356 9.29667C21.4711 9.39042 20.5922 10.0525 20.5922 11.1951ZM24.6176 10.6971C24.6176 11.3767 24.0024 11.8631 23.2582 11.8631C22.6782 11.8631 22.2914 11.5701 22.2914 11.1014C22.2914 10.656 22.6547 10.3689 23.2934 10.3221L24.6176 10.24V10.6971Z" fill="#0A84FF" />
                        <path d="M32.1258 9.05643H33.7137C33.6375 7.63261 32.5594 6.58378 30.8602 6.58378C28.9793 6.58378 27.7782 7.83768 27.7782 9.85331C27.7782 11.9041 28.9793 13.1346 30.8719 13.1346C32.5243 13.1346 33.6317 12.1795 33.7196 10.6971H32.1258C32.0203 11.3826 31.575 11.7928 30.8895 11.7928C30.0399 11.7928 29.5125 11.0896 29.5125 9.85331C29.5125 8.64042 30.0399 7.92557 30.8836 7.92557C31.5868 7.92557 32.0262 8.39432 32.1258 9.05643Z" fill="#0A84FF" />
                        <path d="M39.0539 6.71854L36.9211 9.23807H36.8977V4.54471H35.1868V12.9998H36.8977V10.9256L37.343 10.4451L39.1418 12.9998H41.1106L38.5969 9.41386L40.9934 6.71854H39.0539Z" fill="#0A84FF" />
                    </svg>
                </div>
                <div style={{
                    width: '90%',
                    display: 'flex',
                    marginTop: '0.89vh',
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '50%',
                    }}>
                        <Avatar src={profileData.avatar !== '' ? profileData.avatar : "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} size={'5.33vh'} />
                        <div style={{
                            width: '100%',
                            height: '13.16vh',
                            backgroundImage: profileData.banner !== '' ? `url(${profileData.banner})` : "url('https://cdn.summitrp.gg/uploads/server/phone/pigeonBanner.gif')",
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                            position: 'absolute',
                            zIndex: -1,
                            top: '0.00vh',
                            marginLeft: '-1.42vh',
                            backgroundPosition: 'center',
                        }} />
                        <div style={{
                            fontSize: '1.42vh',
                            marginTop: '0.53vh'
                        }}>
                            {profileData.displayName}
                            {profileData.verified && <svg style={{
                                position: 'relative',
                                top: '0.27vh',
                                marginLeft: '0.36vh'
                            }} width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                            </svg>}
                        </div>
                        <div style={{
                            fontSize: '1.07vh',
                            lineHeight: '0.89vh',
                        }}>{profileData.email}</div>
                        <div style={{ marginTop: '0.89vh', fontSize: '1.42vh' }}>{profileData.bio}</div>
                        <div style={{
                            marginTop: '0.36vh',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.89vh'
                        }}>
                            <svg width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3.3238 7.9173C3.3238 8.29333 3.01141 8.5982 2.62612 8.5982C2.24084 8.5982 1.92845 8.29333 1.92845 7.9173C1.92845 7.54128 2.24084 7.2364 2.62612 7.2364C3.01141 7.2364 3.3238 7.54128 3.3238 7.9173ZM6.43693 7.9173C6.43693 8.29333 6.12455 8.5982 5.73926 8.5982C5.35397 8.5982 5.04158 8.29333 5.04158 7.9173C5.04158 7.54128 5.35397 7.2364 5.73926 7.2364C6.12455 7.2364 6.43693 7.54128 6.43693 7.9173ZM9.55015 7.9173C9.55015 8.29333 9.23776 8.5982 8.85248 8.5982C8.46719 8.5982 8.1548 8.29333 8.1548 7.9173C8.1548 7.54128 8.46719 7.2364 8.85248 7.2364C9.23776 7.2364 9.55015 7.54128 9.55015 7.9173ZM12.6633 7.9173C12.6633 8.29333 12.3509 8.5982 11.9656 8.5982C11.5803 8.5982 11.2679 8.29333 11.2679 7.9173C11.2679 7.54128 11.5803 7.2364 11.9656 7.2364C12.3509 7.2364 12.6633 7.54128 12.6633 7.9173ZM3.3238 10.2718C3.3238 10.6479 3.01141 10.9527 2.62612 10.9527C2.24084 10.9527 1.92845 10.6479 1.92845 10.2718C1.92845 9.89582 2.24084 9.59094 2.62612 9.59094C3.01141 9.59094 3.3238 9.89582 3.3238 10.2718ZM6.43693 10.2718C6.43693 10.6479 6.12455 10.9527 5.73926 10.9527C5.35397 10.9527 5.04158 10.6479 5.04158 10.2718C5.04158 9.89582 5.35397 9.59094 5.73926 9.59094C6.12455 9.59094 6.43693 9.89582 6.43693 10.2718ZM9.55015 10.2718C9.55015 10.6479 9.23776 10.9527 8.85248 10.9527C8.46719 10.9527 8.1548 10.6479 8.1548 10.2718C8.1548 9.89582 8.46719 9.59094 8.85248 9.59094C9.23776 9.59094 9.55015 9.89582 9.55015 10.2718ZM12.6633 10.2718C12.6633 10.6479 12.3509 10.9527 11.9656 10.9527C11.5803 10.9527 11.2679 10.6479 11.2679 10.2718C11.2679 9.89582 11.5803 9.59094 11.9656 9.59094C12.3509 9.59094 12.6633 9.89582 12.6633 10.2718ZM3.3238 12.6264C3.3238 13.0024 3.01141 13.3073 2.62612 13.3073C2.24084 13.3073 1.92845 13.0024 1.92845 12.6264C1.92845 12.2504 2.24084 11.9455 2.62612 11.9455C3.01141 11.9455 3.3238 12.2504 3.3238 12.6264ZM6.43693 12.6264C6.43693 13.0024 6.12455 13.3073 5.73926 13.3073C5.35397 13.3073 5.04158 13.0024 5.04158 12.6264C5.04158 12.2504 5.35397 11.9455 5.73926 11.9455C6.12455 11.9455 6.43693 12.2504 6.43693 12.6264ZM9.55015 12.6264C9.55015 13.0024 9.23776 13.3073 8.85248 13.3073C8.46719 13.3073 8.1548 13.0024 8.1548 12.6264C8.1548 12.2504 8.46719 11.9455 8.85248 11.9455C9.23776 11.9455 9.55015 12.2504 9.55015 12.6264ZM12.6633 12.6264C12.6633 13.0024 12.3509 13.3073 11.9656 13.3073C11.5803 13.3073 11.2679 13.0024 11.2679 12.6264C11.2679 12.2504 11.5803 11.9455 11.9656 11.9455C12.3509 11.9455 12.6633 12.2504 12.6633 12.6264ZM2.66573 0.34045V2.89383C2.66573 3.08186 2.8219 3.23428 3.01456 3.23428C3.20722 3.23428 3.3634 3.08186 3.3634 2.89383V0.34045C3.3634 0.152421 3.20722 0 3.01456 0C2.8219 0 2.66573 0.152421 2.66573 0.34045ZM11.6607 0.34045V2.89383C11.6607 3.08186 11.8169 3.23428 12.0096 3.23428C12.2022 3.23428 12.3584 3.08186 12.3584 2.89383V0.34045C12.3584 0.152421 12.2022 0 12.0096 0C11.8169 0 11.6607 0.152421 11.6607 0.34045Z" fill="#AEAEAE" />
                                <path d="M13.9535 1.2647C14.5314 1.2647 15 1.722 15 2.28605V13.9786C15 14.5427 14.5314 15 13.9535 15H1.04651C0.468563 15 0 14.5427 0 13.9786V2.28605C0 1.722 0.468563 1.2647 1.04651 1.2647H13.9535ZM1.04651 1.9456C0.853885 1.9456 0.697674 2.09806 0.697674 2.28605V13.9786C0.697674 14.1666 0.853885 14.3191 1.04651 14.3191H13.9535C14.1461 14.3191 14.3023 14.1666 14.3023 13.9786V2.28605C14.3023 2.09806 14.1461 1.9456 13.9535 1.9456H1.04651Z" fill="#AEAEAE" />
                                <path d="M8.57365 4.60223C8.57365 4.03819 8.10507 3.58088 7.52713 3.58088C6.9492 3.58088 6.48062 4.03819 6.48062 4.60223C6.48062 5.16627 6.9492 5.62358 7.52713 5.62358C8.10507 5.62358 8.57365 5.16627 8.57365 4.60223ZM9.27132 4.60223C9.27132 5.54231 8.49037 6.30448 7.52713 6.30448C6.5639 6.30448 5.78295 5.54231 5.78295 4.60223C5.78295 3.66215 6.5639 2.89998 7.52713 2.89998C8.49037 2.89998 9.27132 3.66215 9.27132 4.60223Z" fill="#AEAEAE" />
                            </svg>
                            <div style={{ fontSize: '1.24vh', lineHeight: '0.00vh', fontWeight: 500, color: '#AEAEAE' }}>Joined {dayjs(new Date(profileData.createdAt)).format('DD/MM/YYYY')}</div>
                        </div>
                        <div style={{
                            marginTop: '0.71vh',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.89vh',
                            fontSize: '1.24vh',
                            fontWeight: 500,
                        }}>
                            <span
                                style={{
                                    cursor: 'pointer',
                                    color: '#0A84FF',
                                    textDecoration: 'underline'
                                }}
                                onClick={() => props.onFollowersClick?.(profileData.email)}
                            >
                                {profileData.followers.length} Followers
                            </span>
                            <span
                                style={{
                                    cursor: 'pointer',
                                    color: '#0A84FF',
                                    textDecoration: 'underline'
                                }}
                                onClick={() => props.onFollowingClick?.(profileData.email)}
                            >
                                {profileData.following.length} Following
                            </span>
                        </div>
                    </div>
                    <div style={{
                        width: '50%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'end',
                        justifyContent: 'center',
                        marginTop: '6vh',
                        gap: '0.89vh',
                    }}>
                        {phoneSettings.pigeonIdAttached === profileData.email ? <Button style={{
                            borderRadius: '3.56vh',
                            width: '8.89vh',
                            fontSize: '1.24vh',
                            padding: '0.00vh',
                            color: 'white',
                            fontWeight: 500,
                        }} onClick={() => {
                            setEditProfile(true);
                            setDuplicateProfileData({ ...profileData });
                        }} variant="outline">Edit Profile</Button> : (
                            <>
                                <Button style={{
                                    borderRadius: '3.56vh',
                                    width: '7.89vh',
                                    fontSize: '1.42vh',
                                    padding: '0.00vh',
                                    color: 'white',
                                    fontWeight: 500,
                                }} onClick={async () => {
                                    await fetchNui('followUser', JSON.stringify({ targetEmail: profileData.email, currentEmail: phoneSettings.pigeonIdAttached, follow: !profileData.followers.includes(phoneSettings.pigeonIdAttached) }));
                                    const res = await fetchNui('getProfile', profileData.email);
                                    if (res === 'User not found') {
                                        fetchNui('showNoti', { app: 'pigeon', title: 'Pigeon', description: 'Something Went Wrong, User Can\'t be fetched' })
                                        props.onError();
                                        return;
                                    }
                                    setProfileData(JSON.parse(res as string));
                                }} variant="outline">
                                    {profileData.followers.includes(phoneSettings.pigeonIdAttached) ? 'Unfollow' : 'Follow'}
                                </Button>
                                <Button style={{
                                    borderRadius: '3.56vh',
                                    width: '7.89vh',
                                    fontSize: '1.24vh',
                                    padding: '0.00vh',
                                    color: 'white',
                                    fontWeight: 500,
                                    backgroundColor: '#0A84FF',
                                }} onClick={() => {
                                    props.onMessageClick?.(profileData);
                                }} variant="filled">
                                    Message
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                <div>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '3.56vh',
                        marginTop: '0.89vh'
                    }}>
                        <div onClick={() => {
                            setFilter('post');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '1.33vh', letterSpacing: '0.09vh', borderBottom: `0.09vh solid ${filter === "post" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>Post</div>
                        <div onClick={() => {
                            setFilter('replies');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '1.33vh', letterSpacing: '0.09vh', borderBottom: `0.09vh solid ${filter === "replies" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>Replies</div>
                        <div onClick={() => {
                            setFilter('liked');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '1.33vh', letterSpacing: '0.09vh', borderBottom: `0.09vh solid ${filter === "liked" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>Liked</div>
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '54%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                }} id="scrollableDivx">
                    <InfiniteScroll
                        scrollableTarget="scrollableDivx"
                        dataLength={tweets && tweets.length}
                        next={() => { }}
                        hasMore={hasMore}
                        loader={<></>}
                        endMessage={<></>}
                    >
                        {tweets && tweets.map((tweet, index) => {
                            return (
                                <div key={index} style={{
                                    width: '28.80vh',
                                    height: 'auto',
                                    backgroundColor: 'rgba(255, 255, 255, 0.19)',
                                    display: 'flex',
                                    alignItems: 'start',
                                    padding: '0.89vh',
                                    borderRadius: '0.89vh',
                                    marginTop: '1.78vh',
                                }}>
                                    <Avatar className='clickanimation' mt={'0.36vh'} size={"2.49vh"} src={tweet.avatar.length > 0 ? tweet.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} />
                                    <div style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'flex-start',
                                    }}>
                                        <div style={{
                                            width: '95%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            position: 'relative',
                                            backgroundColor: 'rgba(255, 255, 255, 0)',
                                            marginLeft: '3%',
                                        }}>
                                            <div style={{
                                                fontWeight: '500',
                                                fontSize: '1.33vh',
                                                letterSpacing: '0.09vh',
                                                lineHeight: '1.78vh',
                                            }}>{tweet.username}</div>

                                            {tweet.verified && <svg style={{
                                                marginTop: '0.09vh',
                                                marginLeft: '0.36vh'
                                            }} width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                                <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                                            </svg>}

                                            <div style={{
                                                fontWeight: '500',
                                                fontSize: '0.80vh',
                                                letterSpacing: '0.09vh',
                                                position: 'absolute',
                                                right: '0',
                                                marginTop: '0.09vh',
                                            }}>{formatedDate(tweet.createdAt)}</div>
                                        </div>

                                        <div style={{
                                            width: '95%',
                                            fontSize: '1.33vh',
                                            marginLeft: '3%',
                                            lineHeight: '1.78vh',
                                            letterSpacing: '0.09vh',
                                        }}>{tweet.isRetweet ? "ReTweet" : ""} {tweet.content}</div>

                                        {tweet.attachments.length > 0 && <div style={{
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: '1.78vh',
                                        }}>
                                            {tweet.attachments.map((attachment, index) => {
                                                return attachment?.type === 'image' ? (
                                                    <img key={index} onClick={() => {
                                                        setSelectedImg(attachment.url);
                                                        setOpenImgContainer(true);
                                                    }} src={attachment.url} style={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        borderRadius: '0.89vh',
                                                        objectFit: 'cover',
                                                        maxHeight: '35.56vh',
                                                        maxWidth: '35.56vh',
                                                        marginBottom: '0.89vh',
                                                        boxShadow: '0px 0px 0.89vh rgba(0, 0, 0, 0.5)'
                                                    }} />
                                                ) : attachment?.type === 'video' ? (
                                                    <video key={index} src={attachment.url} style={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        borderRadius: '0.89vh',
                                                        objectFit: 'cover',
                                                        maxHeight: '35.56vh',
                                                        maxWidth: '35.56vh',
                                                        marginBottom: '0.89vh',
                                                        boxShadow: '0px 0px 0.89vh rgba(0, 0, 0, 0.5)'
                                                    }} controls />
                                                ) : <img key={index} onClick={() => {
                                                    setSelectedImg(attachment.url);
                                                    setOpenImgContainer(true);
                                                }} src={attachment.url} style={{
                                                    width: '100%',
                                                    height: 'auto',
                                                    borderRadius: '0.89vh',
                                                    objectFit: 'cover',
                                                    maxHeight: '35.56vh',
                                                    maxWidth: '35.56vh',
                                                    marginBottom: '0.89vh',
                                                    boxShadow: '0px 0px 0.89vh rgba(0, 0, 0, 0.5)'
                                                }} />
                                            })}
                                        </div>}

                                        <div style={{
                                            marginBottom: '-0.53vh',
                                            display: 'flex',
                                            gap: '3.56vh',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.53vh',
                                            }} onClick={() => {
                                                props.onReplyClick(tweet);
                                                props.onClose();
                                            }}>
                                                <svg className='clickanimationXl' width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M7.46822 0C2.99976 0 -0.551448 3.8453 0.0710452 8.34385C0.467791 11.2104 2.64202 13.6172 5.48974 14.3762C6.55023 14.659 7.64522 14.7189 8.74471 14.5292C9.6627 14.3702 10.6047 14.4414 11.5039 14.6664L12.5967 14.9394C14.0134 15.2942 15.3004 14.0334 14.9381 12.6444C14.9381 12.6444 14.7356 11.8674 14.7296 11.8426C14.5031 10.9726 14.4544 10.0539 14.6884 9.1861C14.9779 8.11659 15.0266 6.95182 14.7664 5.74505C14.0779 2.56126 11.1544 0 7.46822 0ZM7.46822 1.50002C10.4322 1.50002 12.7534 3.53255 13.3002 6.06233C13.5004 6.98934 13.4802 7.90811 13.2409 8.79462C12.2284 12.5387 15.1886 14.0417 11.8677 13.2107C10.7629 12.9347 9.6117 12.8567 8.48896 13.0509C7.62272 13.2009 6.74523 13.1582 5.87599 12.9272C3.60576 12.3219 1.86953 10.3974 1.55678 8.13836C1.05353 4.49782 3.9515 1.50002 7.46822 1.50002Z" fill={tweet.repliesCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweet.repliesCount.length}</div>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.53vh',
                                            }} onClick={() => {
                                                props.onRetweetClick(tweet);
                                                props.onClose();
                                            }}>
                                                <svg className='clickanimationXl' width="2.04vh" height="1.11vh" viewBox="0 0 25 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M6.25 0C5.58696 0 4.95107 0.263392 4.48223 0.732233C4.01339 1.20107 3.75 1.83696 3.75 2.5V10H0L5 15L10 10H6.25V2.5H15L17.5 0H6.25ZM18.75 5H15L20 0L25 5H21.25V12.5C21.25 13.163 20.9866 13.7989 20.5178 14.2678C20.0489 14.7366 19.413 15 18.75 15H7.5L10 12.5H18.75V5Z" fill={tweet.retweetCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweet.retweetCount.length}</div>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.53vh',
                                            }} onClick={() => {
                                                props.onLikeClick(tweet);
                                                props.onClose();
                                            }}>
                                                <svg className='clickanimationXl' width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M11.3333 0C10.0275 0 8.84701 0.603333 8 1.57571C7.15308 0.603424 5.97249 0 4.66667 0C2.08936 0 0 2.35052 0 5.25C0 8.14948 2.66667 10.5 8 15C13.3333 10.5 16 8.14948 16 5.25C16 2.35052 13.9106 0 11.3333 0Z" fill={tweet.likeCount.includes(phoneSettings.pigeonIdAttached) ? "#E22514" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweet.likeCount.length}</div>
                                            </div>
                                            {tweet.email === phoneSettings.pigeonIdAttached && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.53vh',
                                                }} onClick={() => {
                                                    handleDeleteTweet(tweet);
                                                    props.onClose();
                                                }}>
                                                    <svg style={{ cursor: 'pointer' }} width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M2.81625 13.7123L1.5 4.5H13.5L12.1838 13.7123C12.1327 14.0697 11.9544 14.3967 11.6816 14.6332C11.4088 14.8698 11.0598 15 10.6987 15H4.30125C3.94018 15 3.59122 14.8698 3.31843 14.6332C3.04565 14.3967 2.86734 14.0697 2.81625 13.7123ZM14.25 1.5H10.5V0.75C10.5 0.551088 10.421 0.360322 10.2803 0.21967C10.1397 0.0790176 9.94891 0 9.75 0H5.25C5.05109 0 4.86032 0.0790176 4.71967 0.21967C4.57902 0.360322 4.5 0.551088 4.5 0.75V1.5H0.75C0.551088 1.5 0.360322 1.57902 0.21967 1.71967C0.0790176 1.86032 0 2.05109 0 2.25C0 2.44891 0.0790176 2.63968 0.21967 2.78033C0.360322 2.92098 0.551088 3 0.75 3H14.25C14.4489 3 14.6397 2.92098 14.7803 2.78033C14.921 2.63968 15 2.44891 15 2.25C15 2.05109 14.921 1.86032 14.7803 1.71967C14.6397 1.57902 14.4489 1.5 14.25 1.5Z" fill="#828282" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </InfiniteScroll>
                </div>
                <Transition
                    mounted={editProfile}
                    transition="slide-up"
                    duration={400}
                    timingFunction="ease"
                    onEnter={async () => {
                        /* const res = await fetchNui('getProfile', props.email);
                        setProfileData(JSON.parse(res as string)) */
                    }}
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'absolute',
                        zIndex: 1,
                        backgroundColor: 'black',
                    }}>
                        <div style={{
                            marginTop: '3.20vh',
                            width: '90%',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <svg onClick={() => {
                                setEditProfile(false);
                            }} style={{ cursor: 'pointer' }} width="3.89vh" height="1.57vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                            }}>Edit Profile</div>
                            <div style={{
                                padding: '0.71vh',
                                marginLeft: 'auto',
                                color: 'rgba(255, 255, 255, 0.5)',
                                fontSize: '1.42vh',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }} className='clickanimation' onClick={async () => {
                                const res = await fetchNui('pigeon:updateProfile', JSON.stringify(duplicateProfiledata));
                                if (res === 'success') {
                                    setEditProfile(false);
                                    setProfileData({ ...duplicateProfiledata });
                                    setLocation({
                                        app: 'pigeon',
                                        page: {
                                            ...location.page,
                                            pigeon: 'home'
                                        }
                                    });
                                }
                            }}>
                                Save
                            </div>
                        </div>
                        <div style={{ width: '90%', display: 'flex', flexDirection: 'column', alignItems: 'start', marginTop: '0.89vh' }}>
                            <div style={{
                                display: 'flex',
                                borderBottom: '0.09vh solid rgba(255, 255, 255, 0.2)',
                                paddingBottom: '0.89vh',
                            }}>
                                <Avatar size={'7.11vh'} src={duplicateProfiledata.avatar.length > 0 ? duplicateProfiledata.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} />
                                <TextInput styles={{
                                    root: {
                                        width: '19.56vh',
                                        marginLeft: '0.89vh',
                                        fontSize: '1.42vh',
                                        fontWeight: 500,
                                        color: 'white',
                                        marginTop: '1.78vh',
                                    },
                                    input: {
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                    },
                                }} value={duplicateProfiledata.avatar} onChange={(event) => {
                                    setDuplicateProfileData({ ...duplicateProfiledata, avatar: event.currentTarget.value })
                                }} placeholder="Profile Picture URL" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                            </div>
                            <div style={{
                                display: 'flex',
                                paddingTop: '0.89vh',
                                borderBottom: '0.09vh solid rgba(255, 255, 255, 0.2)',
                                paddingBottom: '0.89vh',
                            }}>
                                <div style={{ fontWeight: '500', fontSize: '1.42vh', width: '28.5%' }}>Banner</div>
                                <TextInput styles={{
                                    root: {
                                        width: '19.56vh',
                                        marginLeft: '0.89vh',
                                        fontSize: '1.42vh',
                                        fontWeight: 500,
                                        color: 'white',
                                    },
                                    input: {
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                    },
                                }} value={duplicateProfiledata.banner} onChange={(e) => {
                                    setDuplicateProfileData({ ...duplicateProfiledata, banner: e.currentTarget.value })
                                }} placeholder="Enter banner URL" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                            </div>
                            <div style={{
                                display: 'flex',
                                paddingTop: '0.89vh',
                                borderBottom: '0.09vh solid rgba(255, 255, 255, 0.2)',
                                paddingBottom: '0.89vh',
                            }}>
                                <div style={{ fontWeight: '500', fontSize: '1.42vh' }}>Username</div>
                                <TextInput styles={{
                                    root: {
                                        width: '19.56vh',
                                        marginLeft: '0.89vh',
                                        fontSize: '1.42vh',
                                        fontWeight: 500,
                                        color: 'white',
                                    },
                                    input: {
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                    },
                                }} value={duplicateProfiledata.displayName} onChange={(e) => {
                                    setDuplicateProfileData({ ...duplicateProfiledata, displayName: e.currentTarget.value })
                                }} placeholder="Profile Username" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                            </div>
                            <div style={{
                                display: 'flex',
                                paddingTop: '0.89vh',
                                borderBottom: '0.09vh solid rgba(255, 255, 255, 0.2)',
                                paddingBottom: '0.89vh',
                            }}>
                                <div style={{ fontWeight: '500', width: '30%', fontSize: '1.42vh' }}>Bio</div>
                                <Textarea styles={{
                                    root: {
                                        width: '24.00vh',
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        marginLeft: '0.89vh',
                                        fontSize: '1.42vh',
                                        fontWeight: 500,
                                        color: 'white',
                                    },
                                    input: {
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                    },
                                }} value={duplicateProfiledata.bio} onChange={(e) => {
                                    setDuplicateProfileData({ ...duplicateProfiledata, bio: e.currentTarget.value })
                                }} placeholder="Profile Bio" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                            </div>
                            <div style={{
                                display: 'flex',
                                paddingTop: '0.89vh',
                                paddingBottom: '0.89vh',
                            }}>
                                <div style={{ fontWeight: '500', fontSize: '1.33vh' }}>Joined At</div>
                                <TextInput styles={{
                                    root: {
                                        width: '19.56vh',
                                        marginLeft: '0.89vh',
                                        fontSize: '1.42vh',
                                        fontWeight: 500,
                                        color: 'white',
                                    },
                                    input: {
                                        backgroundColor: 'rgba(255, 255, 255, 0)',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                    },
                                }} disabled value={dayjs(new Date(duplicateProfiledata.createdAt)).format('MMM YYYY')} placeholder="Profile Username" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                            </div>
                        </div>
                        <Button color="red" mt={'1.42vh'} onClick={async () => {
                            setEditProfile(false);
                            setLocation({
                                app: '',
                                page: {
                                    ...location.page,
                                    pigeon: ''
                                }
                            });
                            const dataX = {
                                ...phoneSettings,
                                pigeonIdAttached: '',
                            }
                            setPhoneSettings(dataX);
                            await fetchNui('setSettings', JSON.stringify(dataX));
                        }} style={{
                            width: '14.22vh',
                        }}>Sign Out</Button>
                        <Button color="teal" mt={'1.42vh'} onClick={async () => {
                            setInputTitle('Password');
                            setInputDescription('Change your password');
                            setInputPlaceholder('Enter new Password');
                            setInputShow(true);
                        }} style={{
                            width: '14.22vh',
                        }}>Change Password</Button>
                    </div>}
                </Transition>
                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Password') {
                        await fetchNui('pigeon:changePassword', JSON.stringify({ email: duplicateProfiledata.email, password: e }));
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
                <Modal styles={{
                    modal: {
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        boxShadow: 'none',
                    },
                    closeIcon: {
                        color: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    }
                }} open={imgContainer} onClose={onCloseModal} center>
                    <img src={selectedImg} style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '80.00vh',
                        borderRadius: '0.89vh',
                        objectFit: 'cover',
                    }} />
                </Modal>
            </div>}
        </Transition>
    )
}