import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import AlphabetSearch from "../../components/AlphabetSearch";
import { PhoneContacts } from "../../../../../types/types";
import Searchbar from "../../components/SearchBar";
import { fetchNui } from "../../../hooks/fetchNui";
import { Avatar } from "@mantine/core";
import dayjs from "dayjs";

/* interface Message {
    message: string;
    read: boolean;
    page: number;
    timestamp: string;
    senderId: string;
    attachments: { type: string; url: string }[];
}

interface Conversation {
    messages: Message[];
    avatar?: string | null;
    memberPhoneNumbers?: string[];
    hasMore: boolean;
    totalMessages: number;
} */

export default function FilteredPage3() {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [showContactsPortal, setShowContactsPortal] = useState(false);
    const [channelsData, setChannelsData] = useState<{
        type: "private" | "group",
        name: string,
        phoneNumber?: string,
        groupId?: string,
        members?: string[],
        avatar?: string,
        memberPhoneNumbers?: string[],
        lastMessage: {
            message: string,
            read: boolean,
            page: number,
            timestamp: Date,
            senderId: string,
            attachments: {
                type: string,
                url: string
            }[]
        }
    }[]>([]);

    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'message' && location.page.messages === 'unknown'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
            const res = await fetchNui('getMessagesChannels', JSON.stringify({}));
            const parsedData: {
                success: boolean;
                channels: {
                    type: "private" | "group",
                    name: string,
                    phoneNumber?: string,
                    groupId?: string,
                    members?: string[],
                    avatar?: string,
                    memberPhoneNumbers?: string[],
                    lastMessage: {
                        message: string,
                        read: boolean,
                        page: number,
                        timestamp: Date,
                        senderId: string,
                        attachments: {
                            type: string,
                            url: string
                        }[]
                    }
                }[]
            } = JSON.parse(res as string);
            setChannelsData(parsedData.channels);
        }}>
            <div ref={nodeRef} style={{
                backgroundColor: '#0E0E0E',
                width: '100%',
                height: '100%',
                zIndex: 10,
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }} className="message">
                <div className="topBar">
                    <div className="BackButton" onClick={() => {
                        const data = {
                            ...location.page,
                            messages: ''
                        }
                        setLocation({
                            app: 'message',
                            page: data
                        })
                    }} style={{ cursor: 'pointer' }}>
                        <svg width="0.4166666666666667vw" height="0.9375vw" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div className="text">Filters</div>
                    </div>
                    <div className="title">
                        Messages
                    </div>
                    <svg onClick={() => {
                        /* setShowContactsPortal(true); */
                    }} style={{ marginLeft: '4.5vw', cursor: 'pointer' }} width="0.9895833333333334vw" height="0.8854166666666666vw" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.0468 1.53577L6.88299 9.69963C6.82237 9.76025 6.79004 9.84108 6.79004 9.92595V10.997C6.79004 11.1748 6.93553 11.3162 7.10932 11.3162H8.17224C8.25711 11.3162 8.34198 11.2839 8.4026 11.2233L16.5705 3.05942C16.6958 2.93414 16.6958 2.73206 16.5705 2.60678L15.4995 1.53577C15.3742 1.41049 15.1721 1.41049 15.0468 1.53577ZM17.9284 0.767887L17.3465 0.185909L17.3384 0.177827C17.2131 0.0687058 17.0474 0 16.8736 0C16.6958 0 16.5301 0.0687057 16.4048 0.181868L15.9481 0.6426C15.8875 0.707265 15.8875 0.808302 15.9481 0.868925L16.3684 1.28924L17.2454 2.16625C17.3101 2.23091 17.4111 2.23091 17.4758 2.16625L17.9325 1.70956C18.0456 1.58427 18.1103 1.42261 18.1103 1.24074C18.1063 1.06292 18.0416 0.893174 17.9284 0.767887Z" fill="#0A84FF" />
                        <path d="M8.8105 11.8821C8.68925 12.0033 8.52355 12.072 8.35381 12.072H6.68062C6.32497 12.072 6.03398 11.781 6.03398 11.4254V9.74816C6.03398 9.57842 6.10268 9.41271 6.22393 9.29147L6.25626 9.25914L12.2215 3.29387C12.3226 3.19283 12.2498 3.01904 12.1084 3.01904H2.37237C1.06292 3.01904 0 4.08196 0 5.39141V14.4444C0 15.7538 1.06292 16.8168 2.37237 16.8168H12.7186C14.0281 16.8168 15.091 15.7538 15.091 14.4444V5.99764C15.091 5.85214 14.9172 5.78344 14.8162 5.88448L8.84283 11.8497L8.8105 11.8821Z" fill="#0A84FF" />
                    </svg>
                </div>
                <Searchbar mt="0.8vw" value={searchValue} onChange={setSearchValue} />
                <div className="messageContent">
                    {channelsData.filter(channel => {
                        return channel.name.match(/^[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/) && channel.name.toLowerCase().includes(searchValue.toLowerCase());
                    }).map((channel, index) => {

                        return (
                            <div className="innerChannel" style={{
                                marginTop: index === 0 ? '0vw' : '0.2vw',
                            }} key={index}>
                                <div className="channelContent" onClick={()=>{
                                    console.log(channel.groupId)
                                    const data = {
                                        ...location.page,
                                        messages: `details/${channel.phoneNumber}/${channel.groupId}`,
                                    }
                                    setLocation({
                                        app: 'message',
                                        page: data
                                    })
                                }}>
                                    <Avatar size="1.9791666666666667vw" src={channel.avatar} alt="" />
                                    <div className="messageCont">
                                        <div className="title">
                                            <div className="name">{channel.name}</div>
                                            <div className="timeStamp">
                                                <div className="text">{channel.lastMessage?.timestamp ? dayjs(new Date(channel.lastMessage?.timestamp)).format("hh:mm A") : ''}</div>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12" fill="none">
                                                    <path d="M1 11L6.35469 6.53775C6.69052 6.2579 6.69052 5.7421 6.35469 5.46225L1 1" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="description">
                                            {channel.lastMessage?.message}
                                        </div>
                                    </div>
                                </div>
                                {channelsData.length - 1 !== index && <div className="divider" style={{ width: '16vw' }} />}
                            </div>
                        )
                    })}

                </div>

                {/* <CSSTransition nodeRef={nodeRef} in={showContactsPortal} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
                    const data: string = await fetchNui('getContacts', JSON.stringify({}));
                    const parsedData: PhoneContacts[] = JSON.parse(data);
                    if (parsedData.length === 0) return;
                    const uniqueAlphabets = Array.from(
                        new Set(parsedData.map(contact => contact.firstName.charAt(0).toUpperCase()))
                    ).sort();

                    const contactsByAlphabet: { [key: string]: PhoneContacts[] } = {};
                    uniqueAlphabets.forEach(letter => {
                        contactsByAlphabet[letter] = parsedData.filter(contact => contact.firstName.charAt(0).toUpperCase() === letter);
                    });
                    setPhoneContacts(contactsByAlphabet);
                }}>
                    <div ref={nodeRef} style={{
                        width: '100%',
                        height: '82%',
                        position: 'absolute',
                        top: '6.5vw',
                        backgroundColor: 'rgba(0, 0, 0, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderTopLeftRadius: '1.0416666666666667vw',
                        borderTopRightRadius: '1.0416666666666667vw',
                    }}>
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginTop: '0.25vw',
                        }} >
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '.7vw',
                                color: '#0A84FF',
                                cursor: 'pointer',
                            }} onClick={() => {
                                setShowContactsPortal(false);
                            }}>
                                Cancel
                            </div>
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '0.7vw',
                                color: 'white',
                            }}>
                                Select Contact
                            </div>
                            <div style={{
                                width: '21%',
                                textAlign: 'end',
                                fontSize: '.7vw',
                                color: '#0A84FF',
                                fontWeight: 500
                            }}>
                                Done
                            </div>
                        </div>
                        <Searchbar mt="0.8vw" value={searchValue} onChange={(e: string) => {
                            setSearchValue(e);
                        }} />
                        <div className="phoneContacts">
                            {Object.keys(phoneContacts).filter(
                                letter => letter.includes(alphabetArrange) && phoneContacts[letter].filter((letter) =>
                                    letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                ).length > 0
                            ).map((letter, index) => {
                                return (
                                    <div key={index}>
                                        <div className="letter">
                                            <div style={{
                                                color: 'rgba(255, 255, 255, 0.40)',
                                                fontFamily: 'SFPro',
                                                fontSize: '0.78125vw',
                                                fontStyle: 'normal',
                                                fontWeight: 700,
                                                lineHeight: '118.596%',
                                                marginTop: index === 0 ? '' : '0.2125vw',
                                                letterSpacing: '0.01875vw',
                                            }}>
                                                {letter}
                                                <div style={{
                                                    width: '14.427083333333334vw',
                                                    height: '0.026041666666666668vw',
                                                    background: 'rgba(255, 255, 255, 0.15)',
                                                }} />
                                            </div>
                                            {phoneContacts[letter].filter((letter) =>
                                                letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                            ).map((contact, index) => {
                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        height: '1.39375vw',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'flex-start',
                                                        gap: '0.15625vw',
                                                        flexShrink: 0,
                                                        alignSelf: 'stretch',
                                                        cursor: 'pointer',
                                                    }} key={index} onClick={() => {
                                                       
                                                    }}>
                                                        <div style={{
                                                            color: '#FFF',
                                                            fontFamily: 'SFPro',
                                                            fontSize: '15px',
                                                            fontStyle: 'normal',
                                                            fontWeight: 700,
                                                            lineHeight: '120.596%',
                                                            letterSpacing: '0.36px',
                                                        }}>
                                                            {contact.firstName} {contact.lastName}
                                                        </div>
                                                        <div style={{
                                                            width: '14.427083333333334vw',
                                                            height: '0.026041666666666668vw',
                                                            background: 'rgba(255, 255, 255, 0.15)',
                                                        }} />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{
                            position: 'absolute',
                            right: '-0.2vw',
                            top: '4vw',
                        }}>
                            <AlphabetSearch onClick={(letter: string) => {
                                if (alphabetArrange === letter) {
                                    setAlphabetArrange('');
                                } else {
                                    setAlphabetArrange(letter);
                                }
                            }} />
                        </div>
                    </div>
                </CSSTransition> */}
            </div>
        </CSSTransition>
    );
}