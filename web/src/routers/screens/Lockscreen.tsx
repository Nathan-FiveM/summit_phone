import { Image } from "@mantine/core";
import lockscreenBg from "../../../images/lockscreenBg.png";
import lockIcon from "../../../images/lockIcon.svg?url";
import unLockIcon from "../../../images/unlockIcon.svg?url";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { Swiper, SwiperSlide } from 'swiper/react';
//@ts-ignore
import 'swiper/css';
import CircleFillers from "../components/circlefillers";
import DialpadV2 from "../components/dialpad2";
import { usePhone } from "../../store/store";
import { fetchNui } from "../../hooks/fetchNui";

export default function Lockscreen() {
    const { phoneSettings, setPhoneSettings } = usePhone();
    const nodeRef = useRef(null);
    const refB1 = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const handleSlideChange = (swiper: any) => {
        if (swiper.activeIndex === 1) {
            setActiveSlide(1);
            refB1.current.style.backdropFilter = "blur(0.62vh)";
        } else {
            setActiveSlide(0);
            refB1.current.style.backdropFilter = "blur(0.00vh)";
        }
    }
    const [passcode, setPasscode] = useState("");

    useEffect(() => {
        if (passcode) {
            if (passcode.length === phoneSettings.lockPin.length) {
                if (passcode === phoneSettings.lockPin) {
                    const dataX = {
                        ...phoneSettings,
                        isLock: false
                    }
                    setPhoneSettings(dataX);
                    fetchNui('unLockorLockPhone', false);
                    setPasscode("");
                    setActiveSlide(0);
                } else {
                    setPasscode("");
                }
            }
        }
    }, [passcode]);
    
    return (
        <CSSTransition nodeRef={nodeRef} in={phoneSettings.usePin && phoneSettings.isLock} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter>
            <div style={{
                backgroundImage: `url(${phoneSettings?.lockscreen?.current || lockscreenBg})`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
            }} ref={nodeRef} className="lockscreen">
                <Image src={phoneSettings.isLock ? lockIcon : unLockIcon} alt="lock" w={'1.37vh'} h={'1.94vh'} mt={'4.09vh'} />
                <div style={{
                    marginTop: "0.53vh",
                    fontWeight: 500,
                    fontSize: "1.85vh",
                    lineHeight: "2.22vh",
                    color: "#FFFFFF",
                    opacity: activeSlide === 1 ? 0 : 0.6,
                    transition: "all 0.15s ease"
                }}>
                    {dayjs().format('dddd DD MMMM')}
                </div>
                <div style={{
                    fontWeight: "500",
                    fontSize: "7.41vh",
                    lineHeight: "8.80vh",
                    color: "#FFFFFF",
                    opacity: activeSlide === 1 ? 0 : 0.7,
                    transition: "all 0.15s ease"
                }}>
                    {dayjs().format('H:mm')}
                </div>
                <div className="bottomButton" style={{
                    opacity: activeSlide === 1 ? 0 : 1,
                    transition: "all 0.15s ease"
                }}>
                    <div className="button1 clickanimation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="0.65vh" height="1.76vh" viewBox="0 0 7 19" fill="none">
                            <path d="M6.01201 0H0.988479C0.263774 0 0.000244141 0.592941 0.000244141 1.31765H7.00024C7.00024 0.592941 6.73672 0 6.01201 0ZM1.03377 4.75588C1.34671 5.11824 1.52377 5.57941 1.52377 6.06118V17.01C1.52377 17.9118 2.26083 18.4471 3.16671 18.4471H3.83789C4.73966 18.4471 5.48083 17.9159 5.48083 17.01V6.06118C5.48083 5.57941 5.65789 5.12235 5.97083 4.75588C6.60495 4.01882 7.00024 3.33529 7.00024 1.97647H0.000244141C0.000244141 3.41765 0.395538 4.01882 1.03377 4.75588ZM2.3473 8.49471C2.3473 7.85235 2.86613 7.32941 3.50024 7.32941C4.13436 7.32941 4.65319 7.85235 4.65319 8.49471V9.95235C4.65319 10.5947 4.13436 11.1176 3.50024 11.1176C2.86613 11.1176 2.3473 10.5947 2.3473 9.95235V8.49471Z" fill="white" />
                            <path d="M2.67668 9.92352C2.67668 10.1419 2.76344 10.3514 2.91789 10.5058C3.07233 10.6603 3.28179 10.7471 3.50021 10.7471C3.71862 10.7471 3.92809 10.6603 4.08253 10.5058C4.23697 10.3514 4.32374 10.1419 4.32374 9.92352C4.32374 9.70511 4.23697 9.49564 4.08253 9.3412C3.92809 9.18675 3.71862 9.09999 3.50021 9.09999C3.28179 9.09999 3.07233 9.18675 2.91789 9.3412C2.76344 9.49564 2.67668 9.70511 2.67668 9.92352Z" fill="white" />
                        </svg>
                    </div>
                    <div className="button1 clickanimation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="1.85vh" height="1.76vh" viewBox="0 0 20 15" fill="none">
                            <path d="M7.00586 8.48962C7.00586 9.28388 7.32138 10.0456 7.88301 10.6073C8.44465 11.1689 9.20638 11.4844 10.0007 11.4844C10.7949 11.4844 11.5567 11.1689 12.1183 10.6073C12.6799 10.0456 12.9954 9.28388 12.9954 8.48962C12.9954 7.69535 12.6799 6.93361 12.1183 6.37198C11.5567 5.81034 10.7949 5.49482 10.0007 5.49482C9.20638 5.49482 8.44465 5.81034 7.88301 6.37198C7.32138 6.93361 7.00586 7.69535 7.00586 8.48962Z" fill="white" />
                            <path d="M18.4117 2.5H15.5732C15.3336 2.5 15.1096 2.39583 14.9482 2.21875C13.469 0.5625 12.9117 0 12.3075 0H7.85441C7.24504 0 6.64608 0.5625 5.1617 2.22396C5.00545 2.40104 4.77629 2.5 4.54191 2.5H4.32837V2.08333C4.32837 1.85417 4.14087 1.66667 3.9117 1.66667H2.55754C2.32837 1.66667 2.14087 1.85417 2.14087 2.08333V2.5H1.75024C0.828369 2.5 0.000244141 3.1875 0.000244141 4.09896V13.2656C0.000244141 14.1771 0.828369 15 1.74504 15H18.4117C19.3284 15 20.0002 14.1771 20.0002 13.2656V4.09896C20.0002 3.1875 19.3284 2.5 18.4117 2.5ZM10.2086 12.9375C7.58879 13.0573 5.43254 10.901 5.55233 8.28125C5.65649 5.99479 7.50545 4.14583 9.79191 4.04167C12.4117 3.92188 14.568 6.07812 14.4482 8.69792C14.344 10.9844 12.495 12.8333 10.2086 12.9375ZM15.0002 5.52083C14.6252 5.52083 14.3232 5.21875 14.3232 4.84375C14.3232 4.46875 14.6252 4.16667 15.0002 4.16667C15.3752 4.16667 15.6773 4.46875 15.6773 4.84375C15.6773 5.21875 15.3752 5.52083 15.0002 5.52083Z" fill="white" />
                        </svg>
                    </div>
                </div>
                <Swiper
                    grabCursor={true}
                    style={{
                        width: "100%", height: "100%", position: "absolute", pointerEvents: "none", left: 0, userSelect: "none"
                    }}
                    direction={"vertical"}
                    initialSlide={0}
                    followFinger={true}
                    autoHeight={false}
                    touchEventsTarget={"container"}
                    onSlideChange={handleSlideChange}
                    ref={refB1}

                >
                    <SwiperSlide>
                        <div className="dropdownScreenX" style={{
                            width: "100%",
                            height: `8%`,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "absolute",
                            bottom: "0",
                            pointerEvents: "all",
                            backgroundColor: "rgba(0, 0, 0, 0)"
                        }}>
                            <div className="dash" style={{
                                backgroundColor: "rgba(255, 255, 255, 1)",
                                width: "45%",
                                height: "0.37vh",
                                borderRadius: "0.18vh",
                                position: 'relative',
                                top: '50%'
                            }} />
                        </div>
                    </SwiperSlide>
                    <SwiperSlide>
                        <div className="lineContainerExternalX" style={{
                            width: "100%",
                            position: "absolute",
                            left: "0",
                            height: "100%",
                            pointerEvents: "all",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                        }}>
                            <Image src={phoneSettings.isLock ? lockIcon : unLockIcon} alt="lock" w={'1.37vh'} h={'1.94vh'} mt={'4.09vh'} />
                            <div className="passcodeText" style={{
                                marginTop: '3.56vh'
                            }}>Enter Passcode</div>
                            <CircleFillers mt="0.53vh" type={phoneSettings?.lockPin?.length || 6} length={passcode.length} error={false} />
                            <DialpadV2 onClick={(number: string) => {
                                setPasscode(passcode + number);
                            }} mt="2.67vh" />
                            <div className="emeButtons" style={{
                                marginTop: "11.56vh",
                            }}>
                                <div className="text1 clickanimation" >Emergency</div>
                                <div className="text1 clickanimation" onClick={() => setPasscode("")}>Cancel</div>
                            </div>
                        </div>
                    </SwiperSlide>
                </Swiper>
            </div>
        </CSSTransition>
    )
}