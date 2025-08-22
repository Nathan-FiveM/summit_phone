import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";

export default function Calculator(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location } = usePhone();
    const [input, setInput] = useState('');
    const [inputHistory, setInputHistory] = useState('');
    const [lastResult, setLastResult] = useState<number | null>(null);

    const handleButtonClick = (value: string) => {
        const lastChar = input.trim().slice(-1);
        const isOperator = ['+', '-', '×', '÷'].includes(lastChar);

        switch (value) {
            case 'AC':
                setInput('');
                setInputHistory('');
                setLastResult(null);
                break;

            case '+/-':
                if (input && !isNaN(Number(input.trim()))) {
                    setInput((prev) => (prev.startsWith('-') ? prev.slice(1) : `-${prev}`));
                }
                break;
            case '%':
                if (input && !isNaN(Number(input.trim()))) {
                    setInput((prev) => String(Number(prev.trim()) / 100));
                }
                break;
            case '=':
                try {
                    const expression = input.replace('×', '*').replace('÷', '/');
                    const result = eval(expression);
                    setInputHistory(`${input} = ${result}`);
                    setInput(String(result));
                    setLastResult(result);
                } catch (error) {
                    setInput('Error');
                    setTimeout(() => setInput(''), 1000);
                }
                break;
            case 'back':
                setInput((prev) => prev.slice(0, -1));
                break;
            case '+':
            case '×':
            case '÷':
                if (lastResult !== null && !input) {
                    setInput(`${lastResult} ${value} `);
                } else if (input && !isOperator) {
                    setInput((prev) => `${prev.trim()} ${value} `);
                }
                break;
            case '-':
                if (lastResult !== null && !input) {
                    setInput(`${lastResult} ${value} `);
                } else if (!input || isOperator) {
                    setInput((prev) => `${prev}${value}`);
                } else {
                    setInput((prev) => `${prev.trim()} ${value} `);
                }
                break;
            default:
                setInput((prev) => prev + value);
                break;
        }
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'calculator'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={props.onEnter}
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
                <div
                    style={{
                        width: '100%',
                        height: '32%',
                        marginTop: '4.44vh',
                        marginBottom: '0.89vh',
                        padding: '1.78vh',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'flex-end',
                        color: 'white',
                        fontSize: '3.56vh',
                        fontWeight: '300',
                        overflowX: 'auto',
                    }}
                >
                    <div style={{ fontSize: '1.78vh', color: '#888', marginBottom: '0.89vh' }}>
                        {inputHistory || '0'}
                    </div>
                    <div>{input || '0'}</div>
                </div>

                <div
                    className="dialpadV2"
                    style={{
                        marginTop: '0.00vh',
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '1.60vh',
                        padding: '1.78vh',
                    }}
                >
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('AC')} style={{ backgroundColor: '#5D5D5F', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        AC
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('+/-')} style={{ backgroundColor: '#5D5D5F', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        +/-
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('%')} style={{ backgroundColor: '#5D5D5F', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        %
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('÷')} style={{ backgroundColor: '#FF9E09', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="2.31vh" height="2.13vh" viewBox="0 0 25 23" fill="none">
                            <path d="M12.5074 5.03224C11.3154 5.03224 10.3559 4.04862 10.3559 2.87393C10.3551 2.58826 10.4102 2.30524 10.518 2.04115C10.6258 1.77706 10.7843 1.53711 10.9842 1.33508C11.1842 1.13305 11.4217 0.972935 11.6831 0.863939C11.9445 0.754942 12.2246 0.699214 12.5074 0.699959C13.6846 0.699959 14.6441 1.66979 14.6441 2.87393C14.6441 4.048 13.6846 5.03224 12.5074 5.03224ZM23.1913 12.7702H1.80866C1.11091 12.7702 0.5 12.1687 0.5 11.4489C0.5 10.7297 1.11091 10.142 1.80866 10.142H23.1913C23.8891 10.142 24.5 10.7297 24.5 11.4489C24.5 12.1681 23.8891 12.7708 23.1913 12.7708V12.7702ZM12.5074 22.2999C12.2247 22.3007 11.9447 22.245 11.6834 22.1361C11.422 22.0272 11.1846 21.8672 10.9847 21.6653C10.7847 21.4634 10.6263 21.2236 10.5184 20.9596C10.4105 20.6957 10.3552 20.4128 10.3559 20.1272C10.3559 18.9375 11.3154 17.9683 12.5074 17.9683C13.0739 17.9693 13.6169 18.1971 14.0174 18.6018C14.4179 19.0064 14.6433 19.555 14.6441 20.1272C14.6441 21.3307 13.6846 22.2999 12.5074 22.2999Z" fill="white" />
                        </svg>
                    </div>

                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('7')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        7
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('8')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        8
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('9')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        9
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('×')} style={{ backgroundColor: '#FF9E09', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="1.76vh" height="1.76vh" viewBox="0 0 19 19" fill="none">
                            <path d="M0.369482 16.8176C-0.116129 17.3032 -0.130143 18.131 0.369482 18.6306C0.855092 19.1301 1.68313 19.1161 2.18275 18.6306L9.49433 11.3063L16.8205 18.6306C17.3061 19.1161 18.1342 19.1301 18.6198 18.6306C19.134 18.131 19.1194 17.3025 18.6198 16.8176L11.3082 9.49269L18.6198 2.18238C19.1194 1.69685 19.134 0.854336 18.6198 0.369418C18.1342 -0.13012 17.3061 -0.116109 16.8205 0.369418L9.49433 7.69374L2.18275 0.369418C1.68313 -0.116109 0.854483 -0.13012 0.369482 0.369418C-0.130143 0.854945 -0.116129 1.69746 0.369482 2.18238L7.68106 9.49269L0.369482 16.8176Z" fill="white" />
                        </svg>
                    </div>

                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('4')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        4
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('5')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        5
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('6')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        6
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('-')} style={{ backgroundColor: '#FF9E09', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="2.31vh" height="0.28vh" viewBox="0 0 25 3" fill="none">
                            <path d="M1.5 1.5H23.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>

                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('1')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        1
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('2')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        2
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('3')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        3
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('+')} style={{ backgroundColor: '#FF9E09', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.31vh" viewBox="0 0 26 25" fill="none">
                            <path d="M2 12.5H24M13 1.5L13 23.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>

                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('back')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="2.13vh" height="1.57vh" viewBox="0 0 23 17" fill="none">
                            <path d="M16.1771 11.2838L13.9849 9.17088L11.7926 11.2838L11.0935 10.6102L13.2859 8.49705L11.0935 6.38397L11.7926 5.71037L13.9849 7.82349L16.1771 5.71037L16.8762 6.38397L14.6838 8.49705L16.8762 10.6102L16.1771 11.2838Z" fill="white" />
                            <path d="M19.7661 16.0139H8.94833C7.95017 16.0139 7.00069 15.6267 6.34559 14.9525L0.820031 9.26561C0.607422 9.04731 0.4997 8.77204 0.500001 8.49984C0.4997 8.22764 0.607422 7.9526 0.820031 7.73407L6.34563 2.04672C7.00099 1.37268 7.95017 0.98584 8.94837 0.98584H19.7662C21.2763 0.986378 22.4997 2.08078 22.5 3.43193V13.5676C22.4997 14.919 21.2762 16.0136 19.7661 16.0139ZM21.32 3.43193C21.3197 3.04632 21.1468 2.70222 20.8648 2.44887C20.5816 2.19651 20.1971 2.04215 19.7661 2.04161H8.94833C8.29151 2.04161 7.667 2.29627 7.23603 2.73959L1.71077 8.42664C1.68946 8.44882 1.68022 8.47277 1.67992 8.49984C1.68018 8.52691 1.68942 8.55086 1.71043 8.57254L7.23628 14.2596C7.66726 14.7035 8.29177 14.9581 8.94833 14.9581H19.7661C20.1971 14.9578 20.5817 14.8035 20.8648 14.5509C21.1468 14.2978 21.3197 13.9534 21.32 13.5676V3.43193Z" fill="white" />
                        </svg>
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('0')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        0
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('.')} style={{ backgroundColor: '#2A2A2C', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        .
                    </div>
                    <div className="dialpadV2button clickanimation" onClick={() => handleButtonClick('=')} style={{ backgroundColor: '#FF9E09', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.13vh', fontWeight: '400' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="1.94vh" height="1.20vh" viewBox="0 0 21 13" fill="none">
                            <path d="M2 1.5H19M2 11.5H19" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>
            </div>
        </CSSTransition>
    );
}