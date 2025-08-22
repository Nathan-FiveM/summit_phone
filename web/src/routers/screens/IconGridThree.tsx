import React, { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useLocalStorage, useTimeout } from '@mantine/hooks';
import { deleleteIgnoreiconList, deleteIconById, getIconIdByName, icons } from '../../utils/icons';
import { usePhone } from '../../store/store';

const ITEM_TYPE = 'ICON';

interface DraggableIconProps {
    icon: string | null;
    slotId: number;
    name: string;
    index: number;
    moveIcon: (fromSlotId: number, toSlotId: number) => void;
    link: string;
    onClick: (icon: string) => void;
}

const DraggableIcon: React.FC<DraggableIconProps> = ({ icon, slotId, index, link, moveIcon, onClick, name }) => {
    const { relayoutMode, setRelayoutMode } = usePhone();
    const [, drop] = useDrop({
        accept: ITEM_TYPE,
        hover: (draggedItem: any) => {
            if (draggedItem.slotId !== slotId) {
                moveIcon(draggedItem.slotId, slotId);
                draggedItem.slotId = slotId;
            }
        },
    });
    const [slots, setSlots] = useLocalStorage({
        key: 'summit_slots',
        defaultValue: icons,
    });
    const [{ isDragging }, drag] = useDrag({
        type: ITEM_TYPE,
        item: { index, slotId },
        canDrag: relayoutMode && icon !== null,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

    const handleMouseDown = () => {
        if (relayoutMode) return; // Avoid interference with drag mode

        const id = setTimeout(() => {
            setRelayoutMode(true);
        }, 1000);

        setTimerId(id);
    };

    const handleMouseUpOrLeave = () => {
        if (timerId) {
            clearTimeout(timerId);
            setTimerId(null);
        }
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
        >
            <div
                //@ts-ignore
                ref={(node) => drag(drop(node))}
                style={{
                    width: '4.63vh',
                    height: '4.63vh',
                    backgroundImage: icon ? `url(${icon})` : 'none',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'contain',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    zIndex: 1,
                }}
                className='clickanimationXl'
                onClick={() => {
                    if (!relayoutMode && icon) {
                        onClick(link as string);
                    }
                }}
            >
                {icon && !deleleteIgnoreiconList.includes(name) && relayoutMode && (
                    <svg
                        style={{
                            position: 'absolute',
                            left: '-0.36vh',
                            top: '-0.53vh',
                            zIndex: 2,
                        }}
                        onClick={() => {
                            const id = getIconIdByName(name, slots);
                            const updatedSlots = deleteIconById(id, slots);
                            setSlots(updatedSlots);
                        }}
                        width="1.39vh"
                        height="1.39vh"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M15 7.5C15 11.6421 11.6421 15 7.5 15C3.35786 15 0 11.6421 0 7.5C0 3.35786 3.35786 0 7.5 0C11.6421 0 15 3.35786 15 7.5Z"
                            fill="#605F64"
                            fillOpacity="0.54"
                        />
                        <path d="M4 7.2H11V8.2H4V7.2Z" fill="black" />
                    </svg>
                )}
            </div>
        </div>
    );
};


const IconGridThree = () => {
    const [slots, setSlots] = useLocalStorage({
        key: 'summit_slots',
        defaultValue: icons,
    });
    const { location, setLocation } = usePhone();
    const moveIcon = (fromSlotId: any, toSlotId: any) => {
        const updatedSlots = [...slots];

        const fromIndex = updatedSlots.findIndex((slot) => slot.id === fromSlotId);
        const toIndex = updatedSlots.findIndex((slot) => slot.id === toSlotId);

        const [movedIcon] = updatedSlots[fromIndex].icon
            ? [updatedSlots[fromIndex].icon]
            : [null];

        updatedSlots[fromIndex].icon = updatedSlots[toIndex].icon;
        updatedSlots[toIndex].icon = movedIcon;

        const [movedName] = updatedSlots[fromIndex].name
            ? [updatedSlots[fromIndex].name]
            : [''];

        updatedSlots[fromIndex].name = updatedSlots[toIndex].name;
        updatedSlots[toIndex].name = movedName;

        const [movedLink] = updatedSlots[fromIndex].link
            ? [updatedSlots[fromIndex].link]
            : [''];

        updatedSlots[fromIndex].link = updatedSlots[toIndex].link;
        updatedSlots[toIndex].link = movedLink;

        setSlots(updatedSlots);
    };


    return (
        <div>
            <div
                className="thirdRow"
            >
                {slots.slice(16, 20).map((slot, index) => (
                    <DraggableIcon
                        key={slot.id}
                        icon={slot.icon}
                        slotId={slot.id}
                        name={slot.name}
                        index={index}
                        moveIcon={moveIcon}
                        link={slot.link}
                        onClick={(app) => setLocation({
                            app: app,
                            page: location.page,
                        })}
                    />
                ))}
            </div>
        </div>

    );
};

export default IconGridThree;
