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
    const [showPassword, setShowPassword] = useState(false);
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
        const res: string = await fetchNui('searchEmail', `${email}@asger.com`);
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
    const [aDWds, setADWds] = useState(false);

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
                if (phoneSettings.smrtId !== '' && phoneSettings.smrtPassword !== '') {
                    const messages: any = await fetchNui('getEmailMessages', JSON.stringify({
                        email: phoneSettings.smrtId,
                        password: phoneSettings.smrtPassword,
                    }));
                    const messagesData = JSON.parse(messages);
                    setMessagesData(messagesData);
                    setADWds(true);
                }
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
                {!aDWds && (
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
                                    fontSize: '1.39vh',
                                    lineHeight: '1.48vh',
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
                                        fontSize: '1.42vh',
                                        backgroundColor: 'rgba(255,255,255,0)',
                                        color: emailError ? 'red' : 'white',
                                        border: '0.09vh solid #323232',
                                        borderRadius: '0.37vh',
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
                                    fontSize: '1.39vh',
                                    lineHeight: '1.48vh',
                                    color: '#FFFFFF',
                                    width: '89%',
                                    marginTop: '1.78vh'
                                }}>
                                    Password
                                </div>

                                <div style={{
                                    width: '90%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    position: 'relative',
                                    marginTop: '1.78vh'
                                }}>
                                    <input
                                        value={password}
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        style={{
                                            width: '100%',
                                            height: '4.8%',
                                            fontSize: '1.42vh',
                                            backgroundColor: 'rgba(255,255,255,0)',
                                            color: 'white',
                                            border: '0.09vh solid #323232',
                                            borderRadius: '0.37vh',
                                            padding: '3%',
                                            paddingRight: '3.5vh', // space for icon
                                            outline: 'none',
                                        }}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => fetchNui("disableControls", true)}
                                        onBlur={() => fetchNui("disableControls", false)}
                                    />
                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '1vh',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'opacity 0.2s, transform 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.opacity = '0.7';
                                            (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.opacity = '1';
                                            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                        }}
                                    >
                                        {showPassword ? (
                                            // 👁️ Open eye icon
                                            <svg xmlns="http://www.w3.org/2000/svg" height="1.8vh" viewBox="0 -960 960 960" width="1.8vh" fill="white">
                                                <path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0-60q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 180q-141 0-255-77T0-480q69-103 183-171.5T480-720q141 0 255 68.5T960-480q-69 103-183 171.5T480-240Zm0-60q113 0 206-56t154-144q-61-88-154-144t-206-56q-113 0-206 56T120-500q61 88 154 144t206 56Z"/>
                                            </svg>
                                        ) : (
                                            // 🙈 Closed eye icon
                                            <svg xmlns="http://www.w3.org/2000/svg" height="1.8vh" viewBox="0 -960 960 960" width="1.8vh" fill="white">
                                                <path d="M773-165 668-270q-38 13-78 21.5T504-240q-141 0-255-77T66-480q31-46 69.5-84.5T224-633L113-743l42-42 660 660-42 42Zm-87-219-51-51q6-18 8-35t2-36q0-100-70-170t-170-70q-19 0-36 2t-35 8l-51-51q28-12 58-18t64-6q134 0 231 86t143 168q-37 54-86.5 97T686-384Zm-195 84q30 0 59-7.5t56-21.5L530-422q-9 5-21 8.5t-29 3.5q-50 0-85-35t-35-85q0-17 3.5-29t8.5-21L352-645q-14 27-21.5 56t-7.5 59q0 83 58 141t141 58Zm-6-184Z"/>
                                            </svg>
                                        )}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        backgroundColor: '#0A84FF',
                                        width: '90%',
                                        height: '4.8%',
                                        marginTop: '1.78vh',
                                        borderRadius: '0.37vh',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 500,
                                        letterSpacing: '0.09vh',
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
                                            const messagesData = JSON.parse(messages);
                                            setMessagesData(messagesData);
                                            setADWds(true);
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
                                    fontSize: '1.20vh',
                                    lineHeight: '1.20vh',
                                    letterSpacing: '0.06em',
                                    color: '#FFFFFF',
                                    position: 'relative',
                                    top: '21.33vh'
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
                                    fontSize: '1.39vh',
                                    lineHeight: '1.48vh',
                                    color: '#FFFFFF',
                                    width: '89%',
                                }}>Email</div>
                                <div style={{
                                    width: '26.67vh',
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
                                            height: '3.20vh',
                                            fontSize: '1.42vh',
                                            backgroundColor: 'rgba(255,255,255,0)',
                                            color: emailError ? 'red' : 'white',
                                            border: '0.09vh solid #323232',
                                            borderTopLeftRadius: '0.37vh',
                                            borderBottomLeftRadius: '0.37vh',
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
                                        height: '3.15vh',
                                        padding: '0.83vh 1.02vh',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        background: '#323232',
                                        color: '#FFF',
                                        fontSize: '1.02vh',
                                        fontStyle: 'normal',
                                        fontWeight: '500',
                                        lineHeight: 'normal',
                                        borderTopRightRadius: '0.37vh',
                                        borderBottomRightRadius: '0.37vh',
                                    }}>
                                        @ASGER.COM
                                    </div>
                                </div>

                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    fontSize: '1.39vh',
                                    lineHeight: '1.48vh',
                                    color: '#FFFFFF',
                                    width: '89%',
                                    marginTop: '1.78vh'
                                }}>
                                    Password
                                </div>

                                <div style={{
                                    width: '90%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    position: 'relative',
                                    marginTop: '1.78vh'
                                }}>
                                    <input
                                        value={password}
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        style={{
                                            width: '100%',
                                            height: '4.8%',
                                            fontSize: '1.42vh',
                                            backgroundColor: 'rgba(255,255,255,0)',
                                            color: 'white',
                                            border: '0.09vh solid #323232',
                                            borderRadius: '0.37vh',
                                            padding: '3%',
                                            paddingRight: '3.5vh', // space for icon
                                            outline: 'none',
                                        }}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => fetchNui("disableControls", true)}
                                        onBlur={() => fetchNui("disableControls", false)}
                                    />
                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '1vh',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'opacity 0.2s, transform 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.opacity = '0.7';
                                            (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.opacity = '1';
                                            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                        }}
                                    >
                                        {showPassword ? (
                                            // 👁️ Open eye icon
                                            <svg xmlns="http://www.w3.org/2000/svg" height="1.8vh" viewBox="0 -960 960 960" width="1.8vh" fill="white">
                                                <path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0-60q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 180q-141 0-255-77T0-480q69-103 183-171.5T480-720q141 0 255 68.5T960-480q-69 103-183 171.5T480-240Zm0-60q113 0 206-56t154-144q-61-88-154-144t-206-56q-113 0-206 56T120-500q61 88 154 144t206 56Z"/>
                                            </svg>
                                        ) : (
                                            // 🙈 Closed eye icon
                                            <svg xmlns="http://www.w3.org/2000/svg" height="1.8vh" viewBox="0 -960 960 960" width="1.8vh" fill="white">
                                                <path d="M773-165 668-270q-38 13-78 21.5T504-240q-141 0-255-77T66-480q31-46 69.5-84.5T224-633L113-743l42-42 660 660-42 42Zm-87-219-51-51q6-18 8-35t2-36q0-100-70-170t-170-70q-19 0-36 2t-35 8l-51-51q28-12 58-18t64-6q134 0 231 86t143 168q-37 54-86.5 97T686-384Zm-195 84q30 0 59-7.5t56-21.5L530-422q-9 5-21 8.5t-29 3.5q-50 0-85-35t-35-85q0-17 3.5-29t8.5-21L352-645q-14 27-21.5 56t-7.5 59q0 83 58 141t141 58Zm-6-184Z"/>
                                            </svg>
                                        )}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        backgroundColor: '#0A84FF',
                                        width: '90%',
                                        height: '4.8%',
                                        marginTop: '1.78vh',
                                        borderRadius: '0.37vh',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 500,
                                        letterSpacing: '0.09vh',
                                    }}
                                    className="clickanimation"
                                    onClick={async () => {
                                        const res = await fetchNui('registerNewMailAccount', JSON.stringify({
                                            email: `${email}@asger.com`,
                                            password: password
                                        }));
                                        if (res) {
                                            const messages: any = await fetchNui('getEmailMessages', JSON.stringify({
                                                email: `${email}@asger.com`,
                                                password: password,
                                            }));
                                            const messagesData = JSON.parse(messages);
                                            setMessagesData(messagesData);
                                            const dataX = {
                                                ...phoneSettings,
                                                smrtId: `${email}@asger.com`,
                                                smrtPassword: password,
                                            };
                                            setPhoneSettings(dataX);
                                            await fetchNui('setSettings', JSON.stringify(dataX));
                                            setADWds(true);
                                        }
                                    }}
                                >
                                    Sign Up
                                </div>
                                <div style={{
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    fontSize: '1.20vh',
                                    lineHeight: '1.20vh',
                                    letterSpacing: '0.06em',
                                    color: '#FFFFFF',
                                    position: 'relative',
                                    top: '21.33vh'
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
                    show={aDWds}
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
                    onLogout={() => {
                        setADWds(false);
                        setSignUp(false);
                        setEmail('');
                        setPassword('');
                        setEmailError(false);
                        const dataX = {
                            ...phoneSettings,
                            smrtId: '',
                            smrtPassword: '',
                        };
                        setPhoneSettings(dataX);
                        fetchNui('setSettings', JSON.stringify(dataX));
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