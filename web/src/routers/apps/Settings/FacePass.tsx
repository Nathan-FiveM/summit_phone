import { Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { useEffect, useState } from "react";
import CustomSwitch from "../../components/CustomSwitch";
import { fetchNui } from "../../../hooks/fetchNui";
import Dialpad from "../../components/dialpad1";
import CircleFillers from "../../components/circlefillers";

export default function FacePass() {
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [showPasscode, setShowPasscode] = useState(false);
    const [showNewPasscode, setShowNewPasscode] = useState(false);
    const [showNewConfirmPasscode, setShowNewConfirmPasscode] = useState(false);

    const [newPasscode, setNewPasscode] = useState('');
    const [confirmPasscode, setConfirmPasscode] = useState('');
    const [newConfirmPasscode, setNewConfirmPasscode] = useState('');

    useEffect(()=>{
        if (newPasscode === phoneSettings.lockPin) {
            setShowPasscode(false);
            setNewPasscode('');
            setShowNewPasscode(true);
        }
        if (confirmPasscode.length === phoneSettings.lockPin.length){
            setShowNewPasscode(false);
            setShowNewConfirmPasscode(true);
        }
        if (newConfirmPasscode.length === phoneSettings.lockPin.length){
            if (newConfirmPasscode === confirmPasscode) {
                const data = {
                    ...phoneSettings,
                    lockPin: newConfirmPasscode
                }
                setPhoneSettings(data);
                fetchNui('setSettings', JSON.stringify(data));
                setShowNewConfirmPasscode(false);
                setShowNewPasscode(false);
                setNewConfirmPasscode('');
                setConfirmPasscode('');
            }
        }
    }, [newPasscode, confirmPasscode, newConfirmPasscode]);


    return (
        <Transition
            mounted={location.app === "settings" && location.page.settings === "facepass"}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                zIndex: 1,
                backgroundColor: '#0E0E0E',
            }}>
                <div className="soundheader">
                    <div className="back" onClick={() => {
                        const data = {
                            ...location.page,
                            settings: ""
                        };
                        setLocation({
                            app: 'settings',
                            page: data
                        })
                    }} style={{ cursor: 'pointer' }}>
                        <svg style={{
                            flexShrink: '0'
                        }} width="8" height="18" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div style={{
                            width: "3.06vh",
                            height: "1.67vh",
                            fontStyle: "normal",
                            fontWeight: 500,
                            fontSize: "1.39vh",
                            lineHeight: "1.67vh",
                            textAlign: "center",
                            color: "#0A84FF",
                            flex: "none",
                            order: 1,
                            flexGrow: 0,
                        }}>Back</div>
                    </div>
                    <div className="name" style={{ width: 'auto', marginLeft: '1.24vh' }}>Privacy Settings</div>
                </div>
                <div className="contasa" style={{
                    cursor: 'pointer'
                }}>
                    <div className="title">Turn on Face ID</div>
                    <CustomSwitch switchValue={phoneSettings.useFaceId} setSwitchValue={async (e: boolean) => {
                        const data = {
                            ...phoneSettings,
                            useFaceId: e
                        };
                        setPhoneSettings(data);
                        await fetchNui('setSettings', JSON.stringify(data));
                    }} />
                </div>
                <div className="contasa" style={{
                    cursor: 'pointer'
                }}>
                    <div className="title">Change Passcode</div>
                    <svg onClick={() => {
                        setShowPasscode(true);
                    }} xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.57vh" viewBox="0 0 8 17" fill="none">
                        <path d="M1 16L6.65017 8.93729C6.85469 8.68163 6.85469 8.31837 6.65017 8.06271L1 1" stroke="#D0D0D0" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </div>
                <div className="contasa" style={{
                    cursor: 'pointer'
                }}>
                    <div className="title">Use Screen Lock</div>
                    <CustomSwitch switchValue={phoneSettings.usePin} setSwitchValue={async (e: boolean) => {
                        const data = {
                            ...phoneSettings,
                            usePin: e,
                            useFaceId: e
                        };
                        setPhoneSettings(data);
                        await fetchNui('setSettings', JSON.stringify(data));
                    }} />
                </div>
                <Transition
                    mounted={showPasscode}
                    transition="scale-x"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        position: "absolute",
                        zIndex: 1,
                        backgroundColor: '#0E0E0E',
                    }}>
                        <div className="soundheader">
                            <div className="back" onClick={() => {
                                setShowPasscode(false);
                            }} style={{ cursor: 'pointer' }}>
                                <svg style={{
                                    flexShrink: '0'
                                }} width="8" height="18" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <div style={{
                                    width: "3.06vh",
                                    height: "1.67vh",
                                    fontStyle: "normal",
                                    fontWeight: 500,
                                    fontSize: "1.39vh",
                                    lineHeight: "1.67vh",
                                    textAlign: "center",
                                    color: "#0A84FF",
                                    flex: "none",
                                    order: 1,
                                    flexGrow: 0,
                                }}>Back</div>
                            </div>
                            <div className="name" style={{ width: 'auto', marginLeft: '1.07vh' }}>Passcode Change</div>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: '4.44vh'
                        }}>
                            <div style={{
                                color: "#FFF",
                                textAlign: "center",
                                fontSize: "1.67vh",
                                fontStyle: "normal",
                                fontWeight: 500,
                                lineHeight: "normal",
                                marginBottom: '0.89vh'
                            }}>Enter Passcode</div>
                            <CircleFillers type={phoneSettings.lockPin.length} length={newPasscode.length} mt="" error={false} />
                        </div>
                        <Dialpad onDial={(e)=>{
                            if (e === 'back') {
                                if (newPasscode.length > 0) {
                                    setNewPasscode(newPasscode.slice(0, -1));
                                }
                            } else if(newPasscode.length < phoneSettings.lockPin.length) {
                                setNewPasscode(newPasscode + e);
                            }
                        }} mt="31.11vh"/>
                    </div>}
                </Transition>
                <Transition
                    mounted={showNewPasscode}
                    transition="scale-x"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        position: "absolute",
                        zIndex: 1,
                        backgroundColor: '#0E0E0E',
                    }}>
                        <div className="soundheader">
                            <div className="back" onClick={() => {
                                setShowNewPasscode(false);
                            }} style={{ cursor: 'pointer' }}>
                                <svg style={{
                                    flexShrink: '0'
                                }} width="8" height="18" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <div style={{
                                    width: "3.06vh",
                                    height: "1.67vh",
                                    fontStyle: "normal",
                                    fontWeight: 500,
                                    fontSize: "1.39vh",
                                    lineHeight: "1.67vh",
                                    textAlign: "center",
                                    color: "#0A84FF",
                                    flex: "none",
                                    order: 1,
                                    flexGrow: 0,
                                }}>Back</div>
                            </div>
                            <div className="name" style={{ width: 'auto', marginLeft: '1.07vh' }}>Passcode Change</div>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: '4.44vh'
                        }}>
                            <div style={{
                                color: "#FFF",
                                textAlign: "center",
                                fontSize: "1.67vh",
                                fontStyle: "normal",
                                fontWeight: 500,
                                lineHeight: "normal",
                                marginBottom: '0.89vh'
                            }}>Enter New Passcode</div>
                            <CircleFillers type={phoneSettings.lockPin.length} length={confirmPasscode.length} mt="" error={false} />
                        </div>
                        <Dialpad onDial={(e)=>{
                            if (e === 'back') {
                                if (confirmPasscode.length > 0) {
                                    setConfirmPasscode(confirmPasscode.slice(0, -1));
                                }
                            } else if(confirmPasscode.length < phoneSettings.lockPin.length) {
                                setConfirmPasscode(confirmPasscode + e);
                            }
                        }} mt="31.11vh"/>
                    </div>}
                </Transition>
                <Transition
                    mounted={showNewConfirmPasscode}
                    transition="scale-y"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        position: "absolute",
                        zIndex: 1,
                        backgroundColor: '#0E0E0E',
                    }}>
                        <div className="soundheader">
                            <div className="back" onClick={() => {
                                setShowNewPasscode(true);
                                setShowNewConfirmPasscode(false);
                            }} style={{ cursor: 'pointer' }}>
                                <svg style={{
                                    flexShrink: '0'
                                }} width="8" height="18" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <div style={{
                                    width: "3.06vh",
                                    height: "1.67vh",
                                    fontStyle: "normal",
                                    fontWeight: 500,
                                    fontSize: "1.39vh",
                                    lineHeight: "1.67vh",
                                    textAlign: "center",
                                    color: "#0A84FF",
                                    flex: "none",
                                    order: 1,
                                    flexGrow: 0,
                                }}>Back</div>
                            </div>
                            <div className="name" style={{ width: 'auto', marginLeft: '1.07vh' }}>Passcode Change</div>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: '4.44vh'
                        }}>
                            <div style={{
                                color: "#FFF",
                                textAlign: "center",
                                fontSize: "1.67vh",
                                fontStyle: "normal",
                                fontWeight: 500,
                                lineHeight: "normal",
                                marginBottom: '0.89vh'
                            }}>Confirm New Passcode</div>
                            <CircleFillers type={phoneSettings.lockPin.length} length={newConfirmPasscode.length} mt="" error={false} />
                        </div>
                        <Dialpad onDial={(e)=>{
                            if (e === 'back') {
                                if (newConfirmPasscode.length > 0) {
                                    setNewConfirmPasscode(newConfirmPasscode.slice(0, -1));
                                }
                            } else if(newConfirmPasscode.length < phoneSettings.lockPin.length) {
                                setNewConfirmPasscode(newConfirmPasscode + e);
                            }
                        }} mt="31.11vh"/>
                    </div>}
                </Transition>
            </div>}
        </Transition>
    );
}