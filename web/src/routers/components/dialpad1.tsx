export default function Dialpad(props: { onDial: (digit: string) => void, mt?: string }) {

    return (
        <div className="dialpad1" style={{
            marginTop: props.mt && props.mt,
        }}>
            <div className="button clickanimation" onClick={() => props.onDial('1')}>
                <div className="text">1</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('2')}>
                <div className="text">2</div>
                <div className="text2">ABC</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('3')}>
                <div className="text">3</div>
                <div className="text2">DEF</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('4')}>
                <div className="text">4</div>
                <div className="text2">GHI</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('5')}>
                <div className="text">5</div>
                <div className="text2">JKL</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('6')}>
                <div className="text">6</div>
                <div className="text2">MNO</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('7')}>
                <div className="text">7</div>
                <div className="text2">PQRS</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('8')}>
                <div className="text">8</div>
                <div className="text2">TUV</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('9')}>
                <div className="text">9</div>
                <div className="text2">WXYZ</div>
            </div>
            <div className="button clickanimation" style={{ backgroundColor: 'transparent' }}>
                <div className="text"></div>
                <div className="text2"></div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('0')}>
                <div className="text" style={{ marginTop: '0.55vh', fontSize: '1.24vh' }}>0</div>
            </div>
            <div className="button clickanimation" onClick={() => props.onDial('back')} style={{ backgroundColor: 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="2.05vh" height="1.49vh" viewBox="0 0 22 16" fill="none">
                    <path d="M15.6771 10.7839L13.4849 8.67102L11.2926 10.7839L10.5935 10.1103L12.7859 7.99719L10.5935 5.88411L11.2926 5.21051L13.4849 7.32363L15.6771 5.21051L16.3762 5.88411L14.1838 7.99719L16.3762 10.1103L15.6771 10.7839Z" fill="white" />
                    <path d="M19.2661 15.514H8.44833C7.45017 15.514 6.50069 15.1268 5.84559 14.4526L0.320031 8.76575C0.107422 8.54745 -0.000300153 8.27218 6.2813e-07 7.99998C-0.000300153 7.72778 0.107422 7.45274 0.320031 7.23421L5.84563 1.54686C6.50099 0.872826 7.45017 0.485983 8.44837 0.485983H19.2662C20.7763 0.486521 21.9997 1.58092 22 2.93207V13.0677C21.9997 14.4191 20.7762 15.5137 19.2661 15.514ZM20.82 2.93207C20.8197 2.54646 20.6468 2.20236 20.3648 1.94901C20.0816 1.69665 19.6971 1.54229 19.2661 1.54175H8.44833C7.79151 1.54175 7.167 1.79641 6.73603 2.23973L1.21077 7.92678C1.18946 7.94896 1.18022 7.97291 1.17992 7.99998C1.18018 8.02705 1.18942 8.051 1.21043 8.07268L6.73628 13.7597C7.16726 14.2036 7.79177 14.4582 8.44833 14.4582H19.2661C19.6971 14.4579 20.0817 14.3036 20.3648 14.051C20.6468 13.7979 20.8197 13.4535 20.82 13.0677V2.93207Z" fill="white" />
                </svg>
            </div>
        </div>
    )
}