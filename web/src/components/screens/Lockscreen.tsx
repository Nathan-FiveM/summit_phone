import { Transition } from "@mantine/core";

export default function Lockscreen() {
    return (
        <Transition
            mounted={false}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={styles} className="lockscreen">
                <div >
                    Lockscreen
                </div>
            </div>}
        </Transition>
    )
}