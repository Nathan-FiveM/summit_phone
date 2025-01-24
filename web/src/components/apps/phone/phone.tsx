import { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";

export default function Phone() {
    const nodeRef = useRef(null);
    const { location } = usePhone();
    return (
        <CSSTransition nodeRef={nodeRef} in={location === 'phone'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter>
            <div ref={nodeRef} style={{
                backgroundColor: 'red',
                width: '100%',
                height: '100%',
                zIndex: 10
            }}>
                <h1>Phone</h1>
            </div>
        </CSSTransition>

    )
}