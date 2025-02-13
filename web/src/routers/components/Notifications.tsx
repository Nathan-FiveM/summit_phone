import { CSSTransition, TransitionGroup } from "react-transition-group";
import useNotiQueue from "../../hooks/useNotiQueue";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { createRef, useEffect } from "react";
import { notiIcons } from "../../utils/icons";
import { Image } from "@mantine/core";
import { usePhone } from "../../store/store";
import useActionNotiQueue from "../../hooks/useActionNotiQueue";
import { fetchNui } from "../../hooks/fetchNui";

export default function Notifications() {
    const { setNotificationPush, setShowNotiy } = usePhone();
    const notiQueue = useNotiQueue();
    const actionNotiQueue = useActionNotiQueue();

    useNuiEvent('addNotification', (data: {
        id: number;
        title: string;
        description: string;
        app: string;
        timeout?: number;
    }) => {
        const noti = {
            id: data.id,
            title: data.title,
            description: data.description,
            app: data.app,
            nodeRef: createRef(),
        }
        notiQueue.add(noti);
        setNotificationPush(true);
        setTimeout(() => {
            notiQueue.remove();
        }, data.timeout ?? 5000);
    });

    useNuiEvent('addActionNotification', (data: {
        id: string;
        title: string;
        description: string;
        app: string;
        icons: {
            "0": {
                icon: string;
                isServer: boolean;
                event: string;
                args: any;
            },
            "1": {
                icon: string;
                isServer: boolean;
                event: string;
                args: any;
            }
        }
    }) => {
        if (Object.keys(data.icons).length === 2) {
            const noti = {
                id: data.id,
                title: data.title,
                description: data.description,
                app: data.app,
                icons: data.icons,
                nodeRef: createRef(),
            }
            actionNotiQueue.addTwo(noti);
            setShowNotiy(true);
        } else {
            const noti = {
                id: data.id,
                title: data.title,
                description: data.description,
                app: data.app,
                icons: data.icons,
                nodeRef: createRef(),
            }
            actionNotiQueue.add(noti);
            setShowNotiy(true);
        }
    });

    useNuiEvent('removeActionNotification', (id: string) => {
        console.log('removeActionNotification', id);
        actionNotiQueue.removeFromNotificationId(id);
    });

    useEffect(() => {
        if (notiQueue.values.length <= 0) {
            setNotificationPush(false);
        }
    }, [notiQueue.values]);

    useEffect(() => {
        if (actionNotiQueue.values.length <= 0 && actionNotiQueue.twoButtonValues.length <= 0) {
            setShowNotiy(false);
        }
    }, [actionNotiQueue.values]);
    
    return (
        <TransitionGroup className="" style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            height: 'auto',
            overflow: 'hidden',
            zIndex: 100,
        }}>
            {notiQueue.values.map((noti, index) => {
                return (
                    <CSSTransition
                        key={index}
                        nodeRef={noti.nodeRef}
                        timeout={500}
                        classNames="popDown"
                    >
                        <div ref={noti.nodeRef} className="pushNotiFication" style={{
                            marginTop: index === 0 ? '0.38vw' : '0.2604166666666667vw',
                        }}>
                            <Image src={notiIcons(noti.app)} w={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} h={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} />
                            <div className="contextArea">
                                <div className="title">{noti.title}</div>
                                <div className="description">{noti.description}</div>
                            </div>
                        </div>
                    </CSSTransition>
                )
            })}
            {actionNotiQueue.twoButtonValues.map((noti, index) => {
                return (
                    <CSSTransition
                        key={index}
                        nodeRef={noti.nodeRef}
                        timeout={500}
                        classNames="popDown"
                    >
                        <div ref={noti.nodeRef} className="pushActionNotiFication" style={{
                            marginTop: index === 0 ? '0.38vw' : '0.2604166666666667vw',
                        }}>
                            <Image src={notiIcons(noti.app)} w={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} h={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} />
                            <div className="contextArea">
                                <div className="title">{noti.title}</div>
                                <div className="description">{noti.description}</div>
                            </div>
                            <Image src={noti.icons["0"].icon} w={'1.71875vw'} h={'1.71875vw'} style={{
                                minHeight: '1.71875vw',
                                cursor: 'pointer',
                            }} onClick={() => {
                                fetchNui('actionNotiButtonOne', {
                                    id: noti.id,
                                    event: noti.icons["0"].event,
                                    args: noti.icons["0"].args,
                                    isServer: noti.icons["0"].isServer,
                                });
                            }} />
                            <Image src={noti.icons["1"].icon} w={'1.71875vw'} h={'1.71875vw'} style={{
                                minHeight: '1.71875vw',
                                cursor: 'pointer',
                            }} onClick={() => {
                                fetchNui('actionNotiButtonTwo', {
                                    id: noti.id,
                                    event: noti.icons["1"].event,
                                    args: noti.icons["1"].args,
                                    isServer: noti.icons["1"].isServer,
                                });
                            }} />
                        </div>
                    </CSSTransition>
                )
            })}
            {actionNotiQueue.values.map((noti, index) => {
                return (
                    <CSSTransition
                        key={index}
                        nodeRef={noti.nodeRef}
                        timeout={500}
                        classNames="popDown"

                    >
                        <div ref={noti.nodeRef} className="pushActionNotiFication1" style={{
                            marginTop: index === 0 ? '0.38vw' : '0.2604166666666667vw',
                        }}>
                            <Image src={notiIcons(noti.app)} w={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} h={noti.app === 'phone' ? '1.41875vw' : noti.app === 'messsage' ? '1.41875vw' : '1.71875vw'} />
                            <div className="contextArea">
                                <div className="title">{noti.title}</div>
                                <div className="description">{noti.description}</div>
                            </div>
                            <Image src={noti.icons["0"].icon} w={'1.71875vw'} h={'1.71875vw'} style={{
                                minHeight: '1.71875vw',
                                cursor: 'pointer',
                            }} onClick={() => {
                                fetchNui('actionNotiButtonOne', {
                                    id: noti.id,
                                    event: noti.icons["0"].event,
                                    args: noti.icons["0"].args,
                                    isServer: noti.icons["0"].isServer,
                                });
                            }} />
                        </div>
                    </CSSTransition>
                )
            })}
        </TransitionGroup>
    )
}