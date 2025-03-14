import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";


export default function DarkChat(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    

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
                
            </div>
        </CSSTransition>
    );
}
