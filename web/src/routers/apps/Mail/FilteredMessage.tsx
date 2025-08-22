import { Avatar, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import Searchbar from "../../components/SearchBar";
import { useState } from "react";
import Title from "../../components/Title";
import { PhoneMailMessage } from "../../../../../types/types";

export default function FilteredMessage(props: { show: boolean, messages: any, onMessageClick: (messageData: PhoneMailMessage) => void }) {
    const { location, setLocation } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [selectedTab, setSelectedTab] = useState('inbox');
    const totalUnreadMessages = props.messages && props.messages.filter((message: any) => message.read === false).length || 0;

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
    }

    return (
        <Transition
            mounted={props.show}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '100%',
                position: 'absolute',
                backgroundColor: '#0E0E0E',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div style={{
                    width: '90%',
                }}>
                    <svg style={{
                        marginTop: '4.44vh',
                        cursor: 'pointer',
                    }} onClick={() => {
                        setLocation({
                            app: 'mail',
                            page: {
                                ...location.page,
                                mail: ''
                            }
                        })
                    }} width="6.30vh" height="1.87vh" viewBox="0 0 59 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.99989 16L1.34972 8.93729C1.1452 8.68163 1.1452 8.31837 1.34972 8.06271L6.99989 1" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        <path d="M21.6561 13H20.08V7.29297H20.0331L17.7362 12.918H16.6229L14.3261 7.29297H14.2792V13H12.703V4.54492H14.7538L17.1561 10.5391H17.203L19.6054 4.54492H21.6561V13ZM25.8011 11.8633C26.5452 11.8633 27.1604 11.377 27.1604 10.6973V10.2402L25.8362 10.3223C25.1975 10.3691 24.8343 10.6562 24.8343 11.1016C24.8343 11.5703 25.221 11.8633 25.8011 11.8633ZM25.2386 13.0996C24.0433 13.0996 23.135 12.3262 23.135 11.1953C23.135 10.0527 24.014 9.39062 25.5784 9.29688L27.1604 9.20312V8.78711C27.1604 8.20117 26.7503 7.86133 26.1058 7.86133C25.4671 7.86133 25.0628 8.17773 24.9808 8.64062H23.4163C23.4808 7.42188 24.5179 6.58398 26.1819 6.58398C27.7933 6.58398 28.8421 7.41602 28.8421 8.68164V13H27.1897V12.0391H27.1546C26.803 12.707 26.0237 13.0996 25.2386 13.0996ZM30.5788 13V6.71875H32.2897V13H30.5788ZM31.4343 6.02734C30.9186 6.02734 30.5202 5.63477 30.5202 5.14258C30.5202 4.64453 30.9186 4.25781 31.4343 4.25781C31.9499 4.25781 32.3483 4.64453 32.3483 5.14258C32.3483 5.63477 31.9499 6.02734 31.4343 6.02734ZM34.0733 13V4.54492H35.7843V13H34.0733ZM41.271 13.0996C40.3511 13.0996 39.6479 12.6543 39.3022 11.9219H39.2671V13H37.5796V4.54492H39.2905V7.80859H39.3257C39.6714 7.06445 40.3686 6.61914 41.2651 6.61914C42.8472 6.61914 43.8198 7.83203 43.8198 9.85938C43.8198 11.8809 42.853 13.0996 41.271 13.0996ZM40.6792 7.99023C39.853 7.99023 39.2847 8.73438 39.2847 9.85938C39.2847 10.9961 39.8472 11.7227 40.6792 11.7227C41.5347 11.7227 42.0679 11.0078 42.0679 9.85938C42.0679 8.7168 41.5288 7.99023 40.6792 7.99023ZM48.1933 13.1348C46.2948 13.1348 45.0819 11.916 45.0819 9.85352C45.0819 7.82031 46.3124 6.58398 48.1933 6.58398C50.0741 6.58398 51.3046 7.81445 51.3046 9.85352C51.3046 11.9219 50.0917 13.1348 48.1933 13.1348ZM48.1933 11.8281C49.0311 11.8281 49.5643 11.1191 49.5643 9.85938C49.5643 8.61133 49.0253 7.89062 48.1933 7.89062C47.3612 7.89062 46.8163 8.61133 46.8163 9.85938C46.8163 11.1191 47.3495 11.8281 48.1933 11.8281ZM55.221 10.8203H55.1858L54.0081 13H52.2093L54.178 9.87109L52.221 6.71875H54.1487L55.2796 8.83984H55.3147L56.428 6.71875H58.2913L56.3284 9.82422L58.2737 13H56.4163L55.221 10.8203Z" fill="#0A84FF" />
                    </svg>
                </div>
                <Title title={location.page.mail[0]?.toUpperCase() + location.page.mail?.slice(1)} />
                <Searchbar onChange={(e) => {
                    setSearchValue(e);
                }} value={searchValue} mt="" />
                <div style={{
                    width: '90%',
                    display: 'flex',
                    marginTop: '0.71vh',
                    gap: '0.53vh',
                }}>
                    <div style={{
                        height: '3.52vh',
                        background: selectedTab === 'inbox' ? '#0A84FF' : 'rgba(255, 255, 255, 0.11)',
                        borderRadius: '1.48vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '1.96vh',
                        gap: '0.36vh',
                        transition: '0.2s all ease',
                    }} onClick={() => {
                        setSelectedTab('inbox');
                    }}>
                        <svg style={{ transition: '0.2s all ease' }} width={selectedTab === 'inbox' ? '0.93vh' : '1.48vh'} height={selectedTab === 'inbox' ? '0.93vh' : '1.48vh'} opacity={selectedTab === 'inbox' ? '1' : '0.3'} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.99989 8.54167V9C9.99989 9.54167 9.54156 10 8.99989 10H0.999893C0.458227 10 -0.000106812 9.54167 -0.000106812 9V8.54167C-0.000106812 7.33333 1.41656 6.58333 2.74989 6L2.87489 5.9375C2.97906 5.89583 3.08323 5.89583 3.18739 5.95833C3.72906 6.3125 4.33323 6.5 4.97906 6.5C5.62489 6.5 6.24989 6.29167 6.77073 5.95833C6.87489 5.89583 6.97906 5.89583 7.08323 5.9375L7.20823 6C8.58323 6.58333 9.99989 7.3125 9.99989 8.54167ZM4.99989 0C6.37489 0 7.47906 1.22917 7.47906 2.75C7.47906 4.27083 6.37489 5.5 4.99989 5.5C3.62489 5.5 2.52073 4.27083 2.52073 2.75C2.52073 1.22917 3.62489 0 4.99989 0Z" fill="white" />
                        </svg>
                        {selectedTab === 'inbox' ? <div style={{
                            fontStyle: 'normal',
                            fontWeight: 500,
                            fontSize: '1.30vh',
                            lineHeight: '0.93vh',
                            letterSpacing: '0.02em',
                            color: '#FFFFFF',
                        }}>Primary</div> : <></>}
                    </div>
                    <div style={{
                        height: '3.52vh',
                        background: selectedTab === 'social' ? '#0A84FF' : 'rgba(255, 255, 255, 0.11)',
                        borderRadius: '1.48vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '1.96vh',
                        gap: '0.36vh',
                        transition: '0.2s all ease',
                    }} onClick={() => {
                        setSelectedTab('social');
                    }}>
                        <svg style={{ transition: '0.2s all ease', }} width={selectedTab === 'social' ? '1.48vh' : '1.48vh'} height={selectedTab === 'social' ? '1.13vh' : '1.48vh'} opacity={selectedTab === 'social' ? '1' : '0.3'} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.99988 14C3.44788 14 2.99988 14.448 2.99988 15C2.99988 15.552 3.44788 16 3.99988 16C4.55188 16 4.99988 15.552 4.99988 15C4.99988 14.448 4.55188 14 3.99988 14Z" fill="white" fillOpacity="1" />
                            <path d="M13.354 14C12.802 14 12.354 14.448 12.354 15C12.354 15.552 12.802 16 13.354 16C13.906 16 14.354 15.552 14.354 15C14.354 14.448 13.906 14 13.354 14Z" fill="white" fillOpacity="1" />
                            <path d="M15.9999 2.66667L2.46559 1.31858C2.39775 1.02808 2.28354 0.70775 1.97234 0.457458C1.58425 0.145375 0.957461 0 -0.00012207 0V0.666708C0.775461 0.666708 1.2985 0.771125 1.55454 0.977C1.74029 1.12637 1.78971 1.32796 1.85309 1.64321L1.85209 1.64338L3.60425 11.3783C3.70479 11.9792 3.904 12.4287 4.15804 12.7527C4.46 13.138 4.85542 13.3333 5.33321 13.3333H15.3332V12.6667H5.33321C5.13625 12.6667 4.53588 12.6718 4.26034 11.2602L4.03413 10.0035L15.3332 8L15.9999 2.66667Z" fill="white" fillOpacity="1" />
                        </svg>
                        {selectedTab === 'social' ? <div style={{
                            fontStyle: 'normal',
                            fontWeight: 500,
                            fontSize: '1.30vh',
                            lineHeight: '0.93vh',
                            letterSpacing: '0.02em',
                            color: '#FFFFFF',
                        }}>Social</div> : <></>}
                    </div>
                    <div style={{
                        height: '3.52vh',
                        background: selectedTab === 'server' ? '#0A84FF' : 'rgba(255, 255, 255, 0.11)',
                        borderRadius: '1.48vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '1.96vh',
                        gap: '0.36vh',
                        transition: '0.2s all ease',
                    }} onClick={() => {
                        setSelectedTab('server');
                    }}>
                        <svg style={{ transition: '0.2s all ease', }} width={selectedTab === 'server' ? '1.48vh' : '1.48vh'} height={selectedTab === 'server' ? '1.13vh' : '1.48vh'} opacity={selectedTab === 'server' ? '1' : '0.3'} viewBox="0 0 18 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.6249 1.59563C14.6249 1.17244 14.8027 0.766589 15.1191 0.46735C15.4356 0.168111 15.8648 0 16.3124 0C16.7599 0 17.1892 0.168111 17.5056 0.46735C17.8221 0.766589 17.9999 1.17244 17.9999 1.59563V13.2969C17.9999 13.7201 17.8221 14.126 17.5056 14.4252C17.1892 14.7245 16.7599 14.8926 16.3124 14.8926C15.8648 14.8926 15.4356 14.7245 15.1191 14.4252C14.8027 14.126 14.6249 13.7201 14.6249 13.2969V1.59563ZM13.4999 2.36579C11.1745 3.37636 8.3935 3.94121 5.62488 4.12737V10.762C6.03352 10.7838 6.44162 10.8139 6.84888 10.8524C9.1585 11.0694 11.3916 11.563 13.4999 12.5119V2.36579ZM4.49988 10.7067V4.18481C3.73488 4.21353 2.926 4.23055 2.24088 4.24119C1.64501 4.249 1.07623 4.47781 0.657061 4.87833C0.237894 5.27886 0.00188581 5.81905 -0.00012207 6.38253L-0.00012207 8.51003C-0.00012207 9.68655 1.00788 10.6333 2.24313 10.6471C2.42914 10.6493 2.61514 10.6522 2.80113 10.6556C3.36757 10.6663 3.93386 10.6833 4.49988 10.7067ZM6.06363 11.8566C6.38425 11.8789 6.70375 11.9066 7.01988 11.9396L7.3045 13.7373C7.33547 13.8912 7.33014 14.0496 7.28888 14.2013C7.24762 14.3529 7.17145 14.4941 7.06581 14.6147C6.96017 14.7353 6.82767 14.8324 6.67776 14.899C6.52786 14.9656 6.36425 15.0001 6.19863 15H5.58213C5.36345 15 5.14952 14.9397 4.96651 14.8265C4.78349 14.7134 4.63932 14.5522 4.55163 14.3628L3.07338 11.7247C3.70816 11.7397 4.34271 11.7624 4.97688 11.7928C5.34475 11.8109 5.70813 11.8321 6.06363 11.8566Z" fill="white" fillOpacity="1" />
                        </svg>
                        {selectedTab === 'server' ? <div style={{
                            fontStyle: 'normal',
                            fontWeight: 500,
                            fontSize: '1.30vh',
                            lineHeight: '0.93vh',
                            letterSpacing: '0.02em',
                            color: '#FFFFFF',
                        }}>Announce</div> : <></>}
                    </div>
                </div>
                <div style={{
                    width: '95%',
                    height: '62.5%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    marginTop: '0.89vh',
                }}>
                    {props.messages && props.messages?.filter(
                        (message: PhoneMailMessage) => message.tags.includes(location.page.mail) && message.tags.includes(selectedTab) && (message.subject.toLowerCase().includes(searchValue.toLowerCase()) || message.message.toLowerCase().includes(searchValue.toLowerCase()))
                    ).map((message: PhoneMailMessage, index: number) => {
                        return (
                            <>
                                <div className="mainMailBox" key={index} onClick={() => {
                                    props.onMessageClick(message);
                                }}>
                                    <Avatar src={message.avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} size="3.24vh" radius="lg" />
                                    <div className="mailsemiContainer">
                                        <div className="titleCont">
                                            <div className="title">{message.subject}</div>
                                            <div className="dateTime">{formatedDate(message.date)} <svg xmlns="http://www.w3.org/2000/svg" width="6" height="12" viewBox="0 0 6 12" fill="none">
                                                <path d="M0.999878 11L4.65005 6.43729C4.85457 6.18163 4.85457 5.81837 4.65005 5.56271L0.999877 0.999999" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                            </svg></div>
                                        </div>
                                        <div className="description">
                                            {message.message}
                                        </div>
                                    </div>
                                </div>
                                <div className="divider" style={{ marginBottom: '0.71vh' }} key={index + '_dadsa'} />
                            </>
                        )
                    })}
                </div>
                <div style={{
                    width: '100%',
                    height: '8.5%',
                    position: 'absolute',
                    bottom: '0',
                    backgroundColor: '#1A1A1A',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }} className="footer">
                    <div style={{
                        color: 'rgba(255, 255, 255, 1)',
                        fontSize: '1.30vh',
                        fontStyle: 'normal',
                        fontWeight: 700,
                        lineHeight: 'normal',
                        letterSpacing: '0.06vh',
                    }}>{totalUnreadMessages} Unread Messages</div>
                    <svg style={{
                        position: 'absolute',
                        right: '1.78vh',
                        top: '10%',
                    }} onClick={() => {
                        setLocation({
                            app: 'mail',
                            page: {
                                ...location.page,
                                mail: 'compose'
                            }
                        });
                    }} className='clickanimation' xmlns="http://www.w3.org/2000/svg" width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none">
                        <path d="M19.0004 22.9566H1.0001V5.21684H15.0074L16.0076 4.17347H-0.00012207V24H20.0001V8.34L19.0004 9.38337V22.9566Z" fill="#0A84FF" />
                        <path d="M10.8517 14.3533L10.2451 13.7204L20.9523 2.54716L20.2449 1.80884L9.00005 13.5423V15.6518H11.0137L22.2663 3.91453L21.5589 3.17874L10.8517 14.3533ZM23.7639 1.06358L22.9845 0.250737C22.8122 0.0896513 22.5898 0.000471931 22.3593 0C22.1211 0 21.9033 0.096 21.7389 0.251368L20.9793 1.04337L20.9847 1.04842L23.0043 3.156L23.7633 2.36337C23.9156 2.18486 23.9999 1.9534 23.9999 1.71347C23.9999 1.47355 23.9156 1.24208 23.7633 1.06358H23.7639Z" fill="#0A84FF" />
                    </svg>
                </div>
            </div>}
        </Transition>
    );
}