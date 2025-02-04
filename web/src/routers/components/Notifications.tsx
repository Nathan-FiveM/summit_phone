import { CSSTransition, TransitionGroup } from "react-transition-group";
import useNotiQueue from "../../hooks/useNotiQueue";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { createRef } from "react";

export default function Notifications() {
    const notiQueue = useNotiQueue();
    useNuiEvent('addNotification', (data: {
        id: number;
        title: string;
        description: string;
        app: string;
    }) => {
        const noti = {
            id: data.id,
            title: data.title,
            description: data.description,
            app: data.app,
            nodeRef: createRef(),
        }
        notiQueue.add(noti);
        /* setTimeout(() => {
            notiQueue.removeFromNotificationId(data.id);
        }, 5000); */
    });

    return (
        <TransitionGroup className="" style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'auto',
            overflow: 'hidden',
        }}>
            {notiQueue.values.map((noti, index) => {
                return (
                    <CSSTransition
                        key={index}
                        nodeRef={noti.nodeRef}
                        timeout={500}
                        classNames="swipeinleft"
                    >
                    </CSSTransition>
                )
            })}
        </TransitionGroup>
    )
}