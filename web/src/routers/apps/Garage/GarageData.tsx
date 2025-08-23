import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import { GarageData } from "../../../../../types/types";
import { Image } from "@mantine/core";
import SelectedData from "./SelectedData";

export default function GarageApp(props: { onEnter: () => void, onExit: () => void }) {
    const nodeRef = useRef(null);
    const { location } = usePhone();
    const [garageData, setGarageData] = useState<GarageData[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set()); // Track failed image loads
    const [showSelectedData, setShowSelectedData] = useState(false);
    const [selectedData, setSelectedData] = useState<GarageData>({
        plate: '',
        garage: '',
        state: '',
        category: '',
        brand: '',
        name: '',
        turboInstalled: false,
        bodyHealth: 0,
        tankHealth: 0,
        fuelLevel: 0,
        engineHealth: 0,
        modSuspension: 0,
        modTransmission: 0,
        modEngine: 0,
        modBrakes: 0,
    });

    // Handle image load error
    const handleImageError = (category: string) => {
        setImageErrors(prev => new Set(prev).add(category));
    };

    const getStateColor = (state: string) => {
        switch (state) {
            case "Parked":
                return "rgb(14, 169, 55)"; // Green
            case "Out":
                return "rgb(255, 165, 0)"; // Orange
            case "Depot":
                return "rgb(255, 0, 0)"; // Red
            case "Impounded":
                return "rgb(128, 0, 128)"; // Purple
            default:
                return "rgb(255, 255, 255)"; // White
        }
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'garage'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const res = await fetchNui('garage:fetchVehicles', "Ok");
                setGarageData(JSON.parse(res as string));
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
                    width: '90%',
                    marginTop: '3.56vh',
                    letterSpacing: '0.12vh',
                }}>
                    <Title title="Garage" />
                </div>
                <Searchbar value={searchValue} onChange={(e) => {
                    setSearchValue(e);
                }} mt="0.53vh" />
                <div style={{
                    width: '90%',
                    height: '80%',
                    marginTop: '0.89vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    {garageData && garageData.filter(
                        (data) => data.brand.toLowerCase().includes(searchValue.toLowerCase()) || data.name.toLowerCase().includes(searchValue.toLowerCase()) || data.plate.toLowerCase().includes(searchValue.toLowerCase()) || data.state.toLowerCase().includes(searchValue.toLowerCase()) || data.category.toLowerCase().includes(searchValue.toLowerCase())
                    ).map((data, i) => {
                        const hasImageError = imageErrors.has(data.category);
                        return (
                            <div key={i} style={{
                                width: '100%',
                                minHeight: '5.87vh',
                                marginTop: i === 0 ? '' : '0.89vh',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                flexShrink: 0,
                                borderRadius: '0.89vh',
                                paddingBottom: '0.36vh',
                                cursor: 'pointer',
                            }} onClick={() => {
                                setSelectedData(data);
                                setShowSelectedData(true);
                            }}>
                                <div style={{
                                    marginLeft: '0.89vh',
                                    marginTop: '0.36vh',
                                    width: '97%',
                                    height: '100%',
                                    display: 'flex',
                                }}>
                                    <div style={{ width: '60%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '1.24vh' }}>{data.brand} {data.name} {data.plate}</div>
                                        <div style={{ 
                                            fontSize: '1.07vh', 
                                            fontWeight: 500, 
                                            width: '100%',
                                            color: getStateColor(data.state)
                                        }}>{data.state} - {data.garage}</div>
                                        <div style={{ fontSize: '1.07vh', width: '100%' }}>{data.category?.toUpperCase()}</div>
                                    </div>
                                    {!hasImageError ? (
                                        <Image onError={() => handleImageError(data.category)} src={`https://cdn.summitrp.gg/uploads/server/phone/${data.category?.toUpperCase()}.png`} alt="vehicle" width={80} height={80} style={{ borderRadius: '0.89vh', marginRight: '0.89vh' }} />
                                    ) : (
                                        <Image src={`https://cdn.summitrp.gg/uploads/server/phone/SPORTS.png`} alt="vehicle" width={80} height={80} style={{ borderRadius: '0.89vh', marginRight: '0.89vh' }} />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <SelectedData show={showSelectedData} data={selectedData} onExit={() => {
                    setShowSelectedData(false);
                }} />
            </div>
        </CSSTransition>
    )
}