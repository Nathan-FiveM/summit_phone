import { Transition } from "@mantine/core";

export default function DarkChatDetails(props: { show: boolean, messages: { from: string, message: string, date: string }[], onSend: (message: string) => void, onClose: () => void }) {
    return (
        <Transition
            mounted={props.show}
            transition="fade"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {

            }}
        >
            {(styles) => <div style={{
                ...styles,
                position: 'absolute',
                zIndex: 1,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 1)',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{
                    
                }}>dsad</div>
            </div>}
        </Transition>
    )
}