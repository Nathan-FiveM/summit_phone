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
import InputDialog from "../DarkChat/InputDialog";


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
    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);
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
    let container = null;

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
                container = document.createElement('div');
                document.body.appendChild(container);
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
                    marginLeft: '0.00vh',
                    marginTop: '3.56vh',
                    letterSpacing: '0.18vh',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '90%',
                }}>
                    <Title title="Photos" />
                    <svg onClick={async () => {
                        setInputShow(true);
                        setInputTitle('Import Image');
                        setInputDescription('Import an image from URL.');
                        setInputPlaceholder('Link to image');
                    }} style={{ marginTop: '0.89vh' }} className='clickanimation' width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.55556 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55556M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <div style={{
                    width: '90%',
                    height: '86%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(5.56vh, 1fr))',
                    gridAutoRows: '5.56vh',
                    gap: '0.93vh',
                }}>
                    {photos && photos.map((photo, i) => {
                        return (
                            <Image onClick={async () => {
                                await fetchNui('selectPhoto', photo._id);
                            }} key={i} src={photo.link} alt="photo" style={{
                                width: '5.56vh',
                                height: '5.56vh',
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
                            width: '71.11vh',
                            height: '71.11vh',
                        }}>
                            <ActionIcon onClick={close} size={'1.85vh'} variant="default" aria-label="ActionIcon with size as a number">
                                X
                            </ActionIcon>
                            <Image src={seletedLink} alt="photo" style={{
                                height: '100%',
                                objectFit: 'contain',
                            }} />
                        </div>
                    </Portal>
                )}
                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Import Image') {
                        if (e === '') return;
                        const res = await fetchNui('saveimageToPhotos', e);
                        const parsedRes = JSON.parse(res as string);
                        setPhotos([...photos, parsedRes]);
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>
        </CSSTransition>
    );
}
