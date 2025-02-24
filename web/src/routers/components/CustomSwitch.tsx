export default function CustomSwitch({ switchValue, setSwitchValue }) {
    return <div className="customSwitch" onClick={() => {
        setSwitchValue(!switchValue);
    }} style={{
        backgroundColor: switchValue ? '#34C759' : '#787880',
        transition: 'all 0.3s ease',
    }}>
        <div className="thumb" style={{
            transform: switchValue ? 'translateX(75%)' : 'translateX(20%)',
            transition: 'all 0.3s ease',
        }}></div>
    </div>
}