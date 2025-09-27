import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import AlphabetSearch from "../../components/AlphabetSearch";
import { PhoneContacts } from "../../../../../types/types";
import Searchbar from "../../components/SearchBar";
import { fetchNui } from "../../../hooks/fetchNui";
import { Avatar, TextInput, Transition } from "@mantine/core";
import dayjs from "dayjs";

export default function Message() {
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
    const [phoneContacts, setPhoneContacts] = useState<{ [key: string]: PhoneContacts[] }>({});
    const [showSavedContacts, setShowSavedContacts] = useState(false);
    const [alphabetArrange, setAlphabetArrange] = useState('');
    const [selectedContact, setSelectedContact] = useState<PhoneContacts>({
        _id: '',
        firstName: '',
        lastName: '',
        personalNumber: '',
        contactNumber: '',
        email: '',
        notes: '',
        image: '',
        isFav: false,
        ownerId: '',
    });
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [attachments, setAttachments] = useState<{ type: string; url: string }[]>([]);
    const [textValue, setTextValue] = useState("");
    const sendMessage = async () => {
        if (!textValue.trim()) return;

        try {
            await fetchNui(
                "sendMessage",
                JSON.stringify({
                    type: 'private',
                    phoneNumber: selectedContact.contactNumber,
                    messageData: {
                        message: textValue,
                        attachments: attachments,
                    },
                })
            ).then(async (res) => {
                const parsedData = JSON.parse(res as string);
                if (parsedData.success) {
                    const data = {
                        ...location.page,
                        messages: `details/${selectedContact.contactNumber}/undefined`,
                    };
                    setLocation({
                        app: "message",
                        page: data,
                    });
                }
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };
    const isAllorIsKnownorIsUnknownorIsunRead = 'all'

    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'message' && location.page.messages === ''} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
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
                            app: '',
                            page: data
                        })
                    }} style={{ cursor: 'pointer' }}>
                        <svg width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div className="text">Back</div>
                    </div>
                    <div className="title">
                        Messages
                    </div>
                    <svg onClick={() => {
                        setShowContactsPortal(true);
                    }} style={{ marginLeft: '8.00vh', cursor: 'pointer' }} width="1.76vh" height="1.57vh" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.0468 1.53577L6.88299 9.69963C6.82237 9.76025 6.79004 9.84108 6.79004 9.92595V10.997C6.79004 11.1748 6.93553 11.3162 7.10932 11.3162H8.17224C8.25711 11.3162 8.34198 11.2839 8.4026 11.2233L16.5705 3.05942C16.6958 2.93414 16.6958 2.73206 16.5705 2.60678L15.4995 1.53577C15.3742 1.41049 15.1721 1.41049 15.0468 1.53577ZM17.9284 0.767887L17.3465 0.185909L17.3384 0.177827C17.2131 0.0687058 17.0474 0 16.8736 0C16.6958 0 16.5301 0.0687057 16.4048 0.181868L15.9481 0.6426C15.8875 0.707265 15.8875 0.808302 15.9481 0.868925L16.3684 1.28924L17.2454 2.16625C17.3101 2.23091 17.4111 2.23091 17.4758 2.16625L17.9325 1.70956C18.0456 1.58427 18.1103 1.42261 18.1103 1.24074C18.1063 1.06292 18.0416 0.893174 17.9284 0.767887Z" fill="#0A84FF" />
                        <path d="M8.8105 11.8821C8.68925 12.0033 8.52355 12.072 8.35381 12.072H6.68062C6.32497 12.072 6.03398 11.781 6.03398 11.4254V9.74816C6.03398 9.57842 6.10268 9.41271 6.22393 9.29147L6.25626 9.25914L12.2215 3.29387C12.3226 3.19283 12.2498 3.01904 12.1084 3.01904H2.37237C1.06292 3.01904 0 4.08196 0 5.39141V14.4444C0 15.7538 1.06292 16.8168 2.37237 16.8168H12.7186C14.0281 16.8168 15.091 15.7538 15.091 14.4444V5.99764C15.091 5.85214 14.9172 5.78344 14.8162 5.88448L8.84283 11.8497L8.8105 11.8821Z" fill="#0A84FF" />
                    </svg>
                </div>
                <Searchbar mt="1.42vh" value={searchValue} onChange={setSearchValue} />
                <div className="messageContent">
                    {channelsData && channelsData.sort((a: any, b: any) => {
                        return new Date(b?.lastMessage?.timestamp).getTime() - new Date(a?.lastMessage?.timestamp).getTime();
                    }).map((channel, index) => {
                        return (
                            <div className="innerChannel" style={{
                                marginTop: index === 0 ? '0.00vh' : '0.36vh',
                            }} key={index}>
                                <div className="channelContent" onClick={() => {
                                    const data = {
                                        ...location.page,
                                        messages: `details/${channel.phoneNumber}/${channel.groupId}`,
                                    }
                                    setLocation({
                                        app: 'message',
                                        page: data
                                    })
                                }}>
                                    <Avatar size="3.52vh" src={channel.avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} alt="" />
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
                                {channelsData.length - 1 !== index && <div className="divider" style={{ width: '28.44vh' }} />}
                            </div>
                        )
                    })}
                </div>

                <CSSTransition nodeRef={nodeRef} in={showContactsPortal} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
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
                        bottom: '0',
                        backgroundColor: 'rgb(34, 33, 33)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderTopLeftRadius: '1.85vh',
                        borderTopRightRadius: '1.85vh',
                    }}>
                        <div className="Header" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            width: '100%',
                            height: '10%',
                            backgroundColor: 'rgb(56, 54, 54)',
                            borderTopLeftRadius: '1.85vh',
                            borderTopRightRadius: '1.85vh',
                        }}>
                            <div className="cancelButton" style={{
                                fontSize: '1.24vh',
                                marginRight: '1.85vh',
                                color: '#0A84FF',
                                lineHeight: '0.00vh',
                            }} onClick={() => {
                                setShowContactsPortal(false);
                            }}>
                                Cancel
                            </div>
                            <div className="title" style={{
                                fontSize: '1.60vh',
                                color: 'white',
                                marginRight: '32%',
                                lineHeight: '0.00vh',
                            }}>
                                New Message
                            </div>
                        </div>
                        <TextInput placeholder="" value={selectedContact.contactNumber} onChange={(e) => {
                            setSelectedContact({
                                ...selectedContact,
                                contactNumber: e.currentTarget.value
                            })
                        }} leftSection={<div style={{ fontSize: '1.24vh' }}>To:</div>} styles={{
                            root: {
                                backgroundColor: 'rgb(34, 33, 33)',
                                width: '100%',
                            },
                            input: {
                                color: 'white',
                                backgroundColor: 'rgb(34, 33, 33)',
                                border: 'none',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '0',
                            }
                        }} rightSection={
                            <svg onClick={() => {
                                setShowSavedContacts(!showSavedContacts);
                            }} style={{ cursor: 'pointer' }} width="1.85vh" height="1.85vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M10 18.75C5.1675 18.75 1.25 14.8313 1.25 10C1.25 5.16875 5.1675 1.25 10 1.25C14.8325 1.25 18.75 5.16875 18.75 10C18.75 14.8313 14.8325 18.75 10 18.75ZM10 0C4.47687 0 0 4.475 0 10C0 15.525 4.47687 20 10 20C15.5231 20 20 15.525 20 10C20 4.475 15.5231 0 10 0ZM13.75 9.375H10.625V6.25C10.625 5.90625 10.3456 5.625 10 5.625C9.65438 5.625 9.375 5.90625 9.375 6.25V9.375H6.25C5.90438 9.375 5.625 9.65625 5.625 10C5.625 10.3438 5.90438 10.625 6.25 10.625H9.375V13.75C9.375 14.0938 9.65438 14.375 10 14.375C10.3456 14.375 10.625 14.0938 10.625 13.75V10.625H13.75C14.0956 10.625 14.375 10.3438 14.375 10C14.375 9.65625 14.0956 9.375 13.75 9.375Z" fill="#0A84FF" />
                            </svg>
                        }
                            onFocus={() => fetchNui("disableControls", true)}
                            onBlur={() => fetchNui("disableControls", false)}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            zIndex: 1,
                        }}>
                            <Transition
                                mounted={showAttachmentModal}
                                transition="fade"
                                duration={400}
                                timingFunction="ease"
                            >
                                {(styles) => <div style={{
                                    ...styles,
                                    width: '29.87vh',
                                    height: '8.89vh',
                                    marginTop: '-1.78vh',
                                    backgroundColor: 'rgba(55,55,55,1)',
                                    borderTopLeftRadius: '1.78vh',
                                    borderTopRightRadius: '1.78vh',
                                }}>
                                    <div style={{
                                        fontSize: '1.24vh',
                                        fontWeight: '500',
                                        marginLeft: '0.89vh',
                                        marginTop: '0.89vh',
                                    }} onClick={() => {
                                        setShowAttachmentModal(false);
                                    }}>Close</div>
                                    <div>
                                        <TextInput
                                            value={attachments[0]?.url || ""}
                                            onChange={(e) => {
                                                setAttachments([{ type: "image", url: e.currentTarget.value }]);
                                            }}
                                            placeholder="Enter Image link..."
                                            styles={{
                                                root: { backgroundColor: "", marginTop: '0.89vh', width: '90%', marginLeft: '1.42vh' },
                                                input: {
                                                    color: "white",
                                                    backgroundColor: "rgba(0,0,0,0)",
                                                    borderRadius: "13.89vh",
                                                    border: "0.09vh solid rgba(87, 87, 87, 0.86)",
                                                },
                                            }}
                                            onFocus={() => fetchNui("disableControls", true)}
                                            onBlur={() => fetchNui("disableControls", false)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    sendMessage();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>}
                            </Transition>
                        </div>
                        <div className="inputSFsada" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'absolute',
                            bottom: '2.13vh',
                            width: '100%',
                        }}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="2.41vh"
                                height="2.41vh"
                                viewBox="0 0 26 26"
                                fill="none"
                                style={{ cursor: "pointer" }}
                                onClick={() => {
                                    setShowAttachmentModal(true);
                                }}
                            >
                                <circle cx="13" cy="13" r="13" fill="#D9D9D9" fillOpacity="0.3" />
                                <path
                                    d="M13.6857 12.3143V5H12.3143V12.3143H5V13.6857H12.3143V21H13.6857V13.6857H21V12.3143H13.6857Z"
                                    fill="black"
                                />
                            </svg>
                            <TextInput
                                value={textValue}
                                onChange={(e) => setTextValue(e.currentTarget.value)}
                                placeholder="Type a message..."
                                styles={{
                                    root: { backgroundColor: "", width: '90%', },
                                    input: {
                                        color: "white",
                                        backgroundColor: "rgba(0,0,0,0)",
                                        borderRadius: "13.89vh",
                                        border: "0.09vh solid rgba(87, 87, 87, 0.86)",
                                    },
                                }}
                                onFocus={() => fetchNui("disableControls", true)}
                                onBlur={() => fetchNui("disableControls", false)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        sendMessage();
                                    }
                                }}
                            />
                        </div>
                        <Transition
                            mounted={showSavedContacts}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles,
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                top: '0.89vh',
                                zIndex: 1,
                                backgroundColor: 'rgba(0, 0, 0, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                borderTopLeftRadius: '1.85vh',
                                borderTopRightRadius: '1.85vh',
                            }}>
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginTop: '0.44vh',
                                }} >
                                    <div style={{
                                        width: '34%',
                                        fontWeight: 500,
                                        fontSize: '1.24vh',
                                        color: '#0A84FF',
                                        cursor: 'pointer',
                                    }} onClick={() => {
                                        setShowSavedContacts(false);
                                    }}>
                                        Cancel
                                    </div>
                                    <div style={{
                                        width: '34%',
                                        fontWeight: 500,
                                        fontSize: '1.24vh',
                                        color: 'white',
                                    }}>
                                        Select Contact
                                    </div>
                                    <div style={{
                                        width: '21%',
                                        textAlign: 'end',
                                        fontSize: '1.24vh',
                                        color: '#0A84FF',
                                        fontWeight: 500
                                    }}>
                                        Done
                                    </div>
                                </div>
                                <Searchbar mt="1.42vh" value={searchValue} onChange={(e: string) => {
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
                                                        fontSize: '1.39vh',
                                                        fontStyle: 'normal',
                                                        fontWeight: 700,
                                                        lineHeight: '118.596%',
                                                        marginTop: index === 0 ? '' : '0.38vh',
                                                        letterSpacing: '0.03vh',
                                                    }}>
                                                        {letter}
                                                        <div style={{
                                                            width: '25.65vh',
                                                            height: '0.05vh',
                                                            background: 'rgba(255, 255, 255, 0.15)',
                                                        }} />
                                                    </div>
                                                    {phoneContacts[letter].filter((letter) =>
                                                        letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                                    ).map((contact, index) => {
                                                        return (
                                                            <div style={{
                                                                display: 'flex',
                                                                height: '2.48vh',
                                                                flexDirection: 'column',
                                                                justifyContent: 'flex-end',
                                                                alignItems: 'flex-start',
                                                                gap: '0.28vh',
                                                                flexShrink: 0,
                                                                alignSelf: 'stretch',
                                                                cursor: 'pointer',
                                                            }} key={index} onClick={() => {
                                                                setSelectedContact(contact);
                                                                setShowSavedContacts(false);
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
                                                                    width: '25.65vh',
                                                                    height: '0.05vh',
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
                                    right: '-0.36vh',
                                    top: '7.11vh',
                                }}>
                                    <AlphabetSearch onClick={(letter: string) => {
                                        if (alphabetArrange === letter) {
                                            setAlphabetArrange('');
                                        } else {
                                            setAlphabetArrange(letter);
                                        }
                                    }} />
                                </div>
                            </div>}
                        </Transition>
                    </div>
                </CSSTransition>
            </div>
        </CSSTransition>
    );
}