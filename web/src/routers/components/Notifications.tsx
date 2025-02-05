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
        console.log(JSON.stringify(noti));
        notiQueue.add(noti);
        setTimeout(() => {
            /* notiQueue.removeFromNotificationId(data.id); */
            console.log(JSON.stringify(notiQueue.values, null, 2));
        }, 5000);
    });

    return (
        <TransitionGroup className="" style={{
            postion: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            height: 'auto',
            overflow: 'hidden',
            zIndex: 60,
        }}>
            {notiQueue.values.map((noti, index) => {
                return (
                    <CSSTransition
                        key={index}
                        nodeRef={noti.nodeRef}
                        timeout={500}
                        classNames="swipeinleft"
                    >
                        <div ref={noti.nodeRef} style={{
                            width: '14.5vw',
                            height: '3vw',
                            backgroundColor: 'rgba(0, 0, 0, 1)',
                            marginTop: index === 0 ? '0.35vw' : '0.3vw',
                            borderRadius: '2vw',
                        }}>
                            das
                        </div>
                    </CSSTransition>
                )
            })}
        </TransitionGroup>
    )
}