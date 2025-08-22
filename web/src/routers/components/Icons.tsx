import { Image } from "@mantine/core";

export default function PhoneIcon({ icon, name, showlabel = true, ref }: { icon: string, name: string, showlabel?: boolean, ref?: any }) {
    return (
        <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition:'all 0.5s ease' }} >
            <Image className="clickanimationXl" src={icon} alt={name} w={'4.63vh'} h={'4.63vh'} />
            {showlabel && <div className="iconName">{name}</div>}
        </div>
    )
}