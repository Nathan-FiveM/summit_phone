import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import { useDebouncedCallback } from "@mantine/hooks";
import Title from "../../components/Title";
import { Avatar } from "@mantine/core";
import InputDialog from "./InputDialog";
import { DarkChatChannel, DarkChatProfile } from "../../../../../types/types";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import Searchbar from "../../components/SearchBar";
import DarkChatDetails from "./DarkChatDetails";


export default function DarkChat(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setPhoneSettings, setLocation } = usePhone();
    const [emailError, setEmailError] = useState(false);
    const [signUp, setSignUp] = useState(false);
    const [channelData, setChannelData] = useState<DarkChatChannel[]>([]);
    const [channelProfile, setChannelProfile] = useState<DarkChatProfile>({ _id: '', email: '', password: '', avatar: '' });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [searchValue, setSearchValue] = useState('');

    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);

    useNuiEvent('phone:receiveDarkChatMessage', (res: string) => {
        const parsedRes = JSON.parse(res as string);
        setChannelData(channelData.map((channel) => {
            if (channel._id === parsedRes._id) {
                return parsedRes;
            }
            return channel;
        }));
    });

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
    const [seleectedId, setSelectedId] = useState(0);

    const handleValidateEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchDarkChatEmail', `${email}`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length > 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);

    const handleSearchEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchDarkChatEmail', `${email}@onion.duck`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length === 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);

    useNuiEvent('phone:changeAvatar', async () => {
        setInputShow(true);
        setInputTitle('Update Avatar');
        setInputDescription('Update your avatar for secure communication.');
        setInputPlaceholder('Enter URL.');
        await fetchNui('phone:contextMenu:close', "Ok");
    });

    useNuiEvent('phone:changePassword', async () => {
        setInputShow(true);
        setInputTitle('Update Password');
        setInputDescription('Update your password for secure communication.');
        setInputPlaceholder('Enter Password.');
        await fetchNui('phone:contextMenu:close', "Ok");
    });

    useNuiEvent('phone:logoutDark', () => {
        const dataX = {
            ...phoneSettings,
            darkMailIdAttached: '',
        }
        setPhoneSettings(dataX);
        fetchNui('setSettings', JSON.stringify(dataX));
        fetchNui('phone:contextMenu:close', "Ok");
    });

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'darkchat'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const res = await fetchNui('getDarkChatProfile', phoneSettings.darkMailIdAttached);
                const parsedRes = JSON.parse(res as string);
                setChannelProfile(parsedRes);
                if (phoneSettings.darkMailIdAttached) {
                    const res = await fetchNui('getDarkChatChannels', phoneSettings.darkMailIdAttached);
                    const parsedRes = JSON.parse(res as string);
                    setChannelData(parsedRes);
                }
            }}
            onExited={props.onExit}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: '#0E0E0E',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="settings"
            >
                {!phoneSettings.darkMailIdAttached ? (
                    !signUp ? (
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
                            }}>Password</div>
                            <input
                                value={password}
                                type="password"
                                placeholder="Password"
                                style={{
                                    width: '90%',
                                    height: '4.8%',
                                    fontSize: '1.42vh',
                                    backgroundColor: 'rgba(255,255,255,0)',
                                    color: 'white',
                                    border: '0.09vh solid #323232',
                                    borderRadius: '0.37vh',
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
                                    const res: boolean = await fetchNui('loginDarkMailAccount', JSON.stringify({
                                        email: email,
                                        password: password
                                    }));
                                    if (res) {
                                        const dataX = {
                                            ...phoneSettings,
                                            darkMailIdAttached: email,
                                        }
                                        setPhoneSettings(dataX);
                                        const resXX = await fetchNui('setSettings', JSON.stringify(dataX));
                                        const resX = await fetchNui('getDarkChatChannels', email);
                                        const parsedRes = JSON.parse(resX as string);
                                        setChannelData(parsedRes);

                                        const resXA = await fetchNui('getDarkChatProfile', email);
                                        const parsedResX = JSON.parse(resXA as string);
                                        setChannelProfile(parsedResX);
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
                                    @onion.duck
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
                            }}>Password</div>
                            <input
                                value={password}
                                type="text"
                                placeholder="Password"
                                style={{
                                    width: '90%',
                                    height: '4.8%',
                                    fontSize: '1.42vh',
                                    backgroundColor: 'rgba(255,255,255,0)',
                                    color: 'white',
                                    border: '0.09vh solid #323232',
                                    borderRadius: '0.37vh',
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
                                    if (emailError || email.includes('@') || !email || !password) return;
                                    const res = await fetchNui('registerNewDarkMailAccount', JSON.stringify({
                                        email: `${email}@onion.duck`,
                                        password: password
                                    }));
                                    if (res) {
                                        setSignUp(false);
                                        const dataX = {
                                            ...phoneSettings,
                                            darkMailIdAttached: `${email}@onion.duck`,
                                        }
                                        setPhoneSettings(dataX);
                                        const resXX = await fetchNui('setSettings', JSON.stringify(dataX));
                                        const res = await fetchNui('getDarkChatProfile', `${email}@onion.duck`);
                                        const parsedRes = JSON.parse(res as string);
                                        setChannelProfile(parsedRes);
                                        const resX = await fetchNui('getDarkChatChannels', phoneSettings.darkMailIdAttached);
                                        const parsedResX = JSON.parse(resX as string);
                                        setChannelData(parsedResX);
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
                    )
                ) : <div style={{
                    width: '100%',
                    marginTop: '3.91vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    <div style={{ width: '95%', marginLeft: '0.89vh', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: '0.09vh' }}>
                        <Title title="Dark Chat" />
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.71vh',
                        }}>
                            <svg onClick={async () => {
                                setInputShow(true);
                                setInputTitle('Create');
                                setInputDescription('Create a new channel for secure communication.');
                                setInputPlaceholder('Channel Name');
                            }} className='clickanimation' width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.55556 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55556M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <Avatar style={{
                                cursor: 'pointer',
                            }} onClick={async () => {
                                await fetchNui('updateProfileoptions', {
                                    email: channelProfile.email,
                                })
                            }} size="3.20vh" src={channelProfile?.avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} />
                        </div>
                    </div>
                    <Searchbar mt="0.36vh" value={searchValue} onChange={(e) => setSearchValue(e)} />
                    <div style={{
                        width: '93%',
                        height: '51.56vh',
                        marginTop: '0.89vh',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {channelData && channelData.filter((a) => {
                            return a.name.toLowerCase().includes(searchValue.toLowerCase());
                        }).map((channel, i) => {
                            return (
                                <div key={i} style={{
                                    width: '100%',
                                    height: '5.33vh',
                                    display: 'flex',
                                    backgroundColor: '#272727',
                                    padding: '0.89vh',
                                    borderRadius: '0.89vh',
                                    alignItems: 'center',
                                    marginTop: i === 0 ? '' : '0.89vh',
                                    cursor: 'pointer',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <svg width="1.78vh" height="2.04vh" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M13.2 11.7647C15.8509 11.7647 18 13.8716 18 16.4706V18.2353C18 19.2099 17.1941 20 16.2 20H1.8C0.805884 20 0 19.2099 0 18.2353V16.4706C0 13.8716 2.14903 11.7647 4.8 11.7647H13.2ZM20.4 11.7649C22.3883 11.7649 24 13.3452 24 15.2944V17.0591C24 18.0338 23.1941 18.8238 22.2 18.8238H20.4V16.4706C20.4 14.5465 19.4578 12.8382 18.001 11.7649H20.4ZM9 0C11.9824 0 14.4 2.37026 14.4 5.29412C14.4 8.21798 11.9824 10.5882 9 10.5882C6.01766 10.5882 3.6 8.21798 3.6 5.29412C3.6 2.37026 6.01766 0 9 0ZM19.2 3.52941C21.1883 3.52941 22.8 5.10959 22.8 7.05882C22.8 9.00812 21.1883 10.5882 19.2 10.5882C17.2117 10.5882 15.6 9.00812 15.6 7.05882C15.6 5.10959 17.2117 3.52941 19.2 3.52941Z" fill="#0A84FF" />
                                        </svg>
                                        <div style={{ fontSize: '0.89vh' }}>{channel.members.length}</div>
                                    </div>
                                    <div style={{ marginLeft: '1.78vh', width: '60%', height: '3.20vh' }} onClick={async () => {
                                        setLocation({
                                            app: 'darkchat',
                                            page: {
                                                ...location.page,
                                                darkchat: `details/${channel._id}`,
                                            }
                                        })
                                        setSelectedId(i);
                                    }}>
                                        <div style={{ fontSize: '1.42vh', lineHeight: '1.42vh', width: '100%', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{channel.name}</div>
                                        <div style={{ fontSize: '1.07vh', color: '#8C8C8C', width: '100%', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{channel.messages[channel.messages.length - 1]?.message}</div>
                                    </div>
                                    <div style={{ fontSize: '0.89vh', color: '#8C8C8C', width: '20%', textAlign: 'right' }}>
                                        {channel.messages[channel.messages.length - 1]?.date ? formatedDate(channel.messages[channel.messages.length - 1]?.date) : ''}
                                    </div>
                                    <svg onClick={async () => {
                                        const res = await fetchNui('removeFromDarkChannel', JSON.stringify({
                                            _id: channel._id,
                                            email: phoneSettings.darkMailIdAttached,
                                        }));
                                        if (res) {
                                            setChannelData(channelData.filter((x) => x._id !== channel._id));
                                        }
                                    }} style={{ marginLeft: '0.53vh' }} className='clickanimation' width="1.39vh" height="1.39vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M19.3333 2.66956H13.2667C13.1137 1.91616 12.7048 1.23882 12.1095 0.752297C11.5142 0.265777 10.7689 0 10 0C9.2311 0 8.48584 0.265777 7.89049 0.752297C7.29515 1.23882 6.88634 1.91616 6.73333 2.66956H0.666667C0.489856 2.66956 0.320286 2.73979 0.195262 2.86479C0.0702379 2.9898 0 3.15934 0 3.33612C0 3.5129 0.0702379 3.68244 0.195262 3.80744C0.320286 3.93245 0.489856 4.00267 0.666667 4.00267H19.3333C19.5101 4.00267 19.6797 3.93245 19.8047 3.80744C19.9298 3.68244 20 3.5129 20 3.33612C20 3.15934 19.9298 2.9898 19.8047 2.86479C19.6797 2.73979 19.5101 2.66956 19.3333 2.66956ZM10 1.33645C10.4126 1.33761 10.8148 1.46635 11.1514 1.70502C11.488 1.94368 11.7425 2.28059 11.88 2.66956H8.12C8.25754 2.28059 8.51205 1.94368 8.84862 1.70502C9.1852 1.46635 9.58737 1.33761 10 1.33645ZM16.92 5.38911C16.7986 5.33806 16.6648 5.32412 16.5355 5.34903C16.4061 5.37394 16.2871 5.43659 16.1933 5.52908C16.1315 5.59137 16.0827 5.66523 16.0495 5.74644C16.0163 5.82766 15.9995 5.91462 16 6.00234C16 6.17912 16.0702 6.34866 16.1953 6.47366C16.3203 6.59867 16.4899 6.66889 16.6667 6.66889C16.8435 6.66889 17.013 6.59867 17.1381 6.47366C17.2631 6.34866 17.3333 6.17912 17.3333 6.00234C17.3309 5.82586 17.2618 5.65682 17.14 5.52908C17.0766 5.4684 17.0018 5.42083 16.92 5.38911ZM16.6667 8.002C16.4899 8.002 16.3203 8.07223 16.1953 8.19724C16.0702 8.32224 16 8.49178 16 8.66856V10.6682C16 10.845 16.0702 11.0145 16.1953 11.1396C16.3203 11.2646 16.4899 11.3348 16.6667 11.3348C16.8435 11.3348 17.013 11.2646 17.1381 11.1396C17.2631 11.0145 17.3333 10.845 17.3333 10.6682V8.66856C17.3333 8.49178 17.2631 8.32224 17.1381 8.19724C17.013 8.07223 16.8435 8.002 16.6667 8.002ZM16.6667 12.6679C16.4899 12.6679 16.3203 12.7381 16.1953 12.8631C16.0702 12.9881 16 13.1577 16 13.3344V18.0003C16 18.1771 15.9298 18.3467 15.8047 18.4717C15.6797 18.5967 15.5101 18.6669 15.3333 18.6669H4.66667C4.48986 18.6669 4.32029 18.5967 4.19526 18.4717C4.07024 18.3467 4 18.1771 4 18.0003V6.00234C4 5.82556 3.92976 5.65602 3.80474 5.53101C3.67971 5.40601 3.51014 5.33578 3.33333 5.33578C3.15652 5.33578 2.98695 5.40601 2.86193 5.53101C2.7369 5.65602 2.66667 5.82556 2.66667 6.00234V18.0003C2.66667 18.5307 2.87738 19.0393 3.25245 19.4143C3.62753 19.7893 4.13623 20 4.66667 20H15.3333C15.8638 20 16.3725 19.7893 16.7475 19.4143C17.1226 19.0393 17.3333 18.5307 17.3333 18.0003V13.3344C17.3333 13.1577 17.2631 12.9881 17.1381 12.8631C17.013 12.7381 16.8435 12.6679 16.6667 12.6679Z" fill="#0A84FF" />
                                        <path d="M7.33333 15.3341V6.66889C7.33333 6.49211 7.2631 6.32257 7.13807 6.19757C7.01305 6.07257 6.84348 6.00234 6.66667 6.00234C6.48986 6.00234 6.32029 6.07257 6.19526 6.19757C6.07024 6.32257 6 6.49211 6 6.66889V15.3341C6 15.5109 6.07024 15.6804 6.19526 15.8054C6.32029 15.9304 6.48986 16.0007 6.66667 16.0007C6.84348 16.0007 7.01305 15.9304 7.13807 15.8054C7.2631 15.6804 7.33333 15.5109 7.33333 15.3341ZM10.6667 15.3341V6.66889C10.6667 6.49211 10.5964 6.32257 10.4714 6.19757C10.3464 6.07257 10.1768 6.00234 10 6.00234C9.82319 6.00234 9.65362 6.07257 9.5286 6.19757C9.40357 6.32257 9.33333 6.49211 9.33333 6.66889V15.3341C9.33333 15.5109 9.40357 15.6804 9.5286 15.8054C9.65362 15.9304 9.82319 16.0007 10 16.0007C10.1768 16.0007 10.3464 15.9304 10.4714 15.8054C10.5964 15.6804 10.6667 15.5109 10.6667 15.3341ZM14 15.3341V6.66889C14 6.49211 13.9298 6.32257 13.8047 6.19757C13.6797 6.07257 13.5101 6.00234 13.3333 6.00234C13.1565 6.00234 12.987 6.07257 12.8619 6.19757C12.7369 6.32257 12.6667 6.49211 12.6667 6.66889V15.3341C12.6667 15.5109 12.7369 15.6804 12.8619 15.8054C12.987 15.9304 13.1565 16.0007 13.3333 16.0007C13.5101 16.0007 13.6797 15.9304 13.8047 15.8054C13.9298 15.6804 14 15.5109 14 15.3341Z" fill="#0A84FF" />
                                    </svg>
                                </div>
                            )
                        })}
                    </div>
                </div>}
                <DarkChatDetails show={location.app === 'darkchat' && location.page.darkchat.split('/')[0] === 'details'} channelName={channelData[seleectedId]?.name} channelId={channelData[seleectedId]?._id} messages={channelData[seleectedId] && channelData[seleectedId].messages} onSend={(message) => {
                    const newMessage = {
                        message: message,
                        date: new Date().toISOString(),
                        from: phoneSettings.darkMailIdAttached,
                    }
                    channelData[seleectedId].messages.push(newMessage);
                    fetchNui('setDarkChatMessages', JSON.stringify({
                        data: channelData[seleectedId],
                        channel: channelData[seleectedId]._id
                    }))
                }} onClose={() => {
                    setLocation({
                        app: 'darkchat',
                        page: {
                            ...location.page,
                            darkchat: '',
                        }
                    });
                }} />
                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Create') {
                        const res = await fetchNui('createNewDarkChannel', JSON.stringify({
                            name: e,
                            email: phoneSettings.darkMailIdAttached,
                        }));
                        const parsedRes = JSON.parse(res as string);
                        setChannelData(parsedRes);
                    } else if (inputTitle === 'Update Avatar') {
                        const res = await fetchNui('updateDarkAvatar', JSON.stringify({
                            email: channelProfile.email,
                            avatar: e
                        }));
                        if (res) {
                            setChannelProfile({ ...channelProfile, avatar: e });
                        }
                    } else if (inputTitle === 'Update Password') {
                        const res = await fetchNui('updateDarkPassword', JSON.stringify({
                            email: channelProfile.email,
                            password: e
                        }));
                        if (res) {
                            setChannelProfile({ ...channelProfile, password: e });
                        }
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>
        </CSSTransition>
    );
}