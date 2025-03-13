import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { dataURItoBlob, MainRender } from "./CameraAdapter";
import { fetchNui } from "../../../hooks/fetchNui";



export default function Camera(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    const canvasE = useRef<HTMLCanvasElement>(null);
    const [landscape, setLandscape] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [selfiMode, setSelfiMode] = useState(false);

    const handleCapture = async () => {
        const image = await MainRender.captureImage();

        const formData = new FormData();
        formData.append('files[]', dataURItoBlob(image), `screenshot.png`);

        fetch('http://localhost/upload', {
            method: 'POST',
            mode: 'cors',
            body: formData
        })
            .then(response => response.text())
            .then((text: any) => {
                /* const textX = JSON.parse(text); */
                console.log(JSON.stringify(text));
                /*  if (textX.attachments[0].url) {
                     console.log(textX.attachments[0].url);
                 } else {
                     console.log(false);
                 } */

            });
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'camera'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={() => {
                props.onEnter();
                MainRender.initializeAgain();
                MainRender.renderToTarget();
                MainRender.resize(false);
                MainRender.getStream().then((stream) => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                });
            }}
            onExiting={()=>{
                MainRender.stop();
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
                    alignItems: 'flex-start',
                }}
                className="settings"
            >
                <video
                    ref={localVideoRef}
                    id="videocall-canvas"
                    autoPlay
                    muted
                    style={!landscape ? {
                        marginLeft: '0vw',
                        marginTop: '2vw',
                    } : {
                        width: '29.166666666666668vw',
                        height: '16.666666666666668vw',
                        rotate: '90deg',
                        marginTop: '8.2vw',
                        marginLeft: '-6.2vw',
                        borderRadius: '0.5208333333333334vw',
                    }}
                />

                <div style={{
                    position: 'relative',
                    left: landscape ? '27%' : '29%',
                    top: landscape ? '20%' : '2%',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '1.0416666666666667vw',
                }}>
                    <svg onClick={() => {
                        setLandscape(!landscape);
                        if (!landscape) {
                            setLocation({
                                app: 'camera',
                                page: {
                                    ...location.page,
                                    camera: 'landscape',
                                }
                            });
                            MainRender.resize(true);
                        } else {
                            setLocation({
                                app: 'camera',
                                page: {
                                    ...location.page,
                                    camera: 'portrait',
                                }
                            });
                            MainRender.resize(false);
                        }
                    }} style={{
                        rotate: landscape ? '90deg' : '0deg',
                    }} className='clickanimation' width="1.25vw" height="1.0416666666666667vw" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 0C0.892 0 0 0.892 0 2V18C0 19.108 0.892 20 2 20H22C23.108 20 24 19.108 24 18V2C24 0.892 23.108 0 22 0H2ZM12 3.62891C15.51 3.62891 18.3711 6.49 18.3711 10H20.5L17.666 13.541L14.834 10H16.9551C16.9551 7.25563 14.7444 5.04492 12 5.04492C11.4161 5.04492 10.8592 5.15004 10.3398 5.33398L9.26172 4.25781C10.0928 3.85947 11.0194 3.62891 12 3.62891ZM6.33398 6.45898L9.16602 10H7.04492C7.04492 12.7444 9.25563 14.9551 12 14.9551C12.5839 14.9551 13.1408 14.85 13.6602 14.666L14.7383 15.7422C13.9072 16.1405 12.9806 16.3711 12 16.3711C8.49 16.3711 5.62891 13.51 5.62891 10H3.5L6.33398 6.45898Z" fill="white" />
                    </svg>
                    <svg onClick={async () => {
                        await handleCapture();
                    }} className='clickanimation' width="2.34375vw" height="2.34375vw" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.5 23C18.7467 23 23 18.7467 23 13.5C23 8.25329 18.7467 4 13.5 4C8.25329 4 4 8.25329 4 13.5C4 18.7467 8.25329 23 13.5 23Z" fill="white" />
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M27 13.5C27 20.9558 20.9558 27 13.5 27C6.04416 27 0 20.9558 0 13.5C0 6.04416 6.04416 0 13.5 0C20.9558 0 27 6.04416 27 13.5ZM26 13.5C26 20.4036 20.4036 26 13.5 26C6.59644 26 1 20.4036 1 13.5C1 6.59644 6.59644 1 13.5 1C20.4036 1 26 6.59644 26 13.5Z" fill="white" />
                    </svg>
                    <svg style={{
                        rotate: landscape ? '90deg' : '0deg',
                    }} onClick={() => {
                        fetchNui('selfiMode', !selfiMode);
                        setSelfiMode(!selfiMode);
                    }} className='clickanimation' width="1.40625vw" height="1.25vw" viewBox="0 0 27 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.8974 23C5.87895 23 1 18.0751 1 12C1 5.92487 5.87895 1 11.8974 1C17.9159 1 22.7949 5.92487 22.7949 12C22.7949 13.9972 22.2676 15.8701 21.3459 17.4845M21.3459 17.4845L26 15.8824M21.3459 17.4845L20.9088 17.6348L19.1727 12.4959" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
            </div>
        </CSSTransition>
    );
}
