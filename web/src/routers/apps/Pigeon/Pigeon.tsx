import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import { useDebouncedCallback } from "@mantine/hooks";

export default function Pigeon(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setPhoneSettings } = usePhone();
    const [signUp, setSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState(false);

    const handleValidateEmail = useDebouncedCallback(async (email: string) => {
        const res: boolean = await fetchNui('searchPigeonEmail', `${email}`);
        if (res) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return res;
    }, 500);

    const handleSearchEmail = useDebouncedCallback(async (email: string) => {
        const res: boolean = await fetchNui('searchPigeonEmail', `${email}@smrt.com`);
        if (res) {
            setEmailError(true);
        } else {
            setEmailError(false);
        }
        return res;
    }, 500);

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'pigeon'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
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
                {!phoneSettings.pigeonIdAttached ? !signUp ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{
                            marginBottom: '1vw'
                        }} width="1.71875vw" height="1.71875vw" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M31.3459 2.24898C31.064 2.03273 30.6701 1.65301 30.461 1.36536C30.053 0.806071 29.2755 0.0164045 28.128 0.000319091C26.3478 -0.0260636 23.7767 1.58289 23.5791 5.07759C23.3809 8.57222 21.1399 13.7145 19.4911 14.8356C17.8422 15.9554 15.0079 19.8459 10.8542 21.1646C6.70049 22.4827 1.49198 23.3399 1.5576 24.7236C1.61037 25.8364 5.70165 25.6298 7.31194 25.5056C7.66656 25.4779 7.68264 25.5481 7.35057 25.6755C5.57687 26.3506 0.491254 28.383 0.436537 29.4713C0.370849 30.79 6.76618 27.361 11.6452 27.0984C16.5242 26.8345 19.1938 26.5378 20.5788 28.9107C20.5788 28.9107 20.8511 29.3496 21.3492 29.8484C21.3492 29.8484 21.5556 30.1423 21.5793 30.1842L21.6292 30.3072C21.7469 30.5978 21.7578 30.9208 21.66 31.2187C21.3659 31.267 21.0551 31.3325 20.7982 31.4433C20.4713 31.5843 20.5067 31.8005 20.7435 31.7451C20.9804 31.6911 21.1722 31.7502 21.1722 31.877C21.1722 32.0051 21.4289 31.9762 21.7566 31.8378C22.1459 31.673 22.6221 31.5083 22.8204 31.5804C22.9492 31.6267 23.0482 31.7072 23.1236 31.7915C23.2606 31.9434 23.0264 32.0791 22.6718 32.1056C22.3731 32.1281 22.0217 32.1886 21.734 32.3341C21.4174 32.4962 21.5526 32.7048 21.9027 32.6442C22.4684 32.549 23.2567 32.448 23.5785 32.569C24.1056 32.7666 25.5234 33.1952 26.6117 32.8985C27.3647 32.6938 28.1338 32.4725 28.711 32.3554C29.0593 32.2852 29.6038 31.9769 29.3205 31.8817C29.2112 31.845 29.0413 31.8185 28.787 31.8115C27.9169 31.7864 27.2154 32.0992 26.5693 32.0703C26.214 32.0542 26.1387 31.6828 26.4361 31.4884C26.6504 31.3475 26.9355 31.2059 27.292 31.1242C27.6389 31.045 27.7348 30.8171 27.3918 30.7232C27.115 30.6466 26.7147 30.6228 26.1496 30.7573C25.1605 30.9916 24.3283 30.9852 23.7504 30.6775C23.2676 30.2638 22.9387 29.7055 22.7636 29.0942C22.7435 29.0241 22.7285 28.9773 22.7222 28.9699C22.6662 27.8842 23.2362 26.3577 24.995 24.9547C27.5997 22.8779 29.9069 21.6904 30.6322 18.7235C31.3575 15.7572 29.3464 7.61397 29.3464 7.61397C29.3464 7.61397 29.0149 6.31071 29.1752 5.10976C29.2221 4.7577 29.47 4.23125 29.7525 4.01629C30.1161 3.73826 30.7262 3.45962 31.6492 3.56643C32.0025 3.60762 32.2335 3.4004 32.0662 3.08764C31.9303 2.83075 31.707 2.52505 31.3459 2.24898Z" fill="white" />
                            <circle cx="28.0978" cy="2.19538" r="0.439074" stroke="black" stroke-width="0.3" />
                        </svg>
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
                                const res: boolean = await fetchNui('loginPegionEmail', JSON.stringify({
                                    email: email,
                                    password: password
                                }));
                                if (res) {
                                    const dataX = {
                                        ...phoneSettings,
                                        pigeonIdAttached: email,
                                    }
                                    setPhoneSettings(dataX);
                                    const resXX = await fetchNui('setSettings', JSON.stringify(dataX));
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
                            top: '10.6vw'
                        }}>
                            Don’t have an birdy account?
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
                        <svg style={{
                            marginBottom: '1vw'
                        }} width="1.71875vw" height="1.71875vw" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M31.3459 2.24898C31.064 2.03273 30.6701 1.65301 30.461 1.36536C30.053 0.806071 29.2755 0.0164045 28.128 0.000319091C26.3478 -0.0260636 23.7767 1.58289 23.5791 5.07759C23.3809 8.57222 21.1399 13.7145 19.4911 14.8356C17.8422 15.9554 15.0079 19.8459 10.8542 21.1646C6.70049 22.4827 1.49198 23.3399 1.5576 24.7236C1.61037 25.8364 5.70165 25.6298 7.31194 25.5056C7.66656 25.4779 7.68264 25.5481 7.35057 25.6755C5.57687 26.3506 0.491254 28.383 0.436537 29.4713C0.370849 30.79 6.76618 27.361 11.6452 27.0984C16.5242 26.8345 19.1938 26.5378 20.5788 28.9107C20.5788 28.9107 20.8511 29.3496 21.3492 29.8484C21.3492 29.8484 21.5556 30.1423 21.5793 30.1842L21.6292 30.3072C21.7469 30.5978 21.7578 30.9208 21.66 31.2187C21.3659 31.267 21.0551 31.3325 20.7982 31.4433C20.4713 31.5843 20.5067 31.8005 20.7435 31.7451C20.9804 31.6911 21.1722 31.7502 21.1722 31.877C21.1722 32.0051 21.4289 31.9762 21.7566 31.8378C22.1459 31.673 22.6221 31.5083 22.8204 31.5804C22.9492 31.6267 23.0482 31.7072 23.1236 31.7915C23.2606 31.9434 23.0264 32.0791 22.6718 32.1056C22.3731 32.1281 22.0217 32.1886 21.734 32.3341C21.4174 32.4962 21.5526 32.7048 21.9027 32.6442C22.4684 32.549 23.2567 32.448 23.5785 32.569C24.1056 32.7666 25.5234 33.1952 26.6117 32.8985C27.3647 32.6938 28.1338 32.4725 28.711 32.3554C29.0593 32.2852 29.6038 31.9769 29.3205 31.8817C29.2112 31.845 29.0413 31.8185 28.787 31.8115C27.9169 31.7864 27.2154 32.0992 26.5693 32.0703C26.214 32.0542 26.1387 31.6828 26.4361 31.4884C26.6504 31.3475 26.9355 31.2059 27.292 31.1242C27.6389 31.045 27.7348 30.8171 27.3918 30.7232C27.115 30.6466 26.7147 30.6228 26.1496 30.7573C25.1605 30.9916 24.3283 30.9852 23.7504 30.6775C23.2676 30.2638 22.9387 29.7055 22.7636 29.0942C22.7435 29.0241 22.7285 28.9773 22.7222 28.9699C22.6662 27.8842 23.2362 26.3577 24.995 24.9547C27.5997 22.8779 29.9069 21.6904 30.6322 18.7235C31.3575 15.7572 29.3464 7.61397 29.3464 7.61397C29.3464 7.61397 29.0149 6.31071 29.1752 5.10976C29.2221 4.7577 29.47 4.23125 29.7525 4.01629C30.1161 3.73826 30.7262 3.45962 31.6492 3.56643C32.0025 3.60762 32.2335 3.4004 32.0662 3.08764C31.9303 2.83075 31.707 2.52505 31.3459 2.24898Z" fill="white" />
                            <circle cx="28.0978" cy="2.19538" r="0.439074" stroke="black" stroke-width="0.3" />
                        </svg>
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
                                if (emailError || email.includes('@') || !email || !password) return;
                                const res = await fetchNui('signupPegionEmail', JSON.stringify({
                                    email: `${email}@smrt.com`,
                                    password
                                }));
                                if (res) {
                                    setSignUp(false);
                                    const dataX = {
                                        ...phoneSettings,
                                        pigeonIdAttached: `${email}@smrt.com`,
                                    }
                                    setPhoneSettings(dataX);
                                    await fetchNui('setSettings', JSON.stringify(dataX));
                                }
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
                            top: '10.5vw'
                        }}>
                            Already have an pigeon account?
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
                ): (
                    <div>

                    </div>
                )}
            </div>
        </CSSTransition>
    );
}