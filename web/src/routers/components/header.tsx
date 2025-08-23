import { Transition } from "@mantine/core";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { useEffect, useState } from "react";
import { usePhone } from "../../store/store";
import { useLocalStorage, useTimeout } from "@mantine/hooks";

export default function Header() {
    const { dynamicNoti, setDynamicNoti } = usePhone();
    const [time, setTime] = useState('')

    const { start, clear } = useTimeout(() => {
        setDynamicNoti({ show: false, type: '', timeout: 0, content: dynamicNoti.content });
    }, dynamicNoti.timeout || 1000);

    useNuiEvent('sendTime', (data: string) => {
        setTime(data);
    });

    useEffect(() => {
        if (dynamicNoti.show) {
            start();
        } else {
            clear();
        }

        return () => {
            clear();
        }
    }, [dynamicNoti.show]);
    const [militaryTime] = useLocalStorage<boolean>({
        key: 'militaryTime',
        defaultValue: true
    });
    return (
        <div>
            <div className="headerText" style={{
                gap: militaryTime ? '11.5vh' : '11.5vh',
            }}>
                <div className="timeText" style={{ width: militaryTime ? '5.5vh' : '5.5vh' }}>
                    {militaryTime ? time : (() => {
                        const [hours, minutes] = time.split(':');
                        const hourNum = parseInt(hours, 10);
                        const newHours = (hourNum % 12) || 12;
                        const period = hourNum >= 12 ? 'PM' : 'AM';
                        return `${newHours}:${minutes} ${period}`;
                    })()}
                </div>
                <svg width="9.67vh" height="1.11vh" viewBox="0 0 66 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_410_305)">
                        <path d="M11.2778 3.66645C11.2778 3.2369 11.626 2.88867 12.0556 2.88867H12.8334C13.263 2.88867 13.6112 3.23689 13.6112 3.66645V9.8887C13.6112 10.3183 13.263 10.6665 12.8334 10.6665H12.0556C11.626 10.6665 11.2778 10.3183 11.2778 9.8887V3.66645Z" fill="white" />
                        <path d="M15.1666 2.11079C15.1666 1.68123 15.5148 1.33301 15.9444 1.33301H16.7222C17.1517 1.33301 17.5 1.68123 17.5 2.11079V9.88859C17.5 10.3182 17.1517 10.6664 16.7222 10.6664H15.9444C15.5148 10.6664 15.1666 10.3182 15.1666 9.88859V2.11079Z" fill="white" />
                        <path d="M7.38892 6.38862C7.38892 5.95906 7.73714 5.61084 8.16669 5.61084H8.94447C9.37402 5.61084 9.72225 5.95906 9.72225 6.38862V9.88864C9.72225 10.3182 9.37402 10.6664 8.94447 10.6664H8.16669C7.73714 10.6664 7.38892 10.3182 7.38892 9.88864V6.38862Z" fill="white" />
                        <path d="M3.5 8.33295C3.5 7.9034 3.84822 7.55518 4.27778 7.55518H5.05556C5.48511 7.55518 5.83333 7.9034 5.83333 8.33295V9.88853C5.83333 10.3181 5.48511 10.6663 5.05556 10.6663H4.27778C3.84822 10.6663 3.5 10.3181 3.5 9.88853V8.33295Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M28.5004 3.25786C30.5316 3.25795 32.4853 4.05464 33.9574 5.48327C34.0683 5.59357 34.2454 5.59217 34.3546 5.48015L35.4143 4.3885C35.4696 4.33168 35.5005 4.25471 35.5 4.17463C35.4995 4.09456 35.4678 4.01797 35.4119 3.96182C31.548 0.181998 25.4522 0.181998 21.5883 3.96182C21.5323 4.01793 21.5005 4.0945 21.5 4.17457C21.4995 4.25465 21.5302 4.33164 21.5855 4.3885L22.6455 5.48015C22.7547 5.59234 22.932 5.59373 23.0427 5.48327C24.5151 4.05455 26.4689 3.25785 28.5004 3.25786ZM28.5296 6.55349C29.6456 6.55342 30.7219 6.97686 31.5491 7.74153C31.661 7.85004 31.8373 7.8477 31.9464 7.73622L33.0049 6.64457C33.0606 6.58731 33.0915 6.50963 33.0907 6.42891C33.0899 6.34819 33.0574 6.27117 33.0006 6.21508C30.4813 3.82306 26.5799 3.82306 24.0607 6.21508C24.0038 6.27117 23.9713 6.34823 23.9706 6.42897C23.9699 6.50972 24.0009 6.58739 24.0567 6.64457L25.1149 7.73622C25.224 7.8477 25.4002 7.85004 25.5122 7.74153C26.3389 6.97737 27.4143 6.55397 28.5296 6.55349ZM30.682 8.68425C30.6836 8.76521 30.6525 8.84319 30.5958 8.89994L28.7649 10.786C28.7112 10.8414 28.638 10.8726 28.5617 10.8726C28.4853 10.8726 28.4121 10.8414 28.3585 10.786L26.5272 8.89994C26.4707 8.84319 26.4395 8.76512 26.4413 8.68417C26.4429 8.60322 26.4772 8.52658 26.5361 8.47232C27.7054 7.4628 29.418 7.4628 30.5872 8.47232C30.6461 8.52662 30.6804 8.6033 30.682 8.68425Z" fill="white" />
                        <path d="M61.324 4.74072V8.28319C62.0367 7.98317 62.5001 7.28522 62.5001 6.51196C62.5001 5.73869 62.0367 5.04075 61.324 4.74072Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M42.8575 0.543945C41.0032 0.543945 39.5 2.04716 39.5 3.90146V8.09836C39.5 9.95266 41.0032 11.4559 42.8575 11.4559H57.127C58.9812 11.4559 60.4845 9.95266 60.4845 8.09836V3.90146C60.4845 2.04716 58.9812 0.543945 57.127 0.543945H42.8575ZM47.9916 4.07688L45.471 8.93774H46.7661L49.2376 4.0195V3.01946H45.0078V4.00721H47.9916V4.07688ZM50.1526 5.9827C50.1526 7.89261 51.0421 9.08936 52.5011 9.08936C53.9643 9.08936 54.8496 7.89261 54.8496 5.9827V5.9745C54.8496 4.06048 53.9643 2.87191 52.5011 2.87191C51.0421 2.87191 50.1526 4.06048 50.1526 5.9745V5.9827ZM53.5996 5.9827C53.5996 7.31882 53.2019 8.10983 52.5011 8.10983C51.8044 8.10983 51.4069 7.31882 51.4069 5.9827V5.9745C51.4069 4.63428 51.8044 3.85146 52.5011 3.85146C53.2019 3.85146 53.5996 4.63428 53.5996 5.9745V5.9827Z" fill="white" />
                    </g>
                    <defs>
                        <clipPath id="clip0_410_305">
                            <rect width="66" height="10.912" fill="white" transform="translate(0 0.543945)" />
                        </clipPath>
                    </defs>
                </svg>
            </div>

            <svg style={{ position: 'relative', zIndex: 100, transition: 'all 0.5s ease' }} width={dynamicNoti.show && dynamicNoti.type === 'error' ? "17.78vh" : "8.04vh"} height={dynamicNoti.show && dynamicNoti.type === 'success' ? '13.87vh' : '2.22vh'} viewBox="0 0 87 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect className={dynamicNoti.show && dynamicNoti.type === 'error' ? 'vibrateAnimation' : ''} width="87" height={dynamicNoti.show && dynamicNoti.type === 'success' ? "87" : '24'} rx={dynamicNoti.show && dynamicNoti.type === 'success' ? "20" : "12"} fill="black" style={{ transition: 'all 0.5s ease' }} />
                <path d="M69 17C71.7614 17 74 14.7614 74 12C74 9.23858 71.7614 7 69 7C66.2386 7 64 9.23858 64 12C64 14.7614 66.2386 17 69 17Z" fill="#252527" />
                <circle cx="68.9969" cy="11.9996" r="4.70274" fill="black" stroke="black" strokeWidth="0.392568" />
                <g filter="url(#filter0_f_415_330)">
                    <circle cx="68.4016" cy="11.2418" r="0.668049" fill="white" />
                </g>
                <g filter="url(#filter1_f_415_330)">
                    <circle cx="68.3912" cy="11.29" r="0.325618" fill="white" />
                </g>
                <g filter="url(#filter2_f_415_330)">
                    <ellipse cx="69.6562" cy="12.5707" rx="0.407023" ry="0.51878" transform="rotate(22.5431 69.6562 12.5707)" fill="#8F85AC" />
                </g>
                <g filter="url(#filter3_f_415_330)">
                    <path d="M69.1425 12.3719C68.6526 13.0845 68.4559 13.0586 68.3631 12.9287C68.3074 13.04 68.2406 13.1291 68.1961 13.2627C68.1404 13.4297 68.3631 13.5967 68.5301 13.6524C68.6971 13.7081 69.4765 13.4297 69.6435 13.3184C69.8105 13.207 70.2559 12.873 70.3116 12.6503C70.3673 12.4276 70.4229 11.3699 70.4229 11.2585C70.4229 11.1472 70.4786 11.0358 70.4229 10.8688C70.3784 10.7352 70.1446 10.7761 70.0332 10.8132C69.9961 10.9059 69.8996 11.1249 69.8105 11.2585C69.6992 11.4255 69.7549 11.4812 69.1425 12.3719Z" fill="#494067" />
                </g>
                <foreignObject x="0" y="0" width="87" height="87">
                    <Transition
                        mounted={dynamicNoti.show && dynamicNoti.type === 'success'}
                        transition="scale"
                        duration={500}
                        timingFunction="ease"
                    >
                        {(styles) => <div style={{ ...styles, display: 'flex', justifyContent: 'center', height: '83px', alignItems: 'center' }}>
                            {dynamicNoti.content ? dynamicNoti.content : <svg width="46" height="46" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M25.18 48.36C37.9819 48.36 48.36 37.9819 48.36 25.18C48.36 12.378 37.9819 2 25.18 2C12.378 2 2 12.378 2 25.18C2 37.9819 12.378 48.36 25.18 48.36Z" stroke="#00D03E" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M39.0391 16.9573L18.8115 37.1849L12.3943 30.7677" stroke="#00D03E" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>}
                        </div>}
                    </Transition>
                </foreignObject>
                <defs>
                    <filter id="filter0_f_415_330" x="64.593" y="7.43319" width="7.61714" height="7.61702" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="1.57027" result="effect1_foregroundBlur_415_330" />
                    </filter>
                    <filter id="filter1_f_415_330" x="66.9175" y="9.81629" width="2.94737" height="2.94749" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="0.574032" result="effect1_foregroundBlur_415_330" />
                    </filter>
                    <filter id="filter2_f_415_330" x="67.5087" y="10.3448" width="4.2949" height="4.452" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="0.861047" result="effect1_foregroundBlur_415_330" />
                    </filter>
                    <filter id="filter3_f_415_330" x="63.8691" y="6.45861" width="10.8967" height="11.5193" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="2.15912" result="effect1_foregroundBlur_415_330" />
                    </filter>
                </defs>
            </svg>

        </div >
    )
}