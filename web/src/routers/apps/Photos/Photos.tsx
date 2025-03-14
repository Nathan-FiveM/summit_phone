import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import Title from "../../components/Title";
import { ActionIcon, Button, Image, Modal } from "@mantine/core";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import { setClipboard } from "../../../hooks/misc";
import { useDisclosure } from "@mantine/hooks";
import { Portal } from '@mantine/core';


export default function Photos(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    const [opened, { open, close }] = useDisclosure(false);
    const [photos, setPhotos] = useState<{
        _id: string;
        citizenId: string;
        link: string;
        date: string;
    }[]>([]);
    const [seletedLink, setSelectedLink] = useState<string>('');
    useNuiEvent('photos:viewPhoto', async (data: string) => {
        const link = photos.find((photo) => photo._id === data)?.link;
        if (link) {
            setSelectedLink(link);
            open();
            await fetchNui('phone:contextMenu:close', "Ok");
        }
    });

    useNuiEvent('photos:copyLink', async (data: string) => {
        setClipboard(photos.find((photo) => photo._id === data)?.link);
        await fetchNui('phone:contextMenu:close', "Ok");
    });

    useNuiEvent('phone:deletePhoto', async (data: string) => {
        setPhotos(photos.filter((photo) => photo._id !== data));
        await fetchNui('phone:contextMenu:close', "Ok");
    });

    const container = document.createElement('div');
    document.body.appendChild(container);

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'photos'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const res = await fetchNui('getPhotos', "Ok");
                const parsedRes = JSON.parse(res as string);
                setPhotos(parsedRes);
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
                <div style={{
                    marginLeft: '0vw',
                    marginTop: '2vw',
                    letterSpacing: '0.1vw',
                }}>
                    <Title title="Photos" />
                </div>
                <div style={{
                    width: '90%',
                    height: '86%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(3.125vw, 1fr))',
                    gridAutoRows: '3.125vw',
                    gap: '0.5208333333333334vw',
                }}>
                    {photos && photos.map((photo, i) => {
                        return (
                            <Image onClick={async () => {
                                await fetchNui('selectPhoto', photo._id);
                            }} key={i} src={photo.link} alt="photo" style={{
                                width: '3.125vw',
                                height: '3.125vw',
                                cursor: 'pointer',
                            }} />
                        )
                    })}
                </div>
                {opened && (
                    <Portal target={container}>
                        <div style={{
                            position: 'fixed',
                            left: '28%',
                            top: '16%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            width: '40vw',
                            height: '40vw',
                        }}>
                            <ActionIcon onClick={close} size={'1.0416666666666667vw'} variant="default" aria-label="ActionIcon with size as a number">
                                X
                            </ActionIcon>
                            <Image src={seletedLink} alt="photo" style={{
                                height: '100%',
                                objectFit: 'contain',
                            }} />
                        </div>
                    </Portal>
                )}
            </div>
        </CSSTransition>
    );
}
