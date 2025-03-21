import { Avatar, Image, SegmentedControl, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { useEffect, useState } from "react";
import { TweetData } from "../../../../../types/types";
import InfiniteScroll from "react-infinite-scroll-component";
import { usePhone } from "../../../store/store";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

export default function Home(props: {
    location: string, profileData: {
        _id: string;
        email: string;
        password: string;
        displayName: string;
        avatar: string;
        notificationsEnabled: boolean;
    }
}) {
    const { phoneSettings } = usePhone();

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
        setTweets(prev => [tweetData, ...prev]);
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
    }, [filter]);

    const loadMore = () => {
        const newStart = end + 1;
        const newEnd = end + 20;
        setStart(newStart);
        setEnd(newEnd);
        fetchTweets(newStart, newEnd);
    };

    return (
        <Transition
            mounted={props.location === "home"}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
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
                    <Avatar size={"1.6vw"} src={props.profileData.avatar.length > 0 ? props.profileData.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} style={{
                        position: 'absolute',
                        left: '3%',
                        bottom: '25%',
                    }} />
                    <svg style={{ marginBottom: '4%' }} width="1.5vw" height="1.5vw" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M31.3459 2.24898C31.064 2.03273 30.6701 1.65301 30.461 1.36536C30.053 0.806071 29.2755 0.0164045 28.128 0.000319091C26.3478 -0.0260636 23.7767 1.58289 23.5791 5.07759C23.3809 8.57222 21.1399 13.7145 19.4911 14.8356C17.8422 15.9554 15.0079 19.8459 10.8542 21.1646C6.70049 22.4827 1.49198 23.3399 1.5576 24.7236C1.61037 25.8364 5.70165 25.6298 7.31194 25.5056C7.66656 25.4779 7.68264 25.5481 7.35057 25.6755C5.57687 26.3506 0.491254 28.383 0.436537 29.4713C0.370849 30.79 6.76618 27.361 11.6452 27.0984C16.5242 26.8345 19.1938 26.5378 20.5788 28.9107C20.5788 28.9107 20.8511 29.3496 21.3492 29.8484C21.3492 29.8484 21.5556 30.1423 21.5793 30.1842L21.6292 30.3072C21.7469 30.5978 21.7578 30.9208 21.66 31.2187C21.3659 31.267 21.0551 31.3325 20.7982 31.4433C20.4713 31.5843 20.5067 31.8005 20.7435 31.7451C20.9804 31.6911 21.1722 31.7502 21.1722 31.877C21.1722 32.0051 21.4289 31.9762 21.7566 31.8378C22.1459 31.673 22.6221 31.5083 22.8204 31.5804C22.9492 31.6267 23.0482 31.7072 23.1236 31.7915C23.2606 31.9434 23.0264 32.0791 22.6718 32.1056C22.3731 32.1281 22.0217 32.1886 21.734 32.3341C21.4174 32.4962 21.5526 32.7048 21.9027 32.6442C22.4684 32.549 23.2567 32.448 23.5785 32.569C24.1056 32.7666 25.5234 33.1952 26.6117 32.8985C27.3647 32.6938 28.1338 32.4725 28.711 32.3554C29.0593 32.2852 29.6038 31.9769 29.3205 31.8817C29.2112 31.845 29.0413 31.8185 28.787 31.8115C27.9169 31.7864 27.2154 32.0992 26.5693 32.0703C26.214 32.0542 26.1387 31.6828 26.4361 31.4884C26.6504 31.3475 26.9355 31.2059 27.292 31.1242C27.6389 31.045 27.7348 30.8171 27.3918 30.7232C27.115 30.6466 26.7147 30.6228 26.1496 30.7573C25.1605 30.9916 24.3283 30.9852 23.7504 30.6775C23.2676 30.2638 22.9387 29.7055 22.7636 29.0942C22.7435 29.0241 22.7285 28.9773 22.7222 28.9699C22.6662 27.8842 23.2362 26.3577 24.995 24.9547C27.5997 22.8779 29.9069 21.6904 30.6322 18.7235C31.3575 15.7572 29.3464 7.61397 29.3464 7.61397C29.3464 7.61397 29.0149 6.31071 29.1752 5.10976C29.2221 4.7577 29.47 4.23125 29.7525 4.01629C30.1161 3.73826 30.7262 3.45962 31.6492 3.56643C32.0025 3.60762 32.2335 3.4004 32.0662 3.08764C31.9303 2.83075 31.707 2.52505 31.3459 2.24898Z" fill="white" />
                        <circle cx="28.0978" cy="2.19538" r="0.439074" stroke="black" stroke-width="0.3" />
                    </svg>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '2vw',
                        marginTop: '-0.5vw'
                    }}>
                        <div onClick={() => {
                            setFilter('all');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '0.75vw', letterSpacing: '0.05vw', borderBottom: `1px solid ${filter === "all" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>All</div>
                        <div onClick={() => {
                            setFilter('following');
                        }} style={{ cursor: 'pointer', fontWeight: '500', width: '40%', textAlign: 'center', fontSize: '0.75vw', letterSpacing: '0.05vw', borderBottom: `1px solid ${filter === "following" ? '#0A84FF' : 'rgba(0,0,0,0)'}` }}>Following</div>
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
                        {tweets && tweets.map((tweet, index) => {
                            return (
                                <div key={index} style={{
                                    width: '16.2vw',
                                    height: 'auto',
                                    backgroundColor: 'rgba(255, 255, 255, 0.19)',
                                    display: 'flex',
                                    alignItems: 'start',
                                    padding: '0.5vw',
                                    borderRadius: '0.5vw',
                                    marginTop: '1vw',
                                }}>
                                    <Avatar mt={'0.2vw'} size={"1.4vw"} src={tweet.avatar.length > 0 ? tweet.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} />
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
                                                fontSize: '0.75vw',
                                                letterSpacing: '0.05vw',
                                                lineHeight: '1vw',
                                            }}>{tweet.username}</div>

                                            {tweet.verified && <svg style={{
                                                marginTop: '0.05vw',
                                                marginLeft: '0.2vw'
                                            }} width="0.8333333333333334vw" height="0.78125vw" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                                <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                                            </svg>}

                                            <div style={{
                                                fontWeight: '500',
                                                fontSize: '0.45vw',
                                                letterSpacing: '0.05vw',
                                                position: 'absolute',
                                                right: '0',
                                                marginTop: '0.05vw',
                                            }}>{formatedDate(tweet.createdAt)}</div>
                                        </div>

                                        <div style={{
                                            width: '95%',
                                            fontSize: '0.75vw',
                                            marginLeft: '3%',
                                            lineHeight: '1vw',
                                            letterSpacing: '0.05vw',
                                        }}>{tweet.isRetweet ? "ReTweet" : ""} {tweet.content}</div>

                                        {tweet.attachments.length > 0 && <div style={{
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginTop: '1vw',
                                        }}>
                                            {tweet.attachments.map((attachment, index) => {
                                                return <img key={index} src={attachment} style={{
                                                    width: '100%',
                                                    height: 'auto',
                                                    borderRadius: '0.5vw',
                                                    objectFit: 'cover',
                                                    maxHeight: '20vw',
                                                    maxWidth: '20vw',
                                                    marginBottom: '0.5vw',
                                                    boxShadow: '0px 0px 0.5vw rgba(0, 0, 0, 0.5)'
                                                }} />
                                            })}
                                        </div>}

                                        <div style={{
                                            marginBottom: '-0.3vw',
                                            display: 'flex',
                                            gap: '3vw',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3vw',
                                            }}>
                                                <svg className='clickanimationXl' width="0.78125vw" height="0.78125vw" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M7.46822 0C2.99976 0 -0.551448 3.8453 0.0710452 8.34385C0.467791 11.2104 2.64202 13.6172 5.48974 14.3762C6.55023 14.659 7.64522 14.7189 8.74471 14.5292C9.6627 14.3702 10.6047 14.4414 11.5039 14.6664L12.5967 14.9394C14.0134 15.2942 15.3004 14.0334 14.9381 12.6444C14.9381 12.6444 14.7356 11.8674 14.7296 11.8426C14.5031 10.9726 14.4544 10.0539 14.6884 9.1861C14.9779 8.11659 15.0266 6.95182 14.7664 5.74505C14.0779 2.56126 11.1544 0 7.46822 0ZM7.46822 1.50002C10.4322 1.50002 12.7534 3.53255 13.3002 6.06233C13.5004 6.98934 13.4802 7.90811 13.2409 8.79462C12.2284 12.5387 15.1886 14.0417 11.8677 13.2107C10.7629 12.9347 9.6117 12.8567 8.48896 13.0509C7.62272 13.2009 6.74523 13.1582 5.87599 12.9272C3.60576 12.3219 1.86953 10.3974 1.55678 8.13836C1.05353 4.49782 3.9515 1.50002 7.46822 1.50002Z" fill={tweet.repliesCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '0.7vw', fontWeight: 500 }}>{tweet.repliesCount.length}</div>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3vw',
                                            }} onClick={async () => {
                                                if (!tweet.retweetCount.includes(phoneSettings._id)) {
                                                    setTweets(tweets.map((t, i) => {
                                                        if (i === index) {
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
                                                <svg className='clickanimationXl' width="1.1458333333333333vw" height="0.625vw" viewBox="0 0 25 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M6.25 0C5.58696 0 4.95107 0.263392 4.48223 0.732233C4.01339 1.20107 3.75 1.83696 3.75 2.5V10H0L5 15L10 10H6.25V2.5H15L17.5 0H6.25ZM18.75 5H15L20 0L25 5H21.25V12.5C21.25 13.163 20.9866 13.7989 20.5178 14.2678C20.0489 14.7366 19.413 15 18.75 15H7.5L10 12.5H18.75V5Z" fill={tweet.retweetCount.includes(phoneSettings._id) ? "#0A84FF" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '0.7vw', fontWeight: 500 }}>{tweet.retweetCount.length}</div>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3vw',
                                            }} onClick={async () => {
                                                setTweets(tweets.map((t, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...t,
                                                            likeCount: t.likeCount.includes(phoneSettings._id) ? t.likeCount.filter((id) => id !== phoneSettings._id) : [...t.likeCount, phoneSettings._id]
                                                        }
                                                    }
                                                    return t;
                                                }))
                                                await fetchNui('likeTweet', JSON.stringify({
                                                    tweetId: tweet._id,
                                                    like: !tweet.likeCount.includes(phoneSettings._id)
                                                }))
                                            }}>
                                                <svg className='clickanimationXl' width="0.8333333333333334vw" height="0.78125vw" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M11.3333 0C10.0275 0 8.84701 0.603333 8 1.57571C7.15308 0.603424 5.97249 0 4.66667 0C2.08936 0 0 2.35052 0 5.25C0 8.14948 2.66667 10.5 8 15C13.3333 10.5 16 8.14948 16 5.25C16 2.35052 13.9106 0 11.3333 0Z" fill={tweet.likeCount.includes(phoneSettings._id) ? "#E22514" : "#828282"} />
                                                </svg>
                                                <div style={{ fontSize: '0.7vw', fontWeight: 500 }}>{tweet.likeCount.length}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </InfiniteScroll>
                </div>
            </div>}
        </Transition>
    )
}