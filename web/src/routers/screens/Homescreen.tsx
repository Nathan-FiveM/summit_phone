import { DndProvider } from 'react-dnd';
import ClockWidget from "./ClockWidget";
import { TouchBackend } from 'react-dnd-touch-backend';
import IconGridOne from "./IconGridOne";
import IconGridTwo from "./IconGridTwo";
import IconGridThree from "./IconGridThree";
import { usePhone } from '../../store/store';

export default function HomeScreen() {
    const { relayoutMode, setRelayoutMode } = usePhone();

    return (
        <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
            <div className="homescreen" >
                {relayoutMode && <div className="closeAll clickanimation" onClick={() => setRelayoutMode(false)}>Done</div>}
                <div className="firstRow" style={{
                    transition: 'all 1s ease',
                }}>
                    <ClockWidget />
                    <IconGridTwo />
                </div>
                <IconGridOne />
                <IconGridThree />
            </div>
        </DndProvider>
    )
}