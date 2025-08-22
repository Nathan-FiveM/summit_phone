import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { usePhone } from "../../store/store";
import DialpadV2 from "./dialpad2";
import { fetchNui } from "../../hooks/fetchNui";
import { PhoneContacts } from "../../../../types/types";
import Searchbar from "./SearchBar";
import AlphabetSearch from "./AlphabetSearch";
import { Transition } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

export default function CallComponent() {
    const { inCall, calling, setInCall, setCalling } = usePhone();
    const nodeRef = useRef(null);
    const [callingData, setCallingData] = useState<{
        callId: number,
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    }>();

    useNuiEvent('inCall', (data: boolean) => {
        setInCall(data);
    });

    useNuiEvent('addCallingInterFace', (data: {
        data: string,
        show: boolean
    }) => {
        setCallingData(JSON.parse(data.data));
        setCalling(data.show);
    });

    useNuiEvent('startCallAccepted', (data: string) => {
        const dataX = JSON.parse(data);
        setCallingData(dataX);
        setCalling(false);
        setInCall(true);
    });

    useNuiEvent('removeAccpetedCallingInterface', () => {
        setCallingData({
            callId: 0,
            targetSource: 0,
            targetName: '',
            sourceName: '',
            callerSource: 0,
            databaseTableId: ''
        });
        setInCall(false);
    });

    useNuiEvent('upDateInterFaceName', (name: string) => {
        setCallingData({
            ...callingData,
            targetName: name
        });
    })

    useNuiEvent('removeCallingInterface', (data: {
        data: string,
        show: boolean
    }) => {
        setCallingData({
            callId: 0,
            targetSource: 0,
            targetName: '',
            sourceName: '',
            callerSource: 0,
            databaseTableId: ''
        });
        setCalling(data.show);
    });

    const [showDialPad, setShowDialPad] = useState(false);
    const [dialedNumber, setDialedNumber] = useState('');
    const [showContactsPortal, setShowContactsPortal] = useState(false);
    const [phoneContacts, setPhoneContacts] = useState<{ [key: string]: PhoneContacts[] }>({});
    const [searchValue, setSearchValue] = useState('');
    const [alphabetArrange, setAlphabetArrange] = useState<string>('');
    const [volume] = useLocalStorage({
        key: 'volume',
        defaultValue: 50,
    });

    return (
        <Transition
            mounted={inCall || calling}
            transition="fade"
            duration={450}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(3.06vh)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50
            }}>
                <div style={{ width: '95%', display: 'flex', marginTop: '3.91vh', justifyContent: 'end' }}>
                    <svg width="2.13vh" height="2.13vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.82212 5.96154C8.82212 6.21655 8.92342 6.46113 9.10374 6.64145C9.28407 6.82177 9.52864 6.92308 9.78365 6.92308C10.0387 6.92308 10.2832 6.82177 10.4636 6.64145C10.6439 6.46113 10.7452 6.21655 10.7452 5.96154C10.7452 5.70652 10.6439 5.46195 10.4636 5.28163C10.2832 5.1013 10.0387 5 9.78365 5C9.52864 5 9.28407 5.1013 9.10374 5.28163C8.92342 5.46195 8.82212 5.70652 8.82212 5.96154Z" fill="white" />
                        <path d="M10.7692 14.2308V8.07692H8.46154V8.46154H9.23077V14.2308H8.46154V14.6154H11.5385V14.2308H10.7692Z" fill="white" />
                        <path d="M10 0C4.47596 0 0 4.47596 0 10C0 15.524 4.47596 20 10 20C15.524 20 20 15.524 20 10C20 4.47596 15.524 0 10 0ZM10 19.1683C4.94712 19.1683 0.831731 15.0577 0.831731 10C0.831731 4.94712 4.94231 0.831731 10 0.831731C15.0529 0.831731 19.1683 4.94231 19.1683 10C19.1683 15.0529 15.0529 19.1683 10 19.1683Z" fill="white" />
                    </svg>
                </div>
                <div style={{
                    width: '100%',
                    height: '2.22vh',
                    display: 'flex',
                    justifyContent: 'center',
                    fontFamily: 'SFPro',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    fontSize: '1.85vh',
                    lineHeight: '2.22vh',
                    opacity: 0.7,
                }}>
                    {inCall ? 'In Call' : 'Calling...'}
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    height: '3.98vh',
                    fontFamily: 'SFPro',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    fontSize: '3.33vh',
                    lineHeight: '3.98vh',
                    color: 'white',
                }}>
                    {callingData.targetName}
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: '32.09vh',
                }}>
                    <div style={{
                        display: 'grid',
                        gap: '3.52vh',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gridTemplateRows: 'repeat(2, 1fr)',
                    }}>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(1.73vh)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }}>
                            <svg width="2.69vh" height="2.22vh" viewBox="0 0 29 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.2743 3.68715C11.1099 3.60517 10.9306 3.56791 10.7588 3.56791C10.4898 3.56791 10.2283 3.65734 10.0117 3.82875L5.14031 7.74876H1.19542C0.537939 7.74876 0 8.28534 0 8.94116V14.9032C0 15.559 0.537939 16.0956 1.19542 16.0956H5.14031L10.0117 20.0081C10.2283 20.1795 10.4973 20.269 10.7588 20.269C10.9306 20.269 11.1099 20.2317 11.2743 20.1497C11.6927 19.9485 11.9542 19.5312 11.9542 19.0766V4.76776C11.9542 4.30571 11.6927 3.88837 11.2743 3.68715ZM28.6154 11.9222C28.6154 7.50283 26.882 3.36669 23.7291 0.259004C23.378 -0.0912633 22.8101 -0.0838109 22.459 0.266456C22.1078 0.616724 22.1153 1.18311 22.4664 1.53338C25.2757 4.29826 26.8148 7.98724 26.8148 11.9222C26.8148 15.8571 25.2682 19.5461 22.4664 22.3109C22.1153 22.6612 22.1078 23.2276 22.459 23.5779C22.6308 23.7567 22.8624 23.8462 23.094 23.8462C23.3182 23.8462 23.5498 23.7567 23.7216 23.5853C26.882 20.4851 28.6154 16.3415 28.6154 11.9222Z" fill="white" />
                                <path d="M23.9383 11.9222C23.9383 8.68032 22.6981 5.63971 20.4417 3.35924C20.0905 3.00898 19.5227 3.00152 19.1716 3.35179C18.8204 3.70206 18.8129 4.26845 19.1641 4.61871C21.0842 6.56382 22.1452 9.15728 22.1452 11.9296C22.1452 14.7019 21.0842 17.2954 19.1641 19.2405C18.8129 19.5908 18.8204 20.1572 19.1716 20.5074C19.3434 20.6788 19.575 20.7683 19.7992 20.7683C20.0308 20.7683 20.2624 20.6788 20.4342 20.5C22.6906 18.2046 23.9383 15.164 23.9383 11.9222Z" fill="white" />
                                <path d="M16.6612 6.44458C16.31 6.09431 15.7422 6.08686 15.391 6.43712C15.0399 6.78739 15.0324 7.35378 15.3836 7.70405C16.4893 8.82192 17.102 10.3199 17.102 11.9222C17.102 13.517 16.4893 15.0149 15.3836 16.1403C15.0324 16.4905 15.0399 17.0569 15.391 17.4072C15.5629 17.5786 15.7945 17.668 16.0186 17.668C16.2503 17.668 16.4819 17.5786 16.6537 17.3997C18.0957 15.9391 18.8876 14.0014 18.8876 11.9296C18.8951 9.85037 18.1032 7.90526 16.6612 6.44458Z" fill="white" fillOpacity="1" />
                            </svg>
                        </div>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(1.73vh)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }}>
                            <svg width="3.06vh" height="1.94vh" viewBox="0 0 33 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M25 6.03818C25 5.57946 25.2102 5.14599 25.5705 4.86174L30.5705 0.917316C31.5542 0.141318 33 0.841434 33 2.09376V19.4981C33 20.8141 31.4244 21.4913 30.4684 20.5863L25.4684 15.8529C25.1694 15.5699 25 15.1764 25 14.7648V6.03818Z" fill="white" fillOpacity="0.76" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M23 3.99702C23 1.78953 21.2091 0 19 0H4C1.79086 0 0 1.78952 0 3.99702V16.9873C0 19.1948 1.79086 20.9843 4 20.9843H19C21.2091 20.9843 23 19.1948 23 16.9873V3.99702ZM11.8456 4.09694C9.77382 4.09694 8.42965 5.08838 7.97273 6.61332C7.78888 7.2269 8.32607 7.76335 8.96704 7.76335C9.577 7.76335 10.0296 7.23546 10.3909 6.74436C10.6766 6.35602 11.1293 6.13188 11.6957 6.13188C12.6448 6.13188 13.2774 6.7371 13.2774 7.57038C13.2774 8.40365 12.9528 8.83345 11.8789 9.50884C10.7301 10.2193 10.2722 11.0087 10.3805 12.3858C10.3897 12.6694 10.6225 12.8946 10.9065 12.8946H12.1379C12.3948 12.8946 12.6031 12.6864 12.6031 12.4297C12.6031 11.5701 12.9111 11.1403 14.0183 10.4649C15.1921 9.73689 15.7998 8.8159 15.7998 7.49144C15.7998 5.49158 14.2264 4.09694 11.8456 4.09694ZM10.1723 15.7101C10.1723 16.482 10.78 17.0872 11.5293 17.0872C12.2868 17.0872 12.8945 16.482 12.8945 15.7101C12.8945 14.9383 12.2868 14.3331 11.5293 14.3331C10.78 14.3331 10.1723 14.9383 10.1723 15.7101Z" fill="white" fillOpacity="0.76" />
                            </svg>
                        </div>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(1.73vh)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }}>
                            <svg width="1.39vh" height="2.22vh" viewBox="0 0 15 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13.9789 23.85C13.6957 23.85 13.4183 23.7067 13.268 23.4487L0.113665 1.22117C-0.117518 0.837043 0.0154125 0.338257 0.408424 0.114663C0.801436 -0.10893 1.30426 0.0171994 1.53544 0.407055L14.6898 22.6346C14.921 23.0187 14.788 23.5175 14.395 23.7411C14.2621 23.8156 14.1176 23.85 13.9789 23.85ZM11.1007 12.8423V3.66923C11.1007 1.65115 9.43614 0 7.40172 0C5.76032 0 4.36166 1.07784 3.88196 2.55126L10.8117 14.2641C10.9966 13.8284 11.1007 13.3468 11.1007 12.8423ZM3.70279 12.8423C3.70279 14.8604 5.36731 16.5115 7.40172 16.5115C7.62713 16.5115 7.84097 16.4886 8.05482 16.4542L3.70279 9.09281V12.8423ZM13.7593 13.0143V9.05841C13.7593 8.61696 13.3952 8.25577 12.9501 8.25577C12.5051 8.25577 12.141 8.61696 12.141 9.05841V13.0143C12.141 13.8857 11.8982 14.6999 11.4821 15.3993L12.3837 16.9243C13.2449 15.8522 13.7593 14.4935 13.7593 13.0143Z" fill="white" fillOpacity="0.76" />
                                <path d="M7.40172 17.7155C4.78935 17.7155 2.66246 15.6057 2.66246 13.0143V9.05841C2.66246 8.61696 2.29835 8.25577 1.85332 8.25577C1.40829 8.25577 1.04418 8.61696 1.04418 9.05841V13.0143C1.04418 16.2191 3.46583 18.8736 6.59258 19.2692V22.2447H4.51193C4.0669 22.2447 3.70279 22.6059 3.70279 23.0474C3.70279 23.4888 4.0669 23.85 4.51193 23.85H10.2915C10.7365 23.85 11.1007 23.4888 11.1007 23.0474C11.1007 22.6059 10.7365 22.2447 10.2915 22.2447H8.21087V19.2692C8.66745 19.2119 9.11248 19.1029 9.53439 18.9539L8.69635 17.532C8.286 17.6524 7.85253 17.7155 7.40172 17.7155Z" fill="white" fillOpacity="0.76" />
                            </svg>
                        </div>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(1.73vh)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }} onClick={() => {
                            if (inCall) {
                                setShowContactsPortal(true);
                            }
                        }}>
                            <svg width="2.04vh" height="2.22vh" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.4113 12.6508C8.86777 12.6508 5.99348 9.8174 5.99348 6.32894C5.99348 2.83396 8.86725 0 12.4113 0C15.9574 0 18.8277 2.83448 18.8277 6.32894C18.8277 9.8174 15.9579 12.6508 12.4113 12.6508Z" fill="white" fillOpacity="0.76" />
                                <path d="M4.29982 14.3866C4.63875 13.6713 5.06571 12.9519 5.61101 12.2655C5.90439 11.8977 6.43959 11.4939 6.95706 11.2173C8.29862 12.6987 10.2431 13.6369 12.4113 13.6369C14.5779 13.6369 16.5219 12.6987 17.862 11.2207C18.3678 11.5039 18.8889 11.9077 19.1726 12.2745C20.0933 13.4584 21.5143 15.7531 21.7409 18.8452C21.7885 19.4978 21.4733 20.4943 20.9199 20.8746C19.8697 21.599 17.6045 22.5256 12.8878 22.5256C11.2549 22.5256 9.87897 22.4264 8.716 22.2719C9.18544 21.4918 9.4601 20.5845 9.4601 19.6134C9.46063 16.7774 7.15845 14.4664 4.29982 14.3866Z" fill="white" fillOpacity="0.76" />
                                <path d="M4.29982 15.3756C6.67436 15.3756 8.59962 17.2729 8.59962 19.6128C8.59962 21.9528 6.67431 23.85 4.29982 23.85C1.92533 23.85 1.69189e-05 21.9527 1.69189e-05 19.6128C1.69189e-05 17.2729 1.92485 15.3756 4.29982 15.3756ZM2.17724 20.3925H3.83593V22.0276C3.83593 22.2982 4.05902 22.5175 4.33367 22.5175C4.60833 22.5175 4.83147 22.2982 4.83147 22.0276V20.393L6.49011 20.3925C6.7653 20.393 6.9879 20.1737 6.98737 19.903C6.98737 19.6318 6.76482 19.4125 6.49011 19.4125H4.83094V17.7779C4.83094 17.5073 4.60833 17.2879 4.33367 17.2884C4.05949 17.2884 3.83646 17.5072 3.83593 17.7784V19.4125H2.17772C1.90306 19.4125 1.68045 19.6318 1.67992 19.903C1.67997 20.1732 1.90258 20.3925 2.17724 20.3925Z" fill="white" fillOpacity="0.76" />
                            </svg>
                        </div>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgb(255, 0, 0)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }} onClick={() => {
                            if (inCall) {
                                fetchNui("endCall", JSON.stringify(callingData));
                            } else {
                                fetchNui("declineCall", JSON.stringify(callingData));
                            }
                        }}>
                            <svg width="3.80vh" height="1.57vh" viewBox="0 0 41 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M38.1519 7.65803C28.3997 -2.09421 12.5881 -2.09422 2.83588 7.65803C2.39591 8.098 1.97576 8.55028 1.57544 9.01394C1.1161 9.54596 0.886428 9.81186 0.790619 10.1674C0.711329 10.4618 0.724888 10.8296 0.825482 11.1175C0.946809 11.4651 1.22034 11.7386 1.76728 12.2856L4.97683 15.4951C5.43685 15.9551 5.66686 16.1852 5.9397 16.3065C6.18065 16.4139 6.44438 16.4603 6.70754 16.4418C7.00545 16.421 7.30028 16.2834 7.88972 16.0083L12.8714 13.6835C13.5573 13.3634 13.9003 13.2033 14.1233 12.9493C14.3201 12.7252 14.4506 12.4509 14.5008 12.157C14.5576 11.8237 14.4658 11.4567 14.2822 10.7223L13.6585 8.22765C18.0446 6.576 22.9423 6.57918 27.3293 8.22765L26.7056 10.7223C26.522 11.4566 26.4303 11.8237 26.4871 12.157C26.5372 12.4509 26.6678 12.7252 26.8645 12.9493C27.0876 13.2034 27.4305 13.3634 28.1163 13.6835L33.0981 16.0083C33.6876 16.2834 33.9823 16.421 34.2802 16.4418C34.5434 16.4603 34.8071 16.4138 35.0481 16.3066C35.321 16.1851 35.551 15.9551 36.011 15.4951L39.2205 12.2856C39.7675 11.7386 40.041 11.4651 40.1624 11.1176C40.263 10.8297 40.2764 10.4618 40.1972 10.1674C40.1014 9.81187 39.8717 9.54588 39.4123 9.0139C39.0121 8.55036 38.5919 8.09803 38.1519 7.65803Z" fill="white" />
                            </svg>
                        </div>
                        <div className="clickButton" style={{
                            width: '6.30vh',
                            height: '6.30vh',
                            flexShrink: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(1.73vh)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: '50%',
                        }} onClick={() => {
                            setShowDialPad(!showDialPad);
                        }}>
                            <svg width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3.31662 17.2167C5.14884 17.2167 6.63325 18.7011 6.63325 20.5334C6.63325 22.3656 5.14884 23.85 3.31662 23.85C1.48439 23.85 -2.47955e-05 22.3656 -2.47955e-05 20.5334C-2.47955e-05 18.7011 1.48439 17.2167 3.31662 17.2167ZM11.925 17.2167C13.7572 17.2167 15.2416 18.7011 15.2416 20.5334C15.2416 22.3656 13.7572 23.85 11.925 23.85C10.0927 23.85 8.60833 22.3656 8.60833 20.5334C8.60833 18.7011 10.0927 17.2167 11.925 17.2167ZM20.5333 17.2167C22.3656 17.2167 23.85 18.7011 23.85 20.5334C23.85 22.3656 22.3656 23.85 20.5333 23.85C18.7011 23.85 17.2167 22.3656 17.2167 20.5334C17.2167 18.7011 18.7011 17.2167 20.5333 17.2167ZM3.31662 8.60836C5.14884 8.60836 6.63325 10.0928 6.63325 11.925C6.63325 13.7572 5.14884 15.2416 3.31662 15.2416C1.48439 15.2416 -2.47955e-05 13.7572 -2.47955e-05 11.925C-2.47955e-05 10.0928 1.48439 8.60836 3.31662 8.60836ZM11.925 8.60836C13.7572 8.60836 15.2416 10.0928 15.2416 11.925C15.2416 13.7572 13.7572 15.2416 11.925 15.2416C10.0927 15.2416 8.60833 13.7572 8.60833 11.925C8.60833 10.0928 10.0927 8.60836 11.925 8.60836ZM20.5333 8.60836C22.3656 8.60836 23.85 10.0928 23.85 11.925C23.85 13.7572 22.3656 15.2416 20.5333 15.2416C18.7011 15.2416 17.2167 13.7572 17.2167 11.925C17.2167 10.0928 18.7011 8.60836 20.5333 8.60836ZM3.31662 0C5.14884 0 6.63325 1.48441 6.63325 3.31664C6.63325 5.14887 5.14884 6.63328 3.31662 6.63328C1.48439 6.63328 -2.47955e-05 5.14887 -2.47955e-05 3.31664C-2.47955e-05 1.48441 1.48439 0 3.31662 0ZM11.925 0C13.7572 0 15.2416 1.48441 15.2416 3.31664C15.2416 5.14887 13.7572 6.63328 11.925 6.63328C10.0927 6.63328 8.60833 5.14887 8.60833 3.31664C8.60833 1.48441 10.0927 0 11.925 0ZM20.5333 0C22.3656 0 23.85 1.48441 23.85 3.31664C23.85 5.14887 22.3656 6.63328 20.5333 6.63328C18.7011 6.63328 17.2167 5.14887 17.2167 3.31664C17.2167 1.48441 18.7011 0 20.5333 0Z" fill="white" fillOpacity="0.76" />
                            </svg>
                        </div>
                    </div>
                </div>
                <CSSTransition nodeRef={nodeRef} in={showDialPad} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {

                }}>
                    <div ref={nodeRef} style={{
                        width: '100%',
                        position: 'absolute',

                        top: '11.56vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width: '100%',
                            height: '3.91vh',
                            display: 'flex',
                            justifyContent: 'center',
                            fontFamily: 'SFPro',
                            fontSize: '2.67vh',
                        }}>
                            {dialedNumber}
                        </div>
                        <DialpadV2 onClick={(value) => {
                            setDialedNumber(dialedNumber + value);
                        }} />
                    </div>
                </CSSTransition>
                <CSSTransition nodeRef={nodeRef} in={showContactsPortal} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
                    const data: string = await fetchNui('getContacts', JSON.stringify({}));
                    const parsedData: PhoneContacts[] = JSON.parse(data);
                    if (parsedData.length === 0) return;
                    const uniqueAlphabets = Array.from(
                        new Set(parsedData.map(contact => contact.firstName.charAt(0).toUpperCase()))
                    ).sort();

                    const contactsByAlphabet: { [key: string]: PhoneContacts[] } = {};
                    uniqueAlphabets.forEach(letter => {
                        contactsByAlphabet[letter] = parsedData.filter(contact => contact.firstName.charAt(0).toUpperCase() === letter);
                    });
                    setPhoneContacts(contactsByAlphabet);
                }}>
                    <div ref={nodeRef} style={{
                        width: '100%',
                        height: '82%',
                        position: 'absolute',
                        top: '11.56vh',
                        backgroundColor: 'rgba(0, 0, 0, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderTopLeftRadius: '1.85vh',
                        borderTopRightRadius: '1.85vh',
                    }}>
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginTop: '0.44vh',
                        }} >
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '1.24vh',
                                color: '#0A84FF',
                                cursor: 'pointer',
                            }} onClick={() => {
                                setShowContactsPortal(false);
                            }}>
                                Cancel
                            </div>
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '1.24vh',
                                color: 'white',
                            }}>
                                Add Contact
                            </div>
                            <div style={{
                                width: '21%',
                                textAlign: 'end',
                                fontSize: '1.24vh',
                                color: '#0A84FF',
                                fontWeight: 500
                            }}>
                                Done
                            </div>
                        </div>
                        <Searchbar mt="1.42vh" value={searchValue} onChange={(e: string) => {
                            setSearchValue(e);
                        }} />
                        <div className="phoneContacts">
                            {Object.keys(phoneContacts).filter(
                                letter => letter.includes(alphabetArrange) && phoneContacts[letter].filter((letter) =>
                                    letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                ).length > 0
                            ).map((letter, index) => {
                                return (
                                    <div key={index}>
                                        <div className="letter">
                                            <div style={{
                                                color: 'rgba(255, 255, 255, 0.40)',
                                                fontFamily: 'SFPro',
                                                fontSize: '1.39vh',
                                                fontStyle: 'normal',
                                                fontWeight: 700,
                                                lineHeight: '118.596%',
                                                marginTop: index === 0 ? '' : '0.38vh',
                                                letterSpacing: '0.03vh',
                                            }}>
                                                {letter}
                                                <div style={{
                                                    width: '25.65vh',
                                                    height: '0.05vh',
                                                    background: 'rgba(255, 255, 255, 0.15)',
                                                }} />
                                            </div>
                                            {phoneContacts[letter].filter((letter) =>
                                                letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                            ).map((contact, index) => {
                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        height: '2.48vh',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'flex-start',
                                                        gap: '0.28vh',
                                                        flexShrink: 0,
                                                        alignSelf: 'stretch',
                                                        cursor: 'pointer',
                                                    }} key={index} onClick={() => {
                                                        fetchNui('addPlayerToCall', JSON.stringify({
                                                            ...contact,
                                                            volume
                                                        })).then((res: boolean) => {
                                                            if (res) {
                                                                setShowContactsPortal(false);
                                                            }
                                                        })
                                                    }}>
                                                        <div style={{
                                                            color: '#FFF',
                                                            fontFamily: 'SFPro',
                                                            fontSize: '15px',
                                                            fontStyle: 'normal',
                                                            fontWeight: 700,
                                                            lineHeight: '120.596%',
                                                            letterSpacing: '0.36px',
                                                        }}>
                                                            {contact.firstName} {contact.lastName}
                                                        </div>
                                                        <div style={{
                                                            width: '25.65vh',
                                                            height: '0.05vh',
                                                            background: 'rgba(255, 255, 255, 0.15)',
                                                        }} />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{
                            position: 'absolute',
                            right: '-0.36vh',
                            top: '7.11vh',
                        }}>
                            <AlphabetSearch onClick={(letter: string) => {
                                if (alphabetArrange === letter) {
                                    setAlphabetArrange('');
                                } else {
                                    setAlphabetArrange(letter);
                                }
                            }} />
                        </div>
                    </div>
                </CSSTransition>
            </div>}
        </Transition>

    )
}