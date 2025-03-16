import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import { useDebouncedCallback } from "@mantine/hooks";
import FilterPage from "./FilterPage";
import FilteredMessage from "./FilteredMessage";
import { PhoneMailMessage } from "../../../../../types/types";
import MessageData from "./MessageData";
import ComposeMail from "./ComposeMail";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import ProfilePage from "./ProfilePage";

export default function MailApp(props: { onExit: () => void, onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [signUp, setSignUp] = useState(false);
    const [messagesData, setMessagesData] = useState([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState(false);

    const handleValidateEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchEmail', `${email}`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length > 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);

    const handleSearchEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchEmail', `${email}@smrt.com`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length === 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);

    const [selectedMessageData, setSelectedMessageData] = useState<PhoneMailMessage>({
        _id: '',
        from: '',
        to: '',
        username: '',
        avatar: '',
        subject: '',
        message: '',
        images: [],
        date: '',
        read: false,
        tags: [],
    });

    useNuiEvent('updateEmailMessages', (data: string) => {
        const messagesData = JSON.parse(data);
        setMessagesData(messagesData);
    });

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'mail'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const messages: any = await fetchNui('getEmailMessages', JSON.stringify({
                    email: phoneSettings.smrtId,
                    password: phoneSettings.smrtPassword,
                }));
                const messagesData = JSON.parse(messages);
                setMessagesData(messagesData);
            }}
            onExited={() => {
                props.onExit();
            }}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: '#0E0E0E',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                }}
                className="settings"
            >
                {!messagesData?.length && (
                    <>
                        {!signUp ? (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    fontSize: '0.78125vw',
                                    lineHeight: '0.8333333333333334vw',
                                    color: '#FFFFFF',
                                    width: '89%',
                                }}>Email</div>
                                <input
                                    value={email}
                                    type="text"
                                    placeholder="Email"
                                    style={{
                                        width: '90%',
                                        height: '4.8%',
                                        fontSize: '0.8vw',
                                        backgroundColor: 'rgba(255,255,255,0)',
                                        color: emailError ? 'red' : 'white',
                                        border: '0.052083333333333336vw solid #323232',
                                        borderRadius: '0.20833333333333334vw',
                                        padding: '3%',
                                        outline: 'none',
                                    }}
                                    onChange={async (e) => {
                                        if (e.target.value.includes('@')) {
                                            handleValidateEmail(e.target.value);
                                        }
                                        setEmail(e.target.value);
                                    }}
                                    onFocus={() => fetchNui("disableControls", true)}
                                    onBlur={() => fetchNui("disableControls", false)}
                                />

                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    fontSize: '0.78125vw',
                                    lineHeight: '0.8333333333333334vw',
                                    color: '#FFFFFF',
                                    width: '89%',
                                    marginTop: '1vw'
                                }}>Password</div>
                                <input
                                    value={password}
                                    type="password"
                                    placeholder="Password"
                                    style={{
                                        width: '90%',
                                        height: '4.8%',
                                        fontSize: '0.8vw',
                                        backgroundColor: 'rgba(255,255,255,0)',
                                        color: 'white',
                                        border: '0.052083333333333336vw solid #323232',
                                        borderRadius: '0.20833333333333334vw',
                                        padding: '3%',
                                        outline: 'none',
                                    }}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => fetchNui("disableControls", true)}
                                    onBlur={() => fetchNui("disableControls", false)}
                                />
                                <div
                                    style={{
                                        backgroundColor: '#0A84FF',
                                        width: '90%',
                                        height: '4.8%',
                                        marginTop: '1vw',
                                        borderRadius: '0.20833333333333334vw',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 500,
                                        letterSpacing: '0.05vw',
                                    }}
                                    className="clickanimation"
                                    onClick={async () => {
                                        if (emailError || !email.includes('@') || !email || !password) return;
                                        const res: boolean = await fetchNui('loginMailAccount', JSON.stringify({
                                            email: email,
                                            password: password
                                        }));
                                        if (res) {
                                            const messages: any = await fetchNui('getEmailMessages', JSON.stringify({
                                                email: email,
                                                password: password,
                                            }));
                                            console.log(messages);
                                            const messagesData = JSON.parse(messages);
                                            setMessagesData(messagesData);

                                            const dataX = {
                                                ...phoneSettings,
                                                smrtId: email,
                                                smrtPassword: password,
                                            };
                                            setPhoneSettings(dataX);
                                            await fetchNui('setSettings', JSON.stringify(dataX));
                                        }
                                    }}
                                >
                                    Login
                                </div>
                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    fontSize: '0.6770833333333334vw',
                                    lineHeight: '0.6770833333333334vw',
                                    letterSpacing: '0.06em',
                                    color: '#FFFFFF',
                                    position: 'relative',
                                    top: '12vw'
                                }}>
                                    Don’t have an email address?
                                    <span
                                        style={{ color: '#0A84FF', cursor: 'pointer' }}
                                        onClick={() => {
                                            handleSearchEmail(email);
                                            setSignUp(true);
                                        }}
                                    >
                                        Create one
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    fontSize: '0.78125vw',
                                    lineHeight: '0.8333333333333334vw',
                                    color: '#FFFFFF',
                                    width: '89%',
                                }}>Email</div>
                                <div style={{
                                    width: '15vw',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <input
                                        value={email}
                                        type="text"
                                        placeholder="Email"
                                        style={{
                                            width: '80%',
                                            height: '1.8vw',
                                            fontSize: '0.8vw',
                                            backgroundColor: 'rgba(255,255,255,0)',
                                            color: emailError ? 'red' : 'white',
                                            border: '0.052083333333333336vw solid #323232',
                                            borderTopLeftRadius: '0.20833333333333334vw',
                                            borderBottomLeftRadius: '0.20833333333333334vw',
                                            padding: '3%',
                                            outline: 'none',
                                        }}
                                        onFocus={() => fetchNui("disableControls", true)}
                                        onBlur={() => fetchNui("disableControls", false)}
                                        onChange={(e) => {
                                            handleSearchEmail(e.target.value);
                                            setEmail(e.target.value);
                                        }}
                                    />
                                    <div style={{
                                        display: 'flex',
                                        height: '1.7708333333333333vw',
                                        padding: '0.46875vw 0.5729166666666666vw',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        background: '#323232',
                                        color: '#FFF',
                                        fontSize: '0.5729166666666666vw',
                                        fontStyle: 'normal',
                                        fontWeight: '500',
                                        lineHeight: 'normal',
                                        borderTopRightRadius: '0.20833333333333334vw',
                                        borderBottomRightRadius: '0.20833333333333334vw',
                                    }}>
                                        @SMRT.COM
                                    </div>
                                </div>

                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    fontSize: '0.78125vw',
                                    lineHeight: '0.8333333333333334vw',
                                    color: '#FFFFFF',
                                    width: '89%',
                                    marginTop: '1vw'
                                }}>Password</div>
                                <input
                                    value={password}
                                    type="text"
                                    placeholder="Password"
                                    style={{
                                        width: '90%',
                                        height: '4.8%',
                                        fontSize: '0.8vw',
                                        backgroundColor: 'rgba(255,255,255,0)',
                                        color: 'white',
                                        border: '0.052083333333333336vw solid #323232',
                                        borderRadius: '0.20833333333333334vw',
                                        padding: '3%',
                                    }}
                                    onFocus={() => fetchNui("disableControls", true)}
                                    onBlur={() => fetchNui("disableControls", false)}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <div
                                    style={{
                                        backgroundColor: '#0A84FF',
                                        width: '90%',
                                        height: '4.8%',
                                        marginTop: '1vw',
                                        borderRadius: '0.20833333333333334vw',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 500,
                                        letterSpacing: '0.05vw',
                                    }}
                                    className="clickanimation"
                                    onClick={async () => {
                                        await fetchNui('registerNewMailAccount', JSON.stringify({
                                            email: `${email}@smrt.com`,
                                            password: password
                                        }));
                                        const messages: any = await fetchNui('getEmailMessages', JSON.stringify({
                                            email: `${email}@smrt.com`,
                                            password: password,
                                        }));
                                        const messagesData = JSON.parse(messages);
                                        setMessagesData(messagesData);
                                        const dataX = {
                                            ...phoneSettings,
                                            smrtId: `${email}@smrt.com`,
                                            smrtPassword: password,
                                        };
                                        setPhoneSettings(dataX);
                                        await fetchNui('setSettings', JSON.stringify(dataX));
                                    }}
                                >
                                    Sign Up
                                </div>
                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    fontSize: '0.6770833333333334vw',
                                    lineHeight: '0.6770833333333334vw',
                                    letterSpacing: '0.06em',
                                    color: '#FFFFFF',
                                    position: 'relative',
                                    top: '12vw'
                                }}>
                                    Already have an email address?
                                    <span
                                        style={{ color: '#0A84FF', cursor: 'pointer' }}
                                        onClick={() => {
                                            handleValidateEmail(email);
                                            setSignUp(false);
                                        }}
                                    >
                                        Login
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <FilterPage
                    show={messagesData?.length > 0}
                    inboxCount={messagesData && messagesData?.filter((message: any) => message.tags.includes('inbox')).length || 0}
                    sentCount={messagesData && messagesData?.filter((message: any) => message.tags.includes('sent')).length || 0}
                    draftCount={messagesData && messagesData?.filter((message: any) => message.tags.includes('draft')).length || 0}
                    binCount={messagesData && messagesData?.filter((message: any) => message.tags.includes('bin')).length || 0}
                    onClick={(tag: string) => {
                        setLocation({
                            app: 'mail',
                            page: {
                                ...location.page,
                                mail: tag,
                            }
                        });
                    }}
                />
                <FilteredMessage show={location.page.mail === 'inbox' || location.page.mail === 'sent' || location.page.mail === 'draft' || location.page.mail === 'bin'} messages={messagesData} onMessageClick={(messageData) => {
                    fetchNui('setSelectedMessage', JSON.stringify({
                        messageId: messageData._id,
                        mailId: phoneSettings.smrtId,
                    }));
                    setSelectedMessageData(messageData);
                    const newMessageData = messagesData.map((message: any) => {
                        if (message._id === messageData._id) {
                            return {
                                ...message,
                                read: true,
                            }
                        }
                        return message;
                    });
                    setMessagesData(newMessageData);
                    setLocation({
                        app: 'mail',
                        page: {
                            ...location.page,
                            mail: 'message',
                        }
                    });
                }} />
                <ComposeMail show={location.page.mail.split('/')[0] === 'compose'} onCancel={() => {
                    setLocation({
                        app: 'mail',
                        page: {
                            ...location.page,
                            mail: 'inbox',
                        }
                    })
                }} onSend={async (to: string, from: string, subject: string, body: string, attachments: string[]) => {
                    setLocation({
                        app: 'mail',
                        page: {
                            ...location.page,
                            mail: '',
                        }
                    })
                    await fetchNui('sendEmail', JSON.stringify({
                        email: from,
                        to: to,
                        subject: subject,
                        message: body,
                        images: attachments
                    })).then(() => {
                    });
                }} />
                <MessageData show={location.page.mail === 'message'} message={selectedMessageData} totalUnreadMessages={messagesData && messagesData.filter((message: any) => !message.read).length} />
                <ProfilePage show={location.page.mail === 'profile'} />
            </div>
        </CSSTransition>
    );
}