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
    const { location, phoneSettings, setLocation } = usePhone();
    const [garageData, setGarageData] = useState<GarageData[]>([]);
    const [searchValue, setSearchValue] = useState('');

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
                    marginTop: '2vw',
                    letterSpacing: '0.07vw',
                }}>
                    <Title title="Garage" />
                </div>
                <Searchbar value={searchValue} onChange={(e) => {
                    setSearchValue(e);
                }} mt="0.3vw" />
                <div style={{
                    width: '90%',
                    height: '80%',
                    marginTop: '0.5vw',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    {garageData && garageData.filter(
                        (data) => data.brand.toLowerCase().includes(searchValue.toLowerCase()) || data.name.toLowerCase().includes(searchValue.toLowerCase()) || data.plate.toLowerCase().includes(searchValue.toLowerCase()) || data.state.toLowerCase().includes(searchValue.toLowerCase()) || data.category.toLowerCase().includes(searchValue.toLowerCase())
                    ).map((data, i) => {
                        return (
                            <div key={i} style={{
                                width: '100%',
                                minHeight: '3.3vw',
                                marginTop: i === 0 ? '' : '0.5vw',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                flexShrink: 0,
                                borderRadius: '0.5vw',
                                paddingBottom: '0.2vw',
                                cursor: 'pointer',
                            }} onClick={()=>{
                                setSelectedData(data);
                                setShowSelectedData(true);
                            }}>
                                <div style={{
                                    marginLeft: '0.5vw',
                                    marginTop: '0.2vw',
                                    width: '97%',
                                    height: '100%',
                                    display: 'flex',
                                }}>
                                    <div style={{ width: '60%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '0.7vw' }}>{data.brand} {data.name} {data.plate}</div>
                                        <div style={{ fontSize: '0.6vw' }}></div>
                                        <div style={{ fontSize: '0.6vw', width: '100%' }}>{data.state}</div>
                                        <div style={{ fontSize: '0.6vw', width: '100%' }}>{data.category?.toUpperCase()}</div>
                                    </div>
                                    <Image src={`https://cdn.summitrp.gg/uploads/server/phone/${data.category?.toUpperCase()}.png`} alt="vehicle" width={80} height={80} style={{ borderRadius: '0.5vw', marginRight: '0.5vw' }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
                <SelectedData show={showSelectedData} data={selectedData} onExit={()=>{
                    setShowSelectedData(false);
                }} />
            </div>
        </CSSTransition>
    )
}