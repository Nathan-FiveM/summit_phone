import { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";

export default function Wallet(props: { onEnter: () => void, onExit: () => void }) {
    const nodeRef = useRef(null);
    const { location } = usePhone();

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'wallet'}
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