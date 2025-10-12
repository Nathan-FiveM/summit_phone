import { Button, Image, TextInput, Transition } from "@mantine/core";
import smrtLogo from "../../../images/smrtphone_light.png";
import { useEffect, useState } from "react";
import { useDebouncedCallback, useTimeout } from "@mantine/hooks";
import { Swiper, SwiperSlide } from 'swiper/react';
import hello1 from '../../../images/hellos/1.svg?url';
import hello2 from '../../../images/hellos/2.svg?url';
import hello3 from '../../../images/hellos/3.svg?url';
import hello4 from '../../../images/hellos/4.svg?url';
import hello5 from '../../../images/hellos/5.svg?url';
import hello6 from '../../../images/hellos/6.svg?url';
import hello7 from '../../../images/hellos/7.svg?url';
import hello8 from '../../../images/hellos/8.svg?url';
import hello9 from '../../../images/hellos/9.svg?url';
import smrtLogoSvg from "../../../images/SMRTLogo.svg?url";

//@ts-ignore
import 'swiper/css';
//@ts-ignore
import 'swiper/css/effect-creative';
// import required modules
import { Autoplay, EffectCreative } from 'swiper/modules';
import { countryList } from "../../utils/countrylist";
import { usePhone } from "../../store/store";
import CircleFillers from "../components/circlefillers";
import Dialpad from "../components/dialpad1";
import { fetchNui } from "../../hooks/fetchNui";

export default function Startup() {
    const { visible, phoneSettings, setDynamicNoti, setPhoneSettings } = usePhone();
    const [logoScreen, setLogoScreen] = useState(true);
    const [showsetUpPage, setShowSetupPage] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [showSecondLoadingPage, setShowSecondLoadingPage] = useState(false);
    const [showDataandPrivacy, setShowDataandPrivacy] = useState(false);
    const [showFaceId, setShowFaceId] = useState(false);
    const [showSuccessFacePage, setShowSuccessFacePage] = useState(false);
    const [showPinPage, setShowPinPage] = useState(false);
    const [showConfirmPinPage, setShowConfirmPinPage] = useState(false);
    const [smrtAccountPage, setSmrtAccountPage] = useState(false);
    const [welcomeScreen, setWelcomeScreen] = useState(false);
    const [signUp, setSignUp] = useState(false);



    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const { start, clear } = useTimeout(() => {
        setLogoScreen(false);
    }, 5000);

    const [confirmedPin, setConfirmedPin] = useState('');

    useEffect(() => {
        if (error) {
            setShowConfirmPinPage(false);
            setShowPinPage(true);
            setPin('');
            setConfirmPin('');

            setTimeout(() => {
                setError(false);
            }, 1000)
        }

        return () => {

        }
    }, [error]);

    useEffect(() => {
        if (pin.length === 6) {
            setShowPinPage(false);
            setShowConfirmPinPage(true);
        }
        return () => {

        }
    }, [pin.length]);

    useEffect(() => {
        if (confirmPin.length === 6) {
            if (confirmPin === pin) {
                const dataX = {
                    ...phoneSettings,
                    usePin: true,
                    lockPin: confirmPin
                }
                setPhoneSettings(dataX);
                setDynamicNoti({
                    show: true,
                    type: 'success',
                    timeout: 2000
                });
                setConfirmedPin(confirmPin);
                setShowConfirmPinPage(false);
                setSmrtAccountPage(true);
            } else {
                setDynamicNoti({
                    show: true,
                    type: 'error',
                    timeout: 2000
                });
                setError(true);
            }
        }
        return () => {

        }
    }, [confirmPin.length]);

    useEffect(() => {
        if (visible) {
            start();
        }
        return () => clear() // cleanup
    }, [visible]);

    const [emailError, setEmailError] = useState(false);

    const handleSearchEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchEmail', `${email}@smrt.com`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length === 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);
    const handleValidateEmail = useDebouncedCallback(async (email: string) => {
        const res: string = await fetchNui('searchEmail', `${email}@smrt.com`);
        const parsedRes = JSON.parse(res);
        if (parsedRes.length > 0) {
            setEmailError(false);
        } else {
            setEmailError(true);
        }
        return parsedRes;
    }, 500);
    const [passwordError, setPasswordError] = useState(false);

    const handleRestStatesToOriginal = () => {
        setLogoScreen(true);
        setShowSetupPage(false);
        setSelectedCountry('');
        setShowSecondLoadingPage(false);
        setShowDataandPrivacy(false);
        setShowFaceId(false);
        setShowSuccessFacePage(false);
        setShowPinPage(false);
        setShowConfirmPinPage(false);
        setSmrtAccountPage(false);
        setWelcomeScreen(false);
        setSignUp(false);
        setPin('');
        setConfirmPin('');
        setError(false);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setEmailError(false);
        setPasswordError(false);
    }

    return (
        <Transition
            mounted={phoneSettings.showStartupScreen}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={styles} className="startup">
                <Transition
                    mounted={logoScreen}
                    transition="fade"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles, width: '100%', height: '100%',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        position: 'absolute', backgroundColor: 'black'
                    }}><Image src={smrtLogo} w={'13.89vh'} h={'5.56vh'} className="opacityAnimation" /></div>}
                </Transition>
                <Transition
                    mounted={!logoScreen && !showsetUpPage}
                    transition="fade"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: '100%', height: '100%',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                    }}>
                        <Swiper
                            grabCursor={false}
                            effect={'creative'}
                            creativeEffect={{
                                prev: {
                                    shadow: false,
                                    translate: ['-120%', 0, -500],
                                },
                                next: {
                                    shadow: false,
                                    translate: ['120%', 0, -500],
                                },
                            }}
                            autoplay={{
                                delay: 1000,
                                stopOnLastSlide: true,
                                disableOnInteraction: false,
                            }}
                            modules={[Autoplay, EffectCreative]}
                            className="mySwiper2"
                            style={{ userSelect: 'none', pointerEvents: 'none' }}
                            onSlideChange={(e) => {
                                if (e.activeIndex === 8) {
                                    setTimeout(() => {
                                        setShowSetupPage(true)
                                    }, 1000)
                                }
                            }}
                        >
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello1} w={'10.19vh'} h={'3.33vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello2} w={'10.19vh'} h={'3.15vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello3} w={'10.19vh'} h={'3.15vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello4} w={'10.19vh'} h={'3.80vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello5} w={'12.78vh'} h={'3.15vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello6} w={'12.04vh'} h={'3.15vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello7} w={'10.19vh'} h={'3.15vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello8} w={'10.19vh'} h={'5.00vh'} />
                            </SwiperSlide>
                            <SwiperSlide style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Image src={hello9} w={'10.19vh'} h={'3.15vh'} />
                            </SwiperSlide>
                        </Swiper>
                    </div>}
                </Transition>
                <Transition
                    mounted={showsetUpPage}
                    transition="fade"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles, width: '100%', height: '100%',
                        display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center',
                        position: 'absolute'
                    }}>
                        <Transition
                            mounted={selectedCountry === ''}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center',
                                position: 'absolute', top: '6.09vh'
                            }}>
                                <svg width="5.19vh" height="5.19vh" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M28 3.73333H29.8667C29.8667 3.02629 29.4672 2.37993 28.8348 2.06373L28 3.73333ZM28 7.46667L28.8348 9.13625C29.4672 8.82008 29.8667 8.17372 29.8667 7.46667H28ZM24.2667 9.33333L23.4319 7.66375C22.8367 7.96133 22.4449 8.55322 22.4036 9.21734C22.3623 9.88146 22.6776 10.5174 23.2312 10.8865L24.2667 9.33333ZM29.8667 13.0667L28.8312 14.6198C29.1378 14.8242 29.4981 14.9333 29.8667 14.9333V13.0667ZM31.7333 13.0667V14.9333C32.7643 14.9333 33.6 14.0976 33.6 13.0667H31.7333ZM31.7333 9.33333V7.46667C30.7024 7.46667 29.8667 8.30241 29.8667 9.33333H31.7333ZM37.3333 9.33333H39.2C39.2 8.30241 38.3641 7.46667 37.3333 7.46667V9.33333ZM37.3333 13.0667H35.4667C35.4667 13.5617 35.6633 14.0365 36.0134 14.3866L37.3333 13.0667ZM39.2 14.9333H41.0667C41.0667 14.4383 40.8699 13.9635 40.5201 13.6134L39.2 14.9333ZM39.2 18.6667L40.5201 19.9866C40.8699 19.6366 41.0667 19.1617 41.0667 18.6667H39.2ZM37.3333 20.5333V22.4C37.8284 22.4 38.3033 22.2033 38.6534 21.8533L37.3333 20.5333ZM33.6 20.5333L32.7652 22.2029C33.0244 22.3325 33.3102 22.4 33.6 22.4V20.5333ZM26.1333 16.8L26.9681 15.1304C26.4426 14.8676 25.8241 14.8676 25.2985 15.1304L26.1333 16.8ZM22.4 18.6667V20.5333C22.6898 20.5333 22.9756 20.4659 23.2348 20.3363L22.4 18.6667ZM16.8 18.6667V16.8C15.9435 16.8 15.1968 17.383 14.9891 18.2139L16.8 18.6667ZM14.9333 26.1333L13.1224 25.6806C12.9634 26.3167 13.1498 26.9896 13.6134 27.4533L14.9333 26.1333ZM20.5333 31.7333L19.2134 33.0533C19.3553 33.1951 19.5191 33.3132 19.6985 33.4029L20.5333 31.7333ZM24.2667 33.6H26.1333C26.1333 32.8929 25.7339 32.2466 25.1015 31.9304L24.2667 33.6ZM24.2667 39.2H22.4C22.4 39.695 22.5967 40.1699 22.9467 40.5201L24.2667 39.2ZM26.1333 41.0667H28C28 40.5716 27.8033 40.0967 27.4533 39.7466L26.1333 41.0667ZM26.1333 44.8H24.2667C24.2667 45.0897 24.3341 45.3757 24.4638 45.6348L26.1333 44.8ZM28 48.5333L26.3304 49.3681C26.6466 50.0005 27.2929 50.4 28 50.4V48.5333ZM31.7333 48.5333V50.4C32.3575 50.4 32.9403 50.0879 33.2865 49.569L31.7333 48.5333ZM35.4667 42.9333L37.0198 43.969C37.0628 43.9044 37.1016 43.8375 37.1363 43.7681L35.4667 42.9333ZM37.3333 39.2L39.0029 40.0348C39.1324 39.7757 39.2 39.4897 39.2 39.2H37.3333ZM37.3333 35.4667L35.84 34.3467C35.5977 34.6698 35.4667 35.0628 35.4667 35.4667H37.3333ZM42.9333 28L44.4267 29.12C44.8508 28.5544 44.9191 27.7976 44.6029 27.1652L42.9333 28ZM41.0667 24.2667V22.4C40.4197 22.4 39.819 22.735 39.4789 23.2853C39.1388 23.8356 39.1078 24.5228 39.3971 25.1015L41.0667 24.2667ZM46.6667 24.2667V26.1333C47.6974 26.1333 48.5333 25.2976 48.5333 24.2667H46.6667ZM46.6667 20.5333V18.6667C45.6359 18.6667 44.8 19.5024 44.8 20.5333H46.6667ZM28 52.2667C14.5979 52.2667 3.73333 41.4023 3.73333 28H0C0 43.4638 12.536 56 28 56V52.2667ZM52.2667 28C52.2667 41.4023 41.4023 52.2667 28 52.2667V56C43.4638 56 56 43.4638 56 28H52.2667ZM28 3.73333C41.4023 3.73333 52.2667 14.5979 52.2667 28H56C56 12.536 43.4638 0 28 0V3.73333ZM28 0C12.536 0 0 12.536 0 28H3.73333C3.73333 14.5979 14.5979 3.73333 28 3.73333V0ZM23.4319 3.53627L27.1652 5.40292L28.8348 2.06373L25.1015 0.197069L23.4319 3.53627ZM26.1333 3.73333V7.46667H29.8667V3.73333H26.1333ZM27.1652 5.79708L23.4319 7.66375L25.1015 11.0029L28.8348 9.13625L27.1652 5.79708ZM23.2312 10.8865L28.8312 14.6198L30.9021 11.5135L25.3021 7.78016L23.2312 10.8865ZM29.8667 14.9333H31.7333V11.2H29.8667V14.9333ZM33.6 13.0667V9.33333H29.8667V13.0667H33.6ZM31.7333 11.2H37.3333V7.46667H31.7333V11.2ZM35.4667 9.33333V13.0667H39.2V9.33333H35.4667ZM36.0134 14.3866L37.8799 16.2533L40.5201 13.6134L38.6534 11.7467L36.0134 14.3866ZM37.3333 14.9333V18.6667H41.0667V14.9333H37.3333ZM37.8799 17.3467L36.0134 19.2134L38.6534 21.8533L40.5201 19.9866L37.8799 17.3467ZM37.3333 18.6667H33.6V22.4H37.3333V18.6667ZM34.4348 18.8638L26.9681 15.1304L25.2985 18.4696L32.7652 22.2029L34.4348 18.8638ZM25.2985 15.1304L21.5652 16.9971L23.2348 20.3363L26.9681 18.4696L25.2985 15.1304ZM22.4 16.8H16.8V20.5333H22.4V16.8ZM14.9891 18.2139L13.1224 25.6806L16.7443 26.5861L18.6109 19.1194L14.9891 18.2139ZM13.6134 27.4533L19.2134 33.0533L21.8533 30.4134L16.2533 24.8134L13.6134 27.4533ZM19.6985 33.4029L23.4319 35.2696L25.1015 31.9304L21.3681 30.0637L19.6985 33.4029ZM22.4 33.6V39.2H26.1333V33.6H22.4ZM22.9467 40.5201L24.8134 42.3868L27.4533 39.7466L25.5866 37.8799L22.9467 40.5201ZM24.2667 41.0667V44.8H28V41.0667H24.2667ZM24.4638 45.6348L26.3304 49.3681L29.6696 47.6986L27.8029 43.9652L24.4638 45.6348ZM28 50.4H31.7333V46.6667H28V50.4ZM33.2865 49.569L37.0198 43.969L33.9135 41.8977L30.1802 47.4977L33.2865 49.569ZM37.1363 43.7681L39.0029 40.0348L35.6637 38.3652L33.7971 42.0986L37.1363 43.7681ZM39.2 39.2V35.4667H35.4667V39.2H39.2ZM38.8267 36.5867L44.4267 29.12L41.44 26.88L35.84 34.3467L38.8267 36.5867ZM44.6029 27.1652L42.7362 23.4319L39.3971 25.1015L41.2638 28.8348L44.6029 27.1652ZM41.0667 26.1333H46.6667V22.4H41.0667V26.1333ZM48.5333 24.2667V20.5333H44.8V24.2667H48.5333ZM46.6667 22.4H54.1333V18.6667H46.6667V22.4Z" fill="white" />
                                </svg>
                                <div className="title1">Select Your Country or Region</div>
                                <div className="usabox">
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '90%',
                                    }}>
                                        <div className="text">United States</div>
                                        <svg onClick={() => {
                                            setSelectedCountry("United States");
                                            setShowSecondLoadingPage(true);
                                            setTimeout(() => {
                                                setShowSecondLoadingPage(false);
                                                setShowDataandPrivacy(true);
                                            }, 5000)
                                        }} className="clickButton" style={{ cursor: 'pointer' }} xmlns="http://www.w3.org/2000/svg" width="0.65vh" height="1.11vh" viewBox="0 0 7 12" fill="none">
                                            <path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="othertext">More Countries and Regions</div>
                                <div className="otherCountry">
                                    {countryList.map((country, index) => {
                                        return (
                                            <div key={index} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                width: '90%',
                                                marginTop: '1.42vh'
                                            }}>
                                                <div className="text">{country}</div>
                                                <svg onClick={() => {
                                                    setSelectedCountry(country);
                                                    setShowSecondLoadingPage(true);
                                                    setTimeout(() => {
                                                        setShowSecondLoadingPage(false);
                                                        setShowDataandPrivacy(true);
                                                    }, 5000)
                                                }} className="clickButton" style={{ cursor: 'pointer' }} xmlns="http://www.w3.org/2000/svg" width="0.65vh" height="1.11vh" viewBox="0 0 7 12" fill="none">
                                                    <path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                        )
                                    })}

                                </div>
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showSecondLoadingPage}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                            }}>
                                <div className="mayTake">
                                    It may take a few minutes to activate your SMRT Phone
                                </div>
                                <svg style={{
                                    position: 'absolute',
                                    bottom: '5.51vh',
                                }} xmlns="http://www.w3.org/2000/svg" width="3.47vh" height="3.01vh" viewBox="0 0 26 21" fill="none">
                                    <path d="M4.24495 7.97223H4.93519L5.65993 8.14479L6.1431 8.35186L6.55724 8.62795L6.93687 9.00758L7.21296 9.49075L7.48906 10.181L7.76515 10.9748L8.24832 12.2862L8.55892 12.9764L8.90404 13.5631L9.21465 13.9428L9.55976 14.2879L10.0084 14.5985L10.7332 14.9781L11.3889 15.2197L12.0791 15.3923L12.1827 15.4958L12.2517 15.9445L12.2862 16.6692H13.1835L13.4251 16.8072L13.5286 17.0488V18.3258L13.08 18.3948L12.1481 18.3258L11.1128 18.1532L10.388 17.9806L9.62879 17.7046L8.93855 17.3939L8.42088 17.1179L8.17929 17.0833L8.07576 17.4285L7.97222 20.0859L7.9032 20.3274L7.66162 20.3965L7.24748 20.431L5.52189 20.4655H1.82912L0.931818 20.431L0.448653 20.362L0.103535 20.1894L0 20.0168V18.3948L0.103535 16.8763L0.276094 15.2197L0.483165 13.8047L0.724747 12.6313L1.00084 11.6995L1.31145 10.8022L1.62205 10.112L1.96717 9.52526L2.27778 9.11112L2.58838 8.766L2.96801 8.48991L3.48569 8.21381L3.96886 8.04125L4.24495 7.97223Z" fill="#047DFE" />
                                    <path d="M20.7415 8.11029H21.4663L21.984 8.24834L22.3291 8.38638L22.8122 8.69699L23.1574 9.0076L23.537 9.38723L23.9511 10.0084L24.3653 10.8022L24.6759 11.665L24.952 12.5968L25.1936 13.7012L25.4006 15.0126L25.5732 16.5657L25.6767 17.9807L25.7457 19.7408V20.0514L25.7112 20.362L25.5387 20.431L25.1245 20.4655L23.9166 20.5H21.0867L19.6717 20.4655L18.0151 20.3965L17.808 20.3275L17.739 18.2222L17.7045 17.601L17.601 17.2559L17.5665 17.1524L17.3249 17.1869L16.4276 17.6701L15.7373 17.9461L15.0816 18.1532L13.8392 18.4638L13.5631 18.4983L13.5286 18.3948L12.9074 18.4293V18.3948L13.5286 18.3258L13.4941 17.0488L13.3905 16.8073L13.1835 16.7037L12.2862 16.6692L12.2516 16.6002L12.1826 15.4958L12.6313 15.5303H13.5286L14.2533 15.3923L14.909 15.1507L15.4612 14.8746L15.8754 14.633L16.4621 14.1499L16.7382 13.8392L17.0488 13.3906L17.3594 12.8384L17.601 12.2862L18.4293 9.80137L18.7053 9.3182L18.9814 8.97309L19.292 8.66248L19.7752 8.38638L20.4309 8.17931L20.7415 8.11029Z" fill="#99C6FD" />
                                    <path d="M5.24576 0H5.86697L6.35014 0.0690236L6.93684 0.241582L7.48903 0.517677L7.86866 0.793771L8.07573 0.96633V1.03535L8.21378 1.10438L8.59341 1.62205L8.90401 2.27778L9.04206 2.76094L9.11108 3.2096V3.7963L8.97304 4.48653L8.76596 5.00421L8.48987 5.48737L8.07573 6.00505L7.79963 6.24663L7.42 6.52273L6.90233 6.76431L6.10856 6.97138L5.69442 7.0404L5.24576 7.00589L4.55553 6.83333L4.03785 6.62626L3.55469 6.35017L3.24408 6.10859L2.89896 5.76347L2.58836 5.31481L2.31226 4.79714L2.1397 4.21044L2.07068 3.76178V3.24411L2.17421 2.65741L2.34677 2.10522L2.58836 1.62205L2.89896 1.20791L3.24408 0.828283L3.72724 0.483165L4.21041 0.241582L4.7626 0.0690236L5.24576 0Z" fill="#047DFE" />
                                    <path d="M19.8442 0.103516H20.3274L20.9486 0.207051L21.5698 0.414122L22.122 0.690216L22.5707 1.03533L22.9158 1.41496L23.2264 1.93264L23.468 2.48483L23.6405 3.03702L23.7096 3.41665V3.83079L23.5715 4.452L23.3644 5.00419L23.0883 5.52187L22.8123 5.9015L22.5016 6.24661L22.122 6.52271L21.6043 6.7988L20.9831 7.00587L20.3274 7.10941H19.9823L19.2921 7.00587L18.6363 6.76429L18.1532 6.4882L17.8426 6.24661L17.3939 5.79796L17.1178 5.34931L16.9107 4.93517L16.7382 4.34847L16.6692 4.00335L16.6346 3.65823V3.2786L16.7727 2.6919L16.9798 2.17422L17.2904 1.58752L17.67 1.10436L18.0841 0.75924L18.6363 0.448633L19.4646 0.172539L19.8442 0.103516Z" fill="#99C6FD" />
                                </svg>
                                <div className="unnderText">
                                    SMRT collects hardware identifiers from your SMRT Phone in order to identify and activate it on our services
                                </div>
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showDataandPrivacy}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center',
                                position: 'absolute', top: '5.38vh'
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6.59vh" height="5.29vh" viewBox="0 0 71 57" fill="none">
                                    <path d="M11.6995 21.9723H13.6019L15.5993 22.4479L16.931 23.0186L18.0724 23.7795L19.1187 24.8258L19.8796 26.1575L20.6406 28.0598L21.4015 30.2475L22.7332 33.862L23.5892 35.7644L24.5404 37.3814L25.3965 38.4277L26.3476 39.3789L27.5842 40.2349L29.5817 41.2812L31.3889 41.947L33.2912 42.4226L33.5766 42.708L33.7668 43.9445L33.862 45.942H36.335L37.0008 46.3225L37.2862 46.9883V50.5076L36.0497 50.6979L33.4815 50.5076L30.6279 50.0321L28.6305 49.5565L26.5379 48.7955L24.6355 47.9395L23.2088 47.1785L22.5429 47.0834L22.2576 48.0346L21.9722 55.3587L21.782 56.0245L21.1162 56.2147L19.9747 56.3098L15.2189 56.4049H5.04125L2.56818 56.3098L1.23653 56.1196L0.285354 55.644L0 55.1684V50.6979L0.285354 46.5127L0.760943 41.947L1.33165 38.0472L1.99747 34.8132L2.75842 32.245L3.61448 29.772L4.47054 27.8696L5.42172 26.2526L6.27778 25.1112L7.13384 24.16L8.18014 23.3991L9.6069 22.6381L10.9386 22.1625L11.6995 21.9723Z" fill="#047DFE" />
                                    <path d="M57.1656 22.3528H59.1631L60.5899 22.7333L61.5411 23.1137L62.8727 23.9698L63.8239 24.8258L64.8702 25.8721L66.0116 27.5843L67.153 29.772L68.0091 32.1499L68.77 34.7181L69.4358 37.7619L70.0065 41.3764L70.4821 45.6567L70.7675 49.5565L70.9577 54.4075V55.2636L70.8626 56.1196L70.387 56.3099L69.2456 56.405L65.9165 56.5001H58.1168L54.217 56.405L49.6513 56.2147L49.0806 56.0245L48.8904 50.2223L48.7953 48.5102L48.5099 47.559L48.4148 47.2737L47.749 47.3688L45.2759 48.7004L43.3736 49.4614L41.5663 50.0321L38.1421 50.8881L37.3811 50.9833L37.286 50.6979L35.5739 50.793V50.6979L37.286 50.5077L37.1909 46.9883L36.9055 46.3225L36.3348 46.0371L33.8618 45.942L33.7667 45.7518L33.5764 42.708L34.8129 42.8031H37.286L39.2835 42.4226L41.0907 41.7568L42.6126 40.9959L43.754 40.3301L45.371 38.9984L46.132 38.1423L46.988 36.9058L47.8441 35.3839L48.5099 33.862L50.7927 27.0136L51.5537 25.6819L52.3146 24.7307L53.1707 23.8747L54.5023 23.1137L56.3096 22.543L57.1656 22.3528Z" fill="#99C6FD" />
                                    <path d="M14.4581 0H16.1702L17.5019 0.190236L19.1189 0.665825L20.6408 1.42677L21.6871 2.18771L22.2578 2.6633V2.85354L22.6383 3.04377L23.6845 4.47054L24.5406 6.27778L24.9211 7.60943L25.1113 8.84596V10.463L24.7308 12.3653L24.1601 13.7921L23.3992 15.1237L22.2578 16.5505L21.4968 17.2163L20.4505 17.9773L19.0238 18.6431L16.8361 19.2138L15.6946 19.404L14.4581 19.3089L12.5558 18.8333L11.129 18.2626L9.79734 17.5017L8.94128 16.8359L7.9901 15.8847L7.13404 14.6481L6.3731 13.2214L5.89751 11.6044L5.70728 10.3678V8.94108L5.99263 7.32407L6.46822 5.80219L7.13404 4.47054L7.9901 3.32912L8.94128 2.28283L10.2729 1.33165L11.6046 0.665825L13.1265 0.190236L14.4581 0Z" fill="#047DFE" />
                                    <path d="M54.6929 0.285278H56.0245L57.7367 0.570632L59.4488 1.14134L60.9707 1.90228L62.2072 2.85346L63.1584 3.89976L64.0144 5.32652L64.6803 6.84841L65.1558 8.3703L65.3461 9.41659V10.558L64.9656 12.2701L64.3949 13.792L63.634 15.2188L62.873 16.2651L62.017 17.2163L60.9707 17.9772L59.5439 18.7381L57.8318 19.3088L56.0245 19.5942H55.0734L53.171 19.3088L51.3638 18.643L50.0321 17.8821L49.176 17.2163L47.9395 15.9797L47.1786 14.7432L46.6079 13.6018L46.1323 11.9848L45.942 11.0336L45.8469 10.0824V9.03612L46.2274 7.41912L46.7981 5.99235L47.6542 4.37535L48.7005 3.0437L49.8419 2.09252L51.3638 1.23646L53.6466 0.475514L54.6929 0.285278Z" fill="#99C6FD" />
                                </svg>
                                <div className="dataPrivytext">Data & Privacy</div>
                                <div className="inoftext">
                                    This icon appears when an SMRT feature asks to use your personal information.
                                    <br />
                                    <br />
                                    SMRT collects this information only when needed to enable specific features, secure SMRT services, or personalize your experience.
                                    <br />
                                    <br />
                                    SMRT believes privacy is a fundamental human right, so every SMRT product is designed to minimize the collection and use of your data, use on-device processing whenever possible, and provide transparency and control over your information. Your data on this device is also encrypted and will be permanently removed if you reset to factory settings.
                                </div>
                                <Button className="startupContinue" style={{
                                    marginTop: '8.36vh',
                                    padding: '0',
                                    width: '22.22vh',
                                    height: '2.67vh',
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.05vh',
                                    fontSize: '1.33vh',
                                }} onClick={() => {
                                    setShowFaceId(true);
                                    setShowDataandPrivacy(false);
                                }}>
                                    Continue
                                </Button>
                                <Button mt={'0.53vh'} w={'22.22vh'} style={{
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.02vh',
                                }} h={'2.67vh'} variant="transparent" className="learnMore" onClick={() => {

                                }}>Learn More</Button>
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showFaceId}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center',
                                position: 'absolute', top: '5.33vh'
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6.40vh" height="6.40vh" viewBox="0 0 55 55" fill="none">
                                    <path d="M16.1667 2H15.6C10.8395 2 8.45932 2 6.64109 2.92644C5.0417 3.74137 3.74137 5.0417 2.92644 6.64109C2 8.45932 2 10.8395 2 15.6V16.1667M16.1667 53H15.6C10.8395 53 8.45932 53 6.64109 52.0735C5.0417 51.2586 3.74137 49.9584 2.92644 48.359C2 46.5406 2 44.1606 2 39.4V38.8333M53 16.1667V15.6C53 10.8395 53 8.45932 52.0735 6.64109C51.2586 5.0417 49.9584 3.74137 48.359 2.92644C46.5406 2 44.1606 2 39.4 2H38.8333M53 38.8333V39.4C53 44.1606 53 46.5406 52.0735 48.359C51.2586 49.9584 49.9584 51.2586 48.359 52.0735C46.5406 53 44.1606 53 39.4 53H38.8333M14.75 16.1667V20.4167M40.25 16.1667V20.4167M24.6667 29.2003C26.9333 29.2003 28.9167 27.2169 28.9167 24.9503V16.1667M36.5672 36.5667C31.4672 41.6667 23.2506 41.6667 18.1506 36.5667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="faceIdtext">Face ID</div>
                                <div className="faceidDesc">SMRT Phone can recognize the unique, three-dimensional features of your face to unlock automatically, use Apple Pay, make purchases, or subscribe to services from Apple.</div>

                                <Button className="startupContinue" style={{
                                    marginTop: '31.11vh',
                                    padding: '0',
                                    width: '22.22vh',
                                    height: '2.67vh',
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.05vh',
                                    fontSize: '1.33vh',
                                }} onClick={() => {
                                    setShowFaceId(false);
                                    setShowSuccessFacePage(true);
                                    const dataX = {
                                        ...phoneSettings,
                                        useFaceId: true,
                                        faceIdIdentifier: phoneSettings._id
                                    }
                                    setPhoneSettings(dataX);
                                    setTimeout(() => {
                                        setShowSuccessFacePage(false);
                                        setShowPinPage(true);
                                    }, 2000)
                                    setDynamicNoti({
                                        show: true,
                                        type: 'success',
                                        timeout: 2000
                                    });
                                }}>
                                    Continue
                                </Button>
                                <Button mt={'0.53vh'} w={'22.22vh'} style={{
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.02vh',
                                }} h={'2.67vh'} variant="transparent" className="learnMore" onClick={() => {
                                    setShowFaceId(false);
                                    setShowPinPage(true);
                                    const dataX = {
                                        ...phoneSettings,
                                        useFaceId: false,
                                        faceIdIdentifier: phoneSettings._id
                                    }
                                    setPhoneSettings(dataX);
                                }}>Set Up Later</Button>
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showSuccessFacePage}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontSize: '1.75vh'
                            }}>
                                Face ID is Now Set Up
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showPinPage}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center', position: 'absolute', top: '6.22vh'
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="4.72vh" height="6.39vh" viewBox="0 0 51 69" fill="none">
                                    <path d="M2.79126 46.8238C2.79126 37.411 2.79126 32.7046 4.81222 29.7803C6.83318 26.8561 10.0859 26.8561 16.5912 26.8561H34.9912C41.4965 26.8561 44.7492 26.8561 46.7702 29.7803C48.7912 32.7046 48.7912 37.411 48.7912 46.8238C48.7912 56.2365 48.7912 60.9429 46.7702 63.8672C44.7492 66.7915 41.4965 66.7915 34.9912 66.7915H16.5912C10.0859 66.7915 6.83318 66.7915 4.81222 63.8672C2.79126 60.9429 2.79126 56.2365 2.79126 46.8238Z" stroke="white" strokeWidth="4" />
                                    <path d="M8.86938 26.856V20.8398C8.86938 10.8719 16.4456 2.79138 25.7913 2.79138C35.137 2.79138 42.7132 10.8719 42.7132 20.8398V26.856" stroke="white" strokeWidth="4" strokeLinecap="round" />
                                </svg>
                                <div className="pinPageTitle1">Create an SMRT Phone Passcode</div>
                                <div className="pinPageTitle2">Face ID provides convenient and secure access by recognizing your face.</div>
                                <div className="pinPageTitle3">Occasionally your passcode will be required for validation.</div>
                                <CircleFillers mt="4.56vh" type={6} length={pin.length} error={false} />
                                <Dialpad onDial={(number: string) => {
                                    if (pin.length < 6 && number !== 'back') {
                                        setPin(pin + number);
                                    } else if (number === 'back') {
                                        setPin(pin.slice(0, -1));
                                    }
                                }} />
                            </div>}
                        </Transition>
                        <Transition
                            mounted={showConfirmPinPage}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center', position: 'absolute', top: '6.22vh'
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="4.72vh" height="6.39vh" viewBox="0 0 51 69" fill="none">
                                    <path d="M2.79126 46.8238C2.79126 37.411 2.79126 32.7046 4.81222 29.7803C6.83318 26.8561 10.0859 26.8561 16.5912 26.8561H34.9912C41.4965 26.8561 44.7492 26.8561 46.7702 29.7803C48.7912 32.7046 48.7912 37.411 48.7912 46.8238C48.7912 56.2365 48.7912 60.9429 46.7702 63.8672C44.7492 66.7915 41.4965 66.7915 34.9912 66.7915H16.5912C10.0859 66.7915 6.83318 66.7915 4.81222 63.8672C2.79126 60.9429 2.79126 56.2365 2.79126 46.8238Z" stroke="white" strokeWidth="4" />
                                    <path d="M8.86938 26.856V20.8398C8.86938 10.8719 16.4456 2.79138 25.7913 2.79138C35.137 2.79138 42.7132 10.8719 42.7132 20.8398V26.856" stroke="white" strokeWidth="4" strokeLinecap="round" />
                                </svg>
                                <div className="pinPageTitle1">Create an SMRT Phone Passcode</div>
                                <div className="pinPageTitle2">Re-enter your passcode.</div>
                                <CircleFillers mt="8.12vh" type={6} length={confirmPin.length} error={error} />
                                <Dialpad mt="11.02vh" onDial={(number: string) => {
                                    if (confirmPin.length < 6 && number !== 'back') {
                                        setConfirmPin(confirmPin + number);
                                    } else if (number === 'back') {
                                        setConfirmPin(confirmPin.slice(0, -1));
                                    }
                                }} />
                            </div>}
                        </Transition>
                        <Transition
                            mounted={smrtAccountPage}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center', position: 'absolute', top: '6.09vh'
                            }}>
                                <Image src={smrtLogoSvg} alt="SMRT Logo" w="7.47vh" h="7.47vh" />
                                <div className="smrtAccount">SMRT Account</div>
                                <div className="smrDescription">Sign in with an email or phone  or phone number  to use SMRT Cloud, the SMRT Store, and other SMRT services.</div>
                                <TextInput onFocus={() => {
                                    fetchNui('disableControls', true);
                                }} onBlur={() => {
                                    fetchNui('disableControls', false);
                                }} rightSection={
                                    <div style={{
                                        fontSize: '1.33vh',
                                    }}>
                                        @smrt.com
                                    </div>
                                } value={email} error={emailError} onChange={async (e) => {
                                    if (signUp) {
                                        setEmail(e.target.value);
                                        handleSearchEmail(e.target.value);
                                    } else {
                                        setEmail(e.target.value);
                                        const res = handleValidateEmail(e.target.value);
                                    }
                                }} placeholder="Email" className="inputForEmail" styles={{
                                    input: {
                                        fontFamily: 'SFPro',
                                        fontSize: '1.33vh',
                                        color: 'white',
                                        width: '24.00vh',
                                        background: 'rgba(255, 255, 255, 0.0)',
                                        border: 'none',
                                    },
                                }} style={{
                                    marginTop: '3.45vh',
                                    display: 'flex',
                                    width: '27.56vh',
                                    height: '3.45vh',
                                    alignItems: 'center',
                                    gap: '0.93vh',
                                    borderRadius: '0.47vh',
                                    background: 'rgba(255, 255, 255, 0.30)',
                                }} />
                                <TextInput onChange={(e) => {
                                    setPassword(e.target.value);
                                }} onFocus={() => {
                                    fetchNui('disableControls', true);
                                }} onBlur={() => {
                                    fetchNui('disableControls', false);
                                }} value={password} error={passwordError} placeholder="Password" type="password" className="inputForEmail" styles={{
                                    input: {
                                        fontFamily: 'SFPro',
                                        width: '27.56vh',
                                        background: 'rgba(255, 255, 255, 0.0)',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '1.33vh',
                                    },
                                }} style={{
                                    marginTop: '1.21vh',
                                    display: 'flex',
                                    width: '27.56vh',
                                    height: '3.45vh',
                                    alignItems: 'center',
                                    gap: '0.93vh',
                                    borderRadius: '0.47vh',
                                    background: 'rgba(255, 255, 255, 0.30)',
                                }} />
                                {signUp && <TextInput onFocus={() => {
                                    fetchNui('disableControls', true);
                                }} onBlur={() => {
                                    fetchNui('disableControls', false);
                                }} value={confirmPassword} placeholder="Confirm Password" type="password" className="inputForEmail" styles={{
                                    input: {
                                        fontFamily: 'SFPro',
                                        color: 'white',
                                        width: '27.56vh',
                                        background: 'rgba(255, 255, 255, 0.0)',
                                        border: 'none',
                                        fontSize: '1.33vh',
                                    },
                                }} onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                }} style={{
                                    marginTop: '1.21vh',
                                    display: 'flex',
                                    width: '27.56vh',
                                    height: '3.45vh',
                                    alignItems: 'center',
                                    gap: '0.93vh',
                                    borderRadius: '0.47vh',
                                    background: 'rgba(255, 255, 255, 0.30)',
                                }} />}
                                <Button style={{
                                    padding: '0',
                                    width: '25.78vh',
                                    height: '3.02vh',
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.05vh',
                                    fontSize: '1.33vh',
                                    background: '#1F53D8',
                                    marginTop: '2.24vh'
                                }} onClick={async () => {
                                    if (email.length < 4 && password.length < 4 && email.includes('@')) return;
                                    if (signUp && password !== confirmPassword) return;
                                    if (emailError) return;
                                    if (!signUp) {
                                        const res: boolean = await fetchNui('loginMailAccount', JSON.stringify({
                                            email: `${email}@smrt.com`,
                                            password: password
                                        }));
                                        setPasswordError(!res);
                                        if (!res) return;
                                    }
                                    const dataX = {
                                        ...phoneSettings,
                                        smrtId: `${email}@smrt.com`,
                                        smrtPassword: signUp ? confirmPassword : password
                                    }
                                    setPhoneSettings(dataX);
                                    setSmrtAccountPage(false);
                                    setWelcomeScreen(true);
                                    if (signUp) {
                                        fetchNui('registerNewMailAccount', JSON.stringify({
                                            email: `${email}@smrt.com`,
                                            password: confirmPassword
                                        }));
                                    }
                                }}>
                                    Continue
                                </Button>
                                <Button mt={'0.53vh'} w={'25.78vh'} style={{
                                    fontFamily: 'SFPro',
                                    letterSpacing: '0.02vh',
                                    fontSize: '1.33vh',
                                }} h={'2.67vh'} variant="transparent" onClick={() => {
                                    setSignUp(!signUp);
                                    if (!signUp) {
                                        handleSearchEmail(email);
                                    } else {
                                        handleValidateEmail(email);
                                    }
                                }}>{!signUp ? 'Sign Up' : 'Login'}</Button>
                                <svg style={{ marginTop: signUp ? '6.04vh' : '10.67vh' }} xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="1.94vh" viewBox="0 0 26 21" fill="none">
                                    <path d="M4.24495 7.97223H4.93519L5.65993 8.14479L6.1431 8.35186L6.55724 8.62795L6.93687 9.00758L7.21296 9.49075L7.48906 10.181L7.76515 10.9748L8.24832 12.2862L8.55892 12.9764L8.90404 13.5631L9.21465 13.9428L9.55976 14.2879L10.0084 14.5985L10.7332 14.9781L11.3889 15.2197L12.0791 15.3923L12.1827 15.4958L12.2517 15.9445L12.2862 16.6692H13.1835L13.4251 16.8072L13.5286 17.0488V18.3258L13.08 18.3948L12.1481 18.3258L11.1128 18.1532L10.388 17.9806L9.62879 17.7046L8.93855 17.3939L8.42088 17.1179L8.17929 17.0833L8.07576 17.4285L7.97222 20.0859L7.9032 20.3274L7.66162 20.3965L7.24748 20.431L5.52189 20.4655H1.82912L0.931818 20.431L0.448653 20.362L0.103535 20.1894L0 20.0168V18.3948L0.103535 16.8763L0.276094 15.2197L0.483165 13.8047L0.724747 12.6313L1.00084 11.6995L1.31145 10.8022L1.62205 10.112L1.96717 9.52526L2.27778 9.11112L2.58838 8.766L2.96801 8.48991L3.48569 8.21381L3.96886 8.04125L4.24495 7.97223Z" fill="#047DFE" />
                                    <path d="M20.7415 8.11029H21.4663L21.984 8.24834L22.3291 8.38638L22.8122 8.69699L23.1574 9.0076L23.537 9.38723L23.9511 10.0084L24.3653 10.8022L24.6759 11.665L24.952 12.5968L25.1936 13.7012L25.4006 15.0126L25.5732 16.5657L25.6767 17.9807L25.7457 19.7408V20.0514L25.7112 20.362L25.5387 20.431L25.1245 20.4655L23.9166 20.5H21.0867L19.6717 20.4655L18.0151 20.3965L17.808 20.3275L17.739 18.2222L17.7045 17.601L17.601 17.2559L17.5665 17.1524L17.3249 17.1869L16.4276 17.6701L15.7373 17.9461L15.0816 18.1532L13.8392 18.4638L13.5631 18.4983L13.5286 18.3948L12.9074 18.4293V18.3948L13.5286 18.3258L13.4941 17.0488L13.3905 16.8073L13.1835 16.7037L12.2862 16.6692L12.2516 16.6002L12.1826 15.4958L12.6313 15.5303H13.5286L14.2533 15.3923L14.909 15.1507L15.4612 14.8746L15.8754 14.633L16.4621 14.1499L16.7382 13.8392L17.0488 13.3906L17.3594 12.8384L17.601 12.2862L18.4293 9.80137L18.7053 9.3182L18.9814 8.97309L19.292 8.66248L19.7752 8.38638L20.4309 8.17931L20.7415 8.11029Z" fill="#99C6FD" />
                                    <path d="M5.24588 0H5.8671L6.35026 0.0690236L6.93696 0.241582L7.48915 0.517677L7.86878 0.793771L8.07585 0.96633V1.03535L8.2139 1.10438L8.59353 1.62205L8.90413 2.27778L9.04218 2.76094L9.1112 3.2096V3.7963L8.97316 4.48653L8.76609 5.00421L8.48999 5.48737L8.07585 6.00505L7.79976 6.24663L7.42013 6.52273L6.90245 6.76431L6.10868 6.97138L5.69454 7.0404L5.24588 7.00589L4.55565 6.83333L4.03797 6.62626L3.55481 6.35017L3.2442 6.10859L2.89908 5.76347L2.58848 5.31481L2.31238 4.79714L2.13982 4.21044L2.0708 3.76178V3.24411L2.17434 2.65741L2.3469 2.10522L2.58848 1.62205L2.89908 1.20791L3.2442 0.828283L3.72737 0.483165L4.21053 0.241582L4.76272 0.0690236L5.24588 0Z" fill="#047DFE" />
                                    <path d="M19.8444 0.103516H20.3275L20.9487 0.207051L21.57 0.414122L22.1221 0.690216L22.5708 1.03533L22.9159 1.41496L23.2265 1.93264L23.4681 2.48483L23.6407 3.03702L23.7097 3.41665V3.83079L23.5716 4.452L23.3646 5.00419L23.0885 5.52187L22.8124 5.9015L22.5018 6.24661L22.1221 6.52271L21.6045 6.7988L20.9833 7.00587L20.3275 7.10941H19.9824L19.2922 7.00587L18.6364 6.76429L18.1533 6.4882L17.8427 6.24661L17.394 5.79796L17.1179 5.34931L16.9109 4.93517L16.7383 4.34847L16.6693 4.00335L16.6348 3.65823V3.2786L16.7728 2.6919L16.9799 2.17422L17.2905 1.58752L17.6701 1.10436L18.0843 0.75924L18.6364 0.448633L19.4647 0.172539L19.8444 0.103516Z" fill="#99C6FD" />
                                </svg>
                                <div className="smrtDesc">
                                    Your SMRT Account information is used to enable SMRT services when you sign in, including SMRT Cloud Backup, which automatically backs up the data on your device in case you need to replace or restore it. Your device serial number may be used to check eligibility for service offers. See how your data is managed...
                                </div>
                            </div>}
                        </Transition>
                        <Transition
                            mounted={welcomeScreen}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles, width: '100%', height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'start', alignItems: 'center', position: 'absolute', top: '48%'
                            }}>
                                <div className="smrtPhoneText" style={{
                                    color: "#FFF",
                                    textAlign: "center",
                                    fontFamily: "SFPro",
                                    fontSize: "2.13vh",
                                    fontStyle: "normal",
                                    fontWeight: 700,
                                    lineHeight: "119.414%",
                                }}>Welcome to SMRT Phone</div>
                                <div className="swipeUp" style={{
                                    marginTop: '27.02vh',
                                    color: "#FFF",
                                    textAlign: "center",
                                    fontSize: "1.39vh",
                                    fontStyle: "normal",
                                    fontWeight: 500,
                                    lineHeight: "119.414%",
                                }}>Click to get started</div>

                                <div onClick={() => {
                                    const finalPin = confirmedPin || confirmPin; // Use confirmedPin as backup
                                    const dataX = {
                                        ...phoneSettings,
                                        usePin: true,
                                        lockPin: finalPin,
                                        showStartupScreen: false,
                                    }
                                    setPhoneSettings(dataX);
                                    fetchNui('setSettings', JSON.stringify(dataX));
                                    setWelcomeScreen(false);
                                    handleRestStatesToOriginal();
                                }} className="dash" style={{
                                    width: '15.74vh',
                                    height: '0.46vh',
                                    flexShrink: 0,
                                    marginTop: '0.91vh',
                                    borderRadius: '0.65vh',
                                    background: '#D9D9D9',
                                    cursor: 'pointer',
                                }}></div>
                            </div>}
                        </Transition>
                    </div>}
                </Transition>
            </div >}
        </Transition >
    )
}