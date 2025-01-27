import { useRef, useState } from "react";
import { CSSTransition, } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Transition } from "@mantine/core";
import DialpadV3 from "../../components/dialpad3";
import { fetchNui } from "../../../hooks/fetchNui";

export default function Phone() {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation } = usePhone();
    const [dialedNumber, setDialedNumber] = useState('87');


    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'phone'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {

        }}>
            <div ref={nodeRef} style={{
                backgroundColor: '#0E0E0E',
                width: '100%',
                height: '100%',
                zIndex: 10,
                position: 'relative',
            }}>
                <Transition
                    mounted={location.page.phone === 'keypad'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <div className="NumberDialing">
                            {dialedNumber}
                        </div>
                        <DialpadV3 len={dialedNumber.length} mt="2vw" onClick={async (n) => {
                            if (dialedNumber.length !== 10) {
                                setDialedNumber(dialedNumber + n);
                            }
                        }} onBack={() => {
                            setDialedNumber(dialedNumber.slice(0, -1));
                        }} onCall={async () => {
                            await fetchNui('phone:call', JSON.stringify({
                                number: dialedNumber,
                                email: phoneSettings.smrtId,
                                citizenId: phoneSettings._id,
                            }));
                        }} />
                    </div>}
                </Transition>
                <Transition
                    mounted={location.page.phone === 'contacts'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontFamily: 'SFPro'
                    }}>

                    </div>}
                </Transition>
                <Navigation onClick={(locate) => {
                    setLocation({
                        app: location.app,
                        page: {
                            phone: locate
                        }
                    });
                }} location={location.page.phone} />
            </div>
        </CSSTransition>

    )
}