import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import { ApartMentData, HouseData } from "../../../../../types/types";
import { Avatar, Transition } from "@mantine/core";
import InputDialog from "../DarkChat/InputDialog";

export default function Housing(props: { onExit: () => void; onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [propertyData, setPropertyData] = useState<any[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
    const [accessNames, setAccessNames] = useState<{ citizenid: string, name: string }[]>([]);
    const [selectedName, setSelectedName] = useState('');

    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);

    const getContainerHeights = () => {
        const totalHeight = 70; // Total available height percentage (100% - other elements)
        const aptCount = propertyData.length;
        const totalCount = aptCount;

        if (totalCount === 0) {
            return { aptHeight: '35%', houseHeight: '35%' };
        }

        // Minimum height for each section
        const minHeight = 20;
        // Maximum height for each section
        const maxHeight = 50;

        if (aptCount === 0) {
            return { aptHeight: '35%', houseHeight: '35%' };
        }

        // Calculate proportional heights
        const aptProportion = aptCount / totalCount;

        let aptHeight = Math.max(minHeight, Math.min(maxHeight, totalHeight * aptProportion));

        // Adjust if total exceeds available height
        const heightSum = aptHeight;
        if (heightSum > totalHeight) {
            const scaleFactor = totalHeight / heightSum;
            aptHeight *= scaleFactor;
        }

        return {
            aptHeight: `${aptHeight}%`,
            houseHeight: '35%'
        };
    };

    const { aptHeight, houseHeight } = getContainerHeights();

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'housing'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const res = await fetchNui('getOwnedHouses', 1);
                const properties = JSON.parse(res as string);
                setPropertyData(properties);
            }}
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
                    alignItems: 'center',
                }}
                className="settings"
            >
                <div style={{
                    marginTop: '3.91vh',
                    width: '90%',
                    letterSpacing: '0.11vh',
                }}>
                    <Title title="Housing" />
                </div>
                <Searchbar value={searchValue} onChange={setSearchValue} mt="0.36vh" />
                <div style={{
                    width: '90%',
                    fontSize: '1.24vh',
                    letterSpacing: '0.05vh',
                    color: 'rgba(255, 255, 255, 0.29)',
                    marginTop: '0.89vh',
                    marginBottom: '0.36vh',
                }}>Properties</div>
                <div style={{
                    width: '90%',
                    maxHeight: aptHeight,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}>
                    {propertyData.filter((a) => {
                        return a.address?.toLowerCase().includes(searchValue?.toLowerCase()) || a.label?.toLowerCase().includes(searchValue?.toLowerCase())
                    }).map((property, index) => (
                        <div key={index} style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            height: '4.98vh',
                            backgroundColor: 'rgb(59, 59, 59)',
                            cursor: 'pointer',
                            borderRadius: '0.62vh',
                            marginTop: index === 0 ? '' : '0.71vh',
                        }} onClick={async () => {
                            setSelectedProperty(property);
                            const data: any = await fetchNui('getKeyHolderNames', property.id);
                            setAccessNames(data);
                        }}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}>
                                <svg width="2.69vh" height="1.94vh" style={{ marginLeft: '0.89vh' }} viewBox="0 0 41 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20.7667 0.194351C20.3983 -0.0765679 19.893 -0.0630115 19.5396 0.227274L0.36529 15.9776C-0.0608895 16.3277 -0.123175 16.9567 0.226072 17.3836L1.16813 18.535C1.51554 18.9596 2.14018 19.025 2.56804 18.6816L19.1248 5.39266C19.8599 4.8026 20.9073 4.80599 21.6386 5.4008L37.8768 18.6079C38.3343 18.98 39.0128 18.8774 39.3399 18.3868L40.2002 17.0963C40.4786 16.6787 40.4044 16.1195 40.0267 15.789L34.8163 11.2299V0.222987H28.4568V5.84877L20.7667 0.194351Z" fill="white" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M19.7479 7.58346C20.1184 7.28578 20.6473 7.2901 21.013 7.59379L34.816 19.0573V29.9994C34.816 31.6563 33.4729 32.9994 31.816 32.9994H8.46411C6.80726 32.9994 5.46411 31.6563 5.46411 29.9994V19.0573L19.7479 7.58346ZM17.2044 23.2154H23.564V32.9994H17.2044V23.2154Z" fill="white" />
                                </svg>
                                <div style={{
                                    marginLeft: '0.89vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'flex-start',
                                }}>
                                    <div style={{ fontSize: '1.33vh', lineHeight: '1.78vh' }}>#{property.id} - {property.label}</div>
                                    <div style={{ fontSize: '0.89vh', lineHeight: '0.89vh', color: 'rgb(137, 137, 137)' }}>{property.address}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Transition
                    mounted={!!selectedProperty}
                    transition="fade"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgb(0, 0, 0)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 1,
                    }}>
                        <div className="header" style={{
                            width: '90%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'start',
                            marginTop: '3.56vh',
                            marginBottom: '1.78vh',
                        }}>
                            <svg style={{
                                cursor: 'pointer',
                                left: '0.89vh',
                                top: '4.44vh',
                            }} onClick={() => {
                                setSelectedProperty(null);
                            }} width="4.26vh" height="1.67vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.99988 16L1.34971 8.93729C1.14519 8.68163 1.14519 8.31837 1.34971 8.06271L6.99988 1" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                                <path d="M16.4471 13H12.703V4.54492H16.3827C17.9706 4.54492 18.9667 5.35938 18.9667 6.6543C18.9667 7.58008 18.2753 8.35352 17.3788 8.48828V8.53516C18.5272 8.62305 19.371 9.46094 19.371 10.5801C19.371 12.0684 18.2518 13 16.4471 13ZM14.4725 5.86328V8.06055H15.744C16.6874 8.06055 17.2264 7.64453 17.2264 6.92969C17.2264 6.25 16.7518 5.86328 15.9257 5.86328H14.4725ZM14.4725 11.6816H15.996C17.0155 11.6816 17.5663 11.248 17.5663 10.4395C17.5663 9.64844 16.9979 9.22656 15.955 9.22656H14.4725V11.6816ZM23.2581 11.8633C24.0022 11.8633 24.6175 11.377 24.6175 10.6973V10.2402L23.2932 10.3223C22.6546 10.3691 22.2913 10.6562 22.2913 11.1016C22.2913 11.5703 22.678 11.8633 23.2581 11.8633ZM22.6956 13.0996C21.5003 13.0996 20.5921 12.3262 20.5921 11.1953C20.5921 10.0527 21.471 9.39062 23.0354 9.29688L24.6175 9.20312V8.78711C24.6175 8.20117 24.2073 7.86133 23.5628 7.86133C22.9241 7.86133 22.5198 8.17773 22.4378 8.64062H20.8733C20.9378 7.42188 21.9749 6.58398 23.6389 6.58398C25.2503 6.58398 26.2991 7.41602 26.2991 8.68164V13H24.6468V12.0391H24.6116C24.26 12.707 23.4807 13.0996 22.6956 13.0996ZM33.7135 9.05664H32.1257C32.026 8.39453 31.5866 7.92578 30.8835 7.92578C30.0397 7.92578 29.5124 8.64062 29.5124 9.85352C29.5124 11.0898 30.0397 11.793 30.8893 11.793C31.5749 11.793 32.0202 11.3828 32.1257 10.6973H33.7194C33.6315 12.1797 32.5241 13.1348 30.8718 13.1348C28.9792 13.1348 27.778 11.9043 27.778 9.85352C27.778 7.83789 28.9792 6.58398 30.86 6.58398C32.5593 6.58398 33.6374 7.63281 33.7135 9.05664ZM36.921 9.23828L39.0538 6.71875H40.9932L38.5968 9.41406L41.1104 13H39.1417L37.3428 10.4453L36.8975 10.9258V13H35.1866V4.54492H36.8975V9.23828H36.921Z" fill="#0A84FF" />
                            </svg>
                        </div>
                        <div style={{
                            width: '95%',
                            height: '40%',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.89vh',
                        }}>
                            <div style={{
                                width: '13.69vh',
                                height: '12.44vh',
                                display: 'flex',
                                borderRadius: '0.89vh',
                                backgroundColor: 'rgba(84, 84, 84, 0.6)',
                                backdropFilter: 'blur(1.78vh)',
                                padding: '0.89vh',
                                flexDirection: 'column',
                                cursor: 'pointer',
                            }} onClick={() => {
                                if (!selectedProperty) return;
                                fetchNui('setLocationOfHouse', { propertyId: selectedProperty.id });
                            }}>
                                <div style={{
                                    width: '3.56vh',
                                    height: '3.56vh',
                                    backgroundColor: 'rgb(114, 114, 114)',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '8.89vh',
                                }}>
                                    <svg width="1.67vh" height="2.69vh" viewBox="0 0 25 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.862 12.7238C17.4241 12.9611 16.8775 12.8 16.6424 12.3664C16.4043 11.9299 16.566 11.385 17.0039 11.1506C19.0728 10.0315 20.0367 8.58421 20.2306 7.16919C20.3335 6.41333 20.216 5.65455 19.9309 4.95143C19.64 4.23952 19.1786 3.59207 18.5937 3.07059C17.4564 2.05692 15.8607 1.52373 14.1944 1.93681C13.5184 2.1038 12.9336 2.44071 12.4223 2.91532C11.8786 3.41922 11.4084 4.07839 10.997 4.85768C10.7648 5.29713 10.2211 5.46412 9.78324 5.23561C9.34242 5.00416 9.17491 4.46218 9.40414 4.02566C9.90961 3.07059 10.5003 2.25028 11.1997 1.5999C11.9315 0.923145 12.7808 0.436821 13.7682 0.193659C16.0605 -0.371766 18.244 0.348931 19.7957 1.73173C20.5833 2.43485 21.2093 3.31082 21.6031 4.27761C21.9998 5.25319 22.1614 6.32544 22.0116 7.41235C21.7441 9.35179 20.4981 11.2971 17.862 12.7238ZM10.9676 19.8048C7.55857 15.2404 7.47629 10.9162 11.6141 6.89673L8.63417 5.25612C6.24787 4.33034 1.86907 11.1535 3.56182 12.9758L5.88346 16.4093L5.40444 17.4054C5.27219 17.7013 5.4015 17.9093 5.72477 18.0529L6.03922 18.1378L0 30.0528L1.22254 32.6514L3.66761 31.9336L4.29651 30.7149L3.69406 29.5899L5.0224 29.3057L5.33097 28.7081L4.63741 27.6534L5.09293 26.7716L6.41832 26.6046L6.85033 25.7696L6.10975 24.8058L6.5829 23.8917L7.93474 23.672L9.77442 20.171L10.0859 20.341C10.6267 20.6691 10.9059 20.4581 10.9676 19.8048ZM17.383 22.6671L16.4837 26.0128L15.2347 26.505L14.9731 27.4805L15.8842 28.251L15.6461 29.1387L14.4118 29.5723L14.1591 30.5098L15.0437 31.3741L14.8732 32.0098L13.6595 32.5576L14.4706 33.5098L14.1209 34.8076L11.9315 36L10.2211 33.7647L13.4832 21.6271L12.6926 21.4161C12.531 21.3722 12.4311 21.2052 12.4752 21.0411L12.8073 19.8078C10.4151 18.0002 9.23075 14.8713 10.0536 11.8039C11.1116 7.86352 15.1025 5.48463 19.0581 6.36939C19.0757 6.58032 19.0728 6.79419 19.0434 7.00805C18.9699 7.54125 18.7377 8.0891 18.3087 8.61937C18.2499 8.68968 18.1882 8.76292 18.1235 8.83323C16.8599 8.7512 15.6755 9.56565 15.3346 10.8313C15.1877 11.3762 15.22 11.927 15.3934 12.4221C15.4345 12.5979 15.5021 12.7678 15.5903 12.9348C15.7989 13.3156 16.1046 13.6057 16.4631 13.7902C16.6982 13.9455 16.9627 14.0627 17.2478 14.1418C18.6672 14.5197 20.1219 13.7053 20.5451 12.3137C20.9742 11.9357 21.3474 11.5373 21.6677 11.1272C22.2907 10.3274 22.7169 9.47776 22.9696 8.61351C24.6859 10.4592 25.4411 13.1164 24.7388 15.7297C23.9159 18.797 21.3151 20.9181 18.341 21.2902L18.0089 22.5235C17.9648 22.6847 17.7973 22.7843 17.6328 22.7403L17.383 22.6671Z" fill="white" />
                                    </svg>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '0.89vh',
                                    marginTop: '3.56vh',
                                    fontSize: '1.42vh',
                                    letterSpacing: '0.09vh',
                                }}>
                                    <div>LOCATION</div>
                                    <div style={{ fontSize: '1.24vh', lineHeight: '0.89vh', letterSpacing: '0.11vh', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Set Waypoint</div>
                                </div>
                            </div>
                            <div style={{
                                width: '13.69vh',
                                height: '12.44vh',
                                display: 'flex',
                                borderRadius: '0.89vh',
                                backgroundColor: 'rgba(84, 84, 84, 0.6)',
                                backdropFilter: 'blur(1.78vh)',
                                padding: '0.89vh',
                                flexDirection: 'column',
                                cursor: 'pointer',
                            }} onClick={() => {
                                setInputShow(true);
                                setInputTitle('Give Access');
                                setInputDescription(`Give Access to Any Person`);
                                setInputPlaceholder('Enter Server ID');
                            }}>
                                <div style={{
                                    width: '3.56vh',
                                    height: '3.56vh',
                                    backgroundColor: 'rgb(114, 114, 114)',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '8.89vh',
                                }}>
                                    <svg width="1.67vh" height="2.69vh" viewBox="0 0 25 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.862 12.7238C17.4241 12.9611 16.8775 12.8 16.6424 12.3664C16.4043 11.9299 16.566 11.385 17.0039 11.1506C19.0728 10.0315 20.0367 8.58421 20.2306 7.16919C20.3335 6.41333 20.216 5.65455 19.9309 4.95143C19.64 4.23952 19.1786 3.59207 18.5937 3.07059C17.4564 2.05692 15.8607 1.52373 14.1944 1.93681C13.5184 2.1038 12.9336 2.44071 12.4223 2.91532C11.8786 3.41922 11.4084 4.07839 10.997 4.85768C10.7648 5.29713 10.2211 5.46412 9.78324 5.23561C9.34242 5.00416 9.17491 4.46218 9.40414 4.02566C9.90961 3.07059 10.5003 2.25028 11.1997 1.5999C11.9315 0.923145 12.7808 0.436821 13.7682 0.193659C16.0605 -0.371766 18.244 0.348931 19.7957 1.73173C20.5833 2.43485 21.2093 3.31082 21.6031 4.27761C21.9998 5.25319 22.1614 6.32544 22.0116 7.41235C21.7441 9.35179 20.4981 11.2971 17.862 12.7238ZM10.9676 19.8048C7.55857 15.2404 7.47629 10.9162 11.6141 6.89673L8.63417 5.25612C6.24787 4.33034 1.86907 11.1535 3.56182 12.9758L5.88346 16.4093L5.40444 17.4054C5.27219 17.7013 5.4015 17.9093 5.72477 18.0529L6.03922 18.1378L0 30.0528L1.22254 32.6514L3.66761 31.9336L4.29651 30.7149L3.69406 29.5899L5.0224 29.3057L5.33097 28.7081L4.63741 27.6534L5.09293 26.7716L6.41832 26.6046L6.85033 25.7696L6.10975 24.8058L6.5829 23.8917L7.93474 23.672L9.77442 20.171L10.0859 20.341C10.6267 20.6691 10.9059 20.4581 10.9676 19.8048ZM17.383 22.6671L16.4837 26.0128L15.2347 26.505L14.9731 27.4805L15.8842 28.251L15.6461 29.1387L14.4118 29.5723L14.1591 30.5098L15.0437 31.3741L14.8732 32.0098L13.6595 32.5576L14.4706 33.5098L14.1209 34.8076L11.9315 36L10.2211 33.7647L13.4832 21.6271L12.6926 21.4161C12.531 21.3722 12.4311 21.2052 12.4752 21.0411L12.8073 19.8078C10.4151 18.0002 9.23075 14.8713 10.0536 11.8039C11.1116 7.86352 15.1025 5.48463 19.0581 6.36939C19.0757 6.58032 19.0728 6.79419 19.0434 7.00805C18.9699 7.54125 18.7377 8.0891 18.3087 8.61937C18.2499 8.68968 18.1882 8.76292 18.1235 8.83323C16.8599 8.7512 15.6755 9.56565 15.3346 10.8313C15.1877 11.3762 15.22 11.927 15.3934 12.4221C15.4345 12.5979 15.5021 12.7678 15.5903 12.9348C15.7989 13.3156 16.1046 13.6057 16.4631 13.7902C16.6982 13.9455 16.9627 14.0627 17.2478 14.1418C18.6672 14.5197 20.1219 13.7053 20.5451 12.3137C20.9742 11.9357 21.3474 11.5373 21.6677 11.1272C22.2907 10.3274 22.7169 9.47776 22.9696 8.61351C24.6859 10.4592 25.4411 13.1164 24.7388 15.7297C23.9159 18.797 21.3151 20.9181 18.341 21.2902L18.0089 22.5235C17.9648 22.6847 17.7973 22.7843 17.6328 22.7403L17.383 22.6671Z" fill="white" />
                                    </svg>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '0.89vh',
                                    marginTop: '3.56vh',
                                    fontSize: '1.42vh',
                                    letterSpacing: '0.09vh',
                                }}>
                                    <div>GIVE KEYS</div>
                                    <div style={{ fontSize: '1.24vh', lineHeight: '0.89vh', letterSpacing: '0.11vh', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Manage Access</div>
                                </div>
                            </div>
                            <div style={{
                                width: '13.69vh',
                                height: '12.44vh',
                                display: 'flex',
                                borderRadius: '0.89vh',
                                backgroundColor: 'rgba(84, 84, 84, 0.6)',
                                backdropFilter: 'blur(1.78vh)',
                                padding: '0.89vh',
                                flexDirection: 'column',
                                cursor: 'pointer',
                            }} onClick={async () => {
                                if (!selectedProperty) return;
                                const newLocked = !selectedProperty.doorLocked;
                                await fetchNui('lockUnLockDoor', { propertyId: selectedProperty.id, doorLocked: newLocked });
                                setSelectedProperty({ ...selectedProperty, doorLocked: newLocked });
                            }}>
                                <div style={{
                                    width: '3.56vh',
                                    height: '3.56vh',
                                    backgroundColor: 'rgb(114, 114, 114)',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '8.89vh',
                                }}>
                                    <svg width="1.67vh" height="2.69vh" viewBox="0 0 25 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.862 12.7238C17.4241 12.9611 16.8775 12.8 16.6424 12.3664C16.4043 11.9299 16.566 11.385 17.0039 11.1506C19.0728 10.0315 20.0367 8.58421 20.2306 7.16919C20.3335 6.41333 20.216 5.65455 19.9309 4.95143C19.64 4.23952 19.1786 3.59207 18.5937 3.07059C17.4564 2.05692 15.8607 1.52373 14.1944 1.93681C13.5184 2.1038 12.9336 2.44071 12.4223 2.91532C11.8786 3.41922 11.4084 4.07839 10.997 4.85768C10.7648 5.29713 10.2211 5.46412 9.78324 5.23561C9.34242 5.00416 9.17491 4.46218 9.40414 4.02566C9.90961 3.07059 10.5003 2.25028 11.1997 1.5999C11.9315 0.923145 12.7808 0.436821 13.7682 0.193659C16.0605 -0.371766 18.244 0.348931 19.7957 1.73173C20.5833 2.43485 21.2093 3.31082 21.6031 4.27761C21.9998 5.25319 22.1614 6.32544 22.0116 7.41235C21.7441 9.35179 20.4981 11.2971 17.862 12.7238ZM10.9676 19.8048C7.55857 15.2404 7.47629 10.9162 11.6141 6.89673L8.63417 5.25612C6.24787 4.33034 1.86907 11.1535 3.56182 12.9758L5.88346 16.4093L5.40444 17.4054C5.27219 17.7013 5.4015 17.9093 5.72477 18.0529L6.03922 18.1378L0 30.0528L1.22254 32.6514L3.66761 31.9336L4.29651 30.7149L3.69406 29.5899L5.0224 29.3057L5.33097 28.7081L4.63741 27.6534L5.09293 26.7716L6.41832 26.6046L6.85033 25.7696L6.10975 24.8058L6.5829 23.8917L7.93474 23.672L9.77442 20.171L10.0859 20.341C10.6267 20.6691 10.9059 20.4581 10.9676 19.8048ZM17.383 22.6671L16.4837 26.0128L15.2347 26.505L14.9731 27.4805L15.8842 28.251L15.6461 29.1387L14.4118 29.5723L14.1591 30.5098L15.0437 31.3741L14.8732 32.0098L13.6595 32.5576L14.4706 33.5098L14.1209 34.8076L11.9315 36L10.2211 33.7647L13.4832 21.6271L12.6926 21.4161C12.531 21.3722 12.4311 21.2052 12.4752 21.0411L12.8073 19.8078C10.4151 18.0002 9.23075 14.8713 10.0536 11.8039C11.1116 7.86352 15.1025 5.48463 19.0581 6.36939C19.0757 6.58032 19.0728 6.79419 19.0434 7.00805C18.9699 7.54125 18.7377 8.0891 18.3087 8.61937C18.2499 8.68968 18.1882 8.76292 18.1235 8.83323C16.8599 8.7512 15.6755 9.56565 15.3346 10.8313C15.1877 11.3762 15.22 11.927 15.3934 12.4221C15.4345 12.5979 15.5021 12.7678 15.5903 12.9348C15.7989 13.3156 16.1046 13.6057 16.4631 13.7902C16.6982 13.9455 16.9627 14.0627 17.2478 14.1418C18.6672 14.5197 20.1219 13.7053 20.5451 12.3137C20.9742 11.9357 21.3474 11.5373 21.6677 11.1272C22.2907 10.3274 22.7169 9.47776 22.9696 8.61351C24.6859 10.4592 25.4411 13.1164 24.7388 15.7297C23.9159 18.797 21.3151 20.9181 18.341 21.2902L18.0089 22.5235C17.9648 22.6847 17.7973 22.7843 17.6328 22.7403L17.383 22.6671Z" fill="white" />
                                    </svg>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '0.89vh',
                                    marginTop: '3.56vh',
                                    fontSize: '1.42vh',
                                    letterSpacing: '0.09vh',
                                }}>
                                    <div>{selectedProperty?.doorLocked ? 'UNLOCK' : 'LOCK'}</div>
                                    <div style={{ fontSize: '1.24vh', lineHeight: '0.89vh', letterSpacing: '0.11vh', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Door Manage</div>
                                </div>
                            </div>
                        </div>
                        <div style={{
                            width: '90%',
                            fontSize: '1.24vh',
                            letterSpacing: '0.05vh',
                            color: 'rgba(255, 255, 255, 0.29)',
                            marginTop: '0.53vh',
                            marginBottom: '0.36vh',
                        }}>Keys</div>
                        <div style={{
                            width: '90%',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.89vh',
                            maxHeight: '26.67vh',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}>
                            {selectedProperty && selectedProperty.keyHolders && Object.keys(selectedProperty.keyHolders).map((citizenid, index) => (
                                <div key={index} style={{
                                    backgroundColor: 'rgba(84, 84, 84, 0.6)',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '0.89vh',
                                    padding: '0.71vh',
                                    gap: '0.89vh',
                                    width: '12.80vh',
                                    height: '5.33vh',
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    setSelectedName(citizenid);
                                    setInputShow(true);
                                    setInputTitle('Remove');
                                    setInputDescription(`Remove Access From ${citizenid}`);
                                    setInputPlaceholder('Type Yes To Confirm');
                                }}>
                                    <Avatar src="https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg" alt="" />
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        fontSize: '1.42vh',
                                    }}>
                                        <div style={{ whiteSpace: 'nowrap', width: '7.20vh', textOverflow: 'ellipsis', overflow: 'hidden' }}>{citizenid}</div>
                                        <div style={{ fontSize: '0.89vh', letterSpacing: '0.09vh', lineHeight: '0.89vh', color: 'rgba(255,255,255,0.6)' }}>Manage</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                            setInputShow(false);
                            if (inputTitle === 'Remove') {
                                if (e.toLowerCase() === 'yes') {
                                    const res = await fetchNui('removeAccess', JSON.stringify({
                                        id: selectedProperty.id,
                                        cid: selectedName,
                                    }));
                                    if (res) {
                                        setSelectedProperty((prev: any) => {
                                            if (!prev) return prev;
                                            const newKeyHolders = { ...prev.keyHolders };
                                            delete newKeyHolders[selectedName];
                                            return { ...prev, keyHolders: newKeyHolders };
                                        });
                                    }
                                }
                            } else if (inputTitle === 'Give Access') {
                                const res = await fetchNui('giveAccess', JSON.stringify({
                                    id: selectedProperty.id,
                                    psrc: e,
                                }));
                            }
                        }} onCancel={() => {
                            setInputShow(false);
                        }} />
                    </div>}
                </Transition>


            </div>
        </CSSTransition>
    );
}