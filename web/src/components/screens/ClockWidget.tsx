export default function Clock(){
    return (
        <div className="clock">
            <div className="clock__time">
                <span className="clock__time__hours">12</span>
                <span className="clock__time__divider">:</span>
                <span className="clock__time__minutes">00</span>
            </div>
            <div className="clock__date">
                <span className="clock__date__day">Monday</span>
                <span className="clock__date__divider">/</span>
                <span className="clock__date__month">January</span>
            </div>
        </div>
    )
}