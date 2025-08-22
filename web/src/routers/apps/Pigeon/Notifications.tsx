import { Avatar, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import { useState } from "react";
import { TweetProfileData } from "../../../../../types/types";

export default function Notifications(props: { show: boolean, profileData: TweetProfileData }) {
    const { phoneSettings } = usePhone();
    const [notificationsData, setNotificationdata] = useState<{
        _id: string,
        email: string,
        content: string,
        type: string,
        createdAt: string,
    }[]>([]);
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

    return (
        <Transition
            mounted={props.show}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                const res = await fetchNui('getNotifications', phoneSettings.pigeonIdAttached);
                setNotificationdata(JSON.parse(res as string))
            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '91%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'absolute',
                zIndex: 1,
                backgroundColor: 'black',
            }}>
                <div style={{
                    width: '100%',
                    height: '14%',
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

                    }} />
                    <div style={{
                        position: 'relative',
                        top: '-1.78vh',
                        marginLeft: '0.89vh',
                    }}>
                        <div>Notifications</div>
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    position: 'relative',
                }}>
                    {notificationsData.map((notification, index: number) => {
                        return <div key={index} style={{
                            width: '95%',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',

                            marginTop: '1%',
                            borderRadius: '0.89vh',
                            padding: '0.89vh',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.19)',
                        }}>
                            {notification.type === 'like' ? <svg width="1.85vh" height="1.76vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.3333 0C10.0275 0 8.84701 0.603333 8 1.57571C7.15308 0.603424 5.97249 0 4.66667 0C2.08936 0 0 2.35052 0 5.25C0 8.14948 2.66667 10.5 8 15C13.3333 10.5 16 8.14948 16 5.25C16 2.35052 13.9106 0 11.3333 0Z" fill="#E22514" />
                            </svg> : <svg width="1.85vh" height="1.85vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M7.46822 0C2.99976 0 -0.551448 3.8453 0.0710452 8.34385C0.467791 11.2104 2.64202 13.6172 5.48974 14.3762C6.55023 14.659 7.64522 14.7189 8.74471 14.5292C9.6627 14.3702 10.6047 14.4414 11.5039 14.6664L12.5967 14.9394C14.0134 15.2942 15.3004 14.0334 14.9381 12.6444C14.9381 12.6444 14.7356 11.8674 14.7296 11.8426C14.5031 10.9726 14.4544 10.0539 14.6884 9.1861C14.9779 8.11659 15.0266 6.95182 14.7664 5.74505C14.0779 2.56126 11.1544 0 7.46822 0ZM7.46822 1.50002C10.4322 1.50002 12.7534 3.53255 13.3002 6.06233C13.5004 6.98934 13.4802 7.90811 13.2409 8.79462C12.2284 12.5387 15.1886 14.0417 11.8677 13.2107C10.7629 12.9347 9.6117 12.8567 8.48896 13.0509C7.62272 13.2009 6.74523 13.1582 5.87599 12.9272C3.60576 12.3219 1.86953 10.3974 1.55678 8.13836C1.05353 4.49782 3.9515 1.50002 7.46822 1.50002Z" fill="#0A84FF" />
                            </svg>
                            }

                            <div style={{
                                width: '70%',
                                marginLeft: '3%',
                                fontSize: '1.24vh',
                            }}>{notification.content}</div>
                            <div style={{
                                width: '30%',
                                textAlign: 'right',
                                fontSize: '0.89vh',
                                color: 'rgba(255, 255, 255, 0.5)'
                            }}>{formatedDate(notification.createdAt)}</div>
                        </div>
                    })}
                </div>
            </div>}
        </Transition>
    )
}