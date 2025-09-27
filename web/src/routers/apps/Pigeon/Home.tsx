import { Avatar, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { useEffect, useState } from "react";
import { TweetData } from "../../../../../types/types";
import InfiniteScroll from "react-infinite-scroll-component";
import { usePhone } from "../../../store/store";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import dayjs from "dayjs";
import CreateNewReply from "./CreateNewReply";
import Profile from "./Profile";
import 'react-responsive-modal/styles.css';
import { Modal } from 'react-responsive-modal';

export default function Home(props: {
    location: string, profileData: {
        _id: string;
        email: string;
        password: string;
        displayName: string;
        avatar: string;
        notificationsEnabled: boolean;
        createdAt: string;
        bio: string;
        followers: string[];
        following: string[];
    },
    onMessageClick?: (user: any) => void
}) {

    const [imgContainer, setOpenImgContainer] = useState(false);
    const [selectedImg, setSelectedImg] = useState<string | null>(null);
    const onCloseModal = () => {
        setOpenImgContainer(false);
        setSelectedImg(null);
    };


    const { phoneSettings, location, setLocation } = usePhone();

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

    useNuiEvent('pigeonRefreshTweet', (data: string) => {
        const tweetData: TweetData = JSON.parse(data);
        if (location.page.pigeon === 'home') {
            setTweets(prev => [tweetData, ...prev]);
        }
    });

    useNuiEvent('pigeonRefreshRepost', (data: string) => {
        const tweetData: TweetData = JSON.parse(data);
        setPostRepliesData(prev => [tweetData, ...prev]);
        if (tweetData.originalTweetId) {
            setTweets(prev => prev.map(t => {
                if (t._id === tweetData.originalTweetId) {
                    return {
                        ...t,
                        repliesCount: [...t.repliesCount, phoneSettings._id]
                    };
                }
                return t;
            }));

            setSelectedPost(prev => {
                return {
                    ...prev,
                    repliesCount: [...prev.repliesCount, phoneSettings._id]
                };
            });
        }
    });

    const [start, setStart] = useState(1);
    const [end, setEnd] = useState(20);
    const [filter, setFilter] = useState('all');
    const [tweets, setTweets] = useState<TweetData[]>([]);
    const [hasMore, setHasMore] = useState(true);

    const fetchTweets = async (startVal: number, endVal: number) => {
        const res = await fetchNui('getAllTweets', JSON.stringify({
            start: startVal,
            end: endVal,
        }));
        const parsedRes = JSON.parse(res as string);

        if (parsedRes.data.length === 0) {
            setHasMore(false);
        } else {
            setTweets(prev => [...prev, ...parsedRes.data]);
            setHasMore(true);
        }
    };

    useEffect(() => {
        setTweets([]);
        fetchTweets(1, 20);
        setStart(1);
        setEnd(20);
    }, [filter, location.page.pigeon]);

    const loadMore = () => {
        const newStart = end + 1;
        const newEnd = end + 20;
        setStart(newStart);
        setEnd(newEnd);
        fetchTweets(newStart, newEnd);
    };

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

    const handleDeletePostTweet = async (tweet: TweetData) => {
        if (tweet.email === phoneSettings.pigeonIdAttached) {
            if (tweet.isRetweet && tweet.parentTweetId) {
                setPostRepliesData(prevTweets => {
                    return prevTweets.map(t => {
                        if (t._id === tweet.parentTweetId) {
                            let removed = false;
                            return {
                                ...t,
                                retweetCount: t.retweetCount.filter(id => {
                                    if (id === phoneSettings._id && !removed) {
                                        removed = true;
                                        return false;
                                    }
                                    return true;
                                })
                            };
                        }
                        return t;
                    }).filter(t => t._id !== tweet._id);
                });

                await fetchNui('retweetRepostTweet', JSON.stringify({
                    ogTweetId: tweet.parentTweetId,
                    tweetId: tweet._id,
                    retweet: false,
                    pigeonId: phoneSettings.pigeonIdAttached
                }));

                if (tweets.length > 0 && tweets.find(t => t._id === tweet.originalTweetId)) {
                    setSelectedPost(prev => {
                        let removed = false;
                        return {
                            ...prev,
                            repliesCount: prev.repliesCount.filter(id => {
                                if (id === phoneSettings._id && !removed) {
                                    removed = true;
                                    return false;
                                }
                                return true;
                            })
                        };
                    });

                    setTweets(prev => prev.map(t => {
                        if (t._id === tweet.originalTweetId) {
                            let removed = false;
                            return {
                                ...t,
                                repliesCount: t.repliesCount.filter(id => {
                                    if (id === phoneSettings._id && !removed) {
                                        removed = true;
                                        return false;
                                    }
                                    return true;
                                })
                            };
                        }
                        return t;
                    }));

                    await fetchNui('decreaseRepliesCount', JSON.stringify({
                        tweetId: tweet.originalTweetId,
                    }));
                }
            } else {
                await fetchNui('deleteRepliesTweet', tweet._id);
                setPostRepliesData(prev => prev.filter(t => t._id !== tweet._id));

                if (tweets.length > 0 && tweets.find(t => t._id === tweet.originalTweetId)) {
                    setSelectedPost(prev => {
                        let removed = false;
                        return {
                            ...prev,
                            repliesCount: prev.repliesCount.filter(id => {
                                if (id === phoneSettings._id && !removed) {
                                    removed = true;
                                    return false;
                                }
                                return true;
                            })
                        };
                    });

                    setTweets(prev => prev.map(t => {
                        if (t._id === tweet.originalTweetId) {
                            let removed = false;
                            return {
                                ...t,
                                repliesCount: t.repliesCount.filter(id => {
                                    if (id === phoneSettings._id && !removed) {
                                        removed = true;
                                        return false;
                                    }
                                    return true;
                                })
                            };
                        }
                        return t;
                    }));

                    await fetchNui('decreaseRepliesCount', JSON.stringify({
                        tweetId: tweet.originalTweetId,
                    }));
                }
            }
        }
    };

    const [postRepliesdata, setPostRepliesData] = useState<TweetData[]>([]);
    const [selectedPost, setSelectedPost] = useState<TweetData>({
        _id: '',
        username: '',
        email: '',
        avatar: '',
        verified: false,
        content: '',
        attachments: [],
        createdAt: '',
        likeCount: [],
        retweetCount: [],
        repliesCount: [],
        isRetweet: false,
        originalTweetId: '',
        hashtags: [],
        parentTweetId: '',
    });
    const [showCreateNewReply, setShowCreateNewReply] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState('');

    return (
        <Transition
            mounted={props.location === "home"}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                if (showProfile) {
                    setShowProfile(false);
                }
                const res = await fetchNui('getAllTweets', JSON.stringify({
                    start,
                    end,
                }))
                const parsedRes = JSON.parse(res as string);
                setTweets([...parsedRes.data]);
            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '91%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div style={{
                    width: '100%',
                    height: '16%',
                    backgroundColor: 'rgba(255, 255, 255, 0.19)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    position: 'relative',
                }}>
                    <Avatar size={"2.84vh"} src={props.profileData.avatar.length > 0 ? props.profileData.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} style={{
                        position: 'absolute',
                        left: '3%',
                        bottom: '25%',
                    }} className='clickanimation' onClick={() => {
                        setSelectedEmail(phoneSettings.pigeonIdAttached);
                        setShowProfile(true);
                    }} />
                    <svg style={{ marginBottom: '4%' }} width="2.67vh" height="2.67vh" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M31.3459 2.24898C31.064 2.03273 30.6701 1.65301 30.461 1.36536C30.053 0.806071 29.2755 0.0164045 28.128 0.000319091C26.3478 -0.0260636 23.7767 1.58289 23.5791 5.07759C23.3809 8.57222 21.1399 13.7145 19.4911 14.8356C17.8422 15.9554 15.0079 19.8459 10.8542 21.1646C6.70049 22.4827 1.49198 23.3399 1.5576 24.7236C1.61037 25.8364 5.70165 25.6298 7.31194 25.5056C7.66656 25.4779 7.68264 25.5481 7.35057 25.6755C5.57687 26.3506 0.491254 28.383 0.436537 29.4713C0.370849 30.79 6.76618 27.361 11.6452 27.0984C16.5242 26.8345 19.1938 26.5378 20.5788 28.9107C20.5788 28.9107 20.8511 29.3496 21.3492 29.8484C21.3492 29.8484 21.5556 30.1423 21.5793 30.1842L21.6292 30.3072C21.7469 30.5978 21.7578 30.9208 21.66 31.2187C21.3659 31.267 21.0551 31.3325 20.7982 31.4433C20.4713 31.5843 20.5067 31.8005 20.7435 31.7451C20.9804 31.6911 21.1722 31.7502 21.1722 31.877C21.1722 32.0051 21.4289 31.9762 21.7566 31.8378C22.1459 31.673 22.6221 31.5083 22.8204 31.5804C22.9492 31.6267 23.0482 31.7072 23.1236 31.7915C23.2606 31.9434 23.0264 32.0791 22.6718 32.1056C22.3731 32.1281 22.0217 32.1886 21.734 32.3341C21.4174 32.4962 21.5526 32.7048 21.9027 32.6442C22.4684 32.549 23.2567 32.448 23.5785 32.569C24.1056 32.7666 25.5234 33.1952 26.6117 32.8985C27.3647 32.6938 28.1338 32.4725 28.711 32.3554C29.0593 32.2852 29.6038 31.9769 29.3205 31.8817C29.2112 31.845 29.0413 31.8185 28.787 31.8115C27.9169 31.7864 27.2154 32.0992 26.5693 32.0703C26.214 32.0542 26.1387 31.6828 26.4361 31.4884C26.6504 31.3475 26.9355 31.2059 27.292 31.1242C27.6389 31.045 27.7348 30.8171 27.3918 30.7232C27.115 30.6466 26.7147 30.6228 26.1496 30.7573C25.1605 30.9916 24.3283 30.9852 23.7504 30.6775C23.2676 30.2638 22.9387 29.7055 22.7636 29.0942C22.7435 29.0241 22.7285 28.9773 22.7222 28.9699C22.6662 27.8842 23.2362 26.3577 24.995 24.9547C27.5997 22.8779 29.9069 21.6904 30.6322 18.7235C31.3575 15.7572 29.3464 7.61397 29.3464 7.61397C29.3464 7.61397 29.0149 6.31071 29.1752 5.10976C29.2221 4.7577 29.47 4.23125 29.7525 4.01629C30.1161 3.73826 30.7262 3.45962 31.6492 3.56643C32.0025 3.60762 32.2335 3.4004 32.0662 3.08764C31.9303 2.83075 31.707 2.52505 31.3459 2.24898Z" fill="white" />
                        <circle cx="28.0978" cy="2.19538" r="0.439074" stroke="black" strokeWidth="0.3" />
                    </svg>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '3.56vh',
                        marginTop: '-0.89vh'
                    }}>
                        <div onClick={() => {
                            setFilter('all');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '1.33vh', letterSpacing: '0.09vh', borderBottom: `0.09vh solid ${filter === "all" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>All</div>
                        <div onClick={() => {
                            setFilter('following');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '1.33vh', letterSpacing: '0.09vh', borderBottom: `0.09vh solid ${filter === "following" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>Following</div>
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '83%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                }} id="scrollableDivx">
                    <InfiniteScroll
                        scrollableTarget="scrollableDivx"
                        dataLength={tweets.length}
                        next={loadMore}
                        hasMore={hasMore}
                        loader={<></>}
                        endMessage={<></>}
                    >
                        {tweets && tweets.filter(
                            tweet => filter === 'all' ? true : props.profileData.following.includes(tweet.email)
                        ).map((tweet, index) => {
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
                                    <Avatar className='clickanimation' mt={'0.36vh'} size={"2.49vh"} src={tweet.avatar.length > 0 ? tweet.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} onClick={() => {
                                        setSelectedEmail(tweet.email);
                                        setShowProfile(true);
                                    }} />
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
                                                        setOpenImgContainer(true);
                                                        setSelectedImg(attachment.url);
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
                                                    setOpenImgContainer(true);
                                                    setSelectedImg(attachment.url);
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
                                            }} onClick={async () => {
                                                const res = await fetchNui('getReplies', tweet._id);
                                                setSelectedPost(tweet);
                                                if (res) {
                                                    setPostRepliesData(JSON.parse(res as string));
                                                }
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
                                            }} onClick={async () => {
                                                if (!tweet.retweetCount.includes(phoneSettings._id)) {
                                                    setTweets(tweets.map((t) => {
                                                        if (t._id === tweet._id) {
                                                            return {
                                                                ...t,
                                                                retweetCount: [...t.retweetCount, phoneSettings._id]
                                                            }
                                                        }
                                                        return t;
                                                    }))
                                                    await fetchNui('retweetTweet', JSON.stringify({
                                                        tweetId: tweet._id,
                                                        retweet: true,
                                                        pigeonId: phoneSettings.pigeonIdAttached
                                                    }))
                                                }
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
                                            }} onClick={async () => {
                                                setTweets(tweets.map((t) => {
                                                    if (t._id === tweet._id) {
                                                        return {
                                                            ...t,
                                                            likeCount: t.likeCount.includes(phoneSettings.pigeonIdAttached) ? t.likeCount.filter((id) => id !== phoneSettings.pigeonIdAttached) : [...t.likeCount, phoneSettings.pigeonIdAttached]
                                                        }
                                                    }
                                                    return t;
                                                }))
                                                await fetchNui('likeTweet', JSON.stringify({
                                                    tweetId: tweet._id,
                                                    like: !tweet.likeCount.includes(phoneSettings.pigeonIdAttached),
                                                    email: phoneSettings.pigeonIdAttached
                                                }))
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
                                                }} onClick={() => handleDeleteTweet(tweet)}>
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
                {selectedPost._id.length > 0 && <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    marginTop: '0%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 1,
                    backgroundColor: 'rgb(0, 0, 0)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7.82vh',
                        width: '88%',
                        marginTop: '0.44vh',
                    }}>
                        <svg onClick={() => {
                            setSelectedPost({
                                _id: '',
                                username: '',
                                email: '',
                                avatar: '',
                                verified: false,
                                content: '',
                                attachments: [],
                                createdAt: '',
                                likeCount: [],
                                retweetCount: [],
                                repliesCount: [],
                                isRetweet: false,
                                originalTweetId: '',
                                hashtags: [],
                                parentTweetId: '',
                            })
                        }} style={{ marginTop: '2.58vh', cursor: 'pointer' }} width="3.89vh" height="1.57vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.7809 1.62449L2.28066 8.49979L7.7809 15.3751C8.12591 15.8064 8.05599 16.4357 7.62473 16.7807C7.19347 17.1257 6.56417 17.0557 6.21916 16.6245L0.568995 9.56178C0.0722991 8.9409 0.0722966 8.05868 0.568995 7.43781L6.21917 0.375098C6.56418 -0.0561646 7.19347 -0.126086 7.62473 0.218925C8.05599 0.563934 8.12591 1.19323 7.7809 1.62449Z" fill="#0A84FF" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M12.7032 12.9998H16.4473C18.252 12.9998 19.3711 12.0682 19.3711 10.5799C19.3711 9.46073 18.5274 8.62284 17.3789 8.53495V8.48807C18.2754 8.35331 18.9668 7.57987 18.9668 6.65409C18.9668 5.35917 17.9707 4.54471 16.3828 4.54471H12.7032V12.9998ZM14.4727 8.06034V5.86307H15.9258C16.752 5.86307 17.2266 6.24979 17.2266 6.92948C17.2266 7.64432 16.6875 8.06034 15.7442 8.06034H14.4727ZM15.9961 11.6814H14.4727V9.22636H15.9551C16.9981 9.22636 17.5664 9.64823 17.5664 10.4392C17.5664 11.2478 17.0157 11.6814 15.9961 11.6814Z" fill="#0A84FF" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M20.5922 11.1951C20.5922 12.326 21.5004 13.0994 22.6957 13.0994C23.4809 13.0994 24.2602 12.7068 24.6118 12.0389H24.6469V12.9998H26.2993V8.68143C26.2993 7.41581 25.2504 6.58378 23.6391 6.58378C21.975 6.58378 20.9379 7.42167 20.8735 8.64042H22.4379C22.52 8.17753 22.9243 7.86112 23.5629 7.86112C24.2075 7.86112 24.6176 8.20096 24.6176 8.7869V9.20292L23.0356 9.29667C21.4711 9.39042 20.5922 10.0525 20.5922 11.1951ZM24.6176 10.6971C24.6176 11.3767 24.0024 11.8631 23.2582 11.8631C22.6782 11.8631 22.2914 11.5701 22.2914 11.1014C22.2914 10.656 22.6547 10.3689 23.2934 10.3221L24.6176 10.24V10.6971Z" fill="#0A84FF" />
                            <path d="M32.1258 9.05643H33.7137C33.6375 7.63261 32.5594 6.58378 30.8602 6.58378C28.9793 6.58378 27.7782 7.83768 27.7782 9.85331C27.7782 11.9041 28.9793 13.1346 30.8719 13.1346C32.5243 13.1346 33.6317 12.1795 33.7196 10.6971H32.1258C32.0203 11.3826 31.575 11.7928 30.8895 11.7928C30.0399 11.7928 29.5125 11.0896 29.5125 9.85331C29.5125 8.64042 30.0399 7.92557 30.8836 7.92557C31.5868 7.92557 32.0262 8.39432 32.1258 9.05643Z" fill="#0A84FF" />
                            <path d="M39.0539 6.71854L36.9211 9.23807H36.8977V4.54471H35.1868V12.9998H36.8977V10.9256L37.343 10.4451L39.1418 12.9998H41.1106L38.5969 9.41386L40.9934 6.71854H39.0539Z" fill="#0A84FF" />
                        </svg>
                        <div style={{ marginTop: '2.67vh', fontWeight: '500', fontSize: '1.78vh' }}>Post</div>
                    </div>
                    <div style={{
                        width: '90%',
                        height: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <Avatar className='clickanimation' size={"2.67vh"} src={selectedPost.avatar.length > 0 ? selectedPost.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} mt={'0.53vh'} onClick={() => {
                                setSelectedEmail(selectedPost.email);
                                setShowProfile(true);
                            }} />
                            <div style={{ marginLeft: '0.36vh', marginTop: '0.53vh' }}>
                                <div style={{ fontWeight: '500', fontSize: '1.33vh', letterSpacing: '0.09vh', lineHeight: '1.78vh' }}>{selectedPost.username} {
                                    selectedPost.verified && <svg style={{
                                        position: 'relative',
                                        top: '0.36vh',
                                        marginLeft: '0.36vh'
                                    }} width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                        <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                                    </svg>
                                }</div>
                                <div style={{ fontWeight: '400', fontSize: '0.89vh', letterSpacing: '0.09vh', lineHeight: '1.24vh' }}>{selectedPost.email}</div>
                            </div>
                        </div>
                        <div style={{
                            marginTop: '0.89vh',
                        }}>
                            {selectedPost.isRetweet && "ReTweet"} {tweets.length > 0 && selectedPost.content}
                            {selectedPost.attachments.length > 0 && <div style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginTop: '1.78vh',
                            }}>
                                {selectedPost.attachments.map((attachment, index) => {
                                    return attachment?.type === 'image' ? (
                                        <img key={index} src={attachment.url} onClick={() => {
                                            setOpenImgContainer(true);
                                            setSelectedImg(attachment.url);
                                        }} style={{
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
                                    ) : <img key={index} src={attachment.url} onClick={() => {
                                        setOpenImgContainer(true);
                                        setSelectedImg(attachment.url);
                                    }} style={{
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
                            <div style={{ fontSize: '1.07vh', fontWeight: '500', color: 'rgb(150, 150, 150)' }}>{dayjs(new Date(selectedPost.createdAt)).format('HH:mm • DD/MM/YYYY')}</div>
                            <div className="divider" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
                            <div style={{
                                padding: '0.53vh',
                                display: 'flex',
                                gap: '3.56vh',
                            }}>
                                <div style={{ fontSize: '1.42vh', fontWeight: '500', display: 'flex', alignItems: 'center' }}>{selectedPost.retweetCount.length} <div style={{ fontSize: '1.07vh', marginTop: '0.27vh', marginLeft: '0.27vh' }}>Retweets</div></div>
                                <div style={{ fontSize: '1.42vh', fontWeight: '500', display: 'flex', alignItems: 'center' }}>{selectedPost.likeCount.length} <div style={{ fontSize: '1.07vh', marginTop: '0.27vh', marginLeft: '0.27vh' }}>Likes</div></div>
                            </div>
                            <div className="divider" style={{ backgroundColor: 'rgba(255,255,255,0.3)', marginTop: '0.00vh' }} />
                            <div style={{
                                marginTop: '0.89vh',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '3.56vh',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.53vh',
                                }} onClick={async () => {
                                    setShowCreateNewReply(true);
                                }}>
                                    <svg className='clickanimationXl' width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M7.46822 0C2.99976 0 -0.551448 3.8453 0.0710452 8.34385C0.467791 11.2104 2.64202 13.6172 5.48974 14.3762C6.55023 14.659 7.64522 14.7189 8.74471 14.5292C9.6627 14.3702 10.6047 14.4414 11.5039 14.6664L12.5967 14.9394C14.0134 15.2942 15.3004 14.0334 14.9381 12.6444C14.9381 12.6444 14.7356 11.8674 14.7296 11.8426C14.5031 10.9726 14.4544 10.0539 14.6884 9.1861C14.9779 8.11659 15.0266 6.95182 14.7664 5.74505C14.0779 2.56126 11.1544 0 7.46822 0ZM7.46822 1.50002C10.4322 1.50002 12.7534 3.53255 13.3002 6.06233C13.5004 6.98934 13.4802 7.90811 13.2409 8.79462C12.2284 12.5387 15.1886 14.0417 11.8677 13.2107C10.7629 12.9347 9.6117 12.8567 8.48896 13.0509C7.62272 13.2009 6.74523 13.1582 5.87599 12.9272C3.60576 12.3219 1.86953 10.3974 1.55678 8.13836C1.05353 4.49782 3.9515 1.50002 7.46822 1.50002Z" fill={tweets.length > 0 && selectedPost.repliesCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                    </svg>
                                    <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweets.length > 0 && selectedPost.repliesCount.length}</div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.53vh',
                                }} onClick={async () => {
                                    if (tweets.length > 0 && tweets.find((t) => t._id === selectedPost._id) && !selectedPost.retweetCount.includes(phoneSettings._id)) {
                                        setSelectedPost({
                                            ...selectedPost,
                                            retweetCount: selectedPost.retweetCount.includes(phoneSettings._id) ? selectedPost.retweetCount.filter((id) => id !== phoneSettings._id) : [...selectedPost.retweetCount, phoneSettings._id]
                                        });
                                        setTweets(tweets.map((t) => {
                                            if (t._id === selectedPost._id) {
                                                return {
                                                    ...t,
                                                    retweetCount: [...t.retweetCount, phoneSettings._id]
                                                }
                                            }
                                            return t;
                                        }))
                                        await fetchNui('retweetTweet', JSON.stringify({
                                            tweetId: selectedPost._id,
                                            retweet: true,
                                            pigeonId: phoneSettings.pigeonIdAttached
                                        }))
                                    } else if (!selectedPost.retweetCount.includes(phoneSettings._id)) {
                                        setSelectedPost({
                                            ...selectedPost,
                                            retweetCount: selectedPost.retweetCount.includes(phoneSettings._id) ? selectedPost.retweetCount.filter((id) => id !== phoneSettings._id) : [...selectedPost.retweetCount, phoneSettings._id]
                                        });
                                        setPostRepliesData(postRepliesdata.map((t) => {
                                            if (t._id === selectedPost._id) {
                                                return {
                                                    ...t,
                                                    retweetCount: [...t.retweetCount, phoneSettings._id]
                                                }
                                            }
                                            return t;
                                        }));
                                        await fetchNui('retweetRepostTweet', JSON.stringify({
                                            tweetId: selectedPost._id,
                                            retweet: true,
                                            pigeonId: phoneSettings.pigeonIdAttached
                                        }));
                                    }
                                }}>
                                    <svg className='clickanimationXl' width="2.04vh" height="1.11vh" viewBox="0 0 25 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6.25 0C5.58696 0 4.95107 0.263392 4.48223 0.732233C4.01339 1.20107 3.75 1.83696 3.75 2.5V10H0L5 15L10 10H6.25V2.5H15L17.5 0H6.25ZM18.75 5H15L20 0L25 5H21.25V12.5C21.25 13.163 20.9866 13.7989 20.5178 14.2678C20.0489 14.7366 19.413 15 18.75 15H7.5L10 12.5H18.75V5Z" fill={tweets.length > 0 && selectedPost.retweetCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                    </svg>
                                    <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweets.length > 0 && selectedPost.retweetCount.length}</div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.53vh',
                                }} onClick={async () => {
                                    setSelectedPost({
                                        ...selectedPost,
                                        likeCount: selectedPost.likeCount.includes(phoneSettings.pigeonIdAttached) ? selectedPost.likeCount.filter((id) => id !== phoneSettings.pigeonIdAttached) : [...selectedPost.likeCount, phoneSettings.pigeonIdAttached]
                                    });
                                    if (tweets.length > 0 && tweets.find((t) => t._id === selectedPost._id)) {
                                        setTweets(tweets.map((t) => {
                                            if (t._id === selectedPost._id) {
                                                return {
                                                    ...t,
                                                    likeCount: t.likeCount.includes(phoneSettings.pigeonIdAttached) ? t.likeCount.filter((id) => id !== phoneSettings.pigeonIdAttached) : [...t.likeCount, phoneSettings.pigeonIdAttached]
                                                }
                                            }
                                            return t;
                                        }));
                                        await fetchNui('likeTweet', JSON.stringify({
                                            tweetId: selectedPost._id,
                                            like: tweets.length > 0 && !selectedPost.likeCount.includes(phoneSettings.pigeonIdAttached),
                                            email: phoneSettings.pigeonIdAttached
                                        }));
                                    } else {
                                        await fetchNui('likeRepostTweet', JSON.stringify({
                                            tweetId: selectedPost._id,
                                            like: !selectedPost.likeCount.includes(phoneSettings.pigeonIdAttached),
                                            email: phoneSettings.pigeonIdAttached
                                        }));
                                    }
                                }}>
                                    <svg className='clickanimationXl' width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M11.3333 0C10.0275 0 8.84701 0.603333 8 1.57571C7.15308 0.603424 5.97249 0 4.66667 0C2.08936 0 0 2.35052 0 5.25C0 8.14948 2.66667 10.5 8 15C13.3333 10.5 16 8.14948 16 5.25C16 2.35052 13.9106 0 11.3333 0Z" fill={tweets.length > 0 && selectedPost.likeCount.includes(phoneSettings.pigeonIdAttached) ? "#E22514" : "#828282"} />
                                    </svg>
                                    <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{tweets.length > 0 && selectedPost.likeCount.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="divider" style={{ backgroundColor: 'rgba(255,255,255,0.3)', marginTop: '0.89vh', width: '100%' }} />
                    <div style={{
                        width: '100%',
                        height: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        {tweets.length > 0 && postRepliesdata && postRepliesdata.length > 0 && postRepliesdata.map((data: TweetData, index: number) => {
                            return (
                                <div key={index} style={{
                                    width: '28.80vh',
                                    height: 'auto',
                                    backgroundColor: 'rgba(255, 255, 255, 0.19)',
                                    display: 'flex',
                                    alignItems: 'start',
                                    padding: '0.89vh',
                                    borderRadius: '0.89vh',
                                    marginTop: index === 0 ? '0.89vh' : '0.89vh',
                                }}>
                                    <Avatar className='clickanimation' mt={'0.36vh'} size={"2.49vh"} src={data.avatar.length > 0 ? data.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} onClick={() => {
                                        setSelectedEmail(data.email);
                                        setShowProfile(true);
                                    }} />
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
                                            }}>{data.username}</div>

                                            {data.verified && <svg style={{
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
                                            }}>{formatedDate(data.createdAt)}</div>
                                        </div>

                                        <div style={{
                                            width: '95%',
                                            fontSize: '1.33vh',
                                            marginLeft: '3%',
                                            lineHeight: '1.78vh',
                                            letterSpacing: '0.09vh',
                                        }}>{data.isRetweet ? "ReTweet" : ""} {data.content}</div>

                                        {data.attachments.length > 0 && <div style={{
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: '1.78vh',
                                        }}>
                                            {data.attachments.map((attachment, index) => {
                                                return attachment?.type === 'image' ? (
                                                    <img key={index} src={attachment.url} onClick={() => {
                                                        setOpenImgContainer(true);
                                                        setSelectedImg(attachment.url);
                                                    }} style={{
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
                                                ) : <img key={index} src={attachment.url} onClick={() => {
                                                    setOpenImgContainer(true);
                                                    setSelectedImg(attachment.url);
                                                }} style={{
                                                    width: '100%',
                                                    height: 'auto',
                                                    borderRadius: '0.89vh',
                                                    objectFit: 'cover',
                                                    maxHeight: '35.56vh',
                                                    maxWidth: '35.56vh',
                                                    marginBottom: '0.89vh',
                                                    boxShadow: '0px 0px 0.89vh rgba(0, 0, 0, 0.5)'
                                                }} />;
                                            })}
                                        </div>}

                                        <div style={{
                                            marginBottom: '-0.53vh',
                                            display: 'flex',
                                            width: '80%',
                                            justifyContent: 'space-between',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.53vh',
                                            }} onClick={async () => {
                                                if (postRepliesdata.length > 0 && postRepliesdata.find((t) => t._id === data._id) && !data.retweetCount.includes(phoneSettings._id)) {
                                                    setPostRepliesData(postRepliesdata.map((t) => {
                                                        if (t._id === data._id) {
                                                            return {
                                                                ...t,
                                                                retweetCount: [...t.retweetCount, phoneSettings._id]
                                                            }
                                                        }
                                                        return t;
                                                    }));
                                                    await fetchNui('retweetRepostTweet', JSON.stringify({
                                                        tweetId: data._id,
                                                        retweet: true,
                                                        pigeonId: phoneSettings.pigeonIdAttached
                                                    }));
                                                }
                                            }}>
                                                <svg className='clickanimationXl' width="2.04vh" height="1.11vh" viewBox="0 0 25 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M6.25 0C5.58696 0 4.95107 0.263392 4.48223 0.732233C4.01339 1.20107 3.75 1.83696 3.75 2.5V10H0L5 15L10 10H6.25V2.5H15L17.5 0H6.25ZM18.75 5H15L20 0L25 5H21.25V12.5C21.25 13.163 20.9866 13.7989 20.5178 14.2678C20.0489 14.7366 19.413 15 18.75 15H7.5L10 12.5H18.75V5Z" fill={data.retweetCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{data.retweetCount.length}</div>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.53vh',
                                            }} onClick={async () => {
                                                setPostRepliesData(postRepliesdata.map((t) => {
                                                    if (t._id === data._id) {
                                                        return {
                                                            ...t,
                                                            likeCount: t.likeCount.includes(phoneSettings.pigeonIdAttached) ? t.likeCount.filter((id) => id !== phoneSettings.pigeonIdAttached) : [...t.likeCount, phoneSettings.pigeonIdAttached]
                                                        }
                                                    }
                                                    return t;
                                                }));
                                                await fetchNui('likeRepostTweet', JSON.stringify({
                                                    tweetId: data._id,
                                                    like: !data.likeCount.includes(phoneSettings.pigeonIdAttached),
                                                    email: phoneSettings.pigeonIdAttached
                                                }));
                                            }}>
                                                <svg className='clickanimationXl' width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M11.3333 0C10.0275 0 8.84701 0.603333 8 1.57571C7.15308 0.603424 5.97249 0 4.66667 0C2.08936 0 0 2.35052 0 5.25C0 8.14948 2.66667 10.5 8 15C13.3333 10.5 16 8.14948 16 5.25C16 2.35052 13.9106 0 11.3333 0Z" fill={data.likeCount.includes(phoneSettings.pigeonIdAttached) ? "#E22514" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '1.24vh', fontWeight: 500 }}>{data.likeCount.length}</div>
                                            </div>
                                            {data.email === phoneSettings.pigeonIdAttached && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.53vh',
                                                }} onClick={() => handleDeletePostTweet(data)}>
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
                    </div>
                </div>}
                <svg style={{ position: 'fixed', bottom: '0.89vh', right: '0.89vh' }} className='clickanimation' onClick={() => {
                    setLocation({
                        app: 'pigeon',
                        page: {
                            ...location.page,
                            pigeon: 'createnew'
                        }
                    })
                }} width="5.09vh" height="5.09vh" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M55 27.5C55 42.6878 42.6878 55 27.5 55C12.3122 55 0 42.6878 0 27.5C0 12.3122 12.3122 0 27.5 0C42.6878 0 55 12.3122 55 27.5Z" fill="#0A84FF" />
                    <path d="M36.9201 16.7538L32.2727 18.1167L34.1543 16.8325C32.9664 17.1031 31.4656 17.6326 29.5795 18.487L26.5008 21.7235L27.5935 19.4627C26.5371 20.0552 25.4172 20.8319 24.3381 21.7417L23.6217 24.6814L23.4675 22.5052C22.402 23.4928 21.4 24.59 20.5703 25.7467C19.6984 26.9582 19.0169 28.2384 18.6755 29.5139L17.4005 28.6544C17.5148 29.7379 17.868 30.6797 18.4474 31.5438L16.9231 31.0729C17.2695 32.1473 17.8358 32.8422 18.7934 33.4046C18.257 34.927 18.0054 36.518 17.7351 38.1044L18.5694 38.2462C19.537 28.5218 26.3648 22.3224 32.5357 19.5756L32.8485 20.3702C27.3306 22.8619 23.0413 27.068 20.797 33.1302C21.6176 33.1348 22.4202 33.0342 23.1638 32.8422L23.3859 30.058L23.9799 32.5953C24.4741 32.4125 24.9275 32.193 25.331 31.937L24.3925 29.9482L25.8797 31.5392C26.2424 31.2466 26.5416 30.9175 26.7683 30.5563C28.1467 28.3847 29.5885 26.2267 32.4269 24.4209L30.3548 23.6802L33.5332 23.7762C34.05 23.5111 34.5941 23.1865 35.0067 22.8801L32.7533 22.6973L36.1402 21.8926C36.4032 21.6274 36.6481 21.3486 36.8702 21.0697C37.6546 20.0666 38.1851 19.0224 38.0582 18.0728C37.9992 17.5978 37.7181 17.1511 37.2602 16.9011C37.1468 16.8416 37.0244 16.789 36.9201 16.7538Z" fill="white" />
                    <path d="M30.2923 30.1231C30.5861 30.1231 30.8242 30.3612 30.8242 30.6549V33.3143H33.4835C33.7773 33.3143 34.0154 33.5524 34.0154 33.8462C34.0154 34.1399 33.7773 34.378 33.4835 34.378H30.8242V37.0374C30.8242 37.3311 30.5861 37.5692 30.2923 37.5692C29.9986 37.5692 29.7604 37.3311 29.7604 37.0374V34.378H27.1011C26.8074 34.378 26.5692 34.1399 26.5692 33.8462C26.5692 33.5524 26.8074 33.3143 27.1011 33.3143H29.7604V30.6549C29.7604 30.3612 29.9986 30.1231 30.2923 30.1231Z" fill="white" />
                </svg>
                <CreateNewReply show={showCreateNewReply} tweetId={selectedPost._id} isReply={false} onSend={() => {
                    setShowCreateNewReply(false);
                }} onCancel={() => {
                    setShowCreateNewReply(false);
                }} />
                <Profile show={showProfile} email={selectedEmail} onClose={() => {
                    setShowProfile(false);
                }} onError={() => {
                    setShowProfile(false);
                }} onFollowersClick={() => {
                    // Store the user email for the followers/following component
                    // This would need to be passed up to the parent component
                    setLocation({
                        app: 'pigeon',
                        page: { ...location.page, pigeon: 'followers' }
                    });
                }} onFollowingClick={() => {
                    // Store the user email for the followers/following component
                    // This would need to be passed up to the parent component
                    setLocation({
                        app: 'pigeon',
                        page: { ...location.page, pigeon: 'following' }
                    });
                }} onReplyClick={async (tweet) => {
                    const res = await fetchNui('getReplies', tweet._id);
                    setSelectedPost(tweet);
                    if (res) {
                        setPostRepliesData(JSON.parse(res as string));
                    }
                }} onRetweetClick={async (tweet) => {
                    if (!tweet.retweetCount.includes(phoneSettings._id)) {
                        setTweets(tweets.map((t) => {
                            if (t._id === tweet._id) {
                                return {
                                    ...t,
                                    retweetCount: [...t.retweetCount, phoneSettings._id]
                                }
                            }
                            return t;
                        }))
                        await fetchNui('retweetTweet', JSON.stringify({
                            tweetId: tweet._id,
                            retweet: true,
                            pigeonId: phoneSettings.pigeonIdAttached
                        }))
                    }
                }} onLikeClick={async (tweet) => {
                    setTweets(tweets.map((t) => {
                        if (t._id === tweet._id) {
                            return {
                                ...t,
                                likeCount: t.likeCount.includes(phoneSettings.pigeonIdAttached) ? t.likeCount.filter((id) => id !== phoneSettings.pigeonIdAttached) : [...t.likeCount, phoneSettings.pigeonIdAttached]
                            }
                        }
                        return t;
                    }))
                    await fetchNui('likeTweet', JSON.stringify({
                        tweetId: tweet._id,
                        like: !tweet.likeCount.includes(phoneSettings.pigeonIdAttached),
                        email: phoneSettings.pigeonIdAttached
                    }))
                }} onMessageClick={props.onMessageClick} />
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