export default function DialpadV2({ onClick, mt }: { onClick(number: string): void, mt?: string }) {
    return (
        <div className="dialpadV2" style={{
            marginTop: mt ? mt : '0.00vh'
        }}>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("1")
            }}>
                <div className="text1">
                    1
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("2")
            }}>
                <div className="text1">
                    2
                </div>
                <div className="text2">
                    ABC
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("3")
            }}>
                <div className="text1">
                    3
                </div>
                <div className="text2">
                    DEF
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("4")
            }}>
                <div className="text1">
                    4
                </div>
                <div className="text2">
                    GHI
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("5")
            }}>
                <div className="text1">
                    5
                </div>
                <div className="text2">
                    JKL
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("6")
            }}>
                <div className="text1">
                    6
                </div>
                <div className="text2">
                    MNO
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("7")
            }}>
                <div className="text1">
                    7
                </div>
                <div className="text2">
                    PQRS
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("8")
            }}>
                <div className="text1">
                    8
                </div>
                <div className="text2">
                    TUV
                </div>
            </div>
            <div className="dialpadV2button clickanimation" onClick={() => {
                onClick("9")
            }}>
                <div className="text1">
                    9
                </div>
                <div className="text2">
                    WXYZ
                </div>
            </div>
            <div className="dialpadV2button1 clickanimation" onClick={() => {
                onClick("0")
            }}>
                <div className="text3">
                    0
                </div>
            </div>
        </div>
    )
}